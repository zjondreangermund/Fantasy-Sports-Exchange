import type { RequestHandler } from "express";
import { getSecuritySettings, isPrivilegedAdminRequest, recordSecurityEvent, type SecuritySettings } from "./securityControl.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requestPath(req: any): string {
  const raw = String(req.originalUrl || req.url || req.path || "/");
  const pathname = raw.split("?")[0] || "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function requestUserId(req: any): string {
  return String(req.authUserId || req.user?.claims?.sub || req.user?.id || "");
}

function requestIp(req: any): string {
  return String(req.headers?.["cf-connecting-ip"] || req.headers?.["x-forwarded-for"] || req.ip || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function isRecoveryRoute(method: string, path: string): boolean {
  const upper = method.toUpperCase();
  return (upper === "PATCH" && path === "/api/admin/security")
    || path === "/api/logout"
    || path === "/api/auth/logout";
}

function isAuthenticationMutation(method: string, path: string): boolean {
  if (path === "/api/login" || path === "/api/auth/google" || path === "/api/auth/google/callback") return true;
  return !SAFE_METHODS.has(method.toUpperCase()) && path.startsWith("/api/auth/") && path !== "/api/auth/logout";
}

function isReadOnlyPreviewRequest(method: string, path: string): boolean {
  const upper = String(method || "GET").toUpperCase();
  if (isAuthenticationMutation(upper, path)) return true;
  if (upper === "PATCH" && path === "/api/user/profile") return true;
  if (upper !== "POST") return false;
  return [
    "/api/onboarding/create-offer",
    "/api/onboarding/choose",
    "/api/rewards/daily-login/claim",
    "/api/referrals/claim",
  ].includes(path);
}

function isStateChangingRequest(method: string, path: string): boolean {
  if (isRecoveryRoute(method, path)) return false;
  if (!SAFE_METHODS.has(method.toUpperCase())) return true;
  return isAuthenticationMutation(method, path);
}

function matchesAny(path: string, fragments: string[]): boolean {
  const lower = path.toLowerCase();
  return fragments.some((fragment) => lower.includes(fragment));
}

function isMarketplaceMutationPath(path: string): boolean {
  const lower = path.toLowerCase();
  return matchesAny(lower, ["/marketplace", "/loan-market", "/loans", "/loan-listing", "/loan-offer"])
    || /\/api\/cards\/[^/]+\/(?:list|sell|buy|purchase|unlist|loan|cancel-listing)(?:\/|$)/.test(lower)
    || /\/api\/user\/cards\/[^/]+\/(?:list|sell|unlist|loan)(?:\/|$)/.test(lower);
}

function emergencyReason(settings: SecuritySettings, method: string, path: string): string | null {
  if (isRecoveryRoute(method, path)) return null;

  // The dedicated login switch overrides preview access. When it is off,
  // read-only launch mode still allows registration, starter onboarding and
  // one controlled daily common-card reward while all economy actions stay frozen.
  if (settings.emergency.authPaused && isAuthenticationMutation(method, path)) return "auth_paused";
  if (settings.emergency.readOnly && isStateChangingRequest(method, path) && !isReadOnlyPreviewRequest(method, path)) return "read_only";

  if (!SAFE_METHODS.has(method.toUpperCase())) {
    if (settings.emergency.depositsPaused && matchesAny(path, ["/deposit", "/deposits"])) return "deposits_paused";
    if (settings.emergency.withdrawalsPaused && matchesAny(path, ["/withdraw", "/withdrawal", "/withdrawals"])) return "withdrawals_paused";
    if (settings.emergency.auctionsPaused && matchesAny(path, ["/auction", "/auctions"])) return "auctions_paused";
    if (settings.emergency.marketplacePaused && isMarketplaceMutationPath(path)) return "marketplace_paused";
  }

  return null;
}

function blockedMessage(settings: SecuritySettings, reason: string): string {
  if (reason === "read_only") return settings.emergency.message || "Fantasy Arena is currently in view-only mode.";
  if (reason === "auth_paused") return "New sign-ups and logins are temporarily paused.";
  if (reason === "deposits_paused") return "Deposits are temporarily paused.";
  if (reason === "withdrawals_paused") return "Withdrawals are temporarily paused.";
  if (reason === "marketplace_paused") return "Marketplace buying, selling and loans are temporarily paused.";
  if (reason === "auctions_paused") return "Auction bids, purchases and listings are temporarily paused.";
  return settings.emergency.message || "This action is temporarily unavailable.";
}

/**
 * Strict, route-complete emergency guard.
 *
 * It runs before every application route and re-reads the database for every
 * state-changing request. Read-only preview has a deliberately narrow allowlist
 * for signup/login, starter onboarding and the capped daily common-card reward.
 * Verified administrators bypass only the global Read-only switch so they can
 * continue maintaining the platform; dedicated pause switches remain enforced.
 */
export const strictReadOnlyGuard: RequestHandler = async (req: any, res, next) => {
  const path = requestPath(req);
  if (!path.startsWith("/api/")) return next();

  const method = String(req.method || "GET").toUpperCase();
  const stateChanging = isStateChangingRequest(method, path);
  const mayNeedPartialPauseCheck = stateChanging || isAuthenticationMutation(method, path);
  if (!mayNeedPartialPauseCheck) return next();

  try {
    const record = await getSecuritySettings(true);

    if (!record.updatedAt && stateChanging && !isRecoveryRoute(method, path)) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({
        code: "security_control_unavailable",
        readOnly: true,
        message: "Fantasy Arena is temporarily in view-only mode because security controls could not be verified.",
      });
    }

    const adminReadOnlyBypass = record.settings.emergency.readOnly && isPrivilegedAdminRequest(req);
    const effectiveSettings: SecuritySettings = adminReadOnlyBypass
      ? { ...record.settings, emergency: { ...record.settings.emergency, readOnly: false } }
      : record.settings;
    const reason = emergencyReason(effectiveSettings, method, path);
    if (!reason) return next();

    void recordSecurityEvent({
      userId: requestUserId(req) || null,
      ip: requestIp(req),
      category: "emergency_control",
      action: `request.blocked.${reason}`,
      route: path,
      severity: reason === "read_only" ? "warning" : "info",
      details: { method, strictGuard: true },
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({
      code: reason,
      readOnly: record.settings.emergency.readOnly,
      message: blockedMessage(record.settings, reason),
    });
  } catch (error) {
    console.error("Strict read-only guard could not verify security state:", error);
    if (stateChanging && !isRecoveryRoute(method, path)) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({
        code: "security_control_unavailable",
        readOnly: true,
        message: "Fantasy Arena is temporarily in view-only mode because security controls could not be verified.",
      });
    }
    return next();
  }
};

import type { RequestHandler } from "express";
import { getSecuritySettings, recordSecurityEvent, type SecuritySettings } from "./securityControl.js";

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

function isStateChangingRequest(method: string, path: string): boolean {
  if (isRecoveryRoute(method, path)) return false;
  if (!SAFE_METHODS.has(method.toUpperCase())) return true;
  return isAuthenticationMutation(method, path);
}

function matchesAny(path: string, fragments: string[]): boolean {
  const lower = path.toLowerCase();
  return fragments.some((fragment) => lower.includes(fragment));
}

function emergencyReason(settings: SecuritySettings, method: string, path: string): string | null {
  if (isRecoveryRoute(method, path)) return null;

  if (settings.emergency.readOnly && isStateChangingRequest(method, path)) return "read_only";
  if (settings.emergency.authPaused && isAuthenticationMutation(method, path)) return "auth_paused";

  if (!SAFE_METHODS.has(method.toUpperCase())) {
    if (settings.emergency.depositsPaused && matchesAny(path, ["/deposit", "/deposits"])) return "deposits_paused";
    if (settings.emergency.withdrawalsPaused && matchesAny(path, ["/withdraw", "/withdrawal", "/withdrawals"])) return "withdrawals_paused";
    if (settings.emergency.auctionsPaused && matchesAny(path, ["/auction", "/auctions"])) return "auctions_paused";
    if (settings.emergency.marketplacePaused && matchesAny(path, [
      "/marketplace",
      "/loan-market",
      "/loans",
      "/cards/list",
      "/cards/sell",
      "/cards/buy",
      "/cards/purchase",
      "/cards/unlist",
    ])) return "marketplace_paused";
  }

  return null;
}

function blockedMessage(settings: SecuritySettings, reason: string): string {
  if (reason === "read_only") return settings.emergency.message || "Fantasy Arena is currently in view-only mode.";
  if (reason === "auth_paused") return "New logins are temporarily paused.";
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
 * state-changing request. This avoids stale multi-instance caches and ensures
 * that read-only mode cannot be bypassed by marketplace, card, loan, auction,
 * tournament, wallet, profile, onboarding or admin mutation routes.
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

    // A null timestamp means the security table could not be read. Never fail
    // open for a write request: users may continue viewing, but no state change
    // is allowed until the control plane is available again.
    if (!record.updatedAt && stateChanging && !isRecoveryRoute(method, path)) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({
        code: "security_control_unavailable",
        readOnly: true,
        message: "Fantasy Arena is temporarily in view-only mode because security controls could not be verified.",
      });
    }

    const reason = emergencyReason(record.settings, method, path);
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

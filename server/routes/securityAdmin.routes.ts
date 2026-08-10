import type { Express } from "express";
import {
  clearRateLimitBuckets,
  getRuntimeSecurityStatus,
  getSecurityOverview,
  getSecuritySettings,
  isPrivilegedAdminRequest,
  recordSecurityEvent,
  resolveSecurityEvent,
  revokeOtherSessions,
  updateSecuritySettings,
} from "../services/securityControl.js";
import { registerCommunityChatV2Routes } from "./communityChatV2.routes.js";

interface RegisterSecurityAdminRoutesDeps {
  requireAuth: any;
  isAdmin: any;
}

function userIdFrom(req: any) {
  return String(req.authUserId || req.user?.claims?.sub || req.user?.id || "");
}

export function registerSecurityAdminRoutes(app: Express, deps: RegisterSecurityAdminRoutesDeps) {
  const { requireAuth, isAdmin } = deps;

  // Registered before the main application routes so Community Live v2 remains
  // available during the production preview while retaining its own auth,
  // same-origin, moderation and rate-limit controls.
  registerCommunityChatV2Routes(app, { requireAuth, isAdmin });

  app.get("/api/security/status", async (req: any, res) => {
    try {
      const record = await getSecuritySettings(true);
      const adminBypass = isPrivilegedAdminRequest(req);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      return res.json({
        readOnly: record.settings.emergency.readOnly,
        adminBypass,
        readOnlyAppliesToYou: record.settings.emergency.readOnly && !adminBypass,
        authPaused: record.settings.emergency.authPaused,
        depositsPaused: record.settings.emergency.depositsPaused,
        withdrawalsPaused: record.settings.emergency.withdrawalsPaused,
        marketplacePaused: record.settings.emergency.marketplacePaused,
        auctionsPaused: record.settings.emergency.auctionsPaused,
        message: record.settings.emergency.message,
        updatedAt: record.updatedAt,
        enforcement: "strict_global",
        recoveryRoute: "PATCH /api/admin/security",
      });
    } catch (error: any) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(500).json({ message: error?.message || "Security status unavailable" });
    }
  });

  app.get("/api/admin/security", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const [record, overview] = await Promise.all([
        getSecuritySettings(true),
        getSecurityOverview(req.query?.limit),
      ]);
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        ...record,
        overview,
        runtime: {
          ...getRuntimeSecurityStatus(),
          strictGlobalReadOnlyGuard: true,
          adminReadOnlyBypass: true,
          cloudflareRequestDetected: Boolean(req.headers?.["cf-ray"] || req.headers?.["cf-connecting-ip"]),
          forwardedProtocol: String(req.headers?.["x-forwarded-proto"] || req.protocol || ""),
        },
      });
    } catch (error: any) {
      console.error("Failed to load security center:", error);
      return res.status(500).json({ message: error?.message || "Failed to load security center" });
    }
  });

  app.patch("/api/admin/security", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const candidate = req.body?.settings || req.body;
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return res.status(400).json({ message: "A security settings object is required" });
      }
      const record = await updateSecuritySettings(candidate, userIdFrom(req));
      res.setHeader("Cache-Control", "no-store");
      return res.json({ success: true, ...record, overview: await getSecurityOverview(60) });
    } catch (error: any) {
      console.error("Failed to update security settings:", error);
      return res.status(500).json({ message: error?.message || "Failed to update security settings" });
    }
  });

  app.post("/api/admin/security/events/:id/resolve", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const eventId = Number(req.params.id);
      if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ message: "Valid security event ID required" });
      const result = await resolveSecurityEvent(eventId, userIdFrom(req), String(req.body?.resolution || "Reviewed by administrator"));
      return res.json(result);
    } catch (error: any) {
      const status = String(error?.message || "").includes("not found") ? 404 : 500;
      return res.status(status).json({ message: error?.message || "Failed to resolve security event" });
    }
  });

  app.post("/api/admin/security/rate-limits/clear", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const cleared = clearRateLimitBuckets();
      await recordSecurityEvent({
        userId: userIdFrom(req) || null,
        ip: String(req.ip || ""),
        category: "administration",
        action: "security.rate_limits.cleared",
        route: req.path,
        severity: "info",
        details: { cleared },
      });
      return res.json({ success: true, cleared });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to clear rate limits" });
    }
  });

  app.post("/api/admin/security/sessions/revoke-others", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const revoked = await revokeOtherSessions(String(req.sessionID || ""), userIdFrom(req));
      return res.json({ success: true, revoked });
    } catch (error: any) {
      console.error("Failed to revoke sessions:", error);
      return res.status(500).json({ message: error?.message || "Failed to revoke other sessions" });
    }
  });
}

import type { Express } from "express";
import { listAdminPlayerTransferReport } from "../services/playerTransferMonitoring.js";

export function registerAdminPlayerTransferRoutes(
  app: Express,
  deps: { requireAuth: any; isAdmin: any },
) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/admin/player-transfers", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const limit = Math.max(20, Math.min(250, Number(req.query?.limit || 150) || 150));
      return res.json(await listAdminPlayerTransferReport(limit));
    } catch (error: any) {
      console.error("Failed to load admin player transfer report:", error);
      return res.status(500).json({ message: error?.message || "Failed to load player transfer report" });
    }
  });
}

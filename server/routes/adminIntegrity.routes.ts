import type { Express } from "express";
import { getWalletIntegrityReport, repairMissingWalletsFromLedger } from "../services/walletLedger.js";
import { getCompetitionRewardIntegrity, repairCompetitionRewards } from "../services/tournamentRewards.js";

interface RegisterAdminIntegrityRoutesDeps {
  requireAuth: any;
  isAdmin: any;
}

export function registerAdminIntegrityRoutes(app: Express, deps: RegisterAdminIntegrityRoutesDeps) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/admin/wallet/integrity", requireAuth, isAdmin, async (_req, res) => {
    try {
      return res.json(await getWalletIntegrityReport());
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to inspect wallets" });
    }
  });

  app.post("/api/admin/wallet/repair-missing", requireAuth, isAdmin, async (_req, res) => {
    try {
      const repaired = await repairMissingWalletsFromLedger();
      return res.json({ success: true, repairedCount: repaired.length, repaired });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to repair wallets" });
    }
  });

  app.get("/api/admin/competitions/:id/reward-integrity", requireAuth, isAdmin, async (req, res) => {
    try {
      return res.json(await getCompetitionRewardIntegrity(Number(req.params.id)));
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Failed to inspect rewards" });
    }
  });

  app.post("/api/admin/competitions/:id/repair-rewards", requireAuth, isAdmin, async (req, res) => {
    try {
      return res.json(await repairCompetitionRewards(Number(req.params.id)));
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Failed to repair rewards" });
    }
  });
}

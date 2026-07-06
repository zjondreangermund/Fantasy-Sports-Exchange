import type { Express } from "express";
import { grantAdminTestTeams } from "../services/testTeams.js";

export function registerAdminTestTeamRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

  app.post("/api/admin/test-teams/grant", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const result = await grantAdminTestTeams();
      res.json(result);
    } catch (error: any) {
      console.error("Failed to grant admin test teams:", error);
      res.status(500).json({ message: error?.message || "Failed to grant test teams" });
    }
  });
}

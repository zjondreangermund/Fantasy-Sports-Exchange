import type { Express } from "express";
import { getApiFootballPlayerImageHealth, getApiFootballSyncSummary, runApiFootballSync, type SyncJobType } from "../services/apiFootballSync.js";

const allowedJobs = new Set<SyncJobType>(["fixtures", "live", "completed_stats", "standings", "teams", "players"]);

export function registerApiFootballSyncRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/health/player-images", async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      return res.json(await getApiFootballPlayerImageHealth({ probe: true }));
    } catch (error: any) {
      return res.status(503).json({ service: "api-football-player-images", healthy: false, message: error?.message || "Player image health check failed" });
    }
  });

  app.get("/api/admin/live-data/player-images", requireAuth, isAdmin, async (_req, res) => {
    try { return res.json(await getApiFootballPlayerImageHealth({ probe: true })); }
    catch (error: any) { return res.status(500).json({ message: error?.message || "Could not verify player images" }); }
  });

  app.get("/api/admin/live-data/sync-centre", requireAuth, isAdmin, async (_req, res) => {
    try {
      return res.json(await getApiFootballSyncSummary());
    } catch (error: any) {
      console.error("Could not load API-Football Sync Centre:", error);
      return res.status(500).json({ message: error?.message || "Could not load Sync Centre" });
    }
  });

  app.post("/api/admin/live-data/sync/:jobType", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const jobType = String(req.params.jobType || "") as SyncJobType;
      if (!allowedJobs.has(jobType)) return res.status(400).json({ message: "Unsupported sync job" });
      const result = await runApiFootballSync(jobType);
      return res.json({ ...result, summary: await getApiFootballSyncSummary() });
    } catch (error: any) {
      console.error("API-Football manual sync failed:", error);
      const status = String(error?.message || "").includes("safety cap") ? 429 : 500;
      return res.status(status).json({ message: error?.message || "Sync failed" });
    }
  });
}

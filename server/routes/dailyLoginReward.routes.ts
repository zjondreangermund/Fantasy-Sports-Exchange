import type { Express } from "express";
import {getOutageRecoveryStatus,claimOutageWeeklyCard} from "../services/weeklyRewardOutageRecovery.js";
import { claimDailyLoginReward, getDailyLoginRewardStatus } from "../services/dailyLoginReward.js";

function userIdFrom(req: any): string {
  return String(req.authUserId || req.user?.claims?.sub || req.user?.id || "");
}

function requireSignedIn(req: any, res: any, next: any) {
  const userId = userIdFrom(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  req.authUserId = userId;
  return next();
}

export function registerDailyLoginRewardRoutes(app: Express) {
  // Outage recovery is separate from ordinary weekly claims and never auto-mints.
  app.get("/api/rewards/november-recovery", requireSignedIn, async (req:any,res) => {
    try {
      res.setHeader("Cache-Control","private, no-store");
      return res.json(await getOutageRecoveryStatus(String(req.authUserId)));
    } catch(error:any) {
      console.error("November reward recovery status failed:",error);
      return res.status(500).json({message:"Could not load missed reward status"});
    }
  });
  app.post("/api/rewards/november-recovery/:windowStart/claim", requireSignedIn, async (req:any,res) => {
    try {
      res.setHeader("Cache-Control","private, no-store");
      return res.json(await claimOutageWeeklyCard(String(req.authUserId),String(req.params.windowStart||"")));
    } catch(error:any) {
      console.error("November reward recovery claim failed:",error);
      const message=String(error?.message||"Could not recover weekly card");
      return res.status(409).json({message});
    }
  });

  // Keep the existing API path for backwards compatibility; the reward cadence is weekly.
  app.get("/api/rewards/daily-login", requireSignedIn, async (req: any, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.json(await getDailyLoginRewardStatus(String(req.authUserId)));
    } catch (error: any) {
      console.error("Weekly common reward status failed:", error);
      return res.status(500).json({ message: error?.message || "Weekly reward status is unavailable" });
    }
  });

  app.post("/api/rewards/daily-login/claim", requireSignedIn, async (req: any, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.json(await claimDailyLoginReward(String(req.authUserId)));
    } catch (error: any) {
      console.error("Weekly common reward claim failed:", error);
      return res.status(500).json({ message: error?.message || "Weekly reward could not be collected" });
    }
  });
}

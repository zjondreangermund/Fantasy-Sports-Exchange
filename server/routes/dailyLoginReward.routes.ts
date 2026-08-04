import type { Express } from "express";
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
  app.get("/api/rewards/daily-login", requireSignedIn, async (req: any, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.json(await getDailyLoginRewardStatus(String(req.authUserId)));
    } catch (error: any) {
      console.error("Daily login reward status failed:", error);
      return res.status(500).json({ message: error?.message || "Daily reward status is unavailable" });
    }
  });

  app.post("/api/rewards/daily-login/claim", requireSignedIn, async (req: any, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.json(await claimDailyLoginReward(String(req.authUserId)));
    } catch (error: any) {
      console.error("Daily login reward claim failed:", error);
      return res.status(500).json({ message: error?.message || "Daily reward could not be collected" });
    }
  });
}

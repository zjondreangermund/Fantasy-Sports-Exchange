import { getCommonCollectionPlan, reduceCommonCollection, notifyCommonLimitChange } from "../services/commonCollectionPolicy.js";
import { claimWeeklyCommonReward } from "../services/dailyLoginReward.js";
import type { Express } from "express";
import {getOutageRecoveryStatus,claimOutageWeeklyCard} from "../services/weeklyRewardOutageRecovery.js";
import { claimDailyLoginReward, getDailyLoginRewardStatus, notifyWeeklyCommonRewardWindows } from "../services/dailyLoginReward.js";

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
  const sendLimitNotices = () => notifyCommonLimitChange().catch(error => console.error("Common limit notices failed",error));
  void sendLimitNotices();
  const limitNoticeTimer = setInterval(sendLimitNotices, 60 * 60 * 1000);
  limitNoticeTimer.unref?.();
  app.get("/api/common-collection", requireSignedIn, async (req:any,res) => {
    try { res.setHeader("Cache-Control","no-store"); return res.json(await getCommonCollectionPlan(req.authUserId)); }
    catch(error:any) { return res.status(500).json({message:"Could not load Common collection"}); }
  });
  app.post("/api/common-collection/sacrifice", requireSignedIn, async (req:any,res) => {
    try { return res.json(await reduceCommonCollection(req.authUserId, req.body?.cardIds)); }
    catch(error:any) { return res.status(409).json({message:error.message}); }
  });
  const runWeeklyRewardNotifications = () => {
    notifyWeeklyCommonRewardWindows()
      .then((result) => {
        if (result.readyNotifications || result.expiryNotifications) {
          console.log("Weekly reward notifications:", result);
        }
      })
      .catch((error) => console.error("Weekly reward notification scan failed:", error));
  };
  void runWeeklyRewardNotifications();
  const weeklyRewardNotificationTimer = setInterval(runWeeklyRewardNotifications, 60 * 60 * 1000);
  weeklyRewardNotificationTimer.unref?.();

  // Keep the existing API path for backwards compatibility; the reward cadence is weekly.
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
      return res.json(await claimWeeklyCommonReward(String(req.authUserId), req.body?.replaceCardId));
    } catch (error: any) {
      console.error("Weekly common reward claim failed:", error);
      return res.status(500).json({ message: error?.message || "Weekly reward could not be collected" });
    }
  });
}

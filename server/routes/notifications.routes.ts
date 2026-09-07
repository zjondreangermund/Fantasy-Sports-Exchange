import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { createNotificationOnce, ensureNotificationsSchema } from "../services/notifications.js";
import {
  claimReplacementCard,
  ensurePlayerTransferMonitoringSchema,
  listUserReplacementClaims,
} from "../services/playerTransferMonitoring.js";
import {
  disableWebPushSubscription,
  getWebPushStatus,
  processPendingWebPushDeliveries,
  startWebPushDeliveryWorker,
  upsertWebPushSubscription,
} from "../services/webPush.js";
import {
  disableNativePushSubscription,
  getNativePushStatus,
  processPendingNativePushDeliveries,
  startNativePushDeliveryWorker,
  upsertNativePushSubscription,
} from "../services/nativePush.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function minutesUntil(value: unknown): number | null {
  const time = new Date(String(value || "")).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.round((time - Date.now()) / 60000);
}

async function syncGameweekNotifications(userId: string) {
  const competitions = rowsOf(await db.execute(sql`
    select c.id, c.name, c.status::text as status, c.game_week as "gameWeek",
      c.start_date as "startDate",
      exists (
        select 1 from app.competition_entries ce
        where ce.competition_id = c.id and ce.user_id = ${userId}
      ) as entered
    from app.competitions c
    where c.status::text in ('open', 'upcoming', 'active')
      and (
        c.status::text = 'active'
        or c.start_date between now() - interval '3 days' and now() + interval '30 days'
      )
      and (
        coalesce(c.visibility, 'public') = 'public'
        or exists (
          select 1 from app.competition_entries ce
          where ce.competition_id = c.id and ce.user_id = ${userId}
        )
      )
    order by c.game_week asc, c.start_date asc, c.id asc
    limit 100
  `));

  const upcoming = competitions
    .filter((competition) => ["open", "upcoming"].includes(String(competition.status)))
    .filter((competition) => {
      const minutes = minutesUntil(competition.startDate);
      return typeof minutes === "number" && minutes > 0;
    });

  const nextGameweek = upcoming[0] ? Number(upcoming[0].gameWeek || 0) : 0;
  if (nextGameweek > 0) {
    const gameweekRows = upcoming.filter((competition) => Number(competition.gameWeek || 0) === nextGameweek);
    const openRows = gameweekRows.filter((competition) => String(competition.status) === "open");
    const earliest = [...gameweekRows].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
    const minutes = minutesUntil(earliest?.startDate);

    if (openRows.length) {
      await createNotificationOnce(db, {
        userId,
        title: `Gameweek ${nextGameweek} entries are open`,
        message: `Gameweek ${nextGameweek} tournaments are open. Open Play to review the rarity card requirements and submit your five-card lineup before the deadline.`,
        dedupeKey: `gameweek:${nextGameweek}:entries-open`,
      });
    }

    if (typeof minutes === "number" && minutes > 0 && minutes <= 24 * 60) {
      await createNotificationOnce(db, {
        userId,
        title: `Gameweek ${nextGameweek} starts soon`,
        message: `Gameweek ${nextGameweek} starts within 24 hours. Check submitted teams, captains and unused eligible cards in My Teams & Prizes.`,
        dedupeKey: `gameweek:${nextGameweek}:starts-within-24h`,
      });
    }

    if (openRows.length && typeof minutes === "number" && minutes > 0 && minutes <= 120) {
      await createNotificationOnce(db, {
        userId,
        title: `Gameweek ${nextGameweek} lineup lock approaching`,
        message: `Gameweek ${nextGameweek} locks within two hours. Complete any remaining tournament entries before the deadline. Submitted teams cannot be changed.`,
        dedupeKey: `gameweek:${nextGameweek}:locks-within-2h`,
      });
    }
  }

  const activeByGameweek = new Map<number, any[]>();
  for (const competition of competitions.filter((item) => String(item.status) === "active" && Boolean(item.entered))) {
    const gameWeek = Number(competition.gameWeek || 0);
    if (!gameWeek) continue;
    const current = activeByGameweek.get(gameWeek) || [];
    current.push(competition);
    activeByGameweek.set(gameWeek, current);
  }

  for (const [gameWeek, enteredCompetitions] of activeByGameweek.entries()) {
    await createNotificationOnce(db, {
      userId,
      title: `Gameweek ${gameWeek} is live`,
      message: `${enteredCompetitions.length} of your tournament ${enteredCompetitions.length === 1 ? "team is" : "teams are"} now live for Gameweek ${gameWeek}. Follow scores and rankings in My Teams & Prizes.`,
      dedupeKey: `gameweek:${gameWeek}:entered-teams-live`,
    });
  }
}

let subscribedNotificationSyncTimer: NodeJS.Timeout | null = null;
let subscribedNotificationSyncRunning = false;

async function syncSubscribedUserNotifications() {
  if (subscribedNotificationSyncRunning) return;
  subscribedNotificationSyncRunning = true;
  try {
    await ensureNotificationsSchema();
    const users = rowsOf(await db.execute(sql`
      select user_id as "userId"
      from (
        select user_id from app.web_push_subscriptions where disabled_at is null
        union
        select user_id from app.native_push_subscriptions where disabled_at is null
      ) subscribed_users
      order by user_id
      limit 2000
    `));
    for (const user of users) {
      const userId = String(user.userId || "");
      if (!userId) continue;
      try {
        await syncGameweekNotifications(userId);
      } catch (error) {
        console.error("Failed to prepare scheduled push notifications for a subscribed user:", error);
      }
    }
    await processPendingWebPushDeliveries();
    await processPendingNativePushDeliveries();
  } finally {
    subscribedNotificationSyncRunning = false;
  }
}

function startSubscribedNotificationSync() {
  if (subscribedNotificationSyncTimer) return;
  const run = () => {
    void syncSubscribedUserNotifications().catch((error) => {
      console.error("Scheduled Web Push notification sync failed:", error);
    });
  };
  const initialTimer = setTimeout(run, 15_000);
  initialTimer.unref?.();
  subscribedNotificationSyncTimer = setInterval(run, 15 * 60_000);
  subscribedNotificationSyncTimer.unref?.();
}

export function registerNotificationRoutes(app: Express, deps: { requireAuth: any }) {
  const { requireAuth } = deps;
  startWebPushDeliveryWorker();
  startNativePushDeliveryWorker();
  startSubscribedNotificationSync();

  app.get("/api/push/status", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const [web, native] = await Promise.all([
        getWebPushStatus(userId),
        getNativePushStatus(userId),
      ]);
      return res.json({
        ...web,
        nativeConfigured: native.configured,
        activeNativeSubscriptions: native.activeSubscriptions,
      });
    } catch (error: any) {
      console.error("Failed to load Web Push status:", error);
      return res.status(500).json({ message: error?.message || "Failed to load notification status" });
    }
  });

  app.post("/api/push/subscription", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const subscription = await upsertWebPushSubscription(userId, req.body?.subscription, req.get?.("user-agent"));
      await createNotificationOnce(db, {
        userId,
        title: "Fantasy Arena notifications enabled",
        message: "Installed-app notifications are active. Tournament reminders, results, prize updates and required replacement-card claims can now reach this device.",
        dedupeKey: `web-push:enabled:${subscription.id}`,
      });
      void processPendingWebPushDeliveries().catch((error) => console.error("Immediate Web Push delivery failed:", error));
      return res.json({ success: true, subscription });
    } catch (error: any) {
      console.error("Failed to save Web Push subscription:", error);
      const message = String(error?.message || "Failed to enable notifications");
      const status = /valid|secure|required/i.test(message) ? 400 : 500;
      return res.status(status).json({ message });
    }
  });

  app.delete("/api/push/subscription", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const disabled = await disableWebPushSubscription(userId, req.body?.endpoint);
      return res.json({ success: true, disabled });
    } catch (error: any) {
      const message = String(error?.message || "Failed to disable notifications");
      return res.status(/required/i.test(message) ? 400 : 500).json({ message });
    }
  });

  app.post("/api/push/native-subscription", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const subscription = await upsertNativePushSubscription(userId, req.body?.token, req.body?.platform);
      await createNotificationOnce(db, {
        userId,
        title: "Fantasy Arena notifications enabled",
        message: "Android app notifications are active. Tournament reminders, results, prize updates and required replacement-card claims can now reach this device.",
        dedupeKey: `native-push:enabled:${subscription.id}`,
      });
      void processPendingNativePushDeliveries().catch((error) => console.error("Immediate native push delivery failed:", error));
      return res.json({ success: true, subscription });
    } catch (error: any) {
      console.error("Failed to save native push subscription:", error);
      const message = String(error?.message || "Failed to enable Android notifications");
      const status = /valid|required|currently available/i.test(message) ? 400 : 500;
      return res.status(status).json({ message });
    }
  });

  app.delete("/api/push/native-subscription", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const disabled = await disableNativePushSubscription(userId, req.body?.token);
      return res.json({ success: true, disabled });
    } catch (error: any) {
      const message = String(error?.message || "Failed to disable Android notifications");
      return res.status(/valid|required/i.test(message) ? 400 : 500).json({ message });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      await ensureNotificationsSchema();
      await ensurePlayerTransferMonitoringSchema();
      const userId = String(req.authUserId || "");
      await syncGameweekNotifications(userId);
      const notifications = rowsOf(await db.execute(sql`
        select n.id, n.user_id as "userId", n.type::text as type, n.title, n.message, n.read,
               n.created_at as "createdAt",
               case when n.dedupe_key like 'community-mention:%'
                 then split_part(n.dedupe_key, ':', 2)::bigint else null end as "communityMessageId",
               case when n.dedupe_key like 'community-mention:%'
                 then 'community_mention' else null end as "notificationKind",
               pr.id as "replacementClaimId",
               pr.rarity as "replacementRarity",
               pr.source_card_id as "replacementSourceCardId",
               pr.source_player_name as "replacementSourcePlayerName",
               pr.replacement_card_id as "replacementCardId",
               pr.claimed_at as "replacementClaimedAt"
        from app.notifications n
        left join app.player_replacement_claims pr
          on pr.user_id=n.user_id
         and n.dedupe_key=concat('replacement-claim:', pr.id::text)
        where n.user_id = ${userId}
        order by n.created_at desc nulls last, n.id desc
        limit 100
      `));
      const unreadCount = notifications.filter((item) => !item.read).length;
      return res.json({ notifications, unreadCount });
    } catch (error: any) {
      console.error("Failed to load notifications:", error);
      return res.status(500).json({ message: error?.message || "Failed to load notifications" });
    }
  });

  app.get("/api/player-replacements", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const claims = await listUserReplacementClaims(userId);
      return res.json({ claims, openClaims: claims.filter((claim: any) => !claim.replacementCardId).length });
    } catch (error: any) {
      console.error("Failed to load replacement claims:", error);
      return res.status(500).json({ message: error?.message || "Failed to load replacement claims" });
    }
  });

  app.post("/api/player-replacements/:id/claim", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const claimId = Number(req.params.id);
      if (!Number.isInteger(claimId) || claimId <= 0) return res.status(400).json({ message: "Valid replacement claim required" });
      const result = await claimReplacementCard(userId, claimId);
      return res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Replacement card claim failed:", error);
      const message = String(error?.message || "Failed to mint replacement card");
      const status = message.includes("not found") ? 404 : message.includes("No ") ? 409 : 500;
      return res.status(status).json({ message });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      await ensureNotificationsSchema();
      const userId = String(req.authUserId || "");
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Valid notification required" });
      const notification = rowsOf(await db.execute(sql`
        update app.notifications
        set read = true
        where id = ${id} and user_id = ${userId}
        returning id, read
      `))[0];
      if (!notification) return res.status(404).json({ message: "Notification not found" });
      return res.json({ success: true, notification });
    } catch (error: any) {
      console.error("Failed to mark notification read:", error);
      return res.status(500).json({ message: error?.message || "Failed to update notification" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req: any, res) => {
    try {
      await ensureNotificationsSchema();
      const userId = String(req.authUserId || "");
      const updated = rowsOf(await db.execute(sql`
        update app.notifications
        set read = true
        where user_id = ${userId} and read = false
        returning id
      `));
      return res.json({ success: true, updated: updated.length });
    } catch (error: any) {
      console.error("Failed to mark notifications read:", error);
      return res.status(500).json({ message: error?.message || "Failed to update notifications" });
    }
  });
}

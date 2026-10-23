import { obsoletePrizePromptSql } from "../services/prizeNotificationPolicy.js";
import { reportNotificationHealth } from "../services/notificationHealth.js";
import { getArenaAlertPreferences, setArenaAlertPreferences, ensureArenaAttentionSchema, startArenaAttentionWorker } from "../services/arenaAttention.js";
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { createNotificationOnce, enqueueSignupWelcomeDeliveries, ensureNotificationsSchema } from "../services/notifications.js";
import {
  claimReplacementCard,
  ensurePlayerTransferMonitoringSchema,
  listUserReplacementClaims,
} from "../services/playerTransferMonitoring.js";
import {
  autoReplaceUnlockedDepartures,
  decorateReplacementClaims,
  finalizeReplacementChoice,
} from "../services/departedCardPolicy.js";
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
import {
  assertRealLifeLoanReplacementAllowed,
  ensureRealLifeLoanPolicySchema,
  keepRealLifeLoanCard,
  syncRealLifePlayerLoanChoices,
} from "../services/realLifeLoanMonitoring.js";

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
      c.start_date as "startDate", c.fixture_window_start as "fixtureStart",
      exists (
        select 1 from app.competition_entries ce
        where ce.competition_id = c.id and ce.user_id = ${userId}
      ) as entered
    from app.competitions c
    where c.status::text in ('open', 'upcoming', 'active')
      and (
        c.status::text = 'active'
        or coalesce(c.fixture_window_start, c.start_date) between now() - interval '3 days' and now() + interval '30 days'
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
      // NOTIFICATION_TRUTH_GUARDS_V1:gameweek-clock
      // start_date is the Tuesday entry-opening date. Start/lock alerts must use the
      // first eligible Premier League kickoff, otherwise users can be warned days early.
      const minutes = minutesUntil(competition.fixtureStart || competition.startDate);
      return typeof minutes === "number" && minutes > 0;
    });

  const nextGameweek = upcoming[0] ? Number(upcoming[0].gameWeek || 0) : 0;
  if (nextGameweek > 0) {
    const gameweekRows = upcoming.filter((competition) => Number(competition.gameWeek || 0) === nextGameweek);
    const openRows = gameweekRows.filter((competition) => String(competition.status) === "open");
    const earliest = [...gameweekRows].sort((a, b) => new Date(a.fixtureStart || a.startDate).getTime() - new Date(b.fixtureStart || b.startDate).getTime())[0];
    const minutes = minutesUntil(earliest?.fixtureStart || earliest?.startDate);

    if (openRows.length) {
      await createNotificationOnce(db, {
        userId,
        title: `Gameweek ${nextGameweek} entries are open`,
        message: `Gameweek ${nextGameweek} tournaments are open. Open Play to review the rarity card requirements and submit your five-card lineup before the deadline.`,
        dedupeKey: `gameweek:${nextGameweek}:entries-open`,
      });
    }

    // PRODUCTION_NOTIFICATION_TIMING_V1: the first 24-hour reminder is explicitly a lineup-lock warning.
    // The scheduler runs every 15 minutes and createNotificationOnce keeps it exactly-once per gameweek.
    if (openRows.length && typeof minutes === "number" && minutes > 0 && minutes <= 24 * 60) {
      await createNotificationOnce(db, {
        userId,
        title: `Gameweek ${nextGameweek} lineup locks within 24 hours`,
        message: `Gameweek ${nextGameweek} locks within 24 hours. Review your submitted teams and captains, or complete any remaining tournament entries before the deadline.`,
        dedupeKey: `gameweek:${nextGameweek}:locks-within-24h`,
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

  // GAMEWEEK_ENTRY_CLOSED_GOOD_LUCK_V1: the scoring lifecycle sends one
  // entries-closed/good-luck notice at actual first kickoff to every entrant.
  // Suppress the old separate 'GW is live' push here to avoid back-to-back alerts.

}

// NATIVE_APP_UPDATE_NOTIFICATION_V1
const ANDROID_RELEASES_API = "https://api.github.com/repos/zjondreangermund/Fantasy-Sports-Exchange/releases?per_page=20";
const NATIVE_SCROLL_ROLLOUT_KEY = "native-web-update:full-page-scroll-v1";
let androidReleaseCache: { checkedAt: number; release: { version: string } | null } | null = null;

function parseNativeVersion(value: unknown): number[] | null {
  const match = String(value || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareNativeVersions(left: string, right: string) {
  const a = parseNativeVersion(left);
  const b = parseNativeVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

async function latestAndroidRelease(): Promise<{ version: string } | null> {
  if (androidReleaseCache && Date.now() - androidReleaseCache.checkedAt < 30 * 60_000) return androidReleaseCache.release;
  try {
    const response = await fetch(ANDROID_RELEASES_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Fantasy-Arena-Server" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`GitHub releases returned ${response.status}`);
    const releases: any[] = await response.json();
    const candidates = (Array.isArray(releases) ? releases : [])
      .filter((release) => !release?.draft && !release?.prerelease)
      .map((release) => {
        const version = String(release?.tag_name || "").match(/^android-(\d+\.\d+\.\d+)$/i)?.[1];
        const hasApk = Array.isArray(release?.assets) && release.assets.some((asset: any) => String(asset?.name || "").toLowerCase() === "fantasy-arena-android.apk");
        return version && hasApk ? { version } : null;
      })
      .filter(Boolean) as Array<{ version: string }>;
    candidates.sort((a, b) => compareNativeVersions(b.version, a.version));
    const release = candidates[0] || null;
    androidReleaseCache = { checkedAt: Date.now(), release };
    return release;
  } catch (error) {
    console.error("Android release notification check failed:", error);
    androidReleaseCache = { checkedAt: Date.now(), release: null };
    return null;
  }
}

async function syncNativeAppUpdateNotifications() {
  // Update notifications stay OFF until the in-app 1.1.11 updater has been
  // validated end-to-end. This prevents legacy 1.1.9/1.1.10 users being sent
  // to the old browser/GitHub download flow.
  if (String(process.env.NATIVE_APP_UPDATE_NOTIFICATIONS_ENABLED || "").toLowerCase() !== "true") return;
  await ensureNotificationsSchema();
  const rows = rowsOf(await db.execute(sql`
    select user_id as "userId",
           array_remove(array_agg(distinct app_version), null) as versions
    from app.native_push_subscriptions
    group by user_id
    order by user_id
    limit 5000
  `));
  if (!rows.length) return;

  const rolloutCreated = 0; // Do not replay an obsolete one-time website rollout.

  const release = await latestAndroidRelease();
  let binaryCreated = 0;
  if (release) {
    for (const row of rows) {
      const userId = String(row.userId || "");
      const versions = Array.isArray(row.versions) ? row.versions.map(String).filter((value: string) => parseNativeVersion(value)) : [];
      if (!userId || !versions.length) continue;
      if (!versions.some((version: string) => compareNativeVersions(version, release.version) < 0)) continue;
      const notification = await createNotificationOnce(db, {
        userId,
        title: `Fantasy Arena ${release.version} update available`,
        message: "A newer signed Android app is ready. Open Fantasy Arena and tap Update Fantasy Arena. It installs over your current app—no uninstall, sign-up or data reset.",
        dedupeKey: `android-update:${release.version}`,
      });
      if (notification?.id) binaryCreated += 1;
    }
  }

  if (rolloutCreated || binaryCreated) {
    console.log(`[native-update] queued rollout=${rolloutCreated} android=${binaryCreated} latest=${release?.version || "none"}`);
  }
}

let subscribedNotificationSyncTimer: NodeJS.Timeout | null = null;
let subscribedNotificationSyncRunning = false;

async function syncSubscribedUserNotifications() {
  if (subscribedNotificationSyncRunning) return;
  subscribedNotificationSyncRunning = true;
  try {
    await ensureNotificationsSchema();
    await reportNotificationHealth().catch(error => console.error("Notification health report failed:", error?.message));
    // DELAYED_EPL_DEPARTURE_REPLACEMENT_V1
    // Create/remind pending departure claims and auto-mint only after the
    // 14-day manual claim window expires.
    await syncRealLifePlayerLoanChoices().catch((error) => {
      console.error("Real-life player loan sync failed:", error);
    });
    await autoReplaceUnlockedDepartures().catch((error) => {
      console.error("Delayed EPL departure replacement sweep failed:", error);
    });
    // Create Inbox events for every eligible account, even without a push token.
    // Delivery still requires that user's existing notification subscription.
    const users = rowsOf(await db.execute(sql`
      select id as "userId" from app.users
      where coalesce(is_banned,false)=false and id not like 'qa-onboarding-%'
      order by id
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
    await syncNativeAppUpdateNotifications();
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
  startArenaAttentionWorker();


  // Actionable alerts and card-price watchlists. User preferences are persistent.
  app.get("/api/notification-preferences", requireAuth, async (req: any, res) => {
    try { return res.json({ preferences: await getArenaAlertPreferences(String(req.authUserId)) }); }
    catch(error: any){ return res.status(500).json({message:String(error?.message || "Could not load alert settings")}); }
  });
  app.put("/api/notification-preferences", requireAuth, async (req: any, res) => {
    try { return res.json({ preferences: await setArenaAlertPreferences(String(req.authUserId),req.body?.preferences || {}) }); }
    catch(error: any){ return res.status(500).json({message:String(error?.message || "Could not update alert settings")}); }
  });
  app.get("/api/marketplace/price-watches", requireAuth, async (req: any, res) => {
    try {
      await ensureArenaAttentionSchema();
      const watch=rowsOf(await db.execute(sql`SELECT card_id AS "cardId" FROM app.arena_price_watches WHERE user_id=${String(req.authUserId)} ORDER BY created_at DESC`));
      return res.json({cards:watch.map(row=>Number(row.cardId))});
    } catch(error:any){ return res.status(500).json({message:error?.message||"Could not load watches"}); }
  });
  app.post("/api/marketplace/price-watches/:cardId",requireAuth,async(req:any,res)=>{
    try{
      await ensureArenaAttentionSchema();
      const userId=String(req.authUserId);
      const cardId=Number(req.params.cardId);
      if(!Number.isInteger(cardId)||cardId<=0)return res.status(400).json({message:"Valid card required"});
      const result=rowsOf(await db.execute(sql`SELECT id FROM app.player_cards WHERE id=${cardId} AND owner_id IS DISTINCT FROM ${userId} LIMIT 1`));
      if(!result.length)return res.status(404).json({message:"This card cannot be watched"});
      await db.execute(sql`INSERT INTO app.arena_price_watches(user_id,card_id) VALUES(${userId},${cardId}) ON CONFLICT DO NOTHING`);
      return res.json({success:true,watched:true,cardId});
    }catch(error:any){return res.status(500).json({message:error?.message||"Could not watch card"});}
  });
  app.delete("/api/marketplace/price-watches/:cardId",requireAuth,async(req:any,res)=>{
    try{
      await ensureArenaAttentionSchema();
      const cardId=Number(req.params.cardId);
      if(!Number.isInteger(cardId)||cardId<=0)return res.status(400).json({message:"Valid card required"});
      await db.execute(sql`DELETE FROM app.arena_price_watches WHERE user_id=${String(req.authUserId)} AND card_id=${cardId}`);
      return res.json({success:true,watched:false,cardId});
    }catch(error:any){return res.status(500).json({message:error?.message||"Could not remove watch"});}
  });

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
      // SIGNUP_WELCOME_NOTIFICATION_V1: a just-created account may have received its Inbox welcome before this device subscribed.
      // Queue that existing welcome for this newly registered PWA/web device without creating a second Inbox row.
      await enqueueSignupWelcomeDeliveries(db, userId);
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
      const subscription = await upsertNativePushSubscription(userId, req.body?.token, req.body?.platform, req.body?.appVersion);
      // SIGNUP_WELCOME_NOTIFICATION_V1: queue the existing signup welcome for the newly registered Android device.
      await enqueueSignupWelcomeDeliveries(db, userId);
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
      await ensureRealLifeLoanPolicySchema();
      const userId = String(req.authUserId || "");
      await syncRealLifePlayerLoanChoices(userId);
      await syncGameweekNotifications(userId);
      const notifications = rowsOf(await db.execute(sql`
        select n.id, n.user_id as "userId", n.type::text as type, n.title, n.message, n.read,
               n.dedupe_key as "dedupeKey",
               n.created_at as "createdAt",
               case when n.dedupe_key like 'community-mention:%'
                 then split_part(n.dedupe_key, ':', 2)::bigint else null end as "communityMessageId",
               case when n.dedupe_key like 'community-mention:%'
                 then 'community_mention' else null end as "notificationKind",
               pr.id as "replacementClaimId",
               pr.rarity as "replacementRarity",
               pr.source_card_id as "replacementSourceCardId",
               pr.source_player_name as "replacementSourcePlayerName",
               source_player.position::text as "replacementSourcePosition",
               pr.replacement_card_id as "replacementCardId",
               pr.claimed_at as "replacementClaimedAt",
               pr.decision as "replacementDecision",
               pr.departure_kind as "replacementDepartureKind",
               pr.real_life_loan_from_team as "replacementLoanFromTeam",
               pr.real_life_loan_to_team as "replacementLoanToTeam",
               pr.real_life_loan_evidence as "replacementLoanEvidence",
               case
                 when pr.id is not null and coalesce(pr.departure_kind,'permanent') <> 'real_life_loan'
                 then pr.created_at + interval '14 days'
                 else null
               end as "replacementAutoMintAt"
        from app.notifications n
        left join app.player_replacement_claims pr
          on pr.user_id=n.user_id
         and n.dedupe_key in (
           concat('replacement-claim:', pr.id::text),
           concat('replacement-reminder:', pr.id::text)
         )
        left join app.players source_player on source_player.id=pr.source_player_id
        where n.user_id = ${userId}
          and coalesce(n.dedupe_key, '') not like '%self-test%'
          and not ${obsoletePrizePromptSql()}
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
      await autoReplaceUnlockedDepartures(userId).catch((error) => {
        console.error("User delayed EPL departure replacement sweep failed:", error);
      });
      const rawClaims = await listUserReplacementClaims(userId);
      const claims = await decorateReplacementClaims(userId, rawClaims);
      const openClaims = claims.filter((claim: any) =>
        !claim.replacementCardId
      ).length;
      return res.json({ claims, openClaims });
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
      await assertRealLifeLoanReplacementAllowed(userId, claimId);
      const result = await claimReplacementCard(userId, claimId);
      await finalizeReplacementChoice(userId, claimId);
      return res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Replacement card claim failed:", error);
      const message = String(error?.message || "Failed to mint replacement card");
      const status = message.includes("not found") ? 404 : message.includes("No ") ? 409 : 500;
      return res.status(status).json({ message });
    }
  });

  app.post("/api/player-replacements/:id/keep", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const claimId = Number(req.params.id);
      if (!Number.isInteger(claimId) || claimId <= 0) return res.status(400).json({ message: "Valid replacement claim required" });
      const result = await keepRealLifeLoanCard(userId, claimId);
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const message = String(error?.message || "Could not keep this card");
      return res.status(message.includes("not found") ? 404 : 409).json({ message });
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

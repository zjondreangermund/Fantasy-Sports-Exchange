import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { obsoletePrizePromptSql } from "./prizeNotificationPolicy.js";

export type ArenaNotificationType = "win" | "runner_up" | "system";

let notificationsSchemaPromise: Promise<void> | null = null;

export async function ensureNotificationsSchema(): Promise<void> {
  if (!notificationsSchemaPromise) {
    notificationsSchemaPromise = (async () => {
      await db.execute(sql`
        create table if not exists app.notifications (
          id serial primary key,
          user_id varchar(255) not null references app.users(id),
          type text not null default 'system',
          title text not null,
          message text not null,
          read boolean not null default false,
          dedupe_key text,
          created_at timestamp default now()
        )
      `);
      await db.execute(sql`alter table if exists app.notifications add column if not exists dedupe_key text`);
      await db.execute(sql`create unique index if not exists notifications_user_dedupe_idx on app.notifications (user_id, dedupe_key)`);
      await db.execute(sql`create index if not exists notifications_user_unread_idx on app.notifications (user_id, read, created_at desc)`);
      // MINT_PUSH_FLOOD_GUARD_V1: store one recent push claim per user and reminder family.
      // Ordinary Inbox events remain individual and never get dropped.
      await db.execute(sql`
        create table if not exists app.notification_push_topic_limits (
          user_id varchar(255) not null references app.users(id) on delete cascade,
          topic text not null,
          last_queued_at timestamptz not null default now(),
          primary key(user_id, topic)
        )
      `);
      // Notification categories are stored here so they exist before scheduled workers start.
      await db.execute(sql`CREATE TABLE IF NOT EXISTS app.arena_alert_preferences(
        user_id varchar(255) primary key references app.users(id) on delete cascade,
        preferences jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      )`);
      await db.execute(sql`
        create table if not exists app.web_push_config (
          id smallint primary key,
          public_key text not null,
          private_key text not null,
          subject text not null,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now(),
          constraint web_push_single_config check (id = 1)
        )
      `);
      await db.execute(sql`
        create table if not exists app.web_push_subscriptions (
          id bigserial primary key,
          user_id varchar(255) not null references app.users(id) on delete cascade,
          endpoint text not null unique,
          p256dh text not null,
          auth text not null,
          expiration_time bigint,
          user_agent text,
          failure_count integer not null default 0,
          disabled_at timestamp,
          last_success_at timestamp,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now()
        )
      `);
      await db.execute(sql`create index if not exists web_push_subscriptions_user_idx on app.web_push_subscriptions (user_id, disabled_at)`);
      await db.execute(sql`
        create table if not exists app.native_push_subscriptions (
          id bigserial primary key,
          user_id varchar(255) not null references app.users(id) on delete cascade,
          token text not null unique,
          platform text not null,
          failure_count integer not null default 0,
          disabled_at timestamp,
          last_success_at timestamp,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now()
        )
      `);
      await db.execute(sql`create index if not exists native_push_subscriptions_user_idx on app.native_push_subscriptions (user_id, disabled_at)`);
      await db.execute(sql`
        create table if not exists app.notification_push_deliveries (
          id bigserial primary key,
          notification_id integer not null references app.notifications(id) on delete cascade,
          subscription_id bigint not null references app.web_push_subscriptions(id) on delete cascade,
          status text not null default 'pending',
          attempts integer not null default 0,
          next_attempt_at timestamp not null default now(),
          last_error text,
          sent_at timestamp,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now(),
          unique (notification_id, subscription_id)
        )
      `);
      await db.execute(sql`create index if not exists notification_push_due_idx on app.notification_push_deliveries (status, next_attempt_at, id)`);
      await db.execute(sql`
        create table if not exists app.notification_native_push_deliveries (
          id bigserial primary key,
          notification_id integer not null references app.notifications(id) on delete cascade,
          subscription_id bigint not null references app.native_push_subscriptions(id) on delete cascade,
          status text not null default 'pending',
          attempts integer not null default 0,
          next_attempt_at timestamp not null default now(),
          last_error text,
          sent_at timestamp,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now(),
          unique (notification_id, subscription_id)
        )
      `);
      await db.execute(sql`create index if not exists notification_native_push_due_idx on app.notification_native_push_deliveries (status, next_attempt_at, id)`);
    })().catch((error) => {
      notificationsSchemaPromise = null;
      throw error;
    });
  }
  await notificationsSchemaPromise;
}

export async function createNotificationOnce(tx: any, input: {
  userId: string;
  type?: ArenaNotificationType;
  title: string;
  message: string;
  dedupeKey: string;
}) {
  const userId = String(input.userId || "").trim();
  const title = String(input.title || "").trim().slice(0, 240);
  const message = String(input.message || "").trim().slice(0, 4000);
  const dedupeKey = String(input.dedupeKey || "").trim().slice(0, 240);
  const type: ArenaNotificationType = input.type === "win" || input.type === "runner_up" ? input.type : "system";
  if (!userId || !title || !message || !dedupeKey) return null;
  // Stop retrospective prize-mint prompts and reminders for already-issued cards.
  if (/^competition:\d+:entry:\d+:(free-card-claim-ready|free-card-claimed|common-cap-choice|common-cap-replaced)$/.test(dedupeKey)) {
    const obsolete = await tx.execute(sql`select 1 from
      (select ${userId}::text as user_id, ${dedupeKey}::text as dedupe_key) n
      where ${obsoletePrizePromptSql()} limit 1`);
    if (Array.isArray(obsolete?.rows) && obsolete.rows.length) return null;
  }

  const result = await tx.execute(sql`
    insert into app.notifications (user_id, type, title, message, read, dedupe_key, created_at)
    values (${userId}, ${type}, ${title}, ${message}, false, ${dedupeKey}, now())
    on conflict (user_id, dedupe_key) do nothing
    returning id, user_id as "userId", type::text as type, title, message, read, created_at as "createdAt"
  `);
  const notification = Array.isArray(result?.rows) ? result.rows[0] || null : null;
  // Category preferences affect optional device pushes, not the permanent Inbox.
  // Mandatory confirmations, financial/security events and account actions always queue.
  const pushCategory: string | null =
    dedupeKey.startsWith("card:weekly-ready:") || dedupeKey.startsWith("card:weekly-expiring:") ||
      dedupeKey.startsWith("replacement-claim:") || dedupeKey.startsWith("replacement-reminder:") ? "mint" :
    dedupeKey.startsWith("prize-ladder:") || dedupeKey.includes(":momentum:") ||
      dedupeKey.includes(":public-settlement-winner") ? "marketing" :
    dedupeKey.startsWith("gameweek:") || dedupeKey.startsWith("fixture-change:") ||
      dedupeKey.includes(":decider:") || dedupeKey.includes(":rank:") ||
      dedupeKey.includes(":goal:") || dedupeKey.includes(":assist:") ||
      dedupeKey.includes(":save-tier:") ? "tournament" :
    dedupeKey.startsWith("player-availability:") || dedupeKey.startsWith("booking:") ? "players" :
    dedupeKey.startsWith("prize-level:") || dedupeKey.startsWith("prize-award:") ? "prizes" :
    dedupeKey.startsWith("marketplace:price-change:") || dedupeKey.includes(":expires-in-24h") ? "marketplace" :
    dedupeKey.startsWith("community-mention:") ? "community" : null;
  let queuePush = true;
  if(pushCategory){
    const setting = await tx.execute(sql`
      SELECT preferences ->> ${pushCategory} AS preference
      FROM app.arena_alert_preferences WHERE user_id=${userId}
    `);
    const value = Array.isArray(setting?.rows) ? setting.rows[0]?.preference : null;
    queuePush = value === "true" ? true : value === "false" ? false : pushCategory !== "marketing";
  }
  // MINT_PUSH_FLOOD_GUARD_V1. A poll, deploy or several cards needing mint
  // must never turn into a string of identical phone alerts. Preserve every
  // item in Inbox; limit just optional device pushes to one prompt per 12h.
  // Mint confirmations and real financial/booking alerts are NOT throttled.
  const mintPushTopic = dedupeKey.startsWith("card:weekly-ready:") || dedupeKey.startsWith("card:weekly-expiring:")
    ? "mint-weekly-reminder" :
    dedupeKey.startsWith("replacement-claim:") || dedupeKey.startsWith("replacement-reminder:")
      ? "mint-replacement-choice" : null;
  const livePushTopic = dedupeKey.startsWith("competition:")
    && /:(?:rank:|goal:|assist:|save-tier:|gk-risk:)/.test(dedupeKey)
    ? "live-score-updates" : null;
  const limitedTopic = mintPushTopic || livePushTopic;
  if (notification?.id && queuePush && limitedTopic) {
    // One card-mint reminder per 12h or one live-score update per 30 minutes.
    // Important red cards, payouts, prize claims and security messages bypass this guard.
    const quietMinutes = mintPushTopic ? 720 : 30;
    const permit = await tx.execute(sql`
      insert into app.notification_push_topic_limits (user_id,topic,last_queued_at)
      values (${userId},${limitedTopic},now())
      on conflict (user_id,topic) do update
        set last_queued_at=now()
        where app.notification_push_topic_limits.last_queued_at <= now()-(${quietMinutes}*interval '1 minute')
      returning user_id
    `);
    queuePush = Array.isArray(permit?.rows) && permit.rows.length > 0;
  }
  if (notification?.id && queuePush) {
    await tx.execute(sql`
      insert into app.notification_push_deliveries (notification_id, subscription_id, status, next_attempt_at, created_at, updated_at)
      select ${Number(notification.id)}, subscription.id, 'pending', now(), now(), now()
      from app.web_push_subscriptions subscription
      where subscription.user_id = ${userId}
        and subscription.disabled_at is null
        and (
          lower(coalesce(subscription.user_agent,'')) not like '%android%'
          or (
            not exists (
              select 1
              from app.native_push_subscriptions native_subscription
              where native_subscription.user_id=${userId}
                and native_subscription.disabled_at is null
            )
            and subscription.id = (
              select mobile_subscription.id
              from app.web_push_subscriptions mobile_subscription
              where mobile_subscription.user_id=${userId}
                and mobile_subscription.disabled_at is null
                and lower(coalesce(mobile_subscription.user_agent,'')) like '%android%'
              order by mobile_subscription.updated_at desc, mobile_subscription.id desc
              limit 1
            )
          )
        )
      on conflict (notification_id, subscription_id) do nothing
    `);
    await tx.execute(sql`
      insert into app.notification_native_push_deliveries (notification_id, subscription_id, status, next_attempt_at, created_at, updated_at)
      select ${Number(notification.id)}, subscription.id, 'pending', now(), now(), now()
      from app.native_push_subscriptions subscription
      where subscription.user_id = ${userId} and subscription.disabled_at is null
      on conflict (notification_id, subscription_id) do nothing
    `);
  }
  return notification;
}


/**
 * GAMEWEEK_ENTRY_CLOSED_GOOD_LUCK_V1
 * Notify each manager with at least one submitted GW entry after the FIRST PL
 * kickoff, not after the earlier FPL fantasy deadline. One Inbox/push event per
 * account per season/GW, irrespective of rarity or number of teams submitted.
 * Catch up after a short deployment outage, but never announce old weeks late.
 */
export async function notifyGameweekEntriesClosed(fixtures: any[], nowMs = Date.now()): Promise<number> {
  if (!Array.isArray(fixtures) || !fixtures.length) return 0;

  const firstKickoffByWeek = new Map<number, number>();
  for (const fixture of fixtures) {
    const week = Number(fixture?.event || 0);
    const kickoff = new Date(String(fixture?.kickoff_time || "")).getTime();
    if (!Number.isInteger(week) || week < 1 || week > 38 || !Number.isFinite(kickoff)) continue;
    const old = firstKickoffByWeek.get(week);
    if (old === undefined || kickoff < old) firstKickoffByWeek.set(week, kickoff);
  }

  const eligible = [...firstKickoffByWeek.entries()].filter(([, kickoff]) =>
    nowMs >= kickoff && nowMs - kickoff <= 6 * 60 * 60 * 1000
  );
  if (!eligible.length) return 0;
  await ensureNotificationsSchema();

  let sent = 0;
  for (const [gameWeek, kickoff] of eligible) {
    const cutoff = new Date(kickoff);
    const seasonStartYear = cutoff.getUTCFullYear() - (cutoff.getUTCMonth() < 6 ? 1 : 0);
    const season = `${seasonStartYear}-${String((seasonStartYear + 1) % 100).padStart(2, "0")}`;
    const dedupeKey = `gameweek:${season}:${gameWeek}:entries-closed-good-luck`;
    // Legacy user-created cups can have NULL season. Limit these by the actual
    // fixture window so an old GW with the same number is never notified.
    const earliestCreated = new Date(kickoff - 14 * 86400000);
    const latestCreated = new Date(kickoff + 7 * 86400000);
    const result = await db.execute(sql`
      SELECT ce.user_id AS "userId", COUNT(DISTINCT ce.id)::int AS "teamCount"
      FROM app.competition_entries ce
      JOIN app.competitions c ON c.id = ce.competition_id
      JOIN app.users u ON u.id = ce.user_id
      WHERE c.game_week = ${gameWeek}
        AND (c.season = ${season} OR (c.season IS NULL AND c.start_date BETWEEN ${earliestCreated} AND ${latestCreated}))
        AND c.name NOT LIKE '[TEST]%'
        AND ce.user_id NOT LIKE 'test-bot-%'
        AND ce.user_id NOT LIKE 'qa-onboarding-%'
        AND COALESCE(u.is_banned, false) = false
        AND NOT EXISTS (
          SELECT 1 FROM app.notifications n
          WHERE n.user_id = ce.user_id AND n.dedupe_key = ${dedupeKey}
        )
      GROUP BY ce.user_id
      ORDER BY ce.user_id
      LIMIT 200
    `);
    const recipients = Array.isArray(result?.rows) ? result.rows : [];
    for (const recipient of recipients) {
      const teamCount = Number(recipient.teamCount || 0);
      const notification = await createNotificationOnce(db, {
        userId: String(recipient.userId || ""),
        title: `🔒 GW${gameWeek} Entries Closed — Good Luck!`,
        message: `Gameweek ${gameWeek} entries are now closed. Your ${teamCount} ${teamCount === 1 ? "team is" : "teams are"} locked in. Good luck! ⚽🏆 Follow your live points and leaderboard in My Entries.`,
        dedupeKey,
      });
      if (notification?.id) sent += 1;
    }
  }
  return sent;
}

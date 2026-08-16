import { sql } from "drizzle-orm";
import { db } from "../db.js";

export const DAILY_LOGIN_COMMON_CARD_CAP = 20;
export const WEEKLY_COMMON_REWARD_INTERVAL_DAYS = 7;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

let schemaReady: Promise<void> | null = null;

export async function ensureDailyLoginRewardSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.daily_login_rewards (
          id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          user_id varchar(255) NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
          reward_day date NOT NULL,
          card_id integer NOT NULL UNIQUE REFERENCES app.player_cards(id) ON DELETE RESTRICT,
          created_at timestamp NOT NULL DEFAULT now(),
          CONSTRAINT daily_login_rewards_user_day_unique UNIQUE (user_id, reward_day)
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS daily_login_rewards_user_idx ON app.daily_login_rewards (user_id, reward_day DESC)`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function weeklyEligibility(executor: any, userId: string) {
  const row = rowsOf(await executor.execute(sql`
    WITH account AS (
      SELECT ((u.created_at AT TIME ZONE current_setting('TIMEZONE')) AT TIME ZONE 'Africa/Windhoek')::date AS signup_day
      FROM app.users u
      WHERE u.id = ${userId}
      LIMIT 1
    ), latest_reward AS (
      SELECT max(dlr.reward_day)::date AS last_reward_day
      FROM app.daily_login_rewards dlr
      WHERE dlr.user_id = ${userId}
    ), schedule AS (
      SELECT
        account.signup_day,
        latest_reward.last_reward_day,
        GREATEST(
          account.signup_day + 1,
          COALESCE(latest_reward.last_reward_day + ${WEEKLY_COMMON_REWARD_INTERVAL_DAYS}, account.signup_day + 1)
        )::date AS next_eligible_day
      FROM account
      CROSS JOIN latest_reward
    )
    SELECT
      to_char(signup_day, 'YYYY-MM-DD') AS "signupDay",
      to_char(signup_day + 1, 'YYYY-MM-DD') AS "firstEligibleFrom",
      to_char(next_eligible_day, 'YYYY-MM-DD') AS "eligibleFrom",
      to_char(last_reward_day, 'YYYY-MM-DD') AS "lastRewardDay",
      ((now() AT TIME ZONE 'Africa/Windhoek')::date >= next_eligible_day) AS "eligibleForWeeklyReward",
      (last_reward_day IS NOT NULL AND (now() AT TIME ZONE 'Africa/Windhoek')::date < next_eligible_day) AS "claimedThisWeek",
      (((next_eligible_day::timestamp) AT TIME ZONE 'Africa/Windhoek')) AS "eligibleAt"
    FROM schedule
  `))[0];

  if (!row) throw new Error("User account was not found for weekly reward eligibility");
  return {
    signupDay: String(row.signupDay || ""),
    firstEligibleFrom: String(row.firstEligibleFrom || ""),
    eligibleFrom: String(row.eligibleFrom || ""),
    lastRewardDay: row.lastRewardDay ? String(row.lastRewardDay) : null,
    eligibleForWeeklyReward: Boolean(row.eligibleForWeeklyReward),
    claimedThisWeek: Boolean(row.claimedThisWeek),
    eligibleAt: row.eligibleAt ? new Date(row.eligibleAt).toISOString() : null,
  };
}

async function loadRewardCard(executor: any, userId: string, rewardDay?: string | null) {
  const rows = rowsOf(await executor.execute(sql`
    SELECT
      pc.id,
      pc.player_id AS "playerId",
      pc.owner_id AS "ownerId",
      pc.rarity::text AS rarity,
      pc.serial_id AS "serialId",
      pc.serial_number AS "serialNumber",
      pc.max_supply AS "maxSupply",
      pc.level,
      pc.xp,
      pc.for_sale AS "forSale",
      pc.price,
      pc.acquired_at AS "acquiredAt",
      p.id AS "profileId",
      p.name,
      p.team,
      p.league,
      p.position::text AS position,
      p.overall,
      p.image_url AS "imageUrl"
    FROM app.daily_login_rewards dlr
    JOIN app.player_cards pc ON pc.id = dlr.card_id
    JOIN app.players p ON p.id = pc.player_id
    WHERE dlr.user_id = ${userId}
      AND dlr.reward_day = COALESCE(${rewardDay || null}::date, (now() AT TIME ZONE 'Africa/Windhoek')::date)
    LIMIT 1
  `));
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    playerId: Number(row.playerId),
    ownerId: row.ownerId,
    rarity: row.rarity,
    serialId: row.serialId,
    serialNumber: row.serialNumber == null ? null : Number(row.serialNumber),
    maxSupply: row.maxSupply == null ? null : Number(row.maxSupply),
    level: Number(row.level || 1),
    xp: Number(row.xp || 0),
    forSale: Boolean(row.forSale),
    price: Number(row.price || 0),
    acquiredAt: row.acquiredAt ? new Date(row.acquiredAt).toISOString() : null,
    player: {
      id: Number(row.profileId),
      name: row.name,
      team: row.team,
      league: row.league,
      position: row.position,
      overall: Number(row.overall || 0),
      imageUrl: row.imageUrl || null,
    },
  };
}

export async function getDailyLoginRewardStatus(userId: string) {
  await ensureDailyLoginRewardSchema();
  const [row, eligibility] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM app.player_cards pc WHERE pc.owner_id = ${userId} AND pc.rarity::text = 'common') AS "commonCount",
        (SELECT count(*)::int FROM app.daily_login_rewards dlr WHERE dlr.user_id = ${userId}) AS "rewardCount",
        to_char((now() AT TIME ZONE 'Africa/Windhoek')::date, 'YYYY-MM-DD') AS "rewardDay"
    `).then((result) => rowsOf(result)[0] || {}),
    weeklyEligibility(db, userId),
  ]);

  const commonCount = Number(row.commonCount || 0);
  const capReached = commonCount >= DAILY_LOGIN_COMMON_CARD_CAP;
  const rewardDay = String(row.rewardDay || "");
  const claimedToday = Boolean(eligibility.lastRewardDay && eligibility.lastRewardDay === rewardDay);
  const canClaim = eligibility.eligibleForWeeklyReward && !capReached;
  return {
    cap: DAILY_LOGIN_COMMON_CARD_CAP,
    cadenceDays: WEEKLY_COMMON_REWARD_INTERVAL_DAYS,
    commonCount,
    rewardCount: Number(row.rewardCount || 0),
    remaining: Math.max(0, DAILY_LOGIN_COMMON_CARD_CAP - commonCount),
    claimedToday,
    claimedThisWeek: eligibility.claimedThisWeek,
    canClaim,
    capReached,
    rewardDay,
    signupDay: eligibility.signupDay,
    firstEligibleFrom: eligibility.firstEligibleFrom,
    eligibleFrom: eligibility.eligibleFrom,
    eligibleForWeeklyReward: eligibility.eligibleForWeeklyReward,
    eligibleForDailyReward: eligibility.eligibleForWeeklyReward,
    lastRewardDay: eligibility.lastRewardDay,
    nextEligibleAt: capReached || canClaim ? null : eligibility.eligibleAt,
    card: eligibility.lastRewardDay ? await loadRewardCard(db, userId, eligibility.lastRewardDay) : null,
  };
}

export async function claimDailyLoginReward(userId: string) {
  await ensureDailyLoginRewardSchema();

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`weekly-common:${userId}`}))`);

    const dayRow = rowsOf(await tx.execute(sql`
      SELECT to_char((now() AT TIME ZONE 'Africa/Windhoek')::date, 'YYYY-MM-DD') AS "rewardDay"
    `))[0] || {};
    const rewardDay = String(dayRow.rewardDay || "");

    const existing = rowsOf(await tx.execute(sql`
      SELECT id FROM app.daily_login_rewards
      WHERE user_id = ${userId}
        AND reward_day = (now() AT TIME ZONE 'Africa/Windhoek')::date
      LIMIT 1
    `))[0];

    const commonRow = rowsOf(await tx.execute(sql`
      SELECT count(*)::int AS count
      FROM app.player_cards
      WHERE owner_id = ${userId} AND rarity::text = 'common'
    `))[0] || {};
    const commonCount = Number(commonRow.count || 0);
    const eligibility = await weeklyEligibility(tx, userId);

    if (existing) {
      return {
        claimed: false,
        alreadyClaimed: true,
        cap: DAILY_LOGIN_COMMON_CARD_CAP,
        cadenceDays: WEEKLY_COMMON_REWARD_INTERVAL_DAYS,
        commonCount,
        remaining: Math.max(0, DAILY_LOGIN_COMMON_CARD_CAP - commonCount),
        claimedToday: true,
        claimedThisWeek: true,
        canClaim: false,
        capReached: commonCount >= DAILY_LOGIN_COMMON_CARD_CAP,
        rewardDay,
        signupDay: eligibility.signupDay,
        firstEligibleFrom: eligibility.firstEligibleFrom,
        eligibleFrom: eligibility.eligibleFrom,
        eligibleForWeeklyReward: false,
        eligibleForDailyReward: false,
        lastRewardDay: rewardDay,
        nextEligibleAt: eligibility.eligibleAt,
        card: await loadRewardCard(tx, userId, rewardDay),
      };
    }

    if (!eligibility.eligibleForWeeklyReward) {
      return {
        claimed: false,
        alreadyClaimed: eligibility.claimedThisWeek,
        cap: DAILY_LOGIN_COMMON_CARD_CAP,
        cadenceDays: WEEKLY_COMMON_REWARD_INTERVAL_DAYS,
        commonCount,
        remaining: Math.max(0, DAILY_LOGIN_COMMON_CARD_CAP - commonCount),
        claimedToday: false,
        claimedThisWeek: eligibility.claimedThisWeek,
        canClaim: false,
        capReached: commonCount >= DAILY_LOGIN_COMMON_CARD_CAP,
        rewardDay,
        signupDay: eligibility.signupDay,
        firstEligibleFrom: eligibility.firstEligibleFrom,
        eligibleFrom: eligibility.eligibleFrom,
        eligibleForWeeklyReward: false,
        eligibleForDailyReward: false,
        lastRewardDay: eligibility.lastRewardDay,
        nextEligibleAt: eligibility.eligibleAt,
        card: eligibility.lastRewardDay ? await loadRewardCard(tx, userId, eligibility.lastRewardDay) : null,
      };
    }

    if (commonCount >= DAILY_LOGIN_COMMON_CARD_CAP) {
      return {
        claimed: false,
        alreadyClaimed: false,
        cap: DAILY_LOGIN_COMMON_CARD_CAP,
        cadenceDays: WEEKLY_COMMON_REWARD_INTERVAL_DAYS,
        commonCount,
        remaining: 0,
        claimedToday: false,
        claimedThisWeek: false,
        canClaim: false,
        capReached: true,
        rewardDay,
        signupDay: eligibility.signupDay,
        firstEligibleFrom: eligibility.firstEligibleFrom,
        eligibleFrom: eligibility.eligibleFrom,
        eligibleForWeeklyReward: true,
        eligibleForDailyReward: true,
        lastRewardDay: eligibility.lastRewardDay,
        nextEligibleAt: null,
        card: null,
      };
    }

    let player = rowsOf(await tx.execute(sql`
      SELECT p.id, p.name
      FROM app.players p
      WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')
        AND NOT EXISTS (
          SELECT 1 FROM app.player_cards owned
          WHERE owned.owner_id = ${userId}
            AND owned.player_id = p.id
            AND owned.rarity::text = 'common'
        )
        AND (
          SELECT count(*) FROM app.player_cards supply
          WHERE supply.player_id = p.id AND supply.rarity::text = 'common'
        ) < 1000
      ORDER BY random()
      LIMIT 1
    `))[0];

    if (!player) {
      player = rowsOf(await tx.execute(sql`
        SELECT p.id, p.name
        FROM app.players p
        WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')
          AND (
            SELECT count(*) FROM app.player_cards supply
            WHERE supply.player_id = p.id AND supply.rarity::text = 'common'
          ) < 1000
        ORDER BY random()
        LIMIT 1
      `))[0];
    }

    if (!player) throw new Error("No eligible Premier League player is available for the weekly reward");

    const card = rowsOf(await tx.execute(sql`
      INSERT INTO app.player_cards (player_id, owner_id, rarity, level, xp, decisive_score, for_sale, price)
      VALUES (${Number(player.id)}, ${userId}, 'common', 1, 0, 35, false, 0)
      RETURNING id
    `))[0];
    if (!card?.id) throw new Error("Weekly reward card could not be created");

    await tx.execute(sql`
      INSERT INTO app.daily_login_rewards (user_id, reward_day, card_id)
      VALUES (${userId}, (now() AT TIME ZONE 'Africa/Windhoek')::date, ${Number(card.id)})
    `);

    await tx.execute(sql`
      INSERT INTO app.notifications (user_id, type, title, message)
      VALUES (
        ${userId},
        'system',
        'Weekly common card collected',
        ${`You received ${String(player.name || "a Premier League player")} as this week's free common-card reward.`}
      )
    `);

    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (
        ${userId},
        'reward.weekly_common.claimed',
        ${JSON.stringify({ rewardDay, cardId: Number(card.id), playerId: Number(player.id), commonCountAfter: commonCount + 1, cap: DAILY_LOGIN_COMMON_CARD_CAP, cadenceDays: WEEKLY_COMMON_REWARD_INTERVAL_DAYS })}::jsonb
      )
    `);

    const commonCountAfter = commonCount + 1;
    const nextEligibility = await weeklyEligibility(tx, userId);
    return {
      claimed: true,
      alreadyClaimed: false,
      cap: DAILY_LOGIN_COMMON_CARD_CAP,
      cadenceDays: WEEKLY_COMMON_REWARD_INTERVAL_DAYS,
      commonCount: commonCountAfter,
      remaining: Math.max(0, DAILY_LOGIN_COMMON_CARD_CAP - commonCountAfter),
      claimedToday: true,
      claimedThisWeek: true,
      canClaim: false,
      capReached: commonCountAfter >= DAILY_LOGIN_COMMON_CARD_CAP,
      rewardDay,
      signupDay: nextEligibility.signupDay,
      firstEligibleFrom: nextEligibility.firstEligibleFrom,
      eligibleFrom: nextEligibility.eligibleFrom,
      eligibleForWeeklyReward: false,
      eligibleForDailyReward: false,
      lastRewardDay: rewardDay,
      nextEligibleAt: commonCountAfter >= DAILY_LOGIN_COMMON_CARD_CAP ? null : nextEligibility.eligibleAt,
      card: await loadRewardCard(tx, userId, rewardDay),
    };
  });
}

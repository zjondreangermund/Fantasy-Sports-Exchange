import { sql } from "drizzle-orm";
import { db } from "../db.js";

export const DAILY_LOGIN_COMMON_CARD_CAP = 20;

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

async function nextEligibleAt(executor: any): Promise<string> {
  const row = rowsOf(await executor.execute(sql`
    SELECT ((date_trunc('day', now() AT TIME ZONE 'Africa/Windhoek') + interval '1 day') AT TIME ZONE 'Africa/Windhoek') AS "nextEligibleAt"
  `))[0];
  return row?.nextEligibleAt ? new Date(row.nextEligibleAt).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

async function signupEligibility(executor: any, userId: string) {
  const row = rowsOf(await executor.execute(sql`
    SELECT
      to_char(s."signupLocal"::date, 'YYYY-MM-DD') AS "signupDay",
      to_char((s."signupLocal"::date + 1), 'YYYY-MM-DD') AS "eligibleFrom",
      ((now() AT TIME ZONE 'Africa/Windhoek')::date > s."signupLocal"::date) AS "eligibleForDailyReward",
      ((((s."signupLocal"::date + 1)::timestamp) AT TIME ZONE 'Africa/Windhoek')) AS "eligibleAt"
    FROM (
      SELECT ((u.created_at AT TIME ZONE current_setting('TIMEZONE')) AT TIME ZONE 'Africa/Windhoek') AS "signupLocal"
      FROM app.users u
      WHERE u.id = ${userId}
      LIMIT 1
    ) s
  `))[0];

  if (!row) throw new Error("User account was not found for daily reward eligibility");
  return {
    signupDay: String(row.signupDay || ""),
    eligibleFrom: String(row.eligibleFrom || ""),
    eligibleForDailyReward: Boolean(row.eligibleForDailyReward),
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
        EXISTS (
          SELECT 1 FROM app.daily_login_rewards dlr
          WHERE dlr.user_id = ${userId}
            AND dlr.reward_day = (now() AT TIME ZONE 'Africa/Windhoek')::date
        ) AS "claimedToday",
        to_char((now() AT TIME ZONE 'Africa/Windhoek')::date, 'YYYY-MM-DD') AS "rewardDay"
    `).then((result) => rowsOf(result)[0] || {}),
    signupEligibility(db, userId),
  ]);

  const commonCount = Number(row.commonCount || 0);
  const claimedToday = Boolean(row.claimedToday);
  const capReached = commonCount >= DAILY_LOGIN_COMMON_CARD_CAP;
  return {
    cap: DAILY_LOGIN_COMMON_CARD_CAP,
    commonCount,
    rewardCount: Number(row.rewardCount || 0),
    remaining: Math.max(0, DAILY_LOGIN_COMMON_CARD_CAP - commonCount),
    claimedToday,
    canClaim: eligibility.eligibleForDailyReward && !claimedToday && !capReached,
    capReached,
    rewardDay: String(row.rewardDay || ""),
    signupDay: eligibility.signupDay,
    eligibleFrom: eligibility.eligibleFrom,
    eligibleForDailyReward: eligibility.eligibleForDailyReward,
    nextEligibleAt: claimedToday
      ? await nextEligibleAt(db)
      : !eligibility.eligibleForDailyReward
        ? eligibility.eligibleAt
        : null,
    card: claimedToday ? await loadRewardCard(db, userId, String(row.rewardDay || "")) : null,
  };
}

export async function claimDailyLoginReward(userId: string) {
  await ensureDailyLoginRewardSchema();

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`daily-login:${userId}`}))`);

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
    const eligibility = await signupEligibility(tx, userId);

    if (existing) {
      return {
        claimed: false,
        alreadyClaimed: true,
        cap: DAILY_LOGIN_COMMON_CARD_CAP,
        commonCount,
        remaining: Math.max(0, DAILY_LOGIN_COMMON_CARD_CAP - commonCount),
        claimedToday: true,
        canClaim: false,
        capReached: commonCount >= DAILY_LOGIN_COMMON_CARD_CAP,
        rewardDay,
        signupDay: eligibility.signupDay,
        eligibleFrom: eligibility.eligibleFrom,
        eligibleForDailyReward: eligibility.eligibleForDailyReward,
        nextEligibleAt: await nextEligibleAt(tx),
        card: await loadRewardCard(tx, userId, rewardDay),
      };
    }

    if (!eligibility.eligibleForDailyReward) {
      return {
        claimed: false,
        alreadyClaimed: false,
        cap: DAILY_LOGIN_COMMON_CARD_CAP,
        commonCount,
        remaining: Math.max(0, DAILY_LOGIN_COMMON_CARD_CAP - commonCount),
        claimedToday: false,
        canClaim: false,
        capReached: commonCount >= DAILY_LOGIN_COMMON_CARD_CAP,
        rewardDay,
        signupDay: eligibility.signupDay,
        eligibleFrom: eligibility.eligibleFrom,
        eligibleForDailyReward: false,
        nextEligibleAt: eligibility.eligibleAt,
        card: null,
      };
    }

    if (commonCount >= DAILY_LOGIN_COMMON_CARD_CAP) {
      return {
        claimed: false,
        alreadyClaimed: false,
        cap: DAILY_LOGIN_COMMON_CARD_CAP,
        commonCount,
        remaining: 0,
        claimedToday: false,
        canClaim: false,
        capReached: true,
        rewardDay,
        signupDay: eligibility.signupDay,
        eligibleFrom: eligibility.eligibleFrom,
        eligibleForDailyReward: true,
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

    if (!player) throw new Error("No eligible Premier League player is available for the daily reward");

    const card = rowsOf(await tx.execute(sql`
      INSERT INTO app.player_cards (player_id, owner_id, rarity, level, xp, decisive_score, for_sale, price)
      VALUES (${Number(player.id)}, ${userId}, 'common', 1, 0, 35, false, 0)
      RETURNING id
    `))[0];
    if (!card?.id) throw new Error("Daily reward card could not be created");

    await tx.execute(sql`
      INSERT INTO app.daily_login_rewards (user_id, reward_day, card_id)
      VALUES (${userId}, (now() AT TIME ZONE 'Africa/Windhoek')::date, ${Number(card.id)})
    `);

    await tx.execute(sql`
      INSERT INTO app.notifications (user_id, type, title, message)
      VALUES (
        ${userId},
        'system',
        'Daily common card collected',
        ${`You received ${String(player.name || "a Premier League player")} as today’s common-card reward.`}
      )
    `);

    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (
        ${userId},
        'reward.daily_login.claimed',
        ${JSON.stringify({ rewardDay, cardId: Number(card.id), playerId: Number(player.id), commonCountAfter: commonCount + 1, cap: DAILY_LOGIN_COMMON_CARD_CAP })}::jsonb
      )
    `);

    const commonCountAfter = commonCount + 1;
    return {
      claimed: true,
      alreadyClaimed: false,
      cap: DAILY_LOGIN_COMMON_CARD_CAP,
      commonCount: commonCountAfter,
      remaining: Math.max(0, DAILY_LOGIN_COMMON_CARD_CAP - commonCountAfter),
      claimedToday: true,
      canClaim: false,
      capReached: commonCountAfter >= DAILY_LOGIN_COMMON_CARD_CAP,
      rewardDay,
      signupDay: eligibility.signupDay,
      eligibleFrom: eligibility.eligibleFrom,
      eligibleForDailyReward: true,
      nextEligibleAt: commonCountAfter >= DAILY_LOGIN_COMMON_CARD_CAP ? null : await nextEligibleAt(tx),
      card: await loadRewardCard(tx, userId, rewardDay),
    };
  });
}

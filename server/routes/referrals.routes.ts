import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

function rowsOf(result: any): any[] { return Array.isArray(result?.rows) ? result.rows : []; }
function cleanCode(value: unknown) { return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16); }
function baseUrl(req: any) {
  const configured = String(process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.headers?.["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host || "fantasyarena.com";
  return `${proto}://${host}`;
}
function shortCode(seed: string) {
  const raw = Buffer.from(seed).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return `FA${raw.slice(0, 8)}`;
}
function isCurrentPremierLeaguePlayer(player: any) {
  const league = String(player?.league || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const fplId = Number(player?.fplId ?? player?.fpl_id ?? 0);
  const status = String(player?.status || "a").toLowerCase();
  return ["premierleague", "englishpremierleague", "epl"].includes(league)
    && fplId > 0
    && !["departed", "superseded", "unlinked"].includes(status);
}

const REFERRAL_COMMON_POSITION_BALANCE_V1 = true;
const REFERRAL_ATOMIC_CLAIM_V1 = true;
const COMMON_POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
type CommonPosition = (typeof COMMON_POSITIONS)[number];
type CommonPositionCounts = Record<CommonPosition, number>;

function normalizePosition(value: unknown): CommonPosition | null {
  const position = String(value || "").trim().toUpperCase();
  return COMMON_POSITIONS.includes(position as CommonPosition) ? position as CommonPosition : null;
}

function referralTargetTeams(commonCountAfterReward: number) {
  return Math.min(4, Math.max(1, Math.ceil(Math.max(1, commonCountAfterReward) / 5)));
}

function referralPositionPriority(counts: CommonPositionCounts, commonCountAfterReward: number): CommonPosition[] {
  const targetTeams = referralTargetTeams(commonCountAfterReward);
  const randomTie = new Map(COMMON_POSITIONS.map((position) => [position, Math.random()]));
  return [...COMMON_POSITIONS].sort((a, b) => {
    const deficitA = Math.max(0, targetTeams - counts[a]);
    const deficitB = Math.max(0, targetTeams - counts[b]);
    if (deficitA !== deficitB) return deficitB - deficitA;
    if (counts[a] !== counts[b]) return counts[a] - counts[b];
    return Number(randomTie.get(a) || 0) - Number(randomTie.get(b) || 0);
  });
}

async function ensureReferralSchema() {
  await db.execute(sql`
    create table if not exists app.referral_codes (
      user_id varchar(255) primary key references app.users(id) on delete cascade,
      code text not null unique,
      created_at timestamp default now()
    )
  `);

  // Older production databases already contain app.referrals with a legacy
  // shape. CREATE TABLE IF NOT EXISTS does not add newer columns, so explicitly
  // converge the existing table before any reward can be minted.
  await db.execute(sql`
    create table if not exists app.referrals (
      id integer generated always as identity primary key,
      referrer_user_id varchar(255) references app.users(id) on delete cascade,
      referred_user_id varchar(255) references app.users(id) on delete cascade,
      referral_code text,
      reward_card_id integer references app.player_cards(id),
      status text not null default 'rewarded',
      created_at timestamp default now()
    )
  `);
  await db.execute(sql`alter table app.referrals add column if not exists referrer_user_id varchar(255) references app.users(id) on delete cascade`);
  await db.execute(sql`alter table app.referrals add column if not exists referred_user_id varchar(255) references app.users(id) on delete cascade`);
  await db.execute(sql`alter table app.referrals add column if not exists referral_code text`);
  await db.execute(sql`alter table app.referrals add column if not exists reward_card_id integer references app.player_cards(id)`);
  await db.execute(sql`alter table app.referrals add column if not exists status text not null default 'rewarded'`);
  await db.execute(sql`alter table app.referrals add column if not exists created_at timestamp default now()`);
  await db.execute(sql`
    create unique index if not exists referrals_referred_user_id_unique_idx
    on app.referrals (referred_user_id)
    where referred_user_id is not null
  `);
}

async function ensureCode(userId: string) {
  await ensureReferralSchema();
  const existing = rowsOf(await db.execute(sql`select code from app.referral_codes where user_id=${userId}`))[0];
  if (existing?.code) return String(existing.code);
  let code = shortCode(`${userId}:${Date.now()}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await db.execute(sql`insert into app.referral_codes (user_id, code) values (${userId}, ${code}) returning code`);
      return String(rowsOf(result)[0]?.code || code);
    } catch {
      code = shortCode(`${userId}:${Date.now()}:${attempt}:${Math.random()}`);
    }
  }
  throw new Error("Could not create referral code");
}

async function grantPositionBalancedCommonCard(storage: any, userId: string, executor: any) {
  const allPlayers = await storage.getPlayers();
  const players = (Array.isArray(allPlayers) ? allPlayers : []).filter(isCurrentPremierLeaguePlayer);
  if (players.length === 0) return null;

  const playersById = new Map(players.map((player: any) => [Number(player.id), player]));
  const ownedRows = await storage.getUserCards(userId);
  const owned = Array.isArray(ownedRows) ? ownedRows : [];
  const ownedCommon = owned.filter((card: any) => String(card.rarity || "").toLowerCase() === "common");
  const ownedCommonPlayerIds = new Set(ownedCommon.map((card: any) => Number(card.playerId ?? card.player_id ?? card.player?.id)));
  const counts: CommonPositionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

  for (const card of ownedCommon) {
    const playerId = Number(card.playerId ?? card.player_id ?? card.player?.id);
    const player = card.player || playersById.get(playerId);
    const position = normalizePosition(player?.position ?? card.position);
    if (position) counts[position] += 1;
  }

  const priority = referralPositionPriority(counts, ownedCommon.length + 1);

  // Referral rewards follow the same Common-card rule as weekly rewards: first
  // choose the position that improves tournament-team capacity, then keep the
  // actual Premier League player random inside that position. Prefer a new
  // player identity, but allow a duplicate if the position would otherwise be
  // impossible to fill. Rare/Unique/Epic/Legendary cards are never affected.
  for (const position of priority) {
    const positionPool = players.filter((player: any) => normalizePosition(player.position) === position);
    const unseen = positionPool.filter((player: any) => !ownedCommonPlayerIds.has(Number(player.id)));
    const orderedPools = unseen.length ? [unseen, positionPool] : [positionPool];

    for (const pool of orderedPools) {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      for (const chosen of shuffled) {
        if (!chosen?.id) continue;
        const playerId = Number(chosen.id);
        const duplicate = rowsOf(await executor.execute(sql`
          select id from app.player_cards
          where owner_id=${userId} and player_id=${playerId} and rarity::text='common'
          limit 1
        `))[0];
        if (duplicate) continue;

        const supply = rowsOf(await executor.execute(sql`
          select count(*)::int as count from app.player_cards
          where player_id=${playerId} and rarity::text='common'
        `))[0];
        if (Number(supply?.count || 0) >= 1000) continue;

        const created = rowsOf(await executor.execute(sql`
          insert into app.player_cards (player_id, owner_id, rarity, level, xp, decisive_score, for_sale, price)
          values (${playerId}, ${userId}, 'common', 1, 0, 35, false, 0)
          returning id
        `))[0];
        if (created?.id) return { id: Number(created.id), playerId };
      }
    }
  }

  return null;
}

export function registerReferralRoutes(app: Express, deps: { requireAuth: any; storage: any }) {
  const { requireAuth, storage } = deps;

  app.get("/api/referrals/me", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const code = await ensureCode(userId);
      return res.json({ code, url: `${baseUrl(req)}/?ref=${encodeURIComponent(code)}` });
    } catch (error: any) {
      console.error("Referral me failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to load referral link" });
    }
  });

  app.get("/api/referrals/history", requireAuth, async (req: any, res) => {
    try {
      await ensureReferralSchema();
      const userId = String(req.authUserId || "");
      const rows = rowsOf(await db.execute(sql`
        select r.id, r.referred_user_id as "referredUserId", u.name as "referredName", u.email as "referredEmail", r.reward_card_id as "rewardCardId", r.created_at as "createdAt"
        from app.referrals r
        left join app.users u on u.id = r.referred_user_id
        where r.referrer_user_id=${userId}
        order by r.created_at desc
      `));
      const referrals = await Promise.all(rows.map(async (row: any) => {
        let rewardCard = null;
        if (row.rewardCardId) {
          try { rewardCard = await storage.getPlayerCardWithPlayer(Number(row.rewardCardId), userId); } catch {}
        }
        return { ...row, referredName: row.referredName || "New Manager", rewardCard };
      }));
      return res.json({ referrals, totalReferrals: referrals.length, rewardsGranted: referrals.filter((r: any) => r.rewardCardId).length });
    } catch (error: any) {
      console.error("Referral history failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to load referral history" });
    }
  });

  app.post("/api/referrals/claim", requireAuth, async (req: any, res) => {
    try {
      await ensureReferralSchema();
      const referredUserId = String(req.authUserId || "");
      const code = cleanCode(req.body?.code);
      if (!code) return res.status(400).json({ message: "Referral code required" });

      const result = await db.transaction(async (tx: any) => {
        // One referred account can be claimed only once. The card mint and the
        // referral row now share this transaction, so an insert/schema failure
        // rolls the card back instead of leaving an extra owned card behind.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`referral-claim:${referredUserId}`}))`);

        const existing = rowsOf(await tx.execute(sql`
          select id, reward_card_id as "rewardCardId"
          from app.referrals
          where referred_user_id=${referredUserId}
          limit 1
        `))[0];
        if (existing?.id) {
          return { success: true, alreadyClaimed: true, rewardCardId: existing.rewardCardId ? Number(existing.rewardCardId) : null };
        }

        const referrerRow = rowsOf(await tx.execute(sql`select user_id from app.referral_codes where code=${code}`))[0];
        if (!referrerRow?.user_id) return { error: 404, message: "Referral code not found" };
        const referrerUserId = String(referrerRow.user_id);
        if (referrerUserId === referredUserId) return { error: 400, message: "You cannot use your own referral link" };

        // Serialize rewards to the same referrer too, so two friends completing
        // signup at once cannot both select/mint against a stale card inventory.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`referral-reward:${referrerUserId}`}))`);
        const reward = await grantPositionBalancedCommonCard(storage, referrerUserId, tx);

        await tx.execute(sql`
          insert into app.referrals (referrer_user_id, referred_user_id, referral_code, reward_card_id, status)
          values (${referrerUserId}, ${referredUserId}, ${code}, ${reward?.id || null}, ${reward?.id ? "rewarded" : "claimed_no_card"})
        `);

        return { success: true, alreadyClaimed: false, rewardCardId: reward?.id || null };
      });

      if ((result as any)?.error) return res.status(Number((result as any).error)).json({ message: (result as any).message });
      return res.json(result);
    } catch (error: any) {
      console.error("Referral claim failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to claim referral" });
    }
  });
}

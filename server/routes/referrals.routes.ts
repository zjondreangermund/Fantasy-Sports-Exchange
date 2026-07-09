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

async function ensureReferralSchema() {
  await db.execute(sql`
    create table if not exists app.referral_codes (
      user_id varchar(255) primary key references app.users(id) on delete cascade,
      code text not null unique,
      created_at timestamp default now()
    )
  `);
  await db.execute(sql`
    create table if not exists app.referrals (
      id integer generated always as identity primary key,
      referrer_user_id varchar(255) not null references app.users(id) on delete cascade,
      referred_user_id varchar(255) not null unique references app.users(id) on delete cascade,
      referral_code text not null,
      reward_card_id integer references app.player_cards(id),
      status text not null default 'rewarded',
      created_at timestamp default now()
    )
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

async function grantRandomCommonCard(storage: any, userId: string) {
  const players = await storage.getPlayers();
  if (!Array.isArray(players) || players.length === 0) return null;
  const owned = await storage.getUserCards(userId);
  const ownedCommonPlayerIds = new Set((Array.isArray(owned) ? owned : []).filter((card: any) => String(card.rarity || "") === "common").map((card: any) => Number(card.playerId)));
  const candidates = players.filter((player: any) => !ownedCommonPlayerIds.has(Number(player.id)));
  const pool = candidates.length ? candidates : players;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  if (!chosen?.id) return null;
  return storage.createPlayerCard({
    playerId: Number(chosen.id),
    ownerId: userId,
    rarity: "common",
    level: 1,
    xp: 0,
    decisiveScore: 35,
    forSale: false,
    price: 0,
  } as any);
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
      const referrerRow = rowsOf(await db.execute(sql`select user_id from app.referral_codes where code=${code}`))[0];
      if (!referrerRow?.user_id) return res.status(404).json({ message: "Referral code not found" });
      const referrerUserId = String(referrerRow.user_id);
      if (referrerUserId === referredUserId) return res.status(400).json({ message: "You cannot use your own referral link" });
      const existing = rowsOf(await db.execute(sql`select id from app.referrals where referred_user_id=${referredUserId}`))[0];
      if (existing?.id) return res.json({ success: true, alreadyClaimed: true });

      const reward = await grantRandomCommonCard(storage, referrerUserId);
      await db.execute(sql`
        insert into app.referrals (referrer_user_id, referred_user_id, referral_code, reward_card_id, status)
        values (${referrerUserId}, ${referredUserId}, ${code}, ${reward?.id || null}, ${reward?.id ? "rewarded" : "claimed_no_card"})
      `);
      return res.json({ success: true, rewardCardId: reward?.id || null });
    } catch (error: any) {
      console.error("Referral claim failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to claim referral" });
    }
  });
}

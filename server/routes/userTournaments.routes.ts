import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ARENA_TOURNAMENT_PRICE_PRESETS } from "../services/tournamentRules.js";

interface RegisterUserTournamentRoutesDeps {
  requireAuth: any;
}

const TOURNAMENT_FEE_RATE = 0.2;
const PIN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ALLOWED_RARITIES = new Set(["common", "rare", "unique", "epic", "legendary"]);
const ALLOWED_PRIZE_TYPES = new Set(["cash_pool", "goods", "goods_plus_cash", "packs", "sponsor_prize"]);

function money(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function allowedPricesForTier(tier: string) {
  return (ARENA_TOURNAMENT_PRICE_PRESETS as any)[tier] || [0, 20, 50, 100];
}

function randomPin(length = 6) {
  let pin = "";
  for (let i = 0; i < length; i += 1) pin += PIN_ALPHABET[Math.floor(Math.random() * PIN_ALPHABET.length)];
  return pin;
}

async function generateUniquePin() {
  for (let i = 0; i < 20; i += 1) {
    const pin = randomPin();
    const existing = await db.execute(sql`select id from app.competitions where join_pin = ${pin} limit 1`);
    const rows = Array.isArray((existing as any)?.rows) ? (existing as any).rows : [];
    if (rows.length === 0) return pin;
  }
  throw new Error("Could not generate tournament PIN");
}

function normalizePin(raw: unknown) {
  return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function registerUserTournamentRoutes(app: Express, deps: RegisterUserTournamentRoutesDeps) {
  const { requireAuth } = deps;

  app.post("/api/user-tournaments/create", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const name = String(req.body?.name || "").trim().slice(0, 80);
      const tier = String(req.body?.tier || "common").toLowerCase().trim();
      const entryFee = money(req.body?.entryFee);
      const maxEntriesRaw = Number(req.body?.maxEntries || 0);
      const maxEntries = Number.isInteger(maxEntriesRaw) && maxEntriesRaw > 1 ? Math.min(maxEntriesRaw, 500) : null;
      const visibility = String(req.body?.visibility || "private").toLowerCase() === "public" ? "public" : "private";
      const prizeType = String(req.body?.prizeType || "cash_pool").toLowerCase().trim();
      const prizeDescription = String(req.body?.prizeDescription || "").trim().slice(0, 240) || null;
      const gameWeek = Number.isInteger(Number(req.body?.gameWeek)) && Number(req.body?.gameWeek) > 0 ? Number(req.body?.gameWeek) : 1;
      const startDate = req.body?.startDate ? new Date(String(req.body.startDate)) : new Date();
      const endDate = req.body?.endDate ? new Date(String(req.body.endDate)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      if (!name) return res.status(400).json({ message: "Tournament name required" });
      if (!ALLOWED_RARITIES.has(tier)) return res.status(400).json({ message: "Invalid rarity tier" });
      if (!ALLOWED_PRIZE_TYPES.has(prizeType)) return res.status(400).json({ message: "Invalid prize type" });
      if (entryFee < 0) return res.status(400).json({ message: "Entry fee cannot be negative" });
      const allowedPrices = allowedPricesForTier(tier);
      if (!allowedPrices.includes(entryFee)) {
        return res.status(400).json({ message: `Choose an approved ${tier} entry price`, allowedPrices });
      }
      if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
        return res.status(400).json({ message: "Valid start and end dates required" });
      }

      const pin = visibility === "private" ? await generateUniquePin() : null;
      const prizeRarity = tier === "common" ? "rare" : tier;

      const result = await db.execute(sql`
        insert into app.competitions (
          name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity,
          created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total, prize_pool_total,
          prize_type, prize_description
        ) values (
          ${name}, ${tier}, ${entryFee}, 'open', ${gameWeek}, ${startDate}, ${endDate}, ${prizeRarity},
          ${userId}, ${pin}, ${visibility}, ${maxEntries}, ${TOURNAMENT_FEE_RATE}, 0, 0,
          ${prizeType}, ${prizeDescription}
        ) returning *
      `);

      const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
      return res.json({ success: true, tournament: rows[0] || null, pin });
    } catch (error: any) {
      console.error("Failed to create user tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to create tournament" });
    }
  });

  app.get("/api/user-tournaments/pin/:pin", requireAuth, async (req: any, res) => {
    try {
      const pin = normalizePin(req.params.pin);
      if (!pin) return res.status(400).json({ message: "PIN required" });

      const result = await db.execute(sql`
        select c.*, count(ce.id)::int as entry_count
        from app.competitions c
        left join app.competition_entries ce on ce.competition_id = c.id
        where c.join_pin = ${pin}
        group by c.id
        limit 1
      `);
      const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
      const tournament = rows[0];
      if (!tournament) return res.status(404).json({ message: "Tournament PIN not found" });
      return res.json({ tournament });
    } catch (error: any) {
      console.error("Failed to find tournament PIN:", error);
      return res.status(500).json({ message: error?.message || "Failed to find tournament" });
    }
  });
}

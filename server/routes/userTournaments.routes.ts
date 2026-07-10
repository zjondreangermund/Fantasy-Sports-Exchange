import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ARENA_TOURNAMENT_PRICE_PRESETS } from "../services/tournamentRules.js";

interface RegisterUserTournamentRoutesDeps { requireAuth: any; }

const TOURNAMENT_FEE_RATE = 0.10;
const PIN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ALLOWED_RARITIES = new Set(["common", "rare", "unique", "epic", "legendary"]);
const ALLOWED_PRIZE_TYPES = new Set(["cash_pool", "goods", "goods_plus_cash", "packs", "sponsor_prize"]);
const VAULT_SEASON = "2026-27";

const VAULT_PRIZES = [
  { title: "N$250 Voucher", category: "Voucher", value: 250 },
  { title: "PS5 Game", category: "Gaming", value: 1499 },
  { title: "Premier League Jersey", category: "Merch", value: 1500 },
  { title: "Gaming Headset", category: "Gaming", value: 1800 },
  { title: "PS5 Controller", category: "Gaming", value: 1800 },
  { title: "Smart Watch", category: "Electronics", value: 3200 },
  { title: "Gaming Monitor", category: "Computers", value: 5500 },
  { title: "55 inch Smart TV", category: "Electronics", value: 8500 },
  { title: "PlayStation 5 Console", category: "Gaming", value: 13999 },
  { title: "Gaming Laptop", category: "Computers", value: 18000 },
  { title: "75 inch Smart TV", category: "Electronics", value: 22000 },
  { title: "Gaming PC", category: "Gaming", value: 25000 },
  { title: "Holiday Voucher", category: "Travel", value: 25000 },
];

const RARITY_MULTIPLIER: Record<string, number> = { common: 1, rare: 2, epic: 4, unique: 8, legendary: 15 };
const RARITY_ORDER = ["common", "rare", "epic", "unique", "legendary"];

function money(value: unknown) { const n = Number(value); if (!Number.isFinite(n)) return 0; return Math.round(n * 100) / 100; }
function rowsOf(result: any): any[] { return Array.isArray(result?.rows) ? result.rows : []; }
function allowedPricesForTier(tier: string) { return (ARENA_TOURNAMENT_PRICE_PRESETS as any)[tier] || [0, 20, 50, 100]; }
function randomPin(length = 6) { let pin = ""; for (let i = 0; i < length; i += 1) pin += PIN_ALPHABET[Math.floor(Math.random() * PIN_ALPHABET.length)]; return pin; }
async function generateUniquePin() { for (let i = 0; i < 20; i += 1) { const pin = randomPin(); const existing = await db.execute(sql`select id from app.competitions where join_pin = ${pin} limit 1`); if (rowsOf(existing).length === 0) return pin; } throw new Error("Could not generate tournament PIN"); }
function normalizePin(raw: unknown) { return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }

function prizeFor(rarity: string, gameWeek: number) {
  const multiplier = RARITY_MULTIPLIER[rarity] || 1;
  const index = Math.min(VAULT_PRIZES.length - 1, Math.floor(((gameWeek - 1) / 37) * VAULT_PRIZES.length));
  const base = VAULT_PRIZES[index];
  const targetEntries = Math.max(10, Math.round((10 + (gameWeek - 1) * 8) * multiplier));
  return { ...base, value: Math.round(base.value * multiplier), targetEntries };
}

export function registerUserTournamentRoutes(app: Express, deps: RegisterUserTournamentRoutesDeps) {
  const { requireAuth } = deps;

  app.get("/api/prize-vault", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        select c.tier::text as rarity, c.game_week as "gameWeek", count(ce.id)::int as entries
        from app.competitions c
        left join app.competition_entries ce on ce.competition_id = c.id
        where coalesce(c.season, ${VAULT_SEASON}) = ${VAULT_SEASON}
        group by c.tier::text, c.game_week
      `);
      const entryMap = new Map<string, number>();
      for (const row of rowsOf(result)) entryMap.set(`${String(row.rarity).toLowerCase()}-${Number(row.gameWeek)}`, Number(row.entries || 0));

      const items: any[] = [];
      const summary: Record<string, any> = {};
      for (const rarity of RARITY_ORDER) {
        let previousUnlocked = true;
        summary[rarity] = { unlocked: 0, total: 38, currentEntries: 0, targetEntries: 0 };
        for (let gameWeek = 1; gameWeek <= 38; gameWeek += 1) {
          const prize = prizeFor(rarity, gameWeek);
          const currentEntries = entryMap.get(`${rarity}-${gameWeek}`) || 0;
          const unlocked = currentEntries >= prize.targetEntries;
          const active = previousUnlocked && !unlocked;
          if (active) { summary[rarity].currentEntries = currentEntries; summary[rarity].targetEntries = prize.targetEntries; }
          if (unlocked) summary[rarity].unlocked += 1;
          items.push({ id: `${VAULT_SEASON}-${rarity}-${gameWeek}`, season: VAULT_SEASON, rarity, gameWeek, tierIndex: gameWeek, title: prize.title, category: prize.category, value: prize.value, targetEntries: prize.targetEntries, currentEntries, unlocked, active, sponsor: null });
          if (!unlocked) previousUnlocked = false;
        }
      }
      return res.json({ season: VAULT_SEASON, items, summary, rules: { rollover: true, unlockWhenTargetReached: true, targetsPerRarity: true } });
    } catch (error: any) {
      console.error("Failed to load prize vault:", error);
      return res.status(500).json({ message: error?.message || "Failed to load Prize Vault" });
    }
  });

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
      if (!allowedPrices.includes(entryFee)) return res.status(400).json({ message: `Choose an approved ${tier} entry price`, allowedPrices });
      if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) return res.status(400).json({ message: "Valid start and end dates required" });

      const pin = visibility === "private" ? await generateUniquePin() : null;
      const prizeRarity = tier === "common" ? "rare" : tier;
      const result = await db.execute(sql`
        insert into app.competitions (name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity, created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total, prize_pool_total, prize_type, prize_description, season)
        values (${name}, ${tier}, ${entryFee}, 'open', ${gameWeek}, ${startDate}, ${endDate}, ${prizeRarity}, ${userId}, ${pin}, ${visibility}, ${maxEntries}, ${TOURNAMENT_FEE_RATE}, 0, 0, ${prizeType}, ${prizeDescription}, ${VAULT_SEASON}) returning *
      `);
      const rows = rowsOf(result);
      return res.json({ success: true, tournament: rows[0] || null, pin, platformFeeRate: TOURNAMENT_FEE_RATE });
    } catch (error: any) {
      console.error("Failed to create user tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to create tournament" });
    }
  });
}

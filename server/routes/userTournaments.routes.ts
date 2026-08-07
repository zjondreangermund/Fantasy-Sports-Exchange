import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ARENA_TOURNAMENT_PRICE_PRESETS } from "../services/tournamentRules.js";
import { registerEconomyIntegrityRoutes } from "./economyIntegrity.routes.js";
import { ensureTournamentSchema } from "./tournamentSchema.ensure.js";

interface RegisterUserTournamentRoutesDeps { requireAuth: any; }

const TOURNAMENT_FEE_RATE = 0.10;
const PIN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ALLOWED_RARITIES = new Set(["common", "rare", "unique", "epic", "legendary"]);
const VAULT_SEASON = "2026-27";

type PrizeDistributionRule = { rank: number; percent: number };

function money(value: unknown) { const n = Number(value); if (!Number.isFinite(n)) return 0; return Math.round(n * 100) / 100; }
function rowsOf(result: any): any[] { return Array.isArray(result?.rows) ? result.rows : []; }
function allowedPricesForTier(tier: string) { return ((ARENA_TOURNAMENT_PRICE_PRESETS as any)[tier] || [10, 20, 50, 100]).filter((price: number) => Number(price) > 0); }
function randomPin(length = 6) { let pin = ""; for (let i = 0; i < length; i += 1) pin += PIN_ALPHABET[Math.floor(Math.random() * PIN_ALPHABET.length)]; return pin; }
async function generateUniquePin() { for (let i = 0; i < 20; i += 1) { const pin = randomPin(); const existing = await db.execute(sql`select id from app.competitions where join_pin = ${pin} limit 1`); if (rowsOf(existing).length === 0) return pin; } throw new Error("Could not generate tournament PIN"); }

function normalizeDistribution(rawMode: unknown, rawRules: unknown): { mode: "winner_takes_all" | "top3"; rules: PrizeDistributionRule[] } {
  const mode = String(rawMode || "winner_takes_all").toLowerCase() === "top3" ? "top3" : "winner_takes_all";
  if (mode === "winner_takes_all") return { mode, rules: [{ rank: 1, percent: 100 }] };

  const source = Array.isArray(rawRules) ? rawRules : [];
  const rules = [1, 2, 3].map((rank) => {
    const match = source.find((row: any) => Number(row?.rank) === rank);
    return { rank, percent: money(match?.percent) };
  });
  const total = money(rules.reduce((sum, row) => sum + row.percent, 0));
  if (rules.some((row) => row.percent <= 0) || total !== 100) {
    throw new Error("Top 3 payout percentages must all be above 0 and total exactly 100%");
  }
  return { mode, rules };
}

export function registerUserTournamentRoutes(app: Express, deps: RegisterUserTournamentRoutesDeps) {
  const { requireAuth } = deps;
  registerEconomyIntegrityRoutes(app, { requireAuth });

  app.post("/api/user-tournaments/create", requireAuth, async (req: any, res) => {
    try {
      await ensureTournamentSchema();
      const userId = String(req.authUserId || "");
      const name = String(req.body?.name || "").trim().slice(0, 80);
      const tier = String(req.body?.tier || "common").toLowerCase().trim();
      const entryFee = money(req.body?.entryFee);
      const maxEntriesRaw = Number(req.body?.maxEntries || 0);
      const maxEntries = Number.isInteger(maxEntriesRaw) && maxEntriesRaw > 1 ? Math.min(maxEntriesRaw, 500) : null;
      const visibility = String(req.body?.visibility || "private").toLowerCase() === "public" ? "public" : "private";
      const gameWeek = Number.isInteger(Number(req.body?.gameWeek)) && Number(req.body?.gameWeek) > 0 ? Number(req.body?.gameWeek) : 1;
      const startDate = req.body?.startDate ? new Date(String(req.body.startDate)) : new Date();
      const endDate = req.body?.endDate ? new Date(String(req.body.endDate)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      if (!name) return res.status(400).json({ message: "Tournament name required" });
      if (!ALLOWED_RARITIES.has(tier)) return res.status(400).json({ message: "Invalid rarity tier" });
      if (entryFee <= 0) return res.status(400).json({ message: "User-created tournaments are cash tournaments and require a paid entry fee. Free Card Cups are official admin tournaments." });
      const allowedPrices = allowedPricesForTier(tier);
      if (!allowedPrices.includes(entryFee)) return res.status(400).json({ message: `Choose an approved ${tier} entry price`, allowedPrices });
      if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) return res.status(400).json({ message: "Valid start and end dates required" });

      let distribution: ReturnType<typeof normalizeDistribution>;
      try {
        distribution = normalizeDistribution(req.body?.prizeDistribution, req.body?.prizeDistributionRules);
      } catch (error: any) {
        return res.status(400).json({ message: error?.message || "Invalid payout distribution" });
      }

      // Every creator tournament gets a permanent share code, even when it is also publicly listed.
      const pin = await generateUniquePin();
      const result = await db.execute(sql`
        insert into app.competitions (
          name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity,
          created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total,
          prize_pool_total, prize_type, prize_description, prize_key, prize_distribution,
          prize_distribution_rules, season
        ) values (
          ${name}, ${tier}, ${entryFee}, 'open', ${gameWeek}, ${startDate}, ${endDate}, null,
          ${userId}, ${pin}, ${visibility}, ${maxEntries}, ${TOURNAMENT_FEE_RATE}, 0,
          0, 'cash_pool', 'Cash prize pool', 'user-cash', ${distribution.mode},
          ${JSON.stringify(distribution.rules)}::jsonb, ${VAULT_SEASON}
        ) returning *
      `);
      const rows = rowsOf(result);
      return res.json({
        success: true,
        tournament: rows[0] || null,
        pin,
        platformFeeRate: TOURNAMENT_FEE_RATE,
        prizeType: "cash_pool",
        prizeDistribution: distribution.mode,
        prizeDistributionRules: distribution.rules,
      });
    } catch (error: any) {
      console.error("Failed to create user tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to create tournament" });
    }
  });
}

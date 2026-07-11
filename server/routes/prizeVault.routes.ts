import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { storage } from "../storage.js";
import {
  RARITIES,
  SEASON_KEY,
  RARITY_ENTRY_FEES,
  RARITY_MARGIN_MULTIPLIERS,
  getActivePrizeForEntries,
  getPrizeLadder,
} from "../services/prizeEngine.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

export function registerPrizeVaultRoutes(app: Express) {
  app.get("/api/prize-vault", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        select
          c.id,
          c.game_week as "gameWeek",
          c.tier::text as rarity,
          coalesce(c.entry_fee, 0)::float as "entryFee",
          c.status::text as status
        from app.competitions c
        order by c.game_week asc, c.id asc
      `);

      const competitionRows = rowsOf(result);
      const rows = await Promise.all(
        competitionRows.map(async (row) => {
          const entries = await storage.getCompetitionEntries(Number(row.id));
          return {
            ...row,
            entryCount: Array.isArray(entries) ? entries.length : 0,
          };
        }),
      );

      const activeByRarity = new Map<string, any>();
      for (const row of rows) {
        const rarity = String(row.rarity || "common").toLowerCase();
        const status = String(row.status || "").toLowerCase();
        if (!["open", "active"].includes(status)) continue;

        const gameWeek = Number(row.gameWeek || 0);
        if (!Number.isFinite(gameWeek) || gameWeek <= 0) continue;
        const entryCount = Number(row.entryCount || 0);
        const previous = activeByRarity.get(rarity);
        const previousGameWeek = Number(previous?.gameWeek || 0);

        if (!previous || gameWeek > previousGameWeek) {
          activeByRarity.set(rarity, { ...row, rarity, gameWeek, entryCount });
        } else if (gameWeek === previousGameWeek) {
          activeByRarity.set(rarity, {
            ...previous,
            entryCount: Number(previous.entryCount || 0) + entryCount,
          });
        }
      }

      const ladders: Record<string, any> = {};
      const summary: Record<string, any> = {};
      const items: any[] = [];

      for (const rarity of RARITIES) {
        const source = activeByRarity.get(rarity);
        const currentEntries = Number(source?.entryCount || 0);
        const state = getActivePrizeForEntries(rarity, currentEntries);
        const ladder = getPrizeLadder(rarity).map((prize) => {
          const unlocked = currentEntries >= prize.requiredEntrants;
          const item = {
            id: `${rarity}-${prize.key}`,
            season: SEASON_KEY,
            rarity,
            tierIndex: prize.tierIndex,
            title: prize.title,
            category: prize.category,
            value: prize.value,
            targetEntries: prize.requiredEntrants,
            requiredEntrants: prize.requiredEntrants,
            unlockTarget: prize.unlockTarget,
            entryFee: prize.entryFee,
            marginMultiplier: prize.marginMultiplier,
            currentEntries,
            unlocked,
            active: state.activePrize?.key === prize.key || (!state.activePrize && state.nextPrize?.key === prize.key),
            replaced: unlocked && state.activePrize?.key !== prize.key,
            currentPrize: state.activePrize?.key === prize.key,
            nextPrize: !state.activePrize && state.nextPrize?.key === prize.key,
            sponsor: null,
          };
          items.push(item);
          return item;
        });

        ladders[rarity] = {
          rarity,
          season: SEASON_KEY,
          currentGameWeek: Number(source?.gameWeek || 0),
          currentEntries,
          entryFee: RARITY_ENTRY_FEES[rarity],
          marginMultiplier: RARITY_MARGIN_MULTIPLIERS[rarity],
          activePrize: state.activePrize,
          nextPrize: state.nextPrize,
          entrantsToNext: state.entrantsToNext,
          items: ladder,
        };

        summary[rarity] = {
          unlocked: state.activePrize ? 1 : 0,
          total: ladder.length,
          currentGameWeek: Number(source?.gameWeek || 0),
          currentEntries,
          targetEntries: state.nextPrize?.requiredEntrants || state.activePrize?.requiredEntrants || 0,
          activePrize: state.activePrize,
          nextPrize: state.nextPrize,
          entrantsToNext: state.entrantsToNext,
          entryFee: RARITY_ENTRY_FEES[rarity],
          marginMultiplier: RARITY_MARGIN_MULTIPLIERS[rarity],
        };
      }

      return res.json({
        season: SEASON_KEY,
        mode: "rarity_ladder_current_gameweek",
        ladders,
        items,
        summary,
      });
    } catch (error: any) {
      console.error("Failed to load Prize Vault:", error);
      return res.status(500).json({ message: error?.message || "Failed to load Prize Vault" });
    }
  });
}

import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
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

function percentage(current: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

export function registerPrizeVaultRoutes(app: Express) {
  app.get("/api/prize-vault", async (_req, res) => {
    try {
      // Test/simulator competitions are never allowed to fund or unlock the live
      // Prize Vault, even if old test records remain in the production database.
      const result = await db.execute(sql`
        select
          c.id,
          c.game_week as "gameWeek",
          c.tier::text as rarity,
          coalesce(c.entry_fee, 0)::float as "entryFee",
          c.status::text as status,
          (
            select count(*)::int
            from app.competition_entries ce
            where ce.competition_id = c.id
              and ce.user_id not like 'test-bot-%'
          ) as "entryCount"
        from app.competitions c
        where lower(c.status::text) in ('open', 'active')
          and c.name not like '[TEST]%'
        order by c.game_week asc, c.id asc
      `);

      const activeRows = rowsOf(result).filter((row) => {
        const gameWeek = Number(row.gameWeek || 0);
        const rarity = String(row.rarity || "common").toLowerCase();
        return Number.isFinite(gameWeek)
          && gameWeek > 0
          && RARITIES.includes(rarity as (typeof RARITIES)[number]);
      });

      // Competitions defines the current gameweek as the earliest open/active
      // gameweek. Prize Vault must use the same definition. Selecting the latest
      // open gameweek caused future zero-entry tournaments to hide live entries.
      const currentGameWeek = activeRows.length
        ? Math.min(...activeRows.map((row) => Number(row.gameWeek)))
        : 0;

      const activeByRarity = new Map<string, any>();
      for (const row of activeRows) {
        const gameWeek = Number(row.gameWeek);
        if (gameWeek !== currentGameWeek) continue;

        const rarity = String(row.rarity || "common").toLowerCase();
        const entryCount = Math.max(0, Number(row.entryCount || 0));
        const previous = activeByRarity.get(rarity);

        activeByRarity.set(rarity, {
          ...(previous || row),
          rarity,
          gameWeek: currentGameWeek,
          entryCount: Number(previous?.entryCount || 0) + entryCount,
        });
      }

      const ladders: Record<string, any> = {};
      const summary: Record<string, any> = {};
      const items: any[] = [];

      for (const rarity of RARITIES) {
        const source = activeByRarity.get(rarity);
        const currentEntries = Math.max(0, Number(source?.entryCount || 0));
        const state = getActivePrizeForEntries(rarity, currentEntries);
        const unlockedCount = state.ladder.filter(
          (prize) => currentEntries >= prize.requiredEntrants,
        ).length;
        const progressTarget =
          state.nextPrize?.requiredEntrants || state.activePrize?.requiredEntrants || 0;

        const ladder = getPrizeLadder(rarity).map((prize) => {
          const unlocked = currentEntries >= prize.requiredEntrants;
          const currentPrize = state.activePrize?.key === prize.key;
          const nextPrize = state.nextPrize?.key === prize.key;
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
            progressPercentage: percentage(currentEntries, prize.requiredEntrants),
            unlocked,
            active: currentPrize || nextPrize,
            replaced: unlocked && !currentPrize,
            currentPrize,
            nextPrize,
            sponsor: null,
          };
          items.push(item);
          return item;
        });

        ladders[rarity] = {
          rarity,
          season: SEASON_KEY,
          currentGameWeek,
          currentEntries,
          entryFee: RARITY_ENTRY_FEES[rarity],
          marginMultiplier: RARITY_MARGIN_MULTIPLIERS[rarity],
          unlocked: unlockedCount,
          total: ladder.length,
          progressPercentage: percentage(currentEntries, progressTarget),
          activePrize: state.activePrize,
          currentPrize: state.activePrize,
          nextPrize: state.nextPrize,
          entrantsToNext: state.entrantsToNext,
          items: ladder,
        };

        summary[rarity] = {
          unlocked: unlockedCount,
          total: ladder.length,
          currentGameWeek,
          currentEntries,
          targetEntries: progressTarget,
          progressPercentage: percentage(currentEntries, progressTarget),
          activePrize: state.activePrize,
          currentPrize: state.activePrize,
          nextPrize: state.nextPrize,
          currentPrizeValue: Number(state.activePrize?.value || 0),
          nextPrizeValue: Number(state.nextPrize?.value || 0),
          entrantsToNext: state.entrantsToNext,
          entryFee: RARITY_ENTRY_FEES[rarity],
          marginMultiplier: RARITY_MARGIN_MULTIPLIERS[rarity],
        };
      }

      return res.json({
        season: SEASON_KEY,
        mode: "rarity_ladder_current_gameweek",
        currentGameWeek,
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

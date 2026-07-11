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

export function registerPrizeVaultRoutes(app: Express) {
  app.get("/api/prize-vault", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        with official_counts as (
          select
            c.id,
            c.game_week as "gameWeek",
            lower(coalesce(c.tier::text, c.prize_card_rarity::text, 'common')) as rarity,
            coalesce(c.entry_fee, 0)::float as "entryFee",
            lower(coalesce(c.status::text, 'upcoming')) as status,
            count(distinct ce.id)::int as "entryCount"
          from app.competitions c
          left join app.competition_entries ce on ce.competition_id = c.id
          where coalesce(c.visibility, 'public') <> 'private'
            and (
              lower(coalesce(c.prize_key, '')) = 'ladder'
              or coalesce(c.prize_description, '') ilike '%prize vault%'
              or coalesce(c.name, '') ilike '%vault%'
            )
          group by c.id
        ),
        latest_gameweeks as (
          select rarity, max("gameWeek")::int as "gameWeek"
          from official_counts
          where status in ('open', 'active')
          group by rarity
        )
        select
          counts.rarity,
          counts."gameWeek",
          min(counts."entryFee")::float as "entryFee",
          sum(counts."entryCount")::int as "entryCount"
        from official_counts counts
        inner join latest_gameweeks latest
          on latest.rarity = counts.rarity
         and latest."gameWeek" = counts."gameWeek"
        where counts.status in ('open', 'active')
        group by counts.rarity, counts."gameWeek"
        order by counts.rarity
      `);

      const activeByRarity = new Map<string, any>();
      for (const row of rowsOf(result)) {
        const rarity = String(row.rarity || "common").toLowerCase();
        activeByRarity.set(rarity, {
          ...row,
          gameWeek: Number(row.gameWeek || 0),
          entryCount: Number(row.entryCount || 0),
        });
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
        mode: "rarity_ladder_latest_active_gameweek",
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

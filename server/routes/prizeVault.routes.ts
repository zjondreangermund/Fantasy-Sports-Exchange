import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  COMMUNITY_ENTRY_FEE,
  PRIZE_MARGIN_MULTIPLIER,
  RARITIES,
  SEASON_KEY,
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
          c.status::text as status,
          count(ce.id)::int as "entryCount"
        from app.competitions c
        left join app.competition_entries ce on ce.competition_id = c.id
        group by c.id
        order by c.game_week asc, c.id asc
      `);

      const rows = rowsOf(result);
      const byGwRarity = new Map<string, any>();
      for (const row of rows) {
        const key = `${Number(row.gameWeek || 1)}::${String(row.rarity || "common")}`;
        const previous = byGwRarity.get(key);
        if (!previous || Number(row.entryCount || 0) > Number(previous.entryCount || 0)) byGwRarity.set(key, row);
      }

      const items: any[] = [];
      for (let gw = 1; gw <= 38; gw += 1) {
        for (const rarity of RARITIES) {
          const source = byGwRarity.get(`${gw}::${rarity}`);
          const entryCount = Number(source?.entryCount || 0);
          const active = Boolean(source && ["open", "active"].includes(String(source.status || "")));
          const state = getActivePrizeForEntries(rarity, entryCount);
          const ladder = getPrizeLadder(rarity);

          for (const prize of ladder) {
            const unlocked = entryCount >= prize.requiredEntrants;
            items.push({
              id: `${rarity}-gw${gw}-${prize.key}`,
              season: SEASON_KEY,
              rarity,
              gameWeek: gw,
              tierIndex: prize.tierIndex,
              title: prize.title,
              category: prize.category,
              value: prize.value,
              targetEntries: prize.requiredEntrants,
              requiredEntrants: prize.requiredEntrants,
              currentEntries: entryCount,
              unlocked,
              active: active && (state.activePrize?.key === prize.key || (!state.activePrize && state.nextPrize?.key === prize.key)),
              replaced: unlocked && state.activePrize?.key !== prize.key,
              currentPrize: state.activePrize?.key === prize.key,
              nextPrize: !state.activePrize && state.nextPrize?.key === prize.key,
              sponsor: null,
            });
          }
        }
      }

      const summary: Record<string, any> = {};
      for (const rarity of RARITIES) {
        const activeSources = rows.filter((row) => String(row.rarity || "") === rarity && ["open", "active"].includes(String(row.status || "")));
        const activeSource = activeSources.sort((a, b) => Number(a.gameWeek || 0) - Number(b.gameWeek || 0))[0];
        const state = getActivePrizeForEntries(rarity, Number(activeSource?.entryCount || 0));
        summary[rarity] = {
          unlocked: state.activePrize ? 1 : 0,
          total: getPrizeLadder(rarity).length,
          currentEntries: Number(activeSource?.entryCount || 0),
          targetEntries: state.nextPrize?.requiredEntrants || state.activePrize?.requiredEntrants || 0,
          activePrize: state.activePrize,
          nextPrize: state.nextPrize,
          entrantsToNext: state.entrantsToNext,
        };
      }

      return res.json({
        season: SEASON_KEY,
        entryFee: COMMUNITY_ENTRY_FEE,
        marginMultiplier: PRIZE_MARGIN_MULTIPLIER,
        mode: "highest_unlocked_per_gameweek",
        items,
        summary,
      });
    } catch (error: any) {
      console.error("Failed to load Prize Vault:", error);
      return res.status(500).json({ message: error?.message || "Failed to load Prize Vault" });
    }
  });
}

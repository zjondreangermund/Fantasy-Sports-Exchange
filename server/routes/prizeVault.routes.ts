import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

const SEASON_KEY = "2026-27";
const ENTRY_FEE = 30;
const MARGIN = 1.5;
const RARITIES = ["common", "rare", "epic", "unique", "legendary"];

function prize(key: string, title: string, value: number, category: string, rarity = "common") {
  const targetEntries = Math.max(1, Math.ceil((value * MARGIN) / ENTRY_FEE));
  return { key, title, value, category, rarity, targetEntries };
}

const BASE_PRIZES = [
  prize("cap", "Fantasy Arena Cap", 250, "Starter", "common"),
  prize("meal-voucher", "N$300 Food Voucher", 300, "Starter", "common"),
  prize("football", "Premium Football", 450, "Starter", "common"),
  prize("gift-500", "N$500 Gift Voucher", 500, "Starter", "common"),
  prize("headset", "Gaming Headset", 900, "Gaming", "common"),
  prize("jersey", "Premier League Jersey", 1500, "Merch", "rare"),
  prize("ps5-game", "PS5 Game of Choice", 1499, "Gaming", "rare"),
  prize("ps5-controller", "PS5 Controller", 1800, "Gaming", "rare"),
  prize("monitor", "Gaming Monitor", 5500, "Computers", "epic"),
  prize("tv-55", "55 inch Smart TV", 8500, "Electronics", "epic"),
  prize("ps5", "PlayStation 5 Console", 13999, "Gaming", "unique"),
  prize("phone", "Premium Smartphone", 16000, "Electronics", "unique"),
  prize("gaming-laptop", "Gaming Laptop", 18000, "Computers", "legendary"),
  prize("gaming-pc", "Gaming PC", 25000, "Gaming", "legendary"),
  prize("holiday", "Holiday Voucher", 25000, "Travel", "legendary"),
];

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
          c.prize_key as "prizeKey",
          c.prize_description as "prizeDescription",
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
        byGwRarity.set(key, row);
      }

      const items: any[] = [];
      for (let gw = 1; gw <= 38; gw += 1) {
        for (const rarity of RARITIES) {
          const source = byGwRarity.get(`${gw}::${rarity}`);
          const presetPool = BASE_PRIZES.filter((p) => p.rarity === rarity || (rarity === "common" && p.rarity === "common"));
          const fallback = presetPool[(gw - 1) % Math.max(1, presetPool.length)] || BASE_PRIZES[0];
          const selected = BASE_PRIZES.find((p) => p.key === source?.prizeKey) || fallback;
          const entryFee = Number(source?.entryFee || ENTRY_FEE);
          const value = Number(selected.value || 0);
          const targetEntries = Math.max(1, Math.ceil((value * MARGIN) / Math.max(1, entryFee)));
          const currentEntries = Number(source?.entryCount || 0);
          const active = Boolean(source && ["open", "active"].includes(String(source.status || "")));
          items.push({
            id: `${rarity}-gw${gw}-${selected.key}`,
            season: SEASON_KEY,
            rarity,
            gameWeek: gw,
            tierIndex: RARITIES.indexOf(rarity),
            title: source?.prizeDescription || selected.title,
            category: selected.category,
            value,
            targetEntries,
            currentEntries,
            unlocked: currentEntries >= targetEntries,
            active,
            sponsor: null,
          });
        }
      }

      const summary: Record<string, any> = {};
      for (const rarity of RARITIES) {
        const rarityItems = items.filter((item) => item.rarity === rarity);
        const activeItem = rarityItems.find((item) => item.active && !item.unlocked) || rarityItems.find((item) => !item.unlocked) || rarityItems[0];
        summary[rarity] = {
          unlocked: rarityItems.filter((item) => item.unlocked).length,
          total: rarityItems.length,
          currentEntries: activeItem?.currentEntries || 0,
          targetEntries: activeItem?.targetEntries || 0,
        };
      }

      return res.json({ season: SEASON_KEY, entryFee: ENTRY_FEE, marginMultiplier: MARGIN, items, summary });
    } catch (error: any) {
      console.error("Failed to load Prize Vault:", error);
      return res.status(500).json({ message: error?.message || "Failed to load Prize Vault" });
    }
  });
}

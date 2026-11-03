import {getAdminActivity} from "../services/adminActivity.js";
import {ensurePageActivitySchema} from "../services/pageActivitySchema.js";
import type { Express } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import { registerAdminCardLookupRoutes } from "./adminCardLookup.routes.js";
import { registerApiFootballAdminRoutes } from "./apiFootballAdmin.routes.js";
import { registerApiFootballSyncRoutes } from "./apiFootballSync.routes.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

export function registerAdminInsightsRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

  // No simulator endpoints are registered in Fantasy Arena production.
  // Historical rows remain available for controlled audit/backups only.

  registerAdminCardLookupRoutes(app, { requireAuth, isAdmin });
  registerApiFootballAdminRoutes(app, { requireAuth, isAdmin });
  registerApiFootballSyncRoutes(app, { requireAuth, isAdmin });

  app.get("/api/admin/users/:id/cards", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const userId = String(req.params.id || "");
      const q = String(req.query.q || "").trim();
      const rarity = String(req.query.rarity || "all").toLowerCase();
      const status = String(req.query.status || "all").toLowerCase();
      const sort = String(req.query.sort || "newest").toLowerCase();
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
      const offset = (page - 1) * limit;
      const pattern = q ? `%${q}%` : "%%";
      const orderSql = sort === "oldest" ? sql`pc.id asc` : sort === "player" ? sql`p.name asc nulls last, pc.id desc` : sort === "rarity" ? sql`pc.rarity::text asc, pc.id desc` : sql`pc.id desc`;

      const whereSql = sql`
        pc.owner_id = ${userId}
        and (${q} = '' or coalesce(p.name,'') ilike ${pattern} or coalesce(p.team,'') ilike ${pattern} or pc.id::text ilike ${pattern} or coalesce(pc.serial_id,'') ilike ${pattern})
        and (${rarity} = 'all' or pc.rarity::text = ${rarity})
        and (${status} = 'all' or (${status} = 'listed' and pc.for_sale = true) or (${status} = 'owned' and pc.for_sale = false))
      `;

      const cards = rowsOf(await db.execute(sql`
        select pc.id, pc.player_id as "playerId", pc.rarity::text as rarity, pc.serial_id as "serialId",
          pc.serial_number as "serialNumber", pc.level, pc.xp, pc.for_sale as "forSale", pc.price,
          pc.acquired_at as "acquiredAt", p.name as "playerName", p.team, p.position::text as position,
          p.image_url as "imageUrl", p.photo
        from app.player_cards pc
        left join app.players p on p.id = pc.player_id
        where ${whereSql}
        order by ${orderSql}
        limit ${limit} offset ${offset}
      `));
      const total = Number(rowsOf(await db.execute(sql`select count(*)::int as total from app.player_cards pc left join app.players p on p.id=pc.player_id where ${whereSql}`))[0]?.total || 0);
      const rarityCounts = rowsOf(await db.execute(sql`
        select pc.rarity::text as rarity, count(*)::int as count
        from app.player_cards pc where pc.owner_id=${userId}
        group by pc.rarity::text order by pc.rarity::text
      `));
      return res.json({ cards, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), rarityCounts });
    } catch (error: any) {
      console.error("Failed to fetch complete user cards:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch cards" });
    }
  });

  app.get("/api/admin/activity", requireAuth, isAdmin, async (req: any, res) => {
    try {
      res.setHeader('Cache-Control','private, no-store');
      await ensurePageActivitySchema();
      return res.json(await getAdminActivity(db,req.query));
    } catch (error: any) {
      console.error("Failed to fetch admin activity:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch activity" });
    }
  });
}

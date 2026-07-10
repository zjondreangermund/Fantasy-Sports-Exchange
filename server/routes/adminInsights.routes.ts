import type { Express } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

export function registerAdminInsightsRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

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
      const q = String(req.query.q || "").trim();
      const userId = String(req.query.userId || "").trim();
      const source = String(req.query.source || "all").toLowerCase();
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
      const offset = (page - 1) * limit;
      const pattern = q ? `%${q}%` : "%%";

      const activity = rowsOf(await db.execute(sql`
        with combined as (
          select concat('tx-',t.id) as id, 'transaction'::text as source, t.user_id as "userId",
            coalesce(u.manager_team_name,u.name,u.email,t.user_id) as "userName", u.email,
            coalesce(t.description,t.type::text,'Transaction') as label, t.type::text as type,
            t.amount::float as amount, t.gross_amount::float as "grossAmount", t.fee_amount::float as "feeAmount",
            t.net_amount::float as "netAmount", t.status::text as status, t.source_type as "sourceType",
            jsonb_build_object('paymentMethod',t.payment_method,'externalTransactionId',t.external_transaction_id) as meta,
            t.created_at as "createdAt"
          from app.transactions t left join app.users u on u.id=t.user_id
          union all
          select concat('log-',a.id), 'audit', a.user_id,
            coalesce(u.manager_team_name,u.name,u.email,a.user_id), u.email,
            a.action, a.action, null::float, null::float, null::float, null::float, null::text, null::text,
            coalesce(a.meta,'{}'::jsonb), a.created_at
          from app.audit_logs a left join app.users u on u.id=a.user_id
        )
        select * from combined
        where (${userId}='' or "userId"=${userId})
          and (${source}='all' or source=${source})
          and (${q}='' or coalesce(label,'') ilike ${pattern} or coalesce(type,'') ilike ${pattern} or coalesce("userName",'') ilike ${pattern} or coalesce(email,'') ilike ${pattern} or coalesce("userId",'') ilike ${pattern} or coalesce(meta::text,'') ilike ${pattern})
        order by "createdAt" desc nulls last
        limit ${limit} offset ${offset}
      `));

      const total = Number(rowsOf(await db.execute(sql`
        with combined as (
          select 'transaction'::text as source, t.user_id as "userId", coalesce(u.manager_team_name,u.name,u.email,t.user_id) as "userName", u.email, coalesce(t.description,t.type::text,'Transaction') as label, t.type::text as type, '{}'::jsonb as meta
          from app.transactions t left join app.users u on u.id=t.user_id
          union all
          select 'audit', a.user_id, coalesce(u.manager_team_name,u.name,u.email,a.user_id), u.email, a.action, a.action, coalesce(a.meta,'{}'::jsonb)
          from app.audit_logs a left join app.users u on u.id=a.user_id
        )
        select count(*)::int as total from combined
        where (${userId}='' or "userId"=${userId})
          and (${source}='all' or source=${source})
          and (${q}='' or coalesce(label,'') ilike ${pattern} or coalesce(type,'') ilike ${pattern} or coalesce("userName",'') ilike ${pattern} or coalesce(email,'') ilike ${pattern} or coalesce("userId",'') ilike ${pattern} or coalesce(meta::text,'') ilike ${pattern})
      `))[0]?.total || 0);
      return res.json({ activity, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (error: any) {
      console.error("Failed to fetch admin activity:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch activity" });
    }
  });
}

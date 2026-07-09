import type { Express } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

interface RegisterAdminRoutesDeps {
  requireAuth: any;
  isAdmin: any;
  isAdminUser: (req: any) => Promise<boolean>;
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function userIdFrom(req: any) {
  return String(req.authUserId || req.user?.claims?.sub || req.user?.id || "");
}

export function registerAdminRoutes(app: Express, deps: RegisterAdminRoutesDeps) {
  const { requireAuth, isAdmin, isAdminUser } = deps;

  app.get("/api/admin/check", requireAuth, async (req: any, res) => {
    const allowed = await isAdminUser(req);
    res.json({ isAdmin: allowed });
  });

  app.post("/api/audit/client-event", requireAuth, async (req: any, res) => {
    try {
      const userId = userIdFrom(req);
      const body = req.body || {};
      await db.execute(sql`
        insert into app.audit_logs (user_id, action, meta)
        values (${userId || null}, 'client.route_view', ${JSON.stringify({ path: body.path || req.path, title: body.title || '', event: body.event || 'route_view', ts: body.ts || new Date().toISOString(), userAgent: req.headers['user-agent'] || '' })}::jsonb)
      `);
      return res.json({ ok: true });
    } catch (error) {
      console.warn("Client audit event failed:", error);
      return res.json({ ok: false });
    }
  });

  app.get("/api/admin/stats", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const result = await db.execute(sql`
        select
          (select count(*)::int from app.users) as users,
          (select count(*)::int from app.users where created_at >= now() - interval '24 hours') as "newSignups24h",
          (select count(*)::int from app.player_cards) as cards,
          (select count(*)::int from app.player_cards where for_sale = true) as "activeListings",
          (select count(*)::int from app.competitions) as competitions,
          (select count(*)::int from app.auctions where status::text = 'live') as auctions,
          (select count(*)::int from app.transactions) as transactions,
          (select count(distinct user_id)::int from app.audit_logs where created_at >= now() - interval '1 day' and user_id is not null) as dau,
          (select count(distinct user_id)::int from app.audit_logs where created_at >= now() - interval '7 days' and user_id is not null) as wau,
          (select count(distinct user_id)::int from app.audit_logs where created_at >= now() - interval '30 days' and user_id is not null) as mau,
          (select count(distinct user_id)::int from app.audit_logs where created_at >= now() - interval '10 minutes' and user_id is not null) as "onlineUsersLast10Minutes",
          (select count(*)::int from app.audit_logs where action ilike '%error%' and created_at >= now() - interval '24 hours') as "errorsLast24h",
          (select coalesce(sum(case when source_type = 'marketplace_sale' or type::text in ('marketplace_buy','marketplace_sale','purchase','sale') or coalesce(description,'') ilike '%marketplace%' then abs(coalesce(gross_amount, amount, 0)) else 0 end), 0)::float from app.transactions) as "marketplaceVolume",
          (select coalesce(sum(case when source_type = 'marketplace_sale' or type::text in ('marketplace_sale','sale') or coalesce(description,'') ilike '%marketplace%' then greatest(coalesce(fee_amount, 0), greatest(abs(coalesce(gross_amount, 0)) - abs(coalesce(net_amount, 0)), 0)) else 0 end), 0)::float from app.transactions) as "marketplaceFees"
      `);
      const row = rowsOf(result)[0] || {};
      return res.json({
        users: Number(row.users || 0),
        newSignups24h: Number(row.newSignups24h || 0),
        cards: Number(row.cards || 0),
        activeListings: Number(row.activeListings || 0),
        competitions: Number(row.competitions || 0),
        auctions: Number(row.auctions || 0),
        transactions: Number(row.transactions || 0),
        dau: Number(row.dau || 0),
        wau: Number(row.wau || 0),
        mau: Number(row.mau || 0),
        onlineUsersLast10Minutes: Number(row.onlineUsersLast10Minutes || 0),
        errorsLast24h: Number(row.errorsLast24h || 0),
        marketplaceVolume: toMoney(row.marketplaceVolume || 0),
        marketplaceFees: toMoney(row.marketplaceFees || 0),
      });
    } catch (error: any) {
      console.error("Failed to fetch admin stats:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/traffic", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const counts = rowsOf(await db.execute(sql`
        select
          (select count(*)::int from app.audit_logs where action = 'client.route_view' and created_at >= now() - interval '1 minute') as "requestsLastMinute",
          (select count(*)::int from app.audit_logs where action = 'client.route_view' and created_at >= now() - interval '5 minutes') as "requestsLast5Minutes",
          (select count(*)::int from app.audit_logs where action = 'client.route_view' and created_at >= now() - interval '1 hour') as "requestsLastHour",
          (select count(distinct user_id)::int from app.audit_logs where created_at >= now() - interval '10 minutes' and user_id is not null) as "onlineUsersLast10Minutes"
      `))[0] || {};
      const activeUsers = rowsOf(await db.execute(sql`
        select user_id as "userId", extract(epoch from (now() - max(created_at)))::int as "lastSeenSecondsAgo"
        from app.audit_logs
        where created_at >= now() - interval '10 minutes' and user_id is not null
        group by user_id
        order by max(created_at) desc
        limit 50
      `));
      const topRoutes = rowsOf(await db.execute(sql`
        select coalesce(meta->>'path','unknown') as route, count(*)::int as count, 0::float as "errorRate", 0::float as "avgDurationMs"
        from app.audit_logs
        where action = 'client.route_view' and created_at >= now() - interval '1 hour'
        group by coalesce(meta->>'path','unknown')
        order by count(*) desc
        limit 12
      `));
      return res.json({
        requestsLastMinute: Number(counts.requestsLastMinute || 0),
        requestsLast5Minutes: Number(counts.requestsLast5Minutes || 0),
        requestsLastHour: Number(counts.requestsLastHour || 0),
        onlineUsersLast10Minutes: Number(counts.onlineUsersLast10Minutes || 0),
        activeUsers,
        topRoutes,
      });
    } catch (error: any) {
      console.error("Failed to fetch admin traffic:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch admin traffic" });
    }
  });

  async function fetchUsers(q = "", limit = 50, offset = 0) {
    const pattern = q ? `%${q}%` : "%%";
    const result = await db.execute(sql`
      select
        u.id, u.email, coalesce(u.name, concat_ws(' ', u.first_name, u.last_name), u.manager_team_name, u.email, u.id) as name,
        u.manager_team_name as "managerTeamName", u.is_banned as "isBanned", u.created_at as "createdAt",
        coalesce(c.cards_count, 0)::int as "cardsCount",
        coalesce(l.listings_count, 0)::int as "listingsCount",
        coalesce(p.purchases_count, 0)::int as "purchasesCount",
        coalesce(w.balance, 0)::float as balance,
        coalesce(last_seen.last_seen, u.updated_at, u.created_at) as "lastSeenAt"
      from app.users u
      left join (select owner_id, count(*) as cards_count from app.player_cards where owner_id is not null group by owner_id) c on c.owner_id = u.id
      left join (select owner_id, count(*) as listings_count from app.player_cards where owner_id is not null and for_sale = true group by owner_id) l on l.owner_id = u.id
      left join (select user_id, count(*) as purchases_count from app.transactions where type::text in ('marketplace_buy','purchase') or source_type ilike '%marketplace%' group by user_id) p on p.user_id = u.id
      left join app.wallets w on w.user_id = u.id
      left join (select user_id, max(created_at) as last_seen from app.audit_logs where user_id is not null group by user_id) last_seen on last_seen.user_id = u.id
      where (${q} = '' or u.id ilike ${pattern} or coalesce(u.email,'') ilike ${pattern} or coalesce(u.name,'') ilike ${pattern} or coalesce(u.manager_team_name,'') ilike ${pattern})
      order by u.created_at desc nulls last
      limit ${limit} offset ${offset}
    `);
    const total = rowsOf(await db.execute(sql`select count(*)::int as total from app.users u where (${q} = '' or u.id ilike ${pattern} or coalesce(u.email,'') ilike ${pattern} or coalesce(u.name,'') ilike ${pattern} or coalesce(u.manager_team_name,'') ilike ${pattern})`))[0]?.total || 0;
    return { users: rowsOf(result), total: Number(total || 0) };
  }

  app.get("/api/admin/users", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
      return res.json(await fetchUsers("", limit, (page - 1) * limit));
    } catch (error: any) {
      console.error("Failed to fetch admin users:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/search", requireAuth, isAdmin, async (req: any, res) => {
    try {
      return res.json(await fetchUsers(String(req.query.q || "").trim(), 50, 0));
    } catch (error: any) {
      console.error("Failed to search admin users:", error);
      return res.status(500).json({ message: error?.message || "Failed to search users" });
    }
  });

  app.get("/api/admin/users/:id/details", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const userId = String(req.params.id || "");
      const user = rowsOf(await db.execute(sql`select * from app.users where id=${userId} limit 1`))[0] || null;
      const cards = rowsOf(await db.execute(sql`select pc.*, p.name as "playerName", p.team, p.position::text as position from app.player_cards pc left join app.players p on p.id = pc.player_id where pc.owner_id=${userId} order by pc.id desc limit 100`));
      const recentTransactions = rowsOf(await db.execute(sql`select * from app.transactions where user_id=${userId} order by created_at desc nulls last limit 100`));
      const logs = rowsOf(await db.execute(sql`select * from app.audit_logs where user_id=${userId} order by created_at desc nulls last limit 100`));
      const wallet = rowsOf(await db.execute(sql`select * from app.wallets where user_id=${userId} limit 1`))[0] || null;
      return res.json({ user, cards, recentTransactions, logs, wallet });
    } catch (error: any) {
      console.error("Failed to fetch user details:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch user details" });
    }
  });

  app.get("/api/admin/logs", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(250, Math.max(1, Number(req.query.limit || 100)));
      const result = await db.execute(sql`select id, user_id as "userId", action, meta, created_at as "createdAt" from app.audit_logs order by created_at desc nulls last, id desc limit ${limit}`);
      const total = rowsOf(await db.execute(sql`select count(*)::int as total from app.audit_logs`))[0]?.total || 0;
      return res.json({ logs: rowsOf(result), total: Number(total || 0) });
    } catch (error: any) {
      console.error("Failed to fetch admin logs:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch logs" });
    }
  });

  app.get("/api/admin/withdrawals", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const result = await db.execute(sql`select wr.*, u.email, coalesce(u.name, u.manager_team_name) as "userName" from app.withdrawal_requests wr left join app.users u on u.id = wr.user_id order by wr.created_at desc nulls last limit 100`);
      return res.json(rowsOf(result));
    } catch (error: any) {
      console.error("Failed to fetch withdrawals:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch withdrawals" });
    }
  });

  app.get("/api/admin/transactions", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
      const offset = (page - 1) * limit;
      const userId = String(req.query.userId || "").trim();
      const type = String(req.query.type || "").trim();
      const q = String(req.query.q || "").trim();
      const userPattern = userId ? `%${userId}%` : "%%";
      const searchPattern = q ? `%${q}%` : "%%";
      const rowsResult = await db.execute(sql`
        select t.id, t.user_id as "userId", u.email as "userEmail", coalesce(u.name, u.manager_team_name, u.email) as "userName", t.type::text as type,
          coalesce(t.amount, 0)::float as amount, coalesce(t.gross_amount, 0)::float as "grossAmount", coalesce(t.fee_amount, 0)::float as "feeAmount", coalesce(t.net_amount, 0)::float as "netAmount",
          coalesce(t.source_type, '') as "sourceType", coalesce(t.status, 'completed') as status, coalesce(t.description, '') as description, coalesce(t.payment_method, '') as "paymentMethod", coalesce(t.external_transaction_id, '') as "externalTransactionId", t.created_at as "createdAt"
        from app.transactions t left join app.users u on u.id = t.user_id
        where (${userId} = '' or t.user_id ilike ${userPattern} or coalesce(u.email, '') ilike ${userPattern})
          and (${type} = '' or t.type::text = ${type} or coalesce(t.source_type, '') = ${type})
          and (${q} = '' or coalesce(t.description, '') ilike ${searchPattern} or coalesce(t.source_type, '') ilike ${searchPattern} or coalesce(t.external_transaction_id, '') ilike ${searchPattern})
        order by t.created_at desc nulls last, t.id desc limit ${limit} offset ${offset}
      `);
      const totalResult = await db.execute(sql`select count(*)::int as total from app.transactions t left join app.users u on u.id = t.user_id where (${userId} = '' or t.user_id ilike ${userPattern} or coalesce(u.email, '') ilike ${userPattern}) and (${type} = '' or t.type::text = ${type} or coalesce(t.source_type, '') = ${type}) and (${q} = '' or coalesce(t.description, '') ilike ${searchPattern} or coalesce(t.source_type, '') ilike ${searchPattern} or coalesce(t.external_transaction_id, '') ilike ${searchPattern})`);
      const analyticsResult = await db.execute(sql`select coalesce(sum(case when coalesce(amount,0)>0 then amount else 0 end),0)::float as "creditTotal", coalesce(sum(case when coalesce(amount,0)<0 then amount else 0 end),0)::float as "debitTotal", coalesce(sum(coalesce(amount,0)),0)::float as "netTotal" from app.transactions`);
      const breakdownResult = await db.execute(sql`select type::text as type, count(*)::int as count, coalesce(sum(coalesce(amount,0)),0)::float as amount from app.transactions group by type::text`);
      const typeBreakdown: Record<string, { count: number; amount: number }> = {};
      for (const row of rowsOf(breakdownResult)) typeBreakdown[String(row.type || "unknown")] = { count: Number(row.count || 0), amount: toMoney(row.amount || 0) };
      const analyticsRow = rowsOf(analyticsResult)[0] || {};
      const total = Number(rowsOf(totalResult)[0]?.total || 0);
      return res.json({ transactions: rowsOf(rowsResult), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), analytics: { creditTotal: toMoney(analyticsRow.creditTotal || 0), debitTotal: toMoney(analyticsRow.debitTotal || 0), netTotal: toMoney(analyticsRow.netTotal || 0), typeBreakdown }, filters: { userId, type, q } });
    } catch (error: any) {
      console.error("Failed to fetch admin transactions:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch admin transactions" });
    }
  });

  app.get("/api/admin/revenue", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const buildWindow = async (label: string, sinceSql: any) => {
        const txResult = await db.execute(sql`
          select
            coalesce(sum(case when source_type = 'marketplace_sale' then fee_amount else 0 end), 0)::float as marketplace_recorded,
            coalesce(sum(case when source_type = 'marketplace_sale' or type::text in ('marketplace_sale','sale','purchase','marketplace_buy') or coalesce(description, '') ilike '%marketplace%' then abs(coalesce(gross_amount, amount, 0)) else 0 end), 0)::float as marketplace_volume,
            coalesce(sum(case when source_type = 'marketplace_sale' or type::text in ('marketplace_sale','sale') or coalesce(description, '') ilike '%marketplace%' then greatest(coalesce(fee_amount, 0), greatest(abs(coalesce(gross_amount, 0)) - abs(coalesce(net_amount, 0)), 0)) else 0 end), 0)::float as marketplace_inferred,
            coalesce(sum(case when source_type in ('user_tournament_entry','competition_entry') or type::text = 'entry_fee' then fee_amount else 0 end), 0)::float as tournaments,
            coalesce(sum(case when source_type = 'deposit' or type::text = 'deposit' then fee_amount else 0 end), 0)::float as deposits,
            coalesce(sum(case when source_type ilike '%withdraw%' or type::text = 'withdrawal' then fee_amount else 0 end), 0)::float as withdrawals
          from app.transactions where ${sinceSql}
        `);
        const withdrawalResult = await db.execute(sql`select coalesce(sum(coalesce(fee, 0)), 0)::float as withdrawal_request_fees from app.withdrawal_requests where ${sinceSql}`);
        const row = rowsOf(txResult)[0] || {};
        const marketplaceVolume = toMoney(row.marketplace_volume || 0);
        const marketplace = toMoney(Math.max(Number(row.marketplace_recorded || 0), Number(row.marketplace_inferred || 0), marketplaceVolume * 0.08));
        const tournaments = toMoney(row.tournaments || 0);
        const deposits = toMoney(row.deposits || 0);
        const withdrawals = toMoney(Math.max(Number(row.withdrawals || 0), Number(rowsOf(withdrawalResult)[0]?.withdrawal_request_fees || 0)));
        return { label, marketplace, marketplaceVolume, tournaments, deposits, withdrawals, total: toMoney(marketplace + tournaments + deposits + withdrawals) };
      };
      const [today, week, month, lifetime] = await Promise.all([
        buildWindow("Today", sql`created_at >= date_trunc('day', now())`),
        buildWindow("This Week", sql`created_at >= now() - interval '7 days'`),
        buildWindow("This Month", sql`created_at >= date_trunc('month', now())`),
        buildWindow("Lifetime", sql`true`),
      ]);
      return res.json({ feeRates: { tournaments: 0.2, marketplace: 0.08, withdrawals: 0.035, depositsUnder200: 0.02 }, windows: { today, week, month, lifetime } });
    } catch (error: any) {
      console.error("Failed to fetch admin revenue:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch admin revenue" });
    }
  });

  app.get("/api/admin/risk/flags", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const result = await db.execute(sql`select id, user_id as "userId", action, meta, created_at as "createdAt" from app.audit_logs where action like 'risk.%' order by created_at desc nulls last limit 250`);
      return res.json(rowsOf(result));
    } catch (error: any) {
      console.error("Failed to fetch risk flags:", error);
      return res.status(500).json({ message: "Failed to fetch risk flags" });
    }
  });

  app.get("/api/admin/risk/users", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const result = await db.execute(sql`
        select user_id as "userId", count(*)::int as "riskScore", array_agg(action) as flags, max(created_at) as "lastSeenAt"
        from app.audit_logs where action like 'risk.%' and user_id is not null group by user_id order by count(*) desc limit 300
      `);
      return res.json(rowsOf(result).map((r) => ({ ...r, riskLevel: Number(r.riskScore || 0) >= 5 ? "high" : Number(r.riskScore || 0) >= 2 ? "medium" : "low", recent: [] })));
    } catch (error: any) {
      console.error("Failed to fetch suspicious users:", error);
      return res.status(500).json({ message: "Failed to fetch suspicious users" });
    }
  });

  app.get("/api/admin/debug/cards", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const totals = rowsOf(await db.execute(sql`select (select count(*)::int from app.users) as users, (select count(*)::int from app.player_cards) as "playerCards"`))[0] || {};
      const cardsByUser = rowsOf(await db.execute(sql`select owner_id as "userId", count(*)::int as "cardCount" from app.player_cards group by owner_id order by count(*) desc limit 30`));
      const latestCards = rowsOf(await db.execute(sql`select id, owner_id as "ownerId", player_id as "playerId", rarity::text, for_sale as "forSale", price, acquired_at as "acquiredAt" from app.player_cards order by id desc limit 20`));
      const walletRows = rowsOf(await db.execute(sql`select * from app.wallets limit 20`));
      return res.json({ totals: { users: Number(totals.users || 0), playerCards: Number(totals.playerCards || 0) }, cardsByUser, latestCards, wallets: walletRows });
    } catch (error: any) {
      console.error("Failed to load card debug snapshot:", error);
      return res.status(500).json({ message: "Failed to load card debug snapshot" });
    }
  });
}

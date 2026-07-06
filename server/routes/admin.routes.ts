import type { Express } from "express";
import { db } from "../db.js";
import { auditLogs, playerCards, transactions, users, wallets, withdrawalRequests } from "../../shared/schema.js";
import { count, desc, eq, sql } from "drizzle-orm";

interface RegisterAdminRoutesDeps {
  requireAuth: any;
  isAdmin: any;
  isAdminUser: (req: any) => Promise<boolean>;
}

type RiskUserRow = {
  userId: string;
  email?: string | null;
  name?: string | null;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  flags: string[];
  recent: any[];
};

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function pushRisk(map: Map<string, { score: number; flags: Set<string>; recent: any[] }>, userId: string, points: number, flag: string, meta: any) {
  if (!userId) return;
  const row = map.get(userId) || { score: 0, flags: new Set<string>(), recent: [] };
  row.score += points;
  row.flags.add(flag);
  if (row.recent.length < 6) row.recent.push(meta);
  map.set(userId, row);
}

function normalizeRisk(score: number): { score: number; level: "low" | "medium" | "high" } {
  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  const level = normalized >= 70 ? "high" : normalized >= 35 ? "medium" : "low";
  return { score: normalized, level };
}

export function registerAdminRoutes(app: Express, deps: RegisterAdminRoutesDeps) {
  const { requireAuth, isAdmin, isAdminUser } = deps;

  app.get("/api/admin/check", requireAuth, async (req: any, res) => {
    const allowed = await isAdminUser(req);
    res.json({ isAdmin: allowed });
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
        select
          t.id,
          t.user_id as "userId",
          u.email as "userEmail",
          coalesce(u.name, concat_ws(' ', u.first_name, u.last_name)) as "userName",
          t.type::text as type,
          coalesce(t.amount, 0)::float as amount,
          coalesce(t.gross_amount, 0)::float as "grossAmount",
          coalesce(t.fee_amount, 0)::float as "feeAmount",
          coalesce(t.net_amount, 0)::float as "netAmount",
          coalesce(t.source_type, '') as "sourceType",
          coalesce(t.status, 'completed') as status,
          coalesce(t.description, '') as description,
          coalesce(t.payment_method, '') as "paymentMethod",
          coalesce(t.external_transaction_id, '') as "externalTransactionId",
          t.created_at as "createdAt"
        from app.transactions t
        left join app.users u on u.id = t.user_id
        where (${userId} = '' or t.user_id ilike ${userPattern} or coalesce(u.email, '') ilike ${userPattern})
          and (${type} = '' or t.type::text = ${type} or coalesce(t.source_type, '') = ${type})
          and (${q} = '' or coalesce(t.description, '') ilike ${searchPattern} or coalesce(t.source_type, '') ilike ${searchPattern} or coalesce(t.external_transaction_id, '') ilike ${searchPattern})
        order by t.created_at desc nulls last, t.id desc
        limit ${limit} offset ${offset}
      `);

      const totalResult = await db.execute(sql`
        select count(*)::int as total
        from app.transactions t
        left join app.users u on u.id = t.user_id
        where (${userId} = '' or t.user_id ilike ${userPattern} or coalesce(u.email, '') ilike ${userPattern})
          and (${type} = '' or t.type::text = ${type} or coalesce(t.source_type, '') = ${type})
          and (${q} = '' or coalesce(t.description, '') ilike ${searchPattern} or coalesce(t.source_type, '') ilike ${searchPattern} or coalesce(t.external_transaction_id, '') ilike ${searchPattern})
      `);

      const analyticsResult = await db.execute(sql`
        select
          coalesce(sum(case when coalesce(t.amount, 0) > 0 then t.amount else 0 end), 0)::float as "creditTotal",
          coalesce(sum(case when coalesce(t.amount, 0) < 0 then t.amount else 0 end), 0)::float as "debitTotal",
          coalesce(sum(coalesce(t.amount, 0)), 0)::float as "netTotal"
        from app.transactions t
        left join app.users u on u.id = t.user_id
        where (${userId} = '' or t.user_id ilike ${userPattern} or coalesce(u.email, '') ilike ${userPattern})
          and (${type} = '' or t.type::text = ${type} or coalesce(t.source_type, '') = ${type})
          and (${q} = '' or coalesce(t.description, '') ilike ${searchPattern} or coalesce(t.source_type, '') ilike ${searchPattern} or coalesce(t.external_transaction_id, '') ilike ${searchPattern})
      `);

      const breakdownResult = await db.execute(sql`
        select t.type::text as type, count(*)::int as count, coalesce(sum(coalesce(t.amount, 0)), 0)::float as amount
        from app.transactions t
        left join app.users u on u.id = t.user_id
        where (${userId} = '' or t.user_id ilike ${userPattern} or coalesce(u.email, '') ilike ${userPattern})
          and (${type} = '' or t.type::text = ${type} or coalesce(t.source_type, '') = ${type})
          and (${q} = '' or coalesce(t.description, '') ilike ${searchPattern} or coalesce(t.source_type, '') ilike ${searchPattern} or coalesce(t.external_transaction_id, '') ilike ${searchPattern})
        group by t.type::text
      `);

      const total = Number(rowsOf(totalResult)[0]?.total || 0);
      const analyticsRow = rowsOf(analyticsResult)[0] || {};
      const typeBreakdown: Record<string, { count: number; amount: number }> = {};
      for (const row of rowsOf(breakdownResult)) {
        typeBreakdown[String(row.type || "unknown")] = { count: Number(row.count || 0), amount: toMoney(row.amount || 0) };
      }

      res.json({
        transactions: rowsOf(rowsResult),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        analytics: {
          creditTotal: toMoney(analyticsRow.creditTotal || 0),
          debitTotal: toMoney(analyticsRow.debitTotal || 0),
          netTotal: toMoney(analyticsRow.netTotal || 0),
          typeBreakdown,
        },
        filters: { userId, type, q },
      });
    } catch (error: any) {
      console.error("Failed to fetch admin transactions:", error);
      res.status(500).json({ message: "Failed to fetch admin transactions" });
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
            coalesce(sum(case when source_type ilike '%withdraw%' or type::text = 'withdrawal' then fee_amount else 0 end), 0)::float as withdrawals,
            coalesce(sum(fee_amount), 0)::float as transaction_fees
          from app.transactions
          where ${sinceSql}
        `);
        const withdrawalResult = await db.execute(sql`
          select coalesce(sum(coalesce(fee, 0)), 0)::float as withdrawal_request_fees
          from app.withdrawal_requests
          where ${sinceSql}
        `);
        const row = rowsOf(txResult)[0] || {};
        const withdrawalFees = Math.max(Number(row.withdrawals || 0), Number(rowsOf(withdrawalResult)[0]?.withdrawal_request_fees || 0));
        const marketplaceRecorded = toMoney(row.marketplace_recorded || 0);
        const marketplaceInferred = toMoney(row.marketplace_inferred || 0);
        const marketplaceVolume = toMoney(row.marketplace_volume || 0);
        const marketplace = marketplaceRecorded > 0 ? marketplaceRecorded : marketplaceInferred > 0 ? marketplaceInferred : toMoney(marketplaceVolume * 0.08);
        const tournaments = toMoney(row.tournaments || 0);
        const deposits = toMoney(row.deposits || 0);
        const withdrawals = toMoney(withdrawalFees);
        return { label, marketplace, marketplaceVolume, tournaments, deposits, withdrawals, total: toMoney(marketplace + tournaments + deposits + withdrawals) };
      };

      const [today, week, month, lifetime] = await Promise.all([
        buildWindow("Today", sql`created_at >= date_trunc('day', now())`),
        buildWindow("This Week", sql`created_at >= now() - interval '7 days'`),
        buildWindow("This Month", sql`created_at >= date_trunc('month', now())`),
        buildWindow("Lifetime", sql`true`),
      ]);

      res.json({ feeRates: { tournaments: 0.2, marketplace: 0.08, withdrawals: 0.035, depositsUnder200: 0.02 }, windows: { today, week, month, lifetime } });
    } catch (error: any) {
      console.error("Failed to fetch admin revenue:", error);
      res.status(500).json({ message: "Failed to fetch admin revenue" });
    }
  });

  app.get("/api/admin/risk/flags", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const [riskLogs, recentWithdrawals] = await Promise.all([
        db.select().from(auditLogs).where(sql`${auditLogs.action} like 'risk.%'`).orderBy(desc(auditLogs.createdAt)).limit(250),
        db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt)).limit(120),
      ]);

      const withdrawalFlags = recentWithdrawals
        .filter((row: any) => String(row.status || "") === "pending")
        .map((row: any) => {
          const amount = toMoney(row.amount || 0);
          const riskScore = amount >= 5000 ? 80 : amount >= 1500 ? 50 : 20;
          return { id: Number(`9${row.id}`), userId: String(row.userId || ""), action: riskScore >= 70 ? "risk.withdrawal_high_value" : "risk.withdrawal_review", meta: { withdrawalId: row.id, amount, netAmount: row.netAmount, paymentMethod: row.paymentMethod, derived: true, riskScore }, createdAt: row.createdAt };
        });

      res.json([...withdrawalFlags, ...riskLogs].slice(0, 250));
    } catch (error: any) {
      console.error("Failed to fetch enhanced risk flags:", error);
      res.status(500).json({ message: "Failed to fetch risk flags" });
    }
  });

  app.get("/api/admin/risk/users", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const [allUsers, riskLogs, failedTxs, txRows, withdrawalRows] = await Promise.all([
        db.select().from(users),
        db.select().from(auditLogs).where(sql`${auditLogs.action} like 'risk.%'`).orderBy(desc(auditLogs.createdAt)).limit(5000),
        db.select().from(transactions).where(sql`${transactions.status} in ('failed','rejected')`).orderBy(desc(transactions.createdAt)).limit(5000),
        db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(8000),
        db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt)).limit(3000),
      ]);

      const riskByUser = new Map<string, { score: number; flags: Set<string>; recent: any[] }>();
      for (const log of riskLogs as any[]) {
        const userId = String(log.userId || "");
        const action = String(log.action || "");
        const points = action.includes("blocked") ? 40 : action.includes("wash") ? 35 : action.includes("spike") ? 25 : 18;
        pushRisk(riskByUser, userId, points, action, log.meta || {});
        const buyerId = String((log.meta as any)?.buyerId || "");
        const sellerId = String((log.meta as any)?.sellerId || "");
        if (buyerId && buyerId !== userId) pushRisk(riskByUser, buyerId, 12, `${action}:buyer`, log.meta || {});
        if (sellerId) pushRisk(riskByUser, sellerId, 12, `${action}:seller`, log.meta || {});
      }
      for (const tx of failedTxs as any[]) pushRisk(riskByUser, String(tx.userId || ""), 6, `tx_${String(tx.status || "").toLowerCase()}`, { txId: tx.id, sourceType: tx.sourceType, status: tx.status });

      const now = Date.now();
      const withdrawalsByUser = new Map<string, any[]>();
      for (const row of withdrawalRows as any[]) {
        const uid = String(row.userId || "");
        if (!withdrawalsByUser.has(uid)) withdrawalsByUser.set(uid, []);
        withdrawalsByUser.get(uid)!.push(row);
      }
      for (const [userId, rows] of Array.from(withdrawalsByUser.entries())) {
        const recent = rows.filter((row: any) => { const ts = row.createdAt ? new Date(row.createdAt as any).getTime() : 0; return Number.isFinite(ts) && now - ts <= 7 * 24 * 60 * 60 * 1000; });
        const pendingCount = recent.filter((row: any) => String(row.status || "") === "pending").length;
        const rejectedCount = recent.filter((row: any) => String(row.status || "") === "rejected").length;
        const totalRequested = recent.reduce((sum: number, row: any) => sum + toMoney(row.amount || 0), 0);
        if (pendingCount >= 2) pushRisk(riskByUser, userId, 14, "withdrawal_velocity", { pendingCount, totalRequested });
        if (rejectedCount >= 2) pushRisk(riskByUser, userId, 18, "withdrawal_rejections", { rejectedCount });
        if (totalRequested >= 5000) pushRisk(riskByUser, userId, 22, "withdrawal_amount_high", { totalRequested });
      }
      const marketplaceBuys = (txRows as any[]).filter((tx: any) => String(tx.sourceType || "") === "marketplace_buy" || String(tx.description || "").includes("marketplace card:"));
      const pairCount = new Map<string, number>();
      for (const tx of marketplaceBuys) {
        const desc = String(tx.description || "");
        const buyer = desc.match(/buyer:([^\s]+)/i)?.[1] || String(tx.userId || "");
        const seller = desc.match(/seller:([^\s]+)/i)?.[1] || "";
        if (!buyer || !seller) continue;
        const key = [buyer, seller].sort().join("::");
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
      for (const [pair, countValue] of Array.from(pairCount.entries())) {
        if (countValue < 3) continue;
        const [a, b] = pair.split("::");
        pushRisk(riskByUser, a, Math.min(30, countValue * 4), "repeat_trade_pair", { counterparty: b, trades: countValue });
        pushRisk(riskByUser, b, Math.min(30, countValue * 4), "repeat_trade_pair", { counterparty: a, trades: countValue });
      }
      const usersById = new Map((allUsers as any[]).map((u: any) => [String(u.id), u]));
      const suspiciousUsers: RiskUserRow[] = Array.from(riskByUser.entries()).map(([userId, data]) => { const normalized = normalizeRisk(data.score); return { userId, email: usersById.get(userId)?.email || "", name: usersById.get(userId)?.name || "", riskScore: normalized.score, riskLevel: normalized.level, flags: Array.from(data.flags).slice(0, 12), recent: data.recent }; }).filter((row) => row.riskScore >= 20).sort((a, b) => b.riskScore - a.riskScore).slice(0, 300);
      res.json(suspiciousUsers);
    } catch (error: any) {
      console.error("Failed to fetch suspicious users:", error);
      res.status(500).json({ message: "Failed to fetch suspicious users" });
    }
  });

  app.get("/api/admin/debug/cards", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const [usersResult, cardsResult, cardsByUser, latestCards] = await Promise.all([
        db.select({ count: count(users.id) }).from(users),
        db.select({ count: count(playerCards.id) }).from(playerCards),
        db.select({ userId: playerCards.ownerId, cardCount: sql<number>`count(*)` }).from(playerCards).groupBy(playerCards.ownerId).orderBy(desc(sql`count(*)`)),
        db.select({ id: playerCards.id, ownerId: playerCards.ownerId, playerId: playerCards.playerId, rarity: playerCards.rarity, forSale: playerCards.forSale, price: playerCards.price, acquiredAt: playerCards.acquiredAt }).from(playerCards).orderBy(desc(playerCards.id)).limit(20),
      ]);
      const walletRows = await db.select().from(wallets).limit(20);
      res.json({ totals: { users: Number(usersResult[0]?.count || 0), playerCards: Number(cardsResult[0]?.count || 0) }, cardsByUser: cardsByUser.map((row) => ({ userId: row.userId, cardCount: Number(row.cardCount || 0) })), latestCards, wallets: walletRows });
    } catch (error: any) {
      console.error("Failed to load card debug snapshot:", error);
      res.status(500).json({ message: "Failed to load card debug snapshot" });
    }
  });
}

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
          return {
            id: Number(`9${row.id}`),
            userId: String(row.userId || ""),
            action: riskScore >= 70 ? "risk.withdrawal_high_value" : "risk.withdrawal_review",
            meta: { withdrawalId: row.id, amount, netAmount: row.netAmount, paymentMethod: row.paymentMethod, derived: true, riskScore },
            createdAt: row.createdAt,
          };
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

      for (const tx of failedTxs as any[]) {
        pushRisk(riskByUser, String(tx.userId || ""), 6, `tx_${String(tx.status || "").toLowerCase()}`, {
          txId: tx.id,
          sourceType: tx.sourceType,
          status: tx.status,
        });
      }

      const now = Date.now();
      const withdrawalsByUser = new Map<string, any[]>();
      for (const row of withdrawalRows as any[]) {
        const uid = String(row.userId || "");
        if (!withdrawalsByUser.has(uid)) withdrawalsByUser.set(uid, []);
        withdrawalsByUser.get(uid)!.push(row);
      }

      for (const [userId, rows] of Array.from(withdrawalsByUser.entries())) {
        const recent = rows.filter((row: any) => {
          const ts = row.createdAt ? new Date(row.createdAt as any).getTime() : 0;
          return Number.isFinite(ts) && now - ts <= 7 * 24 * 60 * 60 * 1000;
        });
        const pendingCount = recent.filter((row: any) => String(row.status || "") === "pending").length;
        const rejectedCount = recent.filter((row: any) => String(row.status || "") === "rejected").length;
        const totalRequested = recent.reduce((sum: number, row: any) => sum + toMoney(row.amount || 0), 0);
        if (pendingCount >= 2) pushRisk(riskByUser, userId, 14, "withdrawal_velocity", { pendingCount, totalRequested });
        if (rejectedCount >= 2) pushRisk(riskByUser, userId, 18, "withdrawal_rejections", { rejectedCount });
        if (totalRequested >= 5000) pushRisk(riskByUser, userId, 22, "withdrawal_amount_high", { totalRequested });
      }

      const marketplaceBuys = (txRows as any[]).filter((tx: any) => String(tx.type || "") === "marketplace_buy");
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
      const suspiciousUsers: RiskUserRow[] = Array.from(riskByUser.entries())
        .map(([userId, data]) => {
          const normalized = normalizeRisk(data.score);
          return {
            userId,
            email: usersById.get(userId)?.email || "",
            name: usersById.get(userId)?.name || "",
            riskScore: normalized.score,
            riskLevel: normalized.level,
            flags: Array.from(data.flags).slice(0, 12),
            recent: data.recent,
          };
        })
        .filter((row) => row.riskScore >= 20)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 300);

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
        db
          .select({
            userId: playerCards.ownerId,
            cardCount: sql<number>`count(*)`,
          })
          .from(playerCards)
          .groupBy(playerCards.ownerId)
          .orderBy(desc(sql`count(*)`)),
        db
          .select({
            id: playerCards.id,
            ownerId: playerCards.ownerId,
            playerId: playerCards.playerId,
            rarity: playerCards.rarity,
            forSale: playerCards.forSale,
            price: playerCards.price,
            acquiredAt: playerCards.acquiredAt,
          })
          .from(playerCards)
          .orderBy(desc(playerCards.id))
          .limit(20),
      ]);

      const walletRows = await db.select().from(wallets).limit(20);

      res.json({
        totals: {
          users: Number(usersResult[0]?.count || 0),
          playerCards: Number(cardsResult[0]?.count || 0),
        },
        cardsByUser: cardsByUser.map((row) => ({ userId: row.userId, cardCount: Number(row.cardCount || 0) })),
        latestCards,
        wallets: walletRows,
      });
    } catch (error: any) {
      console.error("Failed to load card debug snapshot:", error);
      res.status(500).json({ message: "Failed to load card debug snapshot" });
    }
  });
}

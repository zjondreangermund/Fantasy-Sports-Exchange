import type { Express } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { transactions, wallets } from "../../shared/schema.js";

interface RegisterWalletRoutesDeps {
  requireAuth: any;
  // Retained for the existing router registration contract. Money-admin routes live
  // exclusively in the dedicated deposit and withdrawal modules.
  isAdmin: any;
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function registerWalletRoutes(app: Express, deps: RegisterWalletRoutesDeps) {
  const { requireAuth } = deps;

  app.get("/api/wallet", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      await db.execute(sql`
        insert into app.wallets (user_id, balance, locked_balance)
        values (${userId}, 0, 0)
        on conflict (user_id) do nothing
      `);
      const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
      const availableBalance = toMoney(wallet?.balance || 0);
      const lockedBalance = toMoney(wallet?.lockedBalance || 0);
      return res.json({
        ...(wallet || {}),
        balance: availableBalance,
        availableBalance,
        lockedBalance,
        totalBalance: toMoney(availableBalance + lockedBalance),
        currency: "NAD",
      });
    } catch (error: any) {
      console.error("Failed to load wallet:", error);
      return res.status(500).json({ message: error?.message || "Failed to load wallet" });
    }
  });

  app.get("/api/transactions", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const rows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.createdAt))
        .limit(250);
      return res.json(rows);
    } catch (error: any) {
      console.error("Failed to load transactions:", error);
      return res.status(500).json({ message: error?.message || "Failed to load transactions" });
    }
  });
}

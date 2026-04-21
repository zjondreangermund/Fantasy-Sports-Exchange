import type { Express } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db.js";
import type { IStorage } from "../storage.js";
import { playerCards, players, withdrawalRequests } from "../../shared/schema.js";
import {
  getLiquidityScore,
  getPrimarySalePrice,
  getReplacementOverallWindow,
  getScarcityBand,
} from "../../shared/card-economy.js";

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function registerRetentionRoutes(app: Express, deps: { requireAuth: any; storage: IStorage }) {
  const { requireAuth, storage } = deps;

  // 🔥 WALLET OVERRIDE (fixes currency + available balance)
  app.get("/api/wallet", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const wallet = await storage.getWallet(userId);

      const withdrawals = await db
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.userId, userId));

      const pending = withdrawals
        .filter((w: any) => String(w.status) === "pending")
        .reduce((sum: number, w: any) => sum + toMoney(w.amount || 0), 0);

      const balance = toMoney(wallet?.balance || 0);
      const availableBalance = toMoney(balance - pending);

      res.json({
        balance,
        currency: "NAD",
        pendingWithdrawals: toMoney(pending),
        availableBalance,
      });
    } catch (err) {
      console.error("Wallet override failed", err);
      res.status(500).json({ message: "Failed to load wallet" });
    }
  });

  // ---- EXISTING ROUTES CONTINUE ----

  app.get("/api/retention/summary", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    const [wallet, cards, lineup, competitions, marketplace] = await Promise.all([
      storage.getWallet(userId),
      storage.getUserCards(userId),
      storage.getLineup(userId),
      storage.getCompetitions(),
      storage.getMarketplaceListings(),
    ]);

    const lineupCount = Array.isArray(lineup?.cardIds) ? lineup!.cardIds.length : 0;
    const listedCount = cards.filter((card) => card.forSale).length;

    const nextCompetition = competitions
      .filter((c: any) => String(c.status) === "open")
      .sort((a: any, b: any) => new Date(a.startDate as any).getTime() - new Date(b.startDate as any).getTime())[0];

    const missions = [
      { id: "mission_open_pack", title: "Own your first card", progress: Math.min(cards.length, 1), target: 1, completed: cards.length > 0 },
      { id: "mission_set_lineup", title: "Set a full lineup", progress: lineupCount, target: 5, completed: lineupCount >= 5 },
      { id: "mission_list_card", title: "List one card on marketplace", progress: Math.min(listedCount, 1), target: 1, completed: listedCount > 0 },
    ];

    return res.json({ missions, nextBestAction: { key: "market", title: "Scout underpriced cards", ctaPath: "/marketplace" }, deadline: nextCompetition || null });
  });
}

import type { Express } from "express";
import { refundWalletHold, settleHeldAuctionBid } from "../services/walletLedger.js";

interface RegisterAuctionsRoutesDeps {
  requireAuth: any;
  isAdmin?: any;
  storage?: any;
  getAuction?: (auctionId: number) => Promise<any>;
  getAuctionBids?: (auctionId: number) => Promise<any[]>;
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function registerAuctionsRoutes(app: Express, deps: RegisterAuctionsRoutesDeps) {
  const { requireAuth } = deps;
  const isAdmin = deps.isAdmin || ((_req: any, _res: any, next: any) => next());

  app.post("/api/auctions/:id/settle", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const auctionId = parseInt(req.params.id, 10);
      if (!Number.isInteger(auctionId) || auctionId <= 0) {
        return res.status(400).json({ message: "Valid auction required" });
      }

      const { db } = await import("../db.js");
      const { auctions, auctionBids, playerCards, auditLogs } = await import("../../shared/schema.js");
      const { and, desc, eq } = await import("drizzle-orm");

      let responsePayload: any = null;

      await db.transaction(async (tx) => {
        const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
        if (!auction) throw new Error("Auction not found");
        if (auction.status === "settled") throw new Error("Auction already settled");

        const bids = await tx
          .select()
          .from(auctionBids)
          .where(eq(auctionBids.auctionId, auctionId))
          .orderBy(desc(auctionBids.amount));
        const winningBid = bids[0];

        if (!winningBid) {
          const [endedAuction] = await tx
            .update(auctions)
            .set({ status: "ended" } as any)
            .where(eq(auctions.id, auctionId))
            .returning();

          await tx.insert(auditLogs).values({
            userId: req.authUserId,
            action: "auction.settle.no_bids",
            meta: { auctionId, previousStatus: auction.status },
          } as any);

          responsePayload = { success: true, message: "Auction ended with no bids", auction: endedAuction };
          return;
        }

        const winningAmount = toMoney(winningBid.amount);
        const reservePrice = toMoney(auction.reservePrice || 0);
        const winnerId = String(winningBid.bidderUserId || "");
        const sellerId = String(auction.sellerUserId || "");

        if (!winnerId || !sellerId || winningAmount <= 0) {
          throw new Error("Auction winner, seller, or amount is invalid");
        }

        if (winningAmount < reservePrice) {
          await refundWalletHold(tx, { userId: winnerId, amount: winningAmount });

          const [endedAuction] = await tx
            .update(auctions)
            .set({ status: "ended" } as any)
            .where(eq(auctions.id, auctionId))
            .returning();

          await tx.insert(auditLogs).values({
            userId: req.authUserId,
            action: "auction.settle.reserve_not_met",
            meta: { auctionId, winnerId, winningAmount, reservePrice },
          } as any);

          responsePayload = { success: true, message: "Auction ended. Reserve was not met.", auction: endedAuction };
          return;
        }

        const transferredCards = await tx
          .update(playerCards)
          .set({ ownerId: winnerId, forSale: false, price: 0 } as any)
          .where(and(eq(playerCards.id, auction.cardId), eq(playerCards.ownerId, sellerId)))
          .returning({ id: playerCards.id });
        if (transferredCards.length !== 1) {
          throw new Error("Auction card was no longer available for transfer");
        }

        const settlement = await settleHeldAuctionBid(tx, {
          winnerId,
          sellerId,
          amount: winningAmount,
          cardId: auction.cardId,
          description: `Auction settlement #${auctionId}`,
        });

        const [settledAuction] = await tx
          .update(auctions)
          .set({ status: "settled" } as any)
          .where(eq(auctions.id, auctionId))
          .returning();

        await tx.insert(auditLogs).values({
          userId: req.authUserId,
          action: "auction.settle.completed",
          meta: {
            auctionId,
            cardId: auction.cardId,
            winnerId,
            sellerId,
            winningAmount,
            fee: settlement.fee,
            sellerReceives: settlement.sellerReceives,
          },
        } as any);

        responsePayload = { success: true, message: "Auction settled", auction: settledAuction };
      });

      return res.json(responsePayload);
    } catch (error: any) {
      console.error("Failed to settle auction:", error);
      return res.status(500).json({ message: error?.message || "Failed to settle auction" });
    }
  });
}

import type { Express } from "express";
import { refundWalletHold, settleHeldAuctionBid } from "../services/walletLedger.js";

interface RegisterAuctionsRoutesDeps {
  requireAuth: any;
  isAdmin: any;
  storage: any;
  getAuction: (auctionId: number) => Promise<any>;
  getAuctionBids: (auctionId: number) => Promise<any[]>;
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function registerAuctionsRoutes(app: Express, deps: RegisterAuctionsRoutesDeps) {
  const { requireAuth, isAdmin } = deps;

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

        if (winningAmount < reservePrice) {
          await refundWalletHold(tx, { userId: String(winningBid.bidderUserId || ""), amount: winningAmount });

          const [endedAuction] = await tx
            .update(auctions)
            .set({ status: "ended" } as any)
            .where(eq(auctions.id, auctionId))
            .returning();

          await tx.insert(auditLogs).values({
            userId: req.authUserId,
            action: "auction.settle.reserve_not_met",
            meta: { auctionId, winnerId: winningBid.bidderUserId, winningAmount, reservePrice },
          } as any);

          responsePayload = {
            success: true,
            message: "Auction ended - reserve price not met",
            auction: endedAuction,
            refundedBidderId: winningBid.bidderUserId,
          };
          return;
        }

        const settlement = await settleHeldAuctionBid(tx, {
          winnerId: String(winningBid.bidderUserId || ""),
          sellerId: String(auction.sellerUserId || ""),
          cardId: Number(auction.cardId),
          amount: winningAmount,
        });

        const [transferredCard] = await tx
          .update(playerCards)
          .set({ ownerId: winningBid.bidderUserId, forSale: false, price: 0 } as any)
          .where(and(eq(playerCards.id, auction.cardId), eq(playerCards.ownerId, auction.sellerUserId)))
          .returning();
        if (!transferredCard) throw new Error("Auction card was no longer available for transfer");

        const refundedBidders: Array<{ userId: string; amount: number }> = [];
        for (const losingBid of (bids as any[]).slice(1)) {
          const losingAmount = toMoney(losingBid.amount || 0);
          if (losingAmount <= 0) continue;
          await refundWalletHold(tx, { userId: String(losingBid.bidderUserId || ""), amount: losingAmount });
          refundedBidders.push({ userId: String(losingBid.bidderUserId || ""), amount: losingAmount });
        }

        const [settledAuction] = await tx
          .update(auctions)
          .set({ status: "settled" } as any)
          .where(and(eq(auctions.id, auctionId), eq(auctions.status, auction.status)))
          .returning();
        if (!settledAuction) throw new Error("Auction status changed during settlement");

        await tx.insert(auditLogs).values({
          userId: req.authUserId,
          action: "auction.settle.completed",
          meta: {
            auctionId,
            cardId: auction.cardId,
            winnerId: winningBid.bidderUserId,
            sellerId: auction.sellerUserId,
            winningAmount,
            sellerReceives: settlement.sellerReceives,
            fee: settlement.fee,
            refundedBidders,
          },
        } as any);

        responsePayload = {
          success: true,
          message: "Auction settled successfully",
          winnerId: winningBid.bidderUserId,
          winningAmount,
          sellerReceives: settlement.sellerReceives,
          refundedBidders,
          auction: settledAuction,
        };
      });

      return res.json(responsePayload);
    } catch (error: any) {
      console.error("Failed to settle auction:", error);
      const message = String(error?.message || "Failed to settle auction");
      const status = message.includes("not found") ? 404 : 400;
      return res.status(status).json({ message });
    }
  });
}

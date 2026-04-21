import type { Express } from "express";
import { db } from "../db.js";
import { auditLogs, playerCards, transactions, users, wallets } from "../../shared/schema.js";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getMarketplaceFloorPrice, isMarketplaceTradableRarity } from "../../shared/card-economy.js";

interface RegisterMarketplaceRoutesDeps { requireAuth: any; }

function toMoney(amount: unknown): number { const v = Number(amount); return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

async function processMarketplacePurchase(buyerId: string, rawCardId: unknown) {
  const cardId = Number(rawCardId);
  if (!Number.isInteger(cardId) || cardId <= 0) return { ok: false as const, status: 400, message: "Valid cardId required" };

  try {
    await db.transaction(async (tx) => {
      const [card] = await tx.select().from(playerCards).where(eq(playerCards.id, cardId)).for("update");
      if (!card) throw new Error("Card not found");
      if (!card.forSale) throw new Error("Card is not for sale");
      if (!isMarketplaceTradableRarity(String(card.rarity))) throw new Error("Common cards cannot be traded");

      const sellerId = String(card.ownerId || "");
      const price = toMoney(card.price || 0);
      if (!sellerId || sellerId === buyerId) throw new Error("Invalid seller");
      if (price <= 0) throw new Error("Invalid price");

      const floor = getMarketplaceFloorPrice(String(card.rarity));
      if (floor > 0 && price < floor) throw new Error(`Below floor price (N$${floor})`);

      const [buyerWallet] = await tx.select().from(wallets).where(eq(wallets.userId, buyerId));
      if (!buyerWallet || toMoney(buyerWallet.balance || 0) < price) throw new Error("Insufficient balance");

      const fee = toMoney(price * 0.08);
      const sellerReceives = toMoney(price - fee);

      await tx.update(wallets).set({ balance: sql`${wallets.balance} - ${price}` } as any).where(eq(wallets.userId, buyerId));
      await tx.update(wallets).set({ balance: sql`${wallets.balance} + ${sellerReceives}` } as any).where(eq(wallets.userId, sellerId));

      await tx.update(playerCards).set({ ownerId: buyerId, forSale: false, price: 0 } as any).where(eq(playerCards.id, cardId));

      await tx.insert(transactions).values({ userId: buyerId, type: "marketplace_buy", amount: -price, grossAmount: price, feeAmount: 0, netAmount: -price, sourceType: "marketplace_buy", status: "completed" } as any);
      await tx.insert(transactions).values({ userId: sellerId, type: "marketplace_sale", amount: sellerReceives, grossAmount: price, feeAmount: fee, netAmount: sellerReceives, sourceType: "marketplace_sale", status: "completed" } as any);
    });

    return { ok: true as const, cardId };
  } catch (e: any) {
    return { ok: false as const, status: 400, message: String(e?.message || "Failed") };
  }
}

export function registerMarketplaceRoutes(app: Express, deps: RegisterMarketplaceRoutesDeps) {
  const { requireAuth } = deps;
  app.post("/api/marketplace/buy/:cardId", requireAuth, async (req: any, res) => {
    const result = await processMarketplacePurchase(req.authUserId, req.params.cardId);
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    res.json({ success: true, cardId: result.cardId });
  });
}

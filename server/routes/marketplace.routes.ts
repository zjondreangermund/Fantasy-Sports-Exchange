import type { Express } from "express";
import { db } from "../db.js";
import { playerCards, transactions, wallets } from "../../shared/schema.js";
import { eq, sql } from "drizzle-orm";

interface RegisterMarketplaceRoutesDeps {
  requireAuth: any;
}

const CURRENCY_SYMBOL = "N$";

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function formatMoney(amount: unknown): string {
  return `${CURRENCY_SYMBOL}${toMoney(amount).toFixed(2)}`;
}

async function processMarketplacePurchase(buyerId: string, rawCardId: unknown) {
  const cardId = Number(rawCardId);
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return { ok: false as const, status: 400, message: "Valid cardId required" };
  }

  try {
    await db.transaction(async (tx) => {
      const [card] = await tx
        .select()
        .from(playerCards)
        .where(eq(playerCards.id, cardId))
        .for("update");

      if (!card) throw new Error("Card not found");
      if (!card.forSale) throw new Error("Card is not for sale");
      if (String(card.rarity || "").toLowerCase() === "common") {
        throw new Error("Common cards are tournament-only and cannot be traded");
      }

      const sellerId = String(card.ownerId || "");
      const price = toMoney(card.price || 0);

      if (!sellerId) throw new Error("Card seller is invalid");
      if (sellerId === buyerId) throw new Error("Cannot buy your own card");
      if (price <= 0) throw new Error("Card has invalid price");

      const [buyerWallet] = await tx.select().from(wallets).where(eq(wallets.userId, buyerId));
      if (!buyerWallet || toMoney(buyerWallet.balance || 0) < price) {
        throw new Error("Insufficient balance");
      }

      const fee = toMoney(price * 0.08);
      const sellerReceives = toMoney(price - fee);

      await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${price}` } as any)
        .where(eq(wallets.userId, buyerId));

      await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} + ${sellerReceives}` } as any)
        .where(eq(wallets.userId, sellerId));

      await tx
        .update(playerCards)
        .set({
          ownerId: buyerId,
          forSale: false,
          price: 0,
        } as any)
        .where(eq(playerCards.id, cardId));

      await tx.insert(transactions).values({
        userId: buyerId,
        type: "purchase",
        amount: -price,
        description: `Purchased card #${cardId} (${formatMoney(price)})`,
      } as any);

      await tx.insert(transactions).values({
        userId: sellerId,
        type: "sale",
        amount: sellerReceives,
        description: `Sold card #${cardId} (${formatMoney(price)} - ${formatMoney(fee)} fee)`,
      } as any);
    });

    return { ok: true as const, cardId };
  } catch (error: any) {
    const message = String(error?.message || "Failed to buy card");
    const status =
      message.includes("not found")
        ? 404
        : message.includes("Insufficient") ||
            message.includes("Cannot buy") ||
            message.includes("not for sale") ||
            message.includes("cannot be traded") ||
            message.includes("invalid")
          ? 400
          : 500;
    return { ok: false as const, status, message };
  }
}

export function registerMarketplaceRoutes(app: Express, deps: RegisterMarketplaceRoutesDeps) {
  const { requireAuth } = deps;

  app.post("/api/marketplace/buy/:cardId", requireAuth, async (req: any, res) => {
    const buyerId = req.authUserId;
    const result = await processMarketplacePurchase(buyerId, req.params.cardId);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    res.json({
      success: true,
      message: "Card purchased successfully",
      cardId: result.cardId,
    });
  });

  app.post("/api/marketplace/buy", requireAuth, async (req: any, res) => {
    const buyerId = req.authUserId;
    const result = await processMarketplacePurchase(buyerId, req.body?.cardId);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    res.json({
      success: true,
      message: "Card purchased successfully",
      cardId: result.cardId,
    });
  });
}

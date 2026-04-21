import type { Express } from "express";
import { db } from "../db.js";
import { auditLogs, playerCards, transactions, users, wallets } from "../../shared/schema.js";
import { and, desc, eq, or, sql } from "drizzle-orm";

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

      const [buyerUser] = await tx.select().from(users).where(eq(users.id, buyerId));
      const [sellerUser] = await tx.select().from(users).where(eq(users.id, sellerId));
      if (
        buyerUser &&
        sellerUser &&
        buyerUser.email &&
        sellerUser.email &&
        String(buyerUser.email).trim().toLowerCase() === String(sellerUser.email).trim().toLowerCase()
      ) {
        throw new Error("Potential linked-account trade blocked");
      }

      // Wash-trade / circular-trade checks
      const pairTx = await tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.type, "marketplace_buy" as any),
            sql`${transactions.createdAt} >= now() - interval '7 days'`,
            or(
              sql`${transactions.description} ilike ${`%buyer:${buyerId}% seller:${sellerId}%`}`,
              sql`${transactions.description} ilike ${`%buyer:${sellerId}% seller:${buyerId}%`}`,
            ),
          ),
        )
        .orderBy(desc(transactions.createdAt))
        .limit(25);

      const sameCardPairTx = pairTx.filter((row: any) => String(row.description || "").includes(`card:${cardId}`));
      const excessivePairVolume = pairTx.length >= 6;
      const repeatedSameCard = sameCardPairTx.length >= 2;

      if (excessivePairVolume || repeatedSameCard) {
        await tx.insert(auditLogs).values({
          userId: buyerId,
          action: "risk.wash_trade_blocked",
          meta: {
            cardId,
            buyerId,
            sellerId,
            pairTrades7d: pairTx.length,
            sameCardPairTrades7d: sameCardPairTx.length,
            reason: excessivePairVolume ? "pair_velocity" : "same_card_loop",
          },
        } as any);
        throw new Error("Trade blocked by anti-abuse controls");
      }

      const saleHistory = await tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.type, "marketplace_sale" as any),
            sql`${transactions.description} ilike ${`%card:${cardId}%`}`,
          ),
        )
        .orderBy(desc(transactions.createdAt))
        .limit(5);
      const lastSale = Number(saleHistory[0]?.grossAmount || saleHistory[0]?.amount || 0);
      if (lastSale > 0 && price > lastSale * 3) {
        await tx.insert(auditLogs).values({
          userId: buyerId,
          action: "risk.price_spike_trade",
          meta: { cardId, buyerId, sellerId, listedPrice: price, lastSale },
        } as any);
      }

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
        type: "marketplace_buy",
        amount: -price,
        grossAmount: price,
        feeAmount: 0,
        netAmount: -price,
        sourceType: "marketplace_buy",
        status: "completed",
        description: `marketplace card:${cardId} buyer:${buyerId} seller:${sellerId} gross:${price.toFixed(2)}`,
      } as any);

      await tx.insert(transactions).values({
        userId: sellerId,
        type: "marketplace_sale",
        amount: sellerReceives,
        grossAmount: price,
        feeAmount: fee,
        netAmount: sellerReceives,
        sourceType: "marketplace_sale",
        status: "completed",
        description: `marketplace card:${cardId} buyer:${buyerId} seller:${sellerId} gross:${price.toFixed(2)} fee:${fee.toFixed(2)}`,
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

  app.get("/api/marketplace/signals/:cardId", requireAuth, async (req: any, res) => {
    const cardId = Number(req.params.cardId || 0);
    if (!Number.isInteger(cardId) || cardId <= 0) {
      return res.status(400).json({ message: "Invalid cardId" });
    }

    const [card] = await db.select().from(playerCards).where(eq(playerCards.id, cardId));
    if (!card) return res.status(404).json({ message: "Card not found" });

    const cardTx = await db
      .select()
      .from(transactions)
      .where(sql`lower(${transactions.description}) like ${`%card #${cardId}%`}`)
      .orderBy(sql`${transactions.createdAt} desc`)
      .limit(20);

    const saleRows = cardTx.filter((tx: any) => String(tx.type || "").toLowerCase() === "sale");
    const saleAmounts = saleRows.map((tx: any) => toMoney(tx.amount || 0)).filter((value: number) => value > 0);
    const avgSale = saleAmounts.length ? toMoney(saleAmounts.reduce((sum: number, value: number) => sum + value, 0) / saleAmounts.length) : 0;
    const lastSale = saleAmounts[0] || 0;

    const now = Date.now();
    const listedSince = card.forSale && card.acquiredAt ? Math.max(0, Math.floor((now - new Date(card.acquiredAt as any).getTime()) / (1000 * 60 * 60 * 24))) : null;
    const velocity = saleRows.length >= 5 ? "high" : saleRows.length >= 2 ? "medium" : "low";
    const confidence = saleRows.length >= 4 ? "strong" : saleRows.length >= 2 ? "medium" : "low";

    return res.json({
      cardId,
      listedPrice: toMoney(card.price || 0),
      lastSale,
      avgSale,
      salesCount30d: saleRows.filter((tx: any) => now - new Date(tx.createdAt as any).getTime() < 1000 * 60 * 60 * 24 * 30).length,
      tradeCount: saleRows.length,
      listedSinceDays: listedSince,
      velocity,
      confidence,
    });
  });

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

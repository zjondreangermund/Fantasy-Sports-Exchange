import type { Express } from "express";
import { db } from "../db.js";
import { auditLogs, playerCards, transactions, users, wallets } from "../../shared/schema.js";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getMarketplaceFloorPrice, isMarketplaceTradableRarity } from "../../shared/card-economy.js";

interface RegisterMarketplaceRoutesDeps { requireAuth: any; }

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

async function processMarketplacePurchase(buyerId: string, rawCardId: unknown) {
  const cardId = (() => {
    if (typeof rawCardId === "number") return rawCardId;
    const normalized = String(rawCardId ?? "").trim();
    if (!normalized) return Number.NaN;
    if (/^\d+$/.test(normalized)) return Number(normalized);
    const match = normalized.match(/(\d+)/);
    return match ? Number(match[1]) : Number.NaN;
  })();
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return { ok: false as const, status: 400, message: "Valid cardId required" };
  }

  try {
    await db.transaction(async (tx) => {
      const [card] = await tx.select().from(playerCards).where(eq(playerCards.id, cardId)).for("update");
      if (!card) throw new Error("Card does not exist or was already sold");
      if (!card.forSale) throw new Error("Card is not for sale");
      if (!isMarketplaceTradableRarity(String(card.rarity))) throw new Error("Common cards cannot be traded");

      const sellerId = String(card.ownerId || "");
      const price = toMoney(card.price || 0);
      if (!sellerId) throw new Error("Card seller is invalid");
      if (sellerId === buyerId) throw new Error("Cannot buy your own card");
      if (price <= 0) throw new Error("Invalid price");

      const floor = getMarketplaceFloorPrice(String(card.rarity));
      if (floor > 0 && price < floor) throw new Error(`Below floor price (N$${floor})`);

      const [buyerUser] = await tx.select().from(users).where(eq(users.id, buyerId));
      const [sellerUser] = await tx.select().from(users).where(eq(users.id, sellerId));
      if (
        buyerUser?.email &&
        sellerUser?.email &&
        String(buyerUser.email).trim().toLowerCase() === String(sellerUser.email).trim().toLowerCase()
      ) {
        throw new Error("Potential linked-account trade blocked");
      }

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
          meta: { cardId, buyerId, sellerId, pairTrades7d: pairTx.length, sameCardPairTrades7d: sameCardPairTx.length },
        } as any);
        throw new Error("Trade blocked by anti-abuse controls");
      }

      const saleHistory = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.type, "marketplace_sale" as any), sql`${transactions.description} ilike ${`%card:${cardId}%`}`))
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
      if (!buyerWallet || toMoney(buyerWallet.balance || 0) < price) throw new Error("Insufficient balance");

      const fee = toMoney(price * 0.08);
      const sellerReceives = toMoney(price - fee);

      await tx.update(wallets).set({ balance: sql`${wallets.balance} - ${price}` } as any).where(eq(wallets.userId, buyerId));
      await tx.update(wallets).set({ balance: sql`${wallets.balance} + ${sellerReceives}` } as any).where(eq(wallets.userId, sellerId));
      await tx.update(playerCards).set({ ownerId: buyerId, forSale: false, price: 0 } as any).where(eq(playerCards.id, cardId));

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

    return { ok: true as const, cardId: resolvedCardId };
  } catch (error: any) {
    const message = String(error?.message || "Failed to buy card");
    const status = message.includes("not found") ? 404 : 400;
    return { ok: false as const, status, message };
  }
}

export function registerMarketplaceRoutes(app: Express, deps: RegisterMarketplaceRoutesDeps) {
  const { requireAuth } = deps;

  app.post("/api/marketplace/list", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardId, price } = req.body || {};
      const parsedCardId = Number(cardId);
      const parsedPrice = Number(price);

      if (!Number.isInteger(parsedCardId) || parsedCardId <= 0 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({ message: "Valid cardId and positive price required" });
      }

      const card = await db.select().from(playerCards).where(eq(playerCards.id, parsedCardId)).then((rows) => rows[0]);
      if (!card) return res.status(404).json({ message: "Card not found" });
      if (String(card.ownerId || "") !== String(userId)) return res.status(403).json({ message: "You don't own this card" });
      if (card.forSale) return res.status(400).json({ message: "Card is already listed for sale" });
      if (!isMarketplaceTradableRarity(String(card.rarity))) {
        return res.status(400).json({ message: "Common cards are tournament-only and cannot be traded" });
      }

      const floor = getMarketplaceFloorPrice(String(card.rarity));
      if (floor > 0 && parsedPrice < floor) {
        return res.status(400).json({ message: `Price below minimum floor of N$${floor}` });
      }

      await db.update(playerCards).set({ forSale: true, price: parsedPrice } as any).where(eq(playerCards.id, parsedCardId));
      return res.json({ success: true, message: "Card listed for sale", cardId: parsedCardId, price: parsedPrice, floor });
    } catch (error: any) {
      console.error("Marketplace list override failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to list card" });
    }
  });

  app.post("/api/marketplace/cancel/:cardId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const cardId = Number(req.params.cardId);
      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });

      const [card] = await db.select().from(playerCards).where(eq(playerCards.id, cardId));
      if (!card) return res.status(404).json({ message: "Card not found" });
      if (String(card.ownerId || "") !== String(userId)) return res.status(403).json({ message: "Not your card" });

      await db.update(playerCards).set({ forSale: false, price: 0 } as any).where(eq(playerCards.id, cardId));
      return res.json({ success: true, cardId });
    } catch (error: any) {
      console.error("Cancel marketplace listing failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to cancel listing" });
    }
  });

  app.post("/api/marketplace/sell", requireAuth, async (req: any, res) => {
    req.body = { ...(req.body || {}), cardId: req.body?.cardId, price: req.body?.price };
    return (app as any)._router.handle({ ...req, method: "POST", url: "/api/marketplace/list" }, res, () => undefined);
  });

  app.post("/api/marketplace/buy/:cardId", requireAuth, async (req: any, res) => {
    const result = await processMarketplacePurchase(req.authUserId, req.params.cardId, req.body?.serialId);
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    return res.json({ success: true, cardId: result.cardId });
  });

  app.post("/api/marketplace/buy", requireAuth, async (req: any, res) => {
    const result = await processMarketplacePurchase(req.authUserId, req.body?.cardId, req.body?.serialId);
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    return res.json({ success: true, cardId: result.cardId });
  });
}

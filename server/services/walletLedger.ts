import { and, eq, sql } from "drizzle-orm";
import { transactions, wallets } from "../../shared/schema.js";

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

// This shared ledger module intentionally exposes only the active marketplace
// transaction helper. Deposits, withdrawals, auction escrow, tournament money,
// and wallet reconciliation are owned by their dedicated row-locked services.
export async function applyMarketplaceTradeLedger(tx: any, input: any) {
  const buyerId = String(input?.buyerId || "");
  const sellerId = String(input?.sellerId || "");
  const price = toMoney(input?.amount || 0);
  if (!buyerId || !sellerId || price <= 0) throw new Error("Valid trade required");
  if (buyerId === sellerId) throw new Error("Cannot buy your own card");

  const [buyerWallet] = await tx
    .update(wallets)
    .set({ balance: sql`${wallets.balance} - ${price}` } as any)
    .where(and(eq(wallets.userId, buyerId), sql`${wallets.balance} >= ${price}`))
    .returning();
  if (!buyerWallet) throw new Error("Insufficient balance");

  const fee = toMoney(price * Number(input?.feeRate ?? 0.08));
  const sellerReceives = toMoney(price - fee);
  const [sellerWallet] = await tx
    .update(wallets)
    .set({ balance: sql`${wallets.balance} + ${sellerReceives}` } as any)
    .where(eq(wallets.userId, sellerId))
    .returning();
  if (!sellerWallet) throw new Error("Seller wallet not found");

  await tx.insert(transactions).values({
    userId: buyerId,
    type: "marketplace_buy",
    amount: -price,
    grossAmount: price,
    feeAmount: 0,
    netAmount: -price,
    sourceType: input?.sourceType || "marketplace_buy",
    status: "completed",
    description: `marketplace card:${input?.cardId || ""} buyer:${buyerId} seller:${sellerId} gross:${price.toFixed(2)}`,
  } as any);
  await tx.insert(transactions).values({
    userId: sellerId,
    type: "marketplace_sale",
    amount: sellerReceives,
    grossAmount: price,
    feeAmount: fee,
    netAmount: sellerReceives,
    sourceType: input?.sourceType || "marketplace_sale",
    status: "completed",
    description: `marketplace card:${input?.cardId || ""} buyer:${buyerId} seller:${sellerId} gross:${price.toFixed(2)} fee:${fee.toFixed(2)}`,
  } as any);

  return { price, fee, sellerReceives };
}

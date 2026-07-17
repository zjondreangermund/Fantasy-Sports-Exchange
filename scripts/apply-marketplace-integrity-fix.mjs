import fs from "node:fs";

const path = "server/routes/marketplace.routes.ts";
let source = fs.readFileSync(path, "utf8");

const importAnchor = 'import { ensureTournamentSchema } from "./tournamentSchema.ensure.js";';
const ledgerImport = 'import { applyMarketplaceTradeLedger } from "../services/walletLedger.js";';
if (!source.includes(ledgerImport)) {
  source = source.replace(importAnchor, `${importAnchor}\n${ledgerImport}`);
}

const oldBlock = `      const [buyerWallet] = await tx.select().from(wallets).where(eq(wallets.userId, buyerId)).for("update"); if (!buyerWallet || toMoney(buyerWallet.balance || 0) < price) throw new Error("Insufficient balance");
      const fee = toMoney(price * 0.08); const sellerReceives = toMoney(price - fee);
      await tx.update(wallets).set({ balance: sql\`${wallets.balance} - \${price}\` } as any).where(eq(wallets.userId, buyerId));
      await tx.update(wallets).set({ balance: sql\`${wallets.balance} + \${sellerReceives}\` } as any).where(eq(wallets.userId, sellerId));
      await tx.update(playerCards).set({ ownerId: buyerId, forSale: false, price: 0 } as any).where(eq(playerCards.id, resolvedCardId));
      await tx.insert(transactions).values({ userId: buyerId, type: BUY_TX_TYPE, amount: -price, grossAmount: price, feeAmount: 0, netAmount: -price, sourceType: "marketplace_buy", description: \`marketplace card:\${resolvedCardId} buyer:\${buyerId} seller:\${sellerId} gross:\${price.toFixed(2)}\` } as any);
      await tx.insert(transactions).values({ userId: sellerId, type: SALE_TX_TYPE, amount: sellerReceives, grossAmount: price, feeAmount: fee, netAmount: sellerReceives, sourceType: "marketplace_sale", description: \`marketplace card:\${resolvedCardId} buyer:\${buyerId} seller:\${sellerId} gross:\${price.toFixed(2)} fee:\${fee.toFixed(2)}\` } as any);
      await tx.insert(auditLogs).values({ userId: buyerId, action: "marketplace.purchase.completed", meta: { cardId: resolvedCardId, serialId, buyerId, sellerId, price, fee, sellerReceives } } as any);`;

const newBlock = `      const ledger = await applyMarketplaceTradeLedger(tx, { buyerId, sellerId, amount: price, cardId: resolvedCardId, feeRate: 0.08 });
      const [transferredCard] = await tx.update(playerCards)
        .set({ ownerId: buyerId, forSale: false, price: 0 } as any)
        .where(and(eq(playerCards.id, resolvedCardId), eq(playerCards.ownerId, sellerId), eq(playerCards.forSale, true)))
        .returning({ id: playerCards.id });
      if (!transferredCard) throw new Error("Card was no longer available for transfer");
      await tx.insert(auditLogs).values({ userId: buyerId, action: "marketplace.purchase.completed", meta: { cardId: resolvedCardId, serialId, buyerId, sellerId, price: ledger.price, fee: ledger.fee, sellerReceives: ledger.sellerReceives } } as any);`;

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
} else if (!source.includes("Card was no longer available for transfer")) {
  throw new Error("Marketplace purchase block did not match expected source");
}

source = source.replace('import { auditLogs, playerCards, transactions, users, wallets } from "../../shared/schema.js";', 'import { auditLogs, playerCards, transactions, users } from "../../shared/schema.js";');
fs.writeFileSync(path, source);
console.log("Marketplace ledger and ownership integrity repair applied.");

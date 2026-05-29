import { and, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { competitionEntries, transactions, users, wallets } from "../../shared/schema.js";

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export type WalletIntegrityRow = {
  userId: string;
  user: { id: string; email: string | null; name: string | null } | null;
  balance: number;
  lockedBalance: number;
  ledgerBalance: number;
  delta: number;
  flags: string[];
  status: "ok" | "review";
};

export async function creditWalletWithLedger(input: { userId: string; amount: number; description?: string }) {
  const amount = toMoney(input.amount);
  if (!input.userId || amount <= 0) throw new Error("Valid userId and positive amount required");

  return db.transaction(async (tx) => {
    const [updatedWallet] = await tx
      .update(wallets)
      .set({ balance: sql`${wallets.balance} + ${amount}` } as any)
      .where(eq(wallets.userId, input.userId))
      .returning();
    if (!updatedWallet) throw new Error("Wallet not found");

    await tx.insert(transactions).values({
      userId: input.userId,
      type: "admin_adjustment",
      amount,
      grossAmount: amount,
      feeAmount: 0,
      netAmount: amount,
      sourceType: "admin_adjustment",
      status: "completed",
      description: input.description || `Admin credit: ${amount}`,
    } as any);

    return updatedWallet;
  });
}

export async function processWalletDeposit(input: { userId: string; amount: number; description?: string }) {
  const amount = toMoney(input.amount);
  if (!input.userId || amount <= 0) throw new Error("Valid deposit required");
  return creditWalletWithLedger({ userId: input.userId, amount, description: input.description || `Deposit: ${amount}` });
}

export async function createTrustedWithdrawal(input: any) {
  const userId = String(input?.userId || "");
  const amount = toMoney(input?.amount || 0);
  if (!userId || amount <= 0) throw new Error("Valid withdrawal required");

  return db.transaction(async (tx) => {
    const [updatedWallet] = await tx
      .update(wallets)
      .set({ balance: sql`${wallets.balance} - ${amount}` } as any)
      .where(and(eq(wallets.userId, userId), sql`${wallets.balance} >= ${amount}`))
      .returning();
    if (!updatedWallet) throw new Error("Insufficient balance");

    await tx.insert(transactions).values({
      userId,
      type: "withdrawal",
      amount: -amount,
      grossAmount: amount,
      feeAmount: toMoney(input?.fee || 0),
      netAmount: toMoney(input?.netAmount ?? amount),
      sourceType: "withdrawal",
      status: "completed",
      description: input?.description || `Withdrawal: ${amount}`,
    } as any);

    return { wallet: updatedWallet };
  });
}

export async function createPendingWithdrawalWithHold(input: any) {
  const userId = String(input?.userId || "");
  const amount = toMoney(input?.amount || 0);
  if (!userId || amount <= 0) throw new Error("Valid withdrawal hold required");

  return db.transaction(async (tx) => {
    const [updatedWallet] = await tx
      .update(wallets)
      .set({ balance: sql`${wallets.balance} - ${amount}`, lockedBalance: sql`${wallets.lockedBalance} + ${amount}` } as any)
      .where(and(eq(wallets.userId, userId), sql`${wallets.balance} >= ${amount}`))
      .returning();
    if (!updatedWallet) throw new Error("Insufficient balance");
    return { wallet: updatedWallet };
  });
}

export async function enterCompetitionWithFee(input: any) {
  const userId = String(input?.userId || "");
  const competitionId = Number(input?.competitionId || 0);
  const entryFee = toMoney(input?.entryFee || 0);
  const lineupCardIds = Array.isArray(input?.lineupCardIds) ? input.lineupCardIds : [];
  if (!userId || !Number.isInteger(competitionId) || competitionId <= 0) throw new Error("Valid tournament entry required");

  return db.transaction(async (tx) => {
    const [freshExistingEntry] = await tx
      .select({ id: competitionEntries.id })
      .from(competitionEntries)
      .where(and(eq(competitionEntries.competitionId, competitionId), eq(competitionEntries.userId, userId)))
      .limit(1);
    if (freshExistingEntry) throw new Error("Already entered this tournament");

    if (entryFee > 0) {
      const [debitedWallet] = await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${entryFee}` } as any)
        .where(and(eq(wallets.userId, userId), sql`${wallets.balance} >= ${entryFee}`))
        .returning();
      if (!debitedWallet) throw new Error("Insufficient balance for entry fee");

      await tx.insert(transactions).values({
        userId,
        type: "entry_fee",
        amount: -entryFee,
        grossAmount: entryFee,
        feeAmount: 0,
        netAmount: -entryFee,
        sourceType: "tournament_entry",
        status: "completed",
        description: `Entered tournament: ${String(input?.competitionName || competitionId)}`,
      } as any);
    }

    const [createdEntry] = await tx.insert(competitionEntries).values({
      competitionId,
      userId,
      lineupCardIds,
      captainId: input?.captainId || lineupCardIds[0],
      totalScore: 0,
    } as any).returning();

    return createdEntry;
  });
}

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
  await tx.update(wallets).set({ balance: sql`${wallets.balance} + ${sellerReceives}` } as any).where(eq(wallets.userId, sellerId));

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

export async function refundWalletHold(tx: any, input: { userId: string; amount: number }) {
  const amount = toMoney(input.amount);
  if (!input.userId || amount <= 0) return undefined;
  const [updatedWallet] = await tx
    .update(wallets)
    .set({ balance: sql`${wallets.balance} + ${amount}`, lockedBalance: sql`${wallets.lockedBalance} - ${amount}` } as any)
    .where(and(eq(wallets.userId, input.userId), sql`${wallets.lockedBalance} >= ${amount}`))
    .returning();
  if (!updatedWallet) throw new Error("Unable to refund held funds");
  return updatedWallet;
}

export async function settleHeldAuctionBid(tx: any, input: any) {
  const winnerId = String(input?.winnerId || "");
  const sellerId = String(input?.sellerId || "");
  const amount = toMoney(input?.amount || 0);
  if (!winnerId || !sellerId || amount <= 0) throw new Error("Valid auction settlement required");

  const [winnerWallet] = await tx
    .update(wallets)
    .set({ lockedBalance: sql`${wallets.lockedBalance} - ${amount}` } as any)
    .where(and(eq(wallets.userId, winnerId), sql`${wallets.lockedBalance} >= ${amount}`))
    .returning();
  if (!winnerWallet) throw new Error("Winning bidder funds are not locked");

  const fee = toMoney(amount * 0.08);
  const sellerReceives = toMoney(amount - fee);
  await tx.update(wallets).set({ balance: sql`${wallets.balance} + ${sellerReceives}` } as any).where(eq(wallets.userId, sellerId));

  await tx.insert(transactions).values({ userId: winnerId, type: "auction_settlement", amount: -amount, grossAmount: amount, feeAmount: 0, netAmount: -amount, sourceType: "auction_settlement", status: "completed", description: `auction card:${input?.cardId || ""} buyer:${winnerId} seller:${sellerId}` } as any);
  await tx.insert(transactions).values({ userId: sellerId, type: "auction_settlement", amount: sellerReceives, grossAmount: amount, feeAmount: fee, netAmount: sellerReceives, sourceType: "auction_settlement", status: "completed", description: `auction card:${input?.cardId || ""} buyer:${winnerId} seller:${sellerId}` } as any);

  return { amount, fee, sellerReceives };
}

export async function getWalletIntegrityReport() {
  const [walletRows, transactionRows, userRows] = await Promise.all([
    db.select().from(wallets),
    db.select().from(transactions),
    db.select({ id: users.id, email: users.email, name: users.name }).from(users),
  ]);

  const userMeta = new Map((userRows as any[]).map((user: any) => [String(user.id), user]));
  const ledgerByUser = new Map<string, number>();
  for (const tx of transactionRows as any[]) {
    const userId = String(tx.userId || "");
    if (!userId) continue;
    ledgerByUser.set(userId, toMoney((ledgerByUser.get(userId) || 0) + Number(tx.amount || 0)));
  }

  const walletUserIds = new Set((walletRows as any[]).map((wallet: any) => String(wallet.userId || "")));
  const missingWallets = Array.from(ledgerByUser.keys())
    .filter((userId) => userId && !walletUserIds.has(userId))
    .map((userId) => ({ userId, ledgerBalance: toMoney(ledgerByUser.get(userId) || 0), user: userMeta.get(userId) || null }));

  const rows: WalletIntegrityRow[] = (walletRows as any[]).map((wallet: any) => {
    const userId = String(wallet.userId || "");
    const balance = toMoney(wallet.balance || 0);
    const lockedBalance = toMoney(wallet.lockedBalance || 0);
    const ledgerBalance = toMoney(ledgerByUser.get(userId) || 0);
    const delta = toMoney(balance - ledgerBalance);
    const flags = [balance < 0 ? "negative_balance" : null, lockedBalance < 0 ? "negative_locked_balance" : null, Math.abs(delta) >= 0.01 ? "wallet_ledger_delta" : null].filter(Boolean) as string[];
    return { userId, user: userMeta.get(userId) || null, balance, lockedBalance, ledgerBalance, delta, flags, status: flags.length ? "review" : "ok" };
  });

  const summary = {
    walletsChecked: rows.length,
    okWallets: rows.filter((row) => row.status === "ok").length,
    reviewWallets: rows.filter((row) => row.status === "review").length,
    negativeBalances: rows.filter((row) => row.flags.includes("negative_balance")).length,
    negativeLockedBalances: rows.filter((row) => row.flags.includes("negative_locked_balance")).length,
    ledgerDeltas: rows.filter((row) => row.flags.includes("wallet_ledger_delta")).length,
    missingWallets: missingWallets.length,
  };

  return { summary, rows, missingWallets };
}

export async function repairMissingWalletsFromLedger() {
  const rows = await db.execute(sql`
    SELECT t.user_id, COALESCE(SUM(t.amount), 0) AS ledger_balance
    FROM app.transactions t
    LEFT JOIN app.wallets w ON w.user_id = t.user_id
    WHERE w.user_id IS NULL
    GROUP BY t.user_id
  `);
  const missingRows = Array.isArray(rows) ? rows : ((rows as any)?.rows || []);
  const repaired: Array<{ userId: string; balance: number }> = [];

  await db.transaction(async (tx) => {
    for (const row of missingRows as any[]) {
      const userId = String(row.user_id || "");
      if (!userId) continue;
      const balance = toMoney(row.ledger_balance || 0);
      await tx.insert(wallets).values({ userId, balance, lockedBalance: 0 } as any).onConflictDoNothing();
      repaired.push({ userId, balance });
    }
  });

  return repaired;
}

export async function debitWalletForHold(input: { userId: string; amount: number }) {
  const amount = toMoney(input.amount);
  if (!input.userId || amount <= 0) return undefined;

  const [updatedWallet] = await db
    .update(wallets)
    .set({ balance: sql`${wallets.balance} - ${amount}`, lockedBalance: sql`${wallets.lockedBalance} + ${amount}` } as any)
    .where(and(eq(wallets.userId, input.userId), sql`${wallets.balance} >= ${amount}`))
    .returning();

  return updatedWallet || undefined;
}

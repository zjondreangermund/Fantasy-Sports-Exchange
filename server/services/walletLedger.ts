import { and, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { competitionEntries, transactions, users, wallets, withdrawalRequests } from "../../shared/schema.js";

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

export async function creditWalletWithLedger(input: {
  userId: string;
  amount: number;
  description?: string;
}) {
  const amount = toMoney(input.amount);
  if (!input.userId || amount <= 0) {
    throw new Error("Valid userId and positive amount required");
  }

  return db.transaction(async (tx) => {
    const [updatedWallet] = await tx
      .update(wallets)
      .set({ balance: sql`${wallets.balance} + ${amount}` } as any)
      .where(eq(wallets.userId, input.userId))
      .returning();

    if (!updatedWallet) {
      throw new Error("Wallet not found");
    }

    await tx.insert(transactions).values({
      userId: input.userId,
      type: "admin_adjustment",
      amount,
      description: input.description || `Admin credit: ${amount}`,
    } as any);

    return updatedWallet;
  });
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
    .map((userId) => ({
      userId,
      ledgerBalance: toMoney(ledgerByUser.get(userId) || 0),
      user: userMeta.get(userId) || null,
    }));

  const rows: WalletIntegrityRow[] = (walletRows as any[]).map((wallet: any) => {
    const userId = String(wallet.userId || "");
    const balance = toMoney(wallet.balance || 0);
    const lockedBalance = toMoney(wallet.lockedBalance || 0);
    const ledgerBalance = toMoney(ledgerByUser.get(userId) || 0);
    const delta = toMoney(balance - ledgerBalance);
    const flags = [
      balance < 0 ? "negative_balance" : null,
      lockedBalance < 0 ? "negative_locked_balance" : null,
      Math.abs(delta) >= 0.01 ? "wallet_ledger_delta" : null,
    ].filter(Boolean) as string[];

    return {
      userId,
      user: userMeta.get(userId) || null,
      balance,
      lockedBalance,
      ledgerBalance,
      delta,
      flags,
      status: flags.length ? "review" : "ok",
    };
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

    if (repaired.length > 0) {
      await tx.insert(transactions).values(
        repaired.map((row) => ({
          userId: row.userId,
          type: "admin_adjustment",
          amount: 0,
          description: `Admin wallet repair created missing wallet at ledger balance ${row.balance}`,
        } as any)),
      );
    }
  });

  return repaired;
}

export async function debitWalletForHold(input: {
  userId: string;
  amount: number;
}) {
  const amount = toMoney(input.amount);
  if (!input.userId || amount <= 0) return undefined;

  const [updatedWallet] = await db
    .update(wallets)
    .set({
      balance: sql`${wallets.balance} - ${amount}`,
      lockedBalance: sql`${wallets.lockedBalance} + ${amount}`,
    } as any)
    .where(and(eq(wallets.userId, input.userId), sql`${wallets.balance} >= ${amount}`))
    .returning();

  return updatedWallet || undefined;
}


export async function processWalletDeposit(input: {
  userId: string;
  gross: number;
  fee: number;
  net: number;
  feeRate: number;
  paymentMethod?: string;
  externalTransactionId?: string;
  description: string;
}) {
  const gross = toMoney(input.gross);
  const fee = toMoney(input.fee);
  const net = toMoney(input.net);
  if (!input.userId || gross <= 0 || net <= 0) {
    throw new Error("Valid deposit amount required");
  }

  return db.transaction(async (tx) => {
    const [updatedWallet] = await tx
      .update(wallets)
      .set({ balance: sql`${wallets.balance} + ${net}` } as any)
      .where(eq(wallets.userId, input.userId))
      .returning();

    if (!updatedWallet) {
      throw new Error("Wallet not found");
    }

    await tx.insert(transactions).values({
      userId: input.userId,
      type: "deposit",
      amount: net,
      grossAmount: gross,
      feeAmount: fee,
      netAmount: net,
      sourceType: "deposit",
      status: "completed",
      description: input.description,
      paymentMethod: input.paymentMethod || "manual",
      externalTransactionId: input.externalTransactionId,
    } as any);

    return updatedWallet;
  });
}

export type WithdrawalDestinationInput = {
  userId: string;
  gross: number;
  fee: number;
  net: number;
  method: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  iban?: string;
  swiftCode?: string;
  ewalletProvider?: string;
  ewalletId?: string;
  destinationKey: string;
};

export async function createTrustedWithdrawal(input: WithdrawalDestinationInput) {
  const gross = toMoney(input.gross);
  const fee = toMoney(input.fee);
  const net = toMoney(input.net);
  if (!input.userId || gross <= 0) throw new Error("Valid withdrawal required");

  return db.transaction(async (tx) => {
    const [debitedWallet] = await tx
      .update(wallets)
      .set({ balance: sql`${wallets.balance} - ${gross}` } as any)
      .where(and(eq(wallets.userId, input.userId), sql`${wallets.balance} >= ${gross}`))
      .returning();

    if (!debitedWallet) {
      throw new Error("Insufficient balance");
    }

    const [createdWithdrawal] = await tx
      .insert(withdrawalRequests)
      .values({
        userId: input.userId,
        amount: gross,
        fee,
        netAmount: net,
        paymentMethod: input.method,
        bankName: input.bankName,
        accountHolder: input.accountHolder,
        accountNumber: input.accountNumber,
        iban: input.iban,
        swiftCode: input.swiftCode,
        ewalletProvider: input.ewalletProvider,
        ewalletId: input.ewalletId,
        destinationKey: input.destinationKey,
        destinationVerified: true,
        status: "paid",
        reviewedAt: new Date(),
        adminNotes: "Auto-approved trusted payout destination",
      } as any)
      .returning();

    await tx.insert(transactions).values({
      userId: input.userId,
      type: "withdrawal",
      amount: -gross,
      grossAmount: gross,
      feeAmount: fee,
      netAmount: net,
      sourceType: "withdrawal",
      status: "completed",
      description: `Instant withdrawal auto-approved: ${net} (fee: ${fee})`,
    } as any);

    return createdWithdrawal;
  });
}

export async function createPendingWithdrawalWithHold(input: WithdrawalDestinationInput & {
  verificationToken: string;
  releaseAfter: Date;
}) {
  const gross = toMoney(input.gross);
  const fee = toMoney(input.fee);
  const net = toMoney(input.net);
  if (!input.userId || gross <= 0) throw new Error("Valid withdrawal required");

  return db.transaction(async (tx) => {
    const [lockedWallet] = await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${gross}`,
        lockedBalance: sql`${wallets.lockedBalance} + ${gross}`,
      } as any)
      .where(and(eq(wallets.userId, input.userId), sql`${wallets.balance} >= ${gross}`))
      .returning();

    if (!lockedWallet) {
      throw new Error("Insufficient balance");
    }

    const [createdWithdrawal] = await tx
      .insert(withdrawalRequests)
      .values({
        userId: input.userId,
        amount: gross,
        fee,
        netAmount: net,
        paymentMethod: input.method,
        bankName: input.bankName,
        accountHolder: input.accountHolder,
        accountNumber: input.accountNumber,
        iban: input.iban,
        swiftCode: input.swiftCode,
        ewalletProvider: input.ewalletProvider,
        ewalletId: input.ewalletId,
        destinationKey: input.destinationKey,
        destinationVerified: false,
        verificationToken: input.verificationToken,
        releaseAfter: input.releaseAfter,
        status: "pending",
      } as any)
      .returning();

    return createdWithdrawal;
  });
}


export async function enterCompetitionWithFee(input: {
  competitionId: number;
  userId: string;
  lineupCardIds: number[];
  captainId: number;
  entryFee: number;
  competitionName: string;
}) {
  const entryFee = toMoney(input.entryFee);
  if (!Number.isFinite(input.competitionId) || input.competitionId <= 0 || !input.userId) {
    throw new Error("Invalid tournament entry");
  }
  if (!Array.isArray(input.lineupCardIds) || input.lineupCardIds.length !== 5) {
    throw new Error("Exactly 5 card IDs required");
  }

  return db.transaction(async (tx) => {
    const [freshExistingEntry] = await tx
      .select({ id: competitionEntries.id })
      .from(competitionEntries)
      .where(and(eq(competitionEntries.competitionId, input.competitionId), eq(competitionEntries.userId, input.userId)))
      .limit(1);

    if (freshExistingEntry) {
      throw new Error("Already entered this tournament");
    }

    if (entryFee > 0) {
      const [debitedWallet] = await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${entryFee}` } as any)
        .where(and(eq(wallets.userId, input.userId), sql`${wallets.balance} >= ${entryFee}`))
        .returning();

      if (!debitedWallet) {
        throw new Error("Insufficient balance for entry fee");
      }

      await tx.insert(transactions).values({
        userId: input.userId,
        type: "entry_fee",
        amount: -entryFee,
        description: `Entered tournament: ${input.competitionName}`,
      } as any);
    }

    const [createdEntry] = await tx
      .insert(competitionEntries)
      .values({
        competitionId: input.competitionId,
        userId: input.userId,
        lineupCardIds: input.lineupCardIds,
        captainId: input.captainId,
        totalScore: 0,
      } as any)
      .returning();

    return createdEntry;
  });
}

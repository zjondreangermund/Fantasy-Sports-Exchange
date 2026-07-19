import type { Express } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  auditLogs,
  idempotencyKeys,
  transactions,
  wallets,
  withdrawalRequests,
} from "../../shared/schema.js";
import {
  MIN_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_RATE,
} from "../../shared/card-economy.js";

interface RegisterWalletRoutesDeps {
  requireAuth: any;
  isAdmin: any;
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function requestKey(req: any, userId: string, action: string): string {
  const supplied = String(req.headers?.["x-idempotency-key"] || req.body?.idempotencyKey || "")
    .trim()
    .slice(0, 120);
  if (supplied) return `${userId}:${action}:${supplied}`;
  const amount = toMoney(req.body?.amount).toFixed(2);
  const destination = destinationKey(req.body).replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 80);
  const minuteBucket = Math.floor(Date.now() / 60000);
  return `${userId}:${action}:${amount}:${destination}:${minuteBucket}`;
}

function destinationKey(body: any): string {
  const method = String(body?.paymentMethod || "").trim().toLowerCase();
  if (method === "ewallet" || method === "mobile_money") {
    return `${method}:${String(body?.ewalletProvider || "").trim().toLowerCase()}:${String(body?.ewalletId || "").trim()}`;
  }
  return `${method}:${String(body?.bankName || "").trim().toLowerCase()}:${String(body?.accountNumber || body?.iban || "").trim()}`;
}

export function registerWalletRoutes(app: Express, deps: RegisterWalletRoutesDeps) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/wallet", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      await db.execute(sql`
        insert into app.wallets (user_id, balance, locked_balance)
        values (${userId}, 0, 0)
        on conflict (user_id) do nothing
      `);
      const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
      const availableBalance = toMoney(wallet?.balance || 0);
      const lockedBalance = toMoney(wallet?.lockedBalance || 0);
      return res.json({
        ...(wallet || {}),
        balance: availableBalance,
        availableBalance,
        lockedBalance,
        totalBalance: toMoney(availableBalance + lockedBalance),
        currency: "NAD",
      });
    } catch (error: any) {
      console.error("Failed to load wallet:", error);
      return res.status(500).json({ message: error?.message || "Failed to load wallet" });
    }
  });

  app.get("/api/transactions", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const rows = await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt)).limit(250);
      return res.json(rows);
    } catch (error: any) {
      console.error("Failed to load transactions:", error);
      return res.status(500).json({ message: error?.message || "Failed to load transactions" });
    }
  });

  app.get("/api/wallet/withdrawals", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const rows = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.userId, userId)).orderBy(desc(withdrawalRequests.createdAt)).limit(100);
      return res.json(rows);
    } catch (error: any) {
      console.error("Failed to load withdrawals:", error);
      return res.status(500).json({ message: error?.message || "Failed to load withdrawals" });
    }
  });

  app.post("/api/wallet/deposit", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const amount = toMoney(req.body?.amount);
      const paymentMethod = String(req.body?.paymentMethod || "").trim().toLowerCase();
      const externalTransactionId = String(req.body?.externalTransactionId || "").trim().slice(0, 160);
      if (amount <= 0 || !paymentMethod) return res.status(400).json({ message: "Valid deposit amount and payment method required" });
      if (!externalTransactionId) return res.status(400).json({ message: "Payment reference is required for verification" });
      const existing = await db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.externalTransactionId, externalTransactionId))).limit(1);
      if (existing[0]) return res.json({ success: true, pending: true, transaction: existing[0] });
      const [created] = await db.insert(transactions).values({
        userId,
        type: "deposit",
        amount: 0,
        grossAmount: amount,
        feeAmount: 0,
        netAmount: amount,
        sourceType: "deposit_verification",
        status: "pending",
        description: `Deposit awaiting verification: ${externalTransactionId}`,
        paymentMethod,
        externalTransactionId,
      } as any).returning();
      await db.insert(auditLogs).values({ userId, action: "wallet.deposit.submitted", meta: { transactionId: created.id, amount, paymentMethod, externalTransactionId } } as any);
      return res.json({ success: true, pending: true, message: "Deposit submitted for verification", transaction: created });
    } catch (error: any) {
      console.error("Failed to submit deposit:", error);
      return res.status(500).json({ message: error?.message || "Failed to submit deposit" });
    }
  });

  app.post("/api/wallet/withdraw", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const amount = toMoney(req.body?.amount);
      const paymentMethod = String(req.body?.paymentMethod || "").trim().toLowerCase();
      if (amount < MIN_WITHDRAWAL_AMOUNT) return res.status(400).json({ message: `Minimum withdrawal is N$${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}` });
      if (!paymentMethod) return res.status(400).json({ message: "Payment method required" });
      if ((paymentMethod === "ewallet" || paymentMethod === "mobile_money") && (!req.body?.ewalletProvider || !req.body?.ewalletId)) return res.status(400).json({ message: "eWallet provider and destination required" });
      if (paymentMethod !== "ewallet" && paymentMethod !== "mobile_money" && (!req.body?.accountHolder || (!req.body?.accountNumber && !req.body?.iban))) return res.status(400).json({ message: "Account holder and bank account details required" });
      const key = requestKey(req, userId, "withdraw");
      const fee = toMoney(amount * WITHDRAWAL_FEE_RATE);
      const netAmount = toMoney(amount - fee);
      if (netAmount <= 0) return res.status(400).json({ message: "Withdrawal amount is too small after fees" });

      const result = await db.transaction(async (tx) => {
        const [knownKey] = await tx.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key)).limit(1);
        if (knownKey) {
          const [existing] = await tx.select().from(withdrawalRequests).where(and(eq(withdrawalRequests.userId, userId), eq(withdrawalRequests.verificationToken, key))).limit(1);
          if (existing) return { withdrawal: existing, duplicate: true };
          throw new Error("Withdrawal request is already being processed");
        }
        await tx.insert(idempotencyKeys).values({ key, userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } as any);
        await tx.execute(sql`insert into app.wallets (user_id, balance, locked_balance) values (${userId}, 0, 0) on conflict (user_id) do nothing`);
        const [heldWallet] = await tx.update(wallets)
          .set({ balance: sql`${wallets.balance} - ${amount}`, lockedBalance: sql`${wallets.lockedBalance} + ${amount}` } as any)
          .where(and(eq(wallets.userId, userId), sql`${wallets.balance} >= ${amount}`))
          .returning();
        if (!heldWallet) throw new Error("Insufficient available balance");
        const [withdrawal] = await tx.insert(withdrawalRequests).values({
          userId,
          amount,
          fee,
          netAmount,
          paymentMethod,
          bankName: req.body?.bankName || null,
          accountHolder: req.body?.accountHolder || null,
          accountNumber: req.body?.accountNumber || null,
          iban: req.body?.iban || null,
          swiftCode: req.body?.swiftCode || null,
          ewalletProvider: req.body?.ewalletProvider || null,
          ewalletId: req.body?.ewalletId || null,
          destinationKey: destinationKey(req.body),
          verificationToken: key,
          status: "pending",
        } as any).returning();
        await tx.insert(transactions).values({
          userId,
          type: "withdrawal",
          amount: 0,
          grossAmount: amount,
          feeAmount: fee,
          netAmount: -amount,
          sourceType: "withdrawal_hold",
          status: "pending",
          description: `Withdrawal hold request:${withdrawal.id}`,
          paymentMethod,
          externalTransactionId: key,
        } as any);
        await tx.insert(auditLogs).values({ userId, action: "wallet.withdrawal.held", meta: { withdrawalId: withdrawal.id, amount, fee, netAmount, paymentMethod } } as any);
        return { withdrawal, duplicate: false };
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const message = String(error?.message || "Failed to submit withdrawal");
      const status = message.includes("Insufficient") || message.includes("already being processed") ? 400 : 500;
      if (status === 500) console.error("Failed to submit withdrawal:", error);
      return res.status(status).json({ message });
    }
  });

  app.post("/api/admin/withdrawals/:id/status", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const adminId = String(req.authUserId || "");
      const withdrawalId = Number(req.params.id);
      const nextStatus = String(req.body?.status || "").trim().toLowerCase();
      const adminNotes = String(req.body?.adminNotes || "").trim().slice(0, 500);
      if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) return res.status(400).json({ message: "Valid withdrawal required" });
      if (!["approved", "paid", "rejected"].includes(nextStatus)) return res.status(400).json({ message: "Status must be approved, paid, or rejected" });
      const result = await db.transaction(async (tx) => {
        const rows = await tx.execute(sql`select * from app.withdrawal_requests where id=${withdrawalId} for update`);
        const withdrawal = Array.isArray((rows as any)?.rows) ? (rows as any).rows[0] : undefined;
        if (!withdrawal) throw new Error("Withdrawal not found");
        const currentStatus = String(withdrawal.status || "pending");
        if (currentStatus === nextStatus) return { withdrawal, duplicate: true };
        if (["paid", "rejected"].includes(currentStatus)) throw new Error(`Withdrawal is already ${currentStatus}`);
        if (nextStatus === "paid" && !["pending", "approved"].includes(currentStatus)) throw new Error("Withdrawal cannot be paid from its current status");
        const userId = String(withdrawal.user_id || "");
        const amount = toMoney(withdrawal.amount || 0);
        if (nextStatus === "rejected") {
          const [refunded] = await tx.update(wallets)
            .set({ balance: sql`${wallets.balance} + ${amount}`, lockedBalance: sql`${wallets.lockedBalance} - ${amount}` } as any)
            .where(and(eq(wallets.userId, userId), sql`${wallets.lockedBalance} >= ${amount}`)).returning();
          if (!refunded) throw new Error("Withdrawal hold is missing or insufficient");
        }
        if (nextStatus === "paid") {
          const [settled] = await tx.update(wallets)
            .set({ lockedBalance: sql`${wallets.lockedBalance} - ${amount}` } as any)
            .where(and(eq(wallets.userId, userId), sql`${wallets.lockedBalance} >= ${amount}`)).returning();
          if (!settled) throw new Error("Withdrawal hold is missing or insufficient");
        }
        const [updated] = await tx.update(withdrawalRequests).set({ status: nextStatus as any, adminNotes: adminNotes || null, reviewedAt: new Date() } as any).where(eq(withdrawalRequests.id, withdrawalId)).returning();
        await tx.update(transactions).set({
          amount: nextStatus === "paid" ? -amount : 0,
          status: nextStatus === "paid" ? "completed" : nextStatus === "rejected" ? "rejected" : "pending",
          sourceType: nextStatus === "paid" ? "withdrawal_settlement" : nextStatus === "rejected" ? "withdrawal_refund" : "withdrawal_hold",
          description: `Withdrawal request:${withdrawalId} ${nextStatus}`,
        } as any).where(and(eq(transactions.userId, userId), eq(transactions.externalTransactionId, String(withdrawal.verification_token || ""))));
        await tx.insert(auditLogs).values({ userId, action: `wallet.withdrawal.${nextStatus}`, meta: { withdrawalId, amount, adminId, adminNotes } } as any);
        return { withdrawal: updated, duplicate: false };
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const message = String(error?.message || "Failed to update withdrawal");
      const status = message === "Withdrawal not found" ? 404 : message.includes("already") || message.includes("cannot") || message.includes("missing") ? 400 : 500;
      if (status === 500) console.error("Failed to update withdrawal:", error);
      return res.status(status).json({ message });
    }
  });
}

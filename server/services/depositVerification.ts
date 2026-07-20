import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { DEPOSIT_FEE_FREE_THRESHOLD, SMALL_DEPOSIT_FEE_RATE } from "../../shared/card-economy.js";
import { ensureDepositVerificationSchema } from "./depositVerificationSchema.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

export function normalizeDepositReference(value: unknown): string {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 160);
}

function normalizePaymentMethod(value: unknown): string {
  const method = String(value || "").trim().toLowerCase();
  return ["eft", "ewallet", "bank_transfer", "mobile_money", "other"].includes(method) ? method : "";
}

function calculateDepositAmounts(value: unknown) {
  const grossAmount = toMoney(value);
  const feeAmount = grossAmount > 0 && grossAmount < DEPOSIT_FEE_FREE_THRESHOLD
    ? toMoney(grossAmount * SMALL_DEPOSIT_FEE_RATE)
    : 0;
  return { grossAmount, feeAmount, netAmount: toMoney(grossAmount - feeAmount) };
}

function payload(row: any) {
  if (!row) return null;
  return {
    id: Number(row.id),
    transactionId: Number(row.transaction_id),
    referenceKey: String(row.reference_key || ""),
    externalTransactionId: String(row.external_transaction_id || ""),
    userId: String(row.user_id || ""),
    grossAmount: toMoney(row.gross_amount),
    feeAmount: toMoney(row.fee_amount),
    netAmount: toMoney(row.net_amount),
    paymentMethod: String(row.payment_method || ""),
    status: String(row.status || "pending"),
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    reviewNotes: row.review_notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    transactionStatus: row.transaction_status || null,
    transactionSourceType: row.transaction_source_type || null,
    userEmail: row.user_email || null,
    userName: row.user_name || null,
  };
}

async function findByReference(referenceKey: string) {
  return rowsOf(await db.execute(sql`
    SELECT dv.*, t.status::text AS transaction_status, t.source_type AS transaction_source_type
    FROM app.deposit_verifications dv
    JOIN app.transactions t ON t.id = dv.transaction_id
    WHERE dv.reference_key = ${referenceKey}
    LIMIT 1
  `))[0] || null;
}

function sameSubmission(row: any, userId: string, grossAmount: number, paymentMethod: string) {
  return row
    && String(row.user_id) === userId
    && toMoney(row.gross_amount) === grossAmount
    && String(row.payment_method) === paymentMethod;
}

export async function submitDepositForVerification(input: {
  userId: string;
  amount: unknown;
  paymentMethod: unknown;
  externalTransactionId: unknown;
}) {
  await ensureDepositVerificationSchema();
  const userId = String(input.userId || "");
  const paymentMethod = normalizePaymentMethod(input.paymentMethod);
  const externalTransactionId = String(input.externalTransactionId || "").trim().slice(0, 160);
  const referenceKey = normalizeDepositReference(externalTransactionId);
  const { grossAmount, feeAmount, netAmount } = calculateDepositAmounts(input.amount);
  if (!userId) throw new Error("Authenticated user required");
  if (!paymentMethod) throw new Error("Valid payment method required");
  if (!referenceKey) throw new Error("Payment reference is required for verification");
  if (grossAmount <= 0 || netAmount <= 0) throw new Error("Valid deposit amount required");

  try {
    return await db.transaction(async (tx) => {
      const existing = rowsOf(await tx.execute(sql`
        SELECT dv.*, t.status::text AS transaction_status, t.source_type AS transaction_source_type
        FROM app.deposit_verifications dv
        JOIN app.transactions t ON t.id = dv.transaction_id
        WHERE dv.reference_key = ${referenceKey}
        FOR UPDATE OF dv, t
      `))[0];
      if (existing) {
        if (!sameSubmission(existing, userId, grossAmount, paymentMethod)) throw new Error("Payment reference has already been claimed");
        return { verification: payload(existing), duplicate: true };
      }

      const transaction = rowsOf(await tx.execute(sql`
        INSERT INTO app.transactions (
          user_id, type, amount, gross_amount, fee_amount, net_amount,
          source_type, status, description, payment_method, external_transaction_id, created_at
        ) VALUES (
          ${userId}, 'deposit'::app.transaction_type, 0, ${grossAmount}, ${feeAmount}, ${netAmount},
          'deposit_verification', 'pending', ${`Deposit awaiting verification: ${externalTransactionId}`},
          ${paymentMethod}, ${externalTransactionId}, now()
        ) RETURNING *
      `))[0];
      if (!transaction?.id) throw new Error("Failed to create deposit verification transaction");

      const verification = rowsOf(await tx.execute(sql`
        INSERT INTO app.deposit_verifications (
          transaction_id, reference_key, external_transaction_id, user_id,
          gross_amount, fee_amount, net_amount, payment_method, status, created_at, updated_at
        ) VALUES (
          ${Number(transaction.id)}, ${referenceKey}, ${externalTransactionId}, ${userId},
          ${grossAmount}, ${feeAmount}, ${netAmount}, ${paymentMethod}, 'pending', now(), now()
        ) RETURNING *
      `))[0];

      await tx.execute(sql`
        INSERT INTO app.audit_logs (user_id, action, meta)
        VALUES (${userId}, 'wallet.deposit.submitted', ${JSON.stringify({
          verificationId: verification.id,
          transactionId: transaction.id,
          grossAmount,
          feeAmount,
          netAmount,
          paymentMethod,
          referenceKey,
        })}::jsonb)
      `);
      return { verification: payload({ ...verification, transaction_status: "pending", transaction_source_type: "deposit_verification" }), duplicate: false };
    });
  } catch (error: any) {
    const code = String(error?.code || error?.cause?.code || "");
    if (code !== "23505") throw error;
    const existing = await findByReference(referenceKey);
    if (!sameSubmission(existing, userId, grossAmount, paymentMethod)) throw new Error("Payment reference has already been claimed");
    return { verification: payload(existing), duplicate: true };
  }
}

export async function listDepositVerifications(input: { status?: unknown; limit?: unknown } = {}) {
  await ensureDepositVerificationSchema();
  const requested = String(input.status || "").trim().toLowerCase();
  const status = ["pending", "approved", "rejected"].includes(requested) ? requested : "";
  const limit = Math.max(1, Math.min(250, Number(input.limit || 100) || 100));
  const rows = rowsOf(await db.execute(sql`
    SELECT dv.*, t.status::text AS transaction_status, t.source_type AS transaction_source_type,
      u.email AS user_email, coalesce(u.name, u.manager_team_name, u.email, u.id) AS user_name
    FROM app.deposit_verifications dv
    JOIN app.transactions t ON t.id = dv.transaction_id
    JOIN app.users u ON u.id = dv.user_id
    WHERE (${status} = '' OR dv.status = ${status})
    ORDER BY CASE WHEN dv.status = 'pending' THEN 0 ELSE 1 END, dv.created_at ASC, dv.id ASC
    LIMIT ${limit}
  `));
  return rows.map(payload);
}

export async function reviewDepositVerification(input: {
  verificationId: number;
  adminId: string;
  decision: unknown;
  adminNotes?: unknown;
}) {
  await ensureDepositVerificationSchema();
  const verificationId = Number(input.verificationId);
  const adminId = String(input.adminId || "");
  const decision = String(input.decision || "").trim().toLowerCase();
  const adminNotes = String(input.adminNotes || "").trim().slice(0, 1000);
  if (!Number.isInteger(verificationId) || verificationId <= 0) throw new Error("Valid deposit verification required");
  if (!adminId) throw new Error("Admin identity required");
  if (!["approved", "rejected"].includes(decision)) throw new Error("Decision must be approved or rejected");

  return db.transaction(async (tx) => {
    const row = rowsOf(await tx.execute(sql`
      SELECT dv.*, t.status::text AS transaction_status, t.source_type AS transaction_source_type,
        t.amount AS transaction_amount
      FROM app.deposit_verifications dv
      JOIN app.transactions t ON t.id = dv.transaction_id
      WHERE dv.id = ${verificationId}
      FOR UPDATE OF dv, t
    `))[0];
    if (!row) throw new Error("Deposit verification not found");

    const currentStatus = String(row.status || "pending");
    if (currentStatus === decision) return { verification: payload(row), duplicate: true };
    if (["approved", "rejected"].includes(currentStatus)) throw new Error(`Deposit is already ${currentStatus}`);
    if (String(row.transaction_status) !== "pending" || String(row.transaction_source_type) !== "deposit_verification") {
      throw new Error("Deposit ledger state does not match pending verification");
    }
    if (toMoney(row.transaction_amount) !== 0) throw new Error("Pending deposit already changed wallet value");

    const userId = String(row.user_id || "");
    const grossAmount = toMoney(row.gross_amount);
    const feeAmount = toMoney(row.fee_amount);
    const netAmount = toMoney(row.net_amount);
    if (!userId || grossAmount <= 0 || netAmount <= 0) throw new Error("Deposit verification amounts are invalid");

    if (decision === "approved") {
      await tx.execute(sql`
        INSERT INTO app.wallets (user_id, balance, locked_balance)
        VALUES (${userId}, 0, 0)
        ON CONFLICT (user_id) DO NOTHING
      `);
      const wallet = rowsOf(await tx.execute(sql`
        UPDATE app.wallets SET balance = balance + ${netAmount}
        WHERE user_id = ${userId}
        RETURNING user_id
      `))[0];
      if (!wallet) throw new Error("Unable to credit verified deposit");
      await tx.execute(sql`
        UPDATE app.transactions
        SET amount = ${netAmount}, gross_amount = ${grossAmount}, fee_amount = ${feeAmount}, net_amount = ${netAmount},
            source_type = 'deposit_verified', status = 'completed',
            description = ${`Verified deposit ${row.external_transaction_id}`}
        WHERE id = ${Number(row.transaction_id)}
      `);
    } else {
      await tx.execute(sql`
        UPDATE app.transactions
        SET amount = 0, gross_amount = ${grossAmount}, fee_amount = ${feeAmount}, net_amount = ${netAmount},
            source_type = 'deposit_rejected', status = 'rejected',
            description = ${`Rejected deposit ${row.external_transaction_id}`}
        WHERE id = ${Number(row.transaction_id)}
      `);
    }

    const updated = rowsOf(await tx.execute(sql`
      UPDATE app.deposit_verifications
      SET status = ${decision}, reviewed_by = ${adminId}, reviewed_at = now(),
          review_notes = ${adminNotes || null}, updated_at = now()
      WHERE id = ${verificationId}
      RETURNING *
    `))[0];

    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (${userId}, ${`wallet.deposit.${decision}`}, ${JSON.stringify({
        verificationId,
        transactionId: Number(row.transaction_id),
        adminId,
        grossAmount,
        feeAmount,
        netAmount,
        paymentMethod: row.payment_method,
        referenceKey: row.reference_key,
        adminNotes,
      })}::jsonb)
    `);

    return {
      verification: payload({
        ...updated,
        transaction_status: decision === "approved" ? "completed" : "rejected",
        transaction_source_type: decision === "approved" ? "deposit_verified" : "deposit_rejected",
      }),
      duplicate: false,
    };
  });
}

export async function getDepositVerificationIntegrity() {
  await ensureDepositVerificationSchema();
  const row = rowsOf(await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM app.deposit_verifications WHERE status = 'pending') AS pending,
      (SELECT count(*)::int FROM app.transactions t
       WHERE t.type::text = 'deposit' AND t.source_type = 'deposit_verification'
         AND NOT EXISTS (SELECT 1 FROM app.deposit_verifications dv WHERE dv.transaction_id = t.id)) AS pending_without_claim,
      (SELECT count(*)::int FROM app.deposit_verifications dv JOIN app.transactions t ON t.id = dv.transaction_id
       WHERE (dv.status = 'approved' AND (t.status::text <> 'completed' OR t.source_type <> 'deposit_verified'))
          OR (dv.status = 'rejected' AND (t.status::text <> 'rejected' OR t.source_type <> 'deposit_rejected'))
          OR (dv.status = 'pending' AND (t.status::text <> 'pending' OR t.source_type <> 'deposit_verification'))) AS state_mismatches,
      (SELECT count(*)::int FROM app.transactions WHERE source_type = 'deposit_duplicate_legacy') AS blocked_legacy_duplicates
  `))[0] || {};
  return {
    pending: Number(row.pending || 0),
    pendingWithoutClaim: Number(row.pending_without_claim || 0),
    stateMismatches: Number(row.state_mismatches || 0),
    blockedLegacyDuplicates: Number(row.blocked_legacy_duplicates || 0),
  };
}

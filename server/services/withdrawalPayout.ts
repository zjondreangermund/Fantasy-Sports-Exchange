import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { MIN_WITHDRAWAL_AMOUNT, WITHDRAWAL_FEE_RATE } from "../../shared/card-economy.js";
import { ensureWithdrawalPayoutSchema } from "./withdrawalPayoutSchema.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function normalizePaymentMethod(value: unknown): string {
  const method = String(value || "").trim().toLowerCase();
  return ["eft", "ewallet", "bank_transfer", "mobile_money", "other"].includes(method) ? method : "";
}

export function normalizePayoutReference(value: unknown): string {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 180);
}

function destinationKey(input: any): string {
  const method = normalizePaymentMethod(input?.paymentMethod);
  if (method === "ewallet" || method === "mobile_money") {
    return `${method}:${String(input?.ewalletProvider || "").trim().toLowerCase()}:${String(input?.ewalletId || "").trim()}`;
  }
  return `${method}:${String(input?.bankName || "").trim().toLowerCase()}:${String(input?.accountNumber || input?.iban || "").trim()}`;
}

function requestKey(input: any, userId: string, amount: number, destination: string): string {
  const supplied = String(input?.idempotencyKey || "").trim().slice(0, 120);
  if (supplied) return `${userId}:withdraw:${supplied}`;
  const safeDestination = destination.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 100);
  return `${userId}:withdraw:${amount.toFixed(2)}:${safeDestination}:${Math.floor(Date.now() / 300000)}`;
}

function withdrawalPayload(row: any) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: String(row.user_id || row.userId || ""),
    amount: toMoney(row.amount),
    fee: toMoney(row.fee),
    netAmount: toMoney(row.net_amount ?? row.netAmount),
    paymentMethod: String(row.payment_method || row.paymentMethod || ""),
    bankName: row.bank_name ?? row.bankName ?? null,
    accountHolder: row.account_holder ?? row.accountHolder ?? null,
    accountNumber: row.account_number ?? row.accountNumber ?? null,
    iban: row.iban ?? null,
    swiftCode: row.swift_code ?? row.swiftCode ?? null,
    ewalletProvider: row.ewallet_provider ?? row.ewalletProvider ?? null,
    ewalletId: row.ewallet_id ?? row.ewalletId ?? null,
    destinationKey: row.destination_key ?? row.destinationKey ?? null,
    status: String(row.status || "pending"),
    adminNotes: row.admin_notes ?? row.adminNotes ?? null,
    reviewedBy: row.reviewed_by ?? row.reviewedBy ?? null,
    reviewedAt: row.reviewed_at ?? row.reviewedAt ?? null,
    approvedAt: row.approved_at ?? row.approvedAt ?? null,
    paidAt: row.paid_at ?? row.paidAt ?? null,
    rejectedAt: row.rejected_at ?? row.rejectedAt ?? null,
    failedAt: row.failed_at ?? row.failedAt ?? null,
    payoutReference: row.payout_reference ?? row.payoutReference ?? null,
    payoutError: row.payout_error ?? row.payoutError ?? null,
    payoutAttempts: Number(row.payout_attempts ?? row.payoutAttempts ?? 0),
    recoveryCompletedAt: row.recovery_completed_at ?? row.recoveryCompletedAt ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    userEmail: row.user_email ?? row.userEmail ?? null,
    userName: row.user_name ?? row.userName ?? null,
  };
}

async function lockWithdrawal(tx: any, withdrawalId: number) {
  const withdrawal = rowsOf(await tx.execute(sql`
    SELECT * FROM app.withdrawal_requests WHERE id = ${withdrawalId} FOR UPDATE
  `))[0];
  if (!withdrawal) throw new Error("Withdrawal not found");

  let holdTransaction = withdrawal.hold_transaction_id
    ? rowsOf(await tx.execute(sql`SELECT * FROM app.transactions WHERE id = ${Number(withdrawal.hold_transaction_id)} FOR UPDATE`))[0]
    : null;

  if (!holdTransaction && withdrawal.verification_token) {
    const candidates = rowsOf(await tx.execute(sql`
      SELECT * FROM app.transactions
      WHERE user_id = ${String(withdrawal.user_id)}
        AND type::text = 'withdrawal'
        AND external_transaction_id = ${String(withdrawal.verification_token)}
      ORDER BY CASE WHEN source_type IN ('withdrawal_hold', 'withdrawal_settlement', 'withdrawal_refund') THEN 0 ELSE 1 END,
        created_at NULLS LAST, id
      FOR UPDATE
    `));
    if (candidates.length === 1) {
      holdTransaction = candidates[0];
      await tx.execute(sql`UPDATE app.withdrawal_requests SET hold_transaction_id = ${Number(holdTransaction.id)} WHERE id = ${withdrawalId}`);
      withdrawal.hold_transaction_id = Number(holdTransaction.id);
    }
  }

  await tx.execute(sql`
    INSERT INTO app.wallets (user_id, balance, locked_balance)
    VALUES (${String(withdrawal.user_id)}, 0, 0)
    ON CONFLICT (user_id) DO NOTHING
  `);
  const wallet = rowsOf(await tx.execute(sql`
    SELECT * FROM app.wallets WHERE user_id = ${String(withdrawal.user_id)} FOR UPDATE
  `))[0];
  return { withdrawal, holdTransaction, wallet };
}

function assertPendingHold(withdrawal: any, holdTransaction: any, wallet: any) {
  const amount = toMoney(withdrawal.amount);
  if (!holdTransaction) throw new Error("Withdrawal hold transaction is missing");
  if (String(holdTransaction.status) !== "pending" || String(holdTransaction.source_type) !== "withdrawal_hold" || toMoney(holdTransaction.amount) !== 0) {
    throw new Error("Withdrawal hold ledger state does not match an unsettled request");
  }
  if (!wallet || toMoney(wallet.locked_balance) + 0.005 < amount) throw new Error("Withdrawal hold is missing or insufficient");
}

async function verifySameStatus(tx: any, withdrawal: any, holdTransaction: any, wallet: any, status: string) {
  const amount = toMoney(withdrawal.amount);
  if (status === "approved") {
    assertPendingHold(withdrawal, holdTransaction, wallet);
    return;
  }
  if (status === "failed") {
    assertPendingHold(withdrawal, holdTransaction, wallet);
    const latest = rowsOf(await tx.execute(sql`
      SELECT * FROM app.withdrawal_payout_attempts
      WHERE withdrawal_id = ${Number(withdrawal.id)}
      ORDER BY attempt_no DESC LIMIT 1 FOR UPDATE
    `))[0];
    if (!latest || String(latest.status) !== "failed") throw new Error("Failed withdrawal is missing its payout attempt record");
    return;
  }
  if (status === "paid") {
    if (!holdTransaction || String(holdTransaction.status) !== "completed" || String(holdTransaction.source_type) !== "withdrawal_settlement" || toMoney(holdTransaction.amount) !== -amount) {
      throw new Error("Paid withdrawal ledger state does not match settlement");
    }
    const referenceKey = String(withdrawal.payout_reference_key || "");
    if (!referenceKey) throw new Error("Paid withdrawal is missing external payout proof");
    const attempt = rowsOf(await tx.execute(sql`
      SELECT * FROM app.withdrawal_payout_attempts
      WHERE withdrawal_id = ${Number(withdrawal.id)} AND payout_reference_key = ${referenceKey}
      LIMIT 1 FOR UPDATE
    `))[0];
    if (!attempt || String(attempt.status) !== "paid") throw new Error("Paid withdrawal is missing its payout attempt record");
    return;
  }
  if (status === "rejected") {
    if (!holdTransaction || String(holdTransaction.status) !== "rejected" || String(holdTransaction.source_type) !== "withdrawal_refund" || toMoney(holdTransaction.amount) !== 0) {
      throw new Error("Rejected withdrawal ledger state does not match refund");
    }
  }
}

export async function submitWithdrawalRequest(input: any) {
  await ensureWithdrawalPayoutSchema();
  const userId = String(input?.userId || "");
  const amount = toMoney(input?.amount);
  const paymentMethod = normalizePaymentMethod(input?.paymentMethod);
  const destination = destinationKey(input);
  const fee = toMoney(amount * WITHDRAWAL_FEE_RATE);
  const netAmount = toMoney(amount - fee);
  if (!userId) throw new Error("Authenticated user required");
  if (amount < MIN_WITHDRAWAL_AMOUNT) throw new Error(`Minimum withdrawal is N$${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}`);
  if (!paymentMethod) throw new Error("Valid payment method required");
  if ((paymentMethod === "ewallet" || paymentMethod === "mobile_money") && (!input?.ewalletProvider || !input?.ewalletId)) throw new Error("eWallet provider and destination required");
  if (paymentMethod !== "ewallet" && paymentMethod !== "mobile_money" && (!input?.accountHolder || (!input?.accountNumber && !input?.iban))) throw new Error("Account holder and bank account details required");
  if (netAmount <= 0) throw new Error("Withdrawal amount is too small after fees");
  const key = requestKey(input, userId, amount, destination);

  return db.transaction(async (tx) => {
    const claimed = rowsOf(await tx.execute(sql`
      INSERT INTO app.idempotency_keys (key, user_id, created_at, expires_at)
      VALUES (${key}, ${userId}, now(), now() + interval '24 hours')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `))[0];
    if (!claimed) {
      const existing = rowsOf(await tx.execute(sql`
        SELECT * FROM app.withdrawal_requests
        WHERE user_id = ${userId} AND verification_token = ${key}
        LIMIT 1 FOR UPDATE
      `))[0];
      if (!existing) throw new Error("Withdrawal request is already being processed");
      if (toMoney(existing.amount) !== amount || String(existing.destination_key || "") !== destination || String(existing.payment_method || "") !== paymentMethod) {
        throw new Error("Withdrawal idempotency key was reused with different details");
      }
      return { withdrawal: withdrawalPayload(existing), duplicate: true };
    }

    await tx.execute(sql`INSERT INTO app.wallets (user_id, balance, locked_balance) VALUES (${userId}, 0, 0) ON CONFLICT (user_id) DO NOTHING`);
    const wallet = rowsOf(await tx.execute(sql`
      UPDATE app.wallets
      SET balance = balance - ${amount}, locked_balance = locked_balance + ${amount}
      WHERE user_id = ${userId} AND balance >= ${amount}
      RETURNING *
    `))[0];
    if (!wallet) throw new Error("Insufficient available balance");

    const withdrawal = rowsOf(await tx.execute(sql`
      INSERT INTO app.withdrawal_requests (
        user_id, amount, fee, net_amount, payment_method, bank_name, account_holder,
        account_number, iban, swift_code, ewallet_provider, ewallet_id, destination_key,
        destination_verified, verification_token, status, payout_attempts, created_at
      ) VALUES (
        ${userId}, ${amount}, ${fee}, ${netAmount}, ${paymentMethod}, ${input?.bankName || null},
        ${input?.accountHolder || null}, ${input?.accountNumber || null}, ${input?.iban || null},
        ${input?.swiftCode || null}, ${input?.ewalletProvider || null}, ${input?.ewalletId || null},
        ${destination}, false, ${key}, 'pending', 0, now()
      ) RETURNING *
    `))[0];
    if (!withdrawal?.id) throw new Error("Failed to create withdrawal request");

    const holdTransaction = rowsOf(await tx.execute(sql`
      INSERT INTO app.transactions (
        user_id, type, amount, gross_amount, fee_amount, net_amount, source_type,
        status, description, payment_method, external_transaction_id, created_at
      ) VALUES (
        ${userId}, 'withdrawal'::app.transaction_type, 0, ${amount}, ${fee}, ${-amount},
        'withdrawal_hold', 'pending', ${`Withdrawal hold request:${withdrawal.id}`},
        ${paymentMethod}, ${key}, now()
      ) RETURNING *
    `))[0];
    await tx.execute(sql`
      UPDATE app.withdrawal_requests SET hold_transaction_id = ${Number(holdTransaction.id)} WHERE id = ${Number(withdrawal.id)}
    `);
    withdrawal.hold_transaction_id = Number(holdTransaction.id);

    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (${userId}, 'wallet.withdrawal.held', ${JSON.stringify({
        withdrawalId: Number(withdrawal.id),
        holdTransactionId: Number(holdTransaction.id),
        amount,
        fee,
        netAmount,
        paymentMethod,
        destinationKey: destination,
        idempotencyKey: key,
      })}::jsonb)
    `);
    return { withdrawal: withdrawalPayload(withdrawal), duplicate: false };
  });
}

export async function listUserWithdrawals(userId: string) {
  await ensureWithdrawalPayoutSchema();
  const rows = rowsOf(await db.execute(sql`
    SELECT * FROM app.withdrawal_requests
    WHERE user_id = ${String(userId || "")}
    ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 100
  `));
  return rows.map(withdrawalPayload);
}

export async function listAdminWithdrawals(input: { status?: unknown; limit?: unknown } = {}) {
  await ensureWithdrawalPayoutSchema();
  const requestedStatus = String(input.status || "").trim().toLowerCase();
  const status = ["pending", "approved", "failed", "paid", "rejected"].includes(requestedStatus) ? requestedStatus : "";
  const limit = Math.max(1, Math.min(250, Number(input.limit || 100) || 100));
  const rows = rowsOf(await db.execute(sql`
    SELECT wr.*, u.email AS user_email,
      coalesce(u.name, u.manager_team_name, u.email, u.id) AS user_name
    FROM app.withdrawal_requests wr
    JOIN app.users u ON u.id = wr.user_id
    WHERE (${status} = '' OR wr.status::text = ${status})
    ORDER BY CASE wr.status::text WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END,
      wr.created_at ASC NULLS LAST, wr.id ASC
    LIMIT ${limit}
  `));
  return rows.map(withdrawalPayload);
}

export async function reviewWithdrawal(input: {
  withdrawalId: number;
  adminId: string;
  status: unknown;
  adminNotes?: unknown;
  payoutReference?: unknown;
  failureReason?: unknown;
}) {
  await ensureWithdrawalPayoutSchema();
  const withdrawalId = Number(input.withdrawalId);
  const adminId = String(input.adminId || "");
  const nextStatus = String(input.status || "").trim().toLowerCase();
  const adminNotes = String(input.adminNotes || "").trim().slice(0, 1000);
  const payoutReference = String(input.payoutReference || "").trim().slice(0, 180);
  const payoutReferenceKey = normalizePayoutReference(payoutReference);
  const failureReason = String(input.failureReason || "").trim().slice(0, 1000);
  if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) throw new Error("Valid withdrawal required");
  if (!adminId) throw new Error("Admin identity required");
  if (!["approved", "paid", "failed", "rejected"].includes(nextStatus)) throw new Error("Status must be approved, paid, failed, or rejected");
  if (nextStatus === "paid" && !payoutReferenceKey) throw new Error("External payout reference is required before marking paid");
  if (nextStatus === "failed" && !failureReason) throw new Error("Failure reason is required");

  try {
    return await db.transaction(async (tx) => {
      const { withdrawal, holdTransaction, wallet } = await lockWithdrawal(tx, withdrawalId);
      const currentStatus = String(withdrawal.status || "pending");
      if (currentStatus === nextStatus) {
        await verifySameStatus(tx, withdrawal, holdTransaction, wallet, nextStatus);
        return { withdrawal: withdrawalPayload(withdrawal), duplicate: true };
      }
      if (["paid", "rejected"].includes(currentStatus)) throw new Error(`Withdrawal is already ${currentStatus}`);

      const amount = toMoney(withdrawal.amount);
      const fee = toMoney(withdrawal.fee);
      const netAmount = toMoney(withdrawal.net_amount);
      if (amount <= 0 || netAmount <= 0 || toMoney(amount - fee) !== netAmount) throw new Error("Withdrawal amounts are invalid");

      if (nextStatus === "approved") {
        if (!["pending", "failed"].includes(currentStatus)) throw new Error("Withdrawal cannot be approved from its current status");
        assertPendingHold(withdrawal, holdTransaction, wallet);
        const updated = rowsOf(await tx.execute(sql`
          UPDATE app.withdrawal_requests
          SET status = 'approved', reviewed_by = ${adminId}, reviewed_at = now(), approved_at = now(),
              admin_notes = ${adminNotes || null}, payout_error = NULL,
              recovery_completed_at = CASE WHEN ${currentStatus} = 'failed' THEN now() ELSE recovery_completed_at END
          WHERE id = ${withdrawalId}
          RETURNING *
        `))[0];
        await tx.execute(sql`
          INSERT INTO app.audit_logs (user_id, action, meta)
          VALUES (${String(withdrawal.user_id)}, ${currentStatus === "failed" ? "wallet.withdrawal.retry_approved" : "wallet.withdrawal.approved"},
            ${JSON.stringify({ withdrawalId, amount, fee, netAmount, adminId, adminNotes })}::jsonb)
        `);
        return { withdrawal: withdrawalPayload(updated), duplicate: false };
      }

      if (nextStatus === "failed") {
        if (currentStatus !== "approved") throw new Error("Only an approved withdrawal can be marked failed");
        assertPendingHold(withdrawal, holdTransaction, wallet);
        const attemptNo = Number(withdrawal.payout_attempts || 0) + 1;
        await tx.execute(sql`
          INSERT INTO app.withdrawal_payout_attempts (
            withdrawal_id, admin_id, attempt_no, status, payout_reference,
            payout_reference_key, error_text, created_at, updated_at
          ) VALUES (
            ${withdrawalId}, ${adminId}, ${attemptNo}, 'failed', ${payoutReference || null},
            ${payoutReferenceKey || null}, ${failureReason}, now(), now()
          )
        `);
        const updated = rowsOf(await tx.execute(sql`
          UPDATE app.withdrawal_requests
          SET status = 'failed', reviewed_by = ${adminId}, reviewed_at = now(), failed_at = now(),
              payout_error = ${failureReason}, payout_attempts = ${attemptNo}, admin_notes = ${adminNotes || null}
          WHERE id = ${withdrawalId}
          RETURNING *
        `))[0];
        await tx.execute(sql`
          INSERT INTO app.audit_logs (user_id, action, meta)
          VALUES (${String(withdrawal.user_id)}, 'wallet.withdrawal.failed', ${JSON.stringify({
            withdrawalId, amount, fee, netAmount, adminId, adminNotes, failureReason,
            payoutReference: payoutReference || null, attemptNo,
          })}::jsonb)
        `);
        return { withdrawal: withdrawalPayload(updated), duplicate: false };
      }

      if (nextStatus === "paid") {
        if (!["approved", "failed"].includes(currentStatus)) throw new Error("Withdrawal must be approved before it can be paid");
        assertPendingHold(withdrawal, holdTransaction, wallet);
        const existingReference = rowsOf(await tx.execute(sql`
          SELECT * FROM app.withdrawal_payout_attempts
          WHERE payout_reference_key = ${payoutReferenceKey}
          LIMIT 1 FOR UPDATE
        `))[0];
        let attemptNo = Number(withdrawal.payout_attempts || 0);
        if (existingReference) {
          if (Number(existingReference.withdrawal_id) !== withdrawalId) throw new Error("Payout reference has already been used for another withdrawal");
          if (String(existingReference.status) !== "failed") throw new Error("Payout reference has already been completed");
          await tx.execute(sql`
            UPDATE app.withdrawal_payout_attempts
            SET status = 'paid', error_text = NULL, updated_at = now()
            WHERE id = ${Number(existingReference.id)}
          `);
          attemptNo = Math.max(attemptNo, Number(existingReference.attempt_no || 0));
        } else {
          attemptNo += 1;
          await tx.execute(sql`
            INSERT INTO app.withdrawal_payout_attempts (
              withdrawal_id, admin_id, attempt_no, status, payout_reference,
              payout_reference_key, error_text, created_at, updated_at
            ) VALUES (
              ${withdrawalId}, ${adminId}, ${attemptNo}, 'paid', ${payoutReference},
              ${payoutReferenceKey}, NULL, now(), now()
            )
          `);
        }

        const settledWallet = rowsOf(await tx.execute(sql`
          UPDATE app.wallets
          SET locked_balance = locked_balance - ${amount}
          WHERE user_id = ${String(withdrawal.user_id)} AND locked_balance >= ${amount}
          RETURNING *
        `))[0];
        if (!settledWallet) throw new Error("Withdrawal hold is missing or insufficient");
        const settledTransaction = rowsOf(await tx.execute(sql`
          UPDATE app.transactions
          SET amount = ${-amount}, gross_amount = ${amount}, fee_amount = ${fee}, net_amount = ${-amount},
              source_type = 'withdrawal_settlement', status = 'completed',
              description = ${`Withdrawal request:${withdrawalId} paid reference:${payoutReference} external_net:${netAmount.toFixed(2)}`}
          WHERE id = ${Number(holdTransaction.id)}
            AND status::text = 'pending' AND source_type = 'withdrawal_hold' AND amount = 0
          RETURNING *
        `))[0];
        if (!settledTransaction) throw new Error("Withdrawal hold transaction could not be settled");
        const updated = rowsOf(await tx.execute(sql`
          UPDATE app.withdrawal_requests
          SET status = 'paid', reviewed_by = ${adminId}, reviewed_at = now(), paid_at = now(),
              payout_reference = ${payoutReference}, payout_reference_key = ${payoutReferenceKey},
              payout_error = NULL, payout_attempts = ${attemptNo}, admin_notes = ${adminNotes || null},
              recovery_completed_at = CASE WHEN ${currentStatus} = 'failed' THEN now() ELSE recovery_completed_at END
          WHERE id = ${withdrawalId}
          RETURNING *
        `))[0];
        await tx.execute(sql`
          INSERT INTO app.audit_logs (user_id, action, meta)
          VALUES (${String(withdrawal.user_id)}, 'wallet.withdrawal.paid', ${JSON.stringify({
            withdrawalId, holdTransactionId: Number(holdTransaction.id), amount, fee, netAmount,
            adminId, adminNotes, payoutReference, payoutReferenceKey, attemptNo,
            recoveredFromFailure: currentStatus === "failed",
          })}::jsonb)
        `);
        return { withdrawal: withdrawalPayload(updated), duplicate: false };
      }

      if (!["pending", "approved", "failed"].includes(currentStatus)) throw new Error("Withdrawal cannot be rejected from its current status");
      assertPendingHold(withdrawal, holdTransaction, wallet);
      const refundedWallet = rowsOf(await tx.execute(sql`
        UPDATE app.wallets
        SET balance = balance + ${amount}, locked_balance = locked_balance - ${amount}
        WHERE user_id = ${String(withdrawal.user_id)} AND locked_balance >= ${amount}
        RETURNING *
      `))[0];
      if (!refundedWallet) throw new Error("Withdrawal hold is missing or insufficient");
      const refundedTransaction = rowsOf(await tx.execute(sql`
        UPDATE app.transactions
        SET amount = 0, gross_amount = ${amount}, fee_amount = ${fee}, net_amount = 0,
            source_type = 'withdrawal_refund', status = 'rejected',
            description = ${`Withdrawal request:${withdrawalId} rejected and hold refunded`}
        WHERE id = ${Number(holdTransaction.id)}
          AND status::text = 'pending' AND source_type = 'withdrawal_hold' AND amount = 0
        RETURNING *
      `))[0];
      if (!refundedTransaction) throw new Error("Withdrawal hold transaction could not be refunded");
      const updated = rowsOf(await tx.execute(sql`
        UPDATE app.withdrawal_requests
        SET status = 'rejected', reviewed_by = ${adminId}, reviewed_at = now(), rejected_at = now(),
            admin_notes = ${adminNotes || null}, payout_error = NULL,
            recovery_completed_at = CASE WHEN ${currentStatus} = 'failed' THEN now() ELSE recovery_completed_at END
        WHERE id = ${withdrawalId}
        RETURNING *
      `))[0];
      await tx.execute(sql`
        INSERT INTO app.audit_logs (user_id, action, meta)
        VALUES (${String(withdrawal.user_id)}, 'wallet.withdrawal.rejected', ${JSON.stringify({
          withdrawalId, holdTransactionId: Number(holdTransaction.id), amount, fee, netAmount,
          adminId, adminNotes, recoveredFromFailure: currentStatus === "failed",
        })}::jsonb)
      `);
      return { withdrawal: withdrawalPayload(updated), duplicate: false };
    });
  } catch (error: any) {
    const code = String(error?.code || error?.cause?.code || "");
    if (code === "23505" && payoutReferenceKey) {
      const existing = rowsOf(await db.execute(sql`
        SELECT withdrawal_id, status FROM app.withdrawal_payout_attempts
        WHERE payout_reference_key = ${payoutReferenceKey} LIMIT 1
      `))[0];
      if (existing && Number(existing.withdrawal_id) !== withdrawalId) throw new Error("Payout reference has already been used for another withdrawal");
      throw new Error("Payout reference is already being processed");
    }
    throw error;
  }
}

export async function recoverWithdrawal(input: {
  withdrawalId: number;
  adminId: string;
  action: unknown;
  adminNotes?: unknown;
  payoutReference?: unknown;
}) {
  const action = String(input.action || "").trim().toLowerCase();
  if (action === "retry") return reviewWithdrawal({ ...input, status: "approved" });
  if (action === "refund") return reviewWithdrawal({ ...input, status: "rejected" });
  if (action === "confirm_paid") return reviewWithdrawal({ ...input, status: "paid" });
  throw new Error("Recovery action must be retry, refund, or confirm_paid");
}

export async function getWithdrawalIntegrityReport() {
  await ensureWithdrawalPayoutSchema();
  const rows = rowsOf(await db.execute(sql`
    SELECT wr.*, t.id AS hold_tx_id, t.status::text AS hold_tx_status,
      t.source_type AS hold_tx_source, t.amount AS hold_tx_amount,
      latest.status AS latest_attempt_status, latest.payout_reference_key AS latest_attempt_reference_key
    FROM app.withdrawal_requests wr
    LEFT JOIN app.transactions t ON t.id = wr.hold_transaction_id
    LEFT JOIN LATERAL (
      SELECT status, payout_reference_key FROM app.withdrawal_payout_attempts a
      WHERE a.withdrawal_id = wr.id ORDER BY attempt_no DESC LIMIT 1
    ) latest ON true
    ORDER BY wr.created_at DESC NULLS LAST, wr.id DESC
    LIMIT 1000
  `));

  const details = rows.map((row: any) => {
    const status = String(row.status || "pending");
    const amount = toMoney(row.amount);
    const flags: string[] = [];
    if (!row.hold_tx_id) flags.push("missing_hold_transaction");
    if (["pending", "approved", "failed"].includes(status) && row.hold_tx_id
      && (String(row.hold_tx_status) !== "pending" || String(row.hold_tx_source) !== "withdrawal_hold" || toMoney(row.hold_tx_amount) !== 0)) flags.push("active_hold_ledger_mismatch");
    if (status === "paid" && (String(row.hold_tx_status) !== "completed" || String(row.hold_tx_source) !== "withdrawal_settlement" || toMoney(row.hold_tx_amount) !== -amount)) flags.push("paid_ledger_mismatch");
    if (status === "paid" && !row.payout_reference_key) flags.push("paid_without_payout_reference");
    if (status === "paid" && String(row.latest_attempt_status || "") !== "paid") flags.push("paid_without_paid_attempt");
    if (status === "rejected" && (String(row.hold_tx_status) !== "rejected" || String(row.hold_tx_source) !== "withdrawal_refund" || toMoney(row.hold_tx_amount) !== 0)) flags.push("rejected_ledger_mismatch");
    if (status === "failed" && String(row.latest_attempt_status || "") !== "failed") flags.push("failed_without_failed_attempt");
    return { withdrawalId: Number(row.id), userId: String(row.user_id || ""), status, amount, flags };
  });

  const shortfalls = rowsOf(await db.execute(sql`
    SELECT active.user_id, active.required_locked::float AS required_locked,
      coalesce(w.locked_balance, 0)::float AS wallet_locked
    FROM (
      SELECT user_id, sum(amount)::float AS required_locked
      FROM app.withdrawal_requests
      WHERE status::text IN ('pending', 'approved', 'failed')
      GROUP BY user_id
    ) active
    LEFT JOIN app.wallets w ON w.user_id = active.user_id
    WHERE coalesce(w.locked_balance, 0) + 0.005 < active.required_locked
  `)).map((row: any) => ({ userId: String(row.user_id), requiredLocked: toMoney(row.required_locked), walletLocked: toMoney(row.wallet_locked) }));

  const duplicateReferences = rowsOf(await db.execute(sql`
    SELECT payout_reference_key, count(*)::int AS uses
    FROM app.withdrawal_payout_attempts
    WHERE payout_reference_key IS NOT NULL
    GROUP BY payout_reference_key HAVING count(*) > 1
  `));
  const reviewRows = details.filter((row: any) => row.flags.length > 0);
  return {
    summary: {
      withdrawalsChecked: details.length,
      reviewWithdrawals: reviewRows.length,
      lockedBalanceShortfalls: shortfalls.length,
      duplicatePayoutReferences: duplicateReferences.length,
      paidWithoutReference: details.filter((row: any) => row.flags.includes("paid_without_payout_reference")).length,
      failedWithoutAttempt: details.filter((row: any) => row.flags.includes("failed_without_failed_attempt")).length,
    },
    rows: reviewRows,
    lockedBalanceShortfalls: shortfalls,
    duplicatePayoutReferences: duplicateReferences,
  };
}

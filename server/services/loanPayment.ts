import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { postWalletAmountExactlyOnce } from "./walletPosting.js";

export interface LoanPaymentDetails {
  loanId: number;
  cardId: number;
  ownerId: string;
  borrowerId: string;
  gross: number;
  fee: number;
  ownerReceives: number;
}

export interface LoanPaymentLinks {
  borrowerPostingKey?: string | null;
  borrowerTransactionId?: number | null;
  ownerPostingKey?: string | null;
  ownerTransactionId?: number | null;
  paymentCompletedAt?: unknown;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

export function toLoanMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Loan payment amount must be finite");
  return Math.round(amount * 100) / 100;
}

function validateLoanPayment(details: LoanPaymentDetails): LoanPaymentDetails {
  const normalized = {
    loanId: Number(details.loanId),
    cardId: Number(details.cardId),
    ownerId: String(details.ownerId || "").trim(),
    borrowerId: String(details.borrowerId || "").trim(),
    gross: toLoanMoney(details.gross),
    fee: toLoanMoney(details.fee),
    ownerReceives: toLoanMoney(details.ownerReceives),
  };
  if (!Number.isInteger(normalized.loanId) || normalized.loanId <= 0) throw new Error("Loan payment identifier is invalid");
  if (!Number.isInteger(normalized.cardId) || normalized.cardId <= 0) throw new Error("Loan payment card identifier is invalid");
  if (!normalized.ownerId || !normalized.borrowerId || normalized.ownerId === normalized.borrowerId) throw new Error("Loan payment parties are invalid");
  if (normalized.gross <= 0 || normalized.fee < 0 || normalized.ownerReceives <= 0) throw new Error("Loan payment breakdown is invalid");
  if (toLoanMoney(normalized.fee + normalized.ownerReceives) !== normalized.gross) throw new Error("Loan payment breakdown does not reconcile");
  return normalized;
}

export function loanBorrowerPostingKey(loanId: number): string {
  if (!Number.isInteger(loanId) || loanId <= 0) throw new Error("Loan payment identifier is invalid");
  return `loan:${loanId}:borrower-debit`;
}

export function loanOwnerPostingKey(loanId: number): string {
  if (!Number.isInteger(loanId) || loanId <= 0) throw new Error("Loan payment identifier is invalid");
  return `loan:${loanId}:owner-credit`;
}

function borrowerDescription(details: LoanPaymentDetails): string {
  return `loan:${details.loanId} card:${details.cardId} borrower:${details.borrowerId} owner:${details.ownerId} gross:${details.gross.toFixed(2)}`;
}

function ownerDescription(details: LoanPaymentDetails): string {
  return `loan:${details.loanId} card:${details.cardId} borrower:${details.borrowerId} owner:${details.ownerId} gross:${details.gross.toFixed(2)} fee:${details.fee.toFixed(2)}`;
}

async function verifyPostingClaim(tx: any, expected: {
  postingKey: string;
  userId: string;
  amount: number;
  transactionType: string;
  sourceType: string;
}) {
  const row = rowsOf(await tx.execute(sql`
    SELECT claims.id AS "claimId", claims.posting_key AS "postingKey", claims.user_id AS "claimUserId",
      coalesce(claims.amount, 0)::float AS "claimAmount", claims.transaction_type AS "claimTransactionType",
      claims.source_type AS "claimSourceType", claims.transaction_id AS "claimTransactionId",
      claims.completed_at AS "claimCompletedAt", txrow.id AS "transactionId", txrow.user_id AS "transactionUserId",
      coalesce(txrow.amount, 0)::float AS "transactionAmount", txrow.type::text AS "transactionType",
      coalesce(txrow.source_type, '') AS "transactionSourceType", coalesce(txrow.status::text, '') AS "transactionStatus",
      coalesce(txrow.external_transaction_id, '') AS "externalTransactionId"
    FROM app.wallet_posting_claims claims
    LEFT JOIN app.transactions txrow ON txrow.id = claims.transaction_id
    WHERE claims.posting_key = ${expected.postingKey}
    FOR UPDATE OF claims
  `))[0];
  if (!row) throw new Error("Loan payment posting claim is missing and requires integrity review");
  if (String(row.claimUserId || "") !== expected.userId || toLoanMoney(row.claimAmount) !== toLoanMoney(expected.amount)) {
    throw new Error("Loan payment posting claim does not match its party or amount");
  }
  if (String(row.claimTransactionType || "") !== expected.transactionType || String(row.claimSourceType || "") !== expected.sourceType) {
    throw new Error("Loan payment posting claim has an invalid type");
  }
  if (!row.claimCompletedAt || !row.claimTransactionId || !row.transactionId) throw new Error("Loan payment posting claim is incomplete");
  if (String(row.transactionUserId || "") !== expected.userId || toLoanMoney(row.transactionAmount) !== toLoanMoney(expected.amount)) {
    throw new Error("Loan payment ledger row does not match its claim");
  }
  if (String(row.transactionType || "") !== expected.transactionType || String(row.transactionSourceType || "") !== expected.sourceType) {
    throw new Error("Loan payment ledger row has an invalid type");
  }
  if (String(row.transactionStatus || "") !== "completed" || String(row.externalTransactionId || "") !== expected.postingKey) {
    throw new Error("Loan payment ledger row is not in the required completed state");
  }
  return { postingKey: expected.postingKey, claimId: Number(row.claimId), transactionId: Number(row.transactionId), replayed: true };
}

export async function postLoanPaymentExactlyOnce(tx: any, rawDetails: LoanPaymentDetails) {
  const details = validateLoanPayment(rawDetails);
  const borrowerPostingKey = loanBorrowerPostingKey(details.loanId);
  const ownerPostingKey = loanOwnerPostingKey(details.loanId);
  const metadata = { loanId: details.loanId, cardId: details.cardId, ownerId: details.ownerId, borrowerId: details.borrowerId };

  const borrower = await postWalletAmountExactlyOnce(tx, {
    postingKey: borrowerPostingKey,
    userId: details.borrowerId,
    amount: -details.gross,
    transactionType: "purchase" as any,
    sourceType: "card_loan_accept",
    description: borrowerDescription(details),
    actorUserId: details.borrowerId,
    reason: "Card loan borrower debit",
    metadata: { ...metadata, role: "borrower" },
    grossAmount: details.gross,
    feeAmount: 0,
    netAmount: -details.gross,
    auditAction: "loan.payment.borrower_debited",
  });
  const owner = await postWalletAmountExactlyOnce(tx, {
    postingKey: ownerPostingKey,
    userId: details.ownerId,
    amount: details.ownerReceives,
    transactionType: "sale" as any,
    sourceType: "card_loan_income",
    description: ownerDescription(details),
    actorUserId: details.borrowerId,
    reason: "Card loan lender credit",
    metadata: { ...metadata, role: "owner", fee: details.fee },
    grossAmount: details.gross,
    feeAmount: details.fee,
    netAmount: details.ownerReceives,
    auditAction: "loan.payment.owner_credited",
  });

  return { details, borrower, owner, replayed: borrower.replayed && owner.replayed };
}

export async function verifyLoanPaymentExactlyOnce(tx: any, rawDetails: LoanPaymentDetails, links: LoanPaymentLinks) {
  const details = validateLoanPayment(rawDetails);
  const borrowerPostingKey = loanBorrowerPostingKey(details.loanId);
  const ownerPostingKey = loanOwnerPostingKey(details.loanId);
  const borrower = await verifyPostingClaim(tx, {
    postingKey: borrowerPostingKey,
    userId: details.borrowerId,
    amount: -details.gross,
    transactionType: "purchase",
    sourceType: "card_loan_accept",
  });
  const owner = await verifyPostingClaim(tx, {
    postingKey: ownerPostingKey,
    userId: details.ownerId,
    amount: details.ownerReceives,
    transactionType: "sale",
    sourceType: "card_loan_income",
  });
  if (String(links.borrowerPostingKey || "") !== borrowerPostingKey || Number(links.borrowerTransactionId || 0) !== borrower.transactionId) {
    throw new Error("Loan borrower payment links do not match their posting claim");
  }
  if (String(links.ownerPostingKey || "") !== ownerPostingKey || Number(links.ownerTransactionId || 0) !== owner.transactionId) {
    throw new Error("Loan owner payment links do not match their posting claim");
  }
  if (!links.paymentCompletedAt) throw new Error("Loan payment completion timestamp is missing");
  return { details, borrower, owner, replayed: true };
}

export async function getLoanPaymentIntegrityReport() {
  const loans = rowsOf(await db.execute(sql`
    SELECT l.id AS "loanId", l.card_id AS "cardId", l.original_owner_id AS "ownerId",
      l.borrower_user_id AS "borrowerId", l.status, coalesce(l.gross_amount, 0)::float AS gross,
      coalesce(l.fee_amount, 0)::float AS fee, coalesce(l.owner_receives, 0)::float AS "ownerReceives",
      l.borrower_posting_key AS "borrowerPostingKey", l.borrower_transaction_id AS "borrowerTransactionId",
      l.owner_posting_key AS "ownerPostingKey", l.owner_transaction_id AS "ownerTransactionId",
      l.payment_completed_at AS "paymentCompletedAt",
      borrower_claim.user_id AS "borrowerClaimUserId", coalesce(borrower_claim.amount, 0)::float AS "borrowerClaimAmount",
      borrower_claim.transaction_type AS "borrowerClaimType", borrower_claim.source_type AS "borrowerClaimSource",
      borrower_claim.transaction_id AS "borrowerClaimTransactionId", borrower_claim.completed_at AS "borrowerClaimCompletedAt",
      owner_claim.user_id AS "ownerClaimUserId", coalesce(owner_claim.amount, 0)::float AS "ownerClaimAmount",
      owner_claim.transaction_type AS "ownerClaimType", owner_claim.source_type AS "ownerClaimSource",
      owner_claim.transaction_id AS "ownerClaimTransactionId", owner_claim.completed_at AS "ownerClaimCompletedAt"
    FROM app.card_loans l
    LEFT JOIN app.wallet_posting_claims borrower_claim ON borrower_claim.posting_key = concat('loan:', l.id, ':borrower-debit')
    LEFT JOIN app.wallet_posting_claims owner_claim ON owner_claim.posting_key = concat('loan:', l.id, ':owner-credit')
    WHERE l.status IN ('active', 'returned') AND l.borrower_user_id IS NOT NULL AND coalesce(l.gross_amount, 0) > 0
    ORDER BY l.id DESC
  `));

  const issues: any[] = [];
  for (const loan of loans) {
    const loanId = Number(loan.loanId);
    const expectedBorrowerKey = loanBorrowerPostingKey(loanId);
    const expectedOwnerKey = loanOwnerPostingKey(loanId);
    const gross = toLoanMoney(loan.gross);
    const fee = toLoanMoney(loan.fee);
    const ownerReceives = toLoanMoney(loan.ownerReceives);
    const flags: string[] = [];
    if (toLoanMoney(fee + ownerReceives) !== gross) flags.push("loan_breakdown_mismatch");
    if (!loan.borrowerClaimTransactionId) flags.push("missing_borrower_payment_claim");
    if (!loan.ownerClaimTransactionId) flags.push("missing_owner_payment_claim");
    if (String(loan.borrowerPostingKey || "") !== expectedBorrowerKey) flags.push("borrower_posting_key_mismatch");
    if (String(loan.ownerPostingKey || "") !== expectedOwnerKey) flags.push("owner_posting_key_mismatch");
    if (Number(loan.borrowerTransactionId || 0) !== Number(loan.borrowerClaimTransactionId || 0)) flags.push("borrower_transaction_link_mismatch");
    if (Number(loan.ownerTransactionId || 0) !== Number(loan.ownerClaimTransactionId || 0)) flags.push("owner_transaction_link_mismatch");
    if (String(loan.borrowerClaimUserId || "") !== String(loan.borrowerId || "")) flags.push("borrower_claim_user_mismatch");
    if (String(loan.ownerClaimUserId || "") !== String(loan.ownerId || "")) flags.push("owner_claim_user_mismatch");
    if (loan.borrowerClaimTransactionId && toLoanMoney(loan.borrowerClaimAmount) !== -gross) flags.push("borrower_claim_amount_mismatch");
    if (loan.ownerClaimTransactionId && toLoanMoney(loan.ownerClaimAmount) !== ownerReceives) flags.push("owner_claim_amount_mismatch");
    if (loan.borrowerClaimTransactionId && (String(loan.borrowerClaimType) !== "purchase" || String(loan.borrowerClaimSource) !== "card_loan_accept")) flags.push("borrower_claim_type_mismatch");
    if (loan.ownerClaimTransactionId && (String(loan.ownerClaimType) !== "sale" || String(loan.ownerClaimSource) !== "card_loan_income")) flags.push("owner_claim_type_mismatch");
    if (loan.borrowerClaimTransactionId && !loan.borrowerClaimCompletedAt) flags.push("borrower_claim_incomplete");
    if (loan.ownerClaimTransactionId && !loan.ownerClaimCompletedAt) flags.push("owner_claim_incomplete");
    if (!loan.paymentCompletedAt) flags.push("loan_payment_completion_missing");
    if (flags.length) issues.push({ loanId, cardId: Number(loan.cardId), ownerId: loan.ownerId, borrowerId: loan.borrowerId, gross, fee, ownerReceives, flags });
  }

  const orphanedClaims = rowsOf(await db.execute(sql`
    SELECT claims.id AS "claimId", claims.posting_key AS "postingKey", claims.user_id AS "userId",
      coalesce(claims.amount, 0)::float AS amount, claims.source_type AS "sourceType",
      claims.metadata ->> 'loanId' AS "loanId"
    FROM app.wallet_posting_claims claims
    LEFT JOIN app.card_loans l ON l.id = CASE WHEN (claims.metadata ->> 'loanId') ~ '^[0-9]+$' THEN (claims.metadata ->> 'loanId')::int ELSE NULL END
    WHERE claims.source_type IN ('card_loan_accept', 'card_loan_income') AND l.id IS NULL
    ORDER BY claims.id DESC
  `));
  for (const claim of orphanedClaims) {
    issues.push({ postingKey: claim.postingKey, claimId: Number(claim.claimId), loanId: Number(claim.loanId || 0) || null, userId: claim.userId, amount: toLoanMoney(claim.amount), flags: ["orphaned_loan_payment_claim"] });
  }

  const unclaimedTransactions = rowsOf(await db.execute(sql`
    SELECT t.id AS "transactionId", t.user_id AS "userId", coalesce(t.amount, 0)::float AS amount,
      t.type::text AS type, coalesce(t.source_type, '') AS "sourceType",
      substring(coalesce(t.description, '') from 'loan:([0-9]+)') AS "loanId"
    FROM app.transactions t
    LEFT JOIN app.wallet_posting_claims claims ON claims.transaction_id = t.id
    WHERE coalesce(t.source_type, '') IN ('card_loan_accept', 'card_loan_income')
      AND claims.id IS NULL
    ORDER BY t.id DESC
  `));

  const duplicateLegacyTransactions = rowsOf(await db.execute(sql`
    SELECT substring(coalesce(description, '') from 'loan:([0-9]+)') AS "loanId",
      coalesce(source_type, '') AS "sourceType", user_id AS "userId", count(*)::int AS count,
      array_agg(id ORDER BY id) AS "transactionIds"
    FROM app.transactions
    WHERE coalesce(source_type, '') IN ('card_loan_accept', 'card_loan_income')
    GROUP BY substring(coalesce(description, '') from 'loan:([0-9]+)'), coalesce(source_type, ''), user_id
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      paidLoans: loans.length,
      issues: issues.length,
      orphanedClaims: orphanedClaims.length,
      unclaimedTransactions: unclaimedTransactions.length,
      duplicateLegacyTransactions: duplicateLegacyTransactions.length,
    },
    issues,
    orphanedClaims,
    unclaimedTransactions,
    duplicateLegacyTransactions,
  };
}

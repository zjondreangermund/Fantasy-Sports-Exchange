import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

export type WalletPostingTransactionType = "tournament_payout" | "admin_adjustment" | "bonus_credit" | "prize";

export interface WalletPostingInput {
  postingKey: string;
  userId: string;
  amount: number;
  transactionType: WalletPostingTransactionType;
  sourceType: string;
  description: string;
  actorUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  grossAmount?: number;
  feeAmount?: number;
  netAmount?: number;
  bindActor?: boolean;
  auditAction?: string;
}

export interface WalletPostingResult {
  postingKey: string;
  claimId: number;
  transactionId: number;
  balance: number;
  replayed: boolean;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

export function toPostingMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Wallet posting amount must be finite");
  return Math.round(amount * 100) / 100;
}

export function validatePostingKey(raw: unknown): string {
  const key = String(raw || "").trim();
  if (key.length < 8 || key.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9:._-]+$/.test(key)) {
    throw new Error("Wallet posting key is invalid");
  }
  return key;
}

export function tournamentPayoutPostingKey(competitionId: number, entryId: number): string {
  if (!Number.isInteger(competitionId) || competitionId <= 0 || !Number.isInteger(entryId) || entryId <= 0) {
    throw new Error("Tournament payout identifiers are invalid");
  }
  return `tournament:${competitionId}:entry:${entryId}:cash`;
}

export function adminAdjustmentPostingKey(adminId: string, rawRequestKey: unknown): string {
  const requestKey = String(rawRequestKey || "").trim();
  if (!adminId || requestKey.length < 8 || requestKey.length > 200) {
    throw new Error("A valid Idempotency-Key is required for wallet adjustments");
  }
  const digest = createHash("sha256").update(`${adminId}\u0000${requestKey}`).digest("hex");
  return `admin-adjustment:${digest}`;
}

async function verifyExistingPosting(tx: any, input: WalletPostingInput): Promise<WalletPostingResult> {
  const postingKey = validatePostingKey(input.postingKey);
  const amount = toPostingMoney(input.amount);
  const existing = rowsOf(await tx.execute(sql`
    SELECT
      claims.id AS "claimId",
      claims.posting_key AS "postingKey",
      claims.user_id AS "claimUserId",
      coalesce(claims.amount, 0)::float AS "claimAmount",
      claims.transaction_type AS "claimTransactionType",
      claims.source_type AS "claimSourceType",
      claims.actor_user_id AS "claimActorUserId",
      claims.completed_at AS "claimCompletedAt",
      claims.transaction_id AS "claimTransactionId",
      txrow.id AS "transactionId",
      txrow.user_id AS "transactionUserId",
      coalesce(txrow.amount, 0)::float AS "transactionAmount",
      txrow.type::text AS "transactionType",
      coalesce(txrow.source_type, '') AS "transactionSourceType",
      coalesce(txrow.status::text, '') AS "transactionStatus",
      coalesce(txrow.external_transaction_id, '') AS "externalTransactionId",
      coalesce(wallet.balance, 0)::float AS balance
    FROM app.wallet_posting_claims claims
    LEFT JOIN app.transactions txrow ON txrow.id = claims.transaction_id
    LEFT JOIN app.wallets wallet ON wallet.user_id = claims.user_id
    WHERE claims.posting_key = ${postingKey}
    FOR UPDATE OF claims
  `))[0];

  if (!existing) throw new Error("Wallet posting claim disappeared during retry");
  if (String(existing.claimUserId) !== input.userId || toPostingMoney(existing.claimAmount) !== amount) {
    throw new Error("Wallet posting key was reused with different user or amount");
  }
  if (String(existing.claimTransactionType) !== input.transactionType || String(existing.claimSourceType) !== input.sourceType) {
    throw new Error("Wallet posting key was reused for a different posting type");
  }
  if (input.bindActor && String(existing.claimActorUserId || "") !== String(input.actorUserId || "")) {
    throw new Error("Wallet posting key was reused by a different administrator");
  }
  if (!existing.claimCompletedAt || !existing.claimTransactionId || !existing.transactionId) {
    throw new Error("Wallet posting claim is incomplete and requires integrity review");
  }
  if (String(existing.transactionUserId) !== input.userId || toPostingMoney(existing.transactionAmount) !== amount) {
    throw new Error("Wallet posting ledger row does not match its claim");
  }
  if (String(existing.transactionType) !== input.transactionType || String(existing.transactionSourceType) !== input.sourceType) {
    throw new Error("Wallet posting ledger type does not match its claim");
  }
  if (String(existing.transactionStatus) !== "completed" || String(existing.externalTransactionId) !== postingKey) {
    throw new Error("Wallet posting ledger row is not in the required completed state");
  }

  return {
    postingKey,
    claimId: Number(existing.claimId),
    transactionId: Number(existing.transactionId),
    balance: toPostingMoney(existing.balance || 0),
    replayed: true,
  };
}

export async function postWalletAmountExactlyOnce(tx: any, input: WalletPostingInput): Promise<WalletPostingResult> {
  const postingKey = validatePostingKey(input.postingKey);
  const userId = String(input.userId || "").trim();
  const actorUserId = input.actorUserId ? String(input.actorUserId).trim() : null;
  const amount = toPostingMoney(input.amount);
  if (!userId) throw new Error("Wallet posting user is required");
  if (amount === 0) throw new Error("Wallet posting amount cannot be zero");
  if (!input.sourceType || !input.description) throw new Error("Wallet posting source and description are required");

  const user = rowsOf(await tx.execute(sql`SELECT id FROM app.users WHERE id = ${userId} LIMIT 1`))[0];
  if (!user) throw new Error(`Wallet posting user not found: ${userId}`);

  const inserted = rowsOf(await tx.execute(sql`
    INSERT INTO app.wallet_posting_claims
      (posting_key, user_id, amount, transaction_type, source_type, actor_user_id, reason, metadata)
    VALUES
      (${postingKey}, ${userId}, ${amount}, ${input.transactionType}, ${input.sourceType}, ${actorUserId},
       ${input.reason || null}, ${JSON.stringify(input.metadata || {})}::jsonb)
    ON CONFLICT (posting_key) DO NOTHING
    RETURNING id
  `))[0];

  if (!inserted) return verifyExistingPosting(tx, { ...input, postingKey, userId, amount, actorUserId });

  await tx.execute(sql`
    INSERT INTO app.wallets (user_id, balance, locked_balance)
    VALUES (${userId}, 0, 0)
    ON CONFLICT (user_id) DO NOTHING
  `);

  const wallet = amount > 0
    ? rowsOf(await tx.execute(sql`
        UPDATE app.wallets SET balance = balance + ${amount}
        WHERE user_id = ${userId}
        RETURNING coalesce(balance, 0)::float AS balance
      `))[0]
    : rowsOf(await tx.execute(sql`
        UPDATE app.wallets SET balance = balance + ${amount}
        WHERE user_id = ${userId} AND balance >= ${Math.abs(amount)}
        RETURNING coalesce(balance, 0)::float AS balance
      `))[0];
  if (!wallet) throw new Error(amount < 0 ? "Insufficient available balance for wallet adjustment" : "Wallet posting failed to update balance");

  const grossAmount = toPostingMoney(input.grossAmount ?? Math.abs(amount));
  const feeAmount = toPostingMoney(input.feeAmount ?? 0);
  const netAmount = toPostingMoney(input.netAmount ?? amount);
  const transaction = rowsOf(await tx.execute(sql`
    INSERT INTO app.transactions
      (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, status, description, external_transaction_id)
    VALUES
      (${userId}, ${input.transactionType}, ${amount}, ${grossAmount}, ${feeAmount}, ${netAmount},
       ${input.sourceType}, 'completed', ${input.description}, ${postingKey})
    RETURNING id
  `))[0];
  if (!transaction?.id) throw new Error("Wallet posting ledger transaction was not created");

  await tx.execute(sql`
    UPDATE app.wallet_posting_claims
    SET transaction_id = ${Number(transaction.id)}, completed_at = now()
    WHERE id = ${Number(inserted.id)} AND transaction_id IS NULL
  `);

  await tx.execute(sql`
    INSERT INTO app.audit_logs (user_id, action, meta)
    VALUES (
      ${actorUserId || userId},
      ${input.auditAction || "wallet.posting.completed"},
      ${JSON.stringify({ postingKey, targetUserId: userId, amount, transactionType: input.transactionType, sourceType: input.sourceType, ...(input.metadata || {}) })}::jsonb
    )
  `);

  return {
    postingKey,
    claimId: Number(inserted.id),
    transactionId: Number(transaction.id),
    balance: toPostingMoney(wallet.balance || 0),
    replayed: false,
  };
}

export async function getWalletPostingIntegrityReport() {
  const claims = rowsOf(await db.execute(sql`
    SELECT
      claims.id, claims.posting_key AS "postingKey", claims.user_id AS "userId",
      coalesce(claims.amount, 0)::float AS amount, claims.transaction_type AS "transactionType",
      claims.source_type AS "sourceType", claims.actor_user_id AS "actorUserId",
      claims.transaction_id AS "transactionId", claims.completed_at AS "completedAt",
      txrow.user_id AS "transactionUserId", coalesce(txrow.amount, 0)::float AS "transactionAmount",
      txrow.type::text AS "ledgerType", coalesce(txrow.source_type, '') AS "ledgerSourceType",
      coalesce(txrow.status::text, '') AS "ledgerStatus",
      coalesce(txrow.external_transaction_id, '') AS "externalTransactionId"
    FROM app.wallet_posting_claims claims
    LEFT JOIN app.transactions txrow ON txrow.id = claims.transaction_id
    ORDER BY claims.id DESC
  `));

  const issues: any[] = [];
  const claimByKey = new Map<string, any>();
  for (const claim of claims) {
    const postingKey = String(claim.postingKey || "");
    claimByKey.set(postingKey, claim);
    const flags: string[] = [];
    if (!claim.transactionId || !claim.completedAt) flags.push("incomplete_claim");
    if (String(claim.transactionUserId || "") !== String(claim.userId || "")) flags.push("transaction_user_mismatch");
    if (toPostingMoney(claim.transactionAmount || 0) !== toPostingMoney(claim.amount || 0)) flags.push("transaction_amount_mismatch");
    if (String(claim.ledgerType || "") !== String(claim.transactionType || "")) flags.push("transaction_type_mismatch");
    if (String(claim.ledgerSourceType || "") !== String(claim.sourceType || "")) flags.push("source_type_mismatch");
    if (String(claim.ledgerStatus || "") !== "completed") flags.push("transaction_not_completed");
    if (String(claim.externalTransactionId || "") !== postingKey) flags.push("external_reference_mismatch");
    if (flags.length) issues.push({ postingKey, claimId: Number(claim.id), userId: claim.userId, amount: toPostingMoney(claim.amount), flags });
  }

  const tournamentEntries = rowsOf(await db.execute(sql`
    SELECT ce.id AS "entryId", ce.competition_id AS "competitionId", ce.user_id AS "userId",
      coalesce(ce.prize_amount, 0)::float AS "prizeAmount", ce.payout_posting_key AS "payoutPostingKey",
      ce.payout_transaction_id AS "payoutTransactionId", c.status::text AS "competitionStatus"
    FROM app.competition_entries ce
    JOIN app.competitions c ON c.id = ce.competition_id
    WHERE c.status::text = 'completed' AND coalesce(ce.prize_amount, 0) > 0
    ORDER BY ce.competition_id DESC, ce.id
  `));
  for (const entry of tournamentEntries) {
    const expectedKey = tournamentPayoutPostingKey(Number(entry.competitionId), Number(entry.entryId));
    const claim = claimByKey.get(expectedKey);
    const flags: string[] = [];
    if (!claim) flags.push("missing_tournament_payout_claim");
    if (String(entry.payoutPostingKey || "") !== expectedKey) flags.push("entry_posting_key_mismatch");
    if (claim && Number(entry.payoutTransactionId || 0) !== Number(claim.transactionId || 0)) flags.push("entry_transaction_link_mismatch");
    if (claim && toPostingMoney(entry.prizeAmount) !== toPostingMoney(claim.amount)) flags.push("entry_prize_amount_mismatch");
    if (flags.length) issues.push({ postingKey: expectedKey, entryId: Number(entry.entryId), competitionId: Number(entry.competitionId), userId: entry.userId, amount: toPostingMoney(entry.prizeAmount), flags });
  }

  const duplicateExternalReferences = rowsOf(await db.execute(sql`
    SELECT external_transaction_id AS "postingKey", count(*)::int AS count, array_agg(id ORDER BY id) AS "transactionIds"
    FROM app.transactions
    WHERE external_transaction_id IN (SELECT posting_key FROM app.wallet_posting_claims)
    GROUP BY external_transaction_id
    HAVING count(*) > 1
  `));
  const duplicateLegacyTournamentPayouts = rowsOf(await db.execute(sql`
    SELECT user_id AS "userId",
      substring(coalesce(description, '') from 'competition:([0-9]+)') AS "competitionId",
      substring(coalesce(description, '') from 'rank:([0-9]+)') AS rank,
      count(*)::int AS count, array_agg(id ORDER BY id) AS "transactionIds"
    FROM app.transactions
    WHERE type::text = 'tournament_payout' AND coalesce(source_type, '') = 'tournament_settlement'
    GROUP BY user_id,
      substring(coalesce(description, '') from 'competition:([0-9]+)'),
      substring(coalesce(description, '') from 'rank:([0-9]+)')
    HAVING count(*) > 1
  `));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      claims: claims.length,
      tournamentCashWinners: tournamentEntries.length,
      issues: issues.length,
      duplicateExternalReferences: duplicateExternalReferences.length,
      duplicateLegacyTournamentPayouts: duplicateLegacyTournamentPayouts.length,
    },
    issues,
    duplicateExternalReferences,
    duplicateLegacyTournamentPayouts,
  };
}

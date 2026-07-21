import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { postWalletAmountExactlyOnce, toPostingMoney } from "./walletPosting.js";
import { ensureForgeOperationSchema } from "./forgeOperationSchema.js";

export const COMMON_FORGE_BURN_COUNT = 5;
export const COMMON_TO_RARE_FORGE_FEE = 10;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

export function normalizeForgeCardIds(raw: unknown): number[] {
  const values = Array.isArray(raw) ? raw : [];
  return Array.from(new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))).sort((a, b) => a - b);
}

export function forgeSourceSignature(userId: string, cardIds: number[]): string {
  const normalized = normalizeForgeCardIds(cardIds);
  if (!userId || normalized.length !== COMMON_FORGE_BURN_COUNT) throw new Error(`Exactly ${COMMON_FORGE_BURN_COUNT} common cards are required`);
  return `${userId}|${normalized.join("-")}`;
}

export function forgeOperationKey(sourceSignature: string): string {
  return `forge:${createHash("sha256").update(sourceSignature).digest("hex")}`;
}

export function forgeFeePostingKey(operationId: number): string {
  if (!Number.isInteger(operationId) || operationId <= 0) throw new Error("Forge operation ID is invalid");
  return `forge:${operationId}:fee`;
}

async function findBlockedCards(executor: any, userId: string, cardIds: number[]) {
  if (!cardIds.length) return [];
  return rowsOf(await executor.execute(sql`
    SELECT DISTINCT blocked.card_id AS "cardId", blocked.reason
    FROM (
      SELECT cl.card_id, 'competition_lock'::text AS reason
      FROM app.card_locks cl
      WHERE cl.card_id = ANY(${cardIds}::int[])
        AND (cl.expires_at IS NULL OR cl.expires_at > now())
      UNION ALL
      SELECT a.card_id, 'auction'::text AS reason
      FROM app.auctions a
      WHERE a.card_id = ANY(${cardIds}::int[]) AND a.status::text IN ('draft', 'live')
      UNION ALL
      SELECT so.offered_card_id, 'pending_swap'::text AS reason
      FROM app.swap_offers so
      WHERE so.offered_card_id = ANY(${cardIds}::int[]) AND so.status::text = 'pending'
      UNION ALL
      SELECT so.requested_card_id, 'pending_swap'::text AS reason
      FROM app.swap_offers so
      WHERE so.requested_card_id = ANY(${cardIds}::int[]) AND so.status::text = 'pending'
      UNION ALL
      SELECT l.card_id, 'loan'::text AS reason
      FROM app.card_loans l
      WHERE l.card_id = ANY(${cardIds}::int[]) AND l.status IN ('open', 'active')
      UNION ALL
      SELECT lineup_card.value::int AS card_id, 'active_lineup'::text AS reason
      FROM app.lineups lineup
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(lineup.card_ids) = 'array' THEN lineup.card_ids ELSE '[]'::jsonb END
      ) AS lineup_card(value)
      WHERE lineup.user_id = ${userId} AND lineup_card.value::int = ANY(${cardIds}::int[])
    ) blocked
    ORDER BY blocked.card_id, blocked.reason
  `));
}

export async function getBlockedForgeCardIds(userId: string, cardIds: number[]): Promise<Set<number>> {
  const blocked = await findBlockedCards(db, userId, normalizeForgeCardIds(cardIds));
  return new Set(blocked.map((row) => Number(row.cardId)).filter((value) => Number.isInteger(value) && value > 0));
}

async function loadForgeOperation(tx: any, sourceSignature: string, lock = false) {
  const result = await tx.execute(sql`
    SELECT *
    FROM app.forge_operations
    WHERE source_signature = ${sourceSignature}
    ${lock ? sql`FOR UPDATE` : sql``}
  `);
  return rowsOf(result)[0] || null;
}

async function verifyCompletedForgeOperation(tx: any, operation: any) {
  const operationId = Number(operation.id);
  const detail = rowsOf(await tx.execute(sql`
    SELECT
      op.*,
      minted.id AS "mintedId",
      minted.player_id AS "mintedPlayerId",
      minted.rarity::text AS "mintedRarity",
      claim.id AS "claimId",
      claim.user_id AS "claimUserId",
      coalesce(claim.amount, 0)::float AS "claimAmount",
      claim.transaction_type AS "claimTransactionType",
      claim.source_type AS "claimSourceType",
      claim.transaction_id AS "claimTransactionId",
      claim.completed_at AS "claimCompletedAt",
      ledger.user_id AS "ledgerUserId",
      coalesce(ledger.amount, 0)::float AS "ledgerAmount",
      ledger.type::text AS "ledgerType",
      coalesce(ledger.source_type, '') AS "ledgerSourceType",
      coalesce(ledger.status::text, '') AS "ledgerStatus",
      coalesce(ledger.external_transaction_id, '') AS "ledgerExternalId",
      coalesce((SELECT array_agg(item.card_id ORDER BY item.card_id) FROM app.forge_burn_items item WHERE item.operation_id = op.id), ARRAY[]::int[]) AS "burnedCardIds",
      coalesce((SELECT count(*)::int FROM app.forge_burn_items item WHERE item.operation_id = op.id), 0) AS "burnedCount",
      coalesce((SELECT count(*)::int FROM app.forge_burn_items item JOIN app.player_cards source ON source.id = item.card_id WHERE item.operation_id = op.id AND (source.owner_id IS NOT NULL OR source.for_sale)), 0) AS "reactivatedBurnedCount"
    FROM app.forge_operations op
    LEFT JOIN app.player_cards minted ON minted.id = op.minted_card_id
    LEFT JOIN app.wallet_posting_claims claim ON claim.posting_key = op.fee_posting_key
    LEFT JOIN app.transactions ledger ON ledger.id = op.fee_transaction_id
    WHERE op.id = ${operationId}
    FOR UPDATE OF op
  `))[0];
  if (!detail) throw new Error("Forge operation disappeared during verification");

  const expectedIds = normalizeForgeCardIds(detail.source_card_ids);
  const burnedIds = normalizeForgeCardIds(detail.burnedCardIds);
  const expectedFeeKey = forgeFeePostingKey(operationId);
  const expectedOperationKey = forgeOperationKey(String(detail.source_signature || ""));
  const fee = toPostingMoney(detail.fee_amount || 0);
  const issues: string[] = [];
  if (String(detail.status) !== "completed" || !detail.completed_at) issues.push("operation_not_completed");
  if (String(detail.operation_key) !== expectedOperationKey) issues.push("operation_key_mismatch");
  if (expectedIds.length !== COMMON_FORGE_BURN_COUNT || burnedIds.join(",") !== expectedIds.join(",")) issues.push("burned_card_links_mismatch");
  if (Number(detail.burnedCount) !== COMMON_FORGE_BURN_COUNT) issues.push("burned_card_count_mismatch");
  if (Number(detail.reactivatedBurnedCount) > 0) issues.push("burned_card_reactivated");
  if (!detail.mintedId || Number(detail.mintedPlayerId) !== Number(detail.player_id) || String(detail.mintedRarity) !== "rare") issues.push("minted_card_mismatch");
  if (String(detail.fee_posting_key || "") !== expectedFeeKey) issues.push("fee_posting_key_mismatch");
  if (!detail.claimId || !detail.claimCompletedAt) issues.push("fee_claim_missing_or_incomplete");
  if (String(detail.claimUserId || "") !== String(detail.user_id || "") || toPostingMoney(detail.claimAmount || 0) !== -fee) issues.push("fee_claim_value_mismatch");
  if (String(detail.claimTransactionType || "") !== "swap_fee" || String(detail.claimSourceType || "") !== "forge_burn") issues.push("fee_claim_type_mismatch");
  if (Number(detail.claimTransactionId || 0) !== Number(detail.fee_transaction_id || 0)) issues.push("fee_claim_transaction_link_mismatch");
  if (String(detail.ledgerUserId || "") !== String(detail.user_id || "") || toPostingMoney(detail.ledgerAmount || 0) !== -fee) issues.push("fee_ledger_value_mismatch");
  if (String(detail.ledgerType || "") !== "swap_fee" || String(detail.ledgerSourceType || "") !== "forge_burn" || String(detail.ledgerStatus || "") !== "completed") issues.push("fee_ledger_state_mismatch");
  if (String(detail.ledgerExternalId || "") !== expectedFeeKey) issues.push("fee_ledger_external_reference_mismatch");
  if (issues.length) throw new Error(`Forge operation integrity verification failed: ${issues.join(", ")}`);

  return {
    operationId,
    mintedCardId: Number(detail.mintedId),
    playerId: Number(detail.player_id),
    fee,
    replayed: true,
  };
}

export async function executeCommonToRareForge(tx: any, input: { userId: string; cardIds: number[] }) {
  await ensureForgeOperationSchema();
  const userId = String(input.userId || "").trim();
  const cardIds = normalizeForgeCardIds(input.cardIds);
  const sourceSignature = forgeSourceSignature(userId, cardIds);
  const operationKey = forgeOperationKey(sourceSignature);

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sourceSignature}))`);
  const existing = await loadForgeOperation(tx, sourceSignature, true);
  if (existing) return verifyCompletedForgeOperation(tx, existing);

  const cards = rowsOf(await tx.execute(sql`
    SELECT pc.id, pc.player_id AS "playerId", pc.owner_id AS "ownerId", pc.rarity::text AS rarity, pc.for_sale AS "forSale"
    FROM app.player_cards pc
    WHERE pc.id = ANY(${cardIds}::int[])
    ORDER BY pc.id
    FOR UPDATE
  `));
  if (cards.length !== COMMON_FORGE_BURN_COUNT) throw new Error("Some forge cards were not found");
  const playerId = Number(cards[0].playerId);
  if (!Number.isInteger(playerId) || playerId <= 0) throw new Error("Forge player is invalid");

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}), ${playerId})`);
  if (!cards.every((card) => Number(card.playerId) === playerId)) throw new Error("All 5 cards must be the same player");
  if (!cards.every((card) => String(card.ownerId || "") === userId)) throw new Error("You can only burn cards you own");
  if (!cards.every((card) => String(card.rarity || "") === "common")) throw new Error("Only common cards can be burned for this forge step");
  if (cards.some((card) => Boolean(card.forSale))) throw new Error("Remove listed cards from the marketplace before burning them");

  const blocked = await findBlockedCards(tx, userId, cardIds);
  if (blocked.length) {
    const reasons = Array.from(new Set(blocked.map((row) => String(row.reason || "protected_use"))));
    throw new Error(`Remove forge cards from protected use first: ${reasons.join(", ")}`);
  }

  const existingRare = rowsOf(await tx.execute(sql`
    SELECT id FROM app.player_cards
    WHERE owner_id = ${userId} AND player_id = ${playerId} AND rarity::text = 'rare'
    LIMIT 1
    FOR UPDATE
  `))[0];
  if (existingRare) throw new Error("You already own the rare version of this player");

  const operation = rowsOf(await tx.execute(sql`
    INSERT INTO app.forge_operations
      (operation_key, source_signature, user_id, player_id, source_card_ids, burn_count, target_rarity, fee_amount, status)
    VALUES
      (${operationKey}, ${sourceSignature}, ${userId}, ${playerId}, ${JSON.stringify(cardIds)}::jsonb,
       ${COMMON_FORGE_BURN_COUNT}, 'rare', ${COMMON_TO_RARE_FORGE_FEE}, 'processing')
    RETURNING id
  `))[0];
  if (!operation?.id) throw new Error("Forge operation could not be claimed");
  const operationId = Number(operation.id);
  const feePostingKey = forgeFeePostingKey(operationId);

  const feePosting = await postWalletAmountExactlyOnce(tx, {
    postingKey: feePostingKey,
    userId,
    amount: -COMMON_TO_RARE_FORGE_FEE,
    transactionType: "swap_fee",
    sourceType: "forge_burn",
    description: `Forge burn fee operation:${operationId} player:${playerId} cards:${cardIds.join(",")}`,
    reason: "Common-to-rare forge fee",
    metadata: { operationId, playerId, cardIds, burnCount: COMMON_FORGE_BURN_COUNT, targetRarity: "rare" },
    grossAmount: COMMON_TO_RARE_FORGE_FEE,
    feeAmount: COMMON_TO_RARE_FORGE_FEE,
    netAmount: -COMMON_TO_RARE_FORGE_FEE,
    auditAction: "forge.fee.posted",
  });

  await tx.execute(sql`
    INSERT INTO app.forge_burn_items (operation_id, card_id, ordinal)
    SELECT ${operationId}, source.card_id, source.ordinality::int
    FROM unnest(${cardIds}::int[]) WITH ORDINALITY AS source(card_id, ordinality)
  `);

  const burned = rowsOf(await tx.execute(sql`
    UPDATE app.player_cards
    SET owner_id = NULL, for_sale = false, price = 0
    WHERE id = ANY(${cardIds}::int[]) AND owner_id = ${userId} AND rarity::text = 'common'
    RETURNING id
  `));
  if (burned.length !== COMMON_FORGE_BURN_COUNT) throw new Error("Forge source cards changed before burn completion");

  const minted = rowsOf(await tx.execute(sql`
    INSERT INTO app.player_cards
      (player_id, owner_id, rarity, level, xp, decisive_score, last_5_scores, for_sale, price)
    VALUES
      (${playerId}, ${userId}, 'rare', 1, 0, 42, '[0,0,0,0,0]'::jsonb, false, 0)
    RETURNING id
  `))[0];
  if (!minted?.id) throw new Error("Rare forge card was not minted");

  await tx.execute(sql`
    UPDATE app.forge_operations
    SET fee_posting_key = ${feePostingKey},
        fee_transaction_id = ${feePosting.transactionId},
        minted_card_id = ${Number(minted.id)},
        status = 'completed',
        completed_at = now()
    WHERE id = ${operationId} AND status = 'processing'
  `);
  await tx.execute(sql`
    INSERT INTO app.audit_logs (user_id, action, meta)
    VALUES (${userId}, 'forge.common_to_rare.completed', ${JSON.stringify({ operationId, playerId, burnedCardIds: cardIds, mintedCardId: Number(minted.id), fee: COMMON_TO_RARE_FORGE_FEE, feeTransactionId: feePosting.transactionId })}::jsonb)
  `);

  return {
    operationId,
    mintedCardId: Number(minted.id),
    playerId,
    fee: COMMON_TO_RARE_FORGE_FEE,
    replayed: false,
  };
}

export async function getForgeOperationIntegrityReport() {
  await ensureForgeOperationSchema();
  const operations = rowsOf(await db.execute(sql`
    SELECT
      op.*,
      minted.id AS "mintedId", minted.player_id AS "mintedPlayerId", minted.rarity::text AS "mintedRarity",
      claim.id AS "claimId", claim.user_id AS "claimUserId", coalesce(claim.amount, 0)::float AS "claimAmount",
      claim.transaction_type AS "claimTransactionType", claim.source_type AS "claimSourceType",
      claim.transaction_id AS "claimTransactionId", claim.completed_at AS "claimCompletedAt",
      ledger.user_id AS "ledgerUserId", coalesce(ledger.amount, 0)::float AS "ledgerAmount",
      ledger.type::text AS "ledgerType", coalesce(ledger.source_type, '') AS "ledgerSourceType",
      coalesce(ledger.status::text, '') AS "ledgerStatus", coalesce(ledger.external_transaction_id, '') AS "ledgerExternalId",
      coalesce((SELECT array_agg(item.card_id ORDER BY item.card_id) FROM app.forge_burn_items item WHERE item.operation_id = op.id), ARRAY[]::int[]) AS "burnedCardIds",
      coalesce((SELECT count(*)::int FROM app.forge_burn_items item WHERE item.operation_id = op.id), 0) AS "burnedCount",
      coalesce((SELECT count(*)::int FROM app.forge_burn_items item JOIN app.player_cards source ON source.id = item.card_id WHERE item.operation_id = op.id AND (source.owner_id IS NOT NULL OR source.for_sale)), 0) AS "reactivatedBurnedCount"
    FROM app.forge_operations op
    LEFT JOIN app.player_cards minted ON minted.id = op.minted_card_id
    LEFT JOIN app.wallet_posting_claims claim ON claim.posting_key = op.fee_posting_key
    LEFT JOIN app.transactions ledger ON ledger.id = op.fee_transaction_id
    ORDER BY op.id DESC
  `));

  const issues: any[] = [];
  for (const operation of operations) {
    const expectedIds = normalizeForgeCardIds(operation.source_card_ids);
    const burnedIds = normalizeForgeCardIds(operation.burnedCardIds);
    const fee = toPostingMoney(operation.fee_amount || 0);
    const expectedFeeKey = forgeFeePostingKey(Number(operation.id));
    const flags: string[] = [];
    if (String(operation.status) !== "completed" || !operation.completed_at) flags.push("operation_not_completed");
    if (String(operation.operation_key || "") !== forgeOperationKey(String(operation.source_signature || ""))) flags.push("operation_key_mismatch");
    if (expectedIds.length !== COMMON_FORGE_BURN_COUNT || burnedIds.join(",") !== expectedIds.join(",") || Number(operation.burnedCount) !== COMMON_FORGE_BURN_COUNT) flags.push("burned_card_links_mismatch");
    if (Number(operation.reactivatedBurnedCount) > 0) flags.push("burned_card_reactivated");
    if (!operation.mintedId || Number(operation.mintedPlayerId) !== Number(operation.player_id) || String(operation.mintedRarity) !== "rare") flags.push("minted_card_mismatch");
    if (String(operation.fee_posting_key || "") !== expectedFeeKey) flags.push("fee_posting_key_mismatch");
    if (!operation.claimId || !operation.claimCompletedAt) flags.push("fee_claim_missing_or_incomplete");
    if (String(operation.claimUserId || "") !== String(operation.user_id || "") || toPostingMoney(operation.claimAmount || 0) !== -fee) flags.push("fee_claim_value_mismatch");
    if (String(operation.claimTransactionType || "") !== "swap_fee" || String(operation.claimSourceType || "") !== "forge_burn") flags.push("fee_claim_type_mismatch");
    if (Number(operation.claimTransactionId || 0) !== Number(operation.fee_transaction_id || 0)) flags.push("fee_claim_transaction_link_mismatch");
    if (String(operation.ledgerUserId || "") !== String(operation.user_id || "") || toPostingMoney(operation.ledgerAmount || 0) !== -fee) flags.push("fee_ledger_value_mismatch");
    if (String(operation.ledgerType || "") !== "swap_fee" || String(operation.ledgerSourceType || "") !== "forge_burn" || String(operation.ledgerStatus || "") !== "completed") flags.push("fee_ledger_state_mismatch");
    if (String(operation.ledgerExternalId || "") !== expectedFeeKey) flags.push("fee_ledger_external_reference_mismatch");
    if (flags.length) issues.push({ operationId: Number(operation.id), userId: operation.user_id, playerId: Number(operation.player_id), flags });
  }

  const orphanedFeeClaims = rowsOf(await db.execute(sql`
    SELECT claim.id AS "claimId", claim.posting_key AS "postingKey", claim.user_id AS "userId", claim.transaction_id AS "transactionId"
    FROM app.wallet_posting_claims claim
    LEFT JOIN app.forge_operations op ON op.fee_posting_key = claim.posting_key
    WHERE claim.source_type = 'forge_burn' AND op.id IS NULL
    ORDER BY claim.id DESC
  `));
  const unclaimedLegacyTransactions = rowsOf(await db.execute(sql`
    SELECT t.id AS "transactionId", t.user_id AS "userId", coalesce(t.amount, 0)::float AS amount, t.description, t.created_at AS "createdAt"
    FROM app.transactions t
    LEFT JOIN app.wallet_posting_claims claim ON claim.transaction_id = t.id
    WHERE coalesce(t.source_type, '') = 'forge_burn' AND claim.id IS NULL
    ORDER BY t.id DESC
  `));
  const unlinkedLegacyAudits = rowsOf(await db.execute(sql`
    SELECT a.id AS "auditId", a.user_id AS "userId", a.meta, a.created_at AS "createdAt"
    FROM app.audit_logs a
    LEFT JOIN app.forge_operations op
      ON op.minted_card_id = CASE WHEN (a.meta ->> 'mintedCardId') ~ '^[0-9]+$' THEN (a.meta ->> 'mintedCardId')::int ELSE NULL END
    WHERE a.action = 'forge.common_to_rare' AND op.id IS NULL
    ORDER BY a.id DESC
  `));

  for (const claim of orphanedFeeClaims) issues.push({ postingKey: claim.postingKey, claimId: Number(claim.claimId), userId: claim.userId, flags: ["orphaned_forge_fee_claim"] });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      operations: operations.length,
      issues: issues.length,
      orphanedFeeClaims: orphanedFeeClaims.length,
      unclaimedLegacyTransactions: unclaimedLegacyTransactions.length,
      unlinkedLegacyAudits: unlinkedLegacyAudits.length,
    },
    issues,
    orphanedFeeClaims,
    unclaimedLegacyTransactions,
    unlinkedLegacyAudits,
  };
}

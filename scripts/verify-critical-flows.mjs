#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const checks = [
  {
    name: "shared wallet ledger exposes only the active marketplace transaction helper",
    file: "server/services/walletLedger.ts",
    patterns: [
      "applyMarketplaceTradeLedger",
      "marketplace_buy",
      "marketplace_sale",
      "Seller wallet not found",
    ],
    forbiddenPatterns: [
      "creditWalletWithLedger",
      "processWalletDeposit",
      "createTrustedWithdrawal",
      "createPendingWithdrawalWithHold",
      "enterCompetitionWithFee",
      "refundWalletHold",
      "settleHeldAuctionBid",
      "getWalletIntegrityReport",
      "repairMissingWalletsFromLedger",
      "debitWalletForHold",
    ],
  },
  {
    name: "marketplace purchases use ledger, ownership guard, idempotency and audit logs",
    file: "server/routes/marketplace.routes.ts",
    patterns: [
      "applyMarketplaceTradeLedger",
      "for(\"update\")",
      "eq(playerCards.ownerId, sellerId)",
      "idempotencyKeys",
      "marketplacePurchaseKey",
      ".onConflictDoNothing({ target: idempotencyKeys.key })",
      "meta ->> 'idempotencyKey'",
      "duplicate: true",
      "const BUY_TX_TYPE = \"marketplace_buy\"",
      "const SALE_TX_TYPE = \"marketplace_sale\"",
      "marketplace.purchase.completed",
      "marketplace.purchase.failed",
      "risk.wash_trade_blocked",
    ],
  },
  {
    name: "marketplace idempotency has migration and runtime database support",
    file: "drizzle/0003_marketplace_purchase_idempotency.sql",
    patterns: [
      "CREATE TABLE IF NOT EXISTS app.idempotency_keys",
      "key text PRIMARY KEY",
      "idempotency_keys_expires_at_idx",
      "audit_logs_marketplace_purchase_idempotency_idx",
      "meta ->> 'idempotencyKey'",
    ],
  },
  {
    name: "runtime schema ensures marketplace idempotency structures",
    file: "server/runtime-schema.ts",
    patterns: [
      "CREATE TABLE IF NOT EXISTS app.idempotency_keys",
      "idempotency_keys_expires_at_idx",
      "audit_logs_marketplace_purchase_idempotency_idx",
    ],
  },
  {
    name: "competition cancellation is row locked, atomic and exactly once",
    file: "server/services/competitionCancellation.ts",
    patterns: [
      "FOR UPDATE",
      "app.competition_entry_refunds",
      "ON CONFLICT (entry_id) DO NOTHING",
      "type, amount, gross_amount",
      "'tournament_refund'",
      "'tournament_cancellation_refund'",
      "competition-refund:${competitionId}:entry:${entryId}",
      "DELETE FROM app.card_locks",
      "SET status = 'cancelled'",
      "competition.cancellation.reconciled",
      "entry_fee_paid",
      "snapshot_competition_entry_fee",
    ],
  },
  {
    name: "competition cancellation routes prevent refund and lifecycle bypasses",
    file: "server/routes/competitionCancellation.routes.ts",
    patterns: [
      "/api/user-tournaments/:id/cancel",
      "/api/admin/competitions/:id/cancel",
      "/api/user-tournaments/:id/status",
      "requestedStatus === \"cancelled\"",
      "cancelCompetitionWithRefunds",
      "app.patch(\"/api/admin/competitions/:id\"",
      "Use the settlement endpoint to complete a tournament",
      "Tier and entry fee cannot change after users have entered",
      "Active tournaments can only be cancelled or settled",
      "admin.tournament.updated",
      "Entered tournaments cannot be deleted",
      "FOR UPDATE",
      "preserve ledger history",
    ],
  },
  {
    name: "cancellation routes are registered before legacy tournament handlers",
    file: "server/routes/marketplace.routes.ts",
    patterns: [
      "registerCompetitionCancellationRoutes",
      "registerCompetitionCancellationRoutes(app, { requireAuth });\n  registerTournamentCreatorRoutes(app, { requireAuth });",
    ],
  },
  {
    name: "kickoff activation cannot resurrect a cancelled tournament",
    file: "server/services/scoreUpdater.ts",
    patterns: [
      "AND status = 'open'",
      "AND start_date <= now()",
      "RETURNING status::text AS status",
      "SELECT status::text AS status",
      "competition.status = current?.status || competition.status",
    ],
  },
  {
    name: "competition cancellation has durable migration support",
    file: "drizzle/0004_competition_cancellation_refunds.sql",
    patterns: [
      "ADD VALUE IF NOT EXISTS 'cancelled'",
      "ADD VALUE IF NOT EXISTS 'tournament_refund'",
      "entry_fee_paid",
      "snapshot_competition_entry_fee",
      "CREATE TABLE IF NOT EXISTS app.competition_entry_refunds",
      "entry_id integer PRIMARY KEY",
      "tournament_cancellation_refund_external_id_unique",
      "ON DELETE RESTRICT",
    ],
  },
  {
    name: "runtime schema helper includes cancellation database structures",
    file: "server/runtime-schema.ts",
    patterns: [
      "ensureCompetitionCancellationSchema",
      "await ensureCompetitionCancellationSchema()",
    ],
  },
  {
    name: "auction bids, buy-now and settlement use durable escrow",
    file: "server/services/auctionEscrow.ts",
    patterns: [
      "app.auction_escrow_holds",
      "FOR UPDATE",
      "ON CONFLICT (key) DO NOTHING",
      "auction_bid_lock",
      "auction_bid_release",
      "releaseHold(tx, previousHold, \"outbid\")",
      "releaseHeldHolds",
      "transferAuctionCard",
      "SET locked_balance = locked_balance - ${amount}",
      "amount: 0",
      "type: \"auction_sale\"",
      "auction.buy_now.completed",
      "auction.settle.completed",
      "auction.settle.reserve_not_met",
      "auction.settle.missing_escrow",
      "auction.settle.recovered_transfer_failure",
      "getAuctionEscrowIntegrityReport",
      "recoverAuctionEscrow",
    ],
  },
  {
    name: "auction routes expose protected cancellation, settlement and recovery",
    file: "server/routes/auctions.routes.ts",
    patterns: [
      "secureAuctionAdmin",
      "deps.isAdmin || secureAuctionAdmin",
      "/api/auctions/active",
      "/api/auctions/create",
      "/api/auctions/:id/bid",
      "/api/auctions/:id/buy-now",
      "/api/auctions/:id/cancel",
      "/api/admin/auctions/:id/cancel",
      "/api/auctions/:id/settle",
      "/api/admin/auctions/escrow-integrity",
      "/api/admin/auctions/:id/recover",
      "requireAuth, isAdmin",
    ],
    forbiddenPatterns: [
      "settleHeldAuctionBid",
      "refundWalletHold",
      "((_req: any, _res: any, next: any) => next())",
    ],
  },
  {
    name: "auction escrow migration has uniqueness and recovery backstops",
    file: "drizzle/0005_auction_escrow_recovery.sql",
    patterns: [
      "CREATE TABLE IF NOT EXISTS app.auction_escrow_holds",
      "bid_id integer UNIQUE",
      "status IN ('held', 'released', 'settled')",
      "ON DELETE RESTRICT",
      "auction_escrow_one_held_per_auction_unique",
      "auctions_one_active_per_card_unique",
      "auction_escrow_transaction_external_id_unique",
      "settlement_error",
      "recovery_completed_at",
    ],
  },
  {
    name: "auction escrow schema is aligned in application types",
    file: "shared/schema.ts",
    patterns: [
      "export const auctionEscrowHolds",
      "settlementError: text(\"settlement_error\")",
      "settlementAttempts: integer(\"settlement_attempts\")",
      "recoveryCompletedAt: timestamp(\"recovery_completed_at\")",
      "insertAuctionEscrowHoldSchema",
      "AuctionEscrowHold",
    ],
  },
  {
    name: "runtime and server startup prepare auction integrity structures",
    file: "server/runtime-schema.ts",
    patterns: [
      "ensureAuctionEscrowSchema",
      "await ensureAuctionEscrowSchema()",
      "auction_escrow_one_held_per_auction_unique",
      "auctions_one_active_per_card_unique",
    ],
  },
  {
    name: "server waits for runtime integrity checks before routes",
    file: "server/index.ts",
    patterns: [
      "import { ensureRuntimeSchema } from \"./runtime-schema.js\"",
      "await ensureRuntimeSchema();\n  try { const result = await syncFplPremierLeaguePlayers()",
      "await registerRoutes(httpServer, app);",
    ],
  },
  {
    name: "competition reward integrity service exposes check + repair",
    file: "server/services/tournamentRewards.ts",
    patterns: [
      "getCompetitionRewardIntegrity",
      "repairCompetitionRewards",
      "missing_card",
      "owner_mismatch",
    ],
  },
  {
    name: "admin APIs expose wallet/marketplace/card/reward repair endpoints",
    file: "server/routes/adminIntegrity.routes.ts",
    patterns: [
      "/api/admin/wallet/integrity",
      "/api/admin/wallet/repair-missing",
      "/api/admin/marketplace/integrity",
      "/api/admin/marketplace/repair-listings",
      "/api/admin/cards/integrity",
      "/api/admin/cards/repair-serials",
      "/api/admin/competitions/:id/reward-integrity",
      "/api/admin/competitions/:id/repair-rewards",
      "requireAuth, isAdmin",
    ],
  },
  {
    name: "admin router registers integrity routes",
    file: "server/routes/admin.routes.ts",
    patterns: [
      "registerAdminIntegrityRoutes",
      "registerAdminIntegrityRoutes(app, { requireAuth, isAdmin })",
    ],
  },
  {
    name: "admin UI exposes integrity and reward repair console",
    file: "client/src/components/admin/AdminIntegrityPanel.tsx",
    patterns: [
      "Production integrity console",
      "/api/admin/wallet/integrity",
      "/api/admin/marketplace/integrity",
      "/api/admin/cards/integrity",
      "/api/admin/competitions/${normalizedId}/reward-integrity",
      "/api/admin/competitions/${normalizedId}/repair-rewards",
    ],
  },
  {
    name: "premium UI scene chrome is active across app tabs",
    file: "client/src/components/PageScene.tsx",
    patterns: [
      "const CHROME",
      "page-scene__stadium-lines",
      "page-scene__chrome",
      "AUCTION HOUSE",
      "FINANCE HUB",
      "ADMIN OPS",
    ],
  },
];

let failures = 0;
for (const check of checks) {
  const body = read(check.file);
  const missing = check.patterns.filter((pattern) => !body.includes(pattern));
  const forbidden = (check.forbiddenPatterns || []).filter((pattern) => body.includes(pattern));
  if (missing.length > 0 || forbidden.length > 0) {
    failures += 1;
    console.error(`✗ ${check.name}`);
    console.error(`  ${relative(root, resolve(root, check.file))}`);
    for (const pattern of missing) console.error(`  missing: ${pattern}`);
    for (const pattern of forbidden) console.error(`  forbidden: ${pattern}`);
  } else {
    console.log(`✓ ${check.name}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} critical flow check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} critical flow checks passed.`);

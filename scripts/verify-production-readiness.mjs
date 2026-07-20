#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function has(path) {
  return existsSync(resolve(root, path));
}

const checks = [
  {
    name: "Build scripts are present",
    file: "package.json",
    patterns: ["build:client", "build:server", "test:critical-flows"],
  },
  {
    name: "Shared wallet ledger exposes only the marketplace transaction helper",
    file: "server/services/walletLedger.ts",
    patterns: ["applyMarketplaceTradeLedger", "marketplace_buy", "marketplace_sale"],
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
    name: "Dedicated money services own deposits, withdrawals and reconciliation",
    file: "server/routes/depositVerification.routes.ts",
    patterns: [
      "submitDepositForVerification",
      "registerWithdrawalPayoutRoutes",
      "app.post(\"/api/wallet/deposit\", requireAuth",
    ],
  },
  {
    name: "Withdrawal payout routes require durable review and recovery",
    file: "server/routes/withdrawalPayout.routes.ts",
    patterns: [
      "submitWithdrawalRequest",
      "reviewWithdrawal",
      "recoverWithdrawal",
      "getWithdrawalIntegrityReport",
      "app.post(\"/api/wallet/withdraw\", requireAuth",
      "app.post(\"/api/admin/withdrawals/:id/status\", requireAuth, isAdmin",
    ],
  },
  {
    name: "Wallet integrity uses hold-aware reconciliation",
    file: "server/routes/adminIntegrity.routes.ts",
    patterns: ["getWalletReconciliationReport", "repairSafeMissingWallets"],
    forbiddenPatterns: ["getWalletIntegrityReport", "repairMissingWalletsFromLedger"],
  },
  {
    name: "Tournament reward service exists",
    file: "server/services/tournamentRewards.ts",
    patterns: ["getCompetitionRewardIntegrity", "repairCompetitionRewards", "owner_mismatch", "missing_card"],
  },
  {
    name: "Marketplace purchase route uses production-safe transaction enum values",
    file: "server/routes/marketplace.routes.ts",
    patterns: ["const BUY_TX_TYPE = \"marketplace_buy\"", "const SALE_TX_TYPE = \"marketplace_sale\"", "marketplace.purchase.completed", "risk.wash_trade_blocked"],
  },
  {
    name: "Auction settlement uses durable escrow and protected recovery",
    file: "server/services/auctionEscrow.ts",
    patterns: ["app.auction_escrow_holds", "settleWinningHold", "recoverAuctionEscrow", "auction.settle.completed"],
    forbiddenPatterns: ["settleHeldAuctionBid", "refundWalletHold"],
  },
  {
    name: "Admin integrity UI exists",
    file: "client/src/components/admin/AdminIntegrityPanel.tsx",
    patterns: ["Production integrity console", "repair-rewards", "repair-listings", "repair-serials"],
  },
  {
    name: "Ledger explorer UI exists",
    file: "client/src/components/admin/AdminTransactionExplorer.tsx",
    patterns: ["Transaction audit trail", "Filtered type breakdown", "pageTotal", "debitTotal"],
  },
  {
    name: "Production index migration exists",
    file: "drizzle/0001_production_integrity_indexes.sql",
    patterns: ["CREATE INDEX", "transactions_user_created_idx", "player_cards_owner_idx"],
  },
  {
    name: "Idempotency migration exists",
    file: "drizzle/0002_idempotency_keys.sql",
    patterns: ["idempotency_keys", "CREATE UNIQUE INDEX", "created_at"],
  },
  {
    name: "Uniqueness safety checks exist",
    file: "drizzle/0003_uniqueness_safety_checks.sql",
    patterns: ["Duplicate wallet rows", "Duplicate reward claims", "Duplicate non-empty card serials"],
  },
  {
    name: "Transaction status compatibility migration exists",
    file: "drizzle/0004_add_transaction_status_compat.sql",
    patterns: ["ALTER TABLE app.transactions", "ADD COLUMN IF NOT EXISTS status", "DEFAULT 'completed'"],
  },
  {
    name: "Card-not-found diagnostics exist",
    file: "docs/card-not-found-diagnostics.sql",
    patterns: ["broken_marketplace_card", "broken_prize_card", "broken_lineup_card", "SAFE REPAIR OPTIONS"],
  },
  {
    name: "Wallet bypass regression verifier exists",
    file: "scripts/verify-wallet-bypass-removal.mjs",
    patterns: ["checkSingleRoute", "applyMarketplaceTradeLedger", "wallet bypass removal checks passed"],
  },
];

let failures = 0;
for (const check of checks) {
  if (!has(check.file)) {
    failures += 1;
    console.error(`✗ ${check.name}`);
    console.error(`  missing file: ${check.file}`);
    continue;
  }

  const body = read(check.file);
  const missing = check.patterns.filter((pattern) => !body.includes(pattern));
  const forbidden = (check.forbiddenPatterns || []).filter((pattern) => body.includes(pattern));
  if (missing.length > 0 || forbidden.length > 0) {
    failures += 1;
    console.error(`✗ ${check.name}`);
    for (const pattern of missing) console.error(`  missing: ${pattern}`);
    for (const pattern of forbidden) console.error(`  forbidden: ${pattern}`);
  } else {
    console.log(`✓ ${check.name}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} production readiness check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} production readiness checks passed.`);

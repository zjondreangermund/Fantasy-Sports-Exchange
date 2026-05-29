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
    name: "Wallet ledger exposes all production money helpers",
    file: "server/services/walletLedger.ts",
    patterns: [
      "creditWalletWithLedger",
      "processWalletDeposit",
      "createTrustedWithdrawal",
      "createPendingWithdrawalWithHold",
      "enterCompetitionWithFee",
      "applyMarketplaceTradeLedger",
      "refundWalletHold",
      "settleHeldAuctionBid",
      "getWalletIntegrityReport",
      "repairMissingWalletsFromLedger",
    ],
  },
  {
    name: "Tournament reward service exists",
    file: "server/services/tournamentRewards.ts",
    patterns: ["getCompetitionRewardIntegrity", "repairCompetitionRewards", "owner_mismatch", "missing_card"],
  },
  {
    name: "Marketplace purchase route is guarded",
    file: "server/routes/marketplace.routes.ts",
    patterns: ["for(\"update\")", "applyMarketplaceTradeLedger", "marketplace.purchase.completed", "risk.wash_trade_blocked"],
  },
  {
    name: "Auction settlement route is guarded",
    file: "server/routes/auctions.routes.ts",
    patterns: ["for(\"update\")", "settleHeldAuctionBid", "refundWalletHold", "auction.settle.completed"],
  },
  {
    name: "Admin operations endpoints exist",
    file: "server/routes.ts",
    patterns: [
      "/api/admin/wallet/integrity",
      "/api/admin/wallet/repair-missing",
      "/api/admin/transactions",
      "/api/admin/cards/integrity",
      "/api/admin/marketplace/integrity",
      "/api/admin/competitions/:id/repair-rewards",
    ],
  },
  {
    name: "Admin integrity UI exists",
    file: "client/src/components/admin/AdminIntegrityPanel.tsx",
    patterns: ["Production integrity console", "repair-rewards", "repair-listings", "repair-serials"],
  },
  {
    name: "Ledger explorer UI exists",
    file: "client/src/components/admin/AdminTransactionExplorer.tsx",
    patterns: ["Transaction Ledger", "Filtered type breakdown", "pageNet", "debitTotal"],
  },
  {
    name: "Database hardening SQL exists",
    file: "drizzle/0001_production_integrity_hardening.sql",
    patterns: ["CREATE UNIQUE INDEX", "CREATE INDEX", "competition_reward_claims", "idempotency_keys"],
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
  if (missing.length > 0) {
    failures += 1;
    console.error(`✗ ${check.name}`);
    for (const pattern of missing) console.error(`  missing: ${pattern}`);
  } else {
    console.log(`✓ ${check.name}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} production readiness check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} production readiness checks passed.`);

#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const checks = [
  {
    name: "wallet ledger exposes guarded money operations",
    file: "server/services/walletLedger.ts",
    patterns: [
      "creditWalletWithLedger",
      "processWalletDeposit",
      "createTrustedWithdrawal",
      "createPendingWithdrawalWithHold",
      "applyMarketplaceTradeLedger",
      "refundWalletHold",
      "settleHeldAuctionBid",
      "enterCompetitionWithFee",
      "getWalletIntegrityReport",
      "repairMissingWalletsFromLedger",
    ],
  },
  {
    name: "marketplace purchases use ledger + ownership guard + audit logs",
    file: "server/routes/marketplace.routes.ts",
    patterns: [
      "applyMarketplaceTradeLedger",
      "for(\"update\")",
      "eq(playerCards.ownerId, sellerId)",
      "marketplace.purchase.completed",
      "marketplace.purchase.failed",
      "risk.wash_trade_blocked",
    ],
  },
  {
    name: "auction settlement and buy-now flows are transaction guarded",
    file: "server/routes/auctions.routes.ts",
    patterns: [
      "settleHeldAuctionBid",
      "refundWalletHold",
      "for(\"update\")",
      "auction.settle.completed",
      "auction.settle.reserve_not_met",
      "Auction card was no longer available for transfer",
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
  if (missing.length > 0) {
    failures += 1;
    console.error(`✗ ${check.name}`);
    console.error(`  ${relative(root, resolve(root, check.file))}`);
    for (const pattern of missing) console.error(`  missing: ${pattern}`);
  } else {
    console.log(`✓ ${check.name}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} critical flow check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} critical flow checks passed.`);

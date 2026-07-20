#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), "utf8");

const checks = [
  {
    name: "wallet total reconciliation distinguishes ledger value from lock attribution",
    file: "server/services/walletReconciliation.ts",
    patterns: [
      "const walletTotal = toMoney(balance + lockedBalance)",
      "const expectedTotalBalance = toMoney(postedLedgerBalance + auctionLedgerAdjustment)",
      "const attributedLockedBalance = toMoney(withdrawalLocked + auctionLocked)",
      "const expectedAvailableBalance = toMoney(expectedTotalBalance - attributedLockedBalance)",
      "const totalDelta = toMoney(walletTotal - expectedTotalBalance)",
      "const lockedDelta = toMoney(lockedBalance - attributedLockedBalance)",
      "wallet_total_ledger_delta",
      "locked_balance_attribution_delta",
      "orphaned_locked_balance",
      "locked_balance_shortfall",
    ],
  },
  {
    name: "reconciliation uses only posted ledger value and valid active auction debit bridges",
    file: "server/services/walletReconciliation.ts",
    patterns: [
      "CASE WHEN t.status::text = 'completed' THEN t.amount ELSE 0 END",
      "t.source_type = 'auction_bid_lock'",
      "abs(coalesce(t.amount, 0) + h.amount) < 0.01",
      "THEN h.amount ELSE 0 END",
      "nonposted_nonzero_transactions",
      "auction_hold_ledger_mismatch",
      "withdrawal_hold_ledger_mismatch",
    ],
  },
  {
    name: "locked balance is attributed to active withdrawal and auction holds",
    file: "server/services/walletReconciliation.ts",
    patterns: [
      "wr.status::text IN ('pending', 'approved', 'failed')",
      "h.status = 'held'",
      "withdrawal_locked",
      "auction_locked",
      "totalAttributedLocked",
      "unattributedLocked",
      "lockedAttributionDeltas",
    ],
  },
  {
    name: "missing wallet repair is conservative and audited",
    file: "server/services/walletReconciliation.ts",
    patterns: [
      "repairSafeMissingWallets",
      "coalesce(h.locked_amount, 0) = 0",
      "l.nonposted_nonzero_transactions = 0",
      "l.posted_ledger_balance >= 0",
      "wallet.reconciliation.missing_wallet_repaired",
      "completed_ledger_without_active_holds",
      "remainingMissingWallets",
    ],
  },
  {
    name: "admin wallet endpoints use hold-aware reconciliation instead of the obsolete report",
    file: "server/routes/adminIntegrity.routes.ts",
    patterns: [
      "getWalletReconciliationReport",
      "repairSafeMissingWallets",
      "String(req.authUserId || \"\")",
      "/api/admin/wallet/integrity",
      "/api/admin/wallet/repair-missing",
      "requireAuth, isAdmin",
    ],
    forbiddenPatterns: [
      "getWalletIntegrityReport",
      "repairMissingWalletsFromLedger",
    ],
  },
];

let failures = 0;
for (const check of checks) {
  const body = read(check.file);
  const missing = check.patterns.filter((pattern) => !body.includes(pattern));
  const forbidden = (check.forbiddenPatterns || []).filter((pattern) => body.includes(pattern));
  if (missing.length || forbidden.length) {
    failures += 1;
    console.error(`✗ ${check.name}`);
    console.error(`  ${relative(root, resolve(root, check.file))}`);
    for (const pattern of missing) console.error(`  missing: ${pattern}`);
    for (const pattern of forbidden) console.error(`  forbidden: ${pattern}`);
  } else {
    console.log(`✓ ${check.name}`);
  }
}

if (failures) {
  console.error(`\n${failures} wallet reconciliation check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} wallet reconciliation checks passed.`);

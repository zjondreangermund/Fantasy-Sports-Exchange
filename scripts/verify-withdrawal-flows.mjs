#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), "utf8");

const checks = [
  {
    name: "withdrawal submission creates one durable wallet hold and linked ledger row",
    file: "server/services/withdrawalPayout.ts",
    patterns: [
      "submitWithdrawalRequest",
      "ON CONFLICT (key) DO NOTHING",
      "SET balance = balance - ${amount}, locked_balance = locked_balance + ${amount}",
      "'withdrawal_hold', 'pending'",
      "hold_transaction_id = ${Number(holdTransaction.id)}",
      "wallet.withdrawal.held",
      "Withdrawal idempotency key was reused with different details",
    ],
  },
  {
    name: "withdrawal payout state changes are row locked and exactly once",
    file: "server/services/withdrawalPayout.ts",
    patterns: [
      "WHERE id = ${withdrawalId} FOR UPDATE",
      "assertPendingHold",
      "currentStatus === nextStatus",
      "verifySameStatus",
      "source_type = 'withdrawal_settlement', status = 'completed'",
      "source_type = 'withdrawal_refund', status = 'rejected'",
      "SET locked_balance = locked_balance - ${amount}",
      "SET balance = balance + ${amount}, locked_balance = locked_balance - ${amount}",
      "wallet.withdrawal.paid",
      "wallet.withdrawal.rejected",
    ],
  },
  {
    name: "failed payouts remain recoverable and payout references are globally claimed",
    file: "server/services/withdrawalPayout.ts",
    patterns: [
      "Only an approved withdrawal can be marked failed",
      "app.withdrawal_payout_attempts",
      "payout_reference_key = ${payoutReferenceKey}",
      "Payout reference has already been used for another withdrawal",
      "wallet.withdrawal.failed",
      "recoverWithdrawal",
      "confirm_paid",
      "retry",
      "refund",
      "getWithdrawalIntegrityReport",
      "paid_without_payout_reference",
      "lockedBalanceShortfalls",
    ],
  },
  {
    name: "withdrawal routes are the authorized owners of all withdrawal endpoints",
    file: "server/routes/withdrawalPayout.routes.ts",
    patterns: [
      "app.get(\"/api/wallet/withdrawals\", requireAuth",
      "app.post(\"/api/wallet/withdraw\", requireAuth",
      "app.get(\"/api/admin/withdrawals\", requireAuth, isAdmin",
      "app.post(\"/api/admin/withdrawals/:id/status\", requireAuth, isAdmin",
      "app.get(\"/api/admin/withdrawals/integrity\", requireAuth, isAdmin",
      "app.post(\"/api/admin/withdrawals/:id/recover\", requireAuth, isAdmin",
    ],
  },
  {
    name: "early financial route registration includes withdrawals before application routes",
    file: "server/routes/depositVerification.routes.ts",
    patterns: [
      "registerWithdrawalPayoutRoutes",
      "registerWithdrawalPayoutRoutes(app, { requireAuth, isAdmin });",
    ],
  },
  {
    name: "withdrawal payout migration has durable uniqueness and recovery fields",
    file: "drizzle/0007_withdrawal_payout_integrity.sql",
    patterns: [
      "ADD VALUE IF NOT EXISTS 'failed'",
      "hold_transaction_id integer REFERENCES app.transactions(id) ON DELETE RESTRICT",
      "CREATE TABLE IF NOT EXISTS app.withdrawal_payout_attempts",
      "status IN ('paid', 'failed')",
      "withdrawal_payout_reference_unique",
      "withdrawal_requests_verification_token_unique",
      "payout_error",
      "recovery_completed_at",
      "Legacy paid withdrawal has no external payout reference",
    ],
  },
  {
    name: "runtime startup fails closed on withdrawal payout schema",
    file: "server/runtime-schema.ts",
    patterns: [
      "ensureWithdrawalPayoutSchema",
      "await ensureWithdrawalPayoutSchema()",
      "await ensureDepositVerificationSchema();\n  await ensureWithdrawalPayoutSchema();",
    ],
  },
  {
    name: "generic wallet routes cannot mutate or review withdrawals",
    file: "server/routes/wallet.routes.ts",
    patterns: [
      "app.get(\"/api/wallet\", requireAuth",
      "app.get(\"/api/transactions\", requireAuth",
    ],
    forbiddenPatterns: [
      "app.get(\"/api/wallet/withdrawals\"",
      "app.post(\"/api/wallet/withdraw\"",
      "app.post(\"/api/admin/withdrawals/:id/status\"",
      "withdrawalRequests",
      "withdrawal_hold",
      "withdrawal_settlement",
      "withdrawal_refund",
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
  console.error(`\n${failures} withdrawal integrity check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} withdrawal integrity checks passed.`);

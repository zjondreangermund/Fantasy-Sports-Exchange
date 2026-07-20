#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), "utf8");

const checks = [
  {
    name: "deposit submission claims references globally and records pending value only",
    file: "server/services/depositVerification.ts",
    patterns: [
      "normalizeDepositReference",
      ".toUpperCase().replace(/\\s+/g, \"\")",
      "DEPOSIT_FEE_FREE_THRESHOLD",
      "SMALL_DEPOSIT_FEE_RATE",
      "WHERE dv.reference_key = ${referenceKey}",
      "FOR UPDATE OF dv, t",
      "Payment reference has already been claimed",
      "'deposit_verification', 'pending'",
      "wallet.deposit.submitted",
      "amount, gross_amount, fee_amount, net_amount",
    ],
  },
  {
    name: "deposit review credits or rejects exactly once inside the locked transaction",
    file: "server/services/depositVerification.ts",
    patterns: [
      "currentStatus === decision",
      "expectedTransactionStatus",
      "Deposit terminal ledger state does not match verification decision",
      "Deposit ledger amounts do not match verification claim",
      "Deposit is already ${currentStatus}",
      "Pending deposit already changed wallet value",
      "UPDATE app.wallets SET balance = balance + ${netAmount}",
      "source_type = 'deposit_verified', status = 'completed'",
      "source_type = 'deposit_rejected', status = 'rejected'",
      "wallet.deposit.${decision}",
      "getDepositVerificationIntegrity",
    ],
  },
  {
    name: "deposit routes require authentication and admin review authorization",
    file: "server/routes/depositVerification.routes.ts",
    patterns: [
      "app.post(\"/api/wallet/deposit\", requireAuth",
      "app.get(\"/api/admin/deposits\", requireAuth, isAdmin",
      "app.post(\"/api/admin/deposits/:id/status\", requireAuth, isAdmin",
      "app.get(\"/api/admin/deposits/integrity\", requireAuth, isAdmin",
      "submitDepositForVerification",
      "reviewDepositVerification",
    ],
  },
  {
    name: "deposit reference claims have migration and legacy duplicate handling",
    file: "drizzle/0006_deposit_verification_integrity.sql",
    patterns: [
      "CREATE TABLE IF NOT EXISTS app.deposit_verifications",
      "transaction_id integer NOT NULL UNIQUE",
      "reference_key text NOT NULL UNIQUE",
      "status IN ('pending', 'approved', 'rejected')",
      "deposit_duplicate_legacy",
      "CASE WHEN t.status::text = 'completed' OR t.source_type = 'deposit_verified' THEN 0 ELSE 1 END",
      "duplicate legacy reference requires review",
      "row_number() OVER",
      "ON DELETE RESTRICT",
    ],
  },
  {
    name: "runtime schema prepares deposit verification claims",
    file: "server/runtime-schema.ts",
    patterns: [
      "ensureDepositVerificationSchema",
      "await ensureDepositVerificationSchema()",
    ],
  },
  {
    name: "verified deposit routes shadow legacy wallet handlers",
    file: "server/index.ts",
    patterns: [
      "registerDepositVerificationRoutes",
      "registerDepositVerificationRoutes(app, { requireAuth, isAdmin });\n  await ensureRuntimeSchema();",
      "await ensureRuntimeSchema();\n  try { const result = await syncFplPremierLeaguePlayers()",
      "await registerRoutes(httpServer, app);",
    ],
  },
];

let failures = 0;
for (const check of checks) {
  const body = read(check.file);
  const missing = check.patterns.filter((pattern) => !body.includes(pattern));
  if (missing.length) {
    failures += 1;
    console.error(`✗ ${check.name}`);
    console.error(`  ${relative(root, resolve(root, check.file))}`);
    for (const pattern of missing) console.error(`  missing: ${pattern}`);
  } else {
    console.log(`✓ ${check.name}`);
  }
}

if (failures) {
  console.error(`\n${failures} deposit integrity check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} deposit integrity checks passed.`);

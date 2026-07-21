#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), "utf8");

function listSourceFiles(relativeDir) {
  const results = [];
  for (const entry of readdirSync(resolve(root, relativeDir), { withFileTypes: true })) {
    const path = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) results.push(...listSourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) results.push(path);
  }
  return results;
}

const failures = [];
const pass = (message) => console.log(`✓ ${message}`);
const fail = (message) => failures.push(message);
const requirePatterns = (name, path, patterns) => {
  const body = read(path);
  const missing = patterns.filter((pattern) => !body.includes(pattern));
  if (missing.length) fail(`${name}: ${path} missing ${missing.join(", ")}`);
  else pass(name);
};
const forbidPatterns = (name, path, patterns) => {
  const body = read(path);
  const found = patterns.filter((pattern) => body.includes(pattern));
  if (found.length) fail(`${name}: ${path} contains ${found.join(", ")}`);
  else pass(name);
};

requirePatterns("loan migration stores both payment postings and links", "drizzle/0009_loan_payment_integrity.sql", [
  "borrower_posting_key text",
  "borrower_transaction_id integer REFERENCES app.transactions(id)",
  "owner_posting_key text",
  "owner_transaction_id integer REFERENCES app.transactions(id)",
  "payment_completed_at timestamp",
  "card_loans_borrower_posting_key_unique",
  "card_loans_owner_transaction_unique",
]);
requirePatterns("legacy loan backfill is proof-based and diagnostic-safe", "drizzle/0009_loan_payment_integrity.sql", [
  "count(*) OVER (PARTITION BY l.id) AS match_count",
  "WHERE match_count = 1",
  "Backfilled legacy loan borrower debit",
  "Backfilled legacy loan owner credit",
  "ON CONFLICT DO NOTHING",
]);

requirePatterns("runtime startup prepares loan payment schema", "server/runtime-schema.ts", [
  "ensureLoanPaymentSchema",
  "await ensureLoanPaymentSchema();",
]);
requirePatterns("runtime schema mirrors migration and conservative backfill", "server/services/loanPaymentSchema.ts", [
  "ensureWalletPostingSchema",
  "match_count = 1",
  "borrower_posting_key = claims.posting_key",
  "owner_posting_key = claims.posting_key",
  "payment_completed_at = coalesce(payment_completed_at, now())",
]);

requirePatterns("loan payment service posts and verifies both sides exactly once", "server/services/loanPayment.ts", [
  "loanBorrowerPostingKey",
  "loanOwnerPostingKey",
  "postLoanPaymentExactlyOnce",
  "verifyLoanPaymentExactlyOnce",
  "postWalletAmountExactlyOnce(tx",
  'sourceType: "card_loan_accept"',
  'sourceType: "card_loan_income"',
  "Loan payment posting claim is missing and requires integrity review",
  "getLoanPaymentIntegrityReport",
  "orphaned_loan_payment_claim",
  "duplicateLegacyTransactions",
]);

requirePatterns("loan acceptance stores claim and transaction links", "server/routes/loanMarket.routes.ts", [
  "postLoanPaymentExactlyOnce(tx, paymentDetails)",
  "verifyLoanPaymentExactlyOnce(tx, paymentDetails",
  "borrower_posting_key = ${payment.borrower.postingKey}",
  "borrower_transaction_id = ${payment.borrower.transactionId}",
  "owner_posting_key = ${payment.owner.postingKey}",
  "owner_transaction_id = ${payment.owner.transactionId}",
  "payment_completed_at = now()",
  'if (!["active", "returned"].includes(status)',
  "for update of l, pc",
  'app.get("/api/admin/loan-payments/integrity"',
]);

const loanRoutes = read("server/routes/loanMarket.routes.ts");
const acceptStart = loanRoutes.indexOf('app.post("/api/marketplace/loans/:loanId/accept"');
const acceptEnd = loanRoutes.indexOf('app.post("/api/marketplace/loans/return-expired"', acceptStart);
const acceptBlock = acceptStart >= 0 && acceptEnd > acceptStart ? loanRoutes.slice(acceptStart, acceptEnd) : "";
if (!acceptBlock) fail("loan acceptance route block was not found");
else if (acceptBlock.includes("update app.wallets") || acceptBlock.includes("insert into app.transactions")) fail("loan acceptance still mutates wallet or ledger directly");
else pass("loan acceptance delegates all money movement to posting service");

forbidPatterns("loan route contains no legacy raw money posting", "server/routes/loanMarket.routes.ts", [
  "set balance = balance - ${gross}",
  "set balance = balance + ${ownerReceives}",
  "values (${borrowerId}, 'purchase'",
  "values (${ownerId}, 'sale'",
]);

const routeBodies = new Map(listSourceFiles("server").map((path) => [path, read(path)]));
function checkSingleRoute(method, route, owner) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\bapp\\.${method}\\(\\s*["']${escaped}["']`, "g");
  const matches = [];
  for (const [path, body] of routeBodies) {
    const count = [...body.matchAll(regex)].length;
    for (let i = 0; i < count; i += 1) matches.push(path);
  }
  if (matches.length !== 1 || matches[0] !== owner) fail(`${method.toUpperCase()} ${route} must be owned only by ${owner}; found ${matches.join(", ") || "none"}`);
  else pass(`${method.toUpperCase()} ${route} has one authorized owner`);
}

checkSingleRoute("post", "/api/marketplace/loans/:loanId/accept", "server/routes/loanMarket.routes.ts");
checkSingleRoute("get", "/api/admin/loan-payments/integrity", "server/routes/loanMarket.routes.ts");

if (failures.length) {
  for (const message of failures) console.error(`✗ ${message}`);
  console.error(`\n${failures.length} loan payment integrity check(s) failed.`);
  process.exit(1);
}
console.log("\nAll loan payment integrity checks passed.");

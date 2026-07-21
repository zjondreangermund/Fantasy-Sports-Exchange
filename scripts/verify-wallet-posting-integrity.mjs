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

requirePatterns("wallet posting migration has durable claims and payout links", "drizzle/0008_wallet_posting_integrity.sql", [
  "CREATE TABLE IF NOT EXISTS app.wallet_posting_claims",
  "posting_key text NOT NULL UNIQUE",
  "transaction_id integer UNIQUE REFERENCES app.transactions(id)",
  "payout_posting_key text",
  "competition_entries_payout_transaction_unique",
  "Backfilled legacy tournament payout",
]);

requirePatterns("runtime startup prepares wallet posting schema", "server/runtime-schema.ts", [
  "ensureWalletPostingSchema",
  "await ensureWalletPostingSchema();",
]);

requirePatterns("posting service claims and verifies exactly once", "server/services/walletPosting.ts", [
  "ON CONFLICT (posting_key) DO NOTHING",
  "verifyExistingPosting",
  "Wallet posting key was reused with different user or amount",
  "UPDATE app.wallets SET balance = balance + ${amount}",
  "external_transaction_id",
  "UPDATE app.wallet_posting_claims",
  "getWalletPostingIntegrityReport",
  "duplicateLegacyTournamentPayouts",
  "orphanedTournamentClaims",
  "orphaned_tournament_payout_claim",
]);

requirePatterns("tournament settlement uses deterministic posting claims", "server/routes/economyIntegrity.routes.ts", [
  "tournamentPayoutPostingKey(competitionId, entryId)",
  "postWalletAmountExactlyOnce(tx",
  "payout_posting_key = ${posting.postingKey}",
  "payout_transaction_id = ${posting.transactionId}",
  "Tournament settlement already completed and verified",
  "Completed tournament payout state no longer matches calculated rankings",
  'app.get("/api/admin/wallet-postings/integrity"',
]);
forbidPatterns("tournament settlement has no direct wallet credit bypass", "server/routes/economyIntegrity.routes.ts", [
  "set balance = balance + ${payout}",
  "Winner wallet not found for user",
]);

requirePatterns("administrator adjustments require explicit idempotency", "server/routes/tournamentCreator.routes.ts", [
  'req.headers["idempotency-key"] || req.body?.idempotencyKey',
  "adminAdjustmentPostingKey(adminId, rawRequestKey)",
  "postWalletAmountExactlyOnce(tx",
  "bindActor: true",
  'auditAction: "admin.wallet.adjusted"',
]);
const creator = read("server/routes/tournamentCreator.routes.ts");
const walletStart = creator.indexOf('app.post("/api/admin/test-console/wallet"');
const walletEnd = creator.indexOf('app.delete("/api/admin/test-console/cleanup"', walletStart);
const walletBlock = walletStart >= 0 && walletEnd > walletStart ? creator.slice(walletStart, walletEnd) : "";
if (!walletBlock) fail("administrator wallet adjustment route block was not found");
else if (walletBlock.includes("insert into app.wallets") || walletBlock.includes("insert into app.transactions")) fail("administrator wallet adjustment still mutates wallet or ledger directly");
else pass("administrator wallet adjustment delegates all money movement to posting service");

requirePatterns("paid tournament history cannot be deleted or bypass-completed", "server/routes/tournamentCreator.routes.ts", [
  "hasTournamentWalletPostingHistory",
  "Settled tournaments with wallet posting history cannot be deleted",
  'if (status === "completed") return res.status(400)',
  "protectedSettledTournaments",
]);

requirePatterns("general tournament administration cannot set completed", "server/routes.ts", [
  'if (requestedStatus === "completed") return res.status(400)',
  '"Use the settlement action to complete a tournament"',
]);
forbidPatterns("monolithic router contains no tournament mutation bypass", "server/routes.ts", [
  'app.post("/api/competitions/join"',
  'app.post("/api/admin/competitions/settle/:id"',
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

checkSingleRoute("post", "/api/competitions/join", "server/routes/economyIntegrity.routes.ts");
checkSingleRoute("post", "/api/admin/competitions/settle/:id", "server/routes/economyIntegrity.routes.ts");
checkSingleRoute("post", "/api/admin/test-console/wallet", "server/routes/tournamentCreator.routes.ts");
checkSingleRoute("get", "/api/admin/wallet-postings/integrity", "server/routes/economyIntegrity.routes.ts");

if (failures.length) {
  for (const message of failures) console.error(`✗ ${message}`);
  console.error(`\n${failures.length} wallet posting integrity check(s) failed.`);
  process.exit(1);
}
console.log("\nAll wallet posting integrity checks passed.");

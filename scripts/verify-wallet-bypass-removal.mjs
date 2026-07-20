#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

function listSourceFiles(relativeDir) {
  const absoluteDir = resolve(root, relativeDir);
  const results = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) results.push(...listSourceFiles(relativePath));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) results.push(relativePath);
  }
  return results;
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const serverFiles = listSourceFiles("server");
const serverBodies = new Map(serverFiles.map((path) => [path, read(path)]));

const failures = [];
const pass = (message) => console.log(`✓ ${message}`);
const fail = (message) => failures.push(message);

function checkSingleRoute(method, path, owner) {
  const regex = new RegExp(`\\bapp\\.${method}\\(\\s*["']${escapeRegExp(path)}["']`, "g");
  const matches = [];
  for (const [file, body] of serverBodies) {
    const count = [...body.matchAll(regex)].length;
    for (let index = 0; index < count; index += 1) matches.push(file);
  }
  if (matches.length !== 1 || matches[0] !== owner) {
    fail(`${method.toUpperCase()} ${path} must be registered exactly once by ${owner}; found ${matches.length ? matches.join(", ") : "none"}`);
  } else {
    pass(`${method.toUpperCase()} ${path} has one authorized owner`);
  }
}

checkSingleRoute("post", "/api/wallet/deposit", "server/routes/depositVerification.routes.ts");
checkSingleRoute("post", "/api/wallet/withdraw", "server/routes/withdrawalPayout.routes.ts");
checkSingleRoute("get", "/api/wallet/withdrawals", "server/routes/withdrawalPayout.routes.ts");
checkSingleRoute("post", "/api/admin/withdrawals/:id/status", "server/routes/withdrawalPayout.routes.ts");

const walletRoutesPath = "server/routes/wallet.routes.ts";
const walletRoutes = read(walletRoutesPath);
const walletRouteRegistrations = [...walletRoutes.matchAll(/\bapp\.(?:get|post|put|patch|delete)\(/g)].length;
if (walletRouteRegistrations !== 2) fail(`${walletRoutesPath} must contain exactly two read-only route registrations; found ${walletRouteRegistrations}`);
else pass("generic wallet router contains only wallet and transaction reads");

for (const required of [
  'app.get("/api/wallet", requireAuth',
  'app.get("/api/transactions", requireAuth',
]) {
  if (!walletRoutes.includes(required)) fail(`${walletRoutesPath} is missing ${required}`);
}

for (const forbidden of [
  'app.post("/api/wallet/deposit"',
  'app.post("/api/wallet/withdraw"',
  'app.get("/api/wallet/withdrawals"',
  'app.post("/api/admin/withdrawals/:id/status"',
  "withdrawalRequests",
  "idempotencyKeys",
  "auditLogs",
  "withdrawal_hold",
  "deposit_verification",
]) {
  if (walletRoutes.includes(forbidden)) fail(`${walletRoutesPath} contains forbidden mutation surface: ${forbidden}`);
}

const ledgerPath = "server/services/walletLedger.ts";
const ledger = read(ledgerPath);
const exportedFunctions = [...ledger.matchAll(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]);
if (exportedFunctions.length !== 1 || exportedFunctions[0] !== "applyMarketplaceTradeLedger") {
  fail(`${ledgerPath} must export only applyMarketplaceTradeLedger; found ${exportedFunctions.join(", ") || "none"}`);
} else {
  pass("shared wallet ledger exports only the marketplace transaction helper");
}

const removedSymbols = [
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
];
for (const symbol of removedSymbols) {
  const occurrences = [];
  for (const [file, body] of serverBodies) if (body.includes(symbol)) occurrences.push(file);
  if (occurrences.length) fail(`removed wallet symbol ${symbol} still exists in ${occurrences.join(", ")}`);
}
if (!removedSymbols.some((symbol) => ledger.includes(symbol))) pass("obsolete wallet mutation and reconciliation exports are absent");

const walletLedgerImports = [];
for (const [file, body] of serverBodies) {
  if (body.includes("walletLedger.js")) walletLedgerImports.push(file);
}
if (walletLedgerImports.length !== 1 || walletLedgerImports[0] !== "server/routes/marketplace.routes.ts") {
  fail(`walletLedger.js must be imported only by marketplace.routes.ts; found ${walletLedgerImports.join(", ") || "none"}`);
} else if (!read(walletLedgerImports[0]).includes("applyMarketplaceTradeLedger")) {
  fail("marketplace.routes.ts imports walletLedger.js without the authorized helper");
} else {
  pass("only marketplace routes import the shared wallet ledger helper");
}

const adminIntegrity = read("server/routes/adminIntegrity.routes.ts");
if (!adminIntegrity.includes("getWalletReconciliationReport") || !adminIntegrity.includes("repairSafeMissingWallets")) {
  fail("admin wallet integrity routes must use the hold-aware reconciliation service");
} else if (adminIntegrity.includes("getWalletIntegrityReport") || adminIntegrity.includes("repairMissingWalletsFromLedger")) {
  fail("admin wallet integrity routes still reference obsolete reconciliation helpers");
} else {
  pass("administrator wallet diagnostics use hold-aware reconciliation only");
}

if (failures.length) {
  for (const message of failures) console.error(`✗ ${message}`);
  console.error(`\n${failures.length} wallet bypass removal check(s) failed.`);
  process.exit(1);
}

console.log("\nAll wallet bypass removal checks passed.");

#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];
const pass = (message) => console.log(`✓ ${message}`);
const fail = (message) => failures.push(message);

function listSourceFiles(relativeDir) {
  const results = [];
  for (const entry of readdirSync(resolve(root, relativeDir), { withFileTypes: true })) {
    const path = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) results.push(...listSourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) results.push(path);
  }
  return results;
}

function requirePatterns(name, path, patterns) {
  const body = read(path);
  const missing = patterns.filter((pattern) => !body.includes(pattern));
  if (missing.length) fail(`${name}: ${path} missing ${missing.join(", ")}`);
  else pass(name);
}

function forbidPatterns(name, path, patterns) {
  const body = read(path);
  const found = patterns.filter((pattern) => body.includes(pattern));
  if (found.length) fail(`${name}: ${path} contains ${found.join(", ")}`);
  else pass(name);
}

requirePatterns("forge migration records operation, burn items, fee and mint links", "drizzle/0010_forge_operation_integrity.sql", [
  "CREATE TABLE IF NOT EXISTS app.forge_operations",
  "source_signature text NOT NULL UNIQUE",
  "fee_transaction_id integer UNIQUE",
  "minted_card_id integer UNIQUE",
  "CREATE TABLE IF NOT EXISTS app.forge_burn_items",
  "card_id integer NOT NULL UNIQUE",
]);

requirePatterns("runtime startup prepares forge schema", "server/runtime-schema.ts", [
  "ensureForgeOperationSchema",
  "await ensureForgeOperationSchema();",
]);

requirePatterns("forge service is atomic and replay-safe", "server/services/forgeOperation.ts", [
  "pg_advisory_xact_lock(hashtext(${sourceSignature}))",
  "pg_advisory_xact_lock(hashtext(${userId}), ${playerId})",
  "source_signature = ${sourceSignature}",
  "verifyCompletedForgeOperation",
  "postWalletAmountExactlyOnce(tx",
  "INSERT INTO app.forge_burn_items",
  "UPDATE app.player_cards",
  "INSERT INTO app.player_cards",
  "status = 'completed'",
  "getForgeOperationIntegrityReport",
  "orphaned_forge_fee_claim",
  "unclaimedLegacyTransactions",
]);

requirePatterns("forge blocks protected cards", "server/services/forgeOperation.ts", [
  "competition_lock",
  "status::text IN ('draft', 'live')",
  "pending_swap",
  "l.status IN ('open', 'active')",
  "active_lineup",
  "Remove forge cards from protected use first",
]);

requirePatterns("forge route delegates all money and minting to service", "server/routes/retention.routes.ts", [
  "executeCommonToRareForge(tx, { userId, cardIds })",
  "getBlockedForgeCardIds(userId, commonCardIds)",
  'app.get("/api/admin/forge/integrity"',
  "getForgeOperationIntegrityReport",
  "protectedCardsExcluded: true",
]);

const routes = read("server/routes/retention.routes.ts");
const forgeStart = routes.indexOf('app.post("/api/forge/burn-same-player"');
const forgeEnd = routes.indexOf('app.get("/api/admin/forge/integrity"', forgeStart);
const forgeBlock = forgeStart >= 0 && forgeEnd > forgeStart ? routes.slice(forgeStart, forgeEnd) : "";
if (!forgeBlock) fail("forge route block was not found");
else {
  const forbidden = [
    "storage.createPlayerCard",
    "tx.update(wallets)",
    "tx.insert(transactions)",
    "tx.insert(playerCards)",
    "set({ balance:",
  ].filter((pattern) => forgeBlock.includes(pattern));
  if (forbidden.length) fail(`forge route still contains direct mutations: ${forbidden.join(", ")}`);
  else pass("forge route contains no direct wallet, ledger or mint bypass");
}

forbidPatterns("retention route no longer imports direct forge mutation tables", "server/routes/retention.routes.ts", [
  "auditLogs, playerCards, transactions, wallets",
  "storage.createPlayerCard",
  "Forge burn fee for player:",
]);

const routeBodies = new Map(listSourceFiles("server").map((path) => [path, read(path)]));
function checkSingleRoute(method, route, owner) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\bapp\\.${method}\\(\\s*["']${escaped}["']`, "g");
  const matches = [];
  for (const [path, body] of routeBodies) {
    const count = [...body.matchAll(regex)].length;
    for (let index = 0; index < count; index += 1) matches.push(path);
  }
  if (matches.length !== 1 || matches[0] !== owner) fail(`${method.toUpperCase()} ${route} must be owned only by ${owner}; found ${matches.join(", ") || "none"}`);
  else pass(`${method.toUpperCase()} ${route} has one authorized owner`);
}

checkSingleRoute("post", "/api/forge/burn-same-player", "server/routes/retention.routes.ts");
checkSingleRoute("get", "/api/admin/forge/integrity", "server/routes/retention.routes.ts");

if (failures.length) {
  for (const message of failures) console.error(`✗ ${message}`);
  console.error(`\n${failures.length} forge operation integrity check(s) failed.`);
  process.exit(1);
}
console.log("\nAll forge operation integrity checks passed.");

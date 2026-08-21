#!/usr/bin/env node
import fs from "node:fs";

const start = fs.readFileSync("start.sh", "utf8");
const patcher = fs.readFileSync("scripts/apply-reconcile-supply-overflow-fix.mjs", "utf8");
const reconcile = fs.readFileSync("scripts/reconcile-production-card-inventory-v2.mjs", "utf8");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

// The old overflow repair remains available for a deliberate offline/manual
// recovery pass, but production startup must never execute it automatically.
requireText(patcher, "LEGACY_SUPPLY_OVERFLOW_RECOVERY_V1", "overflow patch marker is missing");
requireText(patcher, "strongCardProvenance", "strong legitimate-card provenance classifier is missing");
requireText(patcher, "Legacy / Supply Archive", "historical overflow archive player is missing");
requireText(patcher, "archiveFplId = -Math.max", "archive identities are not isolated from live FPL identities");
requireText(patcher, "wallet-trade-history", "traded-card preservation is missing");
requireText(patcher, "prize|reward|referral|replacement|auction|market|loan|swap|forge", "prize/reward/trade provenance protection is incomplete");
requireText(patcher, "removeOwnership = item.knownTestUser && !item.strong", "offline overflow cleanup is not limited to weak known-test ownership first");
requireText(patcher, "rewriteLineupWithout", "offline repair cannot clean a removed test card from a current lineup");
requireText(patcher, "preservedHistorical", "offline repair does not preserve referenced historical cards");

rejectText(start, "node scripts/apply-reconcile-supply-overflow-fix.mjs", "legacy overflow patcher must not run in production startup");
rejectText(start, "node scripts/reconcile-production-card-inventory-v2.mjs", "global card reconciliation must not run in production startup");
requireText(start, "node scripts/audit-and-recover-normal-user-cards.mjs", "normal-user recovery audit is missing from startup");
requireText(start, "node scripts/snapshot-normal-user-card-ownership.mjs", "normal-user ownership snapshot is missing from startup");

// CI still applies the patch in its disposable checkout to make sure the manual
// tool remains syntactically safe if it is ever needed against a cloned backup.
requireText(reconcile, "LEGACY_SUPPLY_OVERFLOW_RECOVERY_V1", "offline reconciliation was not patched before verification");
requireText(reconcile, "resolveSupplyOverflow", "patched offline reconciliation does not resolve over-cap legacy pairs");
requireText(reconcile, "Supply cap still exceeded after overflow recovery", "patched offline reconciliation does not fail closed if recovery cannot restore the cap");
rejectText(reconcile, "Supply cap exceeded after test-card cleanup for player", "old immediate supply-cap abort is still active after patching");

if (failures.length) {
  console.error("Legacy supply overflow/offline-only verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Legacy supply overflow verified as offline-only: production startup cannot run global ownership reconciliation, while the manual backup repair path remains validated.");

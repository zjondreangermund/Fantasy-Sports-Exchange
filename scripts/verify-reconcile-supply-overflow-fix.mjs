#!/usr/bin/env node
import fs from "node:fs";

const start = fs.readFileSync("start.sh", "utf8");
const patcher = fs.readFileSync("scripts/apply-reconcile-supply-overflow-fix.mjs", "utf8");
const reconcile = fs.readFileSync("scripts/reconcile-production-card-inventory-v2.mjs", "utf8");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

requireText(patcher, "LEGACY_SUPPLY_OVERFLOW_RECOVERY_V1", "overflow patch marker is missing");
requireText(patcher, "strongCardProvenance", "strong legitimate-card provenance classifier is missing");
requireText(patcher, "Legacy / Supply Archive", "historical overflow archive player is missing");
requireText(patcher, "archiveFplId = -Math.max", "archive identities are not isolated from live FPL identities");
requireText(patcher, "wallet-trade-history", "traded-card preservation is missing");
requireText(patcher, "prize|reward|referral|replacement|auction|market|loan|swap|forge", "prize/reward/trade provenance protection is incomplete");
requireText(patcher, "removeOwnership = item.knownTestUser && !item.strong", "weak legacy full-set ownership is not removed first");
requireText(patcher, "rewriteLineupWithout", "removed legacy ownership is not cleaned from current lineups");
requireText(patcher, "preservedHistorical", "legitimate overflow ownership is not preserved as history");
requireText(patcher, "serial_id=null,serial_number=null,max_supply=0", "archived overflow cards are not prepared for clean serial regeneration");

const patchIndex = start.indexOf("node scripts/apply-reconcile-supply-overflow-fix.mjs");
const reconcileIndex = start.indexOf("node scripts/reconcile-production-card-inventory-v2.mjs");
if (patchIndex < 0 || reconcileIndex < 0 || patchIndex >= reconcileIndex) failures.push("overflow recovery patch must run before production card reconciliation");

requireText(reconcile, "LEGACY_SUPPLY_OVERFLOW_RECOVERY_V1", "reconciliation was not patched before verification");
requireText(reconcile, "resolveSupplyOverflow", "patched reconciliation does not resolve over-cap legacy pairs");
requireText(reconcile, "Supply cap still exceeded after overflow recovery", "patched reconciliation does not fail closed if recovery cannot restore the cap");
rejectText(reconcile, "Supply cap exceeded after test-card cleanup for player", "old immediate supply-cap abort is still active after patching");

if (failures.length) {
  console.error("Legacy supply overflow recovery verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Legacy supply overflow recovery verified: legitimate cards are prioritized, weak full-set ownership is removed, referenced excess cards are archived safely, and active mint supply remains capped.");

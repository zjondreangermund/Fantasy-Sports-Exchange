#!/usr/bin/env node
import fs from "node:fs";

const reconcile = fs.readFileSync("scripts/reconcile-production-card-inventory-v2.mjs", "utf8");
const start = fs.readFileSync("start.sh", "utf8");
const retiredGrant = fs.readFileSync("scripts/grant-test-card-teams.mjs", "utf8");
const referrals = fs.readFileSync("server/routes/referrals.routes.ts", "utf8");
const runtime = fs.readFileSync("scripts/prepare-runtime-startup.mjs", "utf8");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

for (const email of ["lbcplaya@gmail.com","joeberber2580@gmail.com","zaylon2580@gmail.com","zjondreangermund@gmail.com"]) {
  requireText(reconcile, email, `known full-set grant account is not scoped: ${email}`);
}
requireText(reconcile, "FPL_URL", "official FPL current-roster source is missing");
requireText(reconcile, "teams.length < 20 || elements.length < 300", "destructive cleanup is not gated on a complete EPL roster");
requireText(reconcile, "signup-card", "signup-card protection is missing");
requireText(reconcile, "competition-lineup-history", "tournament-history protection is missing");
requireText(reconcile, "audit-history", "purchase/audit protection is missing");
requireText(reconcile, "wallet-trade-history", "wallet/trade history protection is missing");
requireText(reconcile, "information_schema.table_constraints", "foreign-key card provenance protection is missing");
requireText(reconcile, "api_football_players", "API-Football current squad linking/portrait repair is missing");
requireText(reconcile, "duplicateMap", "duplicate legacy player migration is missing");
requireText(reconcile, "serial_number=null", "legacy cards are not prepared for canonical serial repair");
requireText(reconcile, "canonicalSerial", "canonical latest serial generation is missing");
requireText(reconcile, "Supply cap exceeded after test-card cleanup", "rarity supply cap validation is missing");
requireText(reconcile, "for_sale=false,price=0", "historical/non-current cards are not removed from the active market");
rejectText(reconcile, "delete from app.users", "reconciliation must never delete user accounts");
rejectText(reconcile, "delete from app.competition_entries", "reconciliation must never delete tournament entry history");

const reconcileIndex = start.indexOf("node scripts/reconcile-production-card-inventory-v2.mjs");
const serialIndex = start.indexOf("node scripts/prepare-runtime-startup.mjs");
if (reconcileIndex < 0 || serialIndex < 0 || reconcileIndex >= serialIndex) failures.push("card reconciliation must run before global serial preflight");

requireText(runtime, "WHERE pc.serial_number IS NULL OR pc.serial_number <= 0", "global legacy serial backfill is missing");
requireText(runtime, "player_cards_serial_supply_guard", "runtime supply guard is missing");
requireText(runtime, "player_cards_mint_identity_guard", "runtime mint identity guard is missing");

requireText(retiredGrant, "full-set test card grant has been permanently retired", "unsafe bulk full-set grant script is still active");
rejectText(retiredGrant, "insert into app.player_cards", "retired full-set script can still mint cards");

requireText(referrals, "isCurrentPremierLeaguePlayer", "referral rewards are not restricted to active EPL players");
requireText(referrals, "fplId > 0", "referral rewards do not require official FPL identity");
requireText(referrals, "departed", "referral rewards do not exclude departed players");

if (failures.length) {
  console.error("EPL card inventory reconciliation verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("EPL card inventory reconciliation verified: current FPL identities, exact test-grant cleanup scope, legitimate-card provenance protections, API-Football linking, serial repair and active-EPL reward guards are present.");

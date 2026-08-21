#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const reconcile = fs.readFileSync("scripts/reconcile-production-card-inventory-v2.mjs", "utf8");
const refresh = fs.readFileSync("scripts/refresh-epl-api-football-directory-startup.mjs", "utf8");
const start = fs.readFileSync("start.sh", "utf8");
const retiredGrant = fs.readFileSync("scripts/grant-test-card-teams.mjs", "utf8");
const referrals = fs.readFileSync("server/routes/referrals.routes.ts", "utf8");
const runtime = fs.readFileSync("scripts/prepare-runtime-startup.mjs", "utf8");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

for (const file of ["scripts/reconcile-production-card-inventory-v2.mjs", "scripts/refresh-epl-api-football-directory-startup.mjs"]) {
  try { execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }); }
  catch (error) { failures.push(`${file} is not valid Node.js syntax: ${String(error?.stderr || error?.message || error)}`); }
}

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

requireText(refresh, 'process.env.API_FOOTBALL_LEAGUE_ID = "39"', "startup API-Football directory refresh is not locked to EPL league 39");
requireText(refresh, 'runApiFootballSync("players")', "startup does not refresh API-Football current squads");
requireText(refresh, "normal scheduler will retry", "API-Football startup refresh does not have a safe retry fallback");

const refreshIndex = start.indexOf("node scripts/refresh-epl-api-football-directory-startup.mjs");
const reconcileIndex = start.indexOf("node scripts/reconcile-production-card-inventory-v2.mjs");
const serialIndex = start.indexOf("node scripts/prepare-runtime-startup.mjs");
if (refreshIndex < 0 || reconcileIndex < 0 || serialIndex < 0 || !(refreshIndex < reconcileIndex && reconcileIndex < serialIndex)) {
  failures.push("startup order must be API-Football EPL directory refresh -> card reconciliation -> global serial preflight");
}

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

console.log("EPL card inventory reconciliation verified: fresh API-Football EPL directory, current FPL identities, exact test-grant cleanup scope, legitimate-card provenance protections, serial repair and active-EPL reward guards are present.");

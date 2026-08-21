#!/usr/bin/env node
import "./apply-finalize-locked-card-safety.mjs";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const reconcile = fs.readFileSync("scripts/reconcile-production-card-inventory-v2.mjs", "utf8");
const refresh = fs.readFileSync("scripts/refresh-epl-api-football-directory-startup.mjs", "utf8");
const finalize = fs.readFileSync("scripts/finalize-full-set-test-card-cleanup.mjs", "utf8");
const lockSafety = fs.readFileSync("scripts/apply-finalize-locked-card-safety.mjs", "utf8");
const start = fs.readFileSync("start.sh", "utf8");
const retiredGrant = fs.readFileSync("scripts/grant-test-card-teams.mjs", "utf8");
const referrals = fs.readFileSync("server/routes/referrals.routes.ts", "utf8");
const runtime = fs.readFileSync("scripts/prepare-runtime-startup.mjs", "utf8");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

for (const file of [
  "scripts/reconcile-production-card-inventory-v2.mjs",
  "scripts/refresh-epl-api-football-directory-startup.mjs",
  "scripts/finalize-full-set-test-card-cleanup.mjs",
  "scripts/apply-finalize-locked-card-safety.mjs",
]) {
  try { execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }); }
  catch (error) { failures.push(`${file} is not valid Node.js syntax: ${String(error?.stderr || error?.message || error)}`); }
}

for (const email of ["lbcplaya@gmail.com","joeberber2580@gmail.com","zaylon2580@gmail.com","zjondreangermund@gmail.com"]) {
  requireText(reconcile, email, `known full-set grant account is not scoped in reconciliation: ${email}`);
  requireText(finalize, email, `known full-set grant account is not scoped in final cleanup: ${email}`);
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

requireText(finalize, "competition_entries", "final cleanup does not preserve tournament-winning cards");
requireText(finalize, "prize_card_id", "final cleanup does not preserve explicit winning-card IDs");
requireText(finalize, "user_onboarding", "final cleanup does not preserve signup cards");
requireText(finalize, "daily_login_rewards", "final cleanup does not preserve earned weekly rewards");
requireText(finalize, "player_replacement_claims", "final cleanup does not preserve replacement cards");
requireText(finalize, "wallet-transaction", "final cleanup does not protect cards with real wallet provenance");
requireText(finalize, "Legacy / Test Grant Archive", "removed full-set cards are not isolated from live EPL mint supply");
requireText(finalize, "owner_id=null", "removed full-set cards are not removed from user Collection ownership");
requireText(finalize, "LEGACY-TEST-", "archived test cards do not receive isolated audit serials");
requireText(finalize, "removeFromCurrentLineup", "retired full-set cards are not removed from the user's active lineup");
requireText(finalize, "FINAL_FULL_SET_LOCK_SAFETY_V1", "final cleanup is missing competition-lock safety");
requireText(finalize, "active-competition-lock:", "active competition-locked test cards are not deferred safely");
requireText(finalize, "deferredLockedTestCards", "final cleanup does not report deferred locked test cards");
requireText(lockSafety, "completed','cancelled", "lock safety does not release completed/cancelled competition locks");
requireText(lockSafety, "expires_at <= now()", "lock safety does not release expired locks");
requireText(lockSafety, "not exists (select 1 from app.competitions", "lock safety does not release orphaned competition locks");
rejectText(finalize, "delete from app.users", "final cleanup must never delete user accounts");
rejectText(finalize, "delete from app.competition_entries", "final cleanup must never delete tournament history");

const refreshIndex = start.indexOf("node scripts/refresh-epl-api-football-directory-startup.mjs");
const reconcileIndex = start.indexOf("node scripts/reconcile-production-card-inventory-v2.mjs");
const lockSafetyIndex = start.indexOf("node scripts/apply-finalize-locked-card-safety.mjs");
const finalizeIndex = start.indexOf("node scripts/finalize-full-set-test-card-cleanup.mjs");
const serialIndex = start.indexOf("node scripts/prepare-runtime-startup.mjs");
if (
  refreshIndex < 0 || reconcileIndex < 0 || lockSafetyIndex < 0 || finalizeIndex < 0 || serialIndex < 0
  || !(refreshIndex < reconcileIndex && reconcileIndex < lockSafetyIndex && lockSafetyIndex < finalizeIndex && finalizeIndex < serialIndex)
) {
  failures.push("startup order must be API-Football refresh -> reconciliation -> locked-card safety -> final full-set cleanup -> global serial preflight");
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

console.log("EPL card inventory verified: fresh API-Football EPL identities, legacy supply recovery, locked-card-safe final full-set cleanup, signup/win/earned provenance protection and current serial repair are all enforced.");

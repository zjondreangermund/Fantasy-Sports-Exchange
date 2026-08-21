#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const reconcile = fs.readFileSync("scripts/reconcile-production-card-inventory-v2.mjs", "utf8");
const refresh = fs.readFileSync("scripts/refresh-epl-api-football-directory-startup.mjs", "utf8");
const reset = fs.readFileSync("scripts/reset-four-test-accounts-to-starter-common.mjs", "utf8");
const start = fs.readFileSync("start.sh", "utf8");
const retiredGrant = fs.readFileSync("scripts/grant-test-card-teams.mjs", "utf8");
const referrals = fs.readFileSync("server/routes/referrals.routes.ts", "utf8");
const runtime = fs.readFileSync("scripts/prepare-runtime-startup.mjs", "utf8");
const onboarding = fs.readFileSync("server/routes/onboarding.routes.ts", "utf8");
const marketplace = fs.readFileSync("server/routes/marketplace.routes.ts", "utf8");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

for (const file of [
  "scripts/reconcile-production-card-inventory-v2.mjs",
  "scripts/refresh-epl-api-football-directory-startup.mjs",
  "scripts/reset-four-test-accounts-to-starter-common.mjs",
]) {
  try { execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }); }
  catch (error) { failures.push(`${file} is not valid Node.js syntax: ${String(error?.stderr || error?.message || error)}`); }
}

for (const email of ["lbcplaya@gmail.com","joeberber2580@gmail.com","zaylon2580@gmail.com","zjondreangermund@gmail.com"]) {
  requireText(reconcile, email, `known full-set grant account is not scoped in reconciliation: ${email}`);
  requireText(reset, email, `known test account is not scoped in starter reset: ${email}`);
}

requireText(reconcile, "FPL_URL", "official FPL current-roster source is missing");
requireText(reconcile, "teams.length < 20 || elements.length < 300", "destructive reconciliation is not gated on a complete EPL roster");
requireText(reconcile, "api_football_players", "API-Football current squad linking/portrait repair is missing");
requireText(reconcile, "duplicateMap", "duplicate legacy player migration is missing");
requireText(reconcile, "canonicalSerial", "canonical latest serial generation is missing");
requireText(reconcile, "Supply cap exceeded after test-card cleanup", "rarity supply cap validation is missing");
requireText(reconcile, "for_sale=false,price=0", "historical/non-current cards are not removed from the active market");
rejectText(reconcile, "delete from app.users", "reconciliation must never delete user accounts");
rejectText(reconcile, "delete from app.competition_entries", "reconciliation must never delete tournament entry history");

requireText(refresh, 'process.env.API_FOOTBALL_LEAGUE_ID = "39"', "startup API-Football directory refresh is not locked to EPL league 39");
requireText(refresh, 'runApiFootballSync("players")', "startup does not refresh API-Football current squads");
requireText(refresh, "normal scheduler will retry", "API-Football startup refresh does not have a safe retry fallback");

requireText(reset, 'REPAIR_KEY = "four-test-accounts-starter-common-v1"', "four-account starter reset is not idempotent");
requireText(reset, "app.runtime_data_repairs", "starter reset does not persist a one-time repair marker");
requireText(reset, "app.api_football_players", "starter reset does not require API-Football current squad linkage");
requireText(reset, "coalesce(p.fpl_id,0) > 0", "starter reset does not require official FPL identity");
requireText(reset, "premierleague','englishpremierleague','epl", "starter reset is not restricted to current Premier League players");
requireText(reset, 'const REQUIRED_POSITIONS = ["GK", "DEF", "MID", "FWD"]', "starter reset does not guarantee one card from every required position");
requireText(reset, "const wildcard = pickPlayer(eligible", "starter reset does not grant the fifth wildcard card");
requireText(reset, "delete from app.card_locks where card_id=any", "old card locks are not released for the explicitly reset test accounts");
requireText(reset, "set card_ids='[]'::jsonb, captain_id=null", "old current lineups are not cleared for the explicitly reset test accounts");
requireText(reset, "set owner_id=null, for_sale=false, price=0", "old cards are not removed from the four test-account Collections");
requireText(reset, "insert into app.player_cards", "starter Common cards are not minted");
requireText(reset, "'common', 1, 0, 35, false, 0", "starter cards are not free, Common and non-sellable at mint");
requireText(reset, "Number(verification.total || 0) !== 5", "starter reset does not enforce exactly five owned cards afterward");
requireText(reset, "Number(verification.common || 0) !== 5", "starter reset does not enforce five Common cards afterward");
requireText(reset, "Number(verification.other || 0) !== 0", "starter reset does not reject non-Common leftovers");
requireText(reset, "Number(verification.for_sale || 0) !== 0", "starter reset does not reject sellable leftovers");
requireText(reset, "selected_cards=$1::jsonb", "onboarding starter selection is not synchronized to the replacement players");
requireText(reset, "admin.test_account_starter_reset", "starter reset audit trail is missing");
rejectText(reset, "delete from app.competition_entries", "starter reset must preserve tournament entry history");
rejectText(reset, "delete from app.users", "starter reset must never delete user accounts");

// Normal signup must continue granting Common cards that are not listed for sale.
requireText(onboarding, 'rarity: "common"', "normal signup no longer grants Common starter cards");
requireText(onboarding, "forSale: false", "normal signup starter cards are sellable at mint");
requireText(onboarding, "price: 0", "normal signup starter cards are not free");

// Common is tournament-only across the marketplace, not merely hidden in the UI.
requireText(marketplace, "isMarketplaceTradableRarity", "marketplace tradable-rarity guard is missing");
requireText(marketplace, "Common cards cannot be traded", "marketplace no longer blocks Common card trading");

const refreshIndex = start.indexOf("node scripts/refresh-epl-api-football-directory-startup.mjs");
const reconcileIndex = start.indexOf("node scripts/reconcile-production-card-inventory-v2.mjs");
const resetIndex = start.indexOf("node scripts/reset-four-test-accounts-to-starter-common.mjs");
const serialIndex = start.indexOf("node scripts/prepare-runtime-startup.mjs");
if (
  refreshIndex < 0 || reconcileIndex < 0 || resetIndex < 0 || serialIndex < 0
  || !(refreshIndex < reconcileIndex && reconcileIndex < resetIndex && resetIndex < serialIndex)
) {
  failures.push("startup order must be API-Football refresh -> EPL reconciliation -> four-account starter reset -> global serial preflight");
}
rejectText(start, "node scripts/finalize-full-set-test-card-cleanup.mjs", "obsolete full-set finalizer is still allowed to mutate the four reset accounts at startup");
rejectText(start, "node scripts/apply-finalize-locked-card-safety.mjs", "obsolete finalizer lock patch is still in the startup path");

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

console.log("EPL card inventory verified: current API-Football/FPL identity reconciliation, one-time four-account reset to exactly five non-sellable Common starters, retired full-set grants and global serial integrity are enforced.");

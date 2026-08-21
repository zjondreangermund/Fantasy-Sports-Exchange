#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const reconcile = fs.readFileSync("scripts/reconcile-production-card-inventory-v2.mjs", "utf8");
const refresh = fs.readFileSync("scripts/refresh-epl-api-football-directory-startup.mjs", "utf8");
const reset = fs.readFileSync("scripts/reset-four-test-accounts-to-starter-common.mjs", "utf8");
const snapshot = fs.readFileSync("scripts/snapshot-normal-user-card-ownership.mjs", "utf8");
const recovery = fs.readFileSync("scripts/audit-and-recover-normal-user-cards.mjs", "utf8");
const starterRecovery = fs.readFileSync("scripts/audit-starter-selection-recovery.mjs", "utf8");
const start = fs.readFileSync("start.sh", "utf8");
const retiredGrant = fs.readFileSync("scripts/grant-test-card-teams.mjs", "utf8");
const referrals = fs.readFileSync("server/routes/referrals.routes.ts", "utf8");
const runtime = fs.readFileSync("scripts/prepare-runtime-startup.mjs", "utf8");
const onboarding = fs.readFileSync("server/routes/onboarding.routes.ts", "utf8");
const cards = fs.readFileSync("server/routes/cards.routes.ts", "utf8");
const marketplace = fs.readFileSync("server/routes/marketplace.routes.ts", "utf8");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

for (const file of [
  "scripts/reconcile-production-card-inventory-v2.mjs",
  "scripts/refresh-epl-api-football-directory-startup.mjs",
  "scripts/reset-four-test-accounts-to-starter-common.mjs",
  "scripts/snapshot-normal-user-card-ownership.mjs",
  "scripts/audit-and-recover-normal-user-cards.mjs",
  "scripts/audit-starter-selection-recovery.mjs",
  "scripts/verify-starter-selection-integrity.mjs",
]) {
  try { execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }); }
  catch (error) { failures.push(`${file} is not valid Node.js syntax: ${String(error?.stderr || error?.message || error)}`); }
}

try {
  execFileSync(process.execPath, ["scripts/verify-starter-selection-integrity.mjs"], { stdio: "pipe" });
} catch (error) {
  failures.push(`starter-selection integrity regression failed: ${String(error?.stderr || error?.message || error)}`);
}

const testEmails = ["lbcplaya@gmail.com","joeberber2580@gmail.com","zaylon2580@gmail.com","zjondreangermund@gmail.com"];
for (const email of testEmails) {
  requireText(reconcile, email, `known full-set grant account is not scoped in offline reconciliation: ${email}`);
  requireText(reset, email, `known test account is not scoped in starter reset: ${email}`);
  requireText(snapshot, email, `normal-user snapshot does not exclude test account: ${email}`);
  requireText(recovery, email, `normal-user recovery does not exclude test account: ${email}`);
}

// Keep the old reconciliation available only as an offline/manual repair tool.
// Production startup must not invoke it because normal-user ownership is immutable
// outside explicit gameplay/economy actions.
requireText(reconcile, "FPL_URL", "offline reconciliation source is missing");
requireText(reconcile, "duplicateMap", "offline duplicate-player migration is missing");
requireText(reconcile, "canonicalSerial", "offline serial repair support is missing");
rejectText(reconcile, "delete from app.users", "offline reconciliation must never delete user accounts");
rejectText(reconcile, "delete from app.competition_entries", "offline reconciliation must never delete tournament entry history");
rejectText(start, "node scripts/reconcile-production-card-inventory-v2.mjs", "global EPL card reconciliation must never run during production startup");
rejectText(start, "node scripts/apply-reconcile-supply-overflow-fix.mjs", "legacy overflow ownership cleanup must never run during production startup");

requireText(refresh, 'process.env.API_FOOTBALL_LEAGUE_ID = "39"', "startup API-Football directory refresh is not locked to EPL league 39");
requireText(refresh, 'runApiFootballSync("players")', "startup does not refresh API-Football current squads");
requireText(refresh, "normal scheduler will retry", "API-Football startup refresh does not have a safe retry fallback");

// The historical four-account reset is manual/offline only. It must never run
// during production startup because it destroys confirmed signup selections.
requireText(reset, 'REPAIR_KEY = "four-test-accounts-starter-common-v1"', "four-account starter reset is not idempotent");
requireText(reset, "app.runtime_data_repairs", "starter reset does not persist a one-time repair marker");
requireText(reset, 'process.env.ALLOW_HISTORICAL_TEST_ACCOUNT_RESET !== "true"', "historical test-account reset can run without explicit destructive-operation approval");
requireText(reset, "set owner_id=null, for_sale=false, price=0", "test-account reset no longer removes old test ownership safely");
requireText(reset, "insert into app.player_cards", "starter Common cards are not minted");
requireText(reset, "Number(verification.total || 0) !== 5", "starter reset does not enforce exactly five cards afterward");
rejectText(reset, "delete from app.competition_entries", "starter reset must preserve tournament entry history");
rejectText(reset, "delete from app.users", "starter reset must never delete user accounts");
rejectText(start, "node scripts/reset-four-test-accounts-to-starter-common.mjs", "historical test-account starter reset must never run during production startup");

// Normal-user snapshots are ownership evidence only and must never mutate cards.
requireText(snapshot, "card_ownership_snapshot_batches", "normal-user ownership snapshot batch table is missing");
requireText(snapshot, "card_ownership_snapshot_items", "normal-user ownership snapshot item table is missing");
requireText(snapshot, "pc.owner_id is not null", "snapshot does not capture owned cards");
requireText(snapshot, "<> all($1::text[])", "snapshot is not excluding the four test accounts");
rejectText(snapshot.toLowerCase(), "update app.player_cards", "snapshot must never update player_cards");
rejectText(snapshot.toLowerCase(), "delete from app.player_cards", "snapshot must never delete player_cards");
rejectText(snapshot.toLowerCase(), "insert into app.player_cards", "snapshot must never mint player_cards");

// Recovery defaults to a dry-run. Applying requires an explicit backup database,
// and even then only restores a NULL owner; it never overwrites another owner.
requireText(recovery, "CARD_RECOVERY_APPLY", "explicit recovery apply switch is missing");
requireText(recovery, "CARD_RECOVERY_SOURCE_DATABASE_URL", "backup recovery source is missing");
requireText(recovery, "APPLY && !SOURCE_DATABASE_URL", "recovery can apply without a backup source");
requireText(recovery, "where id=$2 and owner_id is null", "recovery can overwrite a current card owner");
requireText(recovery, "neverOverwritesCurrentOwner: true", "recovery safety report does not guarantee owner preservation");
requireText(recovery, "neverTouchesFourTestAccounts: true", "recovery safety report does not exclude test accounts");
rejectText(recovery.toLowerCase(), "delete from app.player_cards", "recovery must never delete player_cards");
rejectText(recovery.toLowerCase(), "delete from app.users", "recovery must never delete users");
rejectText(recovery.toLowerCase(), "delete from app.competition_entries", "recovery must never delete tournament history");

// Starter recovery inspection is strictly read-only and reports original-card
// candidates only when independent account ownership evidence exists.
requireText(starterRecovery, 'await client.query("begin read only")', "starter recovery audit is not protected by a read-only transaction");
requireText(starterRecovery, "competition-entry", "starter recovery audit does not inspect tournament ownership evidence");
requireText(starterRecovery, "ownership-snapshot", "starter recovery audit does not inspect snapshot ownership evidence");
requireText(starterRecovery, "action=manual-approval-required", "starter recovery can restore cards without explicit approval");
rejectText(starterRecovery.toLowerCase(), "update app.player_cards", "starter recovery audit must never update player_cards");
rejectText(starterRecovery.toLowerCase(), "delete from app.player_cards", "starter recovery audit must never delete player_cards");
rejectText(starterRecovery.toLowerCase(), "insert into app.player_cards", "starter recovery audit must never mint player_cards");

// Collection endpoints are read-only: opening the vault must never mint random
// cards, seed players, or alter the user's confirmed signup selections.
requireText(cards, "const cards = await storage.getUserCards(userId);", "Collection no longer reads the existing owned cards directly");
rejectText(cards, "storage.createPlayerCard(", "Collection can mint cards during a read request");
rejectText(cards, "storage.getRandomPlayers(", "Collection can select random starter players");
rejectText(cards, "seedDatabase(", "Collection can mutate player data during a read request");

// Normal signup grants exactly the chosen Common cards and records the choice,
// mint, completion flag, and recovery evidence in one locked transaction.
requireText(onboarding, 'rarity: "common"', "normal signup no longer grants Common starter cards");
requireText(onboarding, "forSale: false", "normal signup starter cards are sellable at mint");
requireText(onboarding, "price: 0", "normal signup starter cards are not free");
requireText(onboarding, "await db.transaction(async (tx: any)", "starter selection and minting are not atomic");
requireText(onboarding, "for update", "starter selection is not protected against concurrent confirmation");
requireText(onboarding, "onboarding.starter_selection_confirmed", "confirmed starter choices do not have a durable audit trail");
requireText(onboarding, "starterCardIds: grantResult.cardIds", "confirmed starter-card IDs are missing from recovery evidence");
requireText(marketplace, "isMarketplaceTradableRarity", "marketplace tradable-rarity guard is missing");
requireText(marketplace, "Common cards cannot be traded", "marketplace no longer blocks Common card trading");

const refreshIndex = start.indexOf("node scripts/refresh-epl-api-football-directory-startup.mjs");
const auditIndex = start.indexOf("node scripts/audit-and-recover-normal-user-cards.mjs");
const starterAuditIndex = start.indexOf("node scripts/audit-starter-selection-recovery.mjs");
const snapshotIndex = start.indexOf("node scripts/snapshot-normal-user-card-ownership.mjs");
const serialIndex = start.indexOf("node scripts/prepare-runtime-startup.mjs");
if (
  refreshIndex < 0 || auditIndex < 0 || starterAuditIndex < 0 || snapshotIndex < 0 || serialIndex < 0
  || !(refreshIndex < auditIndex && auditIndex < starterAuditIndex && starterAuditIndex < snapshotIndex && snapshotIndex < serialIndex)
) {
  failures.push("startup order must be API-Football refresh -> normal-user audit -> read-only starter recovery audit -> normal-user snapshot -> serial preflight");
}
rejectText(start, "node scripts/finalize-full-set-test-card-cleanup.mjs", "obsolete full-set finalizer is still allowed at startup");
rejectText(start, "node scripts/apply-finalize-locked-card-safety.mjs", "obsolete finalizer lock patch is still in the startup path");

requireText(runtime, "WHERE pc.serial_number IS NULL OR pc.serial_number <= 0", "global legacy serial backfill is missing");
requireText(runtime, "player_cards_serial_supply_guard", "runtime supply guard is missing");
requireText(runtime, "player_cards_mint_identity_guard", "runtime mint identity guard is missing");
rejectText(runtime.toLowerCase(), "set owner_id=null", "runtime serial preflight must never clear card ownership");
rejectText(runtime.toLowerCase(), "delete from app.player_cards", "runtime serial preflight must never delete cards");

requireText(retiredGrant, "full-set test card grant has been permanently retired", "unsafe bulk full-set grant script is still active");
rejectText(retiredGrant, "insert into app.player_cards", "retired full-set script can still mint cards");

requireText(referrals, "isCurrentPremierLeaguePlayer", "referral rewards are not restricted to active EPL players");
requireText(referrals, "fplId > 0", "referral rewards do not require official FPL identity");
requireText(referrals, "departed", "referral rewards do not exclude departed players");

if (failures.length) {
  console.error("EPL card ownership protection verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("EPL card ownership verified: startup never resets user cards, Collection is read-only, confirmed starter minting is atomic, ownership audits are non-destructive, and recovery requires independent evidence plus explicit approval.");

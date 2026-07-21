import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function includesAll(source, values, label) {
  for (const value of values) expect(source.includes(value), `${label} is missing: ${value}`);
}

const sync = read("scripts/sync-official-tournaments.mjs");
const scoreUpdater = read("server/services/scoreUpdater.ts");
const scoring = read("server/services/scoring.ts");
const tournamentRules = read("server/services/tournamentRules.ts");
const economy = read("server/routes/economyIntegrity.routes.ts");
const preflight = read("scripts/prepare-runtime-startup.mjs");
const legal = read("client/src/pages/legal-centre.tsx");
const app = read("client/src/App.tsx");
const sidebar = read("client/src/components/app-sidebar.tsx");
const footer = read("client/src/components/SiteFooter.tsx");
const myEntries = read("client/src/pages/my-entries.tsx");
const sharedRules = read("shared/game-rules.ts");

expect(!/delete\s+from\s+app\.competition_entries/i.test(sync), "Official tournament sync must never delete submitted tournament entries");
expect(!/delete\s+from\s+app\.competitions/i.test(sync), "Official tournament sync must update rows rather than delete/recreate them");
includesAll(sync, ["Preserved ${preservedEntries}", "resolveEnumSchema", "competition_status", "created_by_user_id is null"], "Official tournament sync");
expect(!sync.includes("public.competition_status"), "Official tournament sync must not hard-code the public enum namespace");

includesAll(scoreUpdater, [
  "entryDeadline",
  "isGameweekFinal",
  "activateCompetitionAtDeadline",
  "tiebreakMeta: { ...asObject(entry?.tiebreakMeta), scoring: snapshot }",
  "version: 2",
  'source: "official-fpl-live"',
  "captainMultiplier: 1.1",
  "unresolvedCardIds",
], "Score updater");
expect(!scoreUpdater.includes("resetForNewGameweek"), "Score updater must not reset historical gameweek scores");
expect(!scoreUpdater.includes("totalScore: 0"), "Score updater must not zero other gameweek entries");
expect(!scoreUpdater.includes("otherActiveComps"), "Score updater must not clear non-current active competitions");

includesAll(scoring, ["Captain receives +10%", "baseScore * 1.1", "rarity does NOT change football points"], "Scoring engine");
includesAll(tournamentRules, ["getScoringSnapshot", "snapshot.captainBasePoints", "snapshot.squadValue", "snapshot.totalXp", "snapshot.rarityPrestige"], "Tournament ranking");

includesAll(economy, [
  "resolveEntryDeadline",
  "Date.now() >= entryDeadline.getTime()",
  "entry_fee_paid",
  "paidFees",
  "ScoreUpdateService",
  "Final scoring snapshot is missing or incomplete",
  "competition_prize_awards",
  "getActivePrizeForEntries",
  "cashPoolEnabled",
  "nonCashAwardEnabled",
  "pending_claim",
  "postWalletAmountExactlyOnce",
], "Tournament economy route");
expect(!economy.includes("if (new Date(competition.startDate).getTime() <= Date.now())"), "Join validation must not use the Tuesday tournament start as the lineup deadline");

includesAll(preflight, [
  "competition_prize_awards",
  "competition_prize_awards_user_idx",
  "competition_prize_awards_status_idx",
  "entry_fee_paid real NOT NULL DEFAULT 0",
  "SET entry_fee_paid = coalesce(c.entry_fee, 0)",
], "Runtime preflight");

includesAll(legal, [
  '"/legal/game-rules"',
  '"/terms-and-conditions"',
  '"/game-rules"',
  '"/contact-us"',
  "Multiple entries",
  "captain receives a 10%",
  "Terms & Conditions",
  "Contact Us",
], "Legal centre");
includesAll(app, ["MyEntriesPage", 'path="/my-entries"', '"/terms-and-conditions"', '"/game-rules"', '"/contact-us"'], "Application routing");
includesAll(sidebar, ["My Teams & Prizes", "Game Rules", "Terms & Conditions", "Help Centre", "Contact Us"], "Authenticated sidebar");
includesAll(footer, ["Official Game Rules", "Terms & Conditions", "Contact Us", "Privacy Policy"], "Site footer");
includesAll(myEntries, ["My Teams & Prizes", "Submitted lineup", "Prize claim pending", "Final scoring snapshot stored"], "Submitted teams page");

includesAll(sharedRules, ["CAPTAIN_MULTIPLIER = 1.1", "RARITY_FOOTBALL_POINT_MULTIPLIERS", "common: 1", "legendary: 1", "SUBMITTED_LINEUPS_ARE_FINAL = true"], "Shared game rules");
expect(!/Common:\s*1\.0|Rare:\s*1\.1|Unique:\s*1\.2|Epic:\s*1\.35|Legendary:\s*1\.5/.test(sharedRules), "Shared rules must not contain obsolete rarity football-point multipliers");

if (failures.length) {
  console.error("Tournament scoring/legal integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Tournament scoring, settlement, submitted-team records and restored legal/support navigation verified.");

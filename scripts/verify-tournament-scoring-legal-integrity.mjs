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
const competitions = read("client/src/pages/competitions.tsx");
const adminTournaments = read("client/src/components/admin/AdminTournamentManager.tsx");
const sharedRules = read("shared/game-rules.ts");
const calendarPatch = read("scripts/apply-official-tournament-calendar.mjs");

expect(!/delete\s+from\s+app\.competition_entries/i.test(sync), "Official tournament sync must never delete submitted tournament entries");
expect(!/delete\s+from\s+app\.competitions/i.test(sync), "Official tournament sync must update rows rather than delete/recreate them");
includesAll(sync, [
  "Preserved ${preservedEntries}",
  "resolveEnumSchema",
  "competition_status",
  "created_by_user_id is null",
  "catEndOfFollowingDay",
  "eligibleKickoffs",
  "nextFirst",
  "platform_fee_rate = 0",
  "platform_fee_total = 0",
  "190 total season slots",
  "day after the last eligible Premier League fixture",
  "postponed fixture assignment(s)",
  "FA Cup",
], "Official tournament sync");
expect(!sync.includes("catTuesdaySettlementAfter"), "Official tournament sync must not use the old fixed Tuesday-after-first-kickoff settlement rule");
expect(!sync.includes("Runs Tuesday to Tuesday"), "Official tournament sync must not describe settlement as a Tuesday-to-Tuesday scoring window");
expect(!sync.includes("Tuesday window shortened"), "Official tournament sync must not use the old fixture-overlap window model");

includesAll(scoreUpdater, [
  "entryDeadline",
  "settlementDeadline",
  "isSettlementFinal",
  "activateCompetitionAtDeadline",
  "tiebreakMeta: { ...asObject(entry?.tiebreakMeta), scoring: snapshot }",
  "version: 3",
  'source: "official-fpl-live"',
  'competition: "premier-league-only"',
  "fixturePolicy",
  "immutableFinal",
  "captainMultiplier: 1.1",
  "unresolvedCardIds",
], "Score updater");
expect(!scoreUpdater.includes("isGameweekFinal"), "Tournament finalization must use the configured gameweek settlement cutoff, not the FPL event-finished flag");
expect(!scoreUpdater.includes("resetForNewGameweek"), "Score updater must not reset historical gameweek scores");
expect(!scoreUpdater.includes("totalScore: 0"), "Score updater must not zero other gameweek entries");
expect(!scoreUpdater.includes("otherActiveComps"), "Score updater must not clear non-current active competitions");

includesAll(scoring, ["Captain receives +10%", "baseScore * 1.1", "rarity does NOT change football points"], "Scoring engine");
includesAll(tournamentRules, [
  "getScoringSnapshot",
  "snapshot.captainBasePoints",
  "snapshot.squadValue",
  "snapshot.totalXp",
  "snapshot.rarityPrestige",
  "platformFeeRate: 0.1",
  "prizePoolRate: 0.9",
], "Tournament ranking/economy config");

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
expect(!economy.includes("if (new Date(competition.startDate).getTime() <= Date.now())"), "Join validation must not use the tournament start as the lineup deadline");

includesAll(preflight, [
  "competition_prize_awards",
  "competition_prize_awards_user_idx",
  "competition_prize_awards_status_idx",
  "entry_fee_paid real NOT NULL DEFAULT 0",
  "SET entry_fee_paid = coalesce(c.entry_fee, 0)",
], "Runtime preflight");

includesAll(competitions, [
  "tournamentSettlementLabel",
  "Day after the last eligible Premier League fixture",
  "gameweek settlement cutoff",
  "FA Cup",
  "postponed fixtures played after the next gameweek starts",
  "submissionClosesAt",
], "Tournament page");
includesAll(adminTournaments, [
  "Settlement cutoff — day after last eligible PL match",
  "Settle Results",
  "/api/admin/competitions/settle/",
  "postponed Premier League fixture does not count",
  "common: 1.7, rare: 1.6, unique: 1.5, epic: 1.4, legendary: 1.3",
  "const scheduled = officialCompetitions.find",
], "Admin tournament manager");

includesAll(calendarPatch, [
  "Official/admin tournaments do not pay a platform fee.",
  "platformFeeRate = 0",
  "POSTPONED_AFTER_NEXT_GAMEWEEK_START_COUNT",
  "const scheduled = officialCompetitions.find",
  "38 gameweeks × 5 rarities",
], "Official tournament build patch");

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
includesAll(myEntries, ["My Teams & Prizes", "Submitted lineup", "prize claim pending", "Final scoring snapshot stored"], "Submitted teams page");

includesAll(sharedRules, [
  "CAPTAIN_MULTIPLIER = 1.1",
  "RARITY_FOOTBALL_POINT_MULTIPLIERS",
  "common: 1",
  "legendary: 1",
  "SUBMITTED_LINEUPS_ARE_FINAL = true",
  'TOURNAMENT_SETTLEMENT_DAY = "day-after-last-eligible-fixture"',
  'TOURNAMENT_SETTLEMENT_TIME_CAT = "23:59"',
  "CUP_FIXTURES_COUNT = false",
  "POST_SETTLEMENT_FIXTURES_COUNT = false",
  "POSTPONED_AFTER_NEXT_GAMEWEEK_START_COUNT = false",
], "Shared game rules");
expect(!/Common:\s*1\.0|Rare:\s*1\.1|Unique:\s*1\.2|Epic:\s*1\.35|Legendary:\s*1\.5/.test(sharedRules), "Shared rules must not contain obsolete rarity football-point multipliers");

if (failures.length) {
  console.error("Tournament scoring/legal integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Tournament entry lock, live fixture-window settlement, late-postponement exclusion, Premier League-only scoring, admin 0% platform fees and legal/support navigation verified.");

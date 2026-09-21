import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const includesAll = (source, values, label) => values.forEach((value) => expect(source.includes(value), `${label} is missing ${value}`));

const rules = read("shared/game-rules.ts");
const scoring = read("server/services/scoring.ts");
const bridge = read("server/services/apiFootballScoringBridge.ts");
const updater = read("server/services/scoreUpdater.ts");
const scoringPage = read("client/src/pages/scoring-rules.tsx");
const sync = read("server/services/apiFootballSync.ts");
const admin = read("server/routes/apiFootballAdmin.routes.ts");
const integrity = read("scripts/verify-tournament-scoring-legal-integrity.mjs");

includesAll(rules, [
  "detailedPerformance",
  "completedPassesPerPoint: 12",
  "keyPass: 2.2",
  "tackle: 1.4",
  "interception: 1.6",
  "duelWon: 0.65",
  "shotOnTarget: 1.5",
  "fallbackPerformance",
  "ictMax: 0",
  "bpsMax: 0",
], "Shared scoring rules");

includesAll(scoring, [
  'import { PLAYER_SCORE_RULES, SCORE_PRECISION_DECIMALS } from "../../shared/game-rules.js"',
  "Key / crucial passes",
  "stats.detailed_stats_available",
  "mapApiFootballStatisticsToDetailedStats",
  "mergePlayerStatsWithDetailedStats",
  'data_source: stats.detailed_stats_available ? "verified-player-stats" : "verified-core-stats"',
], "Canonical scoring engine");
expect(!scoring.includes("FPL ICT fallback"), "ICT proxy scoring must be removed");
expect(!scoring.includes("FPL BPS fallback"), "BPS proxy scoring must be removed");
expect(!scoring.includes("official FPL bonus point(s)"), "Provider fantasy bonus scoring must be removed");
expect(!scoring.includes("matchRating * d.matchRating"), "API-Football match-rating scoring must be removed");
expect(!updater.includes("providerRatingTotal"), "API-Football match-rating tiebreak metadata must be removed");

includesAll(bridge, [
  "app.api_football_player_match_stats",
  "API_FOOTBALL_ONLY_SCORING_V1",
  "resolveApiFootballPlayer",
  "mapApiFootballStatsToPlayerStats",
  "statsByApiPlayerId",
  "fixtureByTeamId",
], "API-Football scoring bridge");

includesAll(updater, [
  "loadApiFootballGameweekScoringContext",
  "resolveApiFootballGameweekPlayer",
  "identity_provider: \"api-football\"",
  "identity_status: \"verified\"",
  "version: 7",
  'source: "api-football-player-stats"',
  "detailedStatsCards",
  "apiFootballPlayerId",
  "dataSource",
], "Tournament score updater");
expect(!updater.includes("mapFplStatsToPlayerStats"), "Tournament score updater must not use FPL player statistics.");
expect(!updater.includes("mergePlayerStatsWithDetailedStats(fplStats"), "Tournament score updater must not merge FPL scoring data.");

includesAll(scoringPage, [
  "Complete points table",
  "Key / crucial pass",
  "Successful tackle",
  "Interception",
  "Duel won",
  "Shot on target",
  "Successful dribble",
  "Defensive block",
  "No proxy points",
  "Player-stat-only scoring",
], "Published scoring page");

for (const [source, label] of [[sync, "API-Football sync"], [admin, "API-Football admin preview"]]) {
  includesAll(source, [
    "calculatePlayerScore",
    "mapApiFootballStatsToPlayerStats",
    "result.breakdown.performance",
    "dataSource: result.data_source",
  ], label);
}

includesAll(integrity, ["version: 7", "api-football-player-stats", "detailedStatsCards"], "Tournament integrity verifier");

if (failures.length) {
  console.error("Complete scoring verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[scoring] Verified API-Football-only tournament scoring, full player actions, proxy-free rules and one canonical engine");

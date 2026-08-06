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
], "Shared scoring rules");

includesAll(scoring, [
  'import { PLAYER_SCORE_RULES } from "../../shared/game-rules.js"',
  "Key / crucial passes",
  "stats.detailed_stats_available",
  "FPL ICT fallback",
  "FPL BPS fallback",
  "mapApiFootballStatisticsToDetailedStats",
  "mergePlayerStatsWithDetailedStats",
  'data_source: stats.detailed_stats_available ? "official-fpl-plus-api-football" : "official-fpl-fallback"',
], "Canonical scoring engine");
expect(scoring.indexOf("if (stats.detailed_stats_available)") < scoring.indexOf("FPL ICT fallback"), "Detailed actions must replace, not follow, the FPL proxy");

includesAll(bridge, [
  "app.api_football_player_match_stats",
  "gameweekWindow",
  "resolveApiFootballPlayer",
  "mapApiFootballStatisticsToDetailedStats",
  "statsByApiPlayerId",
], "API-Football scoring bridge");

includesAll(updater, [
  "loadDetailedScoringContext",
  "resolveDetailedStatsForPlayer",
  "mergePlayerStatsWithDetailedStats",
  "version: 4",
  "detailedStatsCards",
  "fallbackStatsCards",
  "apiFootballPlayerId",
  "dataSource",
], "Tournament score updater");

includesAll(scoringPage, [
  "Complete points table",
  "Key / crucial pass",
  "Successful tackle",
  "Interception",
  "Duel won",
  "Shot on target",
  "Successful dribble",
  "Defensive block",
  "FPL ICT fallback",
  "No double counting",
], "Published scoring page");

for (const [source, label] of [[sync, "API-Football sync"], [admin, "API-Football admin preview"]]) {
  includesAll(source, [
    "calculatePlayerScore",
    "mapApiFootballStatsToPlayerStats",
    "result.breakdown.performance",
    "dataSource: result.data_source",
  ], label);
}

includesAll(integrity, ["version: 4", "official-fpl-plus-api-football", "detailedStatsCards", "fallbackStatsCards"], "Tournament integrity verifier");

if (failures.length) {
  console.error("Complete scoring verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[scoring] Verified crucial passes, all-around actions, provider fallback and published rules use one canonical engine");

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Legacy entry point retained because several production prebuild verifiers import it.
 *
 * Complete scoring v2 used to rewrite source files during every build. That became
 * unsafe once tournament scoring moved to the player-stat-only v7 contract, because
 * the old patch could try to restore ICT/BPS/FPL fallback scoring.
 *
 * The source of truth is now committed directly. This script is intentionally an
 * idempotent guard: it verifies the required v7 markers and never rewrites scoring.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const scoring = read("server/services/scoring.ts");
const updater = read("server/services/scoreUpdater.ts");
const bridge = read("server/services/apiFootballScoringBridge.ts");
const rules = read("shared/game-rules.ts");
const scoringPage = read("client/src/pages/scoring-rules.tsx");

const checks = [
  [scoring.includes('"verified-player-stats"'), "Detailed player-stat score source is missing"],
  [scoring.includes('"verified-core-stats"'), "Core player-stat score source is missing"],
  [!scoring.includes('addReason(reasons, `FPL ICT fallback'), "Legacy ICT fallback scoring is still active"],
  [!scoring.includes('addReason(reasons, `FPL BPS fallback'), "Legacy BPS fallback scoring is still active"],
  [!scoring.includes("official FPL bonus point(s)"), "Legacy provider fantasy bonus scoring is still active"],
  [!scoring.includes("matchRating * d.matchRating"), "API-Football match ratings must be excluded from scoring"],
  [!updater.includes("providerRatingTotal"), "API-Football match ratings must be excluded from tournament tiebreaks"],
  [updater.includes("version: 6"), "Tournament scoring snapshot v7 is missing"],
  [updater.includes('source: "api-football-player-stats"'), "Tournament scoring must use API-Football-only player stats"],
  [updater.includes("FPL/ICT/BPS/fallback points are excluded"), "Tournament scoring policy must prohibit FPL and proxy points"],
  [bridge.includes("API_FOOTBALL_ONLY_SCORING_V1"), "API-Football-only gameweek scoring context is missing"],
  [rules.includes("ictMax: 0"), "ICT fallback is not disabled in shared rules"],
  [rules.includes("bpsMax: 0"), "BPS fallback is not disabled in shared rules"],
  [rules.includes("bonusMax: 0"), "Provider fantasy bonus bucket is not disabled"],
  [scoringPage.includes("No proxy points"), "Published scoring rules do not state the proxy-free policy"],
  [scoringPage.includes("Player-stat-only scoring"), "Published scoring rules do not state player-stat-only scoring"],
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  throw new Error(
    "Player-stat-only scoring v7 guard failed:\n- " + failures.join("\n- "),
  );
}

console.log("[scoring] Player-stat-only scoring v7 already applied; legacy complete-scoring rewrite skipped.");

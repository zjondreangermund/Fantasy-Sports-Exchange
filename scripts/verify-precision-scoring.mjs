import fs from "node:fs";
import vm from "node:vm";

const read = (file) => fs.readFileSync(file, "utf8");
const shared = read("shared/game-rules.ts");
const scoring = read("server/services/scoring.ts");
const playerIdentity = read("server/services/fplPlayerIdentity.ts");
const bridge = read("server/services/apiFootballScoringBridge.ts");
const updater = read("server/services/scoreUpdater.ts");
const tournament = read("server/services/tournamentRules.ts");
const leaderboard = read("server/routes/marketplace.routes.ts");
const standingsPage = read("client/src/pages/competitions-vault.tsx");
const scoringPage = read("client/src/pages/scoring-rules.tsx");

function check(condition, message) {
  if (!condition) throw new Error(message);
}

for (const [source, required, label] of [
  [shared, "export const SCORE_PRECISION_DECIMALS = 4", "Shared score precision"],
  [shared, "minutePlayed: 0.013", "Exact playing-minute scoring"],
  [scoring, "completedPasses / d.completedPassesPerPoint", "Every completed pass scoring"],
  [scoring, "matchRating * d.matchRating", "Official match-rating scoring"],
  [scoring, "accuracy * d.passingAccuracyPercent", "Passing-accuracy scoring"],
  [scoring, "ictIndex / f.ictPerPoint", "Fractional FPL ICT fallback"],
  [scoring, "return round(totalScore);", "Four-decimal lineup scoring"],
  [bridge, '"match_rating"', "Stored API-Football match-rating ingestion"],
  [bridge, '"total_passes"', "Stored API-Football pass-total ingestion"],
  [updater, "scoringPrecision: 4", "Precise tournament scoring snapshots"],
  [updater, "providerRatingTotal", "Official match-rating tiebreak metadata"],
  [updater, 'import { buildFplPlayerIndex } from "./fplPlayerIdentity.js"', "Shared verified tournament player identity"],
  [updater, "identityMap.resolve(player)", "Verified official player matching"],
  [updater, "identityMap.canonical(officialElement)", "Canonical player position and identity"],
  [updater, "identityStatus: String(score?.identity_status", "Player identity status in official scoring snapshots"],
  [updater, "Recovered verified player points", "Automatic recovered-points diagnostics"],
  [bridge, "api_position: match.position", "Verified API-Football player position"],
  [leaderboard, "->>'providerRatingTotal'", "Leaderboard match-rating tie-breaker"],
  [leaderboard, "->>'completedPasses'", "Leaderboard completed-passes tie-breaker"],
  [leaderboard, "snapshotMatchesVerifiedPlayer", "Verified snapshot player identity safeguard"],
  [standingsPage, "maximumFractionDigits: 4", "Visible precise tournament scores"],
  [standingsPage, "player.identityStatus !== \"verified\"", "Visible player-link explanation"],
  [scoringPage, "Precise scoring and fair tie-breakers", "Published precision and tiebreak rules"],
]) check(source.includes(required), `${label} is missing.`);

check(!scoring.includes("return Math.round(totalScore);"), "Tournament lineups must never be rounded to whole points.");
check(!scoring.includes("Math.floor(ictIndex / f.ictPerPoint)"), "FPL ICT fallback must retain fractional points.");
check(!updater.includes("const explicit = Number(player?.externalId || player?.fplId || 0);"), "Stale player IDs must not bypass official identity verification.");

const rulesMarker = "export const PLAYER_SCORE_RULES = ";
const rulesStart = shared.indexOf(rulesMarker);
check(rulesStart >= 0, "Shared player-score rules were not found.");
const rulesObjectStart = rulesStart + rulesMarker.length;
const rulesObjectEnd = shared.indexOf("\n} as const;", rulesObjectStart);
check(rulesObjectEnd >= 0, "Shared player-score rules could not be isolated.");
const scoreRules = vm.runInNewContext(`(${shared.slice(rulesObjectStart, rulesObjectEnd + 2)})`);

const engineStart = scoring.indexOf("const p = PLAYER_SCORE_RULES");
const engineEnd = scoring.indexOf("function emptyDetailedStats()");
check(engineStart >= 0 && engineEnd > engineStart, "Canonical score engine could not be isolated.");
const executableEngine = scoring.slice(engineStart, engineEnd)
  .replace("export const SCORE_RULES", "const SCORE_RULES")
  .replace("function numberOf(value: unknown)", "function numberOf(value)")
  .replace("function round(value: number, decimals = SCORE_PRECISION_DECIMALS)", "function round(value, decimals = SCORE_PRECISION_DECIMALS)")
  .replace("function clamp(value: number, min: number, max: number)", "function clamp(value, min, max)")
  .replace('function addReason(reasons: ScoringReason[], label: string, points: number, category: ScoringReason["category"])', "function addReason(reasons, label, points, category)")
  .replace("export function calculatePlayerScore(stats: PlayerStats, position: string): ScoringResult", "function calculatePlayerScore(stats, position)")
  .replace("export function calculateLineupScore(cardScores: ScoringResult[], captainId: number): number", "function calculateLineupScore(cardScores, captainId)")
  .replace("const reasons: ScoringReason[] = [];", "const reasons = [];")
  .replace(/\] as const;/g, "];");

const context = { PLAYER_SCORE_RULES: scoreRules, SCORE_PRECISION_DECIMALS: 4 };
vm.runInNewContext(`${executableEngine}\nglobalThis.scorePlayer = calculatePlayerScore;\nglobalThis.scoreLineup = calculateLineupScore;`, context);

const player = {
  minutes: 72,
  goals_scored: 0,
  assists: 0,
  clean_sheets: 0,
  saves: 0,
  bps: 17,
  ict_index: "17.4",
  completed_passes: 18,
  total_passes: 25,
  pass_accuracy: 72,
  match_rating: 6.8,
  rating_samples: 1,
  key_passes: 1,
  tackles: 1,
  interceptions: 0,
  duels_won: 2,
  duels_total: 4,
  shots_on_target: 0,
  shots_total: 1,
  successful_dribbles: 1,
  dribbles_attempted: 2,
  blocks: 0,
  fouls_drawn: 0,
  fouls_committed: 0,
  detailed_stats_available: true,
};

const base = context.scorePlayer(player, "MID");
const oneMorePass = context.scorePlayer({ ...player, completed_passes: 19 }, "MID");
const oneMoreMinute = context.scorePlayer({ ...player, minutes: 73 }, "MID");
const strongerRating = context.scorePlayer({ ...player, match_rating: 6.9 }, "MID");
const fallback = context.scorePlayer({ ...player, detailed_stats_available: false }, "MID");
const improvedFallback = context.scorePlayer({ ...player, detailed_stats_available: false, bps: 18 }, "MID");
const goalkeeperOneSave = context.scorePlayer({ ...player, saves: 1 }, "GK");
const goalkeeperTwoSaves = context.scorePlayer({ ...player, saves: 2 }, "GK");

check(oneMorePass.total_score > base.total_score, "One additional completed pass must improve the score.");
check(oneMoreMinute.total_score > base.total_score, "One additional playing minute must improve the score.");
check(strongerRating.total_score > base.total_score, "A stronger official match rating must improve the score.");
check(improvedFallback.total_score > fallback.total_score, "A one-point FPL BPS increase must affect fallback scoring.");
check(goalkeeperTwoSaves.total_score > goalkeeperOneSave.total_score, "Every individual goalkeeper save must affect scoring.");
check(base.football_metrics.completed_passes === 18, "Player scoring must retain verified completed passes for tie-breakers.");

const lineup = context.scoreLineup([{ ...base, card_id: 101 }, { ...oneMorePass, card_id: 102 }], 101);
check(!Number.isInteger(lineup), "A lineup with fractional player scores must retain fractional points.");
check(lineup === Math.round((base.total_score * 1.1 + oneMorePass.total_score) * 10000) / 10000,
  "Captain bonuses and lineup totals must retain four-decimal precision.");

const comparisonStart = tournament.indexOf("export function compareTiebreak(");
const comparisonEnd = tournament.indexOf("export function tiebreakReason(", comparisonStart);
check(comparisonStart >= 0 && comparisonEnd > comparisonStart, "Tournament tie-breaker comparison could not be isolated.");
const executableComparison = tournament.slice(comparisonStart, comparisonEnd)
  .replace("export function compareTiebreak(a: RankedEntry, b: RankedEntry)", "function compareTiebreak(a, b)");
const rankingContext = { toNumber: (value) => Number(value || 0) };
vm.runInNewContext(`${executableComparison}\nglobalThis.compare = compareTiebreak;`, rankingContext);
const betterFootball = { id: 2, tiebreak: { totalScore: 80.1234, captainPoints: 20.5, providerRatingTotal: 35.7, squadValue: 900 } };
const cheaperSquad = { id: 1, tiebreak: { totalScore: 80.1234, captainPoints: 20.5, providerRatingTotal: 35.6, squadValue: 100 } };
check(rankingContext.compare(betterFootball, cheaperSquad) < 0,
  "Actual football performance must resolve exact-score ties before card value or ownership attributes.");

const executableIdentity = playerIdentity
  .replace(/^export type FplPosition = .*;$/m, "")
  .replace("export const FPL_POSITION_BY_ELEMENT_TYPE: Record<number, FplPosition>", "const FPL_POSITION_BY_ELEMENT_TYPE")
  .replace(/export function /g, "function ")
  .replace(/: unknown/g, "")
  .replace(/: string\[\]/g, "")
  .replace(/: string/g, "")
  .replace(/: any\[\]/g, "")
  .replace(/: any/g, "")
  .replace(/: number/g, "")
  .replace(/: boolean/g, "")
  .replace(/: FplPosition/g, "")
  .replace(/new Map<[^>]+>/g, "new Map")
  .replace(/ as any\[\]/g, "");
const identityContext = {};
vm.runInNewContext(`${executableIdentity}\nglobalThis.buildIndex = buildFplPlayerIndex;\nglobalThis.matchName = strongPlayerNameMatch;`, identityContext);

const officialIndex = identityContext.buildIndex({
  teams: [{ id: 1, name: "Sunderland" }, { id: 2, name: "Brighton" }],
  elements: [
    { id: 501, code: 9001, first_name: "Omar", second_name: "Alderete", web_name: "Alderete", team: 1, element_type: 2 },
    { id: 777, code: 9002, first_name: "Emiliano", second_name: "Martínez", web_name: "Martínez", team: 2, element_type: 1 },
    { id: 778, code: 9003, first_name: "Oscar", second_name: "Alderete", web_name: "Alderete", team: 2, element_type: 2 },
  ],
});

check(identityContext.matchName("O. Alderete", "Omar Alderete"), "Legacy initial-and-surname cards must match their verified official player.");
const abbreviatedPlayer = officialIndex.resolve({ name: "O. Alderete", team: "Sunderland", position: "DEF" });
check(Number(abbreviatedPlayer?.id || 0) === 501, "Omar Alderete's abbreviated starter card must resolve to Omar, not another player.");
const stalePlayer = officialIndex.resolve({ name: "O. Alderete", team: "Sunderland", position: "DEF", fplId: 777, code: 9002 });
check(Number(stalePlayer?.id || 0) === 501, "A stale ID or code belonging to another player must never determine a card's score.");
const duplicateSurnameStalePlayer = officialIndex.resolve({ name: "O. Alderete", team: "Sunderland", position: "DEF", fplId: 778, code: 9003 });
check(Number(duplicateSurnameStalePlayer?.id || 0) === 501, "A stale ID matching a different player with the same initial and surname must not override the verified club.");
check(!officialIndex.resolve({ name: "O. Alderete" }), "Ambiguous initials and surnames must never silently select the wrong footballer.");
const goalkeeper = officialIndex.resolve({ name: "Emiliano Martinez", team: "Brighton", position: "MID", fplId: 777 });
check(officialIndex.canonical(goalkeeper).position === "GK", "Verified official position must override incorrect legacy card positions.");

const omar = context.scorePlayer({ minutes: 23, ict_index: "0", bps: 0, detailed_stats_available: false }, officialIndex.canonical(abbreviatedPlayer).position);
check(omar.total_score === 10.299, "A verified 23-minute appearance must award exactly 10.299 base points.");

console.log(`[scoring] Verified four-decimal football scoring, secure player identity, stale-ID protection and 23-minute appearances (sample lineup: ${lineup}; Omar: ${omar.total_score})`);

import { PLAYER_SCORE_RULES } from "../../shared/game-rules.js";

/**
 * Canonical Fantasy Arena scoring engine.
 *
 * Fairness rules:
 * - Player score is based on real football match statistics only.
 * - Card rarity does NOT change football points.
 * - Duplicate cards for the same footballer receive the same base player score.
 * - Captain bonus is applied only to the competition lineup total.
 * - Detailed API-Football actions replace the FPL ICT/BPS proxy when available;
 *   the two methods are never added together.
 */

export interface PlayerStats {
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  completed_passes: number;
  key_passes: number;
  tackles: number;
  interceptions: number;
  duels_won: number;
  shots_on_target: number;
  successful_dribbles: number;
  blocks: number;
  fouls_drawn: number;
  fouls_committed: number;
  detailed_stats_available: boolean;
  provider: "fpl" | "api-football" | "hybrid";
}

export interface ScoringReason {
  label: string;
  points: number;
  category: "decisive" | "performance" | "penalty" | "bonus";
}

export interface ScoringResult {
  player_id: number;
  card_id?: number;
  total_score: number;
  breakdown: {
    decisive: number;
    performance: number;
    penalties: number;
    bonus: number;
  };
  reasons: ScoringReason[];
  is_all_around: boolean;
  data_source: "official-fpl-fallback" | "official-fpl-plus-api-football";
}

const p = PLAYER_SCORE_RULES.positive;
const n = PLAYER_SCORE_RULES.negative;
const c = PLAYER_SCORE_RULES.caps;
const d = PLAYER_SCORE_RULES.detailedPerformance;
const f = PLAYER_SCORE_RULES.fallbackPerformance;

export const SCORE_RULES = {
  positive: [
    { event: "Goal", points: `+${p.goal} each` },
    { event: "Assist", points: `+${p.assist} each` },
    { event: "Clean sheet GK", points: `+${p.cleanSheetGoalkeeper}` },
    { event: "Clean sheet DEF", points: `+${p.cleanSheetDefender}` },
    { event: "Clean sheet MID", points: `+${p.cleanSheetMidfielder}` },
    { event: "Penalty save GK", points: `+${p.penaltySaveGoalkeeper}` },
    { event: "Every 3 saves GK", points: `+${p.everyThreeSavesGoalkeeper}` },
    { event: "60+ minutes", points: `+${p.minutes60Plus} performance base` },
    { event: "30–59 minutes", points: `+${p.minutes30To59} performance base` },
    { event: "1–29 minutes", points: `+${p.minutes1To29} performance base` },
    { event: "Key / crucial pass", points: `+${d.keyPass} each` },
    { event: "Completed passes", points: `+1 per ${d.completedPassesPerPoint}, max +${d.completedPassesMax}` },
    { event: "Successful tackle", points: `+${d.tackle} each` },
    { event: "Interception", points: `+${d.interception} each` },
    { event: "Duel won", points: `+${d.duelWon} each` },
    { event: "Shot on target", points: `+${d.shotOnTarget} each` },
    { event: "Successful dribble", points: `+${d.successfulDribble} each` },
    { event: "Defensive block", points: `+${d.block} each` },
    { event: "Foul won", points: `+${d.foulDrawn} each` },
    { event: "FPL fallback ICT", points: `up to +${f.ictMax}` },
    { event: "FPL fallback BPS", points: `up to +${f.bpsMax}` },
    { event: "FPL bonus", points: `+${p.fplBonusMultiplier} per bonus point` },
    { event: "Multi-category contribution", points: `+${p.multiCategoryContribution}` },
  ],
  negative: [
    { event: "Foul committed", points: `${d.foulCommitted}` },
    { event: "Yellow card", points: `${n.yellowCard}` },
    { event: "Red card", points: `${n.redCard}` },
    { event: "Own goal", points: `${n.ownGoal}` },
    { event: "Penalty missed", points: `${n.penaltyMissed}` },
    { event: "GK/DEF goals conceded after first", points: `${n.extraGoalConcededGoalkeeperOrDefender} each` },
  ],
  caps: [
    { category: "Decisive", cap: `${c.decisiveMin} to ${c.decisiveMax}` },
    { category: "Performance", cap: `${c.performanceMin} to ${c.performanceMax}` },
    { category: "Penalties", cap: `${c.penaltiesMin} to ${c.penaltiesMax}` },
    { category: "Bonus", cap: `${c.bonusMin} to ${c.bonusMax}` },
    { category: "Final score", cap: `${c.finalMin} to ${c.finalMax}` },
  ],
  captain: "Captain receives +10% only in lineup total. The player's own card score remains unchanged.",
};

function numberOf(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function addReason(reasons: ScoringReason[], label: string, points: number, category: ScoringReason["category"]) {
  const rounded = round(points);
  if (!rounded) return;
  reasons.push({ label, points: rounded, category });
}

export function calculatePlayerScore(stats: PlayerStats, position: string): ScoringResult {
  let decisive = 0;
  let performance = 0;
  let penalties = 0;
  let bonus = 0;
  const reasons: ScoringReason[] = [];
  const normalizedPosition = String(position || "").toUpperCase();

  const goalPoints = numberOf(stats.goals_scored) * p.goal;
  const assistPoints = numberOf(stats.assists) * p.assist;
  decisive += goalPoints + assistPoints;
  addReason(reasons, `${numberOf(stats.goals_scored)} goal(s)`, goalPoints, "decisive");
  addReason(reasons, `${numberOf(stats.assists)} assist(s)`, assistPoints, "decisive");

  if (numberOf(stats.clean_sheets) > 0) {
    if (normalizedPosition === "GK") {
      decisive += p.cleanSheetGoalkeeper;
      addReason(reasons, "Clean sheet as GK", p.cleanSheetGoalkeeper, "decisive");
    } else if (normalizedPosition === "DEF") {
      decisive += p.cleanSheetDefender;
      addReason(reasons, "Clean sheet as DEF", p.cleanSheetDefender, "decisive");
    } else if (normalizedPosition === "MID") {
      decisive += p.cleanSheetMidfielder;
      addReason(reasons, "Clean sheet as MID", p.cleanSheetMidfielder, "decisive");
    }
  }

  if (normalizedPosition === "GK") {
    const penaltySavePoints = numberOf(stats.penalties_saved) * p.penaltySaveGoalkeeper;
    const savePoints = Math.floor(numberOf(stats.saves) / 3) * p.everyThreeSavesGoalkeeper;
    decisive += penaltySavePoints + savePoints;
    addReason(reasons, `${numberOf(stats.penalties_saved)} penalty save(s)`, penaltySavePoints, "decisive");
    addReason(reasons, `${numberOf(stats.saves)} save(s)`, savePoints, "decisive");
  }
  decisive = clamp(round(decisive), c.decisiveMin, c.decisiveMax);

  const minutes = numberOf(stats.minutes);
  const minutesPoints = minutes >= 60 ? p.minutes60Plus : minutes >= 30 ? p.minutes30To59 : minutes > 0 ? p.minutes1To29 : 0;
  performance += minutesPoints;
  addReason(reasons, `${minutes} minutes played`, minutesPoints, "performance");

  if (stats.detailed_stats_available) {
    const detailedParts = [
      ["Completed passes", Math.min(d.completedPassesMax, Math.floor(numberOf(stats.completed_passes) / d.completedPassesPerPoint))],
      ["Key / crucial passes", numberOf(stats.key_passes) * d.keyPass],
      ["Successful tackles", numberOf(stats.tackles) * d.tackle],
      ["Interceptions", numberOf(stats.interceptions) * d.interception],
      ["Duels won", numberOf(stats.duels_won) * d.duelWon],
      ["Shots on target", numberOf(stats.shots_on_target) * d.shotOnTarget],
      ["Successful dribbles", numberOf(stats.successful_dribbles) * d.successfulDribble],
      ["Defensive blocks", numberOf(stats.blocks) * d.block],
      ["Fouls won", numberOf(stats.fouls_drawn) * d.foulDrawn],
      ["Fouls committed", numberOf(stats.fouls_committed) * d.foulCommitted],
    ] as const;
    for (const [label, points] of detailedParts) {
      performance += points;
      addReason(reasons, label, points, "performance");
    }
  } else {
    const ictIndex = Number.parseFloat(String(stats.ict_index || "0")) || 0;
    const ictPoints = Math.min(f.ictMax, Math.floor(ictIndex / f.ictPerPoint));
    const bps = numberOf(stats.bps);
    const bpsPoints = Math.min(f.bpsMax, Math.floor(bps / f.bpsPerPoint));
    performance += ictPoints + bpsPoints;
    addReason(reasons, `FPL ICT fallback ${ictIndex}`, ictPoints, "performance");
    addReason(reasons, `FPL BPS fallback ${bps}`, bpsPoints, "performance");
  }
  performance = clamp(round(performance), c.performanceMin, c.performanceMax);

  const ownGoalPenalty = numberOf(stats.own_goals) * n.ownGoal;
  const missedPenalty = numberOf(stats.penalties_missed) * n.penaltyMissed;
  const yellowPenalty = numberOf(stats.yellow_cards) * n.yellowCard;
  const redPenalty = numberOf(stats.red_cards) * n.redCard;
  penalties += ownGoalPenalty + missedPenalty + yellowPenalty + redPenalty;
  addReason(reasons, `${numberOf(stats.own_goals)} own goal(s)`, ownGoalPenalty, "penalty");
  addReason(reasons, `${numberOf(stats.penalties_missed)} penalty missed`, missedPenalty, "penalty");
  addReason(reasons, `${numberOf(stats.yellow_cards)} yellow card(s)`, yellowPenalty, "penalty");
  addReason(reasons, `${numberOf(stats.red_cards)} red card(s)`, redPenalty, "penalty");

  if (normalizedPosition === "GK" || normalizedPosition === "DEF") {
    const excessConceded = Math.max(numberOf(stats.goals_conceded) - 1, 0);
    const concededPenalty = excessConceded * n.extraGoalConcededGoalkeeperOrDefender;
    penalties += concededPenalty;
    addReason(reasons, `${excessConceded} extra goal(s) conceded`, concededPenalty, "penalty");
  }
  penalties = clamp(round(penalties), c.penaltiesMin, c.penaltiesMax);

  const fplBonusPoints = numberOf(stats.bonus) * p.fplBonusMultiplier;
  bonus += fplBonusPoints;
  addReason(reasons, `${numberOf(stats.bonus)} official FPL bonus point(s)`, fplBonusPoints, "bonus");

  const contributionCount = [
    numberOf(stats.goals_scored) > 0,
    numberOf(stats.assists) > 0,
    numberOf(stats.clean_sheets) > 0,
  ].filter(Boolean).length;
  if (contributionCount >= 2) {
    bonus += p.multiCategoryContribution;
    addReason(reasons, "Multi-category contribution", p.multiCategoryContribution, "bonus");
  }
  bonus = clamp(round(bonus), c.bonusMin, c.bonusMax);

  const total_score = clamp(round(decisive + performance + penalties + bonus, 1), c.finalMin, c.finalMax);
  return {
    player_id: 0,
    total_score,
    breakdown: { decisive, performance, penalties, bonus },
    reasons,
    is_all_around: total_score >= 60,
    data_source: stats.detailed_stats_available ? "official-fpl-plus-api-football" : "official-fpl-fallback",
  };
}

export function calculateLineupScore(cardScores: ScoringResult[], captainId: number): number {
  const captainCardId = Number(captainId || 0);
  let totalScore = 0;
  for (const score of cardScores) {
    const baseScore = numberOf(score.total_score);
    const isCaptain = captainCardId > 0 && (Number(score.card_id || 0) === captainCardId || Number(score.player_id || 0) === captainCardId);
    totalScore += isCaptain ? baseScore * 1.1 : baseScore;
  }
  return Math.round(totalScore);
}

function emptyDetailedStats(): Pick<PlayerStats,
  "completed_passes" | "key_passes" | "tackles" | "interceptions" | "duels_won" |
  "shots_on_target" | "successful_dribbles" | "blocks" | "fouls_drawn" | "fouls_committed"
> {
  return {
    completed_passes: 0,
    key_passes: 0,
    tackles: 0,
    interceptions: 0,
    duels_won: 0,
    shots_on_target: 0,
    successful_dribbles: 0,
    blocks: 0,
    fouls_drawn: 0,
    fouls_committed: 0,
  };
}

export function mapFplStatsToPlayerStats(fplElement: any): PlayerStats {
  const stats = fplElement?.stats || {};
  return {
    minutes: numberOf(stats.minutes),
    goals_scored: numberOf(stats.goals_scored),
    assists: numberOf(stats.assists),
    clean_sheets: numberOf(stats.clean_sheets),
    goals_conceded: numberOf(stats.goals_conceded),
    own_goals: numberOf(stats.own_goals),
    penalties_saved: numberOf(stats.penalties_saved),
    penalties_missed: numberOf(stats.penalties_missed),
    yellow_cards: numberOf(stats.yellow_cards),
    red_cards: numberOf(stats.red_cards),
    saves: numberOf(stats.saves),
    bonus: numberOf(stats.bonus),
    bps: numberOf(stats.bps),
    influence: String(stats.influence || "0"),
    creativity: String(stats.creativity || "0"),
    threat: String(stats.threat || "0"),
    ict_index: String(stats.ict_index || "0"),
    ...emptyDetailedStats(),
    detailed_stats_available: false,
    provider: "fpl",
  };
}

function passAccuracy(value: unknown) {
  const parsed = Number.parseFloat(String(value || "0").replace("%", ""));
  return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : 0;
}

export function mapApiFootballStatisticsToDetailedStats(stat: any): Partial<PlayerStats> {
  const passes = stat?.passes || {};
  const tackles = stat?.tackles || {};
  const duels = stat?.duels || {};
  const shots = stat?.shots || {};
  const dribbles = stat?.dribbles || {};
  const fouls = stat?.fouls || {};
  const totalPasses = numberOf(passes.total);
  const accuracy = passAccuracy(passes.accuracy);
  const completedPasses = accuracy > 0 ? Math.round(totalPasses * accuracy / 100) : totalPasses;
  return {
    completed_passes: completedPasses,
    key_passes: numberOf(passes.key),
    tackles: numberOf(tackles.total),
    interceptions: numberOf(tackles.interceptions),
    duels_won: numberOf(duels.won),
    shots_on_target: numberOf(shots.on),
    successful_dribbles: numberOf(dribbles.success),
    blocks: numberOf(tackles.blocks),
    fouls_drawn: numberOf(fouls.drawn),
    fouls_committed: numberOf(fouls.committed),
    detailed_stats_available: true,
    provider: "api-football",
  };
}

export function mapApiFootballStatsToPlayerStats(stat: any): PlayerStats {
  const games = stat?.games || {};
  const goals = stat?.goals || {};
  const cards = stat?.cards || {};
  const penalty = stat?.penalty || {};
  return {
    minutes: numberOf(games.minutes),
    goals_scored: numberOf(goals.total),
    assists: numberOf(goals.assists),
    clean_sheets: 0,
    goals_conceded: numberOf(goals.conceded),
    own_goals: 0,
    penalties_saved: numberOf(penalty.saved),
    penalties_missed: numberOf(penalty.missed),
    yellow_cards: numberOf(cards.yellow),
    red_cards: numberOf(cards.red),
    saves: numberOf(goals.saves),
    bonus: 0,
    bps: 0,
    influence: "0",
    creativity: "0",
    threat: "0",
    ict_index: "0",
    ...emptyDetailedStats(),
    ...mapApiFootballStatisticsToDetailedStats(stat),
    detailed_stats_available: true,
    provider: "api-football",
  };
}

export function mergePlayerStatsWithDetailedStats(base: PlayerStats, detailed?: Partial<PlayerStats> | null): PlayerStats {
  if (!detailed?.detailed_stats_available) return base;
  return {
    ...base,
    completed_passes: numberOf(detailed.completed_passes),
    key_passes: numberOf(detailed.key_passes),
    tackles: numberOf(detailed.tackles),
    interceptions: numberOf(detailed.interceptions),
    duels_won: numberOf(detailed.duels_won),
    shots_on_target: numberOf(detailed.shots_on_target),
    successful_dribbles: numberOf(detailed.successful_dribbles),
    blocks: numberOf(detailed.blocks),
    fouls_drawn: numberOf(detailed.fouls_drawn),
    fouls_committed: numberOf(detailed.fouls_committed),
    detailed_stats_available: true,
    provider: "hybrid",
  };
}

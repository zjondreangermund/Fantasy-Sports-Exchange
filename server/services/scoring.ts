/**
 * Scoring System (Fantasy Arena / Sorare-style)
 *
 * Important fairness rule:
 * - Player score is based on real player match stats only.
 * - Card rarity does NOT change match points.
 * - Duplicate cards for the same footballer receive the same player score.
 * - Captain bonus is applied only to the competition lineup total, not to the card's own stored score.
 */

interface PlayerStats {
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
  bps: number; // Bonus Points System
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
}

interface ScoringResult {
  player_id: number;
  total_score: number;
  breakdown: {
    decisive: number;
    performance: number;
    penalties: number;
    bonus: number;
  };
  reasons: Array<{ label: string; points: number; category: "decisive" | "performance" | "penalty" | "bonus" }>;
  is_all_around: boolean; // AA = score >= 60
}

export const SCORE_RULES = {
  positive: [
    { event: "Goal", points: "+8 each" },
    { event: "Assist", points: "+6 each" },
    { event: "Clean sheet GK", points: "+10" },
    { event: "Clean sheet DEF", points: "+8" },
    { event: "Clean sheet MID", points: "+5" },
    { event: "Penalty save GK", points: "+12" },
    { event: "Every 3 saves GK", points: "+2" },
    { event: "60+ minutes", points: "+25 performance base" },
    { event: "30–59 minutes", points: "+15 performance base" },
    { event: "1–29 minutes", points: "+10 performance base" },
    { event: "ICT index", points: "up to +10" },
    { event: "BPS contribution", points: "up to +5" },
    { event: "FPL bonus", points: "+3 per bonus point" },
    { event: "Multi-category contribution", points: "+5" },
  ],
  negative: [
    { event: "Yellow card", points: "-3" },
    { event: "Red card", points: "-10" },
    { event: "Own goal", points: "-10" },
    { event: "Penalty missed", points: "-8" },
    { event: "GK/DEF goals conceded after first", points: "-2 each" },
  ],
  caps: [
    { category: "Decisive", cap: "0 to 40" },
    { category: "Performance", cap: "0 to 40" },
    { category: "Penalties", cap: "-20 to 0" },
    { category: "Bonus", cap: "0 to 20" },
    { category: "Final score", cap: "0 to 100" },
  ],
  captain: "Captain receives +10% only in lineup total. The player's own card score remains unchanged.",
};

function addReason(
  reasons: ScoringResult["reasons"],
  label: string,
  points: number,
  category: ScoringResult["reasons"][number]["category"],
) {
  if (!points) return;
  reasons.push({ label, points, category });
}

/**
 * Calculate player score based on match stats.
 */
export function calculatePlayerScore(
  stats: PlayerStats,
  position: string,
): ScoringResult {
  let decisive = 0;
  let performance = 0;
  let penalties = 0;
  let bonus = 0;
  const reasons: ScoringResult["reasons"] = [];

  const normalizedPosition = String(position || "").toUpperCase();

  // --- 1. DECISIVE ACTIONS (0-40 points) ---
  const goalPoints = stats.goals_scored * 8;
  const assistPoints = stats.assists * 6;
  decisive += goalPoints;
  decisive += assistPoints;
  addReason(reasons, `${stats.goals_scored} goal(s)`, goalPoints, "decisive");
  addReason(reasons, `${stats.assists} assist(s)`, assistPoints, "decisive");

  if (stats.clean_sheets > 0) {
    if (normalizedPosition === "GK") {
      decisive += 10;
      addReason(reasons, "Clean sheet as GK", 10, "decisive");
    } else if (normalizedPosition === "DEF") {
      decisive += 8;
      addReason(reasons, "Clean sheet as DEF", 8, "decisive");
    } else if (normalizedPosition === "MID") {
      decisive += 5;
      addReason(reasons, "Clean sheet as MID", 5, "decisive");
    }
  }

  if (normalizedPosition === "GK") {
    const penaltySavePoints = stats.penalties_saved * 12;
    const savePoints = Math.floor(stats.saves / 3) * 2;
    decisive += penaltySavePoints;
    decisive += savePoints;
    addReason(reasons, `${stats.penalties_saved} penalty save(s)`, penaltySavePoints, "decisive");
    addReason(reasons, `${stats.saves} save(s)`, savePoints, "decisive");
  }

  decisive = Math.min(decisive, 40);

  // --- 2. PERFORMANCE (0-40 points) ---
  let minutesPoints = 0;
  if (stats.minutes >= 60) minutesPoints = 25;
  else if (stats.minutes >= 30) minutesPoints = 15;
  else if (stats.minutes > 0) minutesPoints = 10;
  performance += minutesPoints;
  addReason(reasons, `${stats.minutes} minutes played`, minutesPoints, "performance");

  const ictIndex = parseFloat(stats.ict_index) || 0;
  const ictPoints = Math.min(Math.floor(ictIndex / 10), 10);
  performance += ictPoints;
  addReason(reasons, `ICT index ${ictIndex}`, ictPoints, "performance");

  const bps = parseFloat(String(stats.bps)) || 0;
  const bpsPoints = Math.min(Math.floor(bps / 10), 5);
  performance += bpsPoints;
  addReason(reasons, `BPS ${bps}`, bpsPoints, "performance");

  performance = Math.min(performance, 40);

  // --- 3. PENALTIES (-20 to 0 points) ---
  const ownGoalPenalty = -(stats.own_goals * 10);
  const missedPenalty = -(stats.penalties_missed * 8);
  const yellowPenalty = -(stats.yellow_cards * 3);
  const redPenalty = -(stats.red_cards * 10);
  penalties += ownGoalPenalty + missedPenalty + yellowPenalty + redPenalty;
  addReason(reasons, `${stats.own_goals} own goal(s)`, ownGoalPenalty, "penalty");
  addReason(reasons, `${stats.penalties_missed} penalty missed`, missedPenalty, "penalty");
  addReason(reasons, `${stats.yellow_cards} yellow card(s)`, yellowPenalty, "penalty");
  addReason(reasons, `${stats.red_cards} red card(s)`, redPenalty, "penalty");

  if (normalizedPosition === "GK" || normalizedPosition === "DEF") {
    const excessConceded = Math.max(stats.goals_conceded - 1, 0);
    const concededPenalty = -(excessConceded * 2);
    penalties += concededPenalty;
    addReason(reasons, `${excessConceded} extra goal(s) conceded`, concededPenalty, "penalty");
  }

  penalties = Math.max(penalties, -20);

  // --- 4. BONUS (0-20 points) ---
  const fplBonusPoints = stats.bonus * 3;
  bonus += fplBonusPoints;
  addReason(reasons, `${stats.bonus} FPL bonus point(s)`, fplBonusPoints, "bonus");

  const hasGoal = stats.goals_scored > 0;
  const hasAssist = stats.assists > 0;
  const hasCleanSheet = stats.clean_sheets > 0;
  const contributionCount = [hasGoal, hasAssist, hasCleanSheet].filter(Boolean).length;

  if (contributionCount >= 2) {
    bonus += 5;
    addReason(reasons, "Multi-category contribution", 5, "bonus");
  }

  bonus = Math.min(bonus, 20);

  const total_score = Math.max(0, Math.min(100, decisive + performance + penalties + bonus));

  return {
    player_id: 0,
    total_score,
    breakdown: {
      decisive,
      performance,
      penalties,
      bonus,
    },
    reasons,
    is_all_around: total_score >= 60,
  };
}

/**
 * Calculate competition entry score
 * - 5 cards in lineup
 * - Captain gets 10% bonus (1.1x multiplier)
 */
export function calculateLineupScore(
  cardScores: ScoringResult[],
  captainId: number,
): number {
  let totalScore = 0;

  for (const score of cardScores) {
    if (score.player_id === captainId) {
      totalScore += score.total_score * 1.1;
    } else {
      totalScore += score.total_score;
    }
  }

  return Math.round(totalScore);
}

/**
 * Map FPL live element data to our PlayerStats format
 */
export function mapFplStatsToPlayerStats(fplElement: any): PlayerStats {
  const stats = fplElement.stats || {};

  return {
    minutes: stats.minutes || 0,
    goals_scored: stats.goals_scored || 0,
    assists: stats.assists || 0,
    clean_sheets: stats.clean_sheets || 0,
    goals_conceded: stats.goals_conceded || 0,
    own_goals: stats.own_goals || 0,
    penalties_saved: stats.penalties_saved || 0,
    penalties_missed: stats.penalties_missed || 0,
    yellow_cards: stats.yellow_cards || 0,
    red_cards: stats.red_cards || 0,
    saves: stats.saves || 0,
    bonus: stats.bonus || 0,
    bps: stats.bps || 0,
    influence: stats.influence || "0",
    creativity: stats.creativity || "0",
    threat: stats.threat || "0",
    ict_index: stats.ict_index || "0",
  };
}

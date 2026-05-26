/**
 * Scoring System (Fantasy Arena / Sorare-style)
 *
 * Fairness rules:
 * - Player score is based on real football match stats only.
 * - Card rarity does NOT change football points.
 * - Duplicate cards for the same footballer receive the same base player score.
 * - Captain bonus is applied only to the competition lineup total.
 * - The captain bonus never changes the card's own stored score.
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
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
}

interface ScoringReason {
  label: string;
  points: number;
  category: "decisive" | "performance" | "penalty" | "bonus";
}

interface ScoringResult {
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

function addReason(reasons: ScoringReason[], label: string, points: number, category: ScoringReason["category"]) {
  if (!points) return;
  reasons.push({ label, points, category });
}

export function calculatePlayerScore(stats: PlayerStats, position: string): ScoringResult {
  let decisive = 0;
  let performance = 0;
  let penalties = 0;
  let bonus = 0;
  const reasons: ScoringReason[] = [];
  const normalizedPosition = String(position || "").toUpperCase();

  const goalPoints = Number(stats.goals_scored || 0) * 8;
  const assistPoints = Number(stats.assists || 0) * 6;
  decisive += goalPoints + assistPoints;
  addReason(reasons, `${stats.goals_scored} goal(s)`, goalPoints, "decisive");
  addReason(reasons, `${stats.assists} assist(s)`, assistPoints, "decisive");

  if (Number(stats.clean_sheets || 0) > 0) {
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
    const penaltySavePoints = Number(stats.penalties_saved || 0) * 12;
    const savePoints = Math.floor(Number(stats.saves || 0) / 3) * 2;
    decisive += penaltySavePoints + savePoints;
    addReason(reasons, `${stats.penalties_saved} penalty save(s)`, penaltySavePoints, "decisive");
    addReason(reasons, `${stats.saves} save(s)`, savePoints, "decisive");
  }

  decisive = Math.min(decisive, 40);

  let minutesPoints = 0;
  const minutes = Number(stats.minutes || 0);
  if (minutes >= 60) minutesPoints = 25;
  else if (minutes >= 30) minutesPoints = 15;
  else if (minutes > 0) minutesPoints = 10;
  performance += minutesPoints;
  addReason(reasons, `${minutes} minutes played`, minutesPoints, "performance");

  const ictIndex = parseFloat(String(stats.ict_index || "0")) || 0;
  const ictPoints = Math.min(Math.floor(ictIndex / 10), 10);
  performance += ictPoints;
  addReason(reasons, `ICT index ${ictIndex}`, ictPoints, "performance");

  const bps = parseFloat(String(stats.bps || 0)) || 0;
  const bpsPoints = Math.min(Math.floor(bps / 10), 5);
  performance += bpsPoints;
  addReason(reasons, `BPS ${bps}`, bpsPoints, "performance");

  performance = Math.min(performance, 40);

  const ownGoalPenalty = -(Number(stats.own_goals || 0) * 10);
  const missedPenalty = -(Number(stats.penalties_missed || 0) * 8);
  const yellowPenalty = -(Number(stats.yellow_cards || 0) * 3);
  const redPenalty = -(Number(stats.red_cards || 0) * 10);
  penalties += ownGoalPenalty + missedPenalty + yellowPenalty + redPenalty;
  addReason(reasons, `${stats.own_goals} own goal(s)`, ownGoalPenalty, "penalty");
  addReason(reasons, `${stats.penalties_missed} penalty missed`, missedPenalty, "penalty");
  addReason(reasons, `${stats.yellow_cards} yellow card(s)`, yellowPenalty, "penalty");
  addReason(reasons, `${stats.red_cards} red card(s)`, redPenalty, "penalty");

  if (normalizedPosition === "GK" || normalizedPosition === "DEF") {
    const excessConceded = Math.max(Number(stats.goals_conceded || 0) - 1, 0);
    const concededPenalty = -(excessConceded * 2);
    penalties += concededPenalty;
    addReason(reasons, `${excessConceded} extra goal(s) conceded`, concededPenalty, "penalty");
  }

  penalties = Math.max(penalties, -20);

  const fplBonusPoints = Number(stats.bonus || 0) * 3;
  bonus += fplBonusPoints;
  addReason(reasons, `${stats.bonus} FPL bonus point(s)`, fplBonusPoints, "bonus");

  const hasGoal = Number(stats.goals_scored || 0) > 0;
  const hasAssist = Number(stats.assists || 0) > 0;
  const hasCleanSheet = Number(stats.clean_sheets || 0) > 0;
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
    breakdown: { decisive, performance, penalties, bonus },
    reasons,
    is_all_around: total_score >= 60,
  };
}

export function calculateLineupScore(cardScores: ScoringResult[], captainId: number): number {
  const captainCardId = Number(captainId || 0);
  let totalScore = 0;

  for (const score of cardScores) {
    const baseScore = Number(score.total_score || 0);
    const isCaptain = captainCardId > 0 && (Number(score.card_id || 0) === captainCardId || Number(score.player_id || 0) === captainCardId);
    totalScore += isCaptain ? baseScore * 1.1 : baseScore;
  }

  return Math.round(totalScore);
}

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

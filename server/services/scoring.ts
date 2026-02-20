/**
 * Scoring System (Sorare-style)
 * 
 * Based on FPL live data, calculates comprehensive player scores
 * Scale: 0-100 points (AA = All-Around Score when >= 60)
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
  is_all_around: boolean; // AA = score >= 60
}

/**
 * Calculate player score based on Sorare-like system
 */
export function calculatePlayerScore(
  stats: PlayerStats,
  position: string
): ScoringResult {
  let decisive = 0;
  let performance = 0;
  let penalties = 0;
  let bonus = 0;

  // --- 1. DECISIVE ACTIONS (0-40 points) ---
  decisive += stats.goals_scored * 8; // Goals: 8 points each
  decisive += stats.assists * 6; // Assists: 6 points each
  
  // Clean Sheet (position-dependent)
  if (stats.clean_sheets > 0) {
    if (position === "GK") decisive += 10;
    else if (position === "DEF") decisive += 8;
    else if (position === "MID") decisive += 5;
  }
  
  // GK-specific
  if (position === "GK") {
    decisive += stats.penalties_saved * 12; // Penalty save: huge bonus
    decisive += Math.floor(stats.saves / 3) * 2; // Every 3 saves = 2 points
  }
  
  // Cap decisive at 40
  decisive = Math.min(decisive, 40);

  // --- 2. PERFORMANCE (0-40 points) ---
  // Base performance for playing time
  if (stats.minutes >= 60) {
    performance += 25; // Full performance base for 60+ mins
  } else if (stats.minutes >= 30) {
    performance += 15;
  } else if (stats.minutes > 0) {
    performance += 10;
  }
  
  // ICT Index (Influence, Creativity, Threat)
  const ictIndex = parseFloat(stats.ict_index) || 0;
  performance += Math.min(Math.floor(ictIndex / 10), 10); // Up to 10 bonus from ICT
  
  // BPS (Bonus Points System) - reflects overall contribution
  const bps = parseFloat(String(stats.bps)) || 0;
  performance += Math.min(Math.floor(bps / 10), 5); // Up to 5 bonus from BPS
  
  // Cap performance at 40
  performance = Math.min(performance, 40);

  // --- 3. PENALTIES (-20 to 0 points) ---
  penalties -= stats.own_goals * 10; // Own goal: -10
  penalties -= stats.penalties_missed * 8; // Missed penalty: -8
  penalties -= stats.yellow_cards * 3; // Yellow card: -3
  penalties -= stats.red_cards * 10; // Red card: -10
  
  // Defensive mistakes (goals conceded for GK/DEF)
  if (position === "GK" || position === "DEF") {
    const excessConceded = Math.max(stats.goals_conceded - 1, 0);
    penalties -= excessConceded * 2; // -2 per goal conceded (after first)
  }
  
  // Cap penalties at -20
  penalties = Math.max(penalties, -20);

  // --- 4. BONUS (0-20 points) ---
  // FPL Bonus points (awarded to top 3 players in match)
  bonus += stats.bonus * 3; // Each FPL bonus point = 3 score points
  
  // All-Around bonus: if player scored in multiple categories
  const hasGoal = stats.goals_scored > 0;
  const hasAssist = stats.assists > 0;
  const hasCleanSheet = stats.clean_sheets > 0;
  const contributionCount = [hasGoal, hasAssist, hasCleanSheet].filter(Boolean).length;
  
  if (contributionCount >= 2) {
    bonus += 5; // Multi-category contribution
  }
  
  // Cap bonus at 20
  bonus = Math.min(bonus, 20);

  // --- TOTAL SCORE (0-100 scale) ---
  const total_score = Math.max(0, Math.min(100, decisive + performance + penalties + bonus));
  
  return {
    player_id: 0, // Will be set by caller
    total_score,
    breakdown: {
      decisive,
      performance,
      penalties,
      bonus,
    },
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
  captainId: number
): number {
  let totalScore = 0;
  
  for (const score of cardScores) {
    if (score.player_id === captainId) {
      // Captain bonus: 110% of score
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

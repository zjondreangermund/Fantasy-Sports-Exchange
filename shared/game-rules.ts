// Canonical shared Fantasy Arena game rules.
// Keep these constants aligned with server/services/scoring.ts and tournament entry validation.

export const TOURNAMENT_LINEUP_SLOTS = ["GK", "DEF", "MID", "FWD", "UTILITY"] as const;
export const TOURNAMENT_REQUIRED_POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
export const TOURNAMENT_CARD_COUNT = 5;
export const CAPTAIN_MULTIPLIER = 1.1;
export const CAPTAIN_BONUS_PERCENT = 10;
export const PREMIER_LEAGUE_ONLY = true;
export const SUBMITTED_LINEUPS_ARE_FINAL = true;
export const MULTIPLE_ENTRIES_ALLOWED = true;
export const REUSE_CARDS_WITHIN_TOURNAMENT = false;

export const RARITY_FOOTBALL_POINT_MULTIPLIERS = {
  common: 1,
  rare: 1,
  unique: 1,
  epic: 1,
  legendary: 1,
} as const;

export const TOURNAMENT_TIEBREAK_ORDER = [
  "total_score",
  "captain_points",
  "lower_squad_value",
  "card_xp",
  "rarity_prestige",
  "earlier_submission",
  "entry_id",
] as const;

export const PLAYER_SCORE_RULES = {
  positive: {
    goal: 8,
    assist: 6,
    cleanSheetGoalkeeper: 10,
    cleanSheetDefender: 8,
    cleanSheetMidfielder: 5,
    penaltySaveGoalkeeper: 12,
    everyThreeSavesGoalkeeper: 2,
    minutes60Plus: 25,
    minutes30To59: 15,
    minutes1To29: 10,
    fplBonusMultiplier: 3,
    multiCategoryContribution: 5,
  },
  negative: {
    yellowCard: -3,
    redCard: -10,
    ownGoal: -10,
    penaltyMissed: -8,
    extraGoalConcededGoalkeeperOrDefender: -2,
  },
  caps: {
    decisiveMin: 0,
    decisiveMax: 40,
    performanceMin: 0,
    performanceMax: 40,
    penaltiesMin: -20,
    penaltiesMax: 0,
    bonusMin: 0,
    bonusMax: 20,
    finalMin: 0,
    finalMax: 100,
  },
} as const;

export const RARITY_ENTRY_FEES = {
  common: 10,
  rare: 50,
  unique: 100,
  epic: 250,
  legendary: 500,
} as const;

export const RARITY_PRIZE_FUNDING_MULTIPLIERS = {
  common: 2,
  rare: 1.8,
  unique: 1.7,
  epic: 1.6,
  legendary: 1.5,
} as const;

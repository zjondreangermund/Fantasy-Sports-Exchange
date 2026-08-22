// Canonical shared Fantasy Arena game rules.
// Keep these constants aligned with server/services/scoring.ts and tournament entry validation.

export const TOURNAMENT_LINEUP_SLOTS = ["GK", "DEF", "MID", "FWD", "UTILITY"] as const;
export const TOURNAMENT_REQUIRED_POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
export const TOURNAMENT_UTILITY_POSITIONS = ["DEF", "MID", "FWD"] as const;
export const TOURNAMENT_CARD_COUNT = 5;
export const CAPTAIN_MULTIPLIER = 1.1;
export const CAPTAIN_BONUS_PERCENT = 10;
export const PREMIER_LEAGUE_ONLY = true;
export const TOURNAMENT_SETTLEMENT_DAY = "Tuesday";
export const TOURNAMENT_SETTLEMENT_TIME_CAT = "23:59";
export const CUP_FIXTURES_COUNT = false;
export const POST_SETTLEMENT_FIXTURES_COUNT = false;
export const SUBMITTED_LINEUPS_ARE_FINAL = true;
export const MULTIPLE_ENTRIES_ALLOWED = true;
export const REUSE_CARDS_WITHIN_TOURNAMENT = false;

export type TournamentRarity = "common" | "rare" | "unique" | "epic" | "legendary";

export const TOURNAMENT_RARITY_ORDER: Record<TournamentRarity, number> = {
  common: 1,
  rare: 2,
  unique: 3,
  epic: 4,
  legendary: 5,
};

export const TOURNAMENT_RARITY_REQUIREMENTS: Record<TournamentRarity, {
  requiredTournamentRarityCards: number;
  allowedRarities: TournamentRarity[];
  shortLabel: string;
  description: string;
}> = {
  common: {
    requiredTournamentRarityCards: 5,
    allowedRarities: ["common"],
    shortLabel: "5 Common cards",
    description: "A Common tournament requires five Common cards.",
  },
  rare: {
    requiredTournamentRarityCards: 4,
    allowedRarities: ["common", "rare"],
    shortLabel: "4 Rare + 1 Common/Rare",
    description: "A Rare tournament requires at least four Rare cards. The fifth card may be Common or Rare.",
  },
  unique: {
    requiredTournamentRarityCards: 3,
    allowedRarities: ["common", "rare", "unique"],
    shortLabel: "3 Unique + 2 lower/Unique",
    description: "A Unique tournament requires at least three Unique cards. The other two may be Common, Rare or Unique.",
  },
  epic: {
    requiredTournamentRarityCards: 2,
    allowedRarities: ["common", "rare", "unique", "epic"],
    shortLabel: "2 Epic + 3 lower/Epic",
    description: "An Epic tournament requires at least two Epic cards. The other three may be Common, Rare, Unique or Epic.",
  },
  legendary: {
    requiredTournamentRarityCards: 1,
    allowedRarities: ["common", "rare", "unique", "epic", "legendary"],
    shortLabel: "1 Legendary + any 4",
    description: "A Legendary tournament requires at least one Legendary card. The other four may be any rarity.",
  },
};

export function normalizeTournamentRarity(value: unknown): TournamentRarity {
  const rarity = String(value || "common").toLowerCase();
  if (rarity === "legendary") return "legendary";
  if (rarity === "epic") return "epic";
  if (rarity === "unique") return "unique";
  if (rarity === "rare") return "rare";
  return "common";
}

export function getTournamentRarityRequirement(value: unknown) {
  return TOURNAMENT_RARITY_REQUIREMENTS[normalizeTournamentRarity(value)];
}

export function isCardRarityAllowedInTournament(cardRarity: unknown, tournamentRarity: unknown): boolean {
  const requirement = getTournamentRarityRequirement(tournamentRarity);
  return requirement.allowedRarities.includes(normalizeTournamentRarity(cardRarity));
}

export function validateTournamentRarityLineup(cardRarities: unknown[], tournamentRarity: unknown) {
  const tier = normalizeTournamentRarity(tournamentRarity);
  const requirement = TOURNAMENT_RARITY_REQUIREMENTS[tier];
  const normalized = (Array.isArray(cardRarities) ? cardRarities : []).map(normalizeTournamentRarity);
  if (normalized.length !== TOURNAMENT_CARD_COUNT) {
    return { valid: false, message: `Exactly ${TOURNAMENT_CARD_COUNT} cards are required.` };
  }
  const disallowed = normalized.find((rarity) => !requirement.allowedRarities.includes(rarity));
  if (disallowed) {
    return {
      valid: false,
      message: `${tier} tournaments may only use ${requirement.allowedRarities.join(", ")} cards.`,
    };
  }
  const exactTierCount = normalized.filter((rarity) => rarity === tier).length;
  if (exactTierCount < requirement.requiredTournamentRarityCards) {
    return {
      valid: false,
      message: `${tier} tournaments require at least ${requirement.requiredTournamentRarityCards} ${tier} card${requirement.requiredTournamentRarityCards === 1 ? "" : "s"}.`,
    };
  }
  return { valid: true, message: requirement.description };
}

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
  detailedPerformance: {
    completedPassesPerPoint: 12,
    completedPassesMax: 8,
    keyPass: 2.2,
    tackle: 1.4,
    interception: 1.6,
    duelWon: 0.65,
    shotOnTarget: 1.5,
    successfulDribble: 1,
    block: 0.8,
    foulDrawn: 0.5,
    foulCommitted: -0.5,
  },
  fallbackPerformance: {
    ictPerPoint: 10,
    ictMax: 10,
    bpsPerPoint: 10,
    bpsMax: 5,
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
  common: 1.7,
  rare: 1.6,
  unique: 1.5,
  epic: 1.4,
  legendary: 1.3,
} as const;

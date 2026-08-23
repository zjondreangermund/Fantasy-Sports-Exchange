import {
  CARD_SUPPLY_CAP_BY_RARITY,
  MARKETPLACE_FLOOR_BY_RARITY,
  RARITY_ORDER,
  TOURNAMENT_ENTRY_BY_RARITY,
} from "../../shared/card-economy.js";

export const RARITY_PRESTIGE: Record<string, number> = {
  common: 1,
  rare: 3,
  unique: 7,
  epic: 15,
  legendary: 30,
};

export const ARENA_TOURNAMENT_PRICE_PRESETS = {
  common: [0, 10, 20],
  rare: [50, 75, 100],
  unique: [100, 150, 200],
  epic: [250, 300, 500],
  legendary: [500, 1000, 2500],
};

export const ARENA_PACK_PRICE_PRESETS = [
  { key: "starter", name: "Starter Pack", price: 0, description: "5 Common cards. One-time onboarding pack." },
  { key: "bronze", name: "Bronze Pack", price: 39, description: "5 Commons with Rare chance." },
  { key: "silver", name: "Silver Pack", price: 99, description: "Guaranteed Rare chance structure." },
  { key: "gold", name: "Gold Pack", price: 249, description: "Most popular. Epic guaranteed concept." },
  { key: "platinum", name: "Platinum Pack", price: 499, description: "Premium pack for serious collectors." },
  { key: "diamond", name: "Diamond Vault Pack", price: 999, description: "Unique-focused premium vault pack." },
];

export const ARENA_OFFICIAL_TIERS = [
  { key: "community", name: "Community Cup", rarity: "common", entryFees: [0, 10, 20], prizeTheme: "Packs, badges, XP, small sponsored goods" },
  { key: "bronze", name: "Rare Cup", rarity: "rare", entryFees: [50, 75, 100], prizeTheme: "Games, gift cards, headsets, controllers" },
  { key: "unique", name: "Unique Invitational", rarity: "unique", entryFees: [100, 150, 200], prizeTheme: "Premium electronics, vouchers and getaways" },
  { key: "epic", name: "Epic Masters", rarity: "epic", entryFees: [250, 300, 500], prizeTheme: "High-value electronics, holidays and headline prizes" },
  { key: "legendary", name: "Legendary Arena", rarity: "legendary", entryFees: [500, 1000, 2500], prizeTheme: "VIP finals and flagship grand-prize campaigns" },
];

type RankedEntry = any & {
  tiebreak?: {
    totalScore: number;
    captainPoints: number;
    providerRatingTotal: number;
    goalsScored: number;
    assists: number;
    keyPasses: number;
    shotsOnTarget: number;
    defensiveActions: number;
    goalkeeperSaves: number;
    completedPasses: number;
    minutesPlayed: number;
    squadValue: number;
    totalXp: number;
    rarityPrestige: number;
    joinedAt: string | null;
    scoringGameWeek?: number;
    scoringFinal?: boolean;
    scoringComplete?: boolean;
    reason: string;
  };
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function cardPoints(card: any) {
  const scores = Array.isArray(card?.last5Scores) ? card.last5Scores : [];
  const latest = scores.length ? toNumber(scores[scores.length - 1]) : 0;
  return toNumber(card?.decisiveScore, latest || toNumber(card?.player?.totalPoints) || toNumber(card?.player?.form));
}

function cardValue(card: any) {
  const explicit = toNumber(card?.price);
  if (explicit > 0) return explicit;
  const fplCost = toNumber(card?.player?.nowCost);
  if (fplCost > 0) return fplCost;
  return toNumber(card?.player?.overall, 50);
}

function rarityPrestige(card: any) {
  return RARITY_PRESTIGE[String(card?.rarity || "common").toLowerCase()] || RARITY_PRESTIGE.common;
}

function getScoringSnapshot(entry: any): Record<string, any> | null {
  const snapshot = asObject(asObject(entry?.tiebreakMeta).scoring);
  if (Number(snapshot?.version || 0) < 2) return null;
  return snapshot;
}

export async function buildEntryTiebreak(storage: any, entry: any) {
  const snapshot = getScoringSnapshot(entry);
  if (snapshot) {
    return {
      totalScore: toNumber(entry?.totalScore, toNumber(snapshot.totalScore)),
      captainPoints: toNumber(snapshot.captainBasePoints),
      providerRatingTotal: toNumber(snapshot.providerRatingTotal),
      goalsScored: toNumber(snapshot.goalsScored),
      assists: toNumber(snapshot.assists),
      keyPasses: toNumber(snapshot.keyPasses),
      shotsOnTarget: toNumber(snapshot.shotsOnTarget),
      defensiveActions: toNumber(snapshot.defensiveActions),
      goalkeeperSaves: toNumber(snapshot.goalkeeperSaves),
      completedPasses: toNumber(snapshot.completedPasses),
      minutesPlayed: toNumber(snapshot.minutesPlayed),
      squadValue: toNumber(snapshot.squadValue),
      totalXp: toNumber(snapshot.totalXp),
      rarityPrestige: toNumber(snapshot.rarityPrestige),
      joinedAt: entry?.joinedAt ? new Date(entry.joinedAt).toISOString() : null,
      scoringGameWeek: toNumber(snapshot.gameWeek),
      scoringFinal: Boolean(snapshot.final),
      scoringComplete: Boolean(snapshot.complete),
    };
  }

  const cardIds = Array.isArray(entry?.lineupCardIds) ? entry.lineupCardIds.map(Number).filter((id: number) => Number.isFinite(id) && id > 0) : [];
  const cards = await Promise.all(cardIds.map((id: number) => storage.getPlayerCardWithPlayer(id, String(entry?.userId || ""))));
  const validCards = cards.filter(Boolean);
  const captainId = Number(entry?.captainId || cardIds[0] || 0);
  const captain = validCards.find((card: any) => Number(card?.id) === captainId);

  return {
    totalScore: toNumber(entry?.totalScore),
    captainPoints: captain ? cardPoints(captain) : 0,
    providerRatingTotal: 0,
    goalsScored: 0,
    assists: 0,
    keyPasses: 0,
    shotsOnTarget: 0,
    defensiveActions: 0,
    goalkeeperSaves: 0,
    completedPasses: 0,
    minutesPlayed: 0,
    squadValue: validCards.reduce((sum: number, card: any) => sum + cardValue(card), 0),
    totalXp: validCards.reduce((sum: number, card: any) => sum + toNumber(card?.xp), 0),
    rarityPrestige: validCards.reduce((sum: number, card: any) => sum + rarityPrestige(card), 0),
    joinedAt: entry?.joinedAt ? new Date(entry.joinedAt).toISOString() : null,
    scoringGameWeek: 0,
    scoringFinal: false,
    scoringComplete: false,
  };
}

export function compareTiebreak(a: RankedEntry, b: RankedEntry) {
  const at = a.tiebreak || {};
  const bt = b.tiebreak || {};
  if (toNumber(bt.totalScore) !== toNumber(at.totalScore)) return toNumber(bt.totalScore) - toNumber(at.totalScore);
  if (toNumber(bt.captainPoints) !== toNumber(at.captainPoints)) return toNumber(bt.captainPoints) - toNumber(at.captainPoints);
  if (toNumber(bt.providerRatingTotal) !== toNumber(at.providerRatingTotal)) return toNumber(bt.providerRatingTotal) - toNumber(at.providerRatingTotal);
  if (toNumber(bt.goalsScored) !== toNumber(at.goalsScored)) return toNumber(bt.goalsScored) - toNumber(at.goalsScored);
  if (toNumber(bt.assists) !== toNumber(at.assists)) return toNumber(bt.assists) - toNumber(at.assists);
  if (toNumber(bt.keyPasses) !== toNumber(at.keyPasses)) return toNumber(bt.keyPasses) - toNumber(at.keyPasses);
  if (toNumber(bt.shotsOnTarget) !== toNumber(at.shotsOnTarget)) return toNumber(bt.shotsOnTarget) - toNumber(at.shotsOnTarget);
  if (toNumber(bt.defensiveActions) !== toNumber(at.defensiveActions)) return toNumber(bt.defensiveActions) - toNumber(at.defensiveActions);
  if (toNumber(bt.goalkeeperSaves) !== toNumber(at.goalkeeperSaves)) return toNumber(bt.goalkeeperSaves) - toNumber(at.goalkeeperSaves);
  if (toNumber(bt.completedPasses) !== toNumber(at.completedPasses)) return toNumber(bt.completedPasses) - toNumber(at.completedPasses);
  if (toNumber(bt.minutesPlayed) !== toNumber(at.minutesPlayed)) return toNumber(bt.minutesPlayed) - toNumber(at.minutesPlayed);
  if (toNumber(at.squadValue) !== toNumber(bt.squadValue)) return toNumber(at.squadValue) - toNumber(bt.squadValue);
  if (toNumber(bt.totalXp) !== toNumber(at.totalXp)) return toNumber(bt.totalXp) - toNumber(at.totalXp);
  if (toNumber(bt.rarityPrestige) !== toNumber(at.rarityPrestige)) return toNumber(bt.rarityPrestige) - toNumber(at.rarityPrestige);
  const aj = at.joinedAt ? new Date(at.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bj = bt.joinedAt ? new Date(bt.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aj !== bj) return aj - bj;
  return toNumber(a.id) - toNumber(b.id);
}

export function tiebreakReason(winner: RankedEntry, runnerUp?: RankedEntry) {
  if (!runnerUp) return "Highest fantasy points";
  const w = winner.tiebreak || {};
  const r = runnerUp.tiebreak || {};
  if (toNumber(w.totalScore) !== toNumber(r.totalScore)) return "Highest fantasy points";
  if (toNumber(w.captainPoints) !== toNumber(r.captainPoints)) return "Captain points tiebreak";
  if (toNumber(w.providerRatingTotal) !== toNumber(r.providerRatingTotal)) return "Combined match ratings tiebreak";
  if (toNumber(w.goalsScored) !== toNumber(r.goalsScored)) return "Goals scored tiebreak";
  if (toNumber(w.assists) !== toNumber(r.assists)) return "Assists tiebreak";
  if (toNumber(w.keyPasses) !== toNumber(r.keyPasses)) return "Key passes tiebreak";
  if (toNumber(w.shotsOnTarget) !== toNumber(r.shotsOnTarget)) return "Shots on target tiebreak";
  if (toNumber(w.defensiveActions) !== toNumber(r.defensiveActions)) return "Defensive actions tiebreak";
  if (toNumber(w.goalkeeperSaves) !== toNumber(r.goalkeeperSaves)) return "Goalkeeper saves tiebreak";
  if (toNumber(w.completedPasses) !== toNumber(r.completedPasses)) return "Completed passes tiebreak";
  if (toNumber(w.minutesPlayed) !== toNumber(r.minutesPlayed)) return "Minutes played tiebreak";
  if (toNumber(w.squadValue) !== toNumber(r.squadValue)) return "Lower squad value tiebreak";
  if (toNumber(w.totalXp) !== toNumber(r.totalXp)) return "Card XP tiebreak";
  if (toNumber(w.rarityPrestige) !== toNumber(r.rarityPrestige)) return "Rarity prestige tiebreak";
  return "Earlier lineup lock tiebreak";
}

export async function rankCompetitionEntries(storage: any, entries: any[]) {
  const enriched: RankedEntry[] = await Promise.all(
    (entries || []).map(async (entry: any) => ({ ...entry, tiebreak: await buildEntryTiebreak(storage, entry) })),
  );
  enriched.sort(compareTiebreak);
  return enriched.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    tiebreak: {
      ...entry.tiebreak,
      reason: tiebreakReason(entry, enriched[index + 1]),
    },
  }));
}

export function economyConfigPayload() {
  return {
    tournamentPricePresets: ARENA_TOURNAMENT_PRICE_PRESETS,
    packPricePresets: ARENA_PACK_PRICE_PRESETS,
    officialTiers: ARENA_OFFICIAL_TIERS,
    rarityOrder: RARITY_ORDER,
    rarityEntryFees: TOURNAMENT_ENTRY_BY_RARITY,
    raritySupplyCaps: CARD_SUPPLY_CAP_BY_RARITY,
    marketplaceFloors: MARKETPLACE_FLOOR_BY_RARITY,
    tiebreakRules: [
      "Fantasy points",
      "Captain points",
      "Combined official match ratings",
      "Goals scored",
      "Assists",
      "Key passes",
      "Shots on target",
      "Defensive actions",
      "Goalkeeper saves",
      "Completed passes",
      "Minutes played",
      "Lower squad value",
      "Card XP",
      "Rarity prestige",
      "Earlier lineup lock",
    ],
    platformFeeRate: 0.2,
    prizePoolRate: 0.8,
  };
}

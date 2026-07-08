export const RARITY_PRESTIGE: Record<string, number> = {
  common: 1,
  rare: 3,
  epic: 7,
  unique: 15,
  legendary: 30,
};

export const ARENA_TOURNAMENT_PRICE_PRESETS = {
  common: [0, 10, 20],
  rare: [50, 75, 100],
  epic: [150, 250, 300],
  unique: [500, 750, 1000],
  legendary: [1000, 2500, 5000],
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
  { key: "bronze", name: "Bronze Cup", rarity: "rare", entryFees: [50, 75, 100], prizeTheme: "Games, gift cards, headsets, controllers" },
  { key: "gold", name: "Gold Masters", rarity: "epic", entryFees: [150, 250, 300], prizeTheme: "PS5, Xbox, monitors, gaming chairs" },
  { key: "diamond", name: "Diamond Invitational", rarity: "unique", entryFees: [500, 750, 1000], prizeTheme: "TVs, gaming PCs, phones, holidays" },
  { key: "legendary", name: "Legendary Arena", rarity: "legendary", entryFees: [1000, 2500, 5000], prizeTheme: "VIP finals, grand prize electronics, vehicle/holiday campaigns" },
];

type RankedEntry = any & {
  tiebreak?: {
    totalScore: number;
    captainPoints: number;
    squadValue: number;
    totalXp: number;
    rarityPrestige: number;
    joinedAt: string | null;
    reason: string;
  };
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
  if (fplCost > 0) return fplCost / 10;
  return toNumber(card?.player?.overall, 50);
}

function rarityPrestige(card: any) {
  return RARITY_PRESTIGE[String(card?.rarity || "common").toLowerCase()] || RARITY_PRESTIGE.common;
}

export async function buildEntryTiebreak(storage: any, entry: any) {
  const cardIds = Array.isArray(entry?.lineupCardIds) ? entry.lineupCardIds.map(Number).filter((id: number) => Number.isFinite(id) && id > 0) : [];
  const cards = await Promise.all(cardIds.map((id: number) => storage.getPlayerCardWithPlayer(id, String(entry?.userId || ""))));
  const validCards = cards.filter(Boolean);
  const captainId = Number(entry?.captainId || cardIds[0] || 0);
  const captain = validCards.find((card: any) => Number(card?.id) === captainId);

  return {
    totalScore: toNumber(entry?.totalScore),
    captainPoints: captain ? cardPoints(captain) : 0,
    squadValue: validCards.reduce((sum: number, card: any) => sum + cardValue(card), 0),
    totalXp: validCards.reduce((sum: number, card: any) => sum + toNumber(card?.xp), 0),
    rarityPrestige: validCards.reduce((sum: number, card: any) => sum + rarityPrestige(card), 0),
    joinedAt: entry?.joinedAt ? new Date(entry.joinedAt).toISOString() : null,
  };
}

export function compareTiebreak(a: RankedEntry, b: RankedEntry) {
  const at = a.tiebreak || {};
  const bt = b.tiebreak || {};
  if (toNumber(bt.totalScore) !== toNumber(at.totalScore)) return toNumber(bt.totalScore) - toNumber(at.totalScore);
  if (toNumber(bt.captainPoints) !== toNumber(at.captainPoints)) return toNumber(bt.captainPoints) - toNumber(at.captainPoints);
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
    tiebreakRules: [
      "Fantasy points",
      "Captain points",
      "Lower squad value",
      "Card XP",
      "Rarity prestige",
      "Earlier lineup lock",
    ],
    platformFeeRate: 0.2,
    prizePoolRate: 0.8,
  };
}

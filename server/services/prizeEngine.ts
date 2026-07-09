export const SEASON_KEY = "2026-27";
export const PRIZE_MARGIN_MULTIPLIER = 1.7;
export const RARITIES = ["common", "rare", "epic", "unique", "legendary"] as const;

type Rarity = (typeof RARITIES)[number];

export const RARITY_ENTRY_FEES: Record<Rarity, number> = {
  common: 30,
  rare: 75,
  epic: 150,
  unique: 300,
  legendary: 500,
};

export const COMMUNITY_ENTRY_FEE = RARITY_ENTRY_FEES.common;

export type PrizeTier = {
  key: string;
  title: string;
  value: number;
  category: string;
  rarity: Rarity;
  requiredEntrants: number;
  unlockTarget: number;
  tierIndex: number;
  entryFee: number;
};

function entryFeeFor(rarity: Rarity) {
  return RARITY_ENTRY_FEES[rarity] || COMMUNITY_ENTRY_FEE;
}

function makePrize(key: string, title: string, value: number, category: string, rarity: Rarity): PrizeTier {
  const entryFee = entryFeeFor(rarity);
  const unlockTarget = Math.ceil(value * PRIZE_MARGIN_MULTIPLIER);
  const requiredEntrants = Math.max(1, Math.ceil(unlockTarget / entryFee));
  return { key, title, value, category, rarity, requiredEntrants, unlockTarget, tierIndex: 0, entryFee };
}

const common = [
  makePrize("common-food-250", "N$250 Food Voucher", 250, "Voucher", "common"),
  makePrize("common-gift-500", "N$500 Gift Voucher", 500, "Voucher", "common"),
  makePrize("common-football", "Premium Football", 750, "Football", "common"),
  makePrize("common-headset", "Gaming Headset", 900, "Gaming", "common"),
  makePrize("common-jersey", "Club Jersey", 1500, "Merch", "common"),
  makePrize("common-controller", "PS5 Controller", 1800, "Gaming", "common"),
];

const rare = [
  makePrize("rare-food-250", "N$250 Food Voucher", 250, "Voucher", "rare"),
  makePrize("rare-gift-500", "N$500 Gift Voucher", 500, "Voucher", "rare"),
  makePrize("rare-headset", "Gaming Headset", 900, "Gaming", "rare"),
  makePrize("rare-jersey", "Premier League Jersey", 1500, "Merch", "rare"),
  makePrize("rare-controller", "PS5 Controller", 1800, "Gaming", "rare"),
  makePrize("rare-game", "PS5 Game of Choice", 2500, "Gaming", "rare"),
  makePrize("rare-smartwatch", "Smart Watch", 2800, "Electronics", "rare"),
  makePrize("rare-tablet", "Tablet", 4500, "Electronics", "rare"),
  makePrize("rare-monitor", "Gaming Monitor", 5500, "Computers", "rare"),
  makePrize("rare-tv", "55 inch Smart TV", 8500, "Electronics", "rare"),
  makePrize("rare-ps5", "PlayStation 5 Console", 13999, "Gaming", "rare"),
  makePrize("rare-phone", "Premium Smartphone", 16000, "Electronics", "rare"),
  makePrize("rare-laptop", "Gaming Laptop", 18000, "Computers", "rare"),
  makePrize("rare-pc", "Gaming PC", 25000, "Gaming", "rare"),
  makePrize("rare-holiday", "Holiday Voucher", 25000, "Travel", "rare"),
];

const epic = [
  makePrize("epic-jersey", "Premier League Jersey", 1500, "Merch", "epic"),
  makePrize("epic-controller", "PS5 Controller", 1800, "Gaming", "epic"),
  makePrize("epic-game", "PS5 Game Bundle", 3000, "Gaming", "epic"),
  makePrize("epic-monitor", "Gaming Monitor", 5500, "Computers", "epic"),
  makePrize("epic-tv", "55 inch Smart TV", 8500, "Electronics", "epic"),
  makePrize("epic-ps5", "PlayStation 5 Console", 13999, "Gaming", "epic"),
  makePrize("epic-phone", "Premium Smartphone", 16000, "Electronics", "epic"),
  makePrize("epic-laptop", "Gaming Laptop", 18000, "Computers", "epic"),
  makePrize("epic-pc", "Gaming PC", 25000, "Gaming", "epic"),
];

const unique = [
  makePrize("unique-monitor", "Gaming Monitor", 5500, "Computers", "unique"),
  makePrize("unique-tv", "55 inch Smart TV", 8500, "Electronics", "unique"),
  makePrize("unique-ps5", "PlayStation 5 Console", 13999, "Gaming", "unique"),
  makePrize("unique-phone", "Premium Smartphone", 16000, "Electronics", "unique"),
  makePrize("unique-laptop", "Gaming Laptop", 18000, "Computers", "unique"),
  makePrize("unique-pc", "Gaming PC", 25000, "Gaming", "unique"),
  makePrize("unique-holiday", "Holiday Voucher", 25000, "Travel", "unique"),
];

const legendary = [
  makePrize("legendary-ps5", "PlayStation 5 Console", 13999, "Gaming", "legendary"),
  makePrize("legendary-phone", "Premium Smartphone", 16000, "Electronics", "legendary"),
  makePrize("legendary-laptop", "Gaming Laptop", 18000, "Computers", "legendary"),
  makePrize("legendary-pc", "Gaming PC", 25000, "Gaming", "legendary"),
  makePrize("legendary-holiday", "Holiday Voucher", 25000, "Travel", "legendary"),
  makePrize("legendary-mega", "Mega Electronics Bundle", 35000, "Electronics", "legendary"),
];

export const PRIZE_LADDERS: Record<Rarity, PrizeTier[]> = { common, rare, epic, unique, legendary };

for (const rarity of RARITIES) {
  PRIZE_LADDERS[rarity].sort((a, b) => a.requiredEntrants - b.requiredEntrants || a.value - b.value);
  PRIZE_LADDERS[rarity].forEach((prize, index) => { prize.tierIndex = index + 1; });
}

export const PRIZE_CATALOG: PrizeTier[] = RARITIES.flatMap((rarity) => PRIZE_LADDERS[rarity]);

export function getEntryFeeForRarity(rarity: unknown): number {
  const key = String(rarity || "common").toLowerCase() as Rarity;
  return RARITY_ENTRY_FEES[key] || COMMUNITY_ENTRY_FEE;
}

export function getPrizeLadder(rarity: unknown): PrizeTier[] {
  const key = String(rarity || "common").toLowerCase() as Rarity;
  return PRIZE_LADDERS[key] || PRIZE_LADDERS.common;
}

export function getActivePrizeForEntries(rarity: unknown, entryCount: unknown) {
  const count = Math.max(0, Number(entryCount || 0));
  const ladder = getPrizeLadder(rarity);
  const unlocked = ladder.filter((item) => count >= item.requiredEntrants);
  const activePrize = unlocked[unlocked.length - 1] || null;
  const nextPrize = ladder.find((item) => count < item.requiredEntrants) || null;
  return { activePrize, nextPrize, ladder, currentEntries: count, prizeUnlocked: Boolean(activePrize), requiredEntrants: activePrize?.requiredEntrants || nextPrize?.requiredEntrants || 0, entrantsToNext: nextPrize ? Math.max(0, nextPrize.requiredEntrants - count) : 0 };
}

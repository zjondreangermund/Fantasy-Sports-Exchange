export const SEASON_KEY = "2026-27";
export const COMMUNITY_ENTRY_FEE = 30;
export const PRIZE_MARGIN_MULTIPLIER = 1.5;
export const RARITIES = ["common", "rare", "epic", "unique", "legendary"] as const;

type Rarity = (typeof RARITIES)[number];

export type PrizeTier = {
  key: string;
  title: string;
  value: number;
  category: string;
  rarity: Rarity;
  requiredEntrants: number;
  unlockTarget: number;
  tierIndex: number;
};

function makePrize(key: string, title: string, value: number, category: string, rarity: Rarity, requiredEntrants?: number): PrizeTier {
  const unlockTarget = Math.ceil(value * PRIZE_MARGIN_MULTIPLIER);
  const calculatedEntrants = Math.max(1, Math.ceil(unlockTarget / COMMUNITY_ENTRY_FEE));
  return { key, title, value, category, rarity, requiredEntrants: requiredEntrants || calculatedEntrants, unlockTarget, tierIndex: 0 };
}

const common = [
  makePrize("common-food-250", "N$250 Food Voucher", 167, "Voucher", "common", 9),
  makePrize("common-airtime-500", "N$500 Airtime / Data", 333, "Voucher", "common", 17),
  makePrize("common-football", "Premium Football", 450, "Football", "common", 23),
  makePrize("common-cap", "Fantasy Arena Cap", 650, "Merch", "common", 33),
  makePrize("common-jersey", "Club Jersey", 1500, "Merch", "common", 75),
];

const rare = [
  makePrize("rare-food-250", "N$250 Food Voucher", 167, "Voucher", "rare", 9),
  makePrize("rare-gift-500", "N$500 Gift Voucher", 500, "Voucher", "rare", 25),
  makePrize("rare-headset", "Gaming Headset", 900, "Gaming", "rare", 45),
  makePrize("rare-jersey", "Premier League Jersey", 1500, "Merch", "rare", 75),
  makePrize("rare-controller", "PS5 Controller", 1800, "Gaming", "rare", 90),
  makePrize("rare-game", "PS5 Game of Choice", 2500, "Gaming", "rare", 125),
  makePrize("rare-smartwatch", "Smart Watch", 2800, "Electronics", "rare", 140),
  makePrize("rare-tablet", "Tablet", 4500, "Electronics", "rare", 225),
  makePrize("rare-monitor", "Gaming Monitor", 5500, "Computers", "rare", 275),
  makePrize("rare-tv", "55 inch Smart TV", 8500, "Electronics", "rare", 425),
  makePrize("rare-ps5", "PlayStation 5 Console", 13999, "Gaming", "rare", 700),
];

const epic = [
  makePrize("epic-jersey", "Premier League Jersey", 1500, "Merch", "epic", 75),
  makePrize("epic-controller", "PS5 Controller", 1800, "Gaming", "epic", 90),
  makePrize("epic-monitor", "Gaming Monitor", 5500, "Computers", "epic", 275),
  makePrize("epic-tv", "55 inch Smart TV", 8500, "Electronics", "epic", 425),
  makePrize("epic-ps5", "PlayStation 5 Console", 13999, "Gaming", "epic", 700),
];

const unique = [
  makePrize("unique-monitor", "Gaming Monitor", 5500, "Computers", "unique", 275),
  makePrize("unique-tv", "55 inch Smart TV", 8500, "Electronics", "unique", 425),
  makePrize("unique-ps5", "PlayStation 5 Console", 13999, "Gaming", "unique", 700),
  makePrize("unique-phone", "Premium Smartphone", 16000, "Electronics", "unique", 800),
  makePrize("unique-laptop", "Gaming Laptop", 18000, "Computers", "unique", 900),
];

const legendary = [
  makePrize("legendary-ps5", "PlayStation 5 Console", 13999, "Gaming", "legendary", 700),
  makePrize("legendary-phone", "Premium Smartphone", 16000, "Electronics", "legendary", 800),
  makePrize("legendary-laptop", "Gaming Laptop", 18000, "Computers", "legendary", 900),
  makePrize("legendary-pc", "Gaming PC", 25000, "Gaming", "legendary", 1250),
  makePrize("legendary-holiday", "Holiday Voucher", 25000, "Travel", "legendary", 1250),
];

export const PRIZE_LADDERS: Record<Rarity, PrizeTier[]> = {
  common,
  rare,
  epic,
  unique,
  legendary,
};

for (const rarity of RARITIES) {
  PRIZE_LADDERS[rarity].sort((a, b) => a.requiredEntrants - b.requiredEntrants || a.value - b.value);
  PRIZE_LADDERS[rarity].forEach((prize, index) => { prize.tierIndex = index + 1; });
}

export const PRIZE_CATALOG: PrizeTier[] = RARITIES.flatMap((rarity) => PRIZE_LADDERS[rarity]);

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
  return {
    activePrize,
    nextPrize,
    ladder,
    currentEntries: count,
    prizeUnlocked: Boolean(activePrize),
    requiredEntrants: activePrize?.requiredEntrants || nextPrize?.requiredEntrants || 0,
    entrantsToNext: nextPrize ? Math.max(0, nextPrize.requiredEntrants - count) : 0,
  };
}

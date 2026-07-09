export const SEASON_KEY = "2026-27";
export const RARITIES = ["common", "rare", "epic", "unique", "legendary"] as const;

type Rarity = (typeof RARITIES)[number];

export const RARITY_ENTRY_FEES: Record<Rarity, number> = {
  common: 10,
  rare: 50,
  unique: 100,
  epic: 250,
  legendary: 500,
};

export const RARITY_MARGIN_MULTIPLIERS: Record<Rarity, number> = {
  common: 2.0,
  rare: 1.8,
  unique: 1.7,
  epic: 1.6,
  legendary: 1.5,
};

export const COMMUNITY_ENTRY_FEE = RARITY_ENTRY_FEES.common;
export const PRIZE_MARGIN_MULTIPLIER = RARITY_MARGIN_MULTIPLIERS.rare;

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
  marginMultiplier: number;
};

function entryFeeFor(rarity: Rarity) {
  return RARITY_ENTRY_FEES[rarity] || COMMUNITY_ENTRY_FEE;
}

function marginFor(rarity: Rarity) {
  return RARITY_MARGIN_MULTIPLIERS[rarity] || PRIZE_MARGIN_MULTIPLIER;
}

function makePrize(key: string, title: string, value: number, category: string, rarity: Rarity): PrizeTier {
  const entryFee = entryFeeFor(rarity);
  const marginMultiplier = marginFor(rarity);
  const unlockTarget = Math.ceil(value * marginMultiplier);
  const requiredEntrants = Math.max(1, Math.ceil(unlockTarget / entryFee));
  return { key, title, value, category, rarity, requiredEntrants, unlockTarget, tierIndex: 0, entryFee, marginMultiplier };
}

const common = [
  makePrize("common-airtime-100", "N$100 Airtime", 100, "Voucher", "common"),
  makePrize("common-food-250", "N$250 Food Voucher", 250, "Voucher", "common"),
  makePrize("common-gift-500", "N$500 Shopping Voucher", 500, "Voucher", "common"),
  makePrize("common-football", "Premium Football", 750, "Football", "common"),
  makePrize("common-cap", "Fantasy Arena Team Cap", 650, "Merch", "common"),
  makePrize("common-headset", "Gaming Headset", 900, "Gaming", "common"),
  makePrize("common-jersey", "Club Jersey", 1500, "Merch", "common"),
  makePrize("common-controller", "PS5 Controller", 1800, "Gaming", "common"),
];

const rare = [
  makePrize("rare-voucher-1000", "N$1,000 Shopping Voucher", 1000, "Voucher", "rare"),
  makePrize("rare-watch", "Smart Watch", 2800, "Electronics", "rare"),
  makePrize("rare-tablet", "Tablet", 4500, "Electronics", "rare"),
  makePrize("rare-jbl", "JBL Speaker", 3000, "Electronics", "rare"),
  makePrize("rare-headset-pro", "Gaming Headset Pro", 2500, "Gaming", "rare"),
  makePrize("rare-game-bundle", "PS5 Game Bundle", 3000, "Gaming", "rare"),
  makePrize("rare-monitor", "Gaming Monitor", 5500, "Computers", "rare"),
  makePrize("rare-tv-55", "55 inch Smart TV", 8500, "Electronics", "rare"),
  makePrize("rare-ps5", "PlayStation 5 Console", 13999, "Gaming", "rare"),
  makePrize("rare-xbox", "Xbox Series X", 13999, "Gaming", "rare"),
  makePrize("rare-gaming-laptop", "Gaming Laptop", 18000, "Computers", "rare"),
  makePrize("rare-gaming-pc", "Gaming PC", 25000, "Gaming", "rare"),
];

const unique = [
  makePrize("unique-iphone", "iPhone / Equivalent Premium Phone", 22000, "Electronics", "unique"),
  makePrize("unique-samsung-ultra", "Samsung Galaxy Ultra", 24000, "Electronics", "unique"),
  makePrize("unique-macbook-air", "MacBook Air", 23000, "Computers", "unique"),
  makePrize("unique-drone", "DJI Drone", 18000, "Electronics", "unique"),
  makePrize("unique-gaming-pc", "Premium Gaming PC", 30000, "Gaming", "unique"),
  makePrize("unique-home-theatre", "Home Theatre Package", 28000, "Electronics", "unique"),
  makePrize("unique-weekend", "Weekend Holiday for Two", 20000, "Travel", "unique"),
  makePrize("unique-quad", "Quad Bike", 45000, "Adventure", "unique"),
  makePrize("unique-jetski-voucher", "Jet Ski Voucher", 55000, "Adventure", "unique"),
  makePrize("unique-motorcycle", "Motorcycle", 65000, "Vehicle", "unique"),
  makePrize("unique-travel-50000", "N$50,000 Travel Voucher", 50000, "Travel", "unique"),
];

const epic = [
  makePrize("epic-rtx-pc", "RTX Gaming PC", 45000, "Gaming", "epic"),
  makePrize("epic-macbook-pro", "MacBook Pro", 45000, "Computers", "epic"),
  makePrize("epic-premium-phone", "Premium Phone", 30000, "Electronics", "epic"),
  makePrize("epic-safari", "Africa Safari Holiday", 60000, "Travel", "epic"),
  makePrize("epic-europe", "Europe Holiday", 90000, "Travel", "epic"),
  makePrize("epic-motorcycle", "Motorcycle", 85000, "Vehicle", "epic"),
  makePrize("epic-small-boat", "Small Boat", 120000, "Adventure", "epic"),
  makePrize("epic-camper", "Camper Trailer", 150000, "Adventure", "epic"),
  makePrize("epic-investment-100k", "N$100,000 Investment Voucher", 100000, "Investment", "epic"),
  makePrize("epic-car-deposit", "Car Deposit Voucher", 150000, "Vehicle", "epic"),
];

const legendary = [
  makePrize("legendary-hilux-d4d", "Toyota Hilux D4D / Equivalent Value", 450000, "Vehicle", "legendary"),
  makePrize("legendary-ford-ranger", "Ford Ranger / Equivalent Value", 500000, "Vehicle", "legendary"),
  makePrize("legendary-amarok", "VW Amarok / Equivalent Value", 600000, "Vehicle", "legendary"),
  makePrize("legendary-fortuner", "Toyota Fortuner / Equivalent Value", 650000, "Vehicle", "legendary"),
  makePrize("legendary-nissan-patrol", "Nissan Patrol / Equivalent Value", 900000, "Vehicle", "legendary"),
  makePrize("legendary-house-deposit", "House Deposit / Equivalent Value", 500000, "Property", "legendary"),
  makePrize("legendary-tiny-home", "Tiny Home / Equivalent Value", 350000, "Property", "legendary"),
  makePrize("legendary-apartment-deposit", "Apartment Deposit / Equivalent Value", 750000, "Property", "legendary"),
  makePrize("legendary-world-holiday", "Around-the-World Holiday", 300000, "Travel", "legendary"),
  makePrize("legendary-world-cup", "FIFA World Cup VIP Trip", 250000, "Travel", "legendary"),
  makePrize("legendary-ucl-final", "UEFA Champions League Final Package", 180000, "Travel", "legendary"),
  makePrize("legendary-fishing-boat", "Fishing Boat", 250000, "Adventure", "legendary"),
  makePrize("legendary-caravan", "Luxury Caravan", 350000, "Adventure", "legendary"),
  makePrize("legendary-dream-home", "Dream Home / Equivalent Value", 1500000, "Property", "legendary"),
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

export function getMarginForRarity(rarity: unknown): number {
  const key = String(rarity || "rare").toLowerCase() as Rarity;
  return RARITY_MARGIN_MULTIPLIERS[key] || PRIZE_MARGIN_MULTIPLIER;
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

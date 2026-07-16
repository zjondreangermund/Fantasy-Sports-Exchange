export const SEASON_KEY = "2026-27";
export const RARITIES = ["common", "rare", "unique", "epic", "legendary"] as const;

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

function makePrize(key: string, title: string, value: number, category: string, rarity: Rarity): PrizeTier {
  const entryFee = RARITY_ENTRY_FEES[rarity];
  const marginMultiplier = RARITY_MARGIN_MULTIPLIERS[rarity];
  const unlockTarget = Math.ceil(value * marginMultiplier);
  const requiredEntrants = Math.max(1, Math.ceil(unlockTarget / entryFee));
  return { key, title, value, category, rarity, requiredEntrants, unlockTarget, tierIndex: 0, entryFee, marginMultiplier };
}

const common = [
  makePrize("common-airtime-100", "N$100 Airtime", 100, "Voucher", "common"),
  makePrize("common-food-250", "N$250 Food Voucher", 250, "Voucher", "common"),
  makePrize("common-shopping-500", "N$500 Shopping Voucher", 500, "Voucher", "common"),
  makePrize("common-cap", "Fantasy Arena Team Cap", 650, "Merch", "common"),
  makePrize("common-football", "Premium Football", 750, "Football", "common"),
  makePrize("common-headset", "Gaming Headset", 900, "Gaming", "common"),
  makePrize("common-powerbank", "Fast-Charge Powerbank", 1100, "Electronics", "common"),
  makePrize("common-speaker", "Bluetooth Speaker", 1300, "Electronics", "common"),
  makePrize("common-jersey", "Official Club Jersey", 1500, "Merch", "common"),
  makePrize("common-controller", "PS5 Controller", 1800, "Gaming", "common"),
  makePrize("common-watch", "Smart Watch", 2200, "Electronics", "common"),
  makePrize("common-phone", "Entry Smartphone", 3500, "Electronics", "common"),
  makePrize("common-tablet", "Compact Tablet", 4500, "Electronics", "common"),
];

const rare = [
  makePrize("rare-airtime-500", "N$500 Airtime / Data", 500, "Voucher", "rare"),
  makePrize("rare-voucher-1000", "N$1,000 Shopping Voucher", 1000, "Voucher", "rare"),
  makePrize("rare-headset-pro", "Gaming Headset Pro", 2500, "Gaming", "rare"),
  makePrize("rare-watch", "Premium Smart Watch", 2800, "Electronics", "rare"),
  makePrize("rare-jbl", "JBL Speaker", 3000, "Electronics", "rare"),
  makePrize("rare-game-bundle", "PS5 Game Bundle", 3000, "Gaming", "rare"),
  makePrize("rare-coffee", "Premium Coffee Machine", 4200, "Home", "rare"),
  makePrize("rare-tablet", "Tablet", 4500, "Electronics", "rare"),
  makePrize("rare-monitor", "Gaming Monitor", 5500, "Computers", "rare"),
  makePrize("rare-chair", "Gaming Chair", 6500, "Gaming", "rare"),
  makePrize("rare-soundbar", "Home Soundbar", 7500, "Electronics", "rare"),
  makePrize("rare-tv-55", "55-inch Smart TV", 8500, "Electronics", "rare"),
  makePrize("rare-weekend", "Weekend Getaway for Two", 10000, "Travel", "rare"),
  makePrize("rare-vr", "VR Headset", 12000, "Gaming", "rare"),
  makePrize("rare-ps5", "PlayStation 5 Console", 13999, "Gaming", "rare"),
  makePrize("rare-xbox", "Xbox Series X", 13999, "Gaming", "rare"),
  makePrize("rare-drone", "DJI Mini Drone / Equivalent", 15000, "Electronics", "rare"),
  makePrize("rare-laptop", "Gaming Laptop", 18000, "Computers", "rare"),
  makePrize("rare-bike", "Mountain Bike", 22000, "Adventure", "rare"),
  makePrize("rare-pc", "Gaming PC", 25000, "Gaming", "rare"),
];

const unique = [
  makePrize("unique-voucher-1000", "N$1,000 Premium Voucher", 1000, "Voucher", "unique"),
  makePrize("unique-gadget-2500", "N$2,500 Gadget Voucher", 2500, "Electronics", "unique"),
  makePrize("unique-tech-5000", "N$5,000 Tech Voucher", 5000, "Electronics", "unique"),
  makePrize("unique-weekend-mini", "Weekend Away Voucher", 7500, "Travel", "unique"),
  makePrize("unique-drone-mini", "Mini DJI Drone / Equivalent", 10000, "Electronics", "unique"),
  makePrize("unique-console", "PS5 Pro / Equivalent Console", 18000, "Gaming", "unique"),
  makePrize("unique-weekend", "Luxury Weekend for Two", 20000, "Travel", "unique"),
  makePrize("unique-iphone", "iPhone Pro / Equivalent", 22000, "Electronics", "unique"),
  makePrize("unique-macbook-air", "MacBook Air", 23000, "Computers", "unique"),
  makePrize("unique-samsung-ultra", "Samsung Galaxy Ultra", 24000, "Electronics", "unique"),
  makePrize("unique-home-theatre", "Home Theatre Package", 28000, "Electronics", "unique"),
  makePrize("unique-gaming-pc", "Premium Gaming PC", 30000, "Gaming", "unique"),
  makePrize("unique-furniture", "N$35,000 Home Furniture Package", 35000, "Home", "unique"),
  makePrize("unique-quad", "Quad Bike", 45000, "Adventure", "unique"),
  makePrize("unique-travel-50000", "N$50,000 Travel Voucher", 50000, "Travel", "unique"),
  makePrize("unique-jetski", "Jet Ski Experience Package", 55000, "Adventure", "unique"),
  makePrize("unique-motorcycle", "Motorcycle", 65000, "Vehicle", "unique"),
  makePrize("unique-cash-75000", "N$75,000 Cash / Equivalent", 75000, "Cash", "unique"),
];

const epic = [
  makePrize("epic-cash-5000", "N$5,000 Cash", 5000, "Cash", "epic"),
  makePrize("epic-cash-10000", "N$10,000 Cash", 10000, "Cash", "epic"),
  makePrize("epic-gaming-laptop", "Premium Gaming Laptop", 25000, "Computers", "epic"),
  makePrize("epic-macbook-pro", "MacBook Pro", 40000, "Computers", "epic"),
  makePrize("epic-rtx-pc", "RTX Gaming PC", 60000, "Gaming", "epic"),
  makePrize("epic-hunting-trip", "Premium Hunting Trip for 4", 80000, "Travel", "epic"),
  makePrize("epic-europe", "Luxury Europe Holiday for Two", 120000, "Travel", "epic"),
  makePrize("epic-furniture", "Luxury Home Furniture Package", 150000, "Home", "epic"),
  makePrize("epic-motorcycle", "KTM / Yamaha Motorcycle", 180000, "Vehicle", "epic"),
  makePrize("epic-quad-bike", "Quad Bike", 220000, "Adventure", "epic"),
  makePrize("epic-cash-250000", "N$250,000 Cash", 250000, "Cash", "epic"),
  makePrize("epic-maldives", "Luxury Maldives Holiday for Two", 280000, "Travel", "epic"),
  makePrize("epic-home-upgrade", "N$300,000 Home Upgrade Package", 300000, "Home", "epic"),
  makePrize("epic-family-holiday", "Luxury Family Holiday (Mauritius, Dubai or Bali)", 350000, "Travel", "epic"),
  makePrize("epic-conqueror", "Conqueror Off-Road Camping Trailer", 420000, "Adventure", "epic"),
  makePrize("epic-cash-500000", "N$500,000 Cash", 500000, "Cash", "epic"),
  makePrize("epic-golf-gti", "Volkswagen Golf 7 GTI / Equivalent", 600000, "Vehicle", "epic"),
  makePrize("epic-everest", "Ford Everest / Equivalent", 700000, "Vehicle", "epic"),
  makePrize("epic-fortuner", "Toyota Fortuner / Equivalent", 900000, "Vehicle", "epic"),
  makePrize("epic-hilux-gr", "Toyota Hilux GR Sport 4×4 Double Cab / Equivalent", 1000000, "Vehicle", "epic"),
];

const legendary = [
  makePrize("legendary-tech-10000", "N$10,000 Luxury Tech Voucher", 10000, "Electronics", "legendary"),
  makePrize("legendary-travel-25000", "N$25,000 Luxury Travel Voucher", 25000, "Travel", "legendary"),
  makePrize("legendary-watch-50000", "Luxury Watch / Equivalent", 50000, "Luxury", "legendary"),
  makePrize("legendary-world-cup", "FIFA World Cup VIP Trip", 250000, "Travel", "legendary"),
  makePrize("legendary-ucl-final", "UEFA Champions League Final Package", 180000, "Travel", "legendary"),
  makePrize("legendary-fishing-boat", "Fishing Boat", 250000, "Adventure", "legendary"),
  makePrize("legendary-world-holiday", "Around-the-World Holiday", 300000, "Travel", "legendary"),
  makePrize("legendary-tiny-home", "Tiny Home / Equivalent Value", 350000, "Property", "legendary"),
  makePrize("legendary-caravan", "Luxury Caravan", 350000, "Adventure", "legendary"),
  makePrize("legendary-house-deposit", "House Deposit / Equivalent Value", 500000, "Property", "legendary"),
  makePrize("legendary-amarok", "VW Amarok / Equivalent Value", 600000, "Vehicle", "legendary"),
  makePrize("legendary-fortuner", "Toyota Fortuner / Equivalent Value", 650000, "Vehicle", "legendary"),
  makePrize("legendary-apartment", "Apartment Deposit / Equivalent Value", 750000, "Property", "legendary"),
  makePrize("legendary-patrol", "Nissan Patrol / Equivalent Value", 900000, "Vehicle", "legendary"),
  makePrize("legendary-land-cruiser", "Toyota Land Cruiser / Equivalent", 1100000, "Vehicle", "legendary"),
  makePrize("legendary-dream-home", "Dream Home / Equivalent Value", 1500000, "Property", "legendary"),
];

export const PRIZE_LADDERS: Record<Rarity, PrizeTier[]> = { common, rare, unique, epic, legendary };

for (const rarity of RARITIES) {
  PRIZE_LADDERS[rarity].sort((a, b) => a.requiredEntrants - b.requiredEntrants || a.value - b.value);
  PRIZE_LADDERS[rarity].forEach((prize, index) => { prize.tierIndex = index + 1; });
}

export const PRIZE_CATALOG: PrizeTier[] = RARITIES.flatMap((rarity) => PRIZE_LADDERS[rarity]);
export function getEntryFeeForRarity(rarity: unknown): number { const key = String(rarity || "common").toLowerCase() as Rarity; return RARITY_ENTRY_FEES[key] || COMMUNITY_ENTRY_FEE; }
export function getMarginForRarity(rarity: unknown): number { const key = String(rarity || "rare").toLowerCase() as Rarity; return RARITY_MARGIN_MULTIPLIERS[key] || PRIZE_MARGIN_MULTIPLIER; }
export function getPrizeLadder(rarity: unknown): PrizeTier[] { const key = String(rarity || "common").toLowerCase() as Rarity; return PRIZE_LADDERS[key] || PRIZE_LADDERS.common; }
export function getActivePrizeForEntries(rarity: unknown, entryCount: unknown) {
  const count = Math.max(0, Number(entryCount || 0));
  const ladder = getPrizeLadder(rarity);
  const unlocked = ladder.filter((item) => count >= item.requiredEntrants);
  const activePrize = unlocked[unlocked.length - 1] || null;
  const nextPrize = ladder.find((item) => count < item.requiredEntrants) || null;
  return { activePrize, nextPrize, ladder, currentEntries: count, prizeUnlocked: Boolean(activePrize), requiredEntrants: activePrize?.requiredEntrants || nextPrize?.requiredEntrants || 0, entrantsToNext: nextPrize ? Math.max(0, nextPrize.requiredEntrants - count) : 0 };
}

import {
  artworkForPrize as artworkForLegacyPrize,
  prizeArtworkCatalog as legacyPrizeArtworkCatalog,
  type PrizeArtwork,
} from "./prizeArtworkCatalogLegacy";

export type { PrizeArtwork } from "./prizeArtworkCatalogLegacy";

type ArtworkRule = PrizeArtwork & { pattern: RegExp };

const COMMON_ARTWORK_VERSION = "2026-08-06-common-50-png-v1";

const commonArtworkEntries = `
N$100 Airtime|common-01-airtime-100.png
N$250 Food Voucher|common-02-food-voucher-250.png
N$500 Shopping Voucher|common-03-shopping-voucher-500.png
Fantasy Arena Team Cap|common-04-fantasy-arena-team-cap.png
Premium Football|common-05-premium-football.png
Gaming Headset|common-06-gaming-headset.png
Fast-Charge Powerbank|common-07-fast-charge-powerbank.png
Bluetooth Speaker|common-08-bluetooth-speaker.png
Official Club Jersey|common-09-official-club-jersey.png
PS5 Controller|common-10-ps5-controller.png
Smart Watch|common-11-smart-watch.png
Entry Smartphone|common-12-entry-smartphone.png
Compact Tablet|common-13-compact-tablet.png
N$5,000 Sports Store Voucher|common-14-sports-store-voucher-5000.png
Premium Coffee Machine|common-15-premium-coffee-machine.png
N$6,000 Home Appliance Voucher|common-16-home-appliance-voucher-6000.png
Fitness Tracker|common-17-fitness-tracker.png
Portable Projector|common-18-portable-projector.png
Gaming Keyboard and Mouse|common-19-gaming-keyboard-and-mouse.png
Weekend Stay Voucher|common-20-weekend-stay-voucher.png
Wireless Earbuds|common-21-wireless-earbuds.png
N$7,000 Cash|common-22-cash-7000.png
32-inch Smart TV|common-23-32-inch-smart-tv.png
Travel Bag Set|common-24-travel-bag-set.png
N$8,000 Fashion Voucher|common-25-fashion-voucher-8000.png
Laptop|common-26-laptop.png
N$10,000 Home Furniture Voucher|common-27-home-furniture-voucher-10000.png
Soundbar|common-28-soundbar.png
Holiday Voucher|common-29-holiday-voucher.png
N$12,000 Cash|common-30-cash-12000.png
Gaming Console|common-31-gaming-console.png
Double-Door Fridge|common-32-double-door-fridge.png
N$15,000 Cash|common-33-cash-15000.png
Bedroom Furniture Set|common-34-bedroom-furniture-set.png
Beach Holiday Voucher|common-35-beach-holiday-voucher.png
Smartphone Pro|common-36-smartphone-pro.png
Luxury Watch|common-37-luxury-watch.png
N$18,000 Cash|common-38-cash-18000.png
Home Entertainment Bundle|common-39-home-entertainment-bundle.png
Adventure Getaway Voucher|common-40-adventure-getaway-voucher.png
Premium Laptop|common-41-premium-laptop.png
N$20,000 Cash|common-42-cash-20000.png
Living Room Furniture Set|common-43-living-room-furniture-set.png
55-inch Smart TV|common-44-55-inch-smart-tv.png
Tropical Holiday Package|common-45-tropical-holiday-package.png
Tablet Pro|common-46-tablet-pro.png
Home Makeover Voucher|common-47-home-makeover-voucher.png
N$22,500 Cash|common-48-cash-22500.png
Vehicle Deposit Voucher|common-49-vehicle-deposit-voucher.png
N$25,000 Grand Prize|common-50-grand-prize-25000.png
`.trim().split("\n").map((line) => {
  const separator = line.lastIndexOf("|");
  return [line.slice(0, separator), line.slice(separator + 1)] as const;
});

function exactTitlePattern(title: string): RegExp {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`^${escaped}$`, "i");
}

const commonRules: ArtworkRule[] = commonArtworkEntries.map(([title, fileName]) => ({
  pattern: exactTitlePattern(title),
  src: `/prizes/common/${fileName}`,
}));

export const prizeArtworkCatalog: Record<string, ArtworkRule[]> = {
  common: commonRules,
  ...legacyPrizeArtworkCatalog,
};

export function artworkForPrize(title: string, rarity: string): PrizeArtwork | null {
  const normalizedRarity = String(rarity || "").toLowerCase();
  if (normalizedRarity !== "common") {
    return artworkForLegacyPrize(title, normalizedRarity);
  }

  const normalizedTitle = String(title || "").trim();
  const artwork = commonRules.find((item) => item.pattern.test(normalizedTitle));
  return artwork ? { src: `${artwork.src}?v=${COMMON_ARTWORK_VERSION}` } : null;
}

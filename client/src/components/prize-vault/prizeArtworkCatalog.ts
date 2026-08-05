import {
  artworkForPrize as artworkForLegacyPrize,
  prizeArtworkCatalog as legacyPrizeArtworkCatalog,
  type PrizeArtwork,
} from "./prizeArtworkCatalogLegacy";

export type { PrizeArtwork } from "./prizeArtworkCatalogLegacy";

type ArtworkRule = PrizeArtwork & { pattern: RegExp };

const COMMON_ARTWORK_VERSION = "2026-08-05-common-50-svg-v1";

const commonArtworkEntries = `
N$100 Airtime|common-01-airtime-100.svg
N$250 Food Voucher|common-02-food-voucher-250.svg
N$500 Shopping Voucher|common-03-shopping-voucher-500.svg
Fantasy Arena Team Cap|common-04-fantasy-arena-team-cap.svg
Premium Football|common-05-premium-football.svg
Gaming Headset|common-06-gaming-headset.svg
Fast-Charge Powerbank|common-07-fast-charge-powerbank.svg
Bluetooth Speaker|common-08-bluetooth-speaker.svg
Official Club Jersey|common-09-official-club-jersey.svg
PS5 Controller|common-10-ps5-controller.svg
Smart Watch|common-11-smart-watch.svg
Entry Smartphone|common-12-entry-smartphone.svg
Compact Tablet|common-13-compact-tablet.svg
N$5,000 Sports Store Voucher|common-14-sports-store-voucher-5000.svg
Premium Coffee Machine|common-15-premium-coffee-machine.svg
N$6,000 Home Appliance Voucher|common-16-home-appliance-voucher-6000.svg
Fitness Tracker|common-17-fitness-tracker.svg
Portable Projector|common-18-portable-projector.svg
Gaming Keyboard and Mouse|common-19-gaming-keyboard-and-mouse.svg
Weekend Stay Voucher|common-20-weekend-stay-voucher.svg
32-inch Smart TV|common-21-32-inch-smart-tv.svg
Premium Wireless Earbuds|common-22-premium-wireless-earbuds.svg
N$10,000 Cash|common-23-cash-10000.svg
Smartphone Upgrade|common-24-smartphone-upgrade.svg
Home Soundbar|common-25-home-soundbar.svg
Gaming Monitor|common-26-gaming-monitor.svg
Mountain Bike|common-27-mountain-bike.svg
PlayStation 5 Digital Console|common-28-playstation-5-digital-console.svg
Everyday Laptop|common-29-everyday-laptop.svg
N$17,000 Travel Voucher|common-30-travel-voucher-17000.svg
43-inch Smart TV|common-31-43-inch-smart-tv.svg
Gaming Chair|common-32-gaming-chair.svg
Premium Smartphone|common-33-premium-smartphone.svg
Gaming Laptop|common-34-gaming-laptop.svg
N$22,000 Cash|common-35-cash-22000.svg
Family Weekend Getaway|common-36-family-weekend-getaway.svg
Home Entertainment Package|common-37-home-entertainment-package.svg
Adventure Experience for Two|common-38-adventure-experience-for-two.svg
Premium Gaming PC|common-39-premium-gaming-pc.svg
N$24,100 Shopping Spree|common-40-shopping-spree-24100.svg
Premium Tablet Bundle|common-41-premium-tablet-bundle.svg
Home Office Setup|common-42-home-office-setup.svg
Sports Equipment Package|common-43-sports-equipment-package.svg
N$24,500 Cash|common-44-cash-24500.svg
Family Grocery and Fuel Bundle|common-45-family-grocery-and-fuel-bundle.svg
Mobile Tech Bundle|common-46-mobile-tech-bundle.svg
Weekend Adventure Package|common-47-weekend-adventure-package.svg
N$24,900 Cash|common-48-cash-24900.svg
Ultimate Electronics Voucher|common-49-ultimate-electronics-voucher.svg
N$25,000 Grand Prize|common-50-grand-prize-25000.svg
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

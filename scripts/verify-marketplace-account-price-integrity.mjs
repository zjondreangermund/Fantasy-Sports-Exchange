#!/usr/bin/env node
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const failures = [];
const expect = (value, message) => { if (!value) failures.push(message); };

const economy = read("shared/card-economy.ts");
const ownership = read("server/services/marketplaceOwnership.ts");
const seed = read("server/seed.ts");
const marketRoute = read("server/routes/marketplace.routes.ts");
const priceSurfaces = [
  "client/src/pages/marketplace-v2.tsx",
  "client/src/pages/marketplace.tsx",
  "client/src/components/native/NativeMarketPage.tsx",
  "client/src/components/native/NativeCardTradeSheet.tsx",
  "client/src/lib/fantasy-card-adapter.ts",
  "client/src/components/cards/CollectionStableCard.tsx",
  "client/src/components/cards/UnifiedPlayerCard.tsx",
  "client/src/components/cards/PlayerCard.tsx",
  "client/src/components/CardThumbnail.tsx",
  "client/src/components/Card3D.tsx",
  "client/src/pages/collection-clean.tsx",
  "client/src/pages/collection.tsx",
].map(read);

expect(economy.includes("export function getMarketplaceListingPrice"), "Marketplace prices must have one shared resolver");
expect(economy.includes("listing?.price !== undefined ? listing.price : listing?.listedPrice"), "The canonical price field must win even when it is zero");
expect(ownership.includes("card.for_sale = true"), "Cleanup must affect listed cards only");
expect(ownership.includes("card.owner_id IS NULL"), "Cleanup must target ownerless legacy listings");
expect(ownership.includes("NOT EXISTS"), "Cleanup must target listings without a matching account");
expect(ownership.includes("NON_REAL_MARKETPLACE_OWNER_IDS"), "Cleanup must target seeded demo accounts");
expect(ownership.includes("SET for_sale = false, price = 0"), "Cleanup must unlist, not delete, invalid card records");
expect(!/DELETE\s+FROM\s+app\.player_cards/i.test(ownership), "Cleanup must preserve card rows and references");
expect(seed.includes("unlistNonRealMarketplaceListings()"), "Startup must apply the bounded cleanup");
expect(!seed.includes("const marketplaceCards = ["), "Startup must not reseed synthetic marketplace listings");
expect(!seed.includes("ownerId: null"), "Seed data must not create ownerless listings");
expect(marketRoute.includes("join app.users real_owner on real_owner.id = pc.owner_id"), "Public marketplace listings must have a real account owner");
expect(marketRoute.includes("NON_REAL_MARKETPLACE_OWNER_IDS"), "Public listings must exclude seeded demo accounts");
expect(marketRoute.includes("pc.for_sale = true"), "Public listings must still be limited to active listings");
expect(priceSurfaces.every((source) => source.includes("getMarketplaceListingPrice")), "All desktop, mobile, collection and card surfaces must use the shared listing price");
expect(!priceSurfaces.some((source) => /price\s*\|\|\s*[^;\n]*listedPrice/.test(source)), "No listing surface may fall back from a zero ask to a stale alias");

if (failures.length) {
  console.error("Marketplace account and price integrity verification failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exit(1);
}

console.log("Marketplace listing ownership cleanup and shared price resolution are wired across desktop, mobile, collection and card surfaces.");

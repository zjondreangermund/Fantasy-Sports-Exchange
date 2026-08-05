import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artworkDirectory = path.join(root, "client", "public", "prizes", "legendary");
const catalogDirectory = path.join(
  root,
  "client",
  "src",
  "components",
  "prize-vault",
);
const catalogPath = path.join(catalogDirectory, "prizeArtworkCatalog.ts");
const legacyCatalogPath = path.join(catalogDirectory, "prizeArtworkCatalogLegacy.ts");
const artworkComponentPath = path.join(catalogDirectory, "PremiumPrizeArtwork.tsx");

const expectedFiles = [
  "legendary-01-cash-10000.png",
  "legendary-02-luxury-travel-voucher.png",
  "legendary-03-luxury-watch.png",
  "legendary-04-luxury-african-safari-for-two.png",
  "legendary-05-cash-250000.png",
  "legendary-06-fishing-boat.png",
  "legendary-07-holiday.png",
  "legendary-08-tiny-home.png",
  "legendary-09-luxury-caravan.png",
  "legendary-10-house-deposit.png",
  "legendary-11-vw-amarok.png",
  "legendary-12-toyota-fortuner.png",
  "legendary-13-apartment-deposit.png",
  "legendary-14-nissan-patrol.png",
  "legendary-15-toyota-land-cruiser.png",
  "legendary-16-house.png",
  "legendary-17-cash-2000000.png",
  "legendary-18-luxury-performance-suv.png",
  "legendary-19-luxury-yacht.png",
  "legendary-20-grand-prize-cash-5000000.png",
];

const pngSignature = "89504e470d0a1a0a";
for (const fileName of expectedFiles) {
  const filePath = path.join(artworkDirectory, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Legendary artwork file: ${fileName}`);
  }

  const image = fs.readFileSync(filePath);
  if (image.length < 10_000 || image.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error(`Invalid Legendary PNG artwork: ${fileName}`);
  }
}

if (!fs.existsSync(legacyCatalogPath)) {
  throw new Error("Missing legacy Prize Vault artwork catalog");
}

const catalog = fs.readFileSync(catalogPath, "utf8");
const legacyCatalog = fs.readFileSync(legacyCatalogPath, "utf8");
const combinedCatalog = `${catalog}\n${legacyCatalog}`;

for (const fileName of expectedFiles) {
  const publicPath = `/prizes/legendary/${fileName}`;
  if (!combinedCatalog.includes(`src: "${publicPath}"`)) {
    throw new Error(`Legendary catalog is not linked to ${publicPath}`);
  }
}

const legendarySection = legacyCatalog.match(/legendary:\s*\[([\s\S]*?)\n\s*\],\n\};/i)?.[1] || "";
const mappedPngs = [...legendarySection.matchAll(/src:\s*"\/prizes\/legendary\/([^"]+\.png)"/g)]
  .map((match) => match[1]);
if (mappedPngs.length !== 20 || new Set(mappedPngs).size !== 20) {
  throw new Error(`Expected 20 unique Legendary PNG mappings, received ${mappedPngs.length}`);
}
if (/\.svg|LEGENDARY_SPRITE|spriteIndex/i.test(legendarySection)) {
  throw new Error("Legendary catalog still contains obsolete SVG or sprite mappings");
}

const artworkComponent = fs.readFileSync(artworkComponentPath, "utf8");
if (/LegendaryCrispPoster|rarity\s*===\s*["']legendary["']/i.test(artworkComponent)) {
  throw new Error("Legendary artwork is still using a special renderer instead of the shared rarity image renderer");
}

console.log(`[prize-artwork] Verified ${expectedFiles.length} individual Legendary PNG files and direct catalog mappings`);

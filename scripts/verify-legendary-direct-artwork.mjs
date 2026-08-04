import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spritePath = path.join(
  root,
  "client",
  "public",
  "prizes",
  "legendary",
  "legendary-prize-sprite-direct.webp",
);
const catalogPath = path.join(
  root,
  "client",
  "src",
  "components",
  "prize-vault",
  "prizeArtworkCatalog.ts",
);

if (!fs.existsSync(spritePath)) {
  throw new Error("Missing direct Legendary WebP artwork");
}

const image = fs.readFileSync(spritePath);
const isWebp = image.length > 50_000
  && image.toString("ascii", 0, 4) === "RIFF"
  && image.toString("ascii", 8, 12) === "WEBP";
if (!isWebp) {
  throw new Error("Invalid direct Legendary WebP artwork");
}

const catalog = fs.readFileSync(catalogPath, "utf8");
if (!catalog.includes('const LEGENDARY_SPRITE = "/prizes/legendary/legendary-prize-sprite-direct.webp"')) {
  throw new Error("Legendary catalog is not linked to the direct WebP artwork");
}

const legendarySection = catalog.match(/legendary:\s*\[([\s\S]*?)\n\s*\],\n\};/i)?.[1] || "";
const indexes = [...legendarySection.matchAll(/spriteIndex:\s*(\d+)/g)].map((match) => Number(match[1]));
const expected = Array.from({ length: 20 }, (_, index) => index);
if (indexes.length !== expected.length || indexes.some((value, index) => value !== expected[index])) {
  throw new Error(`Expected Legendary sprite indexes 0-19, received: ${indexes.join(", ")}`);
}

console.log(`[prize-artwork] Verified direct Legendary WebP (${image.length} bytes) and 20 catalog mappings`);

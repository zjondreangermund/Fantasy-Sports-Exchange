import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artworkDirectory = path.join(root, "client", "public", "prizes", "legendary");
const outputPath = path.join(artworkDirectory, "legendary-prize-sprite-direct.webp");
const catalogPath = path.join(
  root,
  "client",
  "src",
  "components",
  "prize-vault",
  "prizeArtworkCatalog.ts",
);

const chunkFiles = fs
  .readdirSync(artworkDirectory)
  .filter((name) => /^direct-sprite-\d+\.txt$/i.test(name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

if (chunkFiles.length !== 5) {
  throw new Error(`Expected 5 direct Legendary artwork chunks, found ${chunkFiles.length}`);
}

const encoded = chunkFiles
  .map((name) => fs.readFileSync(path.join(artworkDirectory, name), "utf8"))
  .join("")
  .replace(/\s+/g, "");

const image = Buffer.from(encoded, "base64");
const isWebp = image.length > 50_000
  && image.toString("ascii", 0, 4) === "RIFF"
  && image.toString("ascii", 8, 12) === "WEBP";

if (!isWebp) {
  throw new Error("Legendary Prize Vault direct artwork did not decode to a valid WebP image");
}

fs.writeFileSync(outputPath, image);

const legendaryRules = [
  [String.raw`/^N\$10,?000\s+Luxury\s+Tech\s+Voucher$/i`, 0],
  [String.raw`/^N\$25,?000\s+Luxury\s+Travel\s+Voucher$/i`, 1],
  [String.raw`/^Luxury\s+Watch\s*\/\s*Equivalent$/i`, 2],
  [String.raw`/^Luxury\s+African\s+Safari\s+for\s+Two$/i`, 3],
  [String.raw`/^FIFA\s+World\s+Cup\s+VIP\s+Trip$/i`, 4],
  [String.raw`/^Fishing\s+Boat$/i`, 5],
  [String.raw`/^Around-the-World\s+Holiday$/i`, 6],
  [String.raw`/^Tiny\s+Home\s*\/\s*Equivalent\s+Value$/i`, 7],
  [String.raw`/^Luxury\s+Caravan$/i`, 8],
  [String.raw`/^House\s+Deposit\s*\/\s*Equivalent\s+Value$/i`, 9],
  [String.raw`/^VW\s+Amarok\s*\/\s*Equivalent\s+Value$/i`, 10],
  [String.raw`/^Toyota\s+Fortuner\s*\/\s*Equivalent\s+Value$/i`, 11],
  [String.raw`/^Apartment\s+Deposit\s*\/\s*Equivalent\s+Value$/i`, 12],
  [String.raw`/^Nissan\s+Patrol\s*\/\s*Equivalent\s+Value$/i`, 13],
  [String.raw`/^Toyota\s+Land\s+Cruiser\s*\/\s*Equivalent$/i`, 14],
  [String.raw`/^Dream\s+Home\s*\/\s*Equivalent\s+Value$/i`, 15],
  [String.raw`/^N\$2,?000,?000\s+Cash\s*\/\s*Equivalent$/i`, 16],
  [String.raw`/^Luxury\s+Performance\s+SUV\s*\/\s*Equivalent\s+Value$/i`, 17],
  [String.raw`/^Luxury\s+Yacht\s*\/\s*Equivalent\s+Value$/i`, 18],
  [String.raw`/^N\$5,?000,?000\s+Grand\s+Prize\s*\/\s*Equivalent$/i`, 19],
];

let catalog = fs.readFileSync(catalogPath, "utf8");
catalog = catalog.replace(
  /const ARTWORK_VERSION = "[^"]+";\n(?:const LEGENDARY_SPRITE = "[^"]+";\n)?/,
  'const ARTWORK_VERSION = "2026-08-04-legendary-real-webp-v3";\nconst LEGENDARY_SPRITE = "/prizes/legendary/legendary-prize-sprite-direct.webp";\n',
);

const legendaryBlock = [
  "  legendary: [",
  ...legendaryRules.map(
    ([pattern, index]) => `    { pattern: ${pattern}, src: LEGENDARY_SPRITE, spriteIndex: ${index} },`,
  ),
  "  ],",
].join("\n");

const replaced = catalog.replace(/  legendary: \[[\s\S]*?\n  \],\n\};/, `${legendaryBlock}\n};`);
if (replaced === catalog || !replaced.includes("spriteIndex: 19")) {
  throw new Error("Could not patch the Legendary artwork catalog with direct sprite mappings");
}
fs.writeFileSync(catalogPath, replaced);

console.log(
  `[prize-artwork] Prepared ${path.relative(root, outputPath)} (${image.length} bytes) and patched 20 direct Legendary mappings`,
);

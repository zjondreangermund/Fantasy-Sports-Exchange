import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artworkDirectory = path.join(root, "client", "public", "prizes", "legendary");
const sourcePath = path.join(artworkDirectory, "hq-sprite-001.txt");
const outputPath = path.join(artworkDirectory, "legendary-prize-sprite-direct.webp");
const catalogPath = path.join(
  root,
  "client",
  "src",
  "components",
  "prize-vault",
  "prizeArtworkCatalog.ts",
);
const artworkComponentPath = path.join(
  root,
  "client",
  "src",
  "components",
  "prize-vault",
  "PremiumPrizeArtwork.tsx",
);

function readWebpDimensions(image) {
  if (
    image.length < 30
    || image.toString("ascii", 0, 4) !== "RIFF"
    || image.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= image.length) {
    const chunkType = image.toString("ascii", offset, offset + 4);
    const chunkSize = image.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunkType === "VP8X" && dataOffset + 10 <= image.length) {
      return {
        width: 1 + image.readUIntLE(dataOffset + 4, 3),
        height: 1 + image.readUIntLE(dataOffset + 7, 3),
      };
    }

    if (
      chunkType === "VP8 "
      && dataOffset + 10 <= image.length
      && image[dataOffset + 3] === 0x9d
      && image[dataOffset + 4] === 0x01
      && image[dataOffset + 5] === 0x2a
    ) {
      return {
        width: image.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: image.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    if (chunkType === "VP8L" && dataOffset + 5 <= image.length && image[dataOffset] === 0x2f) {
      const bits = image.readUInt32LE(dataOffset + 1);
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return null;
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing high-resolution Legendary artwork source: ${path.relative(root, sourcePath)}`);
}

const encoded = fs.readFileSync(sourcePath, "utf8").replace(/\s+/g, "");
const image = Buffer.from(encoded, "base64");
const dimensions = readWebpDimensions(image);
const isHighResolutionWebp = image.length > 500_000
  && dimensions?.width === 1920
  && dimensions?.height === 1536;

if (!isHighResolutionWebp) {
  throw new Error(
    `Legendary artwork must be the verified 1920×1536 high-resolution WebP; received ${dimensions?.width || 0}×${dimensions?.height || 0} and ${image.length} bytes`,
  );
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
  'const ARTWORK_VERSION = "2026-08-05-legendary-hq384-v5";\nconst LEGENDARY_SPRITE = "/prizes/legendary/legendary-prize-sprite-direct.webp";\n',
);

const legendaryBlock = [
  "  legendary: [",
  ...legendaryRules.map(
    ([pattern, index]) => `    { pattern: ${pattern}, src: LEGENDARY_SPRITE, spriteIndex: ${index} },`,
  ),
  "  ],",
].join("\n");

const finalCatalog = catalog.replace(
  /  legendary: \[[\s\S]*?\n  \],\n\};/,
  `${legendaryBlock}\n};`,
);

const hasDirectSource = finalCatalog.includes(
  'const LEGENDARY_SPRITE = "/prizes/legendary/legendary-prize-sprite-direct.webp"',
);
const mappedIndexes = [...finalCatalog.matchAll(/spriteIndex:\s*(\d+)/g)].map((match) => Number(match[1]));
const expectedIndexes = Array.from({ length: 20 }, (_, index) => index);
const hasAllMappings = mappedIndexes.length >= 20
  && expectedIndexes.every((expected) => mappedIndexes.includes(expected));

if (!hasDirectSource || !hasAllMappings) {
  throw new Error("Could not prepare the Legendary artwork catalog with high-resolution sprite mappings");
}

if (finalCatalog !== fs.readFileSync(catalogPath, "utf8")) {
  fs.writeFileSync(catalogPath, finalCatalog);
}

let artworkComponent = fs.readFileSync(artworkComponentPath, "utf8");
artworkComponent = artworkComponent.replace(
  "      className={className}\n      role={decorative ? undefined : \"img\"}",
  "      className={`${className} flex items-center justify-center`}\n      role={decorative ? undefined : \"img\"}",
);
artworkComponent = artworkComponent.replace(
  '        className="h-full w-full bg-no-repeat"',
  '        className={decorative\n          ? "h-full w-full bg-no-repeat"\n          : "aspect-square h-full w-auto max-h-full max-w-full shrink-0 bg-no-repeat"}',
);

if (!artworkComponent.includes("aspect-square h-full w-auto max-h-full max-w-full")) {
  throw new Error("Could not apply square Legendary poster containment");
}

if (artworkComponent !== fs.readFileSync(artworkComponentPath, "utf8")) {
  fs.writeFileSync(artworkComponentPath, artworkComponent);
}

console.log(
  `[prize-artwork] Prepared high-resolution Legendary sprite ${dimensions.width}×${dimensions.height} (${image.length} bytes), verified 20 mappings and square rendering`,
);

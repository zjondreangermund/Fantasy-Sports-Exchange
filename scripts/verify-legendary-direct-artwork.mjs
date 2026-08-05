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

if (!fs.existsSync(spritePath)) {
  throw new Error("Missing high-resolution Legendary WebP artwork");
}

const image = fs.readFileSync(spritePath);
const dimensions = readWebpDimensions(image);
const isHighResolutionWebp = image.length > 500_000
  && dimensions?.width === 1920
  && dimensions?.height === 1536;

if (!isHighResolutionWebp) {
  throw new Error(
    `Invalid Legendary artwork: expected 1920×1536 and more than 500,000 bytes, received ${dimensions?.width || 0}×${dimensions?.height || 0} and ${image.length} bytes`,
  );
}

const catalog = fs.readFileSync(catalogPath, "utf8");
if (!catalog.includes('const LEGENDARY_SPRITE = "/prizes/legendary/legendary-prize-sprite-direct.webp"')) {
  throw new Error("Legendary catalog is not linked to the high-resolution WebP artwork");
}
if (!catalog.includes('const ARTWORK_VERSION = "2026-08-05-legendary-hq384-v5"')) {
  throw new Error("Legendary artwork cache version was not updated for the high-resolution source");
}

const legendarySection = catalog.match(/legendary:\s*\[([\s\S]*?)\n\s*\],\n\};/i)?.[1] || "";
const indexes = [...legendarySection.matchAll(/spriteIndex:\s*(\d+)/g)].map((match) => Number(match[1]));
const expected = Array.from({ length: 20 }, (_, index) => index);
if (indexes.length !== expected.length || indexes.some((value, index) => value !== expected[index])) {
  throw new Error(`Expected Legendary sprite indexes 0-19, received: ${indexes.join(", ")}`);
}

console.log(
  `[prize-artwork] Verified high-resolution Legendary WebP ${dimensions.width}×${dimensions.height} (${image.length} bytes) and 20 catalog mappings`,
);

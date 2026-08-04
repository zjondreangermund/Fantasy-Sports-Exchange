import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artworkDirectory = path.join(root, "client", "public", "prizes", "legendary");
const outputPath = path.join(artworkDirectory, "legendary-prize-sprite-128.webp");

const chunkFiles = fs
  .readdirSync(artworkDirectory)
  .filter((name) => /^sprite-128-\d+\.txt$/i.test(name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

if (chunkFiles.length < 2) {
  throw new Error("Legendary Prize Vault artwork chunks are missing");
}

const encoded = chunkFiles
  .map((name) => fs.readFileSync(path.join(artworkDirectory, name), "utf8"))
  .join("")
  .replace(/\s+/g, "");

const image = Buffer.from(encoded, "base64");
const isWebp = image.length > 20
  && image.toString("ascii", 0, 4) === "RIFF"
  && image.toString("ascii", 8, 12) === "WEBP";

if (!isWebp) {
  throw new Error("Legendary Prize Vault artwork did not decode to a valid WebP image");
}

fs.writeFileSync(outputPath, image);
console.log(`[prize-artwork] Prepared ${path.relative(root, outputPath)} (${image.length} bytes from ${chunkFiles.length} chunks)`);

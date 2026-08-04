import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artworkDirectory = path.join(root, "client", "public", "prizes", "legendary");
const outputPath = path.join(artworkDirectory, "legendary-prize-sprite-direct.webp");

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
console.log(
  `[prize-artwork] Prepared ${path.relative(root, outputPath)} (${image.length} bytes from ${chunkFiles.length} checked-in chunks)`,
);

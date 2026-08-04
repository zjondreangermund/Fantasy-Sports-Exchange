import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artworkDirectory = path.join(root, "client", "public", "prizes", "legendary");
const outputPath = path.join(artworkDirectory, "legendary-prize-sprite-128.webp");
const filenames = JSON.parse(
  fs.readFileSync(path.join(root, "scripts", "legendary-prize-filenames.json"), "utf8"),
);

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

if (!Array.isArray(filenames) || filenames.length !== 20) {
  throw new Error("Legendary Prize Vault requires exactly 20 standalone artwork filenames");
}

const dataUri = `data:image/webp;base64,${encoded}`;
for (let index = 0; index < filenames.length; index += 1) {
  const column = index % 5;
  const row = Math.floor(index / 5);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 128 128"><image href="${dataUri}" x="${-column * 128}" y="${-row * 128}" width="640" height="512" preserveAspectRatio="none"/></svg>`;
  fs.writeFileSync(path.join(artworkDirectory, filenames[index]), svg);
}

console.log(`[prize-artwork] Prepared ${path.relative(root, outputPath)} and ${filenames.length} standalone Legendary SVG files (${image.length} bytes from ${chunkFiles.length} chunks)`);

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artworkDirectory = path.join(root, "client", "public", "prizes", "legendary");
const filenames = JSON.parse(fs.readFileSync(path.join(root, "scripts", "legendary-prize-filenames.json"), "utf8"));

if (filenames.length !== 20) throw new Error("Expected 20 Legendary artwork files");
for (const filename of filenames) {
  const fullPath = path.join(artworkDirectory, filename);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing Legendary artwork: ${filename}`);
  const content = fs.readFileSync(fullPath, "utf8");
  if (!content.startsWith("<svg") || !content.includes("data:image/webp;base64,")) {
    throw new Error(`Invalid standalone Legendary artwork: ${filename}`);
  }
}
console.log(`[prize-artwork] Verified ${filenames.length} standalone Legendary artwork files`);

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artworkDirectory = path.join(root, "client", "public", "prizes", "legendary");

if (!fs.existsSync(artworkDirectory)) {
  throw new Error("Missing Legendary Prize Vault artwork directory");
}

console.log("[prize-artwork] Using committed individual Legendary PNG artwork; no generated sprite preparation required");

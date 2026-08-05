import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prizeRoot = path.join(root, "client", "public", "prizes");
const legendaryDirectory = path.join(prizeRoot, "legendary");
const commonDirectory = path.join(prizeRoot, "common");
const commonBundlePath = path.join(commonDirectory, "common-prize-artwork.json.gz");

if (!fs.existsSync(legendaryDirectory)) {
  throw new Error("Missing Legendary Prize Vault artwork directory");
}
if (!fs.existsSync(commonBundlePath)) {
  throw new Error("Missing compressed Common Prize Vault artwork bundle");
}

const commonArtwork = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(commonBundlePath)).toString("utf8"),
);
const commonFiles = Object.entries(commonArtwork);
if (commonFiles.length !== 50) {
  throw new Error(`Common Prize Vault artwork bundle must contain 50 files; found ${commonFiles.length}`);
}

fs.mkdirSync(commonDirectory, { recursive: true });
const expectedNames = new Set();
for (const [fileName, svg] of commonFiles) {
  if (!/^common-\d{2}-[a-z0-9-]+\.svg$/.test(fileName)) {
    throw new Error(`Invalid Common artwork filename: ${fileName}`);
  }
  if (typeof svg !== "string" || !svg.startsWith("<svg")) {
    throw new Error(`Invalid Common artwork content: ${fileName}`);
  }
  expectedNames.add(fileName);
  fs.writeFileSync(path.join(commonDirectory, fileName), svg, "utf8");
}

for (const fileName of fs.readdirSync(commonDirectory)) {
  if (/^common-\d{2}-.*\.svg$/i.test(fileName) && !expectedNames.has(fileName)) {
    fs.rmSync(path.join(commonDirectory, fileName));
  }
}

console.log("[prize-artwork] Prepared 50 correctly named Common SVG files from the committed bundle and retained individual Legendary PNG artwork");

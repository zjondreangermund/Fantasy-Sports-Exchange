import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prizeDir = path.join(root, "client", "public", "prizes", "rare");

// The first approved uploads were accidentally committed under mixed filenames.
// Decode each embedded WebP into the correct final filename during every build.
const assets = [
  {
    source: "rare-jbl-speaker.svg",
    output: "rare-shopping-voucher.webp",
  },
  {
    source: "rare-premium-smart-watch.svg",
    output: "rare-gaming-headset-pro.webp",
  },
  {
    source: "rare-gaming-headset-pro.svg",
    output: "rare-premium-smart-watch.webp",
  },
  {
    source: "rare-shopping-voucher.svg",
    output: "rare-jbl-speaker.webp",
  },
];

await mkdir(prizeDir, { recursive: true });

for (const asset of assets) {
  const sourcePath = path.join(prizeDir, asset.source);
  const outputPath = path.join(prizeDir, asset.output);
  const svg = await readFile(sourcePath, "utf8");
  const match = svg.match(/data:image\/webp;base64,([^"']+)/i);

  if (!match?.[1]) {
    throw new Error(`Embedded WebP payload missing from ${asset.source}`);
  }

  const buffer = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`Invalid WebP payload in ${asset.source}`);
  }

  await writeFile(outputPath, buffer);
  console.log(`Materialized ${asset.output} (${buffer.length} bytes)`);
}

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const collection = read("client/src/pages/collection-clean.tsx");
const main = read("client/src/main.tsx");
const serviceWorker = read("client/public/sw.js");

for (const expected of [
  'className="collection-card-item group flex touch-pan-y flex-col items-center gap-2"',
  'width: isMobile ? 146 : 170',
  'maxWidth: isMobile ? 146 : 170',
  'className="grid w-full grid-cols-2 gap-2"',
  'data-collection-sell-overlay',
  'role="dialog" aria-modal="true" data-collection-sell-dialog',
  'style={{ maxWidth: "28rem", maxHeight: "calc(100dvh - 2rem)" }}',
]) {
  expect(collection.includes(expected), `Collection repair is missing: ${expected}`);
}

expect(!collection.includes('max-w-[190px] touch-pan-y flex-col'), "Collection card action wrapper must not depend on the globally overridden max-width utility");
expect(!collection.includes('className="w-full max-w-md rounded-[1.75rem]'), "Sale modal width must not depend on the globally overridden max-width utility");
expect(main.includes('"fantasy-site-v12"'), "Client cache must be fantasy-site-v12");
expect(serviceWorker.includes('const CACHE_NAME = "fantasy-site-v12"'), "Service worker cache must be fantasy-site-v12");

if (failures.length) {
  console.error("Collection action/dialog verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Collection Sell/Loan controls match card width and the sale form stays a compact modal.");

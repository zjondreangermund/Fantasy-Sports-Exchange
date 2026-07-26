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
  'Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle',
  'className="collection-card-item group flex touch-pan-y flex-col items-center gap-2"',
  'width: isMobile ? 146 : 170',
  'maxWidth: isMobile ? 146 : 170',
  'className="grid w-full grid-cols-2 gap-2"',
  'data-collection-sell-dialog',
  'style={{ maxWidth: "28rem", backgroundColor: "#090d1f" }}',
  '<DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:space-x-0">',
]) {
  expect(collection.includes(expected), `Collection repair is missing: ${expected}`);
}

expect(!collection.includes('className="fixed inset-0 z-[120] flex items-center justify-center'), "Legacy full-page sell overlay must be removed");
expect(!collection.includes('max-w-[190px] touch-pan-y flex-col'), "Collection card action wrapper must not depend on the globally overridden max-width utility");
expect(!collection.includes('Trophy, X } from "lucide-react"'), "Unused custom modal close icon should be removed");
expect(main.includes('"fantasy-site-v12"'), "Client cache must be fantasy-site-v12");
expect(serviceWorker.includes('const CACHE_NAME = "fantasy-site-v12"'), "Service worker cache must be fantasy-site-v12");

if (failures.length) {
  console.error("Collection action/dialog verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Collection card actions match card width and the sale form uses a compact portalled dialog.");

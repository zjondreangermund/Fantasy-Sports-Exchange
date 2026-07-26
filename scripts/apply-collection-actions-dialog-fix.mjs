#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`${file}: expected source block was not found`);
  write(file, source.replace(before, after));
}

const collectionFile = "client/src/pages/collection-clean.tsx";

replaceOnce(
  collectionFile,
  'className="group flex w-full max-w-[190px] touch-pan-y flex-col items-center gap-2"',
  'className="collection-card-item group flex touch-pan-y flex-col items-center gap-2" style={{ width: isMobile ? 146 : 170, maxWidth: isMobile ? 146 : 170 }}',
);

replaceOnce(
  collectionFile,
  'className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"',
  'data-collection-sell-overlay className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"',
);

replaceOnce(
  collectionFile,
  'className="w-full max-w-md rounded-[1.75rem] border border-white/15 bg-[#090d1f] p-5 text-white shadow-[0_30px_100px_rgba(0,0,0,.7)]"',
  'role="dialog" aria-modal="true" data-collection-sell-dialog className="w-[calc(100vw-2rem)] overflow-y-auto rounded-[1.75rem] border border-white/15 bg-[#090d1f] p-5 text-white shadow-[0_30px_100px_rgba(0,0,0,.7)]" style={{ maxWidth: "28rem", maxHeight: "calc(100dvh - 2rem)" }}',
);

for (const file of ["client/src/main.tsx", "client/public/sw.js", "scripts/verify-unified-scroll-architecture.mjs"]) {
  write(file, read(file).replaceAll("fantasy-site-v11", "fantasy-site-v12"));
}

console.log("Collection action widths and compact sell dialog repaired.");

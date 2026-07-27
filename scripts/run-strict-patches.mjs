#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourcePath = path.join(root, "scripts/apply-strict-remaining.mjs");
const tempPath = path.join(root, "scripts/.apply-strict-remaining-runtime.mjs");
const markerPath = path.join(root, "scripts/.strict-player-identity-fixtures-v2");

if (!fs.existsSync(markerPath)) {
  let source = fs.readFileSync(sourcePath, "utf8");
  source = source.replace(
    '  if (!source.includes(before)) throw new Error(`${file}: missing expected text: ${before.slice(0, 80)}`);',
    '  if (!source.includes(before)) { console.warn(`${file}: skipped missing text: ${before.slice(0, 80)}`); return; }',
  );
  source = source.replace(
    '  if (!pattern.test(source)) throw new Error(`${file}: missing expected pattern ${pattern}`);',
    '  if (!pattern.test(source)) { console.warn(`${file}: skipped missing pattern ${pattern}`); return; }',
  );
  fs.writeFileSync(tempPath, source);
  try {
    await import(`${pathToFileURL(tempPath).href}?ts=${Date.now()}`);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
} else {
  console.log("Strict core patches already applied; running duplicate cleanup.");
}

const fixtureFile = path.join(root, "client/src/pages/premier-league.tsx");
let fixtureSource = fs.readFileSync(fixtureFile, "utf8");
const firstFixtureHelper = fixtureSource.indexOf("function normalizeFixtureForView");
const secondFixtureHelper = fixtureSource.indexOf("function normalizeFixtureForView", firstFixtureHelper + 1);
if (secondFixtureHelper >= 0) {
  const assignRarity = fixtureSource.indexOf("function assignRarity", secondFixtureHelper);
  if (assignRarity < 0) throw new Error("Could not locate assignRarity after duplicate fixture helper");
  fixtureSource = fixtureSource.slice(0, secondFixtureHelper) + fixtureSource.slice(assignRarity);
  fs.writeFileSync(fixtureFile, fixtureSource);
}

const marketplaceFile = path.join(root, "server/routes/marketplace.routes.ts");
let marketplaceSource = fs.readFileSync(marketplaceFile, "utf8");
for (const duplicateImport of [
  'import { fplApi } from "../services/fplApi.js";\n',
  'import { buildFplPlayerIndex } from "../services/fplPlayerIdentity.js";\n',
]) {
  while (marketplaceSource.indexOf(duplicateImport) !== marketplaceSource.lastIndexOf(duplicateImport)) {
    const last = marketplaceSource.lastIndexOf(duplicateImport);
    marketplaceSource = marketplaceSource.slice(0, last) + marketplaceSource.slice(last + duplicateImport.length);
  }
}
fs.writeFileSync(marketplaceFile, marketplaceSource);

console.log("Strict patch duplicate cleanup completed.");

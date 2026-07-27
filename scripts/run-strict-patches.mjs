#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const fixtureFile = path.join(root, "client/src/pages/premier-league.tsx");
let fixtureSource = fs.readFileSync(fixtureFile, "utf8");
const firstFixtureHelper = fixtureSource.indexOf("function normalizeFixtureForView");
if (firstFixtureHelper < 0) throw new Error("Fixture normalization helper is missing");
const secondFixtureHelper = fixtureSource.indexOf("function normalizeFixtureForView", firstFixtureHelper + 1);
if (secondFixtureHelper >= 0) {
  const assignRarity = fixtureSource.indexOf("function assignRarity", secondFixtureHelper);
  if (assignRarity < 0) throw new Error("Could not locate assignRarity after duplicate fixture helper");
  fixtureSource = fixtureSource.slice(0, secondFixtureHelper) + fixtureSource.slice(assignRarity);
}
fs.writeFileSync(fixtureFile, fixtureSource);

const marketplaceFile = path.join(root, "server/routes/marketplace.routes.ts");
let marketplaceSource = fs.readFileSync(marketplaceFile, "utf8");
for (const importLine of [
  'import { fplApi } from "../services/fplApi.js";',
  'import { buildFplPlayerIndex } from "../services/fplPlayerIdentity.js";',
]) {
  const lines = marketplaceSource.split("\n");
  let kept = false;
  marketplaceSource = lines
    .filter((line) => {
      if (line !== importLine) return true;
      if (kept) return false;
      kept = true;
      return true;
    })
    .join("\n");
}
fs.writeFileSync(marketplaceFile, marketplaceSource);

console.log("Strict duplicate cleanup completed without reapplying patches.");

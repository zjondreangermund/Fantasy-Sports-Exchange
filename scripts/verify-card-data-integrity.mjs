#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const includesAll = (source, values, label) => {
  for (const value of values) expect(source.includes(value), `${label} is missing: ${value}`);
};

const identity = read("server/services/fplPlayerIdentity.ts");
const sync = read("server/services/fplPlayerSync.ts");
const cards = read("server/routes/cards.routes.ts");
const adapter = read("client/src/lib/fantasy-card-adapter.ts");
const stableCard = read("client/src/components/cards/CollectionStableCard.tsx");
const main = read("client/src/main.tsx");
const serviceWorker = read("client/public/sw.js");

includesAll(identity, [
  '1: "GK"',
  '2: "DEF"',
  '3: "MID"',
  '4: "FWD"',
  "byId.has(fplId)",
  "byCode.has(code)",
  "candidates.length === 1",
  "teamNameOf",
  "canonical",
], "FPL player identity resolver");

includesAll(sync, [
  "buildFplPlayerIndex",
  "left join app.player_cards",
  "card_count",
  "normalizePlayerText(row.name)",
  "normalizePlayerText(row.web_name)",
  "position = ${position}::public.position",
  "team = ${teamName}",
  "linkedLegacyRows",
], "FPL database synchronization");
expect(!sync.includes('where fpl_id = ${fplId}\n       returning id'), "Player sync must not update only rows that already have an FPL id");

includesAll(cards, [
  "buildFplPlayerIndex",
  "const matchedElement = fplIndex.resolve(player)",
  "const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null",
  "totalPoints: Number(matchedElement.total_points || 0)",
  "form = matchedElement",
  "currentPosition",
  "const canonical = fplIndex.canonical(matchedElement)",
  "player: { ...canonical, imageUrl: fplApi.playerPhotoUrl(matchedElement, 250)",
  "cleanSheets: Number(row.clean_sheets || 0)",
  "yellowCards: Number(row.yellow_cards || 0)",
  "redCards: Number(row.red_cards || 0)",
], "Card API enrichment");
expect(!cards.includes("elementByNameTeam"), "Card API must not require a stale database team to match an FPL player");
expect(!cards.includes("player: { ...player, overall: averageScore }"), "Card API must not replace official overall with an average of fallback scores");

includesAll(adapter, [
  "player?.totalPoints",
  "player?.total_points",
  "player?.form",
  "const rating = finiteNumber(player?.overall, card.decisiveScore)",
  "rating,",
  "form,",
], "Fantasy card adapter");

includesAll(stableCard, [
  "const ovr = numberStat(player.rating)",
  "const points = numberStat(player.totalPoints)",
  "const form = decimalStat(player.form)",
  "value: number | string",
], "Stable card stat display");
expect(!stableCard.includes("player.totalPoints || player.form || player.rating"), "PTS must never fall back to FORM or OVR");
expect(!stableCard.includes("player.form || player.rating"), "FORM must never fall back to OVR");

expect(main.includes('"fantasy-site-v10"'), "Client cache key must be fantasy-site-v10");
expect(serviceWorker.includes('const CACHE_NAME = "fantasy-site-v10"'), "Service worker cache key must be fantasy-site-v10");

if (failures.length) {
  console.error("Card data integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Card teams, positions, official season totals, form and profile stats are wired to canonical FPL data.");

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
  "strongPlayerNameMatch",
  "function playerMatchesElement",
  "const storedCandidateIsSafe",
  "storedCandidateIsSafe(byStoredId)",
  "storedCandidateIsSafe(byStoredCode)",
  "const strongCandidates = elements.filter",
  "teamNameOf",
  "canonical",
], "FPL player identity resolver");
expect(/storedCandidateIsSafe[\s\S]*?playerMatchesElement\(player, candidate\)/.test(identity), "Stored FPL IDs/codes must be accepted only after verified player-name matching");
expect(!identity.includes("if (fplId > 0 && byId.has(fplId)) return"), "Stored FPL ids must not be accepted without confirming the player name");
expect(!identity.includes("if (code > 0 && byCode.has(code)) return"), "Stored photo codes must not be accepted without confirming the player name");

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
  "const officialFplSeasonPoints = matchedElement ? Number(matchedElement.total_points || 0) : null",
  "const totalPoints = identityVerified ? currentGameweekPoints : null",
  "const form = identityVerified ? currentGameweekPoints : null",
  "currentPosition",
  "loadApiFootballPlayerDirectory",
  "resolveApiFootballPlayer",
  "verifiedImageUrl",
  "identityVerified: Boolean(apiFootballPlayer || matchedElement)",
  'stats: "API-Football match actions with official FPL fallback"',
  "cleanSheets: Number(row.clean_sheets || 0)",
  "yellowCards: Number(row.yellow_cards || 0)",
  "redCards: Number(row.red_cards || 0)",
  "officialFplSeasonPoints: Number(matchedElement.total_points || 0)",
  "totalPoints: arenaGameweekPoints, arenaGameweekPoints",
], "Card API enrichment");
expect(!cards.includes("elementByNameTeam"), "Card API must not require a stale database team to match an FPL player");
expect(!cards.includes("player: { ...player, overall: averageScore }"), "Card API must not replace official overall with an average of fallback scores");
expect(!cards.includes("last10: last10.length ? last10 : lastScoresFallback(card)"), "Card profiles must not substitute fabricated fallback matches for empty official history");
expect(!cards.includes("matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : player.imageUrl"), "Unverified cards must not reuse stale stored portraits");
expect(!cards.includes("player.form ?? card.decisiveScore"), "Card responses must not present decisive score as official form");
expect(!cards.includes("player.overall || card.decisiveScore"), "Card responses must not present decisive score as official overall");

includesAll(adapter, [
  "player?.totalPoints",
  "player?.total_points",
  "player?.form",
  "isVerifiedPlayerIdentity",
  "const identityVerified = isVerifiedPlayerIdentity(player)",
  "const statsVerified = identityVerified",
  "const rating = statsVerified ? finiteNumber(player?.overall) : 0",
  "rating,",
  "form,",
  "statsVerified,",
], "Fantasy card adapter");
expect(!adapter.includes("finiteNumber(player?.overall, card.decisiveScore)"), "Card rating must not fall back to decisive score");
expect(!adapter.includes("last5Scores.reduce"), "Season points must not be invented by adding cached match values");

includesAll(stableCard, [
  "const statsVerified = player.statsVerified !== false",
  "const exactPoints = Number(player.totalPoints ?? 0)",
  "const points: number | string = statsVerified && Number.isFinite(exactPoints)",
  'const form: number | string = statsVerified ? decimalStat(player.form) : "—"',
  '<StatChip label="PTS" value={points}',
  '<StatChip label="FORM" value={form}',
  "value: number | string",
], "Stable card stat display");
expect(!stableCard.includes("player.totalPoints || player.form || player.rating"), "PTS must never fall back to FORM or OVR");
expect(!stableCard.includes("player.form || player.rating"), "FORM must never fall back to OVR");

expect(main.includes('"fantasy-site-v18-lion-jpg"'), "Client cache key must match the active service worker cache.");
expect(serviceWorker.includes('const CACHE_NAME = "fantasy-site-v18-lion-jpg"'), "Service worker cache key must match the active service worker cache.");

if (failures.length) {
  console.error("Card data integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Card teams, positions, Fantasy Arena gameweek points, official FPL season reference totals, form, verified identities and profile stats are wired to canonical providers without fabricated fallbacks.");
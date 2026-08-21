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

// FPL remains an internal current-roster/gameweek/scoring identity source. It must
// stay strict even though player-facing card profiles now use API-Football only.
includesAll(identity, [
  '1: "GK"',
  '2: "DEF"',
  '3: "MID"',
  '4: "FWD"',
  "strongPlayerNameMatch",
  "playerMatchesElement(player, byStoredId)",
  "playerMatchesElement(player, byStoredCode)",
  "const strongCandidates = elements.filter",
  "teamNameOf",
  "canonical",
], "FPL player identity resolver");
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

// Player-facing collection/profile enrichment is API-Football only. FPL calls in
// this route would reintroduce the mixed provider stats the UI intentionally removed.
includesAll(cards, [
  "loadApiFootballPlayerDirectory",
  "resolveApiFootballPlayer",
  "apiFootballPhotoUrl",
  "getApiFootballPlayerProfileSnapshot",
  "verifiedImageUrl",
  'identitySource: apiFootballPlayer ? "api-football-current-squad"',
  'source: "api-football"',
  'stats: "API-Football Premier League match statistics"',
  'fantasyPoints: "Fantasy Arena scoring"',
  'const starterSlots = ["GK", "DEF", "MID", "FWD", "UTILITY"]',
  "starterOrder.get(Number(a.playerId",
], "API-Football card enrichment");
for (const forbidden of [
  "fplApi.bootstrap()",
  "fplApi.getLiveGameweek()",
  "fplApi.playerSummary",
  'source: "fpl-live"',
  'stats: "Fantasy Premier League match history"',
]) expect(!cards.includes(forbidden), `Player-facing card route must not use FPL profile data: ${forbidden}`);
expect(!cards.includes("last10: last10.length ? last10 : lastScoresFallback(card)"), "Card profiles must not substitute fabricated fallback matches for empty official history");
expect(!cards.includes("player.form ?? card.decisiveScore"), "Card responses must not present decisive score as official form");
expect(!cards.includes("player.overall || card.decisiveScore"), "Card responses must not present decisive score as official overall");

includesAll(adapter, [
  "player?.totalPoints",
  "player?.total_points",
  "player?.form",
  "isVerifiedPlayerIdentity",
  "const identityVerified = isVerifiedPlayerIdentity(player)",
  "const statsVerified = identityVerified",
  "rating,",
  "form,",
  "statsVerified,",
], "Fantasy card adapter");
expect(!adapter.includes("finiteNumber(player?.overall, card.decisiveScore)"), "Card rating must not fall back to decisive score");
expect(!adapter.includes("last5Scores.reduce"), "Season points must not be invented by adding cached match values");

includesAll(stableCard, [
  "const statsVerified = player.statsVerified !== false",
  'const rating: number | string = statsVerified ? decimalStat(player.rating) : "—"',
  'const points: number | string = statsVerified ? numberStat(player.totalPoints) : "—"',
  'const matches: number | string = statsVerified ? numberStat((player as any).matchesPlayed) : "—"',
  '<StatChip label="RTG" value={rating}',
  '<StatChip label="PTS" value={points}',
  '<StatChip label="MATCH" value={matches}',
  "isApiFootballPortrait",
  'mixBlendMode: apiFootballPortrait ? "multiply"',
  "WebkitMaskImage: apiFootballPortrait",
  "value: number | string",
], "Stable card API-Football stat display");
expect(!stableCard.includes("player.totalPoints || player.form || player.rating"), "PTS must never fall back to FORM or rating");

expect(main.includes('"fantasy-site-v18-lion-jpg"'), "Client cache key must match the active service worker cache.");
expect(serviceWorker.includes('const CACHE_NAME = "fantasy-site-v18-lion-jpg"'), "Service worker cache key must match the active service worker cache.");

if (failures.length) {
  console.error("Card data integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Card data integrity verified: FPL stays internal for roster/gameweek/scoring while player-facing identity, portraits and profile stats use API-Football without fabricated fallbacks.");

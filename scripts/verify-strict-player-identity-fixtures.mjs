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

const fplIdentity = read("server/services/fplPlayerIdentity.ts");
const directory = read("server/services/apiFootballPlayerDirectory.ts");
const cards = read("server/routes/cards.routes.ts");
const marketplace = read("server/routes/marketplace.routes.ts");
const server = read("server/index.ts");
const images = read("client/src/lib/card-image.ts");
const adapter = read("client/src/lib/fantasy-card-adapter.ts");
const modal = read("client/src/components/cards/CardProfileModal.tsx");
const eplRoutes = read("server/routes/epl.routes.ts");
const eplPage = read("client/src/pages/premier-league.tsx");
const main = read("client/src/main.tsx");
const sw = read("client/public/sw.js");

// FPL remains a strict internal identity/fixture/scoring source. It is deliberately
// not the player-facing portrait/profile provider anymore.
includesAll(fplIdentity, [
  "STRICT_PLAYER_IDENTITY_FIX_V2",
  "strongPlayerNameMatch",
  "playerMatchesElement(player, byStoredId)",
  "playerMatchesElement(player, byStoredCode)",
  "const strongCandidates = elements.filter",
  "bTokens.slice(1).some((token) => surnamesA.has(token))",
], "FPL strict internal identity resolver");
expect(!fplIdentity.includes("if (fplId > 0 && byId.has(fplId)) return"), "Stored FPL ids must not be trusted without checking the player name");
expect(!fplIdentity.includes("if (code > 0 && byCode.has(code)) return"), "Stored photo codes must not be trusted without checking the player name");

expect(!directory.includes("normalizePlayerText(candidate.lastName),"), "API-Football matching must not use surname-only aliases");
expect(!directory.includes("source.length === 1"), "API-Football matching must not link a card from one token");
includesAll(directory, ["row.nameScore >= 92", "rawPosition === row.candidate.position", "best.nameScore < 92", "apiFootballPhotoUrl"], "API-Football strict resolver");

// Collection/player profiles are API-Football only. Do not silently fall back to
// FPL portraits because that reintroduces mixed identities and the old white-card/profile mismatch.
includesAll(cards, [
  "const apiFootballImage = apiFootballPlayer ? apiFootballPhotoUrl",
  "imageUrl: apiFootballImage || null",
  "verifiedImageUrl: apiFootballImage || null",
  "identityVerified: Boolean(apiFootballPlayer)",
  'identitySource: apiFootballPlayer ? "api-football-current-squad" : "unverified-card-data"',
  'source: "api-football"',
  'source: "card-fallback"',
  'imageUrl: null, verifiedImageUrl: null, identityVerified: false',
], "API-Football-only Collection card enrichment");
for (const forbidden of [
  "matchedElement ? fplApi.playerPhotoUrl",
  '"fpl+api-football"',
  'source: "fpl-live"',
  "fplApi.playerSummary",
  "fplApi.getLiveGameweek()",
  "fplApi.bootstrap()",
]) expect(!cards.includes(forbidden), `Player-facing card path must not use FPL profile/image data: ${forbidden}`);

// Marketplace listing enrichment can retain its existing strict identity bridge for
// listing metadata; opening a card uses the shared API-Football-only profile engine.
includesAll(marketplace, [
  "fplApi.bootstrap()",
  "loadApiFootballPlayerDirectory()",
  "resolveApiFootballPlayer",
  "apiFootballPhotoUrl",
  "fplIndex.resolve(storedPlayer)",
  "verifiedImageUrl",
  "const identityVerified = Boolean(apiFootballPlayer || matchedElement)",
  'apiFootballPlayer ? "api-football-current-squad"',
], "Marketplace listing identity enrichment");
expect(!marketplace.includes("imageUrl: row.player_image_url }"), "Marketplace cards must not expose raw stored portraits without verification");

includesAll(images, [
  "isVerifiedPlayerIdentity",
  "if (verified)",
  "candidates.push(CARD_IMAGE_FALLBACK)",
], "Verified-only card image pipeline");
expect(!images.includes("playerResolverUrl"), "Generic fuzzy image resolver must not be part of the card image candidate chain");
expect(!images.includes("/api/players/${playerId}/photo"), "Raw database player photo endpoints must not be used without a verified identity");

includesAll(adapter, [
  "isVerifiedPlayerIdentity",
  "const identityVerified = isVerifiedPlayerIdentity(player)",
  ": [];",
], "Card adapter identity gate");

includesAll(modal, [
  'const identityVerified = data.source !== "card-fallback"',
  'identitySource: identityVerified ? "api-football" : "unverified-card-data"',
  "photo: null",
  "cutoutUrl: null",
  'return "API-Football verified"',
], "API-Football card profile identity gate");
expect(!modal.includes('data.source === "api-football" ? "api-football" : "fpl"'), "Card profile identity must not fall back to FPL");
expect(!modal.includes("data.player?.imageUrl || card.player?.imageUrl"), "Unverified profile cards must not reuse the collection card's stale image");

// The generic image resolver may continue using strict FPL matching for non-card
// internal use, but the card image chain above no longer calls it.
expect(server.includes("buildFplPlayerIndex(bootstrap).resolve({ name, team })"), "Generic image resolver must use the strict FPL identity resolver");
const imageRouteStart = server.indexOf('app.get("/api/player-image/resolve"');
const imageRouteEnd = server.indexOf('app.get("/api/image-proxy"');
const imageRoute = imageRouteStart >= 0 && imageRouteEnd > imageRouteStart ? server.slice(imageRouteStart, imageRouteEnd) : "";
expect(!imageRoute.includes("TheSportsDB"), "Image resolution must not fall back to a fuzzy third-party player search");
expect(imageRoute.includes("No exact official player image link found"), "Unmatched image requests must fail safely");

includesAll(eplRoutes, [
  "matchDate,",
  "homeTeam: homeName",
  "awayTeam: awayName",
  "homeGoals: fixture.team_h_score",
  "awayGoals: fixture.team_a_score",
  'status === "completed" || status === "finished"',
], "EPL fixture API response");

includesAll(eplPage, [
  "normalizeFixtureForView",
  "typeof homeNode === \"string\"",
  ".map(normalizeFixtureForView)",
  'className="relative min-h-full"',
], "Fixture page response guard");
expect((eplPage.match(/function normalizeFixtureForView/g) || []).length === 1, "Fixture page must contain exactly one response normalizer");

expect(main.includes('"fantasy-site-v18-lion-jpg"'), "Client cache must be fantasy-site-v18-lion-jpg");
expect(sw.includes('const CACHE_NAME = "fantasy-site-v18-lion-jpg"'), "Service worker cache must be fantasy-site-v18-lion-jpg");

if (failures.length) {
  console.error("Strict player identity and fixtures verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Strict identity verified: FPL remains internal for scoring/fixtures, while player-facing Collection/profile identity and portraits are API-Football only with safe fallbacks.");

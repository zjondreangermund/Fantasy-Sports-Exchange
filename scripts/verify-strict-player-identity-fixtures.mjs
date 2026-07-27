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

includesAll(fplIdentity, [
  "STRICT_PLAYER_IDENTITY_FIX_V1",
  "strongPlayerNameMatch",
  "playerMatchesElement(player, byStoredId)",
  "playerMatchesElement(player, byStoredCode)",
  "const strongCandidates = elements.filter",
  "surnameOverlap.length >= 1",
], "FPL strict identity resolver");
expect(!fplIdentity.includes("if (fplId > 0 && byId.has(fplId)) return"), "Stored FPL ids must not be trusted without checking the player name");
expect(!fplIdentity.includes("if (code > 0 && byCode.has(code)) return"), "Stored photo codes must not be trusted without checking the player name");

expect(!directory.includes("normalizePlayerText(candidate.lastName),"), "API-Football matching must not use surname-only aliases");
expect(!directory.includes("source.length === 1"), "API-Football matching must not link a card from one token");
includesAll(directory, ["row.nameScore >= 92", "rawPosition === row.candidate.position", "best.nameScore < 92"], "API-Football strict resolver");

includesAll(cards, [
  "const identityVerified = Boolean(apiFootballPlayer || matchedElement)",
  "imageUrl: verifiedImageUrl",
  "identityVerified,",
  'identitySource: apiFootballPlayer && matchedElement ? "fpl+api-football"',
  'imageUrl: null, verifiedImageUrl: null, identityVerified: false',
], "Collection card enrichment");
expect(!cards.includes("matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : player.imageUrl"), "Unverified collection cards must not fall back to stale stored photos");

includesAll(marketplace, [
  "fplApi.bootstrap()",
  "loadApiFootballPlayerDirectory()",
  "fplIndex.resolve(storedPlayer)",
  "verifiedImageUrl",
  "identityVerified",
], "Marketplace card enrichment");

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
  'identitySource: identityVerified ? (data.source === "api-football" ? "api-football" : "fpl") : "unverified-card-data"',
  "photo: null",
  "cutoutUrl: null",
], "Card profile identity gate");
expect(!modal.includes("data.player?.imageUrl || card.player?.imageUrl"), "Unverified profile cards must not reuse the collection card's stale image");

expect(server.includes("buildFplPlayerIndex(bootstrap).resolve({ name, team })"), "Image resolver must use the strict FPL identity resolver");
const imageRouteStart = server.indexOf('app.get("/api/player-image/resolve"');
const imageRouteEnd = server.indexOf('app.get("/api/image-proxy"');
const imageRoute = imageRouteStart >= 0 && imageRouteEnd > imageRouteStart ? server.slice(imageRouteStart, imageRouteEnd) : "";
expect(!imageRoute.includes("TheSportsDB"), "Card image resolution must not fall back to a fuzzy third-party player search");
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

expect(main.includes('"fantasy-site-v14"'), "Client cache must be fantasy-site-v14");
expect(sw.includes('const CACHE_NAME = "fantasy-site-v14"'), "Service worker cache must be fantasy-site-v14");

if (failures.length) {
  console.error("Strict player identity and fixtures verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Strict provider identity links, verified-only player images and crash-safe fixture responses verified.");

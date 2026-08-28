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

const directory = read("server/services/apiFootballPlayerDirectory.ts");
const sync = read("server/services/apiFootballSync.ts");
const syncRoutes = read("server/routes/apiFootballSync.routes.ts");
const cards = read("server/routes/cards.routes.ts");
const modal = read("client/src/components/cards/CardProfileModal.tsx");
const images = read("client/src/lib/card-image.ts");
const adapter = read("client/src/lib/fantasy-card-adapter.ts");
const main = read("client/src/main.tsx");
const serviceWorker = read("client/public/sw.js");

includesAll(directory, [
  "app.api_football_players",
  "normalizeApiFootballPosition",
  'return "GK"',
  'return "DEF"',
  'return "MID"',
  'return "FWD"',
  "resolveApiFootballPlayer",
  "getApiFootballPlayerProfileSnapshot",
  "api_football_player_match_stats",
  "goalsData.saves",
  "API-Football current squads",
], "API-Football player directory");

includesAll(sync, [
  '| "players"',
  "async function syncPlayers()",
  'providerGet("teams"',
  'providerGet("players/squads"',
  'safeRun("players")',
  "players: Number(counts.players || 0)",
], "API-Football scheduler");
expect(syncRoutes.includes('"players"'), "Manual sync centre must allow the players job");

includesAll(cards, [
  "loadApiFootballPlayerDirectory",
  "resolveApiFootballPlayer",
  "getApiFootballPlayerProfileSnapshot",
  'apiFootballPlayer && matchedElement ? "fpl+api-football"',
  'apiFootballPlayer ? "api-football-current-squad"',
  "verifiedImageUrl",
  "identityVerified: Boolean(apiFootballPlayer || matchedElement)",
  'source: "card-fallback"',
  "last10: []",
  'verifiedIdentity ? "API-Football current squads"',
  'stats: "API-Football match actions with official FPL fallback"',
  "const verifiedApiHistory = new Map<number, any>",
  "calculatePlayerScore(mapFplStatsToPlayerStats({ stats: row })",
  "saves: Number(matchedElement.saves || 0)",
], "Card profile provider integration");
expect(!cards.includes("opponent: `GW${index + 1}`"), "Card profiles must not fabricate ten placeholder gameweeks");
expect(!cards.includes("last10: last10.length ? last10 : lastScoresFallback(card)"), "Official profile history must not be replaced by fake zero rows");
expect(!cards.includes("matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : player.imageUrl"), "Unverified cards must never inherit stale portraits");

includesAll(modal, [
  'import { createPortal } from "react-dom"',
  'import { useSidebar } from "../ui/sidebar"',
  "setOpen(false)",
  "setOpenMobile(false)",
  'classList.add("card-profile-open")',
  "z-[300]",
  "createPortal(modal, document.body)",
  "No verified match records yet",
  "Zero-value placeholder games have been removed",
  'return "API-Football verified"',
  "verifiedImageUrl",
  'const identityVerified = data.source !== "card-fallback"',
], "Card profile modal");
expect(!modal.includes("while (padded.length < 10)"), "Client fallback must not fabricate ten match records");
expect(!modal.includes("data.player?.imageUrl || card.player?.imageUrl"), "Unverified profiles must not promote stale collection images");

includesAll(images, [
  "verifiedImageUrl?: string | null",
  "isVerifiedPlayerIdentity",
  "const verified = isVerifiedPlayerIdentity(player)",
  "player?.verifiedImageUrl",
  "const normalized = normalizeImageUrl(raw)",
  "candidates.push(toSafeImageUrl(normalized))",
  "candidates.push(CARD_IMAGE_FALLBACK)",
], "Verified image priority");
expect(!images.includes("playerResolverUrl"), "Fuzzy portrait lookup must not be part of the card image chain");
expect(adapter.includes("safeUrl(player?.verifiedImageUrl)"), "Fantasy card adapter must prioritize the verified provider image");
expect(adapter.includes("const identityVerified = isVerifiedPlayerIdentity(player)"), "Fantasy card adapter must gate direct images by verified identity");

expect(main.includes('"fantasy-site-v18-lion-jpg"'), "Client cache must match the active service worker cache");
expect(serviceWorker.includes('const CACHE_NAME = "fantasy-site-v18-lion-jpg"'), "Service worker cache must match the active client cache");

if (failures.length) {
  console.error("Verified player profile integrity failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Verified player identities, API-Football match actions with official FPL history fallback, goalkeeper stats and full-screen profile modal behavior are wired correctly.");

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
  "players/squads",
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
  'identitySource: apiFootballPlayer ? "api-football-current-squad"',
  "verifiedImageUrl",
  'source: "card-fallback"',
  "last10: []",
  'identity: "API-Football current squads"',
  'stats: "Fantasy Premier League match history"',
  "saves: Number(matchedElement.saves || 0)",
], "Card profile provider integration");
expect(!cards.includes("opponent: `GW${index + 1}`"), "Card profiles must not fabricate ten placeholder gameweeks");
expect(!cards.includes("last10: last10.length ? last10 : lastScoresFallback(card)"), "Official profile history must not be replaced by fake zero rows");

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
], "Card profile modal");
expect(!modal.includes("while (padded.length < 10)"), "Client fallback must not fabricate ten match records");

includesAll(images, [
  "verifiedImageUrl?: string | null",
  "const verifiedImage = normalizeImageUrl(player?.verifiedImageUrl)",
  "candidates.push(toSafeImageUrl(verifiedImage))",
], "Verified image priority");
expect(adapter.includes("safeUrl(player?.verifiedImageUrl)"), "Fantasy card adapter must prioritize the verified provider image");

expect(main.includes('"fantasy-site-v13"'), "Client cache must be fantasy-site-v13");
expect(serviceWorker.includes('const CACHE_NAME = "fantasy-site-v13"'), "Service worker cache must be fantasy-site-v13");

if (failures.length) {
  console.error("Verified player profile integrity failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Verified player identities, official match histories, goalkeeper stats and full-screen profile modal behavior are wired correctly.");

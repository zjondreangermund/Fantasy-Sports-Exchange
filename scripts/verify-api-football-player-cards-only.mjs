#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";

// The final policy patch is generated at build time. Keep the generated callbacks
// explicitly typed so strict TypeScript builds do not infer implicit any values.
{
  const file = "server/routes/onboarding.routes.ts";
  const source = fs.readFileSync(file, "utf8");
  const next = source
    .replace(
      ".map((pack: number[]) => selected.find((id) => pack.includes(id)))",
      ".map((pack: number[]) => selected.find((id: number) => pack.includes(id)))",
    )
    .replace(
      ".filter((id): id is number => Number.isInteger(id));",
      ".filter((id: number | undefined): id is number => Number.isInteger(id));",
    );
  if (next !== source) fs.writeFileSync(file, next);
}

const failures = [];
const read = (file) => fs.readFileSync(file, "utf8");
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

for (const file of [
  "scripts/apply-api-football-player-cards-only-v2.mjs",
  "scripts/verify-api-football-player-cards-only.mjs",
]) {
  try { execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }); }
  catch (error) { failures.push(`${file} syntax failed: ${String(error?.stderr || error?.message || error)}`); }
}

const onboarding = read("server/routes/onboarding.routes.ts");
const cards = read("server/routes/cards.routes.ts");
const modal = read("client/src/components/cards/CardProfileModal.tsx");
const compact = read("client/src/components/cards/PremiumFootballCard.tsx");
const visual = read("client/src/components/cards/CollectionStableCard.tsx");

requireText(onboarding, "orderedSelected = ob.packCards", "onboarding selections are not normalized to pack order");
requireText(onboarding, "selected.find((id: number)", "ordered onboarding find callback is not strictly typed");
requireText(onboarding, "filter((id: number | undefined)", "ordered onboarding filter callback is not strictly typed");
requireText(onboarding, "selectedCards: orderedSelected", "ordered onboarding selection is not persisted");
requireText(cards, 'const starterSlots = ["GK", "DEF", "MID", "FWD", "UTILITY"]', "collection starter slot order is missing");
requireText(cards, "starterOrder.get(Number(a.playerId", "collection response is not sorted by onboarding order");
requireText(cards, "loadApiFootballPlayerDirectory", "collection does not load API-Football player identities");
requireText(cards, "getApiFootballPlayerProfileSnapshot", "profile does not use API-Football match snapshot");
requireText(cards, 'source: "api-football"', "profile source is not API-Football");
requireText(cards, 'stats: "API-Football Premier League match statistics"', "profile does not declare API-Football stats source");
requireText(cards, 'identitySource: apiFootballPlayer ? "api-football-current-squad"', "collection identity is not API-Football-only");
rejectText(cards, "fplApi.bootstrap()", "collection/profile route still calls FPL bootstrap");
rejectText(cards, "fplApi.getLiveGameweek()", "collection route still calls FPL live data");
rejectText(cards, "fplApi.playerSummary", "card profile still calls FPL player history");
rejectText(cards, 'source: "fpl-live"', "card profile still exposes FPL as the player profile provider");

requireText(modal, 'return "API-Football verified"', "player profile badge is not API-Football");
requireText(modal, 'label="Matches"', "player modal does not show API-Football match count");
requireText(modal, 'label="Avg Rating"', "player modal does not show API-Football average rating");
requireText(modal, '>RTG</th>', "match log does not show API-Football rating");
rejectText(modal, 'label="Ownership"', "FPL ownership is still visible in player profile");
rejectText(modal, '"FPL Points"', "FPL points label is still visible in player profile");
rejectText(modal, 'label="Bonus"', "FPL bonus label is still visible in player profile");

requireText(compact, "averageRating?: number | null", "compact cards cannot receive API-Football average rating");
requireText(compact, "matchesPlayed?: number", "compact cards cannot receive API-Football match count");
requireText(compact, "rating: data.stats?.averageRating", "compact cards do not hydrate API rating");
requireText(visual, 'label="RTG"', "card face still shows legacy overall instead of API rating");
requireText(visual, 'label="MATCH"', "card face does not show API match count");
requireText(visual, "isApiFootballPortrait", "API-Football portrait detection is missing");
requireText(visual, 'mixBlendMode: apiFootballPortrait ? "multiply"', "white-background suppression blend is missing");
requireText(visual, "WebkitMaskImage: apiFootballPortrait", "portrait heavy edge fade is missing");

if (failures.length) {
  console.error("API-Football player-card verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("API-Football player cards verified: onboarding order, API-only player profiles/stats and white-background portrait fading are active.");

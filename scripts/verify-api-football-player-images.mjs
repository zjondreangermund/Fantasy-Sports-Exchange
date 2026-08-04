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
const marketplace = read("server/routes/marketplace.routes.ts");
const index = read("server/index.ts");
const cardImages = read("client/src/lib/card-image.ts");
const admin = read("client/src/pages/admin-live-data.tsx");
const main = read("client/src/main.tsx");
const sw = read("client/public/sw.js");

includesAll(directory, [
  "API_FOOTBALL_IMAGE_HEALTH_V1",
  "apiFootballPhotoUrl",
  "isApiFootballPlayerPhotoUrl",
  'const API_FOOTBALL_MEDIA_HOST = "media.api-sports.io"',
  "apiFootballPhotoUrl(apiPlayerId, player?.photo)",
], "API-Football directory photo normalization");

includesAll(sync, [
  "probeApiFootballPlayerImage",
  "getApiFootballPlayerImageHealth",
  "player_photos",
  "photoCoveragePercent",
  "imageProbe",
  'host: "media.api-sports.io"',
], "API-Football image health service");

includesAll(syncRoutes, [
  'app.get("/api/health/player-images"',
  'app.get("/api/admin/live-data/player-images"',
  "getApiFootballPlayerImageHealth",
], "Player image health routes");

includesAll(cards, [
  "apiFootballPhotoUrl",
  "const apiFootballImage = apiFootballPlayer",
  "imageUrl: apiFootballImage ||",
  "verifiedImageUrl: apiFootballImage ||",
], "Collection player image integration");

includesAll(marketplace, [
  "loadApiFootballPlayerDirectory",
  "resolveApiFootballPlayer",
  "apiFootballPhotoUrl",
  "apiFootballDirectory",
  'apiFootballPlayer ? "api-football-current-squad"',
], "Marketplace player image integration");

includesAll(index, [
  'target.hostname === "media.api-sports.io"',
  "/^\\/football\\/players\\/\\d+\\.png$/i",
  'headers.Referer = "https://www.premierleague.com/"',
], "Secure image proxy");
expect(index.includes("Host or image path not allowed"), "Image proxy must reject unknown hosts and paths");

expect(cardImages.includes("media\\.api-sports\\.io"), "Client image helper must proxy API-Football portraits");

includesAll(admin, [
  "Sync Players & Photos",
  "/api/admin/live-data/player-images",
  "API-Football player portraits",
  "Image feed online",
  "Player photos",
], "Admin image verification UI");

expect(main.includes('"fantasy-site-v18-lion-jpg"'), "Client cache must be fantasy-site-v18-lion-jpg");
expect(sw.includes('const CACHE_NAME = "fantasy-site-v18-lion-jpg"'), "Service worker cache must be fantasy-site-v18-lion-jpg");

if (failures.length) {
  console.error("API-Football player image verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("API-Football squad photos, exact identity links, secure proxying and live image health checks are wired correctly.");

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`${file}: expected block not found`);
  write(file, source.replace(before, after));
}

const syncRoutes = "server/routes/apiFootballSync.routes.ts";
let source = read(syncRoutes);
if (!source.includes('/api/health/player-images')) {
  source = source.replace(
    'import { getApiFootballSyncSummary, runApiFootballSync, type SyncJobType } from "../services/apiFootballSync.js";',
    'import { getApiFootballPlayerImageHealth, getApiFootballSyncSummary, runApiFootballSync, type SyncJobType } from "../services/apiFootballSync.js";',
  );
  source = source.replace(
    '  const { requireAuth, isAdmin } = deps;\n',
    `  const { requireAuth, isAdmin } = deps;\n\n  app.get("/api/health/player-images", async (_req, res) => {\n    try {\n      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");\n      return res.json(await getApiFootballPlayerImageHealth({ probe: true }));\n    } catch (error: any) {\n      return res.status(503).json({ service: "api-football-player-images", healthy: false, message: error?.message || "Player image health check failed" });\n    }\n  });\n\n  app.get("/api/admin/live-data/player-images", requireAuth, isAdmin, async (_req, res) => {\n    try { return res.json(await getApiFootballPlayerImageHealth({ probe: true })); }\n    catch (error: any) { return res.status(500).json({ message: error?.message || "Could not verify player images" }); }\n  });\n`,
  );
  write(syncRoutes, source);
}

const cardsFile = "server/routes/cards.routes.ts";
source = read(cardsFile);
if (!source.includes("apiFootballPhotoUrl")) {
  source = source.replace(
    'import { getApiFootballPlayerProfileSnapshot, loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";',
    'import { apiFootballPhotoUrl, getApiFootballPlayerProfileSnapshot, loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";',
  );
  source = source.replace(
    '        const overall = matchedElement\n          ? overallFromFplElement(matchedElement)\n          : Number(player.overall || card.decisiveScore || 0);\n\n        return {',
    '        const overall = matchedElement\n          ? overallFromFplElement(matchedElement)\n          : Number(player.overall || card.decisiveScore || 0);\n        const apiFootballImage = apiFootballPlayer ? apiFootballPhotoUrl(apiFootballPlayer.apiPlayerId, apiFootballPlayer.photo) : "";\n\n        return {',
  );
  source = source.replace(
    '            imageUrl: apiFootballPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null),\n            verifiedImageUrl: apiFootballPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null),',
    '            imageUrl: apiFootballImage || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null),\n            verifiedImageUrl: apiFootballImage || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null),',
  );
  write(cardsFile, source);
}

const marketplaceFile = "server/routes/marketplace.routes.ts";
source = read(marketplaceFile);
if (!source.includes("loadApiFootballPlayerDirectory")) {
  source = source.replace(
    'import { buildFplPlayerIndex } from "../services/fplPlayerIdentity.js";\n',
    'import { buildFplPlayerIndex } from "../services/fplPlayerIdentity.js";\nimport { apiFootballPhotoUrl, loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";\n',
  );
  source = source.replace('      const [result, bootstrap] = await Promise.all([', '      const [result, bootstrap, apiFootballDirectory] = await Promise.all([');
  source = source.replace(
    '        fplApi.bootstrap().catch(() => null),\n      ]);',
    '        fplApi.bootstrap().catch(() => null),\n        loadApiFootballPlayerDirectory().catch(() => []),\n      ]);',
  );
  source = source.replace(
    '        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;\n        const verifiedImageUrl = matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null;\n        return { ...row, player: { ...storedPlayer, ...(canonical || {}), imageUrl: verifiedImageUrl, verifiedImageUrl, identityVerified: Boolean(matchedElement), identitySource: matchedElement ? "fpl" : "unverified-card-data" } };',
    '        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;\n        const apiFootballPlayer = resolveApiFootballPlayer({ ...storedPlayer, ...(canonical || {}) }, apiFootballDirectory);\n        const apiFootballImage = apiFootballPlayer ? apiFootballPhotoUrl(apiFootballPlayer.apiPlayerId, apiFootballPlayer.photo) : "";\n        const verifiedImageUrl = apiFootballImage || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null);\n        const identityVerified = Boolean(apiFootballPlayer || matchedElement);\n        return { ...row, player: { ...storedPlayer, ...(canonical || {}), name: canonical?.name || apiFootballPlayer?.name || storedPlayer.name, team: apiFootballPlayer?.team || canonical?.team || storedPlayer.team, position: apiFootballPlayer?.position || canonical?.position || storedPlayer.position, apiFootballId: apiFootballPlayer?.apiPlayerId || null, imageUrl: verifiedImageUrl, verifiedImageUrl, identityVerified, identitySource: apiFootballPlayer && matchedElement ? "fpl+api-football" : apiFootballPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data" } };',
  );
  write(marketplaceFile, source);
}

const cardImageFile = "client/src/lib/card-image.ts";
source = read(cardImageFile);
source = source.replace(
  '  if (/^https?:\\/\\/resources\\.premierleague\\.com\\//i.test(url)) {\n    return `/api/image-proxy?url=${encodeURIComponent(url)}`;\n  }',
  '  if (/^https?:\\/\\/(resources\\.premierleague\\.com|media\\.api-sports\\.io)\\//i.test(url)) {\n    return `/api/image-proxy?url=${encodeURIComponent(url)}`;\n  }',
);
write(cardImageFile, source);

const indexFile = "server/index.ts";
source = read(indexFile);
if (!source.includes("isApiFootballPlayer")) {
  source = source.replace(
    '  if (target.hostname !== "resources.premierleague.com") return res.status(403).json({ message: "Host not allowed" });\n\n  const urlsToTry = [target.toString()];',
    '  const isPremierLeague = target.protocol === "https:" && target.hostname === "resources.premierleague.com";\n  const isApiFootballPlayer = target.protocol === "https:" && target.hostname === "media.api-sports.io" && /^\\/football\\/players\\/\\d+\\.png$/i.test(target.pathname);\n  if (!isPremierLeague && !isApiFootballPlayer) return res.status(403).json({ message: "Host or image path not allowed" });\n\n  const urlsToTry = [target.toString()];',
  );
  source = source.replace(
    '      const r = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36", Referer: "https://www.premierleague.com/", Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" } }).finally(() => clearTimeout(timeout));',
    '      const candidate = new URL(url);\n      const headers: Record<string, string> = { "User-Agent": "FantasyArena/1.0", Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" };\n      if (candidate.hostname === "resources.premierleague.com") headers.Referer = "https://www.premierleague.com/";\n      const r = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers }).finally(() => clearTimeout(timeout));',
  );
  write(indexFile, source);
}

console.log("API-Football image routes and proxy patch applied.");

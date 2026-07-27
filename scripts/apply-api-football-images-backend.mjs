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

const directoryFile = "server/services/apiFootballPlayerDirectory.ts";
if (!read(directoryFile).includes("API_FOOTBALL_IMAGE_HEALTH_V1")) {
  replaceOnce(
    directoryFile,
    'export type CanonicalPlayerPosition = "GK" | "DEF" | "MID" | "FWD";\n',
    `export type CanonicalPlayerPosition = "GK" | "DEF" | "MID" | "FWD";\n\n// API_FOOTBALL_IMAGE_HEALTH_V1\nconst API_FOOTBALL_MEDIA_HOST = "media.api-sports.io";\nconst API_FOOTBALL_PLAYER_PHOTO_PATH = /^\\/football\\/players\\/(\\d+)\\.png$/i;\n\nexport function apiFootballPhotoUrl(playerId: unknown, providedPhoto?: unknown): string {\n  const id = Number(playerId || 0);\n  if (!Number.isInteger(id) || id <= 0) return "";\n  const canonical = \`https://\${API_FOOTBALL_MEDIA_HOST}/football/players/\${id}.png\`;\n  const provided = String(providedPhoto || "").trim();\n  if (!provided) return canonical;\n  try {\n    const url = new URL(provided);\n    const match = url.pathname.match(API_FOOTBALL_PLAYER_PHOTO_PATH);\n    if (url.protocol === "https:" && url.hostname === API_FOOTBALL_MEDIA_HOST && Number(match?.[1] || 0) === id) return url.toString();\n  } catch {}\n  return canonical;\n}\n\nexport function isApiFootballPlayerPhotoUrl(value: unknown, expectedPlayerId?: unknown): boolean {\n  try {\n    const url = new URL(String(value || ""));\n    const match = url.pathname.match(API_FOOTBALL_PLAYER_PHOTO_PATH);\n    if (url.protocol !== "https:" || url.hostname !== API_FOOTBALL_MEDIA_HOST || !match) return false;\n    const expected = Number(expectedPlayerId || 0);\n    return !expected || Number(match[1]) === expected;\n  } catch {\n    return false;\n  }\n}\n`,
  );
  replaceOnce(directoryFile, '    const photo = String(player?.photo || "").trim();', '    const photo = apiFootballPhotoUrl(apiPlayerId, player?.photo);');
}

const syncFile = "server/services/apiFootballSync.ts";
let sync = read(syncFile);
if (!sync.includes("probeApiFootballPlayerImage")) {
  sync = sync.replace(
    'import { ensureApiFootballPlayerDirectorySchema, replaceApiFootballSquad } from "./apiFootballPlayerDirectory.js";',
    'import { apiFootballPhotoUrl, ensureApiFootballPlayerDirectorySchema, replaceApiFootballSquad } from "./apiFootballPlayerDirectory.js";',
  );
  sync = sync.replace(
    'let schedulerStarted = false;\n',
    `let schedulerStarted = false;\nlet playerImageProbeCache: { expiresAt: number; value: any } | null = null;\n\nasync function probeApiFootballPlayerImage(force = false) {\n  if (!force && playerImageProbeCache && playerImageProbeCache.expiresAt > Date.now()) return playerImageProbeCache.value;\n  const row = rowsOf(await db.execute(sql\`\n    select api_player_id as "apiPlayerId", photo\n    from app.api_football_players\n    where season=\${seasonNow()} and active=true and coalesce(photo,'') <> ''\n    order by updated_at desc, api_player_id asc\n    limit 1\n  \`))[0];\n  if (!row) {\n    const value = { checked: false, reachable: false, status: null, contentType: null, host: "media.api-sports.io", reason: "No stored API-Football player photo is available yet" };\n    playerImageProbeCache = { expiresAt: Date.now() + 60_000, value };\n    return value;\n  }\n  const url = apiFootballPhotoUrl(row.apiPlayerId, row.photo);\n  let value: any;\n  try {\n    const response = await fetch(url, { method: "GET", redirect: "follow", headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8", "User-Agent": "FantasyArena/1.0" }, signal: AbortSignal.timeout(8000) });\n    const contentType = String(response.headers.get("content-type") || "");\n    value = { checked: true, reachable: response.ok && contentType.startsWith("image/"), status: response.status, contentType, host: new URL(url).hostname };\n    try { await response.body?.cancel(); } catch {}\n  } catch (error: any) {\n    value = { checked: true, reachable: false, status: null, contentType: null, host: "media.api-sports.io", reason: error?.message || "Image request failed" };\n  }\n  playerImageProbeCache = { expiresAt: Date.now() + 15 * 60_000, value };\n  return value;\n}\n`,
  );
  sync = sync.replace(
    '  return { calls, records, details: { season, teamsAvailable: teamRows.length, teamsProcessed } };',
    `  const photoCounts = rowsOf(await db.execute(sql\`\n    select count(*)::int as players, count(*) filter (where coalesce(photo,'') <> '')::int as photos\n    from app.api_football_players where season=\${season} and active=true\n  \`))[0] || {};\n  const imageProbe = await probeApiFootballPlayerImage(true);\n  return { calls, records, details: { season, teamsAvailable: teamRows.length, teamsProcessed, playersStored: Number(photoCounts.players || 0), photosStored: Number(photoCounts.photos || 0), photoCoveragePercent: Number(photoCounts.players || 0) ? Math.round((Number(photoCounts.photos || 0) / Number(photoCounts.players || 1)) * 100) : 0, imageProbe } };`,
  );
  sync = sync.replace(
    "      (select count(*)::int from app.api_football_players where season=${seasonNow()} and active=true) as players,\n      (select count(*)::int from app.api_football_standings where league_id=${LEAGUE_ID} and season=${seasonNow()}) as standings",
    "      (select count(*)::int from app.api_football_players where season=${seasonNow()} and active=true) as players,\n      (select count(*)::int from app.api_football_players where season=${seasonNow()} and active=true and coalesce(photo,'') <> '') as player_photos,\n      (select count(*)::int from app.api_football_standings where league_id=${LEAGUE_ID} and season=${seasonNow()}) as standings",
  );
  sync = sync.replace(
    '    select id,job_type as "jobType",status,provider_calls as "providerCalls",records_processed as "recordsProcessed",message,started_at as "startedAt",finished_at as "finishedAt"',
    '    select id,job_type as "jobType",status,provider_calls as "providerCalls",records_processed as "recordsProcessed",message,details,started_at as "startedAt",finished_at as "finishedAt"',
  );
  sync = sync.replace(
    '    counts: { fixtures: Number(counts.fixtures || 0), teams: Number(counts.teams || 0), players: Number(counts.players || 0), playerStats: Number(counts.player_stats || 0), standings: Number(counts.standings || 0) },',
    '    counts: { fixtures: Number(counts.fixtures || 0), teams: Number(counts.teams || 0), players: Number(counts.players || 0), playerPhotos: Number(counts.player_photos || 0), playersWithoutPhotos: Math.max(0, Number(counts.players || 0) - Number(counts.player_photos || 0)), photoCoveragePercent: Number(counts.players || 0) ? Math.round((Number(counts.player_photos || 0) / Number(counts.players || 1)) * 100) : 0, playerStats: Number(counts.player_stats || 0), standings: Number(counts.standings || 0) },',
  );
  sync = sync.replace(
    'export function startApiFootballSyncScheduler() {',
    `export async function getApiFootballPlayerImageHealth(options: { probe?: boolean } = {}) {\n  await ensureApiFootballSyncSchema();\n  const season = seasonNow();\n  const counts = rowsOf(await db.execute(sql\`\n    select count(*)::int as players, count(*) filter (where coalesce(photo,'') <> '')::int as photos, max(updated_at) as "lastDirectoryUpdate"\n    from app.api_football_players where season=\${season} and active=true\n  \`))[0] || {};\n  const lastRun = rowsOf(await db.execute(sql\`\n    select status, message, details, started_at as "startedAt", finished_at as "finishedAt"\n    from app.api_football_sync_runs where job_type='players' order by started_at desc limit 1\n  \`))[0] || null;\n  const players = Number(counts.players || 0);\n  const photos = Number(counts.photos || 0);\n  const imageProbe = options.probe === false ? (playerImageProbeCache?.value || null) : await probeApiFootballPlayerImage(false);\n  return { service: "api-football-player-images", configured: Boolean(API_KEY), provider: "API-Football", season, players, photos, missingPhotos: Math.max(0, players - photos), coveragePercent: players ? Math.round((photos / players) * 100) : 0, lastDirectoryUpdate: counts.lastDirectoryUpdate ? new Date(counts.lastDirectoryUpdate).toISOString() : null, lastSync: lastRun, imageProbe, healthy: Boolean(API_KEY && players > 0 && photos > 0 && imageProbe?.reachable) };\n}\n\nexport function startApiFootballSyncScheduler() {`,
  );
  write(syncFile, sync);
}

console.log("API-Football image backend patch applied.");

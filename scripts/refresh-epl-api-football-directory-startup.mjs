#!/usr/bin/env node

if (!String(process.env.API_FOOTBALL_KEY || "").trim()) {
  console.log("[api-football-startup] API_FOOTBALL_KEY is not configured; keeping the current cached player directory and FPL portraits.");
  process.exit(0);
}

// Fantasy Arena tracks only the English Premier League. Force the provider
// service to league 39 even if an obsolete Railway variable still exists.
process.env.API_FOOTBALL_LEAGUE_ID = "39";

try {
  const sync = await import("../dist/server/server/services/apiFootballSync.js");
  const before = await sync.getApiFootballSyncSummary();
  if (Number(before?.leagueId || 0) !== 39) throw new Error(`API-Football service resolved unexpected league ${before?.leagueId}`);
  const result = await sync.runApiFootballSync("players");
  const after = await sync.getApiFootballSyncSummary();
  console.log(JSON.stringify({
    success: true,
    leagueId: 39,
    provider: "API-Football",
    playerSync: result,
    playerDirectory: {
      players: Number(after?.counts?.players || 0),
      photos: Number(after?.counts?.playerPhotos || 0),
      missingPhotos: Number(after?.counts?.playersWithoutPhotos || 0),
      coveragePercent: Number(after?.counts?.photoCoveragePercent || 0),
    },
  }, null, 2));
} catch (error) {
  console.warn(`[api-football-startup] Current EPL player-directory refresh was unavailable: ${String(error?.message || error)}. Railway will continue with cached API-Football data plus official FPL identities/images, and the normal scheduler will retry after startup.`);
}

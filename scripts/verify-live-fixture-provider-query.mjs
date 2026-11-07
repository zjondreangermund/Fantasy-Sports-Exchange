import "./verify-player-booking-notifications.mjs";
import fs from "node:fs";

const route = fs.readFileSync("server/routes/footballData.routes.ts", "utf8");
const sync = fs.readFileSync("server/services/apiFootballSync.ts", "utf8");
const failures = [];

function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message);
}

function rejectText(source, text, message) {
  if (source.includes(text)) failures.push(message);
}

requireText(route, "API_FOOTBALL_VALID_LIVE_FILTER_V1", "live fixture route guard marker is missing");
requireText(route, 'delete params.league;', "live fixture query still includes the separate league parameter");
requireText(route, 'params.live = "all";', "live fixture query does not use API-Football's valid literal live filter");
requireText(route, "Number(fixture.leagueId || 0) === league.config.id", "live fixture response is not filtered back to the requested league");
requireText(route, "fplAvailable: !fplLiveResult.error", "FPL success is not distinguished from an empty live fixture list");
requireText(route, "!live.fplAvailable && !live.savedFixtures.length", "an empty successful FPL response can still be reported as an outage");
rejectText(route, "params.live = league.config.id", "numeric live filter regression restored");

// API_FOOTBALL_LIVE_QUOTA_GUARD_V1: UI FPL updates are every 30 seconds, but
// provider /fixtures?live=all calls must have a much longer shared cache and
// one in-flight promise to avoid exhausting the site's daily request cap.
requireText(route, "API_FOOTBALL_LIVE_QUOTA_GUARD_V1", "live site cache quota guard missing");
requireText(route, 'path === "fixtures" && params.live === "all"', "live cache floor missing");
requireText(route, "API_FOOTBALL_LIVE_SITE_TTL_SECONDS = 15 * 60", "live provider is not cached for 15 minutes");
requireText(route, "inFlightProviderLoads.get(key)", "concurrent live provider requests are not deduplicated");
requireText(route, "providerDelayed = Boolean(providerFailure || result?.stale)", "true API failures are not distinguished from supplemental FPL fixtures");
requireText(route, 'providerStatus: providerDelayed ? "delayed" : fallback ? "supplemented" : "current"', "client does not receive distinct live provider status");
rejectText(route, 'fallback = live.usedFallback || Boolean(providerFailure) || Boolean(result?.stale);\n        // API-Football is temporarily unavailable', "fallback data must not automatically claim an upstream outage");

requireText(sync, 'providerGet("fixtures", { live: "all" })', "background live sync does not use the valid standalone live filter");
requireText(sync, "Number(row?.league?.id || 0) === LEAGUE_ID", "background live sync does not scope all-live results to Premier League");
rejectText(sync, 'providerGet("fixtures", { league: LEAGUE_ID, season: seasonNow(), live: "all" })', "background live sync still combines incompatible live filters");

if (failures.length) {
  console.error("Live fixture provider query verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Live fixture provider query verified: valid live=all request, Premier League filtering, FPL empty-result handling, and saved-data outage fallback are protected.");

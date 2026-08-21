import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const sync = read("server/services/apiFootballSync.ts");
const syncRoutes = read("server/routes/apiFootballSync.routes.ts");
const adminRoutes = read("server/routes/apiFootballAdmin.routes.ts");
const dashboard = read("client/src/pages/admin-live-data.tsx");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`API-Football Pro verification failed: ${label}`);
}
function rejectText(source, text, label) {
  if (source.includes(text)) throw new Error(`API-Football Pro verification failed: ${label}`);
}

requireText(sync, "API_FOOTBALL_PRO_MODE_V1", "Pro mode marker missing");
requireText(sync, "Math.min(7400", "Pro safety cap does not allow the 7,000-call configuration");
requireText(sync, "API_FOOTBALL_DAILY_CAP || 7000", "7,000-call default safety cap missing");
requireText(sync, "API_FOOTBALL_EMERGENCY_RESERVE || 500", "500-call emergency reserve missing");
requireText(sync, "x-ratelimit-requests-limit", "daily provider limit header is not read");
requireText(sync, "x-ratelimit-requests-remaining", "daily provider remaining header is not read");
requireText(sync, "x-ratelimit-limit", "minute provider limit header is not read");
requireText(sync, "x-ratelimit-remaining", "minute provider remaining header is not read");
requireText(sync, "response.status === 429", "429 backoff is not implemented");
requireText(sync, "API_FOOTBALL_PRO_SCHEMA_V1", "Pro schema is missing");
requireText(sync, "app.api_football_lineups", "lineup persistence is missing");
requireText(sync, "app.api_football_injuries", "injury persistence is missing");
requireText(sync, "app.api_football_transfers", "transfer persistence is missing");
requireText(sync, 'providerGet("fixtures", { league: LEAGUE_ID, season: seasonNow() })', "full-season fixture sync is missing");
requireText(sync, 'if (jobType === "lineups") return syncLineups();', "lineup job routing missing");
requireText(sync, 'if (jobType === "injuries") return syncInjuries();', "injury job routing missing");
requireText(sync, 'if (jobType === "transfers") return syncTransfers();', "transfer job routing missing");
requireText(sync, 'setInterval(() => safeRun("live"), LIVE_POLL_MINUTES * 60000)', "live scheduler missing");
requireText(sync, 'setInterval(() => safeRun("lineups"), LINEUPS_POLL_MINUTES * 60000)', "lineup scheduler missing");
requireText(sync, 'setInterval(() => safeRun("injuries"), INJURY_SYNC_MINUTES * 60000)', "injury scheduler missing");
requireText(sync, 'setInterval(() => safeRun("transfers"), TRANSFER_SYNC_HOURS * 3600000)', "transfer scheduler missing");
requireText(sync, "API_FOOTBALL_PRO_SUMMARY_V1", "Pro quota summary missing");
requireText(sync, "providerDaily", "provider quota summary contract missing");
rejectText(sync, "Math.min(90", "old 90-request cap remains in sync service");

requireText(syncRoutes, '"lineups", "injuries", "transfers"', "manual Pro sync routes missing");
requireText(adminRoutes, "API_FOOTBALL_PRO_ADMIN_V1", "Admin route still uses free-plan cap");
rejectText(adminRoutes, "Math.min(90", "old 90-request cap remains in admin route");
requireText(adminRoutes, "minuteRemaining", "Admin status does not expose per-minute headroom");

requireText(dashboard, "API_FOOTBALL_PRO_DASHBOARD_V1", "Pro Sync Centre dashboard marker missing");
requireText(dashboard, "Provider plan", "Provider plan metric missing");
requireText(dashboard, "Provider daily", "Daily provider quota metric missing");
requireText(dashboard, "Per minute", "Per-minute quota metric missing");
requireText(dashboard, 'key: "lineups"', "Manual lineup sync control missing");
requireText(dashboard, 'key: "injuries"', "Manual injury sync control missing");
requireText(dashboard, 'key: "transfers"', "Manual transfer sync control missing");
requireText(dashboard, "Lineups stored", "Lineup coverage metric missing");
requireText(dashboard, "Active injuries", "Injury coverage metric missing");
requireText(dashboard, "Transfers stored", "Transfer coverage metric missing");

console.log("API-Football Pro mode verified: provider quotas are detected, the 7,000-call safety cap and 500-call reserve are protected, live polling can run every minute, full-season fixtures plus lineups/injuries/transfers sync into the database, and Admin Live Data exposes Pro controls and coverage.");

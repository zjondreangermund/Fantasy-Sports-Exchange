import fs from "node:fs";

const routes = fs.readFileSync("server/routes/marketplace.routes.ts", "utf8");
const page = fs.readFileSync("client/src/pages/competitions-vault.tsx", "utf8");
const generatedCard = fs.readFileSync("scripts/apply-gameweek-prize-isolation.mjs", "utf8");
const freeWindow = fs.readFileSync("scripts/apply-gw1-entry-extension.mjs", "utf8");
const startup = fs.readFileSync("start.sh", "utf8");

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

requireText(routes, 'app.get("/api/competitions/:id/leaderboard"', "The tournament leaderboard endpoint is missing.");
requireText(routes, "Math.min(requestedPageSize, 100)", "Tournament leaderboard pages must be capped at 100 teams.");
requireText(routes, "row_number() over", "Leaderboard positions must be ranked deterministically.");
requireText(routes, 'limit ${pageSize} offset ${offset}', "Tournament leaderboard pages must use a real database offset.");
requireText(routes, "totalPages: Math.max(1, Math.ceil(totalEntries / pageSize))", "Tournament leaderboard pagination totals are missing.");
requireText(routes, 'app.get("/api/competitions/:id/entries/:entryId"', "The submitted-team scoring endpoint is missing.");
requireText(routes, "snapshot.cardScores", "Submitted teams must use official per-card scoring snapshots.");
requireText(routes, "saved?.breakdown || calculated?.breakdown", "Submitted teams must expose each player's exact scoring categories.");
requireText(routes, "Array.isArray(saved?.reasons)", "Submitted teams must expose each player's recorded scoring actions.");
requireText(routes, "fplApi.getLiveGameweek(Number(entry.gameWeek || 1))", "Team scoring must load the tournament's actual gameweek.");
requireText(routes, "captainBonus", "Submitted-team scoring must include the captain bonus.");

requireText(page, ".slice(0, 5)", "Tournament cards must show a compact top-five leaderboard.");
requireText(page, "pageSize=100", "The full leaderboard must load 100 teams per page.");
requireText(page, "Previous", "The full leaderboard needs a previous-page control.");
requireText(page, "Next", "The full leaderboard needs a next-page control.");
requireText(page, "Open all", "Tournament cards need an Open all leaderboard action.");
requireText(page, "How points were earned", "Player scoring actions must be visible in submitted teams.");
requireText(page, "<TournamentLeaderboardPreview comp={comp} />", "The tournament card must render its leaderboard.");
requireText(generatedCard, "<TournamentLeaderboardPreview comp={comp} />", "The build-generated tournament card must retain its leaderboard.");

requireText(freeWindow, 'const CUTOFF_ISO = "2026-08-23T21:59:59.000Z"', "FREE GW1 tournaments must remain open until the end of 23 August CAT.");
requireText(freeWindow, "Number(comp?.entryFee ?? comp?.entry_fee ?? Number.NaN) === 0", "The GW1 extension must exclude paid tournaments.");
requireText(freeWindow, "startsWith(", "The GW1 extension must check the tournament name.");
requireText(freeWindow, "GW1 FREE ", "The GW1 extension must only reopen named FREE GW1 tournaments.");
requireText(startup, "23 Aug end-of-day CAT", "Production startup must announce the current FREE GW1 window.");

console.log("Tournament leaderboards, official player scoring details and the FREE GW1 test window verified.");

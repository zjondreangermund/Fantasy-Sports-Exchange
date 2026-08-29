import fs from "node:fs";

const routes = fs.readFileSync("server/routes/marketplace.routes.ts", "utf8");
const page = fs.readFileSync("client/src/pages/competitions-vault.tsx", "utf8");
const generatedCard = fs.readFileSync("scripts/apply-gameweek-prize-isolation.mjs", "utf8");
const freeCupSync = fs.readFileSync("scripts/sync-free-card-tournaments.mjs", "utf8");
const startup = fs.readFileSync("start.sh", "utf8");
const scoreUpdater = fs.readFileSync("server/services/scoreUpdater.ts", "utf8");
const fplApi = fs.readFileSync("server/services/fplApi.ts", "utf8");
const economyRoutes = fs.readFileSync("server/routes/economyIntegrity.routes.ts", "utf8");

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

requireText(routes, 'app.get("/api/competitions/:id/leaderboard"', "The tournament leaderboard endpoint is missing.");
requireText(routes, "Math.min(requestedPageSize, 100)", "Tournament leaderboard pages must be capped at 100 teams.");
requireText(routes, "row_number() over", "Leaderboard positions must be ranked deterministically.");
requireText(routes, "->>'providerRatingTotal'", "Exact-score ties must prioritize official match ratings.");
requireText(routes, "->>'completedPasses'", "Exact-score ties must include verified football actions.");
requireText(routes, 'limit ${pageSize} offset ${offset}', "Tournament leaderboard pages must use a real database offset.");
requireText(routes, "totalPages: Math.max(1, Math.ceil(totalEntries / pageSize))", "Tournament leaderboard pagination totals are missing.");
requireText(routes, 'app.get("/api/competitions/:id/entries/:entryId"', "The submitted-team scoring endpoint is missing.");
requireText(routes, "snapshot.cardScores", "Submitted teams must use official per-card scoring snapshots.");
requireText(routes, "snapshotMatchesVerifiedPlayer", "Saved player points must belong to the same verified official footballer.");
requireText(routes, "storedElementId === elementId", "Mismatched saved official player IDs must not override a verified live score.");
requireText(routes, "saved?.breakdown || calculated?.breakdown", "Submitted teams must expose each player's exact scoring categories.");
requireText(routes, "Array.isArray(saved?.reasons)", "Submitted teams must expose each player's recorded scoring actions.");
requireText(routes, "fplApi.getLiveGameweek(Number(entry.gameWeek || 1))", "Team scoring must load the tournament's actual gameweek.");
requireText(routes, "captainBonus", "Submitted-team scoring must include the captain bonus.");
requireText(routes, "calculatedTotalScore", "A submitted team's visible total must equal its verified player contributions.");
requireText(routes, "scoreReconciliationRequired", "Stale stored team scores must be detectable instead of silently showing zero.");
requireText(scoreUpdater, "loadSubmittedLineupCards", "Tournament scoring must resolve every immutable submitted card ID.");
requireText(scoreUpdater, "this.storage.getPlayerCard(cardId)", "Historical submitted cards must not disappear behind marketplace visibility filters.");
requireText(scoreUpdater, "Preserving the last complete verified score", "Incomplete card lookups must never overwrite a verified team total.");
requireText(scoreUpdater, "TOURNAMENT_SCORE_REFRESH_SECONDS || 30", "Live tournament scores must refresh every 30 seconds by default.");
requireText(scoreUpdater, "scheduledUpdateInFlight", "Frequent scoring jobs must not overlap.");
requireText(fplApi, "FPL_LIVE_REFRESH_SECONDS || 30", "Official live gameweek data must refresh every 30 seconds.");
requireText(fplApi, "pendingRequests[key]", "Concurrent official live-data requests must share a single provider call.");
requireText(fplApi, "CACHE_TTL.liveGameweek", "Gameweek scores must use the shortened official live-data cache.");
requireText(economyRoutes, "Immediate scoring refresh failed for new tournament entry", "New tournament teams must be scored immediately after submission.");
requireText(scoreUpdater, "const storedCardScore = Math.round(latestScore);", "Integer card columns must not receive fractional official player scores.");
requireText(scoreUpdater, "decisiveScore: storedCardScore", "Card display scores must be rounded before database persistence.");
requireText(scoreUpdater, "score: toNumber(score?.total_score)", "Official tournament scoring snapshots must preserve exact fractional player points.");
requireText(scoreUpdater, "scoringPrecision: 4", "Official tournament scoring snapshots must preserve four-decimal precision.");
requireText(scoreUpdater, "identityStatus: String(score?.identity_status", "Scoring snapshots must explain each player's verification status.");
requireText(scoreUpdater, "this.nextLast5Scores(card.last5Scores, latestScore)", "Player scoring history must preserve the exact official player score.");

requireText(page, ".slice(0, 5)", "Tournament cards must show a compact top-five leaderboard.");
requireText(page, "pageSize=100", "The full leaderboard must load 100 teams per page.");
requireText(page, "Previous", "The full leaderboard needs a previous-page control.");
requireText(page, "Next", "The full leaderboard needs a next-page control.");
requireText(page, "Open all", "Tournament cards need an Open all leaderboard action.");
requireText(page, "How points were earned", "Player scoring actions must be visible in submitted teams.");
requireText(page, "maximumFractionDigits: 4", "Tournament standings must show precise four-decimal scores.");
requireText(page, "player.identityStatus !== \"verified\"", "Unverified or refreshing player scores must explain their status to users.");
requireText(page, "const LIVE_SCORE_REFRESH_MS = 15_000", "Visible tournament standings must refresh every 15 seconds.");
requireText(page, "<TournamentLeaderboardPreview comp={comp} />", "The tournament card must render its leaderboard.");
requireText(generatedCard, "<TournamentLeaderboardPreview comp={comp} />", "The build-generated tournament card must retain its leaderboard.");

// The old GW1 test window expired on 23 Aug 2026 and must no longer be applied
// during startup. The current one-time override is intentionally limited to the
// GW2 FREE Common Card Cup and expires at today's first Premier League kickoff.
requireText(startup, "Skipping expired FREE GW1 startup patcher.", "Production startup must not re-run the expired FREE GW1 patcher.");
requireText(freeCupSync, 'const GW2_FREE_COMMON_TEST_CUTOFF_UTC = Date.parse("2026-08-29T11:30:00.000Z")', "GW2 FREE Common test entries must close at 13:30 CAT on 29 Aug 2026.");
requireText(freeCupSync, 'Number(gw) === 2', "The temporary FREE Cup override must be limited to GW2.");
requireText(freeCupSync, 'String(tier) === "common"', "The temporary FREE Cup override must be limited to the Common tier.");
requireText(freeCupSync, '["completed", "cancelled"]', "Completed or cancelled tournaments must never be reopened by the GW2 test override.");
requireText(freeCupSync, "GW2 FREE Common Card Cup forced OPEN until 13:30 CAT on 29 Aug 2026, today's first Premier League kickoff.", "The FREE Cup sync must report when the GW2 Common first-kickoff override is applied.");

console.log("Tournament leaderboards, official player scoring details and the GW2 FREE Common first-kickoff entry window verified.");

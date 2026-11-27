import "./verify-manual-open-live-scoring.mjs";
import fs from "node:fs";
import ts from "typescript";

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
const projection = fs.readFileSync("server/services/leaderboardProjection.ts", "utf8");
const matchRoutes = fs.readFileSync("server/routes/epl.routes.ts", "utf8");
const home = fs.readFileSync("client/src/components/dashboard/HomeMatchdayLive.tsx", "utf8");
requireText(routes, "${leaderboardRank} as rank", "Leaderboard must use shared ranking.");
requireText(matchRoutes, "${leaderboardRank} as rank", "Matchday must use the exact leaderboard ranking.");
requireText(matchRoutes, "${leaderboardTotal}::float", "Matchday must use the exact leaderboard total.");
requireText(home, "points(row.contribution)", "Home must use recorded contributions.");
requireText(home, "maximumFractionDigits:4", "Home must retain leaderboard precision.");
requireText(projection, "partition by ce.competition_id", "Ranking must be partitioned per competition.");
requireText(projection, "row_number() over", "Leaderboard positions must be ranked deterministically.");
requireText(projection, "->>'completedPasses'", "Exact-score ties must include verified football actions.");
requireText(routes, 'limit ${pageSize} offset ${offset}', "Tournament leaderboard pages must use a real database offset.");
requireText(routes, "totalPages: Math.max(1, Math.ceil(totalEntries / pageSize))", "Tournament leaderboard pagination totals are missing.");
requireText(routes, 'app.get("/api/competitions/:id/entries/:entryId"', "The submitted-team scoring endpoint is missing.");
requireText(routes, "snapshot.cardScores", "Submitted teams must use official per-card scoring snapshots.");
requireText(routes, "loadEnteredTeamContext(Number(entry.gameWeek || 0))", "Team scoring must load the tournament's actual gameweek through the shared read.");
requireText(routes, "coalesceConcurrentRead(async (gameWeek: number)", "Submitted-team provider reads must share only concurrent work.");
requireText(routes, "loadApiFootballGameweekScoringContext(gameWeek)", "The shared read must pass the tournament gameweek to API-Football.");
requireText(routes, "const { apiScoringContext, entryBootstrap, fixtureStatus } = await contextRead", "Submitted teams must await their shared provider read before resolving players.");
requireText(routes, "resolveApiFootballGameweekPlayer", "Submitted-team scoring must resolve the exact API-Football player and fixture.");
requireText(routes, 'identityProvider: "api-football"', "Submitted-team scoring must identify API-Football as the scoring provider.");
requireText(routes, "saved?.breakdown || calculated?.breakdown", "Submitted teams must expose each player's exact scoring categories.");
requireText(routes, "Array.isArray(saved?.reasons)", "Submitted teams must expose each player's recorded scoring actions.");
requireText(routes, "captainBonus", "Submitted-team scoring must include the captain bonus.");
requireText(routes, "calculatedTotalScore", "A submitted team's visible total must equal its verified player contributions.");
requireText(routes, "scoreReconciliationRequired", "Stale stored team scores must be detectable instead of silently showing zero.");
requireText(scoreUpdater, "loadSubmittedLineupCards", "Tournament scoring must resolve every immutable submitted card ID.");
requireText(scoreUpdater, "this.storage.getPlayerCard(cardId)", "Historical submitted cards must not disappear behind marketplace visibility filters.");
requireText(scoreUpdater, "Preserving the last complete verified score", "Incomplete card lookups must never overwrite a verified team total.");
requireText(scoreUpdater, "TOURNAMENT_SCORE_REFRESH_SECONDS || 30", "Live tournament scores must refresh every 30 seconds by default.");
requireText(scoreUpdater, "scheduledUpdateInFlight", "Frequent scoring jobs must not overlap.");
requireText(scoreUpdater, "loadApiFootballGameweekScoringContext", "Tournament point calculation must load API-Football player statistics.");
requireText(scoreUpdater, 'identity_provider: "api-football"', "Tournament point calculation must never label FPL as its player-stat source.");
if (scoreUpdater.includes("mapFplStatsToPlayerStats")) throw new Error("Tournament points must not use FPL player statistics.");
requireText(economyRoutes, "Immediate scoring refresh failed for new tournament entry", "New tournament teams must be scored immediately after submission.");
requireText(scoreUpdater, "const storedCardScore = Math.round(latestScore);", "Integer card columns must not receive fractional official player scores.");
requireText(scoreUpdater, "decisiveScore: storedCardScore", "Card display scores must be rounded before database persistence.");
requireText(scoreUpdater, "score: toNumber(score?.total_score)", "Official tournament scoring snapshots must preserve exact fractional player points.");
requireText(scoreUpdater, "scoringPrecision: 4", "Official tournament scoring snapshots must preserve four-decimal precision.");
requireText(scoreUpdater, "identityStatus: String(score?.identity_status", "Scoring snapshots must explain each player's verification status.");
requireText(scoreUpdater, "this.nextLast5Scores(card.last5Scores, latestScore)", "Player scoring history must preserve the exact official player score.");

requireText(page, "PLAY_TOURNAMENT_LEADERBOARD_25_V1", "Play tournament cards need the explicit leaderboard launcher.");
requireText(page, "View standings & scoring", "The Play leaderboard button must explain that standings and scoring are available.");
requireText(page, "pageSize=25", "The Play leaderboard must load 25 entries per page.");
requireText(page, "25 teams per page", "The leaderboard dialog must state the 25-team page size.");
requireText(page, "25 per page", "The tournament card leaderboard launcher must show the 25-team page size.");
requireText(page, "Previous", "The full leaderboard needs a previous-page control.");
requireText(page, "Next", "The full leaderboard needs a next-page control when more entries exist.");
requireText(page, "Showing ", "Leaderboard pagination must show the visible entry range.");
requireText(page, "player.contribution", "Leaderboard team rows must show the player's actual team contribution including captain effects.");
requireText(page, "How points were earned", "Player scoring actions must be visible in submitted teams.");
requireText(page, "maximumFractionDigits: 4", "Tournament standings must show precise four-decimal scores.");
requireText(page, "player.identityStatus !== \"verified\"", "Unverified or refreshing player scores must explain their status to users.");
requireText(page, "const LIVE_SCORE_REFRESH_MS = 15_000", "Visible tournament standings must refresh every 15 seconds.");
requireText(page, "<TournamentLeaderboardPreview comp={comp} />", "The tournament card must render its leaderboard launcher.");
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
requireText(freeCupSync, "CURRENT_TOURNAMENT_GAMEWEEK_POLICY_V1", "FREE Cup sync must use the current tournament gameweek boundary.");
requireText(freeCupSync, "for (let gw = currentGw; gw <= 38; gw += 1)", "FREE Cup sync must never recreate deleted past gameweeks.");
requireText(freeCupSync, "Deleted past FREE Card Cups are not recreated.", "FREE Cup sync must explicitly preserve admin deletion of past gameweeks.");

console.log("Play tournament leaderboard launcher, 25-team pagination, official player scoring details and the GW2 FREE Common first-kickoff entry window verified.");

if (routes.includes("providerRatingTotal")) throw new Error("Tournament leaderboard must not use API-Football match ratings.");

const contributionStart=matchRoutes.indexOf("          const isCaptain=");
const contributionEnd=matchRoutes.indexOf("\n        });",contributionStart);
if(contributionStart<0||contributionEnd<0)throw new Error("Missing canonical contribution projection");
const contribution=new Function("row","cardId","verifiedScore","score","snapshot","apiPlayerId","identity",matchRoutes.slice(contributionStart,contributionEnd));
for(const [row,cardId,verified,score,snapshot,want] of [
  [{captainId:1},1,true,{score:12.3456},{captainBonus:1.2346},13.5802],
  [{captainId:2},1,true,{score:12.3456},{captainBonus:1.2346},12.3456],
  [{captainId:1},1,true,{score:0},{captainBonus:0},0],
  [{captainId:1},1,false,{score:50},{captainBonus:5},null],
  [{captainId:1},1,true,{score:12},{},null],
  [{captainId:2},1,true,{score:-2.5},{},-2.5],
]){
  const result=contribution(row,cardId,verified,score,snapshot,123,{});
  if(result[0].contribution!==want)throw new Error("Home contribution mismatch: "+JSON.stringify({result,want}));
}
requireText(home,"entries.set(Number(entry.entryId),entry)","Home must deduplicate a tournament entry across simultaneous fixtures.");
requireText(home,"matchPlayers","Home must link submitted players to fixture statistics.");
requireText(fs.readFileSync("client/src/pages/dashboard.tsx","utf8"),"<HomeMatchdayLive","Web dashboard must include live home.");
requireText(fs.readFileSync("client/src/components/native/NativeHomePage.tsx","utf8"),"<HomeMatchdayLive","Native home must include live home.");
console.log("Home matchday canonical leaderboard projection and six contribution cases passed.");

const compileMatchdayModule=(path,dependencies={})=>{
  const code=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  new Function("exports","require",code)(exports,name=>{if(name in dependencies)return dependencies[name];throw new Error("Unexpected matchday import "+name);});
  return exports;
};
const fixtureDisplay=compileMatchdayModule("shared/fixture-display.ts");
const matchday=compileMatchdayModule("shared/home-matchday.ts",{"./fixture-display.js":fixtureDisplay});
const now=Date.parse("2026-11-28T15:00:00Z");
const row=(id,status,hour,extra={})=>({id,apiFixtureId:id,leagueId:39,status,kickoffTime:new Date(now+hour*3600000).toISOString(),updatedAt:new Date(now).toISOString(),...extra});
const live=row(1,"2H",-1),half=row(2,"HT",-1),ft=row(1,"FT",-3),next=row(3,"NS",4),soon=row(4,"NS",1),old=row(5,"FT",-25);
for(const [l,fi,u,healthy,want] of [
  [[live],[ft],[soon],true,"upcoming"],[[half],[ft],[soon],true,"live"],
  [[],[ft],[next],true,"recap"],[[],[ft],[soon],true,"upcoming"],
  [[],[old],[next],true,"upcoming"],[[],[old],[],true,"normal"],
  [[],[ft],[next],false,"unavailable"],[[row(9,"2H",-1,{elapsed:98})],[],[],true,"live"],
  [[row(1,"2H",-1,{updatedAt:new Date(now+1000).toISOString()})],[ft],[],true,"recap"],
  [[],[row(8,"PST",-2)],[],true,"normal"],[[],[row(8,"FT",-2,{leagueId:40})],[],true,"normal"]
]){
  const actual=matchday.selectHomeMatchday(l,fi,u,now,healthy).mode;
  if(actual!==want)throw new Error("Home mode mismatch "+actual+" != "+want);
}
if(matchday.homeApiFixtureId(row(1,"LIVE",-1,{intelligenceAvailable:false}))!==0)throw new Error("FPL fallback ID must not request personal scoring");
requireText(home,'points(row.contribution)',"Dynamic home must preserve exact saved contribution.");
requireText(home,'e.status==="completed"&&e.final&&e.complete',"Match completion must not imply prize settlement.");
console.log("Dynamic home fixture phases and safe identities verified.");

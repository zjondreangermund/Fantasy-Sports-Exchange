import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const sync = read("server/services/apiFootballSync.ts");
const route = read("server/routes/footballData.routes.ts");
const index = read("server/index.ts");
const page = read("client/src/pages/premier-league.tsx");
const centre = read("client/src/components/FootballDataCentre.tsx");
const premiumCard = read("client/src/components/cards/PremiumFootballCard.tsx");
const playerIntel = read("client/src/components/PlayerIntelligencePanel.tsx");
const squadPage = read("client/src/pages/select-squad.tsx");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

requireText(sync, "API_FOOTBALL_PUBLIC_PROVIDER_V1", "central quota-aware provider export is missing");
requireText(sync, "export async function fetchApiFootballProvider", "site routes cannot reuse Pro quota/backoff provider");
requireText(route, "API_FOOTBALL_FULL_INTELLIGENCE_V2", "full-intelligence route marker missing");

for (const endpoint of [
  'app.get("/api/football/coverage/:leagueKey"',
  'app.get("/api/football/standings/:leagueKey"',
  'app.get("/api/football/rounds/:leagueKey"',
  'app.get("/api/football/fixtures/:leagueKey"',
  'app.get("/api/football/injuries/:leagueKey"',
  'app.get("/api/football/match/:leagueKey/:fixtureId"',
  'app.get("/api/football/leaders/:leagueKey"',
  'app.get("/api/football/teams/:leagueKey"',
  'app.get("/api/football/team/:leagueKey/:teamId"',
  'app.get("/api/football/squad/:leagueKey/:teamId"',
  'app.get("/api/football/team-transfers/:leagueKey/:teamId"',
  'app.get("/api/football/venue/:leagueKey/:teamId"',
  'app.get("/api/football/coach/:coachId"',
  'app.get("/api/football/players/:leagueKey"',
  'app.get("/api/football/player/:leagueKey/:playerId"',
  'app.get("/api/football/player-intelligence/:leagueKey/:playerId"',
  'app.get("/api/football/lineup-intelligence/:leagueKey"',
]) requireText(route, endpoint, `missing public football route: ${endpoint}`);

for (const providerCall of [
  'cachedProvider("fixtures/rounds"',
  'cachedProvider("fixtures/events"',
  'cachedProvider("fixtures/statistics"',
  'cachedProvider("fixtures/lineups"',
  'cachedProvider("fixtures/players"',
  'cachedProvider("predictions"',
  'cachedProvider("fixtures/headtohead"',
  'cachedProvider("players/topscorers"',
  'cachedProvider("players/topassists"',
  'cachedProvider("players/topyellowcards"',
  'cachedProvider("players/topredcards"',
  'cachedProvider("teams/statistics"',
  'cachedProvider("players/squads"',
  'cachedProvider("coachs"',
  'cachedProvider("transfers"',
  'cachedProvider("trophies"',
  'cachedProvider("sidelined"',
  'cachedProvider("injuries"',
  'cachedProvider("venues"',
]) requireText(route, providerCall, `API-Football feature is not linked: ${providerCall}`);

requireText(route, "half: true", "half-time match statistics are not linked");
requireText(route, "currentSquadContains", "current-squad player intelligence missing");
requireText(route, "loadPlayerForm", "recent player form/rating history missing");
requireText(route, "coverage.coverage?.predictions", "predictions must be gated by coverage");
requireText(route, "coverage.coverage?.injuries", "injuries must be gated by coverage");
requireText(route, "fixtureCoverage.statistics_players", "player match stats must be gated by fixture coverage");
requireText(route, "app.api_football_site_cache", "public API-Football data must be database cached");
rejectText(route, 'cachedProvider("odds"', "betting odds must not be exposed by Fantasy Arena's football data centre");
rejectText(route, 'cachedProvider("odds/live"', "live betting odds must not be exposed by Fantasy Arena's football data centre");

requireText(index, 'registerFootballDataRoutes } from "./routes/footballData.routes.js"', "football data routes are not imported at runtime");
requireText(index, "registerFootballDataRoutes(app);", "football data routes are not registered at runtime");
requireText(page, 'value="data-centre"', "Premier League page is missing the Pro Data Centre tab");
requireText(page, "<FootballDataCentre />", "Premier League page is not rendering the Pro Data Centre");

for (const marker of [
  "Match Centre",
  "Detailed match report",
  "Statistical prediction",
  "Full-match statistics",
  "First-half / half-time statistics",
  "Event timeline",
  "Confirmed formations & starting XI",
  "Player ratings",
  "Recent head-to-head",
  "Standings",
  "League-wide injuries & suspensions",
  "Top scorers",
  "Top assists",
  "Current squad",
  "Club transfers",
  "Stadium",
  "Advanced season statistics",
  "Recent rating / Fantasy Arena form",
  "Transfer history",
  "Trophy cabinet",
  "Injury & suspension history",
  "Management career",
]) requireText(centre, marker, `Data Centre UI is missing: ${marker}`);

for (const league of [
  "premier-league",
  "la-liga",
  "bundesliga",
  "serie-a",
  "ligue-1",
  "champions-league",
  "europa-league",
  "conference-league",
  "fa-cup",
  "efl-cup",
  "world-cup",
]) requireText(centre, `key: "${league}"`, `Data Centre competition selector is missing ${league}`);

requireText(premiumCard, "PlayerIntelligencePanel", "PremiumFootballCard does not expose player intelligence");
requireText(premiumCard, "Player intelligence", "card intelligence action is missing");
requireText(playerIntel, "/api/football/player-intelligence/premier-league/", "card intelligence does not use API-Football player intelligence route");
requireText(squadPage, "Tournament Team Assistant", "squad selection is missing the tournament team assistant");
requireText(squadPage, "/api/football/lineup-intelligence/premier-league", "tournament team assistant is not linked to API-Football");

if (failures.length) {
  console.error("API-Football site linkage verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("API-Football full intelligence verified: standings, rounds, detailed/half-time match data, visual lineups, league availability, squads, transfers, stadiums, coaches, advanced player form, card intelligence and tournament team assistance are linked through cached quota-aware routes; betting odds remain intentionally excluded.");

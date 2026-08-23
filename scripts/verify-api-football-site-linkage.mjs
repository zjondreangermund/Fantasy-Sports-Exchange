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
const sidebar = read("client/src/components/app-sidebar.tsx");
const liveDock = read("client/src/components/LivePulseDock.tsx");
const routeScene = read("client/src/components/RouteSceneBackground.tsx");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

requireText(sync, "API_FOOTBALL_PUBLIC_PROVIDER_V1", "central quota-aware provider export is missing");
requireText(sync, "export async function fetchApiFootballProvider", "site routes cannot reuse Pro quota/backoff provider");
requireText(route, "API_FOOTBALL_PREMIER_LEAGUE_ONLY_V3", "Premier League-only route marker missing");
requireText(route, 'export type FootballLeagueKey = "premier-league";', "football routes are not locked to Premier League");
requireText(route, '"premier-league": { id: 39, name: "Premier League"', "Premier League API-Football league mapping is missing");

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
requireText(route, "API_FOOTBALL_STALE_CACHE_FALLBACK_V1", "expired API-Football cache is not retained during provider failures");
requireText(route, "FPL_LIVE_FIXTURE_FALLBACK_V1", "Premier League live fixtures do not have an official FPL fallback");
requireText(route, "app.api_football_fixtures", "saved API-Football fixture identities are not available to the live fallback");
requireText(route, "fplApi.getLiveGames()", "live Match Centre does not share the header's official Premier League feed");
requireText(route, "fallbackPremierLeagueMatch", "fallback live fixtures cannot open a match report");
rejectText(route, 'cachedProvider("odds"', "betting odds must not be exposed by Fantasy Arena's football data centre");
rejectText(route, 'cachedProvider("odds/live"', "live betting odds must not be exposed by Fantasy Arena's football data centre");

for (const forbidden of [
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
]) {
  rejectText(route, `\"${forbidden}\"`, `non-Premier-League backend mapping remains: ${forbidden}`);
  rejectText(centre, `\"${forbidden}\"`, `non-Premier-League UI option remains: ${forbidden}`);
}

requireText(index, 'registerFootballDataRoutes } from "./routes/footballData.routes.js"', "football data routes are not imported at runtime");
requireText(index, "registerFootballDataRoutes(app);", "football data routes are not registered at runtime");
requireText(page, 'value="data-centre"', "Premier League page is missing the Pro Data Centre tab");
requireText(page, "<FootballDataCentre />", "Premier League page is not rendering the Pro Data Centre");
requireText(page, "Premier League", "Premier League page title is missing");
rejectText(page, "Top 5 Leagues", "old Top 5 Leagues title remains on Premier League page");
rejectText(page, '"la-liga"', "Premier League page still carries other league state");

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
]) requireText(centre, marker, `Premier League Data Centre UI is missing: ${marker}`);

requireText(centre, 'type LeagueKey = "premier-league";', "Data Centre is not locked to Premier League");
requireText(centre, '{ key: "premier-league", name: "Premier League"', "Premier League Data Centre selector/config is missing");
requireText(centre, "fixtures.isError", "Match Centre hides football-provider errors as empty fixture lists");
requireText(centre, "Official Premier League backup feed active", "Match Centre does not explain when the FPL backup feed is being used");
requireText(centre, "Live match feed unavailable", "Match Centre does not explain an unavailable live feed");
requireText(sidebar, '{ title: "Premier League", href: "/premier-league"', "sidebar still labels the page generically as Leagues");
requireText(liveDock, '>Premier League</Button>', "live dock still labels the route as Live Leagues");
requireText(routeScene, 'label: "PREMIER LEAGUE"', "Premier League route scene still uses multi-league wording");

requireText(premiumCard, "PlayerIntelligencePanel", "PremiumFootballCard does not expose player intelligence");
requireText(premiumCard, "Player intelligence", "card intelligence action is missing");
requireText(playerIntel, "/api/football/player-intelligence/premier-league/", "card intelligence does not use Premier League API-Football player intelligence route");
requireText(squadPage, "Tournament Team Assistant", "squad selection is missing the tournament team assistant");
requireText(squadPage, "/api/football/lineup-intelligence/premier-league", "tournament team assistant is not linked to Premier League API-Football");

if (failures.length) {
  console.error("API-Football Premier League-only linkage verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("API-Football Premier League-only intelligence verified: standings, rounds, match/half-time data, lineups, injuries, squads, transfers, stadiums, coaches, advanced player form, card intelligence and tournament team assistance remain available for EPL only; other leagues/cups and betting odds are excluded.");

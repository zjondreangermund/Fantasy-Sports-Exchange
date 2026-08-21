import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const sync = read("server/services/apiFootballSync.ts");
const route = read("server/routes/footballData.routes.ts");
const index = read("server/index.ts");
const page = read("client/src/pages/premier-league.tsx");
const centre = read("client/src/components/FootballDataCentre.tsx");

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const rejectText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

requireText(sync, "API_FOOTBALL_PUBLIC_PROVIDER_V1", "central quota-aware provider export is missing");
requireText(sync, "export async function fetchApiFootballProvider", "site routes cannot reuse Pro quota/backoff provider");

for (const endpoint of [
  'app.get("/api/football/coverage/:leagueKey"',
  'app.get("/api/football/standings/:leagueKey"',
  'app.get("/api/football/fixtures/:leagueKey"',
  'app.get("/api/football/match/:leagueKey/:fixtureId"',
  'app.get("/api/football/leaders/:leagueKey"',
  'app.get("/api/football/teams/:leagueKey"',
  'app.get("/api/football/team/:leagueKey/:teamId"',
  'app.get("/api/football/players/:leagueKey"',
  'app.get("/api/football/player/:leagueKey/:playerId"',
]) requireText(route, endpoint, `missing public football route: ${endpoint}`);

for (const providerCall of [
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
  'cachedProvider("coachs"',
  'cachedProvider("transfers"',
  'cachedProvider("trophies"',
  'cachedProvider("sidelined"',
]) requireText(route, providerCall, `API-Football feature is not linked: ${providerCall}`);

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

for (const marker of ["Match Centre", "Statistical prediction", "Event timeline", "Confirmed lineups", "Player ratings", "Recent head-to-head", "Top scorers", "Top assists", "Transfer history", "Trophy cabinet", "Injury & suspension history", "Coach"]) {
  requireText(centre, marker, `Data Centre UI is missing: ${marker}`);
}
for (const league of ["premier-league", "la-liga", "bundesliga", "serie-a", "ligue-1"]) {
  requireText(centre, `key: "${league}"`, `Data Centre league selector is missing ${league}`);
}

if (failures.length) {
  console.error("API-Football site linkage verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("API-Football site linkage verified: coverage-aware match events/stats/lineups/ratings/predictions/H2H, leaderboards, clubs/coaches, and player transfers/trophies/sidelined are available through cached quota-aware routes and the public Pro Data Centre; odds remain intentionally excluded.");

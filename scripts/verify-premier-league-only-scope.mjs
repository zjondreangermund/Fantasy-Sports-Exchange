#!/usr/bin/env node
import fs from "node:fs";

const files = {
  route: fs.readFileSync("server/routes/footballData.routes.ts", "utf8"),
  sync: fs.readFileSync("server/services/apiFootballSync.ts", "utf8"),
  scoring: fs.readFileSync("server/services/apiFootballScoringBridge.ts", "utf8"),
  admin: fs.readFileSync("server/routes/apiFootballAdmin.routes.ts", "utf8"),
  centre: fs.readFileSync("client/src/components/FootballDataCentre.tsx", "utf8"),
  page: fs.readFileSync("client/src/pages/premier-league.tsx", "utf8"),
  app: fs.readFileSync("client/src/App.tsx", "utf8"),
  sidebar: fs.readFileSync("client/src/components/app-sidebar.tsx", "utf8"),
};

const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`Missing ${label}: ${text}`); };
const rejectText = (source, text, label) => { if (source.includes(text)) failures.push(`Unexpected ${label}: ${text}`); };

requireText(files.route, 'export type FootballLeagueKey = "premier-league";', "Premier League-only route type");
requireText(files.route, 'id: 39, name: "Premier League"', "Premier League API-Football mapping");
requireText(files.sync, "const LEAGUE_ID = 39; // Premier League only", "Premier League sync lock");
requireText(files.scoring, "const LEAGUE_ID = 39; // Premier League only", "Premier League scoring lock");
requireText(files.admin, "leagueId: 39, // Premier League only", "Premier League admin lock");
requireText(files.centre, 'type LeagueKey = "premier-league";', "Premier League-only Data Centre");
requireText(files.page, 'const leagueKey = "premier-league" as const;', "Premier League-only page state");
requireText(files.sidebar, '{ title: "Premier League", href: "/premier-league"', "Premier League navigation label");
rejectText(files.app, '<Route path="/leagues" component={PremierLeaguePage} />', "legacy multi-league route alias");

for (const forbidden of ["la-liga", "bundesliga", "serie-a", "ligue-1", "champions-league", "europa-league", "conference-league", "fa-cup", "efl-cup", "world-cup"]) {
  rejectText(files.route, `\"${forbidden}\"`, `non-EPL backend competition ${forbidden}`);
  rejectText(files.centre, `\"${forbidden}\"`, `non-EPL Data Centre competition ${forbidden}`);
  rejectText(files.page, `\"${forbidden}\"`, `non-EPL page state ${forbidden}`);
}

if (failures.length) {
  console.error("Premier League-only scope verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Premier League-only scope verified across API sync, scoring, admin tools, public routes and navigation.");

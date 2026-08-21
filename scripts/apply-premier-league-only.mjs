#!/usr/bin/env node
import fs from "node:fs";

const replacements = [
  {
    file: "server/routes/footballData.routes.ts",
    from: `// API_FOOTBALL_FULL_INTELLIGENCE_V2\nexport type FootballLeagueKey =\n  | "premier-league"\n  | "la-liga"\n  | "bundesliga"\n  | "serie-a"\n  | "ligue-1"\n  | "champions-league"\n  | "europa-league"\n  | "conference-league"\n  | "fa-cup"\n  | "efl-cup"\n  | "world-cup";\n\ntype LeagueConfig = {\n  id: number;\n  name: string;\n  country: string;\n  kind: "league" | "cup" | "international";\n  group: "domestic" | "europe" | "international";\n};\n\nconst FOOTBALL_LEAGUES: Record<FootballLeagueKey, LeagueConfig> = {\n  "premier-league": { id: 39, name: "Premier League", country: "England", kind: "league", group: "domestic" },\n  "la-liga": { id: 140, name: "La Liga", country: "Spain", kind: "league", group: "domestic" },\n  "bundesliga": { id: 78, name: "Bundesliga", country: "Germany", kind: "league", group: "domestic" },\n  "serie-a": { id: 135, name: "Serie A", country: "Italy", kind: "league", group: "domestic" },\n  "ligue-1": { id: 61, name: "Ligue 1", country: "France", kind: "league", group: "domestic" },\n  "champions-league": { id: 2, name: "UEFA Champions League", country: "Europe", kind: "cup", group: "europe" },\n  "europa-league": { id: 3, name: "UEFA Europa League", country: "Europe", kind: "cup", group: "europe" },\n  "conference-league": { id: 848, name: "UEFA Conference League", country: "Europe", kind: "cup", group: "europe" },\n  "fa-cup": { id: 45, name: "FA Cup", country: "England", kind: "cup", group: "domestic" },\n  "efl-cup": { id: 48, name: "EFL Cup", country: "England", kind: "cup", group: "domestic" },\n  "world-cup": { id: 1, name: "FIFA World Cup", country: "World", kind: "international", group: "international" },\n};`,
    to: `// API_FOOTBALL_PREMIER_LEAGUE_ONLY_V3\nexport type FootballLeagueKey = "premier-league";\n\ntype LeagueConfig = {\n  id: 39;\n  name: "Premier League";\n  country: "England";\n  kind: "league";\n  group: "domestic";\n};\n\nconst FOOTBALL_LEAGUES: Record<FootballLeagueKey, LeagueConfig> = {\n  "premier-league": { id: 39, name: "Premier League", country: "England", kind: "league", group: "domestic" },\n};`,
  },
  {
    file: "client/src/components/FootballDataCentre.tsx",
    from: `// API_FOOTBALL_DATA_CENTRE_V2_FULL_INTELLIGENCE\ntype LeagueKey =\n  | "premier-league"\n  | "la-liga"\n  | "bundesliga"\n  | "serie-a"\n  | "ligue-1"\n  | "champions-league"\n  | "europa-league"\n  | "conference-league"\n  | "fa-cup"\n  | "efl-cup"\n  | "world-cup";\n\nconst COMPETITIONS: Array<{ key: LeagueKey; name: string; group: string }> = [\n  { key: "premier-league", name: "Premier League", group: "Leagues" },\n  { key: "la-liga", name: "La Liga", group: "Leagues" },\n  { key: "bundesliga", name: "Bundesliga", group: "Leagues" },\n  { key: "serie-a", name: "Serie A", group: "Leagues" },\n  { key: "ligue-1", name: "Ligue 1", group: "Leagues" },\n  { key: "champions-league", name: "Champions League", group: "Europe" },\n  { key: "europa-league", name: "Europa League", group: "Europe" },\n  { key: "conference-league", name: "Conference League", group: "Europe" },\n  { key: "fa-cup", name: "FA Cup", group: "Cups" },\n  { key: "efl-cup", name: "EFL Cup", group: "Cups" },\n  { key: "world-cup", name: "World Cup", group: "International" },\n];`,
    to: `// API_FOOTBALL_DATA_CENTRE_V3_PREMIER_LEAGUE_ONLY\ntype LeagueKey = "premier-league";\n\nconst COMPETITIONS: Array<{ key: LeagueKey; name: string; group: string }> = [\n  { key: "premier-league", name: "Premier League", group: "Premier League" },\n];`,
  },
  {
    file: "client/src/pages/premier-league.tsx",
    from: `  const [leagueKey, setLeagueKey] = useState<"premier-league" | "la-liga" | "bundesliga" | "serie-a" | "ligue-1">("premier-league");`,
    to: `  const leagueKey = "premier-league" as const;`,
  },
  {
    file: "client/src/pages/premier-league.tsx",
    from: `                Top 5 Leagues`,
    to: `                Premier League`,
  },
  {
    file: "client/src/components/app-sidebar.tsx",
    from: `{ title: "Leagues", href: "/premier-league", icon: Activity, section: "Main" }`,
    to: `{ title: "Premier League", href: "/premier-league", icon: Activity, section: "Main" }`,
  },
  {
    file: "client/src/components/LivePulseDock.tsx",
    from: `>Live Leagues</Button>`,
    to: `>Premier League</Button>`,
  },
  {
    file: "client/src/components/RouteSceneBackground.tsx",
    from: `label: "LIVE LEAGUES"`,
    to: `label: "PREMIER LEAGUE"`,
  },
  {
    file: "client/src/components/PageScene.tsx",
    from: `premierLeague: { eyebrow: "LIVE LEAGUES", title: "Premier League hub", subtitle: "Standings, clubs and match context", statA: "EPL", statB: "FORM" }`,
    to: `premierLeague: { eyebrow: "PREMIER LEAGUE", title: "Premier League hub", subtitle: "Standings, clubs and match context", statA: "EPL", statB: "FORM" }`,
  },
  {
    file: "client/src/lib/manager-hub-config.ts",
    from: `  leagues: "Leagues",`,
    to: `  leagues: "Premier League",`,
  },
];

for (const { file, from, to } of replacements) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes(to)) continue;
  if (!source.includes(from)) throw new Error(`Expected multi-league block not found in ${file}`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
  console.log(`Restricted ${file} to Premier League data only.`);
}

console.log("Premier League-only API-Football scope applied across routes, data centre and navigation.");

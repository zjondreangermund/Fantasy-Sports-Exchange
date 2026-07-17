import fs from "node:fs";

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No changes applied to ${path}`);
  fs.writeFileSync(path, after);
}

patch("server/index.ts", (source) => {
  source = source.replace(/const fallbackFixtures = \[[\s\S]*?\];\n\n/, "");
  source = source.replace(
    'function normalizeSportsDbEvent(event: any) { return { id: event?.idEvent || `${event?.strHomeTeam}-${event?.strAwayTeam}-${event?.dateEvent}`, date: event?.strTimestamp || `${event?.dateEvent || ""}T${event?.strTime || "15:00:00"}Z`, status: event?.intHomeScore || event?.intAwayScore ? "FT" : "NS", venue: event?.strVenue || "", homeTeam: { name: event?.strHomeTeam || "TBD", badge: event?.strHomeTeamBadge || "", score: event?.intHomeScore ?? null }, awayTeam: { name: event?.strAwayTeam || "TBD", badge: event?.strAwayTeamBadge || "", score: event?.intAwayScore ?? null } }; }',
    'function normalizeSportsDbEvent(event: any) { const hasScore = event?.intHomeScore !== null && event?.intHomeScore !== undefined && event?.intAwayScore !== null && event?.intAwayScore !== undefined; const rawStatus = String(event?.strStatus || event?.strProgress || "").toUpperCase(); const finished = hasScore || ["FT", "AET", "PEN", "MATCH FINISHED"].includes(rawStatus); return { id: event?.idEvent || `${event?.strHomeTeam}-${event?.strAwayTeam}-${event?.dateEvent}`, date: event?.strTimestamp || `${event?.dateEvent || ""}T${event?.strTime || "15:00:00"}Z`, status: finished ? "FT" : rawStatus || "NS", venue: event?.strVenue || "", homeTeam: { name: event?.strHomeTeam || "TBD", badge: event?.strHomeTeamBadge || "", score: event?.intHomeScore ?? null }, awayTeam: { name: event?.strAwayTeam || "TBD", badge: event?.strAwayTeamBadge || "", score: event?.intAwayScore ?? null } }; }',
  );
  source = source.replace(
    'const result: any = { updatedAt: new Date().toISOString(), source: "TheSportsDB + Guardian RSS", liveGames: [], nextFixtures: fallbackFixtures, news: [] };',
    'const result: any = { updatedAt: new Date().toISOString(), source: "TheSportsDB + Guardian RSS", liveGames: [], nextFixtures: [], news: [], fixturesAvailable: false };',
  );
  source = source.replace(
    'if (events.length) result.nextFixtures = events.slice(0, 10).map(normalizeSportsDbEvent);',
    'if (events.length) { result.nextFixtures = events.slice(0, 10).map(normalizeSportsDbEvent); result.fixturesAvailable = true; }',
  );
  source = source.replace('console.warn("Matchday fixtures fallback used:", error);', 'console.warn("Matchday fixtures unavailable:", error);');
  source = source.replace(
    'app.post("/api/admin/sync-fpl-players", async (_req, res) => {',
    'app.post("/api/admin/sync-fpl-players", requireAuth, isAdmin, async (_req, res) => {',
  );
  return source;
});

patch("client/src/App.tsx", (source) => {
  source = source.replace(
    '        <Route path="/premier-league" component={PremierLeaguePage} />',
    '        <Route path="/premier-league" component={PremierLeaguePage} />\n        <Route path="/leagues" component={PremierLeaguePage} />',
  );
  source = source.replace(
    '        <Route path="/account" component={AccountPage} />',
    '        <Route path="/account" component={AccountPage} />\n        <Route path="/profile" component={AccountPage} />',
  );
  return source;
});

console.log("Applied route, security, match-state, and fallback-data corrections.");

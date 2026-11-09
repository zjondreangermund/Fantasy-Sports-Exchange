import { normalizeFootballData, uniqueFootballRows, footballFixtureKey } from "../../shared/football-data.js";
import type { Express } from "express";
import { fplApi } from "../services/fplApi.js";
import { buildGameweekFixtureStatus } from "../services/gameweekPlayerFixtures.js";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

function teamLookup(bootstrap: any): Map<number, any> {
  const teams: any[] = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  return new Map<number, any>(teams.map((team: any) => [Number(team.id), team]));
}

function normalizeFixture(fixture: any, teams: Map<number, any>) {
  const home = teams.get(Number(fixture.team_h));
  const away = teams.get(Number(fixture.team_a));
  const homeName = home?.name || `Team ${fixture.team_h}`;
  const awayName = away?.name || `Team ${fixture.team_a}`;
  const matchDate = fixture.kickoff_time || null;
  const elapsed = Number(fixture.minutes || 0);
  return {
    id: fixture.id,
    event: fixture.event,
    gameweek: fixture.event,
    round: fixture.event ? `Gameweek ${fixture.event}` : "Premier League",
    matchDate, date: matchDate, kickoffTime: matchDate,
    status: fixture.finished ? "FT" : fixture.started ? "LIVE" : "NS",
    started: Boolean(fixture.started), finished: Boolean(fixture.finished),
    elapsed, minutes: elapsed, venue: fixture.venue?.name || "",
    homeTeam: homeName, awayTeam: awayName,
    homeTeamLogo: home?.logo || "", awayTeamLogo: away?.logo || "",
    homeGoals: fixture.team_h_score ?? null, awayGoals: fixture.team_a_score ?? null,
    home: { id: fixture.team_h, name: homeName, shortName: home?.short_name || `T${fixture.team_h}`, score: fixture.team_h_score },
    away: { id: fixture.team_a, name: awayName, shortName: away?.short_name || `T${fixture.team_a}`, score: fixture.team_a_score },
  };
}

function buildStandingsFromFixtures(fixtures: any[], bootstrap: any) {
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const table = new Map<number, any>();
  for (const team of teams) {
    table.set(Number(team.id), {
      id: Number(team.id),
      teamId: Number(team.id),
      position: 0,
      team: team.name,
      teamName: team.name,
      shortName: team.short_name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const fixture of uniqueFootballRows(fixtures,footballFixtureKey)) {
    if (!fixture?.finished) continue;
    const home = table.get(Number(fixture.team_h));
    const away = table.get(Number(fixture.team_a));
    if (!home || !away) continue;
    const hs = Number(fixture.team_h_score || 0);
    const as = Number(fixture.team_a_score || 0);
    home.played++; away.played++;
    home.goalsFor += hs; home.goalsAgainst += as;
    away.goalsFor += as; away.goalsAgainst += hs;
    if (hs > as) { home.won++; home.points += 3; away.lost++; }
    else if (as > hs) { away.won++; away.points += 3; home.lost++; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }

  return Array.from(table.values()).map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || String(a.teamName).localeCompare(String(b.teamName)))
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function normalizePlayer(player: any, teamById: Map<number, any>) {
  const team = teamById.get(Number(player.team));
  const positionMap: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
  return {
    id: player.id,
    externalId: player.id,
    fplId: player.id,
    name: `${player.first_name || ""} ${player.second_name || ""}`.trim() || player.web_name,
    webName: player.web_name,
    team: team?.name || player.team,
    teamShortName: team?.short_name || "",
    position: positionMap[Number(player.element_type)] || "MID",
    goals: Number(player.goals_scored || 0),
    assists: Number(player.assists || 0),
    appearances: Number(player.starts || 0),
    minutes: Number(player.minutes || 0),
    rating: Number(player.form || 0),
    totalPoints: Number(player.total_points || 0),
    form: Number(player.form || 0),
    nowCost: Number(player.now_cost || 0) / 10,
    selectedByPercent: Number(player.selected_by_percent || 0),
    status: player.status,
    news: player.news || "",
    imageUrl: fplApi.playerPhotoUrl(player, 250),
  };
}

export function registerEplRoutes(app: Express, deps: { requireAuth: any; scoreUpdater?: any }) {

  // Public, read-only list of verified API-Football Premier League player IDs.
  // Contains only already-public football metadata, never account/card records.
  // A separate GitHub Actions batch processor uses this as its authoritative
  // source for opt-in background-removed portraits.
  app.get("/api/leagues/premier-league/cutout-portrait-sources", async (_req, res) => {
    try {
      const result: any = await db.execute(sql`
        select distinct on (api_player_id)
          api_player_id as id, name, team_name as team, season
        from app.api_football_players
        where active = true and api_player_id > 0
          and season = (
            select max(season) from app.api_football_players where active = true
          )
        order by api_player_id, updated_at desc
      `);
      const rows: any[] = Array.isArray(result?.rows) ? result.rows : [];
      const players = rows
        .map((row) => ({
          id: Number(row.id),
          name: String(row.name || ""),
          team: String(row.team || ""),
        }))
        .filter((row) => Number.isInteger(row.id) && row.id > 0);
      if (!players.length) return res.status(503).json({ message: "Verified Premier League squad feed not yet available" });
      res.setHeader("Cache-Control", "public, max-age=900");
      return res.json({ provider: "api-football", season: Number(rows[0]?.season || 0), count: players.length, players });
    } catch (error) {
      console.error("[portrait-cutouts] Player source feed unavailable:", error);
      return res.status(503).json({ message: "Player photo source temporarily unavailable" });
    }
  });


  app.use("/api/epl", (_req, res, next) => {
    const sendJson=res.json.bind(res);
    res.json=(payload:any)=>sendJson(normalizeFootballData(payload));
    next();
  });
  app.post("/api/epl/sync", deps.requireAuth, async (_req: any, res) => {
    try {
      const [bootstrap, fixtures, liveGames, injuries] = await Promise.all([
        fplApi.bootstrap(),
        fplApi.fixturesLive(),
        fplApi.getLiveGames(),
        fplApi.getInjuries(),
      ]);
      await deps.scoreUpdater?.updateAllActiveCompetitions?.();
      return res.json({
        success: true,
        message: "Premier League 2026/27 data refreshed",
        counts: {
          teams: Array.isArray(bootstrap?.teams) ? bootstrap.teams.length : 0,
          players: Array.isArray(bootstrap?.elements) ? bootstrap.elements.length : 0,
          fixtures: Array.isArray(fixtures) ? fixtures.length : 0,
          liveGames: Array.isArray(liveGames) ? liveGames.length : 0,
          injuries: Array.isArray(injuries) ? injuries.length : 0,
        },
      });
    } catch (error: any) {
      console.error("Premier League sync failed:", error);
      return res.status(500).json({ message: error?.message || "Premier League sync failed" });
    }
  });

  app.get("/api/epl/standings", async (_req, res) => {
    try {
      const [fixtures, bootstrap] = await Promise.all([fplApi.fixturesLive(), fplApi.bootstrap()]);
      return res.json({ standings: buildStandingsFromFixtures(fixtures, bootstrap) });
    } catch (error: any) {
      console.error("Failed to load EPL standings:", error);
      return res.status(500).json({ message: error?.message || "Failed to load standings" });
    }
  });

  // Original gameweek fixtures, postponed matches and per-team lineup notices.
  // Read-only with 2-minute client caching; no per-player provider requests.
  app.get("/api/epl/gameweek-status/:gameWeek", async (req, res) => {
    const gameWeek = Number(req.params.gameWeek);
    if (!Number.isInteger(gameWeek) || gameWeek < 1 || gameWeek > 38)
      return res.status(400).json({ message: "Valid gameweek required" });
    try {
      const [fixtures, bootstrap] = await Promise.all([fplApi.fixturesLive(), fplApi.bootstrap()]);
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=60");
      return res.json(buildGameweekFixtureStatus(fixtures, bootstrap, gameWeek));
    } catch (error) {
      console.warn("[gw-fixtures] Provider not available:", error);
      return res.status(503).json({ available: false, gameWeek, message: "Fixture schedule unavailable; do not assume a match is postponed." });
    }
  });

  app.get("/api/epl/fixtures", async (req, res) => {
    try {
      const status = String(req.query.status || "upcoming");
      const gameweek = req.query.gameweek ? Number(req.query.gameweek) : await fplApi.getCurrentGameweek();
      const [fixtures, bootstrap] = await Promise.all([fplApi.fixturesLive(), fplApi.bootstrap()]);
      const teams = teamLookup(bootstrap);
      let list = fixtures.filter((fixture: any) => Number(fixture.event) === Number(gameweek));
      if (status === "upcoming") list = list.filter((fixture: any) => !fixture.started);
      if (status === "live") list = list.filter((fixture: any) => fixture.started && !fixture.finished);
      if (status === "completed" || status === "finished") list = list.filter((fixture: any) => fixture.finished);
      return res.json({ fixtures: list.map((fixture: any) => normalizeFixture(fixture, teams)) });
    } catch (error: any) {
      console.error("Failed to load EPL fixtures:", error);
      return res.status(500).json({ message: error?.message || "Failed to load fixtures" });
    }
  });

  app.get("/api/epl/live-games", async (_req, res) => {
    try {
      return res.json({ liveGames: await fplApi.getLiveGames() });
    } catch (error: any) {
      console.error("Failed to load live games:", error);
      return res.status(500).json({ message: error?.message || "Failed to load live games" });
    }
  });

  app.get("/api/epl/injuries", async (_req, res) => {
    try {
      return res.json({ injuries: await fplApi.getInjuries() });
    } catch (error: any) {
      console.error("Failed to load injuries:", error);
      return res.status(500).json({ message: error?.message || "Failed to load injuries" });
    }
  });

  app.get("/api/leagues/premier-league/players", async (req, res) => {
    try {
      const bootstrap = await fplApi.bootstrap();
      const teams = teamLookup(bootstrap);
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
      const search = String(req.query.search || "").toLowerCase().trim();
      const position = String(req.query.position || "").toUpperCase().trim();
      let players = (Array.isArray(bootstrap?.elements) ? bootstrap.elements : []).map((player: any) => normalizePlayer(player, teams));
      if (search) players = players.filter((player: any) => String(player.name || "").toLowerCase().includes(search) || String(player.webName || "").toLowerCase().includes(search));
      if (position) players = players.filter((player: any) => String(player.position || "").toUpperCase() === position);
      return res.json({ players: players.slice((page - 1) * limit, page * limit), total: players.length, page, limit });
    } catch (error: any) {
      console.error("Failed to load EPL players:", error);
      return res.status(500).json({ message: error?.message || "Failed to load players" });
    }
  });
}

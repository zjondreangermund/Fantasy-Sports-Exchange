import type { Express } from "express";
import { fplApi } from "../services/fplApi.js";

function teamLookup(bootstrap: any) {
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  return new Map(teams.map((team: any) => [Number(team.id), team]));
}

function normalizeFixture(fixture: any, teams: Map<number, any>) {
  const home = teams.get(Number(fixture.team_h));
  const away = teams.get(Number(fixture.team_a));
  return {
    id: fixture.id,
    event: fixture.event,
    gameweek: fixture.event,
    date: fixture.kickoff_time,
    kickoffTime: fixture.kickoff_time,
    status: fixture.finished ? "FT" : fixture.started ? "LIVE" : "NS",
    started: Boolean(fixture.started),
    finished: Boolean(fixture.finished),
    minutes: Number(fixture.minutes || 0),
    homeTeam: {
      id: fixture.team_h,
      name: home?.name || `Team ${fixture.team_h}`,
      shortName: home?.short_name || `T${fixture.team_h}`,
      score: fixture.team_h_score,
    },
    awayTeam: {
      id: fixture.team_a,
      name: away?.name || `Team ${fixture.team_a}`,
      shortName: away?.short_name || `T${fixture.team_a}`,
      score: fixture.team_a_score,
    },
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

  for (const fixture of fixtures) {
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

  app.get("/api/epl/fixtures", async (req, res) => {
    try {
      const status = String(req.query.status || "upcoming");
      const gameweek = req.query.gameweek ? Number(req.query.gameweek) : await fplApi.getCurrentGameweek();
      const [fixtures, bootstrap] = await Promise.all([fplApi.fixturesLive(), fplApi.bootstrap()]);
      const teams = teamLookup(bootstrap);
      let list = fixtures.filter((fixture: any) => Number(fixture.event) === Number(gameweek));
      if (status === "upcoming") list = list.filter((fixture: any) => !fixture.started);
      if (status === "live") list = list.filter((fixture: any) => fixture.started && !fixture.finished);
      if (status === "completed") list = list.filter((fixture: any) => fixture.finished);
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

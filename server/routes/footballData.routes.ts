import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fetchApiFootballProvider } from "../services/apiFootballSync.js";

// API_FOOTBALL_SITE_DATA_V1
export type FootballLeagueKey = "premier-league" | "la-liga" | "bundesliga" | "serie-a" | "ligue-1";

type LeagueConfig = { id: number; name: string; country: string };

const FOOTBALL_LEAGUES: Record<FootballLeagueKey, LeagueConfig> = {
  "premier-league": { id: 39, name: "Premier League", country: "England" },
  "la-liga": { id: 140, name: "La Liga", country: "Spain" },
  "bundesliga": { id: 78, name: "Bundesliga", country: "Germany" },
  "serie-a": { id: 135, name: "Serie A", country: "Italy" },
  "ligue-1": { id: 61, name: "Ligue 1", country: "France" },
};

let cacheSchemaPromise: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function currentSeason() {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function leagueFor(raw: unknown): { key: FootballLeagueKey; config: LeagueConfig } | null {
  const key = String(raw || "premier-league") as FootballLeagueKey;
  const config = FOOTBALL_LEAGUES[key];
  return config ? { key, config } : null;
}

function stableCacheKey(path: string, params: Record<string, string | number | boolean | undefined>) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  return `${path}?${query}`;
}

async function ensureSiteCacheSchema() {
  if (!cacheSchemaPromise) {
    cacheSchemaPromise = (async () => {
      await db.execute(sql`create schema if not exists app`);
      await db.execute(sql`
        create table if not exists app.api_football_site_cache (
          cache_key text primary key,
          payload jsonb not null,
          expires_at timestamptz not null,
          updated_at timestamptz not null default now()
        )
      `);
      await db.execute(sql`create index if not exists api_football_site_cache_expiry_idx on app.api_football_site_cache (expires_at)`);
    })().catch((error) => {
      cacheSchemaPromise = null;
      throw error;
    });
  }
  return cacheSchemaPromise;
}

async function cachedProvider(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  ttlSeconds: number,
) {
  await ensureSiteCacheSchema();
  const key = stableCacheKey(path, params);
  const cached = rowsOf(await db.execute(sql`
    select payload from app.api_football_site_cache
    where cache_key=${key} and expires_at > now()
    limit 1
  `))[0];
  if (cached?.payload) return { payload: cached.payload, cached: true };

  const payload = await fetchApiFootballProvider(path, params as Record<string, string | number | undefined>);
  const expiresAt = new Date(Date.now() + Math.max(5, ttlSeconds) * 1000);
  await db.execute(sql`
    insert into app.api_football_site_cache (cache_key,payload,expires_at,updated_at)
    values (${key},${JSON.stringify(payload)}::jsonb,${expiresAt},now())
    on conflict (cache_key) do update set payload=excluded.payload,expires_at=excluded.expires_at,updated_at=now()
  `);
  return { payload, cached: false };
}

function responseRows(payload: any) {
  return Array.isArray(payload?.response) ? payload.response : [];
}

function normalizeFixture(item: any) {
  const fixture = item?.fixture || {};
  const league = item?.league || {};
  const teams = item?.teams || {};
  const goals = item?.goals || {};
  return {
    id: Number(fixture.id || 0),
    leagueId: Number(league.id || 0),
    league: String(league.name || ""),
    season: Number(league.season || 0),
    round: String(league.round || ""),
    kickoffTime: fixture.date || null,
    timezone: fixture.timezone || null,
    venue: fixture.venue || null,
    status: String(fixture.status?.short || "NS"),
    statusLong: String(fixture.status?.long || ""),
    elapsed: Number(fixture.status?.elapsed || 0),
    homeTeam: {
      id: Number(teams.home?.id || 0),
      name: String(teams.home?.name || "Home"),
      logo: String(teams.home?.logo || ""),
      winner: teams.home?.winner ?? null,
      score: goals.home ?? null,
    },
    awayTeam: {
      id: Number(teams.away?.id || 0),
      name: String(teams.away?.name || "Away"),
      logo: String(teams.away?.logo || ""),
      winner: teams.away?.winner ?? null,
      score: goals.away ?? null,
    },
    goals,
    score: item?.score || null,
  };
}

async function coverageFor(leagueId: number, season: number) {
  const result = await cachedProvider("leagues", { id: leagueId, season }, 12 * 60 * 60);
  const row = responseRows(result.payload)[0] || null;
  const seasons = Array.isArray(row?.seasons) ? row.seasons : [];
  const selected = seasons.find((item: any) => Number(item?.year) === season) || seasons.find((item: any) => item?.current) || null;
  return {
    league: row?.league || null,
    country: row?.country || null,
    season: selected?.year || season,
    coverage: selected?.coverage || {},
    cached: result.cached,
  };
}

function fixtureTtl(row: any) {
  const status = String(row?.fixture?.status?.short || "NS");
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(status)) return 20;
  if (["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"].includes(status)) return 12 * 60 * 60;
  return 5 * 60;
}

function publicError(res: any, error: any, fallback: string) {
  const message = String(error?.message || fallback);
  const status = message.includes("safety") || message.includes("reserve") || message.includes("429") ? 429 : 502;
  return res.status(status).json({ message });
}

export function registerFootballDataRoutes(app: Express) {
  app.get("/api/football/leagues", (_req, res) => {
    return res.json({ leagues: Object.entries(FOOTBALL_LEAGUES).map(([key, value]) => ({ key, ...value })) });
  });

  app.get("/api/football/coverage/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      return res.json({ key: league.key, ...league.config, ...(await coverageFor(league.config.id, season)) });
    } catch (error: any) {
      return publicError(res, error, "Could not load API-Football coverage");
    }
  });

  app.get("/api/football/standings/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const result = await cachedProvider("standings", { league: league.config.id, season }, 60 * 60);
      const groups = result.payload?.response?.[0]?.league?.standings;
      return res.json({ league: league.config, season, standings: Array.isArray(groups?.[0]) ? groups[0] : [], groups: Array.isArray(groups) ? groups : [], cached: result.cached });
    } catch (error: any) {
      return publicError(res, error, "Could not load standings");
    }
  });

  app.get("/api/football/fixtures/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const status = String(req.query.status || "upcoming").toLowerCase();
      const params: Record<string, string | number | undefined> = { league: league.config.id, season };
      let ttl = 10 * 60;
      if (status === "live") {
        delete params.season;
        params.live = league.config.id;
        ttl = 20;
      } else if (status === "finished" || status === "completed") {
        params.last = Math.max(1, Math.min(40, Number(req.query.limit || 20)));
        ttl = 15 * 60;
      } else {
        params.next = Math.max(1, Math.min(40, Number(req.query.limit || 20)));
        ttl = 5 * 60;
      }
      const result = await cachedProvider("fixtures", params, ttl);
      return res.json({ league: league.config, season, status, fixtures: responseRows(result.payload).map(normalizeFixture), cached: result.cached });
    } catch (error: any) {
      return publicError(res, error, "Could not load fixtures");
    }
  });

  app.get("/api/football/match/:leagueKey/:fixtureId", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const fixtureId = Number(req.params.fixtureId || 0);
    if (!fixtureId) return res.status(400).json({ message: "Invalid fixture" });
    try {
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const base = await cachedProvider("fixtures", { id: fixtureId }, 20);
      const fixtureRow = responseRows(base.payload)[0];
      if (!fixtureRow) return res.status(404).json({ message: "Fixture not found" });
      const ttl = fixtureTtl(fixtureRow);
      const coverage = await coverageFor(league.config.id, season);
      const fixtureCoverage = coverage.coverage?.fixtures || {};
      const status = String(fixtureRow?.fixture?.status?.short || "NS");
      const finished = ["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"].includes(status);
      const homeId = Number(fixtureRow?.teams?.home?.id || 0);
      const awayId = Number(fixtureRow?.teams?.away?.id || 0);

      const embeddedEvents = Array.isArray(fixtureRow?.events) ? fixtureRow.events : null;
      const embeddedLineups = Array.isArray(fixtureRow?.lineups) ? fixtureRow.lineups : null;
      const embeddedStats = Array.isArray(fixtureRow?.statistics) ? fixtureRow.statistics : null;
      const embeddedPlayers = Array.isArray(fixtureRow?.players) ? fixtureRow.players : null;

      const [eventsResult, lineupsResult, statisticsResult, playersResult, predictionResult, h2hResult, injuryResult] = await Promise.all([
        embeddedEvents || fixtureCoverage.events === false ? Promise.resolve(null) : cachedProvider("fixtures/events", { fixture: fixtureId }, finished ? 12 * 60 * 60 : 30),
        embeddedLineups || fixtureCoverage.lineups === false ? Promise.resolve(null) : cachedProvider("fixtures/lineups", { fixture: fixtureId }, finished ? 12 * 60 * 60 : 5 * 60),
        embeddedStats || fixtureCoverage.statistics_fixtures === false ? Promise.resolve(null) : cachedProvider("fixtures/statistics", { fixture: fixtureId }, finished ? 12 * 60 * 60 : 60),
        embeddedPlayers || fixtureCoverage.statistics_players === false ? Promise.resolve(null) : cachedProvider("fixtures/players", { fixture: fixtureId }, finished ? 12 * 60 * 60 : 60),
        !finished && coverage.coverage?.predictions !== false ? cachedProvider("predictions", { fixture: fixtureId }, 60 * 60).catch(() => null) : Promise.resolve(null),
        homeId && awayId ? cachedProvider("fixtures/headtohead", { h2h: `${homeId}-${awayId}`, last: 5 }, 6 * 60 * 60).catch(() => null) : Promise.resolve(null),
        coverage.coverage?.injuries !== false ? cachedProvider("injuries", { fixture: fixtureId }, 4 * 60 * 60).catch(() => null) : Promise.resolve(null),
      ]);

      return res.json({
        league: league.config,
        season,
        coverage: coverage.coverage,
        fixture: normalizeFixture(fixtureRow),
        rawFixture: fixtureRow,
        events: embeddedEvents || (eventsResult ? responseRows(eventsResult.payload) : []),
        lineups: embeddedLineups || (lineupsResult ? responseRows(lineupsResult.payload) : []),
        statistics: embeddedStats || (statisticsResult ? responseRows(statisticsResult.payload) : []),
        players: embeddedPlayers || (playersResult ? responseRows(playersResult.payload) : []),
        prediction: predictionResult ? responseRows(predictionResult.payload)[0] || null : null,
        headToHead: h2hResult ? responseRows(h2hResult.payload).map(normalizeFixture) : [],
        injuries: injuryResult ? responseRows(injuryResult.payload) : [],
        refreshAfterSeconds: ttl,
      });
    } catch (error: any) {
      return publicError(res, error, "Could not load match intelligence");
    }
  });

  app.get("/api/football/leaders/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const coverage = await coverageFor(league.config.id, season);
      const [scorers, assists, yellow, red] = await Promise.all([
        coverage.coverage?.top_scorers === false ? Promise.resolve(null) : cachedProvider("players/topscorers", { league: league.config.id, season }, 60 * 60),
        coverage.coverage?.top_assists === false ? Promise.resolve(null) : cachedProvider("players/topassists", { league: league.config.id, season }, 60 * 60),
        coverage.coverage?.top_cards === false ? Promise.resolve(null) : cachedProvider("players/topyellowcards", { league: league.config.id, season }, 60 * 60),
        coverage.coverage?.top_cards === false ? Promise.resolve(null) : cachedProvider("players/topredcards", { league: league.config.id, season }, 60 * 60),
      ]);
      return res.json({
        league: league.config,
        season,
        coverage: coverage.coverage,
        topScorers: scorers ? responseRows(scorers.payload) : [],
        topAssists: assists ? responseRows(assists.payload) : [],
        topYellowCards: yellow ? responseRows(yellow.payload) : [],
        topRedCards: red ? responseRows(red.payload) : [],
      });
    } catch (error: any) {
      return publicError(res, error, "Could not load player leaders");
    }
  });

  app.get("/api/football/teams/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const result = await cachedProvider("teams", { league: league.config.id, season }, 12 * 60 * 60);
      return res.json({ league: league.config, season, teams: responseRows(result.payload), cached: result.cached });
    } catch (error: any) {
      return publicError(res, error, "Could not load clubs");
    }
  });

  app.get("/api/football/team/:leagueKey/:teamId", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const teamId = Number(req.params.teamId || 0);
    if (!teamId) return res.status(400).json({ message: "Invalid team" });
    try {
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const [team, stats, coaches, recent, upcoming] = await Promise.all([
        cachedProvider("teams", { id: teamId }, 12 * 60 * 60),
        cachedProvider("teams/statistics", { league: league.config.id, season, team: teamId }, 12 * 60 * 60),
        cachedProvider("coachs", { team: teamId }, 24 * 60 * 60).catch(() => null),
        cachedProvider("fixtures", { league: league.config.id, season, team: teamId, last: 5 }, 15 * 60),
        cachedProvider("fixtures", { league: league.config.id, season, team: teamId, next: 5 }, 15 * 60),
      ]);
      return res.json({
        league: league.config,
        season,
        team: responseRows(team.payload)[0] || null,
        statistics: stats.payload?.response || null,
        coaches: coaches ? responseRows(coaches.payload) : [],
        recent: responseRows(recent.payload).map(normalizeFixture),
        upcoming: responseRows(upcoming.payload).map(normalizeFixture),
      });
    } catch (error: any) {
      return publicError(res, error, "Could not load club profile");
    }
  });

  app.get("/api/football/players/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const search = String(req.query.search || "").trim();
    if (search.length < 4) return res.json({ league: league.config, players: [], message: "Enter at least 4 characters" });
    try {
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const page = Math.max(1, Math.min(20, Number(req.query.page || 1)));
      const result = await cachedProvider("players", { league: league.config.id, season, search, page }, 60 * 60);
      return res.json({ league: league.config, season, players: responseRows(result.payload), paging: result.payload?.paging || null, cached: result.cached });
    } catch (error: any) {
      return publicError(res, error, "Could not search players");
    }
  });

  app.get("/api/football/player/:leagueKey/:playerId", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const playerId = Number(req.params.playerId || 0);
    if (!playerId) return res.status(400).json({ message: "Invalid player" });
    try {
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const [profile, transfers, trophies, sidelined] = await Promise.all([
        cachedProvider("players", { id: playerId, season }, 6 * 60 * 60),
        cachedProvider("transfers", { player: playerId }, 12 * 60 * 60).catch(() => null),
        cachedProvider("trophies", { player: playerId }, 24 * 60 * 60).catch(() => null),
        cachedProvider("sidelined", { player: playerId }, 12 * 60 * 60).catch(() => null),
      ]);
      const playerRows = responseRows(profile.payload);
      const selected = playerRows[0] || null;
      const leagueStats = Array.isArray(selected?.statistics)
        ? selected.statistics.find((row: any) => Number(row?.league?.id || 0) === league.config.id) || null
        : null;
      return res.json({
        league: league.config,
        season,
        profile: selected,
        leagueStatistics: leagueStats,
        transfers: transfers ? responseRows(transfers.payload) : [],
        trophies: trophies ? responseRows(trophies.payload) : [],
        sidelined: sidelined ? responseRows(sidelined.payload) : [],
      });
    } catch (error: any) {
      return publicError(res, error, "Could not load player profile");
    }
  });
}

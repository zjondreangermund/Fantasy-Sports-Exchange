import type { Express } from "express";

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";

type ApiFootballResult = {
  payload: any;
  rateLimit: { limit: number | null; remaining: number | null };
  diagnostics: {
    endpoint: string;
    parameters: Record<string, string | number>;
    httpStatus: number;
    responseTimeMs: number;
    results: number;
    errors: any;
  };
};

function config() {
  return {
    apiKey: String(process.env.API_FOOTBALL_KEY || "").trim(),
    baseUrl: String(process.env.API_FOOTBALL_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    leagueId: Math.max(1, Number(process.env.API_FOOTBALL_LEAGUE_ID || 39)),
  };
}

function currentSeason() {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

async function apiFootballGet(path: string, params: Record<string, string | number | undefined>): Promise<ApiFootballResult> {
  const { apiKey, baseUrl } = config();
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not configured");
  const url = new URL(`${baseUrl}/${path.replace(/^\//, "")}`);
  const cleanParams: Record<string, string | number> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
      cleanParams[key] = value;
    }
  });

  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-apisports-key": apiKey,
      "User-Agent": "FantasyArena/1.0",
    },
    signal: AbortSignal.timeout(15000),
  });
  const responseTimeMs = Date.now() - startedAt;
  const payload: any = await response.json().catch(() => ({}));
  const limit = response.headers.get("x-ratelimit-requests-limit") || response.headers.get("x-ratelimit-limit");
  const remaining = response.headers.get("x-ratelimit-requests-remaining") || response.headers.get("x-ratelimit-remaining");
  const diagnostics = {
    endpoint: `/${path.replace(/^\//, "")}`,
    parameters: cleanParams,
    httpStatus: response.status,
    responseTimeMs,
    results: Number(payload?.results || (Array.isArray(payload?.response) ? payload.response.length : 0)),
    errors: payload?.errors || {},
  };
  if (!response.ok || (payload?.errors && Object.keys(payload.errors).length)) {
    const detail = typeof payload?.errors === "object" ? JSON.stringify(payload.errors) : payload?.message;
    const error: any = new Error(detail || `API-Football request failed (${response.status})`);
    error.diagnostics = diagnostics;
    throw error;
  }
  return {
    payload,
    rateLimit: { limit: limit ? Number(limit) : null, remaining: remaining ? Number(remaining) : null },
    diagnostics,
  };
}

function scorePreview(stat: any) {
  const games = stat?.games || {};
  const goals = stat?.goals || {};
  const shots = stat?.shots || {};
  const passes = stat?.passes || {};
  const tackles = stat?.tackles || {};
  const duels = stat?.duels || {};
  const cards = stat?.cards || {};
  const penalty = stat?.penalty || {};
  const position = String(games.position || "M").toUpperCase();
  const minutes = Number(games.minutes || 0);
  const played = minutes > 0;
  const goalValue = position === "G" || position === "D" ? 15 : position === "M" ? 12 : 10;
  const appearanceBase = played ? 35 : 0;
  const decisiveParts = {
    appearance: appearanceBase,
    goals: Number(goals.total || 0) * goalValue,
    assists: Number(goals.assists || 0) * 9,
    penaltySaves: Number(penalty.saved || 0) * 15,
    penaltyMisses: Number(penalty.missed || 0) * -8,
    redCards: Number(cards.red || 0) * -15,
  };
  const decisive = Math.max(0, Math.min(80, Object.values(decisiveParts).reduce((sum, value) => sum + value, 0)));
  const allAroundParts = {
    passes: Math.min(8, Number(passes.total || 0) / 12),
    keyPasses: Number(passes.key || 0) * 2.2,
    tackles: Number(tackles.total || 0) * 1.4,
    interceptions: Number(tackles.interceptions || 0) * 1.6,
    duelsWon: Number(duels.won || 0) * 0.65,
    shotsOnTarget: Number(shots.on || 0) * 1.5,
    saves: Number(goals.saves || 0) * 1.2,
    yellowCards: Number(cards.yellow || 0) * -2,
  };
  const allAround = Math.max(-15, Math.min(45, Object.values(allAroundParts).reduce((sum, value) => sum + value, 0)));
  return {
    score: Math.max(0, Math.min(100, Math.round((decisive + allAround) * 10) / 10)),
    decisiveScore: Math.round(decisive * 10) / 10,
    allAroundScore: Math.round(allAround * 10) / 10,
    breakdown: { decisive: decisiveParts, allAround: allAroundParts, goalValue },
  };
}

export function registerApiFootballAdminRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/admin/live-data/status", requireAuth, isAdmin, async (_req, res) => {
    try {
      const { leagueId, apiKey, baseUrl } = config();
      if (!apiKey) return res.json({ configured: false, connected: false, leagueId, baseUrl, message: "API_FOOTBALL_KEY is missing" });
      const { payload, rateLimit, diagnostics } = await apiFootballGet("status", {});
      return res.json({ configured: true, connected: true, leagueId, baseUrl, account: payload?.response || null, rateLimit, diagnostics, checkedAt: new Date().toISOString() });
    } catch (error: any) {
      return res.status(502).json({ configured: true, connected: false, message: error?.message || "Connection failed", diagnostics: error?.diagnostics || null });
    }
  });

  app.get("/api/admin/live-data/seasons", requireAuth, isAdmin, async (_req, res) => {
    try {
      const { leagueId } = config();
      const { payload, rateLimit, diagnostics } = await apiFootballGet("leagues", { id: leagueId });
      const league = Array.isArray(payload?.response) ? payload.response[0] : null;
      const seasons = (Array.isArray(league?.seasons) ? league.seasons : [])
        .map((row: any) => ({ year: Number(row?.year), start: row?.start || null, end: row?.end || null, current: Boolean(row?.current), coverage: row?.coverage || {} }))
        .filter((row: any) => Number.isFinite(row.year))
        .sort((a: any, b: any) => b.year - a.year);
      return res.json({ league: league?.league || null, country: league?.country || null, seasons, recommendedSeason: seasons.find((row: any) => row.current)?.year || seasons[0]?.year || currentSeason(), rateLimit, diagnostics });
    } catch (error: any) {
      return res.status(502).json({ message: error?.message || "Season lookup failed", diagnostics: error?.diagnostics || null });
    }
  });

  app.get("/api/admin/live-data/fixtures", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { leagueId } = config();
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const date = String(req.query.date || "").trim();
      const status = String(req.query.status || "").trim();
      const from = String(req.query.from || "").trim();
      const to = String(req.query.to || "").trim();
      const next = Math.max(0, Math.min(50, Number(req.query.next || 0)));
      const last = Math.max(0, Math.min(50, Number(req.query.last || 0)));
      const params: Record<string, string | number | undefined> = {
        league: leagueId,
        season,
        date: date || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        next: next || undefined,
        last: last || undefined,
      };
      const { payload, rateLimit, diagnostics } = await apiFootballGet("fixtures", params);
      return res.json({ fixtures: Array.isArray(payload?.response) ? payload.response : [], paging: payload?.paging, parameters: payload?.parameters, rateLimit, diagnostics, rawSummary: { get: payload?.get, results: payload?.results, paging: payload?.paging, errors: payload?.errors } });
    } catch (error: any) {
      return res.status(502).json({ message: error?.message || "Fixture lookup failed", diagnostics: error?.diagnostics || null });
    }
  });

  app.get("/api/admin/live-data/fixture/:fixtureId", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const fixtureId = Math.max(1, Number(req.params.fixtureId || 0));
      const { payload, rateLimit, diagnostics } = await apiFootballGet("fixtures", { id: fixtureId });
      return res.json({ fixture: Array.isArray(payload?.response) ? payload.response[0] || null : null, rateLimit, diagnostics });
    } catch (error: any) {
      return res.status(502).json({ message: error?.message || "Fixture detail lookup failed", diagnostics: error?.diagnostics || null });
    }
  });

  app.get("/api/admin/live-data/fixture/:fixtureId/players", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const fixtureId = Math.max(1, Number(req.params.fixtureId || 0));
      const { payload, rateLimit, diagnostics } = await apiFootballGet("fixtures/players", { fixture: fixtureId });
      const teams = (Array.isArray(payload?.response) ? payload.response : []).map((team: any) => ({
        team: team?.team,
        players: (Array.isArray(team?.players) ? team.players : []).map((row: any) => {
          const statistic = Array.isArray(row?.statistics) ? row.statistics[0] || {} : {};
          return { player: row?.player, statistic, fantasyArenaPreview: scorePreview(statistic) };
        }),
      }));
      return res.json({ fixtureId, teams, rateLimit, diagnostics, rawSummary: { get: payload?.get, results: payload?.results, paging: payload?.paging, errors: payload?.errors }, source: "api_football_preview", safeMode: true });
    } catch (error: any) {
      return res.status(502).json({ message: error?.message || "Player-stat lookup failed", diagnostics: error?.diagnostics || null });
    }
  });
}

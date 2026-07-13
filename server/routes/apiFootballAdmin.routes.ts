import type { Express } from "express";

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";

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

async function apiFootballGet(path: string, params: Record<string, string | number | undefined>) {
  const { apiKey, baseUrl } = config();
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not configured");
  const url = new URL(`${baseUrl}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-apisports-key": apiKey,
      "User-Agent": "FantasyArena/1.0",
    },
    signal: AbortSignal.timeout(15000),
  });
  const payload: any = await response.json().catch(() => ({}));
  const limit = response.headers.get("x-ratelimit-requests-limit") || response.headers.get("x-ratelimit-limit");
  const remaining = response.headers.get("x-ratelimit-requests-remaining") || response.headers.get("x-ratelimit-remaining");
  if (!response.ok || payload?.errors && Object.keys(payload.errors).length) {
    const detail = typeof payload?.errors === "object" ? JSON.stringify(payload.errors) : payload?.message;
    throw new Error(detail || `API-Football request failed (${response.status})`);
  }
  return { payload, rateLimit: { limit: limit ? Number(limit) : null, remaining: remaining ? Number(remaining) : null } };
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
  const decisive = Math.max(0, Math.min(80,
    appearanceBase +
    Number(goals.total || 0) * goalValue +
    Number(goals.assists || 0) * 9 +
    Number(penalty.saved || 0) * 15 -
    Number(penalty.missed || 0) * 8 -
    Number(cards.red || 0) * 15
  ));
  const allAround = Math.max(-15, Math.min(45,
    Math.min(8, Number(passes.total || 0) / 12) +
    Number(passes.key || 0) * 2.2 +
    Number(tackles.total || 0) * 1.4 +
    Number(tackles.interceptions || 0) * 1.6 +
    Number(duels.won || 0) * 0.65 +
    Number(shots.on || 0) * 1.5 +
    Number(goals.saves || 0) * 1.2 -
    Number(cards.yellow || 0) * 2
  ));
  return {
    score: Math.max(0, Math.min(100, Math.round((decisive + allAround) * 10) / 10)),
    decisiveScore: Math.round(decisive * 10) / 10,
    allAroundScore: Math.round(allAround * 10) / 10,
  };
}

export function registerApiFootballAdminRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/admin/live-data/status", requireAuth, isAdmin, async (_req, res) => {
    try {
      const { leagueId, apiKey, baseUrl } = config();
      if (!apiKey) return res.json({ configured: false, connected: false, leagueId, baseUrl, message: "API_FOOTBALL_KEY is missing" });
      const { payload, rateLimit } = await apiFootballGet("status", {});
      return res.json({ configured: true, connected: true, leagueId, baseUrl, account: payload?.response || null, rateLimit });
    } catch (error: any) {
      return res.status(502).json({ configured: true, connected: false, message: error?.message || "Connection failed" });
    }
  });

  app.get("/api/admin/live-data/fixtures", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { leagueId } = config();
      const season = Math.max(2000, Number(req.query.season || currentSeason()));
      const date = String(req.query.date || "").trim();
      const status = String(req.query.status || "").trim();
      const { payload, rateLimit } = await apiFootballGet("fixtures", { league: leagueId, season, date: date || undefined, status: status || undefined });
      return res.json({ fixtures: Array.isArray(payload?.response) ? payload.response : [], paging: payload?.paging, parameters: payload?.parameters, rateLimit });
    } catch (error: any) {
      return res.status(502).json({ message: error?.message || "Fixture lookup failed" });
    }
  });

  app.get("/api/admin/live-data/fixture/:fixtureId/players", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const fixtureId = Math.max(1, Number(req.params.fixtureId || 0));
      const { payload, rateLimit } = await apiFootballGet("fixtures/players", { fixture: fixtureId });
      const teams = (Array.isArray(payload?.response) ? payload.response : []).map((team: any) => ({
        team: team?.team,
        players: (Array.isArray(team?.players) ? team.players : []).map((row: any) => {
          const statistic = Array.isArray(row?.statistics) ? row.statistics[0] || {} : {};
          return { player: row?.player, statistic, fantasyArenaPreview: scorePreview(statistic) };
        }),
      }));
      return res.json({ fixtureId, teams, rateLimit, source: "api_football_preview", safeMode: true });
    } catch (error: any) {
      return res.status(502).json({ message: error?.message || "Player-stat lookup failed" });
    }
  });
}

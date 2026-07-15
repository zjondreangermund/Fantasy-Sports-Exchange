import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";
const DAILY_SAFETY_CAP = Math.max(10, Math.min(90, Number(process.env.API_FOOTBALL_DAILY_CAP || 90)));

const CACHE_TTL = {
  status: 15 * 60_000,
  seasons: 24 * 60 * 60_000,
  fixtures: 10 * 60_000,
  fixture: 10 * 60_000,
  players: 30 * 60_000,
};

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
    cached?: boolean;
    cacheKey?: string;
  };
  cached?: boolean;
};

type Budget = { cap: number; used: number; remaining: number; day: string };
let schemaReady: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

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

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        create table if not exists app.api_football_usage (
          usage_day date primary key,
          requests integer not null default 0,
          updated_at timestamptz not null default now()
        )
      `);
      await db.execute(sql`
        create table if not exists app.api_football_cache (
          cache_key text primary key,
          payload jsonb not null,
          expires_at timestamptz not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await db.execute(sql`create index if not exists api_football_cache_expiry_idx on app.api_football_cache (expires_at)`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function getBudget(): Promise<Budget> {
  await ensureSchema();
  const day = utcDay();
  const row = rowsOf(await db.execute(sql`select requests::int as requests from app.api_football_usage where usage_day=${day}::date`))[0];
  const used = Number(row?.requests || 0);
  return { cap: DAILY_SAFETY_CAP, used, remaining: Math.max(0, DAILY_SAFETY_CAP - used), day };
}

async function reserveRequest(): Promise<Budget> {
  await ensureSchema();
  const day = utcDay();
  const row = rowsOf(await db.execute(sql`
    insert into app.api_football_usage (usage_day, requests, updated_at)
    values (${day}::date, 1, now())
    on conflict (usage_day) do update
      set requests = app.api_football_usage.requests + 1, updated_at = now()
      where app.api_football_usage.requests < ${DAILY_SAFETY_CAP}
    returning requests::int as requests
  `))[0];
  if (!row) {
    const budget = await getBudget();
    const error: any = new Error(`Fantasy Arena daily API-Football safety limit reached (${budget.used}/${budget.cap}). Cached data remains available.`);
    error.code = "DAILY_BUDGET_EXHAUSTED";
    error.budget = budget;
    throw error;
  }
  const used = Number(row.requests || 0);
  return { cap: DAILY_SAFETY_CAP, used, remaining: Math.max(0, DAILY_SAFETY_CAP - used), day };
}

function cacheKey(path: string, params: Record<string, string | number | undefined>) {
  const clean = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return `${path.replace(/^\//, "")}?${clean}`;
}

async function readCache(key: string): Promise<ApiFootballResult | null> {
  await ensureSchema();
  const row = rowsOf(await db.execute(sql`
    select payload from app.api_football_cache
    where cache_key=${key} and expires_at > now()
    limit 1
  `))[0];
  if (!row?.payload) return null;
  const result = row.payload as ApiFootballResult;
  return {
    ...result,
    cached: true,
    diagnostics: { ...result.diagnostics, cached: true, cacheKey: key, responseTimeMs: 0 },
  };
}

async function writeCache(key: string, value: ApiFootballResult, ttlMs: number) {
  await ensureSchema();
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.execute(sql`
    insert into app.api_football_cache (cache_key, payload, expires_at, updated_at)
    values (${key}, ${JSON.stringify(value)}::jsonb, ${expiresAt}, now())
    on conflict (cache_key) do update
      set payload=excluded.payload, expires_at=excluded.expires_at, updated_at=now()
  `);
}

async function apiFootballGet(path: string, params: Record<string, string | number | undefined>, ttlMs: number): Promise<ApiFootballResult & { budget: Budget }> {
  const { apiKey, baseUrl } = config();
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not configured");
  const key = cacheKey(path, params);
  const cached = await readCache(key);
  if (cached) return { ...cached, budget: await getBudget() };

  const budget = await reserveRequest();
  const url = new URL(`${baseUrl}/${path.replace(/^\//, "")}`);
  const cleanParams: Record<string, string | number> = {};
  Object.entries(params).forEach(([paramKey, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(paramKey, String(value));
      cleanParams[paramKey] = value;
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
    cached: false,
    cacheKey: key,
  };
  if (!response.ok || (payload?.errors && Object.keys(payload.errors).length)) {
    const detail = typeof payload?.errors === "object" ? JSON.stringify(payload.errors) : payload?.message;
    const error: any = new Error(detail || `API-Football request failed (${response.status})`);
    error.diagnostics = diagnostics;
    error.budget = budget;
    throw error;
  }
  const result: ApiFootballResult = {
    payload,
    rateLimit: { limit: limit ? Number(limit) : null, remaining: remaining ? Number(remaining) : null },
    diagnostics,
    cached: false,
  };
  await writeCache(key, result, ttlMs);
  return { ...result, budget };
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

function errorResponse(error: any, fallback: string) {
  return {
    message: error?.message || fallback,
    diagnostics: error?.diagnostics || null,
    budget: error?.budget || null,
    code: error?.code || null,
  };
}

export function registerApiFootballAdminRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/admin/live-data/budget", requireAuth, isAdmin, async (_req, res) => {
    try {
      return res.json({ budget: await getBudget(), cacheEnabled: true, emergencyBuffer: 100 - DAILY_SAFETY_CAP });
    } catch (error: any) {
      return res.status(500).json(errorResponse(error, "Could not load API budget"));
    }
  });

  app.get("/api/admin/live-data/status", requireAuth, isAdmin, async (_req, res) => {
    try {
      const { leagueId, apiKey, baseUrl } = config();
      if (!apiKey) return res.json({ configured: false, connected: false, leagueId, baseUrl, message: "API_FOOTBALL_KEY is missing", budget: await getBudget() });
      const { payload, rateLimit, diagnostics, budget, cached } = await apiFootballGet("status", {}, CACHE_TTL.status);
      return res.json({ configured: true, connected: true, leagueId, baseUrl, account: payload?.response || null, rateLimit, budget, cached, diagnostics, checkedAt: new Date().toISOString() });
    } catch (error: any) {
      return res.status(error?.code === "DAILY_BUDGET_EXHAUSTED" ? 429 : 502).json({ configured: true, connected: false, ...errorResponse(error, "Connection failed") });
    }
  });

  app.get("/api/admin/live-data/seasons", requireAuth, isAdmin, async (_req, res) => {
    try {
      const { leagueId } = config();
      const { payload, rateLimit, diagnostics, budget, cached } = await apiFootballGet("leagues", { id: leagueId }, CACHE_TTL.seasons);
      const league = Array.isArray(payload?.response) ? payload.response[0] : null;
      const seasons = (Array.isArray(league?.seasons) ? league.seasons : [])
        .map((row: any) => ({ year: Number(row?.year), start: row?.start || null, end: row?.end || null, current: Boolean(row?.current), coverage: row?.coverage || {} }))
        .filter((row: any) => Number.isFinite(row.year))
        .sort((a: any, b: any) => b.year - a.year);
      return res.json({ league: league?.league || null, country: league?.country || null, seasons, recommendedSeason: seasons.find((row: any) => row.current)?.year || seasons[0]?.year || currentSeason(), rateLimit, budget, cached, diagnostics });
    } catch (error: any) {
      return res.status(error?.code === "DAILY_BUDGET_EXHAUSTED" ? 429 : 502).json(errorResponse(error, "Season lookup failed"));
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
      const params: Record<string, string | number | undefined> = { league: leagueId, season, date: date || undefined, status: status || undefined, from: from || undefined, to: to || undefined, next: next || undefined, last: last || undefined };
      const { payload, rateLimit, diagnostics, budget, cached } = await apiFootballGet("fixtures", params, CACHE_TTL.fixtures);
      return res.json({ fixtures: Array.isArray(payload?.response) ? payload.response : [], paging: payload?.paging, parameters: payload?.parameters, rateLimit, budget, cached, diagnostics, rawSummary: { get: payload?.get, results: payload?.results, paging: payload?.paging, errors: payload?.errors } });
    } catch (error: any) {
      return res.status(error?.code === "DAILY_BUDGET_EXHAUSTED" ? 429 : 502).json(errorResponse(error, "Fixture lookup failed"));
    }
  });

  app.get("/api/admin/live-data/fixture/:fixtureId", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const fixtureId = Math.max(1, Number(req.params.fixtureId || 0));
      const { payload, rateLimit, diagnostics, budget, cached } = await apiFootballGet("fixtures", { id: fixtureId }, CACHE_TTL.fixture);
      return res.json({ fixture: Array.isArray(payload?.response) ? payload.response[0] || null : null, rateLimit, budget, cached, diagnostics });
    } catch (error: any) {
      return res.status(error?.code === "DAILY_BUDGET_EXHAUSTED" ? 429 : 502).json(errorResponse(error, "Fixture detail lookup failed"));
    }
  });

  app.get("/api/admin/live-data/fixture/:fixtureId/players", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const fixtureId = Math.max(1, Number(req.params.fixtureId || 0));
      const { payload, rateLimit, diagnostics, budget, cached } = await apiFootballGet("fixtures/players", { fixture: fixtureId }, CACHE_TTL.players);
      const teams = (Array.isArray(payload?.response) ? payload.response : []).map((team: any) => ({
        team: team?.team,
        players: (Array.isArray(team?.players) ? team.players : []).map((row: any) => {
          const statistic = Array.isArray(row?.statistics) ? row.statistics[0] || {} : {};
          return { player: row?.player, statistic, fantasyArenaPreview: scorePreview(statistic) };
        }),
      }));
      return res.json({ fixtureId, teams, rateLimit, budget, cached, diagnostics, rawSummary: { get: payload?.get, results: payload?.results, paging: payload?.paging, errors: payload?.errors }, source: "api_football_preview", safeMode: true });
    } catch (error: any) {
      return res.status(error?.code === "DAILY_BUDGET_EXHAUSTED" ? 429 : 502).json(errorResponse(error, "Player-stat lookup failed"));
    }
  });
}

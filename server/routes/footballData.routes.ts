import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fetchApiFootballProvider } from "../services/apiFootballSync.js";
import { fplApi } from "../services/fplApi.js";

// API_FOOTBALL_FULL_INTELLIGENCE_V2
export type FootballLeagueKey =
  | "premier-league"
  | "la-liga"
  | "bundesliga"
  | "serie-a"
  | "ligue-1"
  | "champions-league"
  | "europa-league"
  | "conference-league"
  | "fa-cup"
  | "efl-cup"
  | "world-cup";

type LeagueConfig = {
  id: number;
  name: string;
  country: string;
  kind: "league" | "cup" | "international";
  group: "domestic" | "europe" | "international";
};

const FOOTBALL_LEAGUES: Record<FootballLeagueKey, LeagueConfig> = {
  "premier-league": { id: 39, name: "Premier League", country: "England", kind: "league", group: "domestic" },
  "la-liga": { id: 140, name: "La Liga", country: "Spain", kind: "league", group: "domestic" },
  "bundesliga": { id: 78, name: "Bundesliga", country: "Germany", kind: "league", group: "domestic" },
  "serie-a": { id: 135, name: "Serie A", country: "Italy", kind: "league", group: "domestic" },
  "ligue-1": { id: 61, name: "Ligue 1", country: "France", kind: "league", group: "domestic" },
  "champions-league": { id: 2, name: "UEFA Champions League", country: "Europe", kind: "cup", group: "europe" },
  "europa-league": { id: 3, name: "UEFA Europa League", country: "Europe", kind: "cup", group: "europe" },
  "conference-league": { id: 848, name: "UEFA Conference League", country: "Europe", kind: "cup", group: "europe" },
  "fa-cup": { id: 45, name: "FA Cup", country: "England", kind: "cup", group: "domestic" },
  "efl-cup": { id: 48, name: "EFL Cup", country: "England", kind: "cup", group: "domestic" },
  "world-cup": { id: 1, name: "FIFA World Cup", country: "World", kind: "international", group: "international" },
};

let cacheSchemaPromise: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function currentSeason() {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function requestedSeason(raw: unknown) {
  const parsed = Number(raw || currentSeason());
  return Math.max(2000, Math.min(2100, Number.isFinite(parsed) ? parsed : currentSeason()));
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
    select payload, updated_at as "updatedAt", expires_at > now() as fresh
    from app.api_football_site_cache
    where cache_key=${key}
    limit 1
  `))[0];
  if (cached?.payload && cached.fresh) {
    return { payload: cached.payload, cached: true, stale: false, updatedAt: cached.updatedAt, warning: null };
  }

  try {
    const payload = await fetchApiFootballProvider(path, params as Record<string, string | number | undefined>);
    const expiresAt = new Date(Date.now() + Math.max(5, ttlSeconds) * 1000);
    await db.execute(sql`
      insert into app.api_football_site_cache (cache_key,payload,expires_at,updated_at)
      values (${key},${JSON.stringify(payload)}::jsonb,${expiresAt},now())
      on conflict (cache_key) do update set payload=excluded.payload,expires_at=excluded.expires_at,updated_at=now()
    `);
    return { payload, cached: false, stale: false, updatedAt: new Date().toISOString(), warning: null };
  } catch (error: any) {
    // API_FOOTBALL_STALE_CACHE_FALLBACK_V1: provider outages must not erase good data.
    if (cached?.payload) {
      console.warn(`[football-data] Serving saved ${path} data after provider failure:`, error?.message || error);
      return {
        payload: cached.payload,
        cached: true,
        stale: true,
        updatedAt: cached.updatedAt,
        warning: "API-Football is temporarily unavailable; the latest saved match data is being shown.",
      };
    }
    throw error;
  }
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
    timestamp: fixture.timestamp || null,
    referee: fixture.referee || null,
    venue: fixture.venue || null,
    periods: fixture.periods || null,
    status: String(fixture.status?.short || "NS"),
    statusLong: String(fixture.status?.long || ""),
    elapsed: Number(fixture.status?.elapsed || 0),
    extra: fixture.status?.extra ?? null,
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

const LIVE_FIXTURE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);

function clubMatchKey(value: unknown) {
  const name = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:football club|fc|afc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const aliases: Record<string, string> = {
    "man city": "manchester city",
    "man utd": "manchester united",
    "newcastle": "newcastle united",
    "west ham": "west ham united",
    "leeds": "leeds united",
    "spurs": "tottenham hotspur",
    "tottenham": "tottenham hotspur",
    "wolves": "wolverhampton wanderers",
    "wolverhampton": "wolverhampton wanderers",
    "brighton": "brighton and hove albion",
    "brighton hove albion": "brighton and hove albion",
    "bournemouth": "bournemouth",
    "nott m forest": "nottingham forest",
    "nottm forest": "nottingham forest",
    "nott forest": "nottingham forest",
  };
  return aliases[name] || name;
}

function matchesLiveFixture(left: any, right: any) {
  const sameHome = clubMatchKey(left?.homeTeam?.name) === clubMatchKey(right?.homeTeam?.name);
  const sameAway = clubMatchKey(left?.awayTeam?.name) === clubMatchKey(right?.awayTeam?.name);
  if (!sameHome || !sameAway) return false;
  const leftKickoff = new Date(left?.kickoffTime || 0).getTime();
  const rightKickoff = new Date(right?.kickoffTime || 0).getTime();
  return !leftKickoff || !rightKickoff || Math.abs(leftKickoff - rightKickoff) <= 3 * 60 * 60 * 1000;
}

function normalizeSavedFixture(row: any) {
  const base = normalizeFixture(row?.raw || {});
  return {
    ...base,
    id: Number(row?.apiFixtureId || base.id || 0),
    apiFixtureId: Number(row?.apiFixtureId || base.id || 0) || null,
    leagueId: 39,
    league: "Premier League",
    season: Number(row?.season || base.season || currentSeason()),
    round: String(row?.round || base.round || "Premier League"),
    kickoffTime: row?.kickoffTime || base.kickoffTime || null,
    timezone: row?.timezone || base.timezone || null,
    status: String(row?.status || base.status || "NS"),
    statusLong: String(row?.statusLong || base.statusLong || ""),
    elapsed: Number(row?.elapsed ?? base.elapsed ?? 0),
    homeTeam: {
      ...base.homeTeam,
      id: Number(row?.homeTeamId || base.homeTeam?.id || 0),
      name: String(row?.homeName || base.homeTeam?.name || "Home"),
      logo: String(row?.homeLogo || base.homeTeam?.logo || ""),
      score: row?.homeScore ?? base.homeTeam?.score ?? null,
    },
    awayTeam: {
      ...base.awayTeam,
      id: Number(row?.awayTeamId || base.awayTeam?.id || 0),
      name: String(row?.awayName || base.awayTeam?.name || "Away"),
      logo: String(row?.awayLogo || base.awayTeam?.logo || ""),
      score: row?.awayScore ?? base.awayTeam?.score ?? null,
    },
    source: "api-football-database",
    intelligenceAvailable: true,
  };
}

async function savedPremierLeagueMatchdayFixtures(season: number) {
  try {
    const rows = rowsOf(await db.execute(sql`
      select f.api_fixture_id as "apiFixtureId", f.raw, f.season, f.round,
             f.kickoff_at as "kickoffTime", f.timezone,
             coalesce(f.status_short,'NS') as status, f.status_long as "statusLong", f.elapsed,
             f.home_team_id as "homeTeamId", f.away_team_id as "awayTeamId",
             f.home_score as "homeScore", f.away_score as "awayScore",
             ht.name as "homeName", ht.logo as "homeLogo",
             at.name as "awayName", at.logo as "awayLogo"
      from app.api_football_fixtures f
      left join app.api_football_teams ht on ht.api_team_id=f.home_team_id
      left join app.api_football_teams at on at.api_team_id=f.away_team_id
      where f.league_id=39 and f.season=${season}
        and f.kickoff_at between now()-interval '6 hours' and now()+interval '2 hours'
      order by f.kickoff_at asc, f.api_fixture_id asc
    `));
    return rows.map(normalizeSavedFixture);
  } catch (error: any) {
    console.warn("[football-data] Saved Premier League fixture fallback unavailable:", error?.message || error);
    return [];
  }
}

function mergeFplLiveFixture(game: any, saved: any, season: number) {
  const minutes = Number(game?.minutes || saved?.elapsed || 0);
  const apiFixtureId = Number(saved?.apiFixtureId || saved?.id || 0) || null;
  const fplFixtureId = Number(game?.id || 0);
  return {
    ...(saved || {}),
    id: apiFixtureId || fplFixtureId,
    apiFixtureId,
    fplFixtureId,
    leagueId: 39,
    league: "Premier League",
    season,
    round: String(saved?.round || "Premier League"),
    kickoffTime: game?.kickoffTime || saved?.kickoffTime || null,
    status: saved?.status && LIVE_FIXTURE_STATUSES.has(String(saved.status)) ? saved.status : "LIVE",
    statusLong: "Match in progress",
    elapsed: minutes,
    homeTeam: {
      ...(saved?.homeTeam || {}),
      id: Number(saved?.homeTeam?.id || game?.homeTeam?.id || 0),
      name: String(game?.homeTeam?.name || saved?.homeTeam?.name || "Home"),
      score: game?.homeTeam?.score ?? saved?.homeTeam?.score ?? null,
    },
    awayTeam: {
      ...(saved?.awayTeam || {}),
      id: Number(saved?.awayTeam?.id || game?.awayTeam?.id || 0),
      name: String(game?.awayTeam?.name || saved?.awayTeam?.name || "Away"),
      score: game?.awayTeam?.score ?? saved?.awayTeam?.score ?? null,
    },
    source: apiFixtureId ? "api-football+fpl" : "fpl",
    intelligenceAvailable: Boolean(apiFixtureId),
  };
}

async function resolvePremierLeagueLiveFixtures(providerFixtures: any[], season: number) {
  // FPL_LIVE_FIXTURE_FALLBACK_V1: share the exact live source used by /api/live/hub.
  const [savedFixtures, fplLiveResult] = await Promise.all([
    savedPremierLeagueMatchdayFixtures(season),
    fplApi.getLiveGames()
      .then((games) => ({ games: Array.isArray(games) ? games : [], error: null }))
      .catch((error) => ({ games: [], error })),
  ]);
  const fplLiveGames = fplLiveResult.games;
  const merged = providerFixtures.map((fixture: any) => ({
    ...fixture,
    apiFixtureId: Number(fixture?.id || 0) || null,
    source: "api-football",
    intelligenceAvailable: true,
  }));
  let usedFallback = false;

  for (const game of Array.isArray(fplLiveGames) ? fplLiveGames : []) {
    const providerIndex = merged.findIndex((fixture: any) => matchesLiveFixture(fixture, game));
    const saved = providerIndex >= 0
      ? merged[providerIndex]
      : savedFixtures.find((fixture: any) => matchesLiveFixture(fixture, game));
    const combined = mergeFplLiveFixture(game, saved, season);
    if (providerIndex >= 0) merged[providerIndex] = combined;
    else {
      merged.push(combined);
      usedFallback = true;
    }
  }

  if (!merged.length) {
    const savedLive = savedFixtures.filter((fixture: any) => LIVE_FIXTURE_STATUSES.has(String(fixture.status || "")));
    if (savedLive.length) {
      merged.push(...savedLive);
      usedFallback = true;
    }
  }

  merged.sort((left: any, right: any) => new Date(left?.kickoffTime || 0).getTime() - new Date(right?.kickoffTime || 0).getTime());
  return {
    fixtures: merged,
    usedFallback,
    savedFixtures,
    fplAvailable: !fplLiveResult.error,
    fplFailure: fplLiveResult.error || null,
  };
}

async function fallbackPremierLeagueMatch(fixtureId: number, season: number) {
  const live = await resolvePremierLeagueLiveFixtures([], season);
  const fixture = live.fixtures.find((row: any) => Number(row.id || 0) === fixtureId || Number(row.fplFixtureId || 0) === fixtureId);
  if (!fixture) return null;
  return {
    league: FOOTBALL_LEAGUES["premier-league"],
    season,
    coverage: { fixtures: {} },
    fixture,
    rawFixture: null,
    events: [],
    lineups: [],
    statistics: [],
    halfStatistics: [],
    players: [],
    prediction: null,
    headToHead: [],
    injuries: [],
    refreshAfterSeconds: 30,
    source: "fpl-fallback",
    warning: "Live scores are available from the official Premier League feed; detailed API-Football match intelligence will return when its feed reconnects.",
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

function statRowValue(stat: any, key: string) {
  const value = stat?.[key];
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function playerMatchSummary(item: any, fixture: any) {
  const stats = Array.isArray(item?.statistics) ? item.statistics[0] || {} : {};
  const games = stats?.games || {};
  const goals = stats?.goals || {};
  const shots = stats?.shots || {};
  const passes = stats?.passes || {};
  const tackles = stats?.tackles || {};
  const duels = stats?.duels || {};
  const dribbles = stats?.dribbles || {};
  const cards = stats?.cards || {};
  return {
    fixture: normalizeFixture(fixture),
    playerId: Number(item?.player?.id || 0),
    playerName: String(item?.player?.name || "Player"),
    minutes: Number(games?.minutes || 0),
    rating: games?.rating == null ? null : Number(games.rating),
    position: games?.position || null,
    substitute: games?.substitute ?? null,
    goals: Number(goals?.total || 0),
    assists: Number(goals?.assists || 0),
    shots: Number(shots?.total || 0),
    shotsOn: Number(shots?.on || 0),
    passes: Number(passes?.total || 0),
    keyPasses: Number(passes?.key || 0),
    passAccuracy: passes?.accuracy ?? null,
    tackles: Number(tackles?.total || 0),
    interceptions: Number(tackles?.interceptions || 0),
    duels: Number(duels?.total || 0),
    duelsWon: Number(duels?.won || 0),
    dribbles: Number(dribbles?.success || 0),
    yellow: Number(cards?.yellow || 0),
    red: Number(cards?.red || 0),
  };
}

async function localPremierLeagueForm(playerId: number) {
  try {
    const rows = rowsOf(await db.execute(sql`
      select s.api_fixture_id as "fixtureId", s.position, s.minutes, s.rating,
             s.fantasy_score as "fantasyScore", s.decisive_score as "decisiveScore",
             s.all_around_score as "allAroundScore", s.statistics,
             f.round, f.kickoff_at as "kickoffAt", f.home_team_id as "homeTeamId", f.away_team_id as "awayTeamId",
             f.home_score as "homeScore", f.away_score as "awayScore",
             coalesce(ht.name,'Home') as "homeTeamName", coalesce(at.name,'Away') as "awayTeamName"
      from app.api_football_player_match_stats s
      join app.api_football_fixtures f on f.api_fixture_id=s.api_fixture_id
      left join app.api_football_teams ht on ht.api_team_id=f.home_team_id
      left join app.api_football_teams at on at.api_team_id=f.away_team_id
      where s.api_player_id=${playerId} and f.league_id=39
      order by f.kickoff_at desc nulls last
      limit 10
    `));
    return rows.map((row: any) => {
      const stats = row.statistics || {};
      return {
        fixtureId: Number(row.fixtureId || 0),
        round: row.round || null,
        kickoffTime: row.kickoffAt || null,
        homeTeam: row.homeTeamName,
        awayTeam: row.awayTeamName,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        minutes: Number(row.minutes || 0),
        rating: row.rating == null ? null : Number(row.rating),
        fantasyScore: row.fantasyScore == null ? null : Number(row.fantasyScore),
        decisiveScore: row.decisiveScore == null ? null : Number(row.decisiveScore),
        allAroundScore: row.allAroundScore == null ? null : Number(row.allAroundScore),
        goals: Number(stats?.goals?.total || 0),
        assists: Number(stats?.goals?.assists || 0),
        shotsOn: Number(stats?.shots?.on || 0),
        keyPasses: Number(stats?.passes?.key || 0),
        tackles: Number(stats?.tackles?.total || 0),
        interceptions: Number(stats?.tackles?.interceptions || 0),
        duelsWon: Number(stats?.duels?.won || 0),
      };
    });
  } catch {
    return [];
  }
}

async function providerPlayerForm(leagueId: number, season: number, playerId: number, teamId: number) {
  if (!teamId) return [];
  const fixtures = await cachedProvider("fixtures", { league: leagueId, season, team: teamId, last: 5 }, 15 * 60);
  const fixtureRows = responseRows(fixtures.payload).slice(-5).reverse();
  const results: any[] = [];
  for (const fixture of fixtureRows) {
    const fixtureId = Number(fixture?.fixture?.id || 0);
    if (!fixtureId) continue;
    const players = await cachedProvider("fixtures/players", { fixture: fixtureId }, 12 * 60 * 60).catch(() => null);
    if (!players) continue;
    const groupRows = responseRows(players.payload);
    let found: any = null;
    for (const group of groupRows) {
      const row = (Array.isArray(group?.players) ? group.players : []).find((entry: any) => Number(entry?.player?.id || 0) === playerId);
      if (row) { found = row; break; }
    }
    if (found) results.push(playerMatchSummary(found, fixture));
  }
  return results;
}

async function loadPlayerForm(leagueId: number, season: number, playerId: number, teamId: number) {
  if (leagueId === 39) {
    const local = await localPremierLeagueForm(playerId);
    if (local.length) return { source: "synced-api-football", matches: local };
  }
  const matches = await providerPlayerForm(leagueId, season, playerId, teamId);
  return { source: "api-football", matches };
}

function currentSquadContains(payload: any, playerId: number) {
  for (const row of responseRows(payload)) {
    const players = Array.isArray(row?.players) ? row.players : [];
    if (players.some((player: any) => Number(player?.id || 0) === playerId)) return true;
  }
  return false;
}

async function buildPlayerIntelligence(leagueId: number, season: number, playerId: number) {
  const profileResult = await cachedProvider("players", { id: playerId, season }, 6 * 60 * 60);
  const profile = responseRows(profileResult.payload)[0] || null;
  if (!profile) return null;
  const leagueStat = (Array.isArray(profile?.statistics) ? profile.statistics : []).find((row: any) => Number(row?.league?.id || 0) === leagueId) || profile?.statistics?.[0] || null;
  const teamId = Number(leagueStat?.team?.id || 0);
  const teamName = String(leagueStat?.team?.name || "");

  const [injuryResult, transferResult, nextResult, standingsResult, squadResult] = await Promise.all([
    cachedProvider("injuries", { player: playerId }, 4 * 60 * 60).catch(() => null),
    cachedProvider("transfers", { player: playerId }, 12 * 60 * 60).catch(() => null),
    teamId ? cachedProvider("fixtures", { team: teamId, next: 3 }, 5 * 60).catch(() => null) : Promise.resolve(null),
    cachedProvider("standings", { league: leagueId, season }, 60 * 60).catch(() => null),
    teamId ? cachedProvider("players/squads", { team: teamId }, 12 * 60 * 60).catch(() => null) : Promise.resolve(null),
  ]);

  const injuries = injuryResult ? responseRows(injuryResult.payload) : [];
  const transfers = transferResult ? responseRows(transferResult.payload) : [];
  const nextFixtures = nextResult ? responseRows(nextResult.payload).map(normalizeFixture) : [];
  const nextFixture = nextFixtures[0] || null;
  const inCurrentSquad = squadResult ? currentSquadContains(squadResult.payload, playerId) : null;

  let lineup: any = null;
  if (nextFixture?.id) {
    const lineupResult = await cachedProvider("fixtures/lineups", { fixture: nextFixture.id }, 2 * 60).catch(() => null);
    const lineups = lineupResult ? responseRows(lineupResult.payload) : [];
    const teamLineup = lineups.find((row: any) => Number(row?.team?.id || 0) === teamId) || null;
    if (teamLineup) {
      const starters = Array.isArray(teamLineup?.startXI) ? teamLineup.startXI : [];
      const substitutes = Array.isArray(teamLineup?.substitutes) ? teamLineup.substitutes : [];
      const starter = starters.some((row: any) => Number(row?.player?.id || 0) === playerId);
      const substitute = substitutes.some((row: any) => Number(row?.player?.id || 0) === playerId);
      lineup = {
        published: true,
        starter,
        substitute,
        formation: teamLineup?.formation || null,
        status: starter ? "confirmed_starter" : substitute ? "confirmed_bench" : "not_in_announced_squad",
      };
    } else {
      lineup = { published: false, starter: false, substitute: false, formation: null, status: "not_announced" };
    }
  }

  const groups = standingsResult?.payload?.response?.[0]?.league?.standings;
  const flatStandings = Array.isArray(groups) ? groups.flatMap((group: any) => Array.isArray(group) ? group : []) : [];
  const standing = flatStandings.find((row: any) => Number(row?.team?.id || 0) === teamId) || null;
  const form = await loadPlayerForm(leagueId, season, playerId, teamId).catch(() => ({ source: "unavailable", matches: [] }));

  const warnings: Array<{ level: "info" | "warning" | "danger"; code: string; message: string }> = [];
  if (inCurrentSquad === false) warnings.push({ level: "danger", code: "not_current_squad", message: "Player is not listed in the club's current API-Football squad." });
  for (const injury of injuries.slice(0, 2)) {
    const type = String(injury?.player?.type || "Unavailable");
    const reason = String(injury?.player?.reason || "Availability issue");
    warnings.push({ level: type.toLowerCase().includes("susp") ? "danger" : "warning", code: "availability", message: `${type}: ${reason}` });
  }
  if (lineup?.status === "confirmed_bench") warnings.push({ level: "warning", code: "bench", message: "Confirmed on the substitutes bench for the next fixture." });
  if (lineup?.status === "not_in_announced_squad") warnings.push({ level: "danger", code: "not_in_lineup", message: "Lineup is published and the player is not in the announced matchday squad." });
  if (lineup?.status === "confirmed_starter") warnings.push({ level: "info", code: "starter", message: "Confirmed starter for the next fixture." });

  return {
    playerId,
    player: profile?.player || null,
    leagueStatistics: leagueStat,
    team: leagueStat?.team || null,
    currentSquad: inCurrentSquad,
    injuries,
    transfers,
    latestTransfer: transfers?.[0]?.transfers?.[0] || transfers?.[0] || null,
    nextFixture,
    nextFixtures,
    lineup,
    standing,
    form,
    warnings,
    generatedAt: new Date().toISOString(),
    source: "API-Football Pro",
    teamName,
  };
}

export function registerFootballDataRoutes(app: Express) {
  app.get("/api/football/leagues", (_req, res) => {
    return res.json({ leagues: Object.entries(FOOTBALL_LEAGUES).map(([key, value]) => ({ key, ...value })) });
  });

  app.get("/api/football/coverage/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = requestedSeason(req.query.season);
      return res.json({ key: league.key, ...league.config, ...(await coverageFor(league.config.id, season)) });
    } catch (error: any) {
      return publicError(res, error, "Could not load API-Football coverage");
    }
  });

  app.get("/api/football/standings/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = requestedSeason(req.query.season);
      const result = await cachedProvider("standings", { league: league.config.id, season }, 60 * 60);
      const groups = result.payload?.response?.[0]?.league?.standings;
      return res.json({ league: league.config, season, standings: Array.isArray(groups?.[0]) ? groups[0] : [], groups: Array.isArray(groups) ? groups : [], cached: result.cached });
    } catch (error: any) {
      return publicError(res, error, "Could not load standings");
    }
  });

  app.get("/api/football/rounds/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = requestedSeason(req.query.season);
      const result = await cachedProvider("fixtures/rounds", { league: league.config.id, season, dates: true }, 12 * 60 * 60);
      return res.json({ league: league.config, season, rounds: responseRows(result.payload), cached: result.cached });
    } catch (error: any) {
      return publicError(res, error, "Could not load rounds");
    }
  });

  app.get("/api/football/fixtures/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = requestedSeason(req.query.season);
      const status = String(req.query.status || "upcoming").toLowerCase();
      const round = String(req.query.round || "").trim();
      const params: Record<string, string | number | undefined> = { league: league.config.id, season };
      let ttl = 10 * 60;
      if (round) {
        params.round = round;
        ttl = 10 * 60;
      } else if (status === "live") {
        // API_FOOTBALL_VALID_LIVE_FILTER_V1: API-Football accepts the literal
        // `all` (or a hyphen-delimited league-id string). Fetch all live games
        // and filter by league below so a provider validation change cannot
        // break the Premier League match centre again.
        delete params.league;
        delete params.season;
        params.live = "all";
        ttl = 20;
      } else if (status === "finished" || status === "completed") {
        params.last = Math.max(1, Math.min(40, Number(req.query.limit || 20)));
        ttl = 15 * 60;
      } else {
        params.next = Math.max(1, Math.min(40, Number(req.query.limit || 20)));
        ttl = 5 * 60;
      }
      let result: any = null;
      let providerFailure: any = null;
      try {
        result = await cachedProvider("fixtures", params, ttl);
      } catch (error: any) {
        if (league.config.id !== 39 || status !== "live" || round) throw error;
        providerFailure = error;
        console.warn("[football-data] Premier League live provider failed; checking saved/FPL matches:", error?.message || error);
      }

      let fixtures = result ? responseRows(result.payload).map(normalizeFixture) : [];
      if (status === "live" && !round) {
        fixtures = fixtures.filter((fixture: any) => Number(fixture.leagueId || 0) === league.config.id);
      }
      let fallback = false;
      if (league.config.id === 39 && status === "live" && !round) {
        const live = await resolvePremierLeagueLiveFixtures(fixtures, season);
        fixtures = live.fixtures;
        fallback = live.usedFallback || Boolean(providerFailure) || Boolean(result?.stale);
        // A successful FPL response with zero rows means there are simply no
        // Premier League matches in progress. Only expose an outage when both
        // providers failed and there is no saved matchday data to show.
        if (providerFailure && !fixtures.length && !live.fplAvailable && !live.savedFixtures.length) {
          throw providerFailure;
        }
      }

      const warning = fallback
        ? "API-Football is temporarily unavailable; official Premier League/FPL live scores and saved match details are being shown."
        : result?.warning || null;
      return res.json({
        league: league.config,
        season,
        status,
        round: round || null,
        fixtures,
        cached: Boolean(result?.cached),
        stale: Boolean(result?.stale || providerFailure),
        fallback,
        source: fallback ? "fpl-fallback" : "api-football",
        updatedAt: result?.updatedAt || new Date().toISOString(),
        warning,
      });
    } catch (error: any) {
      return publicError(res, error, "Could not load fixtures");
    }
  });

  app.get("/api/football/injuries/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = requestedSeason(req.query.season);
      const params: Record<string, string | number | undefined> = { league: league.config.id, season };
      const team = Number(req.query.team || 0);
      const player = Number(req.query.player || 0);
      const date = String(req.query.date || "").trim();
      if (team > 0) params.team = team;
      if (player > 0) params.player = player;
      if (date) params.date = date;
      const result = await cachedProvider("injuries", params, 4 * 60 * 60);
      return res.json({ league: league.config, season, injuries: responseRows(result.payload), cached: result.cached });
    } catch (error: any) {
      return publicError(res, error, "Could not load injuries and suspensions");
    }
  });

  app.get("/api/football/match/:leagueKey/:fixtureId", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const fixtureId = Number(req.params.fixtureId || 0);
    if (!fixtureId) return res.status(400).json({ message: "Invalid fixture" });
    const season = requestedSeason(req.query.season);
    try {
      const base = await cachedProvider("fixtures", { id: fixtureId }, 20);
      const fixtureRow = responseRows(base.payload)[0];
      if (!fixtureRow) {
        const fallback = league.config.id === 39 ? await fallbackPremierLeagueMatch(fixtureId, season) : null;
        if (fallback) return res.json(fallback);
        return res.status(404).json({ message: "Fixture not found" });
      }
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

      const [eventsResult, lineupsResult, statisticsResult, halfStatisticsResult, playersResult, predictionResult, h2hResult, injuryResult] = await Promise.all([
        embeddedEvents || fixtureCoverage.events === false ? Promise.resolve(null) : cachedProvider("fixtures/events", { fixture: fixtureId }, finished ? 12 * 60 * 60 : 30),
        embeddedLineups || fixtureCoverage.lineups === false ? Promise.resolve(null) : cachedProvider("fixtures/lineups", { fixture: fixtureId }, finished ? 12 * 60 * 60 : 2 * 60),
        embeddedStats || fixtureCoverage.statistics_fixtures === false ? Promise.resolve(null) : cachedProvider("fixtures/statistics", { fixture: fixtureId }, finished ? 12 * 60 * 60 : 60),
        fixtureCoverage.statistics_fixtures === false ? Promise.resolve(null) : cachedProvider("fixtures/statistics", { fixture: fixtureId, half: true }, finished ? 12 * 60 * 60 : 60).catch(() => null),
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
        halfStatistics: halfStatisticsResult ? responseRows(halfStatisticsResult.payload) : [],
        players: embeddedPlayers || (playersResult ? responseRows(playersResult.payload) : []),
        prediction: predictionResult ? responseRows(predictionResult.payload)[0] || null : null,
        headToHead: h2hResult ? responseRows(h2hResult.payload).map(normalizeFixture) : [],
        injuries: injuryResult ? responseRows(injuryResult.payload) : [],
        refreshAfterSeconds: ttl,
      });
    } catch (error: any) {
      if (league.config.id === 39) {
        const fallback = await fallbackPremierLeagueMatch(fixtureId, season).catch(() => null);
        if (fallback) return res.json(fallback);
      }
      return publicError(res, error, "Could not load match intelligence");
    }
  });

  app.get("/api/football/leaders/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    try {
      const season = requestedSeason(req.query.season);
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
      const season = requestedSeason(req.query.season);
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
      const season = requestedSeason(req.query.season);
      const [team, stats, coaches, recent, upcoming] = await Promise.all([
        cachedProvider("teams", { id: teamId }, 12 * 60 * 60),
        cachedProvider("teams/statistics", { league: league.config.id, season, team: teamId }, 12 * 60 * 60).catch(() => null),
        cachedProvider("coachs", { team: teamId }, 24 * 60 * 60).catch(() => null),
        cachedProvider("fixtures", { league: league.config.id, season, team: teamId, last: 5 }, 15 * 60),
        cachedProvider("fixtures", { league: league.config.id, season, team: teamId, next: 5 }, 15 * 60),
      ]);
      return res.json({
        league: league.config,
        season,
        team: responseRows(team.payload)[0] || null,
        statistics: stats?.payload?.response || null,
        coaches: coaches ? responseRows(coaches.payload) : [],
        recent: responseRows(recent.payload).map(normalizeFixture),
        upcoming: responseRows(upcoming.payload).map(normalizeFixture),
      });
    } catch (error: any) {
      return publicError(res, error, "Could not load club profile");
    }
  });

  app.get("/api/football/squad/:leagueKey/:teamId", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const teamId = Number(req.params.teamId || 0);
    if (!teamId) return res.status(400).json({ message: "Invalid team" });
    try {
      const result = await cachedProvider("players/squads", { team: teamId }, 12 * 60 * 60);
      const rows = responseRows(result.payload);
      const selected = rows.find((row: any) => Number(row?.team?.id || 0) === teamId) || rows[0] || null;
      return res.json({ league: league.config, team: selected?.team || null, players: Array.isArray(selected?.players) ? selected.players : [], cached: result.cached });
    } catch (error: any) {
      return publicError(res, error, "Could not load current squad");
    }
  });

  app.get("/api/football/team-transfers/:leagueKey/:teamId", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const teamId = Number(req.params.teamId || 0);
    if (!teamId) return res.status(400).json({ message: "Invalid team" });
    try {
      const result = await cachedProvider("transfers", { team: teamId }, 12 * 60 * 60);
      return res.json({ league: league.config, teamId, transfers: responseRows(result.payload), cached: result.cached });
    } catch (error: any) {
      return publicError(res, error, "Could not load club transfers");
    }
  });

  app.get("/api/football/venue/:leagueKey/:teamId", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const teamId = Number(req.params.teamId || 0);
    if (!teamId) return res.status(400).json({ message: "Invalid team" });
    try {
      const teamResult = await cachedProvider("teams", { id: teamId }, 12 * 60 * 60);
      const teamRow = responseRows(teamResult.payload)[0] || null;
      const venueId = Number(teamRow?.venue?.id || 0);
      const venueResult = venueId ? await cachedProvider("venues", { id: venueId }, 24 * 60 * 60).catch(() => null) : null;
      return res.json({ league: league.config, team: teamRow?.team || null, venue: venueResult ? responseRows(venueResult.payload)[0] || teamRow?.venue || null : teamRow?.venue || null });
    } catch (error: any) {
      return publicError(res, error, "Could not load stadium information");
    }
  });

  app.get("/api/football/coach/:coachId", async (req, res) => {
    const coachId = Number(req.params.coachId || 0);
    if (!coachId) return res.status(400).json({ message: "Invalid coach" });
    try {
      const [profile, trophies, sidelined] = await Promise.all([
        cachedProvider("coachs", { id: coachId }, 24 * 60 * 60),
        cachedProvider("trophies", { coach: coachId }, 24 * 60 * 60).catch(() => null),
        cachedProvider("sidelined", { coach: coachId }, 12 * 60 * 60).catch(() => null),
      ]);
      return res.json({ profile: responseRows(profile.payload)[0] || null, trophies: trophies ? responseRows(trophies.payload) : [], sidelined: sidelined ? responseRows(sidelined.payload) : [] });
    } catch (error: any) {
      return publicError(res, error, "Could not load coach profile");
    }
  });

  app.get("/api/football/players/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const search = String(req.query.search || "").trim();
    if (search.length < 3) return res.json({ league: league.config, players: [], message: "Enter at least 3 characters" });
    try {
      const season = requestedSeason(req.query.season);
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
      const season = requestedSeason(req.query.season);
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
      const teamId = Number(leagueStats?.team?.id || 0);
      const form = await loadPlayerForm(league.config.id, season, playerId, teamId).catch(() => ({ source: "unavailable", matches: [] }));
      return res.json({
        league: league.config,
        season,
        profile: selected,
        leagueStatistics: leagueStats,
        transfers: transfers ? responseRows(transfers.payload) : [],
        trophies: trophies ? responseRows(trophies.payload) : [],
        sidelined: sidelined ? responseRows(sidelined.payload) : [],
        form,
      });
    } catch (error: any) {
      return publicError(res, error, "Could not load player profile");
    }
  });

  app.get("/api/football/player-intelligence/:leagueKey/:playerId", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const playerId = Number(req.params.playerId || 0);
    if (!playerId) return res.status(400).json({ message: "Invalid player" });
    try {
      const season = requestedSeason(req.query.season);
      const intelligence = await buildPlayerIntelligence(league.config.id, season, playerId);
      if (!intelligence) return res.status(404).json({ message: "Player intelligence unavailable" });
      return res.json({ league: league.config, season, ...intelligence });
    } catch (error: any) {
      return publicError(res, error, "Could not load player intelligence");
    }
  });

  app.get("/api/football/lineup-intelligence/:leagueKey", async (req, res) => {
    const league = leagueFor(req.params.leagueKey);
    if (!league) return res.status(404).json({ message: "Unsupported league" });
    const ids = String(req.query.players || "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0)
      .slice(0, 5);
    if (!ids.length) return res.json({ league: league.config, players: [] });
    try {
      const season = requestedSeason(req.query.season);
      const players = await Promise.all(ids.map((playerId) => buildPlayerIntelligence(league.config.id, season, playerId).catch(() => null)));
      return res.json({ league: league.config, season, players: players.filter(Boolean), generatedAt: new Date().toISOString() });
    } catch (error: any) {
      return publicError(res, error, "Could not load lineup intelligence");
    }
  });
}

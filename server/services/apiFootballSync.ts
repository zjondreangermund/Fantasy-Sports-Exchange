import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "./fplApi.js";
import { apiFootballPhotoUrl, ensureApiFootballPlayerDirectorySchema, replaceApiFootballSquad } from "./apiFootballPlayerDirectory.js";

const BASE_URL = String(process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io").replace(/\/$/, "");
const API_KEY = String(process.env.API_FOOTBALL_KEY || "").trim();
const LEAGUE_ID = Math.max(1, Number(process.env.API_FOOTBALL_LEAGUE_ID || 39));
const DAILY_CAP = Math.max(10, Math.min(90, Number(process.env.API_FOOTBALL_DAILY_CAP || 90)));
const FIXTURE_SYNC_HOURS = Math.max(4, Math.min(12, Number(process.env.API_FOOTBALL_FIXTURE_SYNC_HOURS || 6)));
const LIVE_POLL_MINUTES = Math.max(10, Math.min(30, Number(process.env.API_FOOTBALL_LIVE_POLL_MINUTES || 15)));

// API_FOOTBALL_FREE_PLAN_SQUAD_FALLBACK_V1
const FREE_PLAN_REFERENCE_SEASON = Math.max(2022, Math.min(2024, Number(process.env.API_FOOTBALL_FREE_PLAN_REFERENCE_SEASON || 2024)));
const TEAM_NAME_ALIASES: Record<string, string[]> = {
  "afc bournemouth": ["bournemouth"],
  "brighton and hove albion": ["brighton", "brighton hove albion"],
  "leeds united": ["leeds"],
  "manchester city": ["man city"],
  "manchester united": ["man utd"],
  "newcastle united": ["newcastle"],
  "nottingham forest": ["nottm forest", "nott m forest"],
  "tottenham hotspur": ["tottenham", "spurs"],
  "west ham united": ["west ham"],
  "wolverhampton wanderers": ["wolverhampton", "wolves"],
};

export type SyncJobType = "fixtures" | "live" | "completed_stats" | "standings" | "teams" | "players";

type Budget = { cap: number; used: number; remaining: number; day: string };
type SyncResult = { jobType: SyncJobType; success: boolean; providerCalls: number; records: number; message: string; startedAt: string; finishedAt: string };

let schemaPromise: Promise<void> | null = null;
let schedulerStarted = false;
let playerImageProbeCache: { expiresAt: number; value: any } | null = null;

async function probeApiFootballPlayerImage(force = false) {
  if (!force && playerImageProbeCache && playerImageProbeCache.expiresAt > Date.now()) return playerImageProbeCache.value;
  const row = rowsOf(await db.execute(sql`
    select api_player_id as "apiPlayerId", photo
    from app.api_football_players
    where season=${seasonNow()} and active=true and coalesce(photo,'') <> ''
    order by updated_at desc, api_player_id asc
    limit 1
  `))[0];
  if (!row) {
    const value = { checked: false, reachable: false, status: null, contentType: null, host: "media.api-sports.io", reason: "No stored API-Football player photo is available yet" };
    playerImageProbeCache = { expiresAt: Date.now() + 60_000, value };
    return value;
  }
  const url = apiFootballPhotoUrl(row.apiPlayerId, row.photo);
  let value: any;
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8", "User-Agent": "FantasyArena/1.0" }, signal: AbortSignal.timeout(8000) });
    const contentType = String(response.headers.get("content-type") || "");
    value = { checked: true, reachable: response.ok && contentType.startsWith("image/"), status: response.status, contentType, host: new URL(url).hostname };
    try { await response.body?.cancel(); } catch {}
  } catch (error: any) {
    value = { checked: true, reachable: false, status: null, contentType: null, host: "media.api-sports.io", reason: error?.message || "Image request failed" };
  }
  playerImageProbeCache = { expiresAt: Date.now() + 15 * 60_000, value };
  return value;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function seasonNow() {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function normalizeClubName(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:football club|fc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clubKeys(value: unknown) {
  const normalized = normalizeClubName(value);
  if (!normalized) return new Set<string>();
  const keys = new Set<string>([normalized]);
  for (const alias of TEAM_NAME_ALIASES[normalized] || []) keys.add(normalizeClubName(alias));
  for (const [canonical, aliases] of Object.entries(TEAM_NAME_ALIASES)) {
    if (aliases.some((alias) => normalizeClubName(alias) === normalized)) {
      keys.add(canonical);
      for (const alias of aliases) keys.add(normalizeClubName(alias));
    }
  }
  return keys;
}

function sameClub(left: unknown, right: unknown) {
  const leftKeys = clubKeys(left);
  const rightKeys = clubKeys(right);
  return [...leftKeys].some((key) => rightKeys.has(key));
}

function selectExactClub(rows: any[], requestedName: unknown) {
  const matches = rows
    .map((row: any) => row?.team || row)
    .filter((team: any) => team?.id && sameClub(team?.name, requestedName));
  return matches.length === 1 ? matches[0] : null;
}

function isFreePlanSeasonRestriction(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return message.includes("free plans do not have access to this season") || message.includes("try from 2022 to 2024");
}

async function discoverCurrentSquadTeams() {
  const bootstrap = await fplApi.bootstrap();
  const currentFplTeams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const historicalPayload = await providerGet("teams", { league: LEAGUE_ID, season: FREE_PLAN_REFERENCE_SEASON });
  const historicalRows = Array.isArray(historicalPayload?.response) ? historicalPayload.response : [];
  const candidates = historicalRows.map((row: any) => row?.team || row).filter((team: any) => team?.id);
  let calls = 1;

  for (const team of candidates) await upsertTeam(team);

  const resolved: any[] = [];
  const unresolvedTeams: string[] = [];
  const usedIds = new Set<number>();

  for (const fplTeam of currentFplTeams) {
    const requestedName = String(fplTeam?.name || fplTeam?.short_name || "").trim();
    if (!requestedName) continue;

    let matched = selectExactClub(candidates, requestedName);
    if (!matched) {
      const searchPayload = await providerGet("teams", { search: requestedName });
      calls += 1;
      const searchRows = Array.isArray(searchPayload?.response) ? searchPayload.response : [];
      matched = selectExactClub(searchRows, requestedName);
      if (matched) {
        candidates.push(matched);
        await upsertTeam(matched);
      }
    }

    const teamId = Number(matched?.id || 0);
    if (!teamId || usedIds.has(teamId)) {
      unresolvedTeams.push(requestedName);
      continue;
    }
    usedIds.add(teamId);
    resolved.push({ team: matched, fplTeamName: requestedName });
  }

  return {
    teamRows: resolved,
    calls,
    mode: "free-plan-reference-season-plus-team-search",
    referenceSeason: FREE_PLAN_REFERENCE_SEASON,
    fplTeams: currentFplTeams.length,
    unresolvedTeams,
  };
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

export function ensureApiFootballSyncSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute(sql`create schema if not exists app`);
      await ensureApiFootballPlayerDirectorySchema();
      await db.execute(sql`
        create table if not exists app.api_football_usage (
          usage_day date primary key,
          requests integer not null default 0,
          updated_at timestamptz not null default now()
        )
      `);
      await db.execute(sql`
        create table if not exists app.api_football_sync_runs (
          id bigserial primary key,
          job_type text not null,
          status text not null,
          provider_calls integer not null default 0,
          records_processed integer not null default 0,
          message text,
          details jsonb not null default '{}'::jsonb,
          started_at timestamptz not null default now(),
          finished_at timestamptz
        )
      `);
      await db.execute(sql`
        create table if not exists app.api_football_teams (
          api_team_id integer primary key,
          name text not null,
          code text,
          country text,
          logo text,
          venue jsonb,
          raw jsonb not null default '{}'::jsonb,
          updated_at timestamptz not null default now()
        )
      `);
      await db.execute(sql`
        create table if not exists app.api_football_fixtures (
          api_fixture_id integer primary key,
          league_id integer not null,
          season integer not null,
          round text,
          kickoff_at timestamptz,
          timezone text,
          status_short text,
          status_long text,
          elapsed integer,
          home_team_id integer,
          away_team_id integer,
          home_score integer,
          away_score integer,
          venue jsonb,
          raw jsonb not null default '{}'::jsonb,
          stats_synced_at timestamptz,
          updated_at timestamptz not null default now()
        )
      `);
      await db.execute(sql`
        create table if not exists app.api_football_player_match_stats (
          api_fixture_id integer not null,
          api_team_id integer not null,
          api_player_id integer not null,
          player_name text,
          position text,
          minutes integer,
          rating numeric,
          fantasy_score numeric,
          decisive_score numeric,
          all_around_score numeric,
          statistics jsonb not null default '{}'::jsonb,
          raw jsonb not null default '{}'::jsonb,
          synced_at timestamptz not null default now(),
          primary key (api_fixture_id, api_player_id)
        )
      `);
      await db.execute(sql`
        create table if not exists app.api_football_standings (
          league_id integer not null,
          season integer not null,
          rank integer not null,
          api_team_id integer not null,
          points integer,
          goals_diff integer,
          form text,
          raw jsonb not null default '{}'::jsonb,
          updated_at timestamptz not null default now(),
          primary key (league_id, season, api_team_id)
        )
      `);
      await db.execute(sql`create index if not exists api_football_fixture_kickoff_idx on app.api_football_fixtures (kickoff_at)`);
      await db.execute(sql`create index if not exists api_football_fixture_status_idx on app.api_football_fixtures (status_short)`);
      await db.execute(sql`create index if not exists api_football_sync_runs_started_idx on app.api_football_sync_runs (started_at desc)`);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export async function getApiFootballBudget(): Promise<Budget> {
  await ensureApiFootballSyncSchema();
  const day = utcDay();
  const row = rowsOf(await db.execute(sql`select requests::int as requests from app.api_football_usage where usage_day=${day}::date`))[0];
  const used = Number(row?.requests || 0);
  return { cap: DAILY_CAP, used, remaining: Math.max(0, DAILY_CAP - used), day };
}

async function reserveProviderCall() {
  await ensureApiFootballSyncSchema();
  const day = utcDay();
  const row = rowsOf(await db.execute(sql`
    insert into app.api_football_usage (usage_day, requests, updated_at)
    values (${day}::date, 1, now())
    on conflict (usage_day) do update
      set requests=app.api_football_usage.requests+1, updated_at=now()
      where app.api_football_usage.requests < ${DAILY_CAP}
    returning requests::int as requests
  `))[0];
  if (!row) throw new Error(`Daily API-Football safety cap reached (${DAILY_CAP}).`);
}

async function providerGet(path: string, params: Record<string, string | number | undefined>) {
  if (!API_KEY) throw new Error("API_FOOTBALL_KEY is not configured");
  await reserveProviderCall();
  const url = new URL(`${BASE_URL}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers: { Accept: "application/json", "x-apisports-key": API_KEY, "User-Agent": "FantasyArena/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || (payload?.errors && Object.keys(payload.errors).length)) {
    throw new Error(typeof payload?.errors === "object" ? JSON.stringify(payload.errors) : `API-Football ${response.status}`);
  }
  return payload;
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
  const goalValue = position === "G" || position === "D" ? 15 : position === "M" ? 12 : 10;
  const decisive = Math.max(0, Math.min(80,
    (minutes > 0 ? 35 : 0) + Number(goals.total || 0) * goalValue + Number(goals.assists || 0) * 9 + Number(penalty.saved || 0) * 15 - Number(penalty.missed || 0) * 8 - Number(cards.red || 0) * 15,
  ));
  const allAround = Math.max(-15, Math.min(45,
    Math.min(8, Number(passes.total || 0) / 12) + Number(passes.key || 0) * 2.2 + Number(tackles.total || 0) * 1.4 + Number(tackles.interceptions || 0) * 1.6 + Number(duels.won || 0) * 0.65 + Number(shots.on || 0) * 1.5 + Number(goals.saves || 0) * 1.2 - Number(cards.yellow || 0) * 2,
  ));
  return { score: Math.max(0, Math.min(100, Math.round((decisive + allAround) * 10) / 10)), decisive: Math.round(decisive * 10) / 10, allAround: Math.round(allAround * 10) / 10 };
}

async function beginRun(jobType: SyncJobType) {
  const row = rowsOf(await db.execute(sql`
    insert into app.api_football_sync_runs (job_type,status,started_at)
    values (${jobType},'running',now()) returning id, started_at
  `))[0];
  return row;
}

async function finishRun(id: any, status: "success" | "failed" | "skipped" | "partial", calls: number, records: number, message: string, details: any = {}) {
  await db.execute(sql`
    update app.api_football_sync_runs set status=${status}, provider_calls=${calls}, records_processed=${records}, message=${message}, details=${JSON.stringify(details)}::jsonb, finished_at=now()
    where id=${id}
  `);
}

async function withJobLock<T>(jobType: SyncJobType, task: () => Promise<T>): Promise<T | null> {
  const lockName = `fantasy-arena-api-football-${jobType}`;
  const locked = Boolean(rowsOf(await db.execute(sql`select pg_try_advisory_lock(hashtext(${lockName})) as locked`))[0]?.locked);
  if (!locked) return null;
  try { return await task(); }
  finally { await db.execute(sql`select pg_advisory_unlock(hashtext(${lockName}))`); }
}

async function upsertTeam(team: any) {
  if (!team?.id) return;
  await db.execute(sql`
    insert into app.api_football_teams (api_team_id,name,code,country,logo,raw,updated_at)
    values (${Number(team.id)},${String(team.name || "Unknown")},${team.code || null},${team.country || null},${team.logo || null},${JSON.stringify(team)}::jsonb,now())
    on conflict (api_team_id) do update set name=excluded.name,code=excluded.code,country=excluded.country,logo=excluded.logo,raw=excluded.raw,updated_at=now()
  `);
}

async function upsertFixtures(fixtures: any[]) {
  let records = 0;
  for (const row of fixtures) {
    const fixture = row?.fixture || {};
    const league = row?.league || {};
    const teams = row?.teams || {};
    const goals = row?.goals || {};
    await upsertTeam(teams.home);
    await upsertTeam(teams.away);
    if (!fixture.id) continue;
    await db.execute(sql`
      insert into app.api_football_fixtures (
        api_fixture_id,league_id,season,round,kickoff_at,timezone,status_short,status_long,elapsed,home_team_id,away_team_id,home_score,away_score,venue,raw,updated_at
      ) values (
        ${Number(fixture.id)},${Number(league.id || LEAGUE_ID)},${Number(league.season || seasonNow())},${league.round || null},${fixture.date ? new Date(fixture.date) : null},${fixture.timezone || null},${fixture.status?.short || null},${fixture.status?.long || null},${fixture.status?.elapsed ?? null},${teams.home?.id ? Number(teams.home.id) : null},${teams.away?.id ? Number(teams.away.id) : null},${goals.home ?? null},${goals.away ?? null},${JSON.stringify(fixture.venue || {})}::jsonb,${JSON.stringify(row)}::jsonb,now()
      ) on conflict (api_fixture_id) do update set
        league_id=excluded.league_id,season=excluded.season,round=excluded.round,kickoff_at=excluded.kickoff_at,timezone=excluded.timezone,status_short=excluded.status_short,status_long=excluded.status_long,elapsed=excluded.elapsed,home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,home_score=excluded.home_score,away_score=excluded.away_score,venue=excluded.venue,raw=excluded.raw,updated_at=now()
    `);
    records += 1;
  }
  return records;
}

async function syncFixtures(): Promise<{ calls: number; records: number; details: any }> {
  const payload = await providerGet("fixtures", { league: LEAGUE_ID, season: seasonNow(), from: isoDate(-2), to: isoDate(21) });
  const fixtures = Array.isArray(payload?.response) ? payload.response : [];
  return { calls: 1, records: await upsertFixtures(fixtures), details: { from: isoDate(-2), to: isoDate(21) } };
}

async function syncLive(): Promise<{ calls: number; records: number; details: any }> {
  const possibleLive = Number(rowsOf(await db.execute(sql`
    select count(*)::int as count from app.api_football_fixtures
    where kickoff_at between now()-interval '3 hours' and now()+interval '30 minutes'
      and coalesce(status_short,'NS') not in ('FT','AET','PEN','PST','CANC','ABD','AWD','WO')
  `))[0]?.count || 0);
  if (!possibleLive) return { calls: 0, records: 0, details: { reason: "No scheduled live window" } };
  const payload = await providerGet("fixtures", { league: LEAGUE_ID, season: seasonNow(), live: "all" });
  const fixtures = Array.isArray(payload?.response) ? payload.response : [];
  return { calls: 1, records: await upsertFixtures(fixtures), details: { possibleLive } };
}

async function syncCompletedStats(): Promise<{ calls: number; records: number; details: any }> {
  const budget = await getApiFootballBudget();
  const maxFixtures = Math.max(0, Math.min(8, budget.remaining - 10));
  if (!maxFixtures) return { calls: 0, records: 0, details: { reason: "Emergency buffer protected" } };
  const fixtures = rowsOf(await db.execute(sql`
    select api_fixture_id from app.api_football_fixtures
    where status_short in ('FT','AET','PEN') and stats_synced_at is null
    order by kickoff_at asc limit ${maxFixtures}
  `));
  let calls = 0;
  let records = 0;
  for (const fixture of fixtures) {
    const fixtureId = Number(fixture.api_fixture_id);
    const payload = await providerGet("fixtures/players", { fixture: fixtureId });
    calls += 1;
    const teams = Array.isArray(payload?.response) ? payload.response : [];
    for (const teamRow of teams) {
      const teamId = Number(teamRow?.team?.id || 0);
      await upsertTeam(teamRow?.team);
      for (const playerRow of Array.isArray(teamRow?.players) ? teamRow.players : []) {
        const player = playerRow?.player || {};
        const statistic = Array.isArray(playerRow?.statistics) ? playerRow.statistics[0] || {} : {};
        if (!player.id) continue;
        const score = scorePreview(statistic);
        await db.execute(sql`
          insert into app.api_football_player_match_stats (
            api_fixture_id,api_team_id,api_player_id,player_name,position,minutes,rating,fantasy_score,decisive_score,all_around_score,statistics,raw,synced_at
          ) values (
            ${fixtureId},${teamId},${Number(player.id)},${player.name || null},${statistic?.games?.position || null},${Number(statistic?.games?.minutes || 0)},${statistic?.games?.rating ? Number(statistic.games.rating) : null},${score.score},${score.decisive},${score.allAround},${JSON.stringify(statistic)}::jsonb,${JSON.stringify(playerRow)}::jsonb,now()
          ) on conflict (api_fixture_id,api_player_id) do update set
            api_team_id=excluded.api_team_id,player_name=excluded.player_name,position=excluded.position,minutes=excluded.minutes,rating=excluded.rating,fantasy_score=excluded.fantasy_score,decisive_score=excluded.decisive_score,all_around_score=excluded.all_around_score,statistics=excluded.statistics,raw=excluded.raw,synced_at=now()
        `);
        records += 1;
      }
    }
    await db.execute(sql`update app.api_football_fixtures set stats_synced_at=now(),updated_at=now() where api_fixture_id=${fixtureId}`);
  }
  return { calls, records, details: { fixtures: fixtures.length } };
}

// API_FOOTBALL_INCREMENTAL_SQUAD_SYNC_V1
async function syncPlayers(): Promise<{ calls: number; records: number; details: any }> {
  const season = seasonNow();
  const recentComplete = rowsOf(await db.execute(sql`
    select finished_at
    from app.api_football_sync_runs
    where job_type='players'
      and status='success'
      and coalesce((details->>'complete')::boolean, false)=true
      and finished_at > now()-interval '18 hours'
    order by finished_at desc
    limit 1
  `))[0];
  if (recentComplete) {
    return {
      calls: 0,
      records: 0,
      details: {
        complete: true,
        reason: "All current Premier League squads were refreshed within the last 18 hours",
      },
    };
  }

  const budget = await getApiFootballBudget();
  if (budget.remaining <= 12) {
    return {
      calls: 0,
      records: 0,
      details: {
        complete: false,
        reason: "Player directory sync is waiting for enough API-Football requests above the 10-call safety reserve",
        budgetStopped: true,
        remainingRequests: budget.remaining,
      },
    };
  }

  let discovery: any;
  try {
    const teamsPayload = await providerGet("teams", { league: LEAGUE_ID, season });
    const currentRows = Array.isArray(teamsPayload?.response) ? teamsPayload.response : [];
    if (!currentRows.length) throw new Error("Current-season team lookup returned no teams");
    discovery = {
      teamRows: currentRows,
      calls: 1,
      mode: "current-season-league",
      referenceSeason: season,
      fplTeams: currentRows.length,
      unresolvedTeams: [],
    };
  } catch (error: any) {
    if (!isFreePlanSeasonRestriction(error) && !String(error?.message || "").includes("returned no teams")) throw error;
    discovery = await discoverCurrentSquadTeams();
    discovery.calls += 1;
    discovery.currentSeasonError = String(error?.message || error || "Current-season lookup unavailable");
  }

  const teamRows = Array.isArray(discovery?.teamRows) ? discovery.teamRows : [];
  const coverageRows = rowsOf(await db.execute(sql`
    select api_team_id as "apiTeamId",
           count(*)::int as players,
           count(*) filter (where coalesce(photo,'') <> '')::int as photos,
           max(updated_at) as "lastUpdated"
    from app.api_football_players
    where season=${season} and active=true
    group by api_team_id
  `));
  const coverage = new Map<number, { players: number; photos: number; lastUpdated: number }>();
  for (const row of coverageRows) {
    coverage.set(Number(row.apiTeamId || 0), {
      players: Number(row.players || 0),
      photos: Number(row.photos || 0),
      lastUpdated: row.lastUpdated ? new Date(row.lastUpdated).getTime() : 0,
    });
  }

  const freshAfter = Date.now() - 18 * 60 * 60 * 1000;
  const teamIdOf = (row: any) => Number((row?.team || row || {})?.id || 0);
  const isFreshSquad = (teamId: number) => {
    const item = coverage.get(teamId);
    return Boolean(item && item.players >= 15 && item.photos >= 15 && item.lastUpdated >= freshAfter);
  };
  const orderedTeamRows = [...teamRows].sort((left, right) => Number(isFreshSquad(teamIdOf(left))) - Number(isFreshSquad(teamIdOf(right))));

  let calls = Number(discovery?.calls || 0);
  let records = 0;
  let teamsProcessed = 0;
  let teamsAlreadyCurrent = 0;
  let budgetStopped = false;
  const squadFailures: Array<{ team: string; message: string }> = [];

  for (const teamRow of orderedTeamRows) {
    const team = teamRow?.team || teamRow || {};
    const teamId = Number(team?.id || 0);
    if (!teamId) continue;

    if (isFreshSquad(teamId)) {
      teamsAlreadyCurrent += 1;
      continue;
    }

    const currentBudget = await getApiFootballBudget();
    if (currentBudget.remaining <= 10) {
      budgetStopped = true;
      break;
    }

    try {
      await upsertTeam(team);
      const squadPayload = await providerGet("players/squads", { team: teamId });
      calls += 1;
      const response = Array.isArray(squadPayload?.response) ? squadPayload.response : [];
      const squad = response.find((item: any) => Number(item?.team?.id || 0) === teamId) || response[0] || {};
      const squadTeam = squad?.team || team;
      const players = Array.isArray(squad?.players) ? squad.players : [];
      if (!players.length) {
        squadFailures.push({ team: String(team.name || teamId), message: "Squad endpoint returned no players" });
        continue;
      }
      records += await replaceApiFootballSquad(season, squadTeam, players);
      teamsProcessed += 1;
    } catch (error: any) {
      calls += 1;
      squadFailures.push({ team: String(team.name || teamId), message: String(error?.message || error || "Squad sync failed") });
    }
  }

  const unresolvedTeams = Array.isArray(discovery?.unresolvedTeams) ? discovery.unresolvedTeams : [];
  const completedTeams = teamsProcessed + teamsAlreadyCurrent;
  const pendingTeams = Math.max(0, teamRows.length - completedTeams);
  const complete = teamRows.length > 0 && pendingTeams === 0 && unresolvedTeams.length === 0 && squadFailures.length === 0 && !budgetStopped;

  const photoCounts = rowsOf(await db.execute(sql`
    select count(*)::int as players,
           count(*) filter (where coalesce(photo,'') <> '')::int as photos
    from app.api_football_players
    where season=${season} and active=true
  `))[0] || {};
  const imageProbe = await probeApiFootballPlayerImage(true);

  return {
    calls,
    records,
    details: {
      complete,
      season,
      discoveryMode: discovery?.mode || "unknown",
      referenceSeason: discovery?.referenceSeason || null,
      currentSeasonError: discovery?.currentSeasonError || null,
      teamsAvailable: teamRows.length,
      fplTeams: Number(discovery?.fplTeams || teamRows.length),
      unresolvedTeams,
      teamsProcessed,
      teamsAlreadyCurrent,
      completedTeams,
      pendingTeams,
      budgetStopped,
      squadFailures,
      playersStored: Number(photoCounts.players || 0),
      photosStored: Number(photoCounts.photos || 0),
      photoCoveragePercent: Number(photoCounts.players || 0)
        ? Math.round((Number(photoCounts.photos || 0) / Number(photoCounts.players || 1)) * 100)
        : 0,
      imageProbe,
    },
  };
}

async function syncStandings(): Promise<{ calls: number; records: number; details: any }> {
  const payload = await providerGet("standings", { league: LEAGUE_ID, season: seasonNow() });
  const groups = payload?.response?.[0]?.league?.standings;
  const rows = Array.isArray(groups?.[0]) ? groups[0] : [];
  let records = 0;
  for (const item of rows) {
    const team = item?.team || {};
    await upsertTeam(team);
    if (!team.id) continue;
    await db.execute(sql`
      insert into app.api_football_standings (league_id,season,rank,api_team_id,points,goals_diff,form,raw,updated_at)
      values (${LEAGUE_ID},${seasonNow()},${Number(item.rank || 0)},${Number(team.id)},${item.points ?? null},${item.goalsDiff ?? null},${item.form || null},${JSON.stringify(item)}::jsonb,now())
      on conflict (league_id,season,api_team_id) do update set rank=excluded.rank,points=excluded.points,goals_diff=excluded.goals_diff,form=excluded.form,raw=excluded.raw,updated_at=now()
    `);
    records += 1;
  }
  return { calls: 1, records, details: {} };
}

export async function runApiFootballSync(jobType: SyncJobType): Promise<SyncResult> {
  await ensureApiFootballSyncSchema();
  const startedAt = new Date().toISOString();
  const run = await beginRun(jobType);
  try {
    const result = await withJobLock(jobType, async () => {
      if (jobType === "fixtures" || jobType === "teams") return syncFixtures();
      if (jobType === "live") return syncLive();
      if (jobType === "completed_stats") return syncCompletedStats();
      if (jobType === "players") return syncPlayers();
      return syncStandings();
    });
    if (!result) {
      await finishRun(run.id, "skipped", 0, 0, "Another instance is already running this job.");
      return { jobType, success: true, providerCalls: 0, records: 0, message: "Already running", startedAt, finishedAt: new Date().toISOString() };
    }
    const isPartialPlayerSync = jobType === "players" && result.details?.complete === false;
    const isSkipped = !isPartialPlayerSync && result.calls === 0 && Boolean(result.details?.reason);
    const runStatus = isPartialPlayerSync ? "partial" : isSkipped ? "skipped" : "success";
    const message = isPartialPlayerSync
      ? `Partial current-squad sync: ${result.records} players processed; ${Number(result.details?.pendingTeams || 0)} club squad(s) still pending.`
      : result.calls
        ? `Processed ${result.records} records using ${result.calls} provider call${result.calls === 1 ? "" : "s"}.`
        : String(result.details?.reason || "No provider call was needed.");
    await finishRun(run.id, runStatus, result.calls, result.records, message, result.details);
    return { jobType, success: true, providerCalls: result.calls, records: result.records, message, startedAt, finishedAt: new Date().toISOString() };
  } catch (error: any) {
    await finishRun(run.id, "failed", 0, 0, error?.message || "Sync failed");
    throw error;
  }
}

export async function getApiFootballSyncSummary() {
  await ensureApiFootballSyncSchema();
  const budget = await getApiFootballBudget();
  const counts = rowsOf(await db.execute(sql`
    select
      (select count(*)::int from app.api_football_fixtures) as fixtures,
      (select count(*)::int from app.api_football_teams) as teams,
      (select count(*)::int from app.api_football_player_match_stats) as player_stats,
      (select count(*)::int from app.api_football_players where season=${seasonNow()} and active=true) as players,
      (select count(*)::int from app.api_football_players where season=${seasonNow()} and active=true and coalesce(photo,'') <> '') as player_photos,
      (select count(*)::int from app.api_football_standings where league_id=${LEAGUE_ID} and season=${seasonNow()}) as standings
  `))[0] || {};
  const lastRuns = rowsOf(await db.execute(sql`
    select id,job_type as "jobType",status,provider_calls as "providerCalls",records_processed as "recordsProcessed",message,details,started_at as "startedAt",finished_at as "finishedAt"
    from app.api_football_sync_runs order by started_at desc limit 30
  `));
  const lastFixtureRun = lastRuns.find((run) => run.jobType === "fixtures" && run.status === "success");
  const nextFixtureSync = lastFixtureRun?.finishedAt ? new Date(new Date(lastFixtureRun.finishedAt).getTime() + FIXTURE_SYNC_HOURS * 3600000).toISOString() : new Date().toISOString();
  return {
    configured: Boolean(API_KEY), leagueId: LEAGUE_ID, season: seasonNow(), budget,
    schedule: { fixtureSyncHours: FIXTURE_SYNC_HOURS, livePollMinutes: LIVE_POLL_MINUTES, nextFixtureSync },
    counts: { fixtures: Number(counts.fixtures || 0), teams: Number(counts.teams || 0), players: Number(counts.players || 0), playerPhotos: Number(counts.player_photos || 0), playersWithoutPhotos: Math.max(0, Number(counts.players || 0) - Number(counts.player_photos || 0)), photoCoveragePercent: Number(counts.players || 0) ? Math.round((Number(counts.player_photos || 0) / Number(counts.players || 1)) * 100) : 0, playerStats: Number(counts.player_stats || 0), standings: Number(counts.standings || 0) },
    lastRuns,
  };
}

export async function getApiFootballPlayerImageHealth(options: { probe?: boolean } = {}) {
  await ensureApiFootballSyncSchema();
  const season = seasonNow();
  const counts = rowsOf(await db.execute(sql`
    select count(*)::int as players, count(*) filter (where coalesce(photo,'') <> '')::int as photos, max(updated_at) as "lastDirectoryUpdate"
    from app.api_football_players where season=${season} and active=true
  `))[0] || {};
  const lastRun = rowsOf(await db.execute(sql`
    select status, message, details, started_at as "startedAt", finished_at as "finishedAt"
    from app.api_football_sync_runs where job_type='players' order by started_at desc limit 1
  `))[0] || null;
  const players = Number(counts.players || 0);
  const photos = Number(counts.photos || 0);
  const imageProbe = options.probe === false ? (playerImageProbeCache?.value || null) : await probeApiFootballPlayerImage(false);
  const currentSquadsComplete = Boolean(lastRun?.details?.complete);
  return { service: "api-football-player-images", configured: Boolean(API_KEY), provider: "API-Football", season, players, photos, missingPhotos: Math.max(0, players - photos), coveragePercent: players ? Math.round((photos / players) * 100) : 0, currentSquadsComplete, completedTeams: Number(lastRun?.details?.completedTeams || 0), pendingTeams: Number(lastRun?.details?.pendingTeams || 0), unresolvedTeams: Array.isArray(lastRun?.details?.unresolvedTeams) ? lastRun.details.unresolvedTeams : [], squadFailures: Array.isArray(lastRun?.details?.squadFailures) ? lastRun.details.squadFailures : [], lastDirectoryUpdate: counts.lastDirectoryUpdate ? new Date(counts.lastDirectoryUpdate).toISOString() : null, lastSync: lastRun, imageProbe, healthy: Boolean(API_KEY && currentSquadsComplete && players > 0 && photos > 0 && imageProbe?.reachable) };
}

export function startApiFootballSyncScheduler() {
  if (schedulerStarted || process.env.API_FOOTBALL_SYNC_ENABLED === "false") return;
  schedulerStarted = true;
  const safeRun = async (type: SyncJobType) => {
    try {
      const budget = await getApiFootballBudget();
      if (!API_KEY || budget.remaining <= 10) return;
      await runApiFootballSync(type);
    } catch (error: any) {
      console.warn(`[api-football-sync] ${type} failed:`, error?.message || error);
    }
  };
  setTimeout(() => safeRun("fixtures"), 20_000);
  setTimeout(() => safeRun("players"), 60_000);
  setInterval(() => safeRun("fixtures"), FIXTURE_SYNC_HOURS * 3600000);
  setInterval(() => safeRun("live"), LIVE_POLL_MINUTES * 60000);
  setInterval(() => safeRun("completed_stats"), 60 * 60000);
  setInterval(() => safeRun("standings"), 12 * 3600000);
  setInterval(() => safeRun("players"), 2 * 3600000);
  console.log(`[api-football-sync] scheduler active: fixtures ${FIXTURE_SYNC_HOURS}h, players 2h until complete, live ${LIVE_POLL_MINUTES}m, daily cap ${DAILY_CAP}`);
}

import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, source) => fs.writeFileSync(file, source);

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`API-Football Pro patch anchor not found: ${label}`);
  return source.replace(from, to);
}

function insertBefore(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`API-Football Pro patch anchor not found: ${label}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`API-Football Pro patch anchor not found: ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function patchFile(file, transform) {
  const source = read(file);
  const next = transform(source);
  if (next !== source) write(file, next);
}

const lines = (...items) => items.join("\n");

patchFile("server/services/apiFootballSync.ts", (original) => {
  if (original.includes("API_FOOTBALL_PRO_MODE_V1")) return original;
  let source = original;

  source = replaceOnce(
    source,
    lines(
      'const DAILY_CAP = Math.max(10, Math.min(90, Number(process.env.API_FOOTBALL_DAILY_CAP || 90)));',
      'const FIXTURE_SYNC_HOURS = Math.max(4, Math.min(12, Number(process.env.API_FOOTBALL_FIXTURE_SYNC_HOURS || 6)));',
      'const LIVE_POLL_MINUTES = Math.max(10, Math.min(30, Number(process.env.API_FOOTBALL_LIVE_POLL_MINUTES || 15)));',
    ),
    lines(
      '// API_FOOTBALL_PRO_MODE_V1',
      'const DAILY_CAP = Math.max(100, Math.min(7400, Number(process.env.API_FOOTBALL_DAILY_CAP || 7000)));',
      'const EMERGENCY_RESERVE = Math.max(10, Math.min(1000, Number(process.env.API_FOOTBALL_EMERGENCY_RESERVE || 500)));',
      'const FIXTURE_SYNC_HOURS = Math.max(1, Math.min(12, Number(process.env.API_FOOTBALL_FIXTURE_SYNC_HOURS || 2)));',
      'const LIVE_POLL_MINUTES = Math.max(1, Math.min(5, Number(process.env.API_FOOTBALL_LIVE_POLL_MINUTES || 1)));',
      'const COMPLETED_STATS_MINUTES = Math.max(5, Math.min(60, Number(process.env.API_FOOTBALL_COMPLETED_STATS_MINUTES || 10)));',
      'const LINEUPS_POLL_MINUTES = Math.max(2, Math.min(15, Number(process.env.API_FOOTBALL_LINEUPS_POLL_MINUTES || 5)));',
      'const INJURY_SYNC_MINUTES = Math.max(30, Math.min(360, Number(process.env.API_FOOTBALL_INJURY_SYNC_MINUTES || 60)));',
      'const TRANSFER_SYNC_HOURS = Math.max(2, Math.min(24, Number(process.env.API_FOOTBALL_TRANSFER_SYNC_HOURS || 6)));',
      'const STANDINGS_SYNC_MINUTES = Math.max(30, Math.min(180, Number(process.env.API_FOOTBALL_STANDINGS_SYNC_MINUTES || 60)));',
    ),
    "Pro mode constants",
  );

  source = replaceOnce(
    source,
    'export type SyncJobType = "fixtures" | "live" | "completed_stats" | "standings" | "teams" | "players";',
    'export type SyncJobType = "fixtures" | "live" | "completed_stats" | "standings" | "teams" | "players" | "lineups" | "injuries" | "transfers";',
    "Pro sync job union",
  );

  source = replaceOnce(
    source,
    'type Budget = { cap: number; used: number; remaining: number; day: string };',
    'type Budget = { cap: number; configuredCap: number; used: number; remaining: number; day: string; providerLimit: number | null; providerRemaining: number | null; providerReserve: number; minuteLimit: number | null; minuteRemaining: number | null; providerPlan: string; observedAt: string | null };',
    "provider-aware budget type",
  );

  const schemaAnchor = '      await db.execute(sql`create index if not exists api_football_fixture_kickoff_idx on app.api_football_fixtures (kickoff_at)`);';
  const proSchema = lines(
    '      // API_FOOTBALL_PRO_SCHEMA_V1',
    '      await db.execute(sql`',
    '        create table if not exists app.api_football_provider_quota (',
    '          id integer primary key default 1 check (id = 1),',
    '          daily_limit integer,',
    '          daily_remaining integer,',
    '          minute_limit integer,',
    '          minute_remaining integer,',
    '          provider_plan text,',
    '          observed_at timestamptz not null default now()',
    '        )',
    '      `);',
    '      await db.execute(sql`alter table app.api_football_fixtures add column if not exists lineups_synced_at timestamptz`);',
    '      await db.execute(sql`',
    '        create table if not exists app.api_football_lineups (',
    '          api_fixture_id integer not null,',
    '          api_team_id integer not null,',
    '          formation text,',
    '          coach jsonb,',
    "          start_xi jsonb not null default '[]'::jsonb,",
    "          substitutes jsonb not null default '[]'::jsonb,",
    "          raw jsonb not null default '{}'::jsonb,",
    '          updated_at timestamptz not null default now(),',
    '          primary key (api_fixture_id, api_team_id)',
    '        )',
    '      `);',
    '      await db.execute(sql`',
    '        create table if not exists app.api_football_injuries (',
    '          season integer not null,',
    '          api_player_id integer not null,',
    '          api_fixture_id integer not null default 0,',
    '          api_team_id integer,',
    '          player_name text,',
    '          injury_type text,',
    '          reason text,',
    '          fixture_date timestamptz,',
    '          active boolean not null default true,',
    "          raw jsonb not null default '{}'::jsonb,",
    '          updated_at timestamptz not null default now(),',
    '          primary key (season, api_player_id, api_fixture_id)',
    '        )',
    '      `);',
    '      await db.execute(sql`',
    '        create table if not exists app.api_football_transfers (',
    '          api_player_id integer not null,',
    '          transfer_date date not null,',
    '          from_team_id integer not null default 0,',
    '          to_team_id integer not null default 0,',
    '          player_name text,',
    '          transfer_type text,',
    "          raw jsonb not null default '{}'::jsonb,",
    '          updated_at timestamptz not null default now(),',
    '          primary key (api_player_id, transfer_date, from_team_id, to_team_id)',
    '        )',
    '      `);',
    '      await db.execute(sql`create index if not exists api_football_lineups_fixture_idx on app.api_football_lineups (api_fixture_id)`);',
    '      await db.execute(sql`create index if not exists api_football_injuries_active_idx on app.api_football_injuries (season, active, api_team_id)`);',
    '      await db.execute(sql`create index if not exists api_football_transfers_date_idx on app.api_football_transfers (transfer_date desc)`);',
    '',
  );
  source = insertBefore(source, schemaAnchor, proSchema, "API_FOOTBALL_PRO_SCHEMA_V1", "Pro database schema");

  const oldBudget = lines(
    'export async function getApiFootballBudget(): Promise<Budget> {',
    '  await ensureApiFootballSyncSchema();',
    '  const day = utcDay();',
    '  const row = rowsOf(await db.execute(sql`select requests::int as requests from app.api_football_usage where usage_day=${day}::date`))[0];',
    '  const used = Number(row?.requests || 0);',
    '  return { cap: DAILY_CAP, used, remaining: Math.max(0, DAILY_CAP - used), day };',
    '}',
  );
  const newBudget = lines(
    'function inferProviderPlan(limit: number | null) {',
    '  const value = Number(limit || 0);',
    '  if (value >= 150000) return "MEGA";',
    '  if (value >= 75000) return "ULTRA";',
    '  if (value >= 7500) return "PRO";',
    '  if (value >= 100) return "FREE";',
    '  return value > 0 ? "CUSTOM" : "UNKNOWN";',
    '}',
    '',
    'function providerReserveFor(limit: number | null) {',
    '  const value = Number(limit || 0);',
    '  if (!value) return Math.min(EMERGENCY_RESERVE, 500);',
    '  return Math.max(10, Math.min(EMERGENCY_RESERVE, Math.floor(value * 0.10)));',
    '}',
    '',
    'function headerNumber(response: any, name: string) {',
    '  const raw = response?.headers?.get?.(name);',
    '  if (raw === null || raw === undefined || raw === "") return null;',
    '  const value = Number(raw);',
    '  return Number.isFinite(value) ? value : null;',
    '}',
    '',
    'async function recordProviderQuota(response: any) {',
    '  const dailyLimit = headerNumber(response, "x-ratelimit-requests-limit");',
    '  const dailyRemaining = headerNumber(response, "x-ratelimit-requests-remaining");',
    '  const minuteLimit = headerNumber(response, "x-ratelimit-limit");',
    '  const minuteRemaining = headerNumber(response, "x-ratelimit-remaining");',
    '  if ([dailyLimit, dailyRemaining, minuteLimit, minuteRemaining].every((value) => value === null)) return;',
    '  const plan = inferProviderPlan(dailyLimit);',
    '  await db.execute(sql`',
    '    insert into app.api_football_provider_quota',
    '      (id, daily_limit, daily_remaining, minute_limit, minute_remaining, provider_plan, observed_at)',
    '    values (1, ${dailyLimit}, ${dailyRemaining}, ${minuteLimit}, ${minuteRemaining}, ${plan}, now())',
    '    on conflict (id) do update set',
    '      daily_limit=coalesce(excluded.daily_limit, app.api_football_provider_quota.daily_limit),',
    '      daily_remaining=coalesce(excluded.daily_remaining, app.api_football_provider_quota.daily_remaining),',
    '      minute_limit=coalesce(excluded.minute_limit, app.api_football_provider_quota.minute_limit),',
    '      minute_remaining=coalesce(excluded.minute_remaining, app.api_football_provider_quota.minute_remaining),',
    "      provider_plan=case when excluded.provider_plan <> 'UNKNOWN' then excluded.provider_plan else app.api_football_provider_quota.provider_plan end,",
    '      observed_at=now()',
    '  `);',
    '}',
    '',
    'export async function getApiFootballBudget(): Promise<Budget> {',
    '  await ensureApiFootballSyncSchema();',
    '  const day = utcDay();',
    '  const usage = rowsOf(await db.execute(sql`select requests::int as requests from app.api_football_usage where usage_day=${day}::date`))[0];',
    '  const quota = rowsOf(await db.execute(sql`',
    '    select daily_limit as "dailyLimit", daily_remaining as "dailyRemaining", minute_limit as "minuteLimit", minute_remaining as "minuteRemaining", provider_plan as "providerPlan", observed_at as "observedAt"',
    '    from app.api_football_provider_quota where id=1',
    '  `))[0] || {};',
    '  const used = Number(usage?.requests || 0);',
    '  const providerLimit = Number.isFinite(Number(quota.dailyLimit)) && Number(quota.dailyLimit) > 0 ? Number(quota.dailyLimit) : null;',
    '  const providerRemaining = Number.isFinite(Number(quota.dailyRemaining)) && Number(quota.dailyRemaining) >= 0 ? Number(quota.dailyRemaining) : null;',
    '  const minuteLimit = Number.isFinite(Number(quota.minuteLimit)) && Number(quota.minuteLimit) > 0 ? Number(quota.minuteLimit) : null;',
    '  const minuteRemaining = Number.isFinite(Number(quota.minuteRemaining)) && Number(quota.minuteRemaining) >= 0 ? Number(quota.minuteRemaining) : null;',
    '  const providerReserve = providerReserveFor(providerLimit);',
    '  const providerSafeCap = providerLimit === null ? DAILY_CAP : Math.max(0, providerLimit - providerReserve);',
    '  const cap = Math.max(0, Math.min(DAILY_CAP, providerSafeCap));',
    '  const localRemaining = Math.max(0, cap - used);',
    '  const providerSafeRemaining = providerRemaining === null ? localRemaining : Math.max(0, providerRemaining - providerReserve);',
    '  return { cap, configuredCap: DAILY_CAP, used, remaining: Math.max(0, Math.min(localRemaining, providerSafeRemaining)), day, providerLimit, providerRemaining, providerReserve, minuteLimit, minuteRemaining, providerPlan: String(quota.providerPlan || inferProviderPlan(providerLimit)), observedAt: quota.observedAt ? new Date(quota.observedAt).toISOString() : null };',
    '}',
  );
  source = replaceOnce(source, oldBudget, newBudget, "provider-aware budget");

  const oldReserve = lines(
    'async function reserveProviderCall() {',
    '  await ensureApiFootballSyncSchema();',
    '  const day = utcDay();',
    '  const row = rowsOf(await db.execute(sql`',
    '    insert into app.api_football_usage (usage_day, requests, updated_at)',
    '    values (${day}::date, 1, now())',
    '    on conflict (usage_day) do update',
    '      set requests=app.api_football_usage.requests+1, updated_at=now()',
    '      where app.api_football_usage.requests < ${DAILY_CAP}',
    '    returning requests::int as requests',
    '  `))[0];',
    '  if (!row) throw new Error(`Daily API-Football safety cap reached (${DAILY_CAP}).`);',
    '}',
  );
  const newReserve = lines(
    'async function reserveProviderCall() {',
    '  await ensureApiFootballSyncSchema();',
    '  const budget = await getApiFootballBudget();',
    '  if (budget.remaining <= 0) throw new Error(`Daily API-Football safety reserve reached (${budget.used}/${budget.cap}; provider ${budget.providerRemaining ?? "unknown"} remaining).`);',
    '  const day = utcDay();',
    '  const row = rowsOf(await db.execute(sql`',
    '    insert into app.api_football_usage (usage_day, requests, updated_at)',
    '    values (${day}::date, 1, now())',
    '    on conflict (usage_day) do update',
    '      set requests=app.api_football_usage.requests+1, updated_at=now()',
    '      where app.api_football_usage.requests < ${budget.cap}',
    '    returning requests::int as requests',
    '  `))[0];',
    '  if (!row) throw new Error(`Daily API-Football safety cap reached (${budget.cap}).`);',
    '}',
  );
  source = replaceOnce(source, oldReserve, newReserve, "dynamic request reservation");

  const oldProvider = lines(
    'async function providerGet(path: string, params: Record<string, string | number | undefined>) {',
    '  if (!API_KEY) throw new Error("API_FOOTBALL_KEY is not configured");',
    '  await reserveProviderCall();',
    '  const url = new URL(`${BASE_URL}/${path.replace(/^\\//, "")}`);',
    '  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));',
    '  const response = await fetch(url, {',
    '    headers: { Accept: "application/json", "x-apisports-key": API_KEY, "User-Agent": "FantasyArena/1.0" },',
    '    signal: AbortSignal.timeout(20000),',
    '  });',
    '  const payload: any = await response.json().catch(() => ({}));',
    '  if (!response.ok || (payload?.errors && Object.keys(payload.errors).length)) {',
    '    throw new Error(typeof payload?.errors === "object" ? JSON.stringify(payload.errors) : `API-Football ${response.status}`);',
    '  }',
    '  return payload;',
    '}',
  );
  const newProvider = lines(
    'const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));',
    '',
    'async function providerGet(path: string, params: Record<string, string | number | undefined>) {',
    '  if (!API_KEY) throw new Error("API_FOOTBALL_KEY is not configured");',
    '  const url = new URL(`${BASE_URL}/${path.replace(/^\\//, "")}`);',
    '  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));',
    '  const retryDelays = [2000, 5000, 10000];',
    '  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {',
    '    await reserveProviderCall();',
    '    const response = await fetch(url, { headers: { Accept: "application/json", "x-apisports-key": API_KEY, "User-Agent": "FantasyArena/2.0-Pro" }, signal: AbortSignal.timeout(20000) });',
    '    await recordProviderQuota(response);',
    '    const payload: any = await response.json().catch(() => ({}));',
    '    if (response.status === 429 && attempt < retryDelays.length - 1) { await sleep(retryDelays[attempt]); continue; }',
    '    if (!response.ok || (payload?.errors && Object.keys(payload.errors).length)) throw new Error(typeof payload?.errors === "object" ? JSON.stringify(payload.errors) : `API-Football ${response.status}`);',
    '    return payload;',
    '  }',
    '  throw new Error("API-Football request failed after rate-limit backoff");',
    '}',
  );
  source = replaceOnce(source, oldProvider, newProvider, "quota headers and 429 backoff");

  source = replaceOnce(
    source,
    lines(
      '  const payload = await providerGet("fixtures", { league: LEAGUE_ID, season: seasonNow(), from: isoDate(-2), to: isoDate(21) });',
      '  const fixtures = Array.isArray(payload?.response) ? payload.response : [];',
      '  return { calls: 1, records: await upsertFixtures(fixtures), details: { from: isoDate(-2), to: isoDate(21) } };',
    ),
    lines(
      '  const payload = await providerGet("fixtures", { league: LEAGUE_ID, season: seasonNow() });',
      '  const fixtures = Array.isArray(payload?.response) ? payload.response : [];',
      '  return { calls: 1, records: await upsertFixtures(fixtures), details: { mode: "full-season", season: seasonNow() } };',
    ),
    "full-season fixture sync",
  );

  source = source.replace('  const maxFixtures = Math.max(0, Math.min(8, budget.remaining - 10));', '  const maxFixtures = Math.max(0, Math.min(20, budget.remaining));');

  const standingsAnchor = 'async function syncStandings(): Promise<{ calls: number; records: number; details: any }> {';
  const proJobs = lines(
    '// API_FOOTBALL_PRO_DATA_JOBS_V1',
    'async function syncLineups(): Promise<{ calls: number; records: number; details: any }> {',
    '  const fixtures = rowsOf(await db.execute(sql`',
    "    select api_fixture_id from app.api_football_fixtures",
    "    where kickoff_at between now()-interval '6 hours' and now()+interval '90 minutes'",
    "      and coalesce(status_short,'NS') not in ('PST','CANC','ABD','AWD','WO')",
    '      and lineups_synced_at is null',
    '    order by kickoff_at asc limit 12',
    '  `));',
    '  if (!fixtures.length) return { calls: 0, records: 0, details: { reason: "No fixture is waiting for a lineup" } };',
    '  let calls = 0;',
    '  let records = 0;',
    '  for (const fixture of fixtures) {',
    '    const budget = await getApiFootballBudget();',
    '    if (budget.remaining <= 0) break;',
    '    const fixtureId = Number(fixture.api_fixture_id);',
    '    const payload = await providerGet("fixtures/lineups", { fixture: fixtureId });',
    '    calls += 1;',
    '    const lineups = Array.isArray(payload?.response) ? payload.response : [];',
    '    for (const lineup of lineups) {',
    '      const teamId = Number(lineup?.team?.id || 0);',
    '      if (!teamId) continue;',
    '      await upsertTeam(lineup?.team);',
    '      await db.execute(sql`',
    '        insert into app.api_football_lineups (api_fixture_id,api_team_id,formation,coach,start_xi,substitutes,raw,updated_at)',
    '        values (${fixtureId},${teamId},${lineup?.formation || null},${JSON.stringify(lineup?.coach || {})}::jsonb,${JSON.stringify(lineup?.startXI || [])}::jsonb,${JSON.stringify(lineup?.substitutes || [])}::jsonb,${JSON.stringify(lineup)}::jsonb,now())',
    '        on conflict (api_fixture_id,api_team_id) do update set formation=excluded.formation,coach=excluded.coach,start_xi=excluded.start_xi,substitutes=excluded.substitutes,raw=excluded.raw,updated_at=now()',
    '      `);',
    '      records += 1;',
    '    }',
    '    if (lineups.length) await db.execute(sql`update app.api_football_fixtures set lineups_synced_at=now(),updated_at=now() where api_fixture_id=${fixtureId}`);',
    '  }',
    '  return { calls, records, details: { fixturesChecked: fixtures.length } };',
    '}',
    '',
    'async function syncInjuries(): Promise<{ calls: number; records: number; details: any }> {',
    '  const season = seasonNow();',
    '  const payload = await providerGet("injuries", { league: LEAGUE_ID, season });',
    '  const injuries = Array.isArray(payload?.response) ? payload.response : [];',
    '  await db.execute(sql`update app.api_football_injuries set active=false,updated_at=now() where season=${season}`);',
    '  let records = 0;',
    '  for (const item of injuries) {',
    '    const playerId = Number(item?.player?.id || 0);',
    '    if (!playerId) continue;',
    '    const fixtureId = Number(item?.fixture?.id || 0);',
    '    const teamId = Number(item?.team?.id || 0) || null;',
    '    await upsertTeam(item?.team);',
    '    await db.execute(sql`',
    '      insert into app.api_football_injuries (season,api_player_id,api_fixture_id,api_team_id,player_name,injury_type,reason,fixture_date,active,raw,updated_at)',
    '      values (${season},${playerId},${fixtureId},${teamId},${item?.player?.name || null},${item?.player?.type || null},${item?.player?.reason || null},${item?.fixture?.date ? new Date(item.fixture.date) : null},true,${JSON.stringify(item)}::jsonb,now())',
    '      on conflict (season,api_player_id,api_fixture_id) do update set api_team_id=excluded.api_team_id,player_name=excluded.player_name,injury_type=excluded.injury_type,reason=excluded.reason,fixture_date=excluded.fixture_date,active=true,raw=excluded.raw,updated_at=now()',
    '    `);',
    '    records += 1;',
    '  }',
    '  return { calls: 1, records, details: { season, injuryRecords: records } };',
    '}',
    '',
    'async function syncTransfers(): Promise<{ calls: number; records: number; details: any }> {',
    '  const season = seasonNow();',
    '  let teamRows = rowsOf(await db.execute(sql`',
    '    select distinct team_id as "teamId" from (',
    '      select home_team_id as team_id from app.api_football_fixtures where season=${season}',
    '      union',
    '      select away_team_id as team_id from app.api_football_fixtures where season=${season}',
    '    ) teams where team_id is not null and team_id > 0 order by team_id',
    '  `));',
    '  let calls = 0;',
    '  if (!teamRows.length) {',
    '    const teamsPayload = await providerGet("teams", { league: LEAGUE_ID, season });',
    '    calls += 1;',
    '    const teams = Array.isArray(teamsPayload?.response) ? teamsPayload.response : [];',
    '    for (const row of teams) await upsertTeam(row?.team || row);',
    '    teamRows = teams.map((row: any) => ({ teamId: Number(row?.team?.id || row?.id || 0) })).filter((row: any) => row.teamId > 0);',
    '  }',
    '  const seasonFloor = new Date(Date.UTC(season, 5, 1));',
    '  let records = 0;',
    '  for (const row of teamRows) {',
    '    const budget = await getApiFootballBudget();',
    '    if (budget.remaining <= 0) break;',
    '    const teamId = Number(row.teamId || 0);',
    '    if (!teamId) continue;',
    '    const payload = await providerGet("transfers", { team: teamId });',
    '    calls += 1;',
    '    const players = Array.isArray(payload?.response) ? payload.response : [];',
    '    for (const playerRow of players) {',
    '      const playerId = Number(playerRow?.player?.id || 0);',
    '      if (!playerId) continue;',
    '      for (const transfer of Array.isArray(playerRow?.transfers) ? playerRow.transfers : []) {',
    '        const dateText = String(transfer?.date || "").slice(0, 10);',
    '        const date = dateText ? new Date(dateText + "T00:00:00Z") : null;',
    '        if (!date || Number.isNaN(date.getTime()) || date < seasonFloor) continue;',
    '        const fromTeamId = Number(transfer?.teams?.out?.id || 0);',
    '        const toTeamId = Number(transfer?.teams?.in?.id || 0);',
    '        await db.execute(sql`',
    '          insert into app.api_football_transfers (api_player_id,transfer_date,from_team_id,to_team_id,player_name,transfer_type,raw,updated_at)',
    '          values (${playerId},${dateText}::date,${fromTeamId},${toTeamId},${playerRow?.player?.name || null},${transfer?.type || null},${JSON.stringify({ player: playerRow.player, transfer })}::jsonb,now())',
    '          on conflict (api_player_id,transfer_date,from_team_id,to_team_id) do update set player_name=excluded.player_name,transfer_type=excluded.transfer_type,raw=excluded.raw,updated_at=now()',
    '        `);',
    '        records += 1;',
    '      }',
    '    }',
    '  }',
    '  return { calls, records, details: { season, teamsChecked: teamRows.length } };',
    '}',
    '',
  );
  source = insertBefore(source, standingsAnchor, proJobs, "API_FOOTBALL_PRO_DATA_JOBS_V1", "Pro data jobs");

  source = replaceOnce(
    source,
    lines(
      '      if (jobType === "completed_stats") return syncCompletedStats();',
      '      if (jobType === "players") return syncPlayers();',
      '      return syncStandings();',
    ),
    lines(
      '      if (jobType === "completed_stats") return syncCompletedStats();',
      '      if (jobType === "players") return syncPlayers();',
      '      if (jobType === "lineups") return syncLineups();',
      '      if (jobType === "injuries") return syncInjuries();',
      '      if (jobType === "transfers") return syncTransfers();',
      '      return syncStandings();',
    ),
    "Pro job routing",
  );

  source = replaceOnce(
    source,
    '      (select count(*)::int from app.api_football_standings where league_id=${LEAGUE_ID} and season=${seasonNow()}) as standings',
    lines(
      '      (select count(*)::int from app.api_football_standings where league_id=${LEAGUE_ID} and season=${seasonNow()}) as standings,',
      '      (select count(*)::int from app.api_football_lineups) as lineups,',
      '      (select count(*)::int from app.api_football_injuries where season=${seasonNow()} and active=true) as injuries,',
      '      (select count(*)::int from app.api_football_transfers where transfer_date >= make_date(${seasonNow()}, 6, 1)) as transfers',
    ),
    "Pro data counts",
  );

  const nextSyncAnchor = '  const nextFixtureSync = lastFixtureRun?.finishedAt ? new Date(new Date(lastFixtureRun.finishedAt).getTime() + FIXTURE_SYNC_HOURS * 3600000).toISOString() : new Date().toISOString();';
  const providerSummary = lines(
    '',
    '  // API_FOOTBALL_PRO_SUMMARY_V1',
    '  const provider = { plan: budget.providerPlan, dailyLimit: budget.providerLimit, dailyRemaining: budget.providerRemaining, minuteLimit: budget.minuteLimit, minuteRemaining: budget.minuteRemaining, reserve: budget.providerReserve, observedAt: budget.observedAt };',
    '  const proMode = budget.providerPlan === "PRO" || Number(budget.providerLimit || 0) >= 7500 || DAILY_CAP >= 7000;',
  );
  source = insertAfter(source, nextSyncAnchor, providerSummary, "API_FOOTBALL_PRO_SUMMARY_V1", "Pro summary");

  source = replaceOnce(
    source,
    lines(
      '    configured: Boolean(API_KEY), leagueId: LEAGUE_ID, season: seasonNow(), budget,',
      '    schedule: { fixtureSyncHours: FIXTURE_SYNC_HOURS, livePollMinutes: LIVE_POLL_MINUTES, nextFixtureSync },',
      '    counts: { fixtures: Number(counts.fixtures || 0), teams: Number(counts.teams || 0), players: Number(counts.players || 0), playerPhotos: Number(counts.player_photos || 0), playersWithoutPhotos: Math.max(0, Number(counts.players || 0) - Number(counts.player_photos || 0)), photoCoveragePercent: Number(counts.players || 0) ? Math.round((Number(counts.player_photos || 0) / Number(counts.players || 1)) * 100) : 0, playerStats: Number(counts.player_stats || 0), standings: Number(counts.standings || 0) },',
    ),
    lines(
      '    configured: Boolean(API_KEY), leagueId: LEAGUE_ID, season: seasonNow(), budget, proMode, provider,',
      '    schedule: { fixtureSyncHours: FIXTURE_SYNC_HOURS, livePollMinutes: LIVE_POLL_MINUTES, completedStatsMinutes: COMPLETED_STATS_MINUTES, lineupsPollMinutes: LINEUPS_POLL_MINUTES, injurySyncMinutes: INJURY_SYNC_MINUTES, transferSyncHours: TRANSFER_SYNC_HOURS, standingsSyncMinutes: STANDINGS_SYNC_MINUTES, nextFixtureSync },',
      '    counts: { fixtures: Number(counts.fixtures || 0), teams: Number(counts.teams || 0), players: Number(counts.players || 0), playerPhotos: Number(counts.player_photos || 0), playersWithoutPhotos: Math.max(0, Number(counts.players || 0) - Number(counts.player_photos || 0)), photoCoveragePercent: Number(counts.players || 0) ? Math.round((Number(counts.player_photos || 0) / Number(counts.players || 1)) * 100) : 0, playerStats: Number(counts.player_stats || 0), standings: Number(counts.standings || 0), lineups: Number(counts.lineups || 0), injuries: Number(counts.injuries || 0), transfers: Number(counts.transfers || 0) },',
    ),
    "Pro summary payload",
  );

  const oldScheduler = lines(
    'export function startApiFootballSyncScheduler() {',
    '  if (schedulerStarted || process.env.API_FOOTBALL_SYNC_ENABLED === "false") return;',
    '  schedulerStarted = true;',
    '  const safeRun = async (type: SyncJobType) => {',
    '    try {',
    '      const budget = await getApiFootballBudget();',
    '      if (!API_KEY || budget.remaining <= 10) return;',
    '      await runApiFootballSync(type);',
    '    } catch (error: any) {',
    '      console.warn(`[api-football-sync] ${type} failed:`, error?.message || error);',
    '    }',
    '  };',
    '  setTimeout(() => safeRun("fixtures"), 20_000);',
    '  setTimeout(() => safeRun("players"), 60_000);',
    '  setInterval(() => safeRun("fixtures"), FIXTURE_SYNC_HOURS * 3600000);',
    '  setInterval(() => safeRun("live"), LIVE_POLL_MINUTES * 60000);',
    '  setInterval(() => safeRun("completed_stats"), 60 * 60000);',
    '  setInterval(() => safeRun("standings"), 12 * 3600000);',
    '  setInterval(() => safeRun("players"), 2 * 3600000);',
    '  console.log(`[api-football-sync] scheduler active: fixtures ${FIXTURE_SYNC_HOURS}h, players 2h until complete, live ${LIVE_POLL_MINUTES}m, daily cap ${DAILY_CAP}`);',
    '}',
  );
  const newScheduler = lines(
    'export function startApiFootballSyncScheduler() {',
    '  if (schedulerStarted || process.env.API_FOOTBALL_SYNC_ENABLED === "false") return;',
    '  schedulerStarted = true;',
    '  const safeRun = async (type: SyncJobType) => {',
    '    try {',
    '      const budget = await getApiFootballBudget();',
    '      if (!API_KEY || budget.remaining <= 0) return;',
    '      await runApiFootballSync(type);',
    '    } catch (error: any) {',
    '      console.warn(`[api-football-sync] ${type} failed:`, error?.message || error);',
    '    }',
    '  };',
    '  setTimeout(() => providerGet("status", {}).catch((error: any) => console.warn("[api-football-sync] provider status probe failed:", error?.message || error)), 5_000);',
    '  setTimeout(() => safeRun("fixtures"), 10_000);',
    '  setTimeout(() => safeRun("players"), 30_000);',
    '  setTimeout(() => safeRun("standings"), 45_000);',
    '  setTimeout(() => safeRun("injuries"), 60_000);',
    '  setTimeout(() => safeRun("transfers"), 90_000);',
    '  setTimeout(() => safeRun("lineups"), 120_000);',
    '  setInterval(() => safeRun("fixtures"), FIXTURE_SYNC_HOURS * 3600000);',
    '  setInterval(() => safeRun("live"), LIVE_POLL_MINUTES * 60000);',
    '  setInterval(() => safeRun("lineups"), LINEUPS_POLL_MINUTES * 60000);',
    '  setInterval(() => safeRun("completed_stats"), COMPLETED_STATS_MINUTES * 60000);',
    '  setInterval(() => safeRun("standings"), STANDINGS_SYNC_MINUTES * 60000);',
    '  setInterval(() => safeRun("injuries"), INJURY_SYNC_MINUTES * 60000);',
    '  setInterval(() => safeRun("transfers"), TRANSFER_SYNC_HOURS * 3600000);',
    '  setInterval(() => safeRun("players"), 2 * 3600000);',
    '  console.log(`[api-football-sync] PRO scheduler active: fixtures ${FIXTURE_SYNC_HOURS}h, live ${LIVE_POLL_MINUTES}m, lineups ${LINEUPS_POLL_MINUTES}m, completed stats ${COMPLETED_STATS_MINUTES}m, injuries ${INJURY_SYNC_MINUTES}m, transfers ${TRANSFER_SYNC_HOURS}h, local safety cap ${DAILY_CAP}`);',
    '}',
  );
  source = replaceOnce(source, oldScheduler, newScheduler, "Pro scheduler");

  return source;
});

patchFile("server/routes/apiFootballSync.routes.ts", (original) => {
  if (original.includes('"lineups", "injuries", "transfers"')) return original;
  return replaceOnce(
    original,
    'const allowedJobs = new Set<SyncJobType>(["fixtures", "live", "completed_stats", "standings", "teams", "players"]);',
    'const allowedJobs = new Set<SyncJobType>(["fixtures", "live", "completed_stats", "standings", "teams", "players", "lineups", "injuries", "transfers"]);',
    "manual Pro sync jobs",
  );
});

patchFile("server/routes/apiFootballAdmin.routes.ts", (original) => {
  if (original.includes("API_FOOTBALL_PRO_ADMIN_V1")) return original;
  let source = original;
  source = replaceOnce(
    source,
    'const DAILY_SAFETY_CAP = Math.max(10, Math.min(90, Number(process.env.API_FOOTBALL_DAILY_CAP || 90)));',
    lines(
      '// API_FOOTBALL_PRO_ADMIN_V1',
      'const DAILY_SAFETY_CAP = Math.max(100, Math.min(7400, Number(process.env.API_FOOTBALL_DAILY_CAP || 7000)));',
    ),
    "admin daily safety cap",
  );
  source = source.replace(
    'rateLimit: { limit: number | null; remaining: number | null };',
    'rateLimit: { limit: number | null; remaining: number | null; dailyLimit: number | null; dailyRemaining: number | null; minuteLimit: number | null; minuteRemaining: number | null };',
  );
  source = replaceOnce(
    source,
    lines(
      '  const limit = response.headers.get("x-ratelimit-requests-limit") || response.headers.get("x-ratelimit-limit");',
      '  const remaining = response.headers.get("x-ratelimit-requests-remaining") || response.headers.get("x-ratelimit-remaining");',
    ),
    lines(
      '  const dailyLimit = response.headers.get("x-ratelimit-requests-limit");',
      '  const dailyRemaining = response.headers.get("x-ratelimit-requests-remaining");',
      '  const minuteLimit = response.headers.get("x-ratelimit-limit");',
      '  const minuteRemaining = response.headers.get("x-ratelimit-remaining");',
    ),
    "admin provider quota headers",
  );
  source = replaceOnce(
    source,
    '    rateLimit: { limit: limit ? Number(limit) : null, remaining: remaining ? Number(remaining) : null },',
    '    rateLimit: { limit: dailyLimit ? Number(dailyLimit) : null, remaining: dailyRemaining ? Number(dailyRemaining) : null, dailyLimit: dailyLimit ? Number(dailyLimit) : null, dailyRemaining: dailyRemaining ? Number(dailyRemaining) : null, minuteLimit: minuteLimit ? Number(minuteLimit) : null, minuteRemaining: minuteRemaining ? Number(minuteRemaining) : null },',
    "admin provider quota payload",
  );
  source = source.replace('emergencyBuffer: 100 - DAILY_SAFETY_CAP', 'emergencyBuffer: Math.max(0, 7500 - DAILY_SAFETY_CAP)');
  return source;
});

patchFile("client/src/pages/admin-live-data.tsx", (original) => {
  if (original.includes("API_FOOTBALL_PRO_DASHBOARD_V1")) return original;
  let source = original;

  const oldJobs = lines(
    'const syncJobs = [',
    '  { key: "fixtures", label: "Sync Fixtures", description: "Imports upcoming and recent Premier League fixtures." },',
    '  { key: "live", label: "Sync Live Matches", description: "Checks live matches only when a stored fixture is inside a match window." },',
    '  { key: "completed_stats", label: "Import Completed Stats", description: "Imports player statistics once for finished matches." },',
    '  { key: "standings", label: "Sync Standings", description: "Refreshes the current Premier League table." },',
    '  { key: "teams", label: "Sync Teams & Logos", description: "Refreshes team details through the fixture feed." },',
    '  { key: "players", label: "Sync Players & Photos", description: "Imports current Premier League squads and API-Football player portraits." },',
    '] as const;',
  );
  const newJobs = lines(
    'const syncJobs = [',
    '  { key: "fixtures", label: "Sync Full Season Fixtures", description: "Refreshes the complete Premier League season fixture list." },',
    '  { key: "live", label: "Sync Live Matches", description: "Refreshes live scores while a stored fixture is inside the match window." },',
    '  { key: "lineups", label: "Sync Lineups", description: "Imports starting XIs, benches, formations and coaches near kickoff." },',
    '  { key: "completed_stats", label: "Import Completed Stats", description: "Imports player match statistics shortly after finished matches." },',
    '  { key: "injuries", label: "Sync Injuries", description: "Refreshes Premier League injury records." },',
    '  { key: "transfers", label: "Sync Transfers", description: "Refreshes current-season transfer history across all Premier League clubs." },',
    '  { key: "standings", label: "Sync Standings", description: "Refreshes the current Premier League table." },',
    '  { key: "teams", label: "Sync Teams & Logos", description: "Refreshes team details through the fixture feed." },',
    '  { key: "players", label: "Sync Players & Photos", description: "Imports current Premier League squads and API-Football player portraits." },',
    '] as const;',
  );
  source = replaceOnce(source, oldJobs, newJobs, "Pro manual jobs UI");

  const configuredAnchor = '  const configured = Boolean(summary.configured ?? status.data?.configured);';
  const providerVars = lines(
    '',
    '  // API_FOOTBALL_PRO_DASHBOARD_V1',
    '  const provider = summary.provider || {};',
    '  const providerDailyLimit = Number(provider.dailyLimit ?? usage.providerLimit ?? status.data?.rateLimit?.dailyLimit ?? status.data?.rateLimit?.limit ?? 0);',
    '  const providerDailyRemaining = Number(provider.dailyRemaining ?? usage.providerRemaining ?? status.data?.rateLimit?.dailyRemaining ?? status.data?.rateLimit?.remaining ?? 0);',
    '  const minuteLimit = Number(provider.minuteLimit ?? usage.minuteLimit ?? status.data?.rateLimit?.minuteLimit ?? 0);',
    '  const minuteRemaining = Number(provider.minuteRemaining ?? usage.minuteRemaining ?? status.data?.rateLimit?.minuteRemaining ?? 0);',
    '  const providerPlan = String(provider.plan || status.data?.account?.subscription?.plan || (providerDailyLimit >= 7500 ? "PRO" : providerDailyLimit ? "Connected" : "Detecting")).toUpperCase();',
    '  const proMode = Boolean(summary.proMode || providerDailyLimit >= 7500 || providerPlan.includes("PRO"));',
  );
  source = insertAfter(source, configuredAnchor, providerVars, "API_FOOTBALL_PRO_DASHBOARD_V1", "Pro dashboard variables");

  source = source.replace(
    '<div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-emerald-100"><ShieldCheck className="h-3.5 w-3.5" />Database-first production mode</div>',
    '<div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-emerald-100"><ShieldCheck className="h-3.5 w-3.5" />{proMode ? "API-Football Pro mode" : "API-Football connected"} • Database-first</div>',
  );

  source = replaceOnce(
    source,
    lines(
      '        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">',
      '          <Metric label="Configured" value={configured ? "Yes" : "No"} good={configured} />',
      '          <Metric label="Connected" value={status.data?.connected ? "Online" : "Not checked"} good={Boolean(status.data?.connected)} />',
      '          <Metric label="League / Season" value={`${summary.leagueId || status.data?.leagueId || 39} / ${summary.season || season}`} good />',
      '          <Metric label="Used today" value={`${used}/${cap}`} good={remaining > 10} />',
      '          <Metric label="Safe requests left" value={remaining} good={remaining > 0} />',
      '          <Metric label="Player images" value={playerImageHealth.data?.healthy ? "Working" : playerImageHealth.isLoading ? "Checking" : "Needs sync"} good={Boolean(playerImageHealth.data?.healthy)} />',
      '        </section>',
    ),
    lines(
      '        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">',
      '          <Metric label="Configured" value={configured ? "Yes" : "No"} good={configured} />',
      '          <Metric label="Connected" value={status.data?.connected ? "Online" : "Not checked"} good={Boolean(status.data?.connected)} />',
      '          <Metric label="Provider plan" value={providerPlan} good={proMode} />',
      '          <Metric label="League / Season" value={`${summary.leagueId || status.data?.leagueId || 39} / ${summary.season || season}`} good />',
      '          <Metric label="Provider daily" value={providerDailyLimit ? `${providerDailyRemaining}/${providerDailyLimit}` : "Detecting"} good={!providerDailyLimit || providerDailyRemaining > 500} />',
      '          <Metric label="Per minute" value={minuteLimit ? `${minuteRemaining}/${minuteLimit}` : "Detecting"} good={!minuteLimit || minuteRemaining > 10} />',
      '          <Metric label="Local safety" value={`${used}/${cap}`} good={remaining > 0} />',
      '          <Metric label="Player images" value={playerImageHealth.data?.healthy ? "Working" : playerImageHealth.isLoading ? "Checking" : "Needs sync"} good={Boolean(playerImageHealth.data?.healthy)} />',
      '        </section>',
    ),
    "Pro quota metrics",
  );

  source = source.replace('Daily API safety budget', 'API-Football quota & local safety budget');
  source = source.replace('Resets at 00:00 UTC • database reads use no provider calls', 'Provider quota resets at 00:00 UTC • database reads use no provider calls • safety reserve is protected');

  source = replaceOnce(
    source,
    lines(
      '        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">',
      '          <DatabaseMetric icon={CalendarDays} label="Fixtures stored" value={counts.fixtures || 0} />',
      '          <DatabaseMetric icon={ServerCog} label="Teams stored" value={counts.teams || 0} />',
      '          <DatabaseMetric icon={Users} label="Players stored" value={counts.players || 0} />',
      '          <DatabaseMetric icon={Image} label="Player photos" value={counts.playerPhotos || 0} />',
      '          <DatabaseMetric icon={Activity} label="Player stat rows" value={counts.playerStats || 0} />',
      '          <DatabaseMetric icon={Table2} label="Standing rows" value={counts.standings || 0} />',
      '        </section>',
    ),
    lines(
      '        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9">',
      '          <DatabaseMetric icon={CalendarDays} label="Fixtures stored" value={counts.fixtures || 0} />',
      '          <DatabaseMetric icon={ServerCog} label="Teams stored" value={counts.teams || 0} />',
      '          <DatabaseMetric icon={Users} label="Players stored" value={counts.players || 0} />',
      '          <DatabaseMetric icon={Image} label="Player photos" value={counts.playerPhotos || 0} />',
      '          <DatabaseMetric icon={Activity} label="Player stat rows" value={counts.playerStats || 0} />',
      '          <DatabaseMetric icon={Table2} label="Standing rows" value={counts.standings || 0} />',
      '          <DatabaseMetric icon={Users} label="Lineups stored" value={counts.lineups || 0} />',
      '          <DatabaseMetric icon={Activity} label="Injury records" value={counts.injuries || 0} />',
      '          <DatabaseMetric icon={RefreshCw} label="Transfers stored" value={counts.transfers || 0} />',
      '        </section>',
    ),
    "Pro data metrics",
  );

  source = replaceOnce(
    source,
    '          <div className="mt-4 grid gap-3 sm:grid-cols-3"><Info label="Fixture interval" value={`Every ${schedule.fixtureSyncHours || 6} hours`} /><Info label="Live polling" value={`Every ${schedule.livePollMinutes || 15} minutes when needed`} /><Info label="Next fixture sync" value={fmtDate(schedule.nextFixtureSync)} /></div>',
    '          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Full fixture interval" value={`Every ${schedule.fixtureSyncHours || 2} hours`} /><Info label="Live polling" value={`Every ${schedule.livePollMinutes || 1} minute(s) when needed`} /><Info label="Lineups" value={`Every ${schedule.lineupsPollMinutes || 5} minutes near kickoff`} /><Info label="Completed stats" value={`Every ${schedule.completedStatsMinutes || 10} minutes`} /><Info label="Injuries" value={`Every ${schedule.injurySyncMinutes || 60} minutes`} /><Info label="Transfers" value={`Every ${schedule.transferSyncHours || 6} hours`} /><Info label="Standings" value={`Every ${schedule.standingsSyncMinutes || 60} minutes`} /><Info label="Next fixture sync" value={fmtDate(schedule.nextFixtureSync)} /></div>',
    "Pro automatic schedule UI",
  );

  source = source.replace('className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6"', 'className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"');
  return source;
});

console.log("Applied API-Football Pro mode: dynamic provider quotas, 7,000-call safety cap, 1-minute live polling, full-season fixtures, lineups, injuries, transfers, faster completed stats, and Pro Sync Centre metrics.");

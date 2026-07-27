#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "server/services/apiFootballSync.ts");
let source = fs.readFileSync(file, "utf8");

if (source.includes("API_FOOTBALL_INCREMENTAL_SQUAD_SYNC_V1")) {
  console.log("Complete current-squad photo sync already applied.");
  process.exit(0);
}

const start = source.indexOf("async function syncPlayers():");
const end = source.indexOf("\nasync function syncStandings()", start);
if (start < 0 || end < 0) throw new Error("Could not locate syncPlayers function");

const replacement = `// API_FOOTBALL_INCREMENTAL_SQUAD_SYNC_V1
async function syncPlayers(): Promise<{ calls: number; records: number; details: any }> {
  const season = seasonNow();
  const recentComplete = rowsOf(await db.execute(sql\`
    select finished_at
    from app.api_football_sync_runs
    where job_type='players'
      and status='success'
      and coalesce((details->>'complete')::boolean, false)=true
      and finished_at > now()-interval '18 hours'
    order by finished_at desc
    limit 1
  \`))[0];
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
  const coverageRows = rowsOf(await db.execute(sql\`
    select api_team_id as "apiTeamId",
           count(*)::int as players,
           count(*) filter (where coalesce(photo,'') <> '')::int as photos,
           max(updated_at) as "lastUpdated"
    from app.api_football_players
    where season=\${season} and active=true
    group by api_team_id
  \`));
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

  const photoCounts = rowsOf(await db.execute(sql\`
    select count(*)::int as players,
           count(*) filter (where coalesce(photo,'') <> '')::int as photos
    from app.api_football_players
    where season=\${season} and active=true
  \`))[0] || {};
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
`;

source = source.slice(0, start) + replacement + source.slice(end);

const oldFinish = `    const message = result.calls ? \`Processed \${result.records} records using \${result.calls} provider call\${result.calls === 1 ? "" : "s"}.\` : String(result.details?.reason || "No provider call was needed.");
    await finishRun(run.id, "success", result.calls, result.records, message, result.details);
    return { jobType, success: true, providerCalls: result.calls, records: result.records, message, startedAt, finishedAt: new Date().toISOString() };`;
const newFinish = `    const isPartialPlayerSync = jobType === "players" && result.details?.complete === false;
    const isSkipped = !isPartialPlayerSync && result.calls === 0 && Boolean(result.details?.reason);
    const runStatus = isPartialPlayerSync ? "partial" : isSkipped ? "skipped" : "success";
    const message = isPartialPlayerSync
      ? \`Partial current-squad sync: \${result.records} players processed; \${Number(result.details?.pendingTeams || 0)} club squad(s) still pending.\`
      : result.calls
        ? \`Processed \${result.records} records using \${result.calls} provider call\${result.calls === 1 ? "" : "s"}.\`
        : String(result.details?.reason || "No provider call was needed.");
    await finishRun(run.id, runStatus, result.calls, result.records, message, result.details);
    return { jobType, success: true, providerCalls: result.calls, records: result.records, message, startedAt, finishedAt: new Date().toISOString() };`;
if (!source.includes(oldFinish)) throw new Error("Could not locate sync run completion block");
source = source.replace(oldFinish, newFinish);

const oldHealth = `  return { service: "api-football-player-images", configured: Boolean(API_KEY), provider: "API-Football", season, players, photos, missingPhotos: Math.max(0, players - photos), coveragePercent: players ? Math.round((photos / players) * 100) : 0, lastDirectoryUpdate: counts.lastDirectoryUpdate ? new Date(counts.lastDirectoryUpdate).toISOString() : null, lastSync: lastRun, imageProbe, healthy: Boolean(API_KEY && players > 0 && photos > 0 && imageProbe?.reachable) };`;
const newHealth = `  const currentSquadsComplete = Boolean(lastRun?.details?.complete);
  return { service: "api-football-player-images", configured: Boolean(API_KEY), provider: "API-Football", season, players, photos, missingPhotos: Math.max(0, players - photos), coveragePercent: players ? Math.round((photos / players) * 100) : 0, currentSquadsComplete, completedTeams: Number(lastRun?.details?.completedTeams || 0), pendingTeams: Number(lastRun?.details?.pendingTeams || 0), unresolvedTeams: Array.isArray(lastRun?.details?.unresolvedTeams) ? lastRun.details.unresolvedTeams : [], squadFailures: Array.isArray(lastRun?.details?.squadFailures) ? lastRun.details.squadFailures : [], lastDirectoryUpdate: counts.lastDirectoryUpdate ? new Date(counts.lastDirectoryUpdate).toISOString() : null, lastSync: lastRun, imageProbe, healthy: Boolean(API_KEY && currentSquadsComplete && players > 0 && photos > 0 && imageProbe?.reachable) };`;
if (!source.includes(oldHealth)) throw new Error("Could not locate image health response");
source = source.replace(oldHealth, newHealth);

source = source.replace('  setInterval(() => safeRun("players"), 24 * 3600000);', '  setInterval(() => safeRun("players"), 2 * 3600000);');
source = source.replace('players 24h, live', 'players 2h until complete, live');

fs.writeFileSync(file, source);
console.log("Incremental complete current-squad photo sync applied.");

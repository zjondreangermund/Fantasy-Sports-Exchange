#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(file, before, after) {
  const source = read(file);
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${file}: expected source block was not found`);
  write(file, source.replace(before, after));
}

const syncFile = "server/services/apiFootballSync.ts";
replaceOnce(
  syncFile,
  'import { db } from "../db.js";\n',
  'import { db } from "../db.js";\nimport { ensureApiFootballPlayerDirectorySchema, replaceApiFootballSquad } from "./apiFootballPlayerDirectory.js";\n',
);
replaceOnce(
  syncFile,
  'export type SyncJobType = "fixtures" | "live" | "completed_stats" | "standings" | "teams";',
  'export type SyncJobType = "fixtures" | "live" | "completed_stats" | "standings" | "teams" | "players";',
);
replaceOnce(
  syncFile,
  '      await db.execute(sql`create schema if not exists app`);',
  '      await db.execute(sql`create schema if not exists app`);\n      await ensureApiFootballPlayerDirectorySchema();',
);

replaceOnce(
  syncFile,
  'async function syncStandings(): Promise<{ calls: number; records: number; details: any }> {',
  `async function syncPlayers(): Promise<{ calls: number; records: number; details: any }> {
  const recent = rowsOf(await db.execute(sql\`
    select finished_at from app.api_football_sync_runs
    where job_type='players' and status='success' and finished_at > now()-interval '18 hours'
    order by finished_at desc limit 1
  \`))[0];
  if (recent) return { calls: 0, records: 0, details: { reason: "Current squad directory was refreshed within the last 18 hours" } };

  const budget = await getApiFootballBudget();
  if (budget.remaining <= 30) return { calls: 0, records: 0, details: { reason: "Player directory sync requires a 30-call safety window" } };

  const season = seasonNow();
  const teamsPayload = await providerGet("teams", { league: LEAGUE_ID, season });
  const teamRows = Array.isArray(teamsPayload?.response) ? teamsPayload.response : [];
  let calls = 1;
  let records = 0;
  let teamsProcessed = 0;

  for (const teamRow of teamRows) {
    const team = teamRow?.team || {};
    if (!team?.id) continue;
    const currentBudget = await getApiFootballBudget();
    if (currentBudget.remaining <= 10) break;
    await upsertTeam(team);
    const squadPayload = await providerGet("players/squads", { team: Number(team.id) });
    calls += 1;
    const response = Array.isArray(squadPayload?.response) ? squadPayload.response : [];
    const squad = response.find((item: any) => Number(item?.team?.id || 0) === Number(team.id)) || response[0] || {};
    const squadTeam = squad?.team || team;
    const players = Array.isArray(squad?.players) ? squad.players : [];
    records += await replaceApiFootballSquad(season, squadTeam, players);
    teamsProcessed += 1;
  }

  return { calls, records, details: { season, teamsAvailable: teamRows.length, teamsProcessed } };
}

async function syncStandings(): Promise<{ calls: number; records: number; details: any }> {`,
);

replaceOnce(
  syncFile,
  '      if (jobType === "completed_stats") return syncCompletedStats();\n      return syncStandings();',
  '      if (jobType === "completed_stats") return syncCompletedStats();\n      if (jobType === "players") return syncPlayers();\n      return syncStandings();',
);

replaceOnce(
  syncFile,
  '      (select count(*)::int from app.api_football_player_match_stats) as player_stats,\n      (select count(*)::int from app.api_football_standings where league_id=${LEAGUE_ID} and season=${seasonNow()}) as standings',
  '      (select count(*)::int from app.api_football_player_match_stats) as player_stats,\n      (select count(*)::int from app.api_football_players where season=${seasonNow()} and active=true) as players,\n      (select count(*)::int from app.api_football_standings where league_id=${LEAGUE_ID} and season=${seasonNow()}) as standings',
);
replaceOnce(
  syncFile,
  '    counts: { fixtures: Number(counts.fixtures || 0), teams: Number(counts.teams || 0), playerStats: Number(counts.player_stats || 0), standings: Number(counts.standings || 0) },',
  '    counts: { fixtures: Number(counts.fixtures || 0), teams: Number(counts.teams || 0), players: Number(counts.players || 0), playerStats: Number(counts.player_stats || 0), standings: Number(counts.standings || 0) },',
);
replaceOnce(
  syncFile,
  '  setTimeout(() => safeRun("fixtures"), 20_000);',
  '  setTimeout(() => safeRun("fixtures"), 20_000);\n  setTimeout(() => safeRun("players"), 60_000);',
);
replaceOnce(
  syncFile,
  '  setInterval(() => safeRun("standings"), 12 * 3600000);',
  '  setInterval(() => safeRun("standings"), 12 * 3600000);\n  setInterval(() => safeRun("players"), 24 * 3600000);',
);
replaceOnce(
  syncFile,
  '  console.log(`[api-football-sync] scheduler active: fixtures ${FIXTURE_SYNC_HOURS}h, live ${LIVE_POLL_MINUTES}m, daily cap ${DAILY_CAP}`);',
  '  console.log(`[api-football-sync] scheduler active: fixtures ${FIXTURE_SYNC_HOURS}h, players 24h, live ${LIVE_POLL_MINUTES}m, daily cap ${DAILY_CAP}`);',
);

replaceOnce(
  "server/routes/apiFootballSync.routes.ts",
  'const allowedJobs = new Set<SyncJobType>(["fixtures", "live", "completed_stats", "standings", "teams"]);',
  'const allowedJobs = new Set<SyncJobType>(["fixtures", "live", "completed_stats", "standings", "teams", "players"]);',
);

for (const file of ["client/src/main.tsx", "client/public/sw.js", "scripts/verify-unified-scroll-architecture.mjs", "scripts/verify-card-data-integrity.mjs"]) {
  const source = read(file);
  const updated = source.replaceAll("fantasy-site-v12", "fantasy-site-v13");
  if (updated !== source) write(file, updated);
}

console.log("Verified player directory, profile and modal source patches applied.");

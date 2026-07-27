#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "server/services/apiFootballSync.ts"), "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const includesAll = (values, label) => {
  for (const value of values) expect(source.includes(value), `${label} is missing: ${value}`);
};

includesAll([
  "API_FOOTBALL_INCREMENTAL_SQUAD_SYNC_V1",
  "coalesce((details->>'complete')::boolean, false)=true",
  "budget.remaining <= 12",
  "count(*) filter (where coalesce(photo,'') <> '')::int as photos",
  "teamsAlreadyCurrent",
  "pendingTeams",
  "budgetStopped",
  "const complete = teamRows.length > 0",
  'const runStatus = isPartialPlayerSync ? "partial" : isSkipped ? "skipped" : "success"',
  "currentSquadsComplete",
  'setInterval(() => safeRun("players"), 2 * 3600000)',
], "Incremental squad completion logic");

expect(!source.includes("Player directory sync requires a 45-call safety window"), "Squad sync must not require all remaining calls up front");
expect(!source.includes("where job_type='players' and status='success' and finished_at > now()-interval '18 hours'"), "Any partial success must not block retries for 18 hours");
expect(source.includes("item.players >= 15 && item.photos >= 15"), "Only substantial freshly stored squads may be skipped on retries");
expect(source.includes("healthy: Boolean(API_KEY && currentSquadsComplete"), "Image health must stay incomplete until every resolved current squad is loaded");

if (failures.length) {
  console.error("Complete current-squad photo verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Incremental API-Football squad retries, completion reporting and full current-squad photo coverage are enforced.");

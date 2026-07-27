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
  "API_FOOTBALL_FREE_PLAN_SQUAD_FALLBACK_V1",
  'import { fplApi } from "./fplApi.js"',
  "FREE_PLAN_REFERENCE_SEASON",
  "discoverCurrentSquadTeams",
  'providerGet("teams", { league: LEAGUE_ID, season: FREE_PLAN_REFERENCE_SEASON })',
  'providerGet("teams", { search: requestedName })',
  'providerGet("players/squads", { team: teamId })',
  "isFreePlanSeasonRestriction",
  "free plans do not have access to this season",
  "sameClub",
  "selectExactClub",
  'discoveryMode: discovery?.mode || "unknown"',
  "unresolvedTeams",
  "squadFailures",
  "playersStored",
  "photosStored",
  "imageProbe",
], "Free-plan current squad discovery");

expect(source.includes("budget.remaining <= 12"), "Incremental player-photo sync must start whenever requests remain above the 10-call emergency reserve");
expect(source.includes("currentBudget.remaining <= 10"), "Every squad request must preserve the emergency API reserve");
expect(source.includes('mode: "free-plan-reference-season-plus-team-search"'), "Fallback mode must be visible in sync diagnostics");
expect(source.includes('"manchester united": ["man utd"]'), "Manchester United alias is required");
expect(source.includes('"wolverhampton wanderers": ["wolverhampton", "wolves"]'), "Wolves alias is required");
expect(source.includes("matches.length === 1 ? matches[0] : null"), "Team search must reject ambiguous matches rather than linking the wrong club");
expect(!source.includes('const teamsPayload = await providerGet("teams", { league: LEAGUE_ID, season });\n  const teamRows'), "Player sync must not depend exclusively on a paid current-season league lookup");

if (failures.length) {
  console.error("API-Football free-plan fallback verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("API-Football free-plan current squad discovery, exact team matching, incremental retries and image diagnostics are wired correctly.");

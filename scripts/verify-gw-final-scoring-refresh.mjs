import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// No database, network, scoring write, prizes or settlement in this regression.
const read = path => fs.readFileSync(path,"utf8");
const scorer = read("server/services/scoreUpdater.ts");
const context = read("server/services/apiFootballScoringBridge.ts");
const routes = read("server/routes/economyIntegrity.routes.ts");
const admin = read("client/src/components/admin/AdminTournamentManager.tsx");
assert.match(scorer, /verifiedFinalByGw = new Map<number, Promise<Set<number>>>/);
assert.match(scorer, /this\.isSettlementFinal\(competition, fixtures, bootstrap, providerFinalIds\)/);
assert.match(scorer, /this\.scoreCompetitionEntries\(item\.competition, await apiContextFor\(gameWeek\), item\.final/);
assert.match(context, /loadVerifiedFinalFixtureEvidence\(gw, fplFixtures, fplBootstrap\)/);
assert.match(context, /f\.api_fixture_id = any\(\$\{fixtureIdsParam\}::int\[\]\)/);
assert.match(context, /api_fixture_id = any\(\$\{fixtureIdsParam\}::int\[\]\)/);
assert.doesNotMatch(context, /and coalesce\(f\.round,' '\) ~/);
assert.match(context, /kickoff < endMs/);
assert.match(routes, /\/api\/admin\/competitions\/refresh-gameweek-scores\/:gameWeek/);
assert.match(routes, /new ScoreUpdateService\(storage\)\.updateCompetition/);
assert.match(routes, /readOnlyAwards:true/);
assert.match(routes, /snapshotHealth:/);
assert.match(admin, /refresh-gameweek-scores/);
assert.match(admin, /totalDistinctPendingCards/);

const settlement = {exports:{}};
vm.runInNewContext(ts.transpileModule(read("server/services/gameweekSettlementReady.ts"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,settlement);
const fixtures = [
  {id:98,event:10,kickoff_time:"2026-11-08T16:30:00Z",finished:false},
  {id:2,event:10,kickoff_time:"2026-11-07T14:00:00Z",finished:true},
  {id:3,event:11,kickoff_time:"2026-11-14T14:00:00Z",finished:false},
];
const cutoff="2026-11-08T19:30:00Z";
const at=Date.parse("2026-11-09T05:00:00Z");
const options={deadlineTime:"2026-11-06T18:30:00Z",useFixtureCutoff:true};
assert.equal(settlement.exports.gameweekSettlementReadiness(fixtures,10,cutoff,at,options).ready,false,
  "A stale FPL full-time flag alone must not trigger settlement");
assert.equal(settlement.exports.gameweekSettlementReadiness(fixtures,10,cutoff,at,{
  ...options,confirmedFinalFixtureIds:new Set([98]),
}).ready,true,"A matched provider FT must be used in background and admin readiness");
console.log("GW10 final-snapshot regression: independently verified FT, fixture-ID scoring, score-only admin refresh and pending-card diagnostics passed.");

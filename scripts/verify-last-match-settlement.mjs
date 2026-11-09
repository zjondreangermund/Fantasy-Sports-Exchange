import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Pure source test: no live fixture API, database, entry writes, or prize awards.
const source = fs.readFileSync("server/services/gameweekSettlementReady.ts", "utf8");
const sandbox = { exports: {}, Date, Math, Number, String, Array };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, sandbox);
const check = sandbox.exports.gameweekSettlementReadiness;
assert.equal(typeof check, "function");

const gw = 10;
const start = Date.parse("2026-11-08T18:00:00Z");
const fixture = (id, event, kickoff, finished) => ({ id, event, kickoff_time: kickoff, finished });
const early = fixture(1, gw, "2026-11-07T18:00:00Z", true);
const last = fixture(2, gw, "2026-11-08T16:00:00Z", false);
const next = fixture(3, gw + 1, "2026-11-14T14:00:00Z", false);
const afterKickoff = new Date(Date.parse(last.kickoff_time) + 3 * 3600_000).toISOString();

assert.equal(check([early, last, next], gw, afterKickoff, start).code, "SETTLEMENT_CUTOFF_NOT_REACHED");
assert.equal(check([early, last, next], gw, afterKickoff, start + 7200_000).code, "GAMEWEEK_MATCHES_UNFINISHED");
assert.equal(check([early, {...last, finished_provisional: true}, next], gw, afterKickoff, start + 7200_000).ready, false);
assert.equal(check([early, {...last, finished:true}, next], gw, afterKickoff, start + 7200_000).ready, true);
assert.equal(check([], gw, afterKickoff, start + 7200_000).ready, false);
assert.equal(check([early, fixture(9,gw,null,false), next], gw, afterKickoff, start + 7200_000).ready, false);

const postponed = fixture(4, gw, "2026-11-16T20:00:00Z", false);
const postponedCheck = check([early, {...last, finished:true}, postponed, next], gw, afterKickoff, start + 7200_000);
assert.equal(postponedCheck.ready, true, "A fixture moved past the next GW must not hold settlement");
assert.equal(postponedCheck.excludedLatePostponements, 1);
const delayed = fixture(5,gw,"2026-11-09T20:00:00Z",false);
assert.equal(check([early, {...last, finished:true}, delayed, next], gw, afterKickoff, start + 7200_000).ready, false, "Late matches still inside the GW must finish");


const followingWeek = fixture(6, gw, "2026-11-16T16:00:00Z", false);
const nextDelayedGw = fixture(7, gw+1, "2026-11-21T15:00:00Z", false);
const originalDeadline = "2026-11-06T18:30:00Z";
const onePlayed = fixture(8, gw, "2026-11-08T16:00:00Z", true);
const outside = check([onePlayed, followingWeek, nextDelayedGw], gw, afterKickoff, start+7200_000, {
  deadlineTime: originalDeadline, useFixtureCutoff: true,
});
assert.equal(outside.ready, true, "A game moved past the original seven-day GW must be excluded even before the next GW kicks off");
assert.equal(outside.excludedLatePostponements, 1);
assert.equal(outside.eligibleMatches, 1);
const noDate = fixture(9, gw, null, false);
assert.equal(check([onePlayed,noDate,nextDelayedGw],gw,afterKickoff,Date.parse("2026-11-09T12:00:00Z"),{
  deadlineTime:originalDeadline,useFixtureCutoff:true,
}).ready,false,"Unassigned postponed fixture must not be ignored before the GW window ends");
assert.equal(check([onePlayed,noDate,nextDelayedGw],gw,afterKickoff,Date.parse("2026-11-14T12:00:00Z"),{
  deadlineTime:originalDeadline,useFixtureCutoff:true,
}).excludedLatePostponements,1,"Unscheduled postponement moves out of original GW once its seven-day window expires");
const pending = {...onePlayed, finished:false};
assert.equal(check([pending,nextDelayedGw],gw,afterKickoff,Date.parse("2026-11-09T12:00:00Z"),{
  deadlineTime:originalDeadline,useFixtureCutoff:true,
}).ready,false,"No early settlement without verified full-time evidence");
assert.equal(check([pending,nextDelayedGw],gw,afterKickoff,Date.parse("2026-11-09T12:00:00Z"),{
  deadlineTime:originalDeadline,useFixtureCutoff:true,confirmedFinalFixtureIds:new Set([pending.id]),
}).ready,true,"A securely cross-matched API-Football FT result may confirm a stale FPL fixture flag");

const finishSource = fs.readFileSync("server/services/verifiedMatchFinish.ts","utf8");
const finishSandbox = { exports: {}, require: () => ({}) };
vm.runInNewContext(ts.transpileModule(finishSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, finishSandbox);
const matching = finishSandbox.exports.matchVerifiedFinalFixtures;
const fplTeams = { teams: [{ id:1,name:"Manchester United" },{id:2,name:"Aston Villa"}] };
const fplMatch = { id:77,event:gw,team_h:1,team_a:2,kickoff_time:"2026-11-08T16:30:00Z",finished:false };
assert.equal(matching([fplMatch],fplTeams,[{
  homeTeamName:"Man United",awayTeamName:"Aston Villa",kickoffAt:"2026-11-08T16:30:00Z",statusShort:"FT",
}]).has(77),true,"Provider FT must match both teams and gameweek match time");
assert.equal(matching([fplMatch],fplTeams,[{
  homeTeamName:"Man United",awayTeamName:"Manchester City",kickoffAt:"2026-11-08T16:30:00Z",statusShort:"FT",
}]).has(77),false,"Different opponent is not evidence of FT");
assert.equal(matching([fplMatch],fplTeams,[{
  homeTeamName:"Man United",awayTeamName:"Aston Villa",kickoffAt:"2026-11-08T16:30:00Z",statusShort:"NS",
}]).has(77),false,"Unplayed matches must never count as finished");

const fixture98 = { ...fplMatch, id:98, finished:false };
const manUtdVilla = {
  fixtureId: 1456789, homeTeamName: "Man Utd", awayTeamName:"Aston Villa",
  kickoffAt:"2026-11-08T16:30:00Z", statusShort:"FT", round:"Regular Season - 9",
  homeScore:4, awayScore:4, updatedAt:"2026-11-09T00:10:00Z", statsSyncedAt:null,
};
assert.equal(matching([fixture98],fplTeams,[manUtdVilla]).has(98),true,
  "A verified 4-4 Manchester United/Aston Villa FT must count even if the provider round label differs");
const evidence = finishSandbox.exports.describeFinalFixtureEvidence([fixture98],fplTeams,[manUtdVilla]);
assert.equal(evidence.finalFixtureIds.has(98),true);
assert.equal(evidence.fixtures[0].apiFootballFixtureId,1456789);
assert.equal(evidence.fixtures[0].apiFootballHomeScore,4);
assert.equal(evidence.fixtures[0].apiFootballAwayScore,4);
assert.equal(evidence.fixtures[0].apiFootballStatsReady,false,"An FT result without verified player stats must not imply paid settlement readiness");
const notYet = finishSandbox.exports.describeFinalFixtureEvidence([fixture98],fplTeams,[{...manUtdVilla,statusShort:"NS"}]);
assert.equal(notYet.finalFixtureIds.has(98),false,"A provider match that has not reached full time never unlocks the GW");
assert.equal(notYet.fixtures[0].failureReason,"provider-not-final");
assert.equal(finishSandbox.exports.describeFinalFixtureEvidence([fixture98],fplTeams,[]).fixtures[0].failureReason,"no-provider-fixture");
assert.equal(matching([fixture98],fplTeams,[{...manUtdVilla,awayTeamName:"Brentford"}]).has(98),false,"Do not mistake a different 4-4 match for the correct fixture");
assert.equal(matching([fixture98],fplTeams,[{...manUtdVilla,kickoffAt:"2026-11-12T16:30:00Z"}]).has(98),false,"Do not trust another date's match as the original GW");
const admin = fs.readFileSync("client/src/components/admin/AdminTournamentManager.tsx","utf8");
assert.ok(admin.includes("/api/admin/live-data/sync/fixtures") && admin.includes("/api/admin/live-data/sync/completed_stats"),"Admin must offer an authenticated provider recheck without forced prizes");
const settleRoute = fs.readFileSync("server/routes/economyIntegrity.routes.ts","utf8");
assert.ok(settleRoute.includes('runApiFootballSync("fixtures")'),"The admin settlement should retry authoritative fixture status before blocking a completed match");
console.log("Verified seven-day GW exclusions, provider-rerun diagnostic and matching 4-4 Man Utd/Villa final-whistle regression.");

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

console.log("Verified seven-day GW exclusion, unassigned postponements, strict API-Football full-time match identity and final-scoring safety.");

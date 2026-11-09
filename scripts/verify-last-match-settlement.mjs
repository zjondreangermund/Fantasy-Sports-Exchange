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

console.log("Verified gameweek cutoff requires final FT, honors scheduled grace and excludes only late postponed fixtures.");

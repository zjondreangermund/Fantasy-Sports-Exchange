import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// No production data, user notifications, payouts or Railway API calls.
const keys = new Set();
const messages = [];
let fakeNow = Date.parse("2026-11-09T15:45:00Z"); // 17:45 Namibia
let settled = false;
let nextStatus = "upcoming";
const sql = (strings,...values) => strings.reduce((out,s,i) => out+s+(i<values.length ? String(values[i]) : ""),"");
const FakeDate = class extends Date { static now(){return fakeNow;} };
const db = { execute: async statement => {
  const query=String(statement);
  if(query.includes('as "officialCount"')) return {rows:[{
    officialCount:6, completedOfficialCount:settled?6:5, unsettledCount:settled?0:1,
  }]};
  if(query.includes('from app.competitions') && query.includes('game_week=11'))
    return {rows:[{count:nextStatus==="open"?6:0}]};
  if(query.includes('from app.competition_entries ce'))
    return {rows:[{userId:"member-a"}]};
  if(query.includes('from app.users u')) return {rows:
    ["member-a","member-b","member-c"]
      .filter(id=>!keys.has(id+":gameweek:11:entries-open"))
      .map(userId=>({userId}))};
  throw Error("Unexpected SQL in regression: "+query.slice(0,200));
}};
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("server/services/gameweekBreakNotice.ts","utf8"), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{
  exports,Date:FakeDate,console,
  require:name => {
    if(name==="drizzle-orm")return {sql};
    if(name==="../db.js")return {db};
    if(name==="./gameweekRollover.js")return {openNextGameweekIfComplete:async()=>{
      if(!settled)return {status:"settlement_incomplete",opened:0,gameWeek:11};
      nextStatus="open";
      return {status:"opened",opened:6,gameWeek:11};
    }};
    if(name==="./notifications.js")return {
      ensureNotificationsSchema:async()=>{},
      createNotificationOnce:async(_db,notice)=>{
        const key=notice.userId+":"+notice.dedupeKey;
        if(keys.has(key))return null;
        keys.add(key);messages.push(notice);return {id:messages.length};
      },
    };
    throw Error("Unexpected import: "+name);
  },
});
assert.equal((await exports.notifyGw10EntrantsSettlementIfSettled(10)).eligible,false,
  "A partial GW10 settlement must not notify entrants");
assert.equal((await exports.runGw11OpeningCycle()).status,"scheduled",
  "Before Monday 18:00 CAT GW11 may not open even when GW10 is settled");
assert.equal(messages.length,0);
fakeNow=Date.parse("2026-11-09T16:05:00Z");
assert.equal((await exports.runGw11OpeningCycle()).status,"settlement_incomplete");
assert.equal(messages.length,0,"No global broadcast before full GW10 completion");
settled=true;
const entrantNotice=await exports.notifyGw10EntrantsSettlementIfSettled(10);
assert.equal(entrantNotice.created,1);
assert.equal(messages[0].userId,"member-a");
assert.match(messages[0].message,/results|final points/);
assert.doesNotMatch(messages[0].message,/international break/i,
  "Entrants receive results; international-break notice is later for all users");
assert.equal(messages[0].dedupeKey,"gameweek:2026-27:10:settlement-results");
const cycle=await exports.runGw11OpeningCycle();
assert.equal(cycle.status,"opened");
assert.equal(cycle.notices.created,3,"GW11 opens with all users notified, regardless of GW10 entries");
assert.equal(messages.length,4);
for(const notice of messages.slice(1)){
  assert.equal(notice.dedupeKey,"gameweek:11:entries-open");
  assert.match(notice.message,/injuries/);
  assert.match(notice.message,/9–17 November/);
  assert.match(notice.message,/21 November/);
}
assert.equal((await exports.runGw11OpeningCycle()).notices.created,0,
  "Polling must never duplicate a broadcast");
assert.equal((await exports.notifyGw10EntrantsSettlementIfSettled(10)).created,0,
  "GW10 results notice is idempotent even on retry");
assert.equal(messages.length,4);
for(const file of ["server/services/webPush.ts","server/services/nativePush.ts","client/src/lib/notifications.ts"])
  assert.ok(fs.readFileSync(file,"utf8").includes("entries-open"),"Missing Play deep-link: "+file);
const rollover=fs.readFileSync("server/services/gameweekRollover.ts","utf8");
assert.match(rollover,/2026-11-09T16:00:00/);
assert.match(rollover,/status: "scheduled"/);
assert.match(rollover,/settlement_incomplete/);
const leagueSync=fs.readFileSync("scripts/sync-official-tournaments.mjs","utf8");
assert.match(leagueSync,/window.gw === 11 && !gw10Settled/);
const scoring=fs.readFileSync("server/services/scoreUpdater.ts","utf8");
assert.match(scoring,/gameWeek === 11 && String\(competition\?\.season/);
const routes=fs.readFileSync("server/routes/economyIntegrity.routes.ts","utf8");
assert.ok(routes.includes("notifyGw10EntrantsSettlementIfSettled(gameWeek)"));
const notices=fs.readFileSync("server/routes/notifications.routes.ts","utf8");
assert.ok(notices.includes("runGw11OpeningCycle()"));
assert.ok(notices.includes("nextGameweek === 11 ? GW11_OPEN_MESSAGE"));
const admin=fs.readFileSync("client/src/components/admin/AdminTournamentManager.tsx","utf8");
assert.ok(admin.includes("GW11 opens at 18:00 Namibia time"));
console.log("GW10 results to entrants, separate winners, delayed 18:00 GW11 all-user international-break broadcast, dedupe and lineup links passed.");

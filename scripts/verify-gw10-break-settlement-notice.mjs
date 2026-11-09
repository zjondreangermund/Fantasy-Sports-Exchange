import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Entirely local regression: no actual DB, users, push, prizes or settlement.
const source = fs.readFileSync("server/services/gameweekBreakNotice.ts","utf8");
const noticeKeys = new Set();
const messages = [];
let status = { officialCount:6, completedOfficialCount:5, unsettledCount:1 };
const sql = (parts,...args) => parts.reduce((acc,s,i) => acc+s+(i<args.length ? String(args[i]) : ""),"");
const sandbox = { exports:{}, console, require:(name) => {
  if (name === "drizzle-orm") return {sql};
  if (name === "../db.js") return { db:{ execute: async statement => {
    assert.match(String(statement),/game_week=10/);
    if(String(statement).includes('as "officialCount"')) return {rows:[status]};
    return {rows:[{userId:"member-a"},{userId:"member-b"}]};
  }}};
  if (name === "./notifications.js") return {
    ensureNotificationsSchema: async () => {},
    createNotificationOnce: async (_tx,data) => {
      const key=data.userId+":"+data.dedupeKey;
      if(noticeKeys.has(key))return null;
      noticeKeys.add(key); messages.push(data); return {id:messages.length};
    },
  };
  throw Error("Unexpected dependency "+name);
}};
vm.runInNewContext(ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,sandbox);
const send=sandbox.exports.notifyGw10InternationalBreakIfSettled;
assert.equal(await send(11),null,"Must not send the GW10 break message for GW11");
assert.equal((await send(10)).eligible,false,"Must not notify on partially settled GW10");
assert.equal(messages.length,0);
status={ officialCount:6, completedOfficialCount:6, unsettledCount:0 };
const first=await send(10);
assert.equal(first.eligible,true);
assert.equal(first.created,2,"One notification for each distinct manager");
assert.equal(messages.length,2);
assert.ok(messages.every(x=>x.dedupeKey==="gameweek:2026-27:10:international-break"));
assert.ok(messages.every(x=>/injuries/.test(x.message)&&/suspensions/.test(x.message)&&/GW11/.test(x.message)));
const again=await send(10);
assert.equal(again.eligible,true);
assert.equal(again.created,0,"Retry must not duplicate notifications");
assert.equal(messages.length,2);
status={officialCount:5,completedOfficialCount:5,unsettledCount:0};
assert.equal((await send(10)).eligible,false,"Must verify six prepared official tournaments");

for (const file of ["server/services/nativePush.ts","server/services/webPush.ts","client/src/lib/notifications.ts"]) {
  assert.ok(fs.readFileSync(file,"utf8").includes("gameweek:2026-27:10:international-break"),file+" must link to GW11 Play");
}
const routes=fs.readFileSync("server/routes/economyIntegrity.routes.ts","utf8");
assert.ok(routes.includes("notifyGw10InternationalBreakIfSettled(gameWeek)"));
assert.ok(routes.includes("if (failed === 0)"),"Bulk settlement must be fully successful first");
assert.ok(routes.includes("!req.skipNextGameweekRollover"),"Single settle should not broadcast per cup during bulk settle");
const admin=fs.readFileSync("client/src/components/admin/AdminTournamentManager.tsx","utf8");
assert.ok(admin.includes("International Break — GW10 message"));
assert.ok(admin.includes("bulkSettlement.breakNotice?.eligible"));
console.log("GW10 international-break notification: post-settlement-only, no duplicate messages, Play links and admin preview verified.");

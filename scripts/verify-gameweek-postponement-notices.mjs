import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(filename, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    exports: module.exports, module,
    require: (name) => {
      if (!(name in dependencies)) throw new Error("Unexpected import: " + name);
      return dependencies[name];
    },
    Date, Map, Set, Number, String, Array, Boolean, Math,
  });
  return module.exports;
}
const windowService = load("server/services/gameweekSettlementReady.ts");
const service = load("server/services/gameweekPlayerFixtures.ts", {
  "./gameweekSettlementReady.js": windowService,
});
const client = load("client/src/lib/gameweekPostponement.ts", {
  "@tanstack/react-query": { useQuery: () => ({}) },
});
const events = [
  { id: 10, deadline_time: "2026-11-06T18:30:00Z" },
  { id: 11, deadline_time: "2026-11-20T18:30:00Z" },
];
const bootstrap = {
  events,
  teams: [{ id: 1, name: "Ipswich Town" }, { id: 2, name: "AFC Bournemouth" }, { id: 3, name: "Arsenal" }, { id: 4, name: "Hull City" }],
};
const completed = { id: 98, event: 10, team_h: 1, team_a: 2, kickoff_time: "2026-11-08T14:00:00Z", finished: true, started: true };
const shifted = { id: 97, event: 10, team_h: 3, team_a: 4, kickoff_time: "2026-11-18T14:00:00Z", finished: false, started: false };
const payload = service.buildGameweekFixtureStatus([completed, shifted], bootstrap, 10, Date.parse("2026-11-09T12:00:00Z"));
assert.equal(payload.fixtures[0].excluded,false,"Finished in-week fixture still counts, not postponed");
assert.equal(payload.fixtures[1].excluded,true,"Original GW's seven-day window wins, not GW11 start");
assert.equal(payload.clubs.find(c => c.teamId===1).postponedOutsideGameweek,false);
assert.equal(payload.clubs.find(c => c.teamId===3).postponedOutsideGameweek,true);
assert.equal(client.findClubNotice(payload,{player:{team:"Ipswich Town"}}).postponedOutsideGameweek,false);
assert.equal(client.findClubNotice(payload,{player:{team:"Arsenal"}}).postponedOutsideGameweek,true);
assert.match(client.postponementWarning(client.findClubNotice(payload,{player:{team:"Arsenal"}}),10),/cannot score for GW10/);
assert.equal(client.clubMatchKey("AFC Bournemouth"),"bournemouth");
const doubler = {...shifted,id:99,team_h:1,team_a:4};
const two = service.buildGameweekFixtureStatus([completed, doubler],bootstrap,10,Date.parse("2026-11-09T12:00:00Z"));
assert.equal(two.clubs.find(c=>c.teamId===1).postponedOutsideGameweek,false,"Club with one in-week fixture must NOT be marked as zero for GW");
const unassigned = {...shifted,kickoff_time:null};
assert.equal(service.buildGameweekFixtureStatus([completed,unassigned],bootstrap,10,Date.parse("2026-11-07T12:00:00Z")).clubs.find(c=>c.teamId===3).postponedOutsideGameweek,false,"Do not claim postponement while date unassigned and GW not expired");
assert.equal(service.buildGameweekFixtureStatus([completed,unassigned],bootstrap,10,Date.parse("2026-11-15T12:00:00Z")).clubs.find(c=>c.teamId===3).postponedOutsideGameweek,true,"After GW expiry, unresolved undated fixture cannot score there");
assert.equal(client.postponementWarning(null,10),null);
const admin = fs.readFileSync("client/src/components/admin/AdminTournamentManager.tsx","utf8");
const scoring = fs.readFileSync("server/routes/marketplace.routes.ts","utf8");
const native = fs.readFileSync("client/src/components/native/NativePlayPage.tsx","utf8");
const desktop = fs.readFileSync("client/src/pages/competitions-vault.tsx","utf8");
assert(admin.includes("unfinishedFixtureDetails"));
assert(admin.includes("postponedFixtureDetails"));
assert(!admin.includes('"Settle GW{targetGameWeek}'));
assert(scoring.includes('identityStatus = "postponed-outside-gameweek"'));
assert(scoring.includes("const points = postponedOutsideWeek && snapshot?.final !== true"));
assert(native.includes("warnForCard(card)"));
assert(desktop.includes("selectedPostponements.map"));
console.log("Original GW postponed-vs-completed team status, safe zero-point warnings, and admin fixture details passed.");

import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(fs.readFileSync('shared/fixture-display.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {fixtureMatchesTab,fixtureClock,newerFixture} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for (const status of ['1H','HT','2H','ET','BT','P','LIVE','INT']) {
  assert.equal(fixtureMatchesTab({status,elapsed:95},'live'),true);
  assert.equal(fixtureMatchesTab({status,elapsed:95},'finished'),false);
}
for (const status of ['FT','AET','PEN']) {
  assert.equal(fixtureMatchesTab({status},'finished'),true);
  assert.equal(fixtureMatchesTab({status},'live'),false);
  assert.equal(fixtureClock({status,elapsed:90}),status);
}
for (const status of ['NS','PST','CANC','ABD','SUSP']) assert.equal(fixtureMatchesTab({status},'finished'),false);
assert.equal(fixtureClock({status:'HT',elapsed:45}),'HT');
assert.equal(fixtureClock({status:'2H',elapsed:90,extra:6}),'90+6′');
const old = {status:'2H',elapsed:73,updatedAt:'2026-11-08T18:00:00Z'};
const fresh = {status:'2H',elapsed:78,updatedAt:'2026-11-08T18:05:00Z'};
assert.equal(newerFixture(old,fresh),fresh);
assert.equal(newerFixture(fresh,old),fresh);
const final = {...fresh,status:'FT',updatedAt:'2026-11-08T18:30:00Z'};
assert.equal(fixtureMatchesTab(newerFixture(old,final),'live'),false);
assert.equal(fixtureMatchesTab(newerFixture(old,final),'finished'),true);
// A correction from a newer snapshot can lower the minute; never invent a maximum clock.
assert.equal(newerFixture(fresh,{...old,updatedAt:'2026-11-08T18:10:00Z'}).elapsed,73);
console.log('Fixture tabs, phase clocks and snapshot freshness passed');
const routes = fs.readFileSync('server/routes/footballData.routes.ts','utf8');
const mergeSource = routes.slice(routes.indexOf('function mergeFplLiveFixture('),routes.indexOf('async function fallbackPremierLeagueMatch('));
const executable = ts.transpileModule(mergeSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
let savedRows = [];
let games = [];
const resolve = new Function('savedPremierLeagueMatchdayFixtures','fplApi','matchesLiveFixture','LIVE_FIXTURE_STATUSES','newerFixture','fixtureMatchesTab',executable+'; return resolvePremierLeagueLiveFixtures;')(
  async()=>savedRows,{getLiveGames:async()=>games},(a,b)=>a.id===b.id,new Set(['1H','HT','2H','ET','BT','P','LIVE','INT']),newerFixture,fixtureMatchesTab);
const api = {...fresh,id:1,apiFixtureId:1,kickoffTime:'2026-11-08T16:30:00Z'};
games=[{id:1,minutes:73,homeTeam:{score:1},awayTeam:{score:2}}];
let result = await resolve([api],2026);
assert.equal(result.fixtures[0].elapsed,78,'FPL must not overwrite an authoritative clock');
savedRows=[{...api,elapsed:86,updatedAt:'2026-11-08T18:15:00Z'}];
result = await resolve([api],2026);
assert.equal(result.fixtures[0].elapsed,86,'background sync replaces older public cache');
savedRows=[{...api,status:'FT',updatedAt:'2026-11-08T18:30:00Z'}];
result=await resolve([api],2026);
assert.equal(result.fixtures.length,0,'stale FPL must not resurrect a finished match');
console.log('Live feed reconciliation passed');

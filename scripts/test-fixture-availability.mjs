import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
const result=await build({entryPoints:['shared/fixture-availability.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {resolveFixtureAvailability:resolve}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const now=Date.parse('2026-11-01T15:45:00Z');
const fixture={id:1557453,kickoffTime:'2026-11-01T16:30:00Z',status:'NS',homeTeam:{id:40,name:'Liverpool'},awayTeam:{id:42,name:'Arsenal'}};
const old={player:{id:2864,name:'A. Isak',type:'Missing Fixture',reason:'Thigh Injury'},team:{id:40,name:'Liverpool'},fixture:{id:1557424,date:'2026-10-11T15:30:00Z'}};
const lineup={fixtureId:1557453,lineups:[{team:{id:40,name:'Liverpool'},startXI:[{player:{id:2864,name:'A. Isak'}}],substitutes:[{player:{id:1,name:'Bench player'}}]}]};
let r=resolve([old],[fixture],[lineup],now);
assert.equal(r.injuries.length,0);assert.equal(r.confirmedAvailable[0].availabilityStatus,'confirmed_starter');assert.equal(r.historicalInjuries.length,1);
const current={...old,fixture:{id:1557453,date:fixture.kickoffTime}};
r=resolve([current],[fixture],[lineup],now);assert.equal(r.injuries.length,0);assert.equal(r.historicalInjuries[0].availabilityStatus,'superseded_by_lineup');
r=resolve([current],[fixture],[],now);assert.equal(r.injuries.length,1);assert.equal(r.confirmedAvailable.length,0);
r=resolve([old],[fixture],[],now);assert.equal(r.injuries.length,0);assert.equal(r.confirmedAvailable.length,0); // Old report is not a current absence or proof of fitness.
r=resolve([{...current,player:{id:999,name:'A. Isak'}}],[fixture],[lineup],now);assert.equal(r.injuries.length,1); // Never match by display name alone.
r=resolve([{...current,player:{id:1,name:'Bench player'}}],[fixture],[lineup],now);assert.equal(r.confirmedAvailable[0].availabilityStatus,'confirmed_bench');
r=resolve([current],[{...fixture,status:'FT'}],[lineup],now+7200000);assert.equal(r.confirmedAvailable.length,0);
const future={...fixture,id:1557454,kickoffTime:'2026-11-08T16:30:00Z'};
r=resolve([{...current,fixture:{id:1557454,date:future.kickoffTime}}],[fixture,future],[lineup],now);assert.equal(r.injuries.length,0); // Future-round warning is not applied to today's selected fixture.
r=resolve([old],[],[],now);assert.equal(r.confirmedAvailable.length,0);assert.equal(r.historicalInjuries.length,1);
console.log('Fixture availability passed: Isak historical report, confirmed XI/bench precedence, missing-lineup uncertainty, distinct IDs, completed matches and fixture isolation.');

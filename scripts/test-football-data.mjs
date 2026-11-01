import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function moduleUrl(file){return 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');}
const {dedupeAvailability,groupAvailabilityByTeam,normalizeFootballData,uniqueFootballRows,footballFixtureKey}=await import(moduleUrl('shared/football-data.ts'));
const {gameweekHasKickedOff,availabilityReminderCopy,playerAvailabilityCopy}=await import(moduleUrl('shared/availability-notice.ts'));
const injury=(player,team,fixture,date,reason='Back Injury')=>({player:{id:player,name:player===1?'D. James':'V. Livramento',reason,type:'Missing Fixture'},team:{id:team,name:team===10?'Leeds':'Newcastle'},fixture:{id:fixture,date}});
const injuries=[injury(1,10,100,'2026-10-20'),injury(1,10,101,'2026-10-25'),injury(2,20,102,'2026-10-26'),injury(1,10,103,'2026-11-01','Recovered update')];
assert.equal(dedupeAvailability(injuries).length,2);
assert.equal(dedupeAvailability(injuries).find(r=>r.player.id===1).player.reason,'Recovered update');
assert.deepEqual(groupAvailabilityByTeam(injuries).map(g=>[g.name,g.players.length]),[['Leeds',1],['Newcastle',1]]);
// Same display name with different verified IDs is not necessarily the same person.
assert.equal(dedupeAvailability([injuries[0],{...injuries[0],player:{...injuries[0].player,id:99}}]).length,2);
assert.equal(dedupeAvailability([injuries[0],{...injuries[0],player:{...injuries[0].player,id:undefined}}]).length,1);
assert.equal(dedupeAvailability([injuries[0],{...injuries[0],team:{id:99,name:'Another club'}}]).length,2);
const player={player:{id:1,name:'Player'},statistics:[{team:{id:10},league:{id:39,season:2026},goals:{total:3}},{team:{id:10},league:{id:39,season:2026},goals:{total:4}}]};
const standing={group:'Premier League',team:{id:10,name:'Leeds'},points:9};
const normalized=normalizeFootballData({injuries,fixtures:[{id:1},{id:1},{id:2}],rounds:['Round 1','Round 1','Round 2'],topScorers:[player,player],topAssists:[player],players:[player,player],groups:[[standing,standing],[standing]],standings:[standing,standing],statistics:[{team:{id:10},statistics:[{type:'Shots',value:2},{type:'Shots',value:3}]}],lineups:[{team:{id:10},startXI:[{player:{id:1}},{player:{id:1}}],substitutes:[{player:{id:1}},{player:{id:2}}]}],events:[{type:'Goal',time:{elapsed:1}},{time:{elapsed:1},type:'Goal'},{type:'Goal',time:{elapsed:2}}]});
const transfers=normalizeFootballData({transfers:[{player:{id:1},transfers:[{date:'2026-07-01',type:'Loan'},{date:'2026-07-01',type:'Loan'}]},{player:{id:1},transfers:[{date:'2026-07-01',type:'Loan'},{date:'2026-08-01',type:'Return'}]}]});
assert.equal(transfers.transfers.length,1);
assert.equal(transfers.transfers[0].transfers.length,2);
assert.equal(normalized.fixtures.length,2);
assert.equal(normalized.topScorers.length,1);
assert.equal(normalized.topAssists.length,1);
assert.equal(normalized.players[0].statistics.length,1);
assert.equal(normalized.players[0].statistics[0].goals.total,4); // No artificial addition of snapshots.
assert.equal(normalized.groups.length,1);
assert.equal(normalized.groups[0].length,1);
assert.equal(normalized.statistics[0].statistics[0].value,3);
assert.equal(normalized.lineups[0].startXI.length,1);
assert.equal(normalized.lineups[0].substitutes.length,1);
assert.equal(normalized.events.length,2);
assert.equal(normalized.rounds.length,2);
assert.equal(normalizeFootballData({rounds:[{round:'Round 1',dates:['A']},{round:'Round 1',dates:['B']}]}).rounds.length,1);
assert.equal(normalizeFootballData({groups:[[standing],[{...standing,group:'Playoffs'}]]}).groups.length,2);
assert.equal(uniqueFootballRows([{homeTeam:'A',awayTeam:'B',date:'2026-11-01'},{homeTeam:'A',awayTeam:'B',date:'2026-11-02'}],footballFixtureKey).length,2);
assert.equal(uniqueFootballRows([{rating:7},{rating:8}],footballFixtureKey).length,2);
assert.deepEqual(normalizeFootballData(normalized),normalized); // Safe on repeated API/client normalization.
const now=Date.parse('2026-11-01T14:00:00Z');
const fixtures=[{event:9,kickoff_time:'2026-11-01T13:00:00Z',started:true},{event:9,kickoff_time:'2026-11-01T16:00:00Z'},{event:10,kickoff_time:'2026-11-07T16:00:00Z'}];
assert.equal(gameweekHasKickedOff(fixtures,9,now),true);
assert.equal(gameweekHasKickedOff(fixtures,10,now),false);
assert.equal(gameweekHasKickedOff([{event:9,kickoff_time:'2026-11-01T14:00:00Z'}],9,now),true); // Exact kickoff is locked, even if provider started flag lags.
assert.equal(gameweekHasKickedOff([{event:9,started:true,kickoff_time:null}],9,now),true);
assert.match(availabilityReminderCopy(true).title,/resume/);
assert.match(availabilityReminderCopy(true).message,/Later matches do not reopen/);
assert.match(availabilityReminderCopy(false).message,/only before the first match/);
assert.match(playerAvailabilityCopy('Player','injured',true),/locked/);
console.log('Football data tests passed: fixture-level injury repeats, distinct identities/clubs, all-tab normalization, unchanged statistic values, valid history preservation, and exact first-kickoff lock.');

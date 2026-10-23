import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Execute the real replay branch without connecting to production PostgreSQL.
const identity = ts.transpileModule(fs.readFileSync('server/services/prizeCardIdentity.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports = {};
new Function('exports', identity)(exports);
const { awardedPrizeCardId } = exports;
const source = fs.readFileSync('server/routes/economyIntegrity.routes.ts','utf8');
const start = source.indexOf('async function claimFreeCommonCupCard(');
const end = source.indexOf('  const rarity = rank === 1', start);
const branch = source.slice(start, end) + 'throw new Error("fresh mint path");\n}';
const js = ts.transpileModule(branch, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const sql = (parts,...values)=>parts.reduce((s,p,i)=>s+p+(i<values.length?String(values[i]):''),'');
const claim = new Function('sql','rowsOf','awardedPrizeCardId',js+';return claimFreeCommonCupCard;')(sql,r=>r.rows,awardedPrizeCardId);
const base={userId:'owner',rank:2,competitionStatus:'completed',tier:'common',entryFee:0,prizeKey:'free-common',competitionId:12};
function executor(award, card={id:99,playerName:'Original player',rarity:'common',inCollection:true}) {
 const queries=[];
 return {queries,async execute(q){ queries.push(q); if(q.includes('select ce.id'))return {rows:[{...base,...award}]}; if(q.includes('from app.player_cards pc join'))return {rows:card?[card]:[]}; return {rows:[]}; }};
}
for(const award of [{prizeCardId:99},{prizeCardId:null,settlementAward:{cardId:99}},{prizeCardId:null,awardMetadata:{cardId:99},awardStatus:'claimed'}]){
 const tx=executor(award);
 for(let i=0;i<3;i++) {const r=await claim(tx,'owner',1);assert.equal(r.id,99);assert.equal(r.replayed,true);}
 assert.ok(!tx.queries.some(q=>/insert into app.player_cards|order by random/i.test(q)));
}
const traded=await claim(executor({prizeCardId:99},{id:99,inCollection:false}),'owner',1);
assert.equal(traded.id,99);assert.equal(traded.inCollection,false);
await assert.rejects(()=>claim(executor({prizeCardId:99},null),'owner',1),/no replacement was minted/);
await assert.rejects(()=>claim(executor({prizeCardId:99,settlementAward:{cardId:100}}),'owner',1),/references disagree/);
await assert.rejects(()=>claim(executor({awardStatus:'claimed'}),'owner',1),/already issued/);
await assert.rejects(()=>claim(executor({prizeCardId:99}),'someone-else',1),/not found/);
await assert.rejects(()=>claim(executor({}),'owner',1),/fresh mint path/);
assert.equal(awardedPrizeCardId({}),0);
assert.throws(()=>awardedPrizeCardId({prizeCardId:'invalid'}),/needs review/);
console.log('Prize replay tests passed: repeated claims, historical references, traded/missing cards, conflicting evidence and ownership authorization. No card inserts or random selection on replay.');

const choiceStart=source.indexOf('async function resolveCommonCardChoice(');
const choiceEnd=source.indexOf('  if(action==="keep")',choiceStart);
const choiceJs=ts.transpileModule(source.slice(choiceStart,choiceEnd)+'throw new Error("new replacement path");\n}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const choose=new Function('sql','rowsOf','awardedPrizeCardId','ensureCommonCardChoiceSchema',choiceJs+';return resolveCommonCardChoice;')(sql,r=>r.rows,awardedPrizeCardId,async()=>{});
const choiceQueries=[];
const choiceTx={async execute(q){choiceQueries.push(q);return {rows:q.includes('from app.common_card_reward_choices x')?[{id:2,status:'pending',entryId:1,prizeCardId:99}]:[]};}};
assert.equal((await choose(choiceTx,'owner',2,'replace',44)).cardId,99);
assert.ok(!choiceQueries.some(q=>/insert into app.player_cards|owner_id=null|order by random/i.test(q)));

const repairSource=fs.readFileSync('server/services/tournamentRewards.ts','utf8').replace(/^import .*\n/,'');
const repairJs=ts.transpileModule(repairSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const repairExports={};let created=0;
const storage={getCompetition:async()=>({status:'completed'}),getCompetitionEntries:async()=>[
 {id:1,rank:1,userId:'owner',prizeCardId:99},
 {id:2,rank:1,userId:'owner',prizeCardId:100},
 {id:3,rank:1,userId:'owner',tiebreakMeta:{settlement:{prizeAward:{cardId:101,claimed:true}}}},
],getPlayers:async()=>[],getPlayerCard:async(id)=>id===99?{id:99,ownerId:'buyer'}:undefined,createPlayerCard:async()=>{created++;return {id:102};}};
new Function('exports','storage',repairJs)(repairExports,storage);
const repaired=await repairExports.repairCompetitionRewards(12);
assert.equal(created,0);assert.equal(repaired.repairedCount,0);assert.equal(repaired.skippedCount,3);
console.log('Replacement-choice and admin-repair replay tests passed: already-issued prizes create no additional cards or ownership changes.');

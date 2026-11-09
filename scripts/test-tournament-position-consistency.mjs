import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {PgDialect} from 'drizzle-orm/pg-core';
const temp=await mkdtemp(path.join(tmpdir(),'tournament-positions-'));
let server;
try{
 const roles=['GK','DEF','MID','FWD'];
 const names=['David Raya','Neco Williams','Jeremy Doku','Georginio Rutter'];
 const elements=names.map((name,i)=>({id:i+1,code:100+i,first_name:name.split(' ')[0],second_name:name.split(' ').slice(1).join(' '),web_name:name,team:1,element_type:i===2?3:i+1}));
 // Exercise every fantasy/provider combination for unrelated players, not a name-based exception.
 for(let i=0;i<64;i++)elements.push({id:10+i,code:1000+i,first_name:'Regression',second_name:'Player '+i,web_name:'Regression Player '+i,team:1,element_type:i%4+1});
 const bootstrap={teams:[{id:1,name:'Club',short_name:'CLB'}],elements,events:[]};
 const cards=elements.map(e=>({cardId:e.id,playerId:e.id,fplId:e.id,code:e.code,name:e.first_name+' '+e.second_name,team:'Club',position:roles[e.element_type-1],rarity:'rare',lineupOrder:e.id,imageUrl:''}));
 const provider=new Map(cards.map((c,i)=>[c.playerId,{apiPlayerId:c.playerId+2000,name:c.name,team:c.team,position:i===1?'MID':i===2?'FWD':roles[(i+1)%4],photo:''}]));
 const scoringCalls=[];
 globalThis.__positionTest={bootstrap,cards,provider,scoringCalls};
 const dialect=new PgDialect();
 let final=false;
 const savedScores=cards.map((c,i)=>({cardId:c.cardId,score:10+i/100,minutesPlayed:90,breakdown:{decisive:0},reasons:[]}));
 const execute=async query=>{
  const text=dialect.sqlToQuery(query).sql;
  if(text.includes('ce.tiebreak_meta'))return {rows:[{entryId:1,userId:'member',teamName:'Test team',totalScore:123.4567,lineupCardIds:cards.map(c=>c.cardId),captainId:1,gameWeek:9,tiebreakMeta:final?{scoring:{gameWeek:9,final:true,totalScore:123.4567,captainBonus:1,cardScores:savedScores}}:{}}]};
  if(text.includes('with ordinality'))return {rows:cards};
  if(text.includes("where l.status = 'open'"))return {rows:cards.map(c=>({id:c.cardId,card_id:c.cardId,player_id:c.playerId,player_name:c.name,team:c.team,position:c.position,fpl_id:c.fplId,code:c.code,rarity:'rare',status:'open'}))};
  return {rows:[]};
 };
 globalThis.__positionTest.db={execute,transaction:async fn=>fn({execute})};
 const stubs={
  db:'export const db=globalThis.__positionTest.db;',
  fpl:'export const fplApi={bootstrap:async()=>globalThis.__positionTest.bootstrap,fixturesLive:async()=>[]};',
  directory:`export const loadApiFootballPlayerDirectory=async()=>[...globalThis.__positionTest.provider.values()];export const resolveApiFootballPlayer=(p)=>globalThis.__positionTest.provider.get(Number(p.playerId||p.id));export const apiFootballPhotoUrl=()=>'';`,
  bridge:`export const loadApiFootballGameweekScoringContext=async()=>({directory:[...globalThis.__positionTest.provider.values()]});export const resolveApiFootballGameweekPlayer=p=>({player:globalThis.__positionTest.provider.get(Number(p.playerId||p.id)),stats:{minutes:90},fixture:{statusShort:'FT',statsReady:true}});export const loadDetailedScoringContext=async()=>null;export const resolveDetailedStatsForPlayer=()=>null;`,
  scoring:`export const calculatePlayerScore=(stats,position)=>{globalThis.__positionTest.scoringCalls.push(position);return {total_score:position==='FWD'?40:32,breakdown:{},reasons:[]};};export const mapFplStatsToPlayerStats=()=>({});export const mergePlayerStatsWithDetailedStats=()=>({});`,
  cancellation:'export const registerCompetitionCancellationRoutes=()=>{};',creator:'export const registerTournamentCreatorRoutes=()=>{};',schema:'export const ensureTournamentSchema=async()=>{};',
  ledger:'export const applyMarketplaceTradeLedger=()=>{throw Error("No mutations in position tests");};',notifications:'export const createNotificationOnce=async()=>{};export const ensureNotificationsSchema=async()=>{};',
  loanSchema:'export const ensureLoanPaymentSchema=async()=>{};',loanPayment:'export const getLoanPaymentIntegrityReport=async()=>({});export const postLoanPaymentExactlyOnce=async()=>{};export const verifyLoanPaymentExactlyOnce=async()=>{};',loanDeparture:'export const ensureLoanDeparturePolicySchema=async()=>{};export const syncActiveLoanDepartureChoices=async()=>{};export const chooseLoanDepartureAction=async()=>{};',
 };
 const mapping=[[/\/db\.js$/,'db'],[/\/services\/fplApi\.js$/,'fpl'],[/\/apiFootballPlayerDirectory\.js$/,'directory'],[/\/apiFootballScoringBridge\.js$/,'bridge'],[/\/services\/scoring\.js$/,'scoring'],[/\/competitionCancellation\.routes\.js$/,'cancellation'],[/\/tournamentCreator\.routes\.js$/,'creator'],[/\/tournamentSchema\.ensure\.js$/,'schema'],[/\/walletLedger\.js$/,'ledger'],[/\/services\/notifications\.js$/,'notifications'],[/\/loanPaymentSchema\.js$/,'loanSchema'],[/\/loanPayment\.js$/,'loanPayment'],[/\/loanDeparturePolicy\.js$/,'loanDeparture']];
 await build({entryPoints:['server/routes/marketplace.routes.ts','server/routes/loanMarket.routes.ts','server/services/tournamentPositions.ts','shared/tournament-position.ts'],outdir:temp,outbase:'.',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',plugins:[{name:'position-test-dependencies',setup(b){for(const [filter,name] of mapping)b.onResolve({filter},args=>args.importer.includes('node_modules')?undefined:({path:name,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:stubs[args.path],loader:'js'}));}}]});
 const {tournamentPlayerPosition}=await import(path.join(temp,'shared/tournament-position.mjs'));
 const {createTournamentPositionResolver,alignAuctionPositions}=await import(path.join(temp,'server/services/tournamentPositions.mjs'));
 for(const official of roles)for(const stored of roles)for(const matchRole of roles)assert.equal(tournamentPlayerPosition(official,stored,matchRole),official);
 assert.equal(tournamentPlayerPosition(null,'DEF','MID'),'DEF');assert.equal(tournamentPlayerPosition(null,null,'FWD'),'FWD');assert.equal(tournamentPlayerPosition('bad','bad','bad'),'');assert.equal(tournamentPlayerPosition(' mid ','DEF','FWD'),'MID');
 const positionFor=createTournamentPositionResolver(bootstrap);
 for(const card of cards)assert.equal(positionFor(card,provider.get(card.playerId).position),card.position);
 assert.equal(createTournamentPositionResolver(null)(cards[2],'FWD'),'MID');
 const auction={id:8,position:'FWD',currentBid:99,card:{id:3,player:{...cards[2],position:'FWD'}},cards:[{id:2,player:{...cards[1],position:'MID'}}]};
 const normalized=alignAuctionPositions(auction,bootstrap);assert.equal(normalized.card.player.position,'MID');assert.equal(normalized.position,'MID');assert.equal(normalized.cards[0].player.position,'DEF');assert.equal(normalized.currentBid,99);assert.equal(auction.card.player.position,'FWD');
 const {registerMarketplaceRoutes}=await import(path.join(temp,'server/routes/marketplace.routes.mjs'));
 const {registerLoanMarketRoutes}=await import(path.join(temp,'server/routes/loanMarket.routes.mjs'));
 const app=express();const auth=(req,res,next)=>{req.authUserId='member';next();};registerMarketplaceRoutes(app,{requireAuth:auth});registerLoanMarketRoutes(app,{requireAuth:auth});
 await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});
 const get=async route=>{const response=await fetch('http://127.0.0.1:'+server.address().port+route);const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
 let detail=await get('/api/competitions/1/entries/1');assert.equal(detail.players[2].position,'MID');assert.equal(detail.players[1].position,'DEF');assert.equal(detail.players[2].points,40);assert.equal(scoringCalls[2],'FWD');assert.equal(scoringCalls[1],'MID');
 for(const row of detail.players)assert.equal(row.position,cards.find(c=>c.cardId===row.cardId).position);
 final=true;detail=await get('/api/competitions/1/entries/1');assert.equal(detail.totalScore,123.4567);assert.equal(detail.players[2].points,savedScores[2].score);assert.equal(detail.players[2].position,'MID');assert.equal(detail.captainBonus,1);
 const loans=(await get('/api/marketplace/loans')).loans;
 for(const loan of loans){const expected=cards.find(c=>c.cardId===loan.card_id).position;assert.equal(loan.position,expected);assert.equal(loan.card.player.position,expected);}
 globalThis.__positionTest.bootstrap=null;detail=await get('/api/competitions/1/entries/1');assert.equal(detail.players[2].position,'MID');assert.equal(detail.players[1].position,'DEF');
 const profile=await readFile('server/routes/cards.routes.ts','utf8');assert(profile.includes('tournamentPlayerPosition(undefined, player.position, apiSnapshot.player.position)'));
 console.log('Tournament position consistency passed: Doku MID, Williams DEF, 68 player identities, every role/provider combination, actual entry/loan HTTP payloads, nested auction cards, source outage fallback, and preserved scoring/snapshots.');
}finally{if(server)await new Promise(resolve=>server.close(resolve));delete globalThis.__positionTest;await rm(temp,{recursive:true,force:true});}

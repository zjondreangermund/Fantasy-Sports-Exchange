import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {PGlite} from '@electric-sql/pglite';import {PgDialect} from 'drizzle-orm/pg-core';import ts from 'typescript';
const temp=await mkdtemp(path.join(tmpdir(),'current-pl-rewards-')),pg=new PGlite(),dialect=new PgDialect();
try{
 const now=new Date(),season=now.getUTCFullYear()-(now.getUTCMonth()<6?1:0);
 const names=['Current Keeper','Current Defender','Current Midfielder','Current Forward','Harvey Cartwright','Unflagged Departure','Season Reused Name','On Loan Player','Transferred Player','Stale Squad Player'];
 const players=names.map((name,i)=>({id:i+1,name,team:'Arsenal',position:['GK','DEF','MID','FWD'][i%4],fplId:i+101,code:i+1001}));
 const elements=players.slice(0,4).map(p=>({id:p.fplId,code:p.code,first_name:p.name.split(' ')[0],second_name:p.name.split(' ').slice(1).join(' '),web_name:p.name,team:1,element_type:['GK','DEF','MID','FWD'].indexOf(p.position)+1}));
 // Reused numeric FPL IDs must never turn an old identity into a current player.
 elements.push({id:players[4].fplId,code:99991,first_name:'Different',second_name:'Footballer',web_name:'Different Footballer',team:1,element_type:1});
 for(const p of players.slice(6))elements.push({id:p.fplId,code:p.code,first_name:p.name.split(' ')[0],second_name:p.name.split(' ').slice(1).join(' '),web_name:p.name,team:1,element_type:['GK','DEF','MID','FWD'].indexOf(p.position)+1});
 while(elements.length<305){const i=elements.length;elements.push({id:10000+i,code:20000+i,first_name:'Roster',second_name:'Player '+i,web_name:'Roster Player '+i,team:i%20+1,element_type:i%4+1});}
 const teams=Array.from({length:20},(_,i)=>({id:i+1,name:i?'Club '+i:'Arsenal'}));
 let bootstrap={elements,teams};let directory=players.map(p=>({apiPlayerId:500+p.id,season,apiTeamId:1,name:p.name,firstName:'',lastName:'',team:p.team,position:p.position,active:true,updatedAt:now.toISOString()}));
 directory.find(p=>p.apiPlayerId===507).season=season-1;
 directory.find(p=>p.apiPlayerId===510).updatedAt=new Date(Date.now()-72*3600000).toISOString();
 globalThis.__mintFixture={bootstrap:()=>bootstrap,directory:()=>directory,season};
 await pg.exec(`CREATE SCHEMA app;
 CREATE TABLE app.users(id varchar(255) PRIMARY KEY,created_at timestamptz);
 CREATE TABLE app.players(id integer PRIMARY KEY,name text,team text,position text,league text,status text,fpl_id int,code int,web_name text,overall int default 50,image_url text,photo text);
 CREATE TABLE app.player_provider_identities(player_id integer PRIMARY KEY,api_player_id integer,verified_at timestamptz default now());
 CREATE TABLE app.api_football_fixtures(home_team_id int,away_team_id int,league_id int,season int);
 CREATE TABLE app.api_football_players(api_player_id int,api_team_id int,season int,active boolean,updated_at timestamptz);
 CREATE TABLE app.api_football_transfers(api_player_id int,to_team_id int,transfer_date date,updated_at timestamptz);
 CREATE TABLE app.real_life_player_loans(app_player_id int,active boolean);
 CREATE TABLE app.player_cards(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,player_id int REFERENCES app.players(id),owner_id varchar(255),rarity text,serial_id text,serial_number int,max_supply int,level int,xp int,decisive_score int,last_5_scores jsonb,for_sale boolean,price real,acquired_at timestamptz default now());
 CREATE TABLE app.notifications(user_id text,type text,title text,message text);
 CREATE TABLE app.audit_logs(user_id text,action text,meta jsonb);
 INSERT INTO app.users VALUES('weekly',now()-interval '30 days'),('prize',now()-interval '30 days');`);
 for(let i=1;i<=20;i++)await pg.query('INSERT INTO app.api_football_fixtures VALUES($1,$2,39,$3)',[i,i%20+1,season]);
 for(const p of players){await pg.query("INSERT INTO app.players(id,name,team,position,league,status,fpl_id,code,web_name) VALUES($1,$2,$3,$4,'Premier League','a',$5,$6,$2)",[p.id,p.name,p.team,p.position,p.fplId,p.code]);}
 await pg.exec("UPDATE app.players SET status='i' WHERE id=3; INSERT INTO app.real_life_player_loans VALUES(8,true);");
 await pg.query("INSERT INTO app.api_football_transfers VALUES(509,999,current_date,now())");
 for(const p of directory)await pg.query('INSERT INTO app.api_football_players VALUES($1,$2,$3,$4,$5)',[p.apiPlayerId,p.apiTeamId,p.season,p.active,p.updatedAt]);
 const execute=async statement=>{const query=dialect.sqlToQuery(statement);return pg.query(query.sql,query.params);};
 const db={execute,transaction:fn=>pg.transaction(async tx=>fn({execute:statement=>{const query=dialect.sqlToQuery(statement);return tx.query(query.sql,query.params);}}))};globalThis.__mintFixture.db=db;
 const stubs={notifications:'export const ensureNotificationsSchema=async()=>{};export const createNotificationOnce=async()=>true;',db:'export const db=globalThis.__mintFixture.db;',fpl:'export const fplApi={mintBootstrap:async()=>globalThis.__mintFixture.bootstrap()};',directory:`export const apiFootballSeasonNow=()=>globalThis.__mintFixture.season;export const apiFootballPhotoUrl=(id)=>id>0?'https://media.api-sports.io/football/players/'+id+'.png':'';export const loadApiFootballPlayerDirectory=async()=>globalThis.__mintFixture.directory();export const resolveApiFootballPlayer=(p,dir)=>dir.find(x=>x.name.toLowerCase()===p.name.toLowerCase()&&x.team===p.team)||null;`};
 await build({entryPoints:['server/services/currentPremierLeagueMintPool.ts','server/services/dailyLoginReward.ts'],outdir:temp,outbase:'.',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',plugins:[{name:'mint-fixtures',setup(b){for(const [filter,name] of [[/\/notifications\.js$/,'notifications'],[/\/db\.js$/,'db'],[/\/fplApi\.js$/,'fpl'],[/\/apiFootballPlayerDirectory\.js$/,'directory']])b.onResolve({filter},args=>args.importer.includes('node_modules')?undefined:({path:name,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js'}));}}]});
 const {currentPremierLeagueMintIds}=await import(path.join(temp,'server/services/currentPremierLeagueMintPool.mjs'));const {claimDailyLoginReward}=await import(path.join(temp,'server/services/dailyLoginReward.mjs'));
 assert.deepEqual((await currentPremierLeagueMintIds(db)).sort(),[1,2,3,4]); // Injury does not mean departure.
 let result=await claimDailyLoginReward('weekly');assert(result.claimed);assert([1,2,3,4].includes(result.card.playerId));const issuedId=result.card.id;
 const original=bootstrap;bootstrap=null;
 result=await claimDailyLoginReward('weekly');assert.equal(result.alreadyClaimed,true);assert.equal(result.card.id,issuedId); // Replays do not reroll or need a working roster.
 await assert.rejects(claimDailyLoginReward('prize'),/No card was minted/);assert.equal((await pg.query("SELECT count(*)::int AS n FROM app.daily_login_rewards WHERE user_id='prize'")).rows[0].n,0);
 bootstrap=original;
 const originalDirectory=directory;directory=directory.map(p=>({...p,season:season-1}));await assert.rejects(currentPremierLeagueMintIds(db),/No card was minted/);directory=originalDirectory;
 const source=await readFile('server/routes/economyIntegrity.routes.ts','utf8');const start=source.indexOf('async function claimFreeCommonCupCard('),end=source.indexOf('\nasync function notifyEntryAdmins',start);
 const fn=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const {sql}=await import('drizzle-orm');const claimPrize=new Function('sql','rowsOf','awardedPrizeCardId','COMMON_COLLECTION_CAP','CARD_SUPPLY_CAP_BY_RARITY','currentPremierLeagueMintIds','createNotificationOnce','ensureCommonCardChoiceSchema',fn+';return claimFreeCommonCupCard;')(sql,r=>r.rows,a=>Number(a.prizeCardId||0),20,{common:1000,rare:100,unique:10,epic:3,legendary:1},currentPremierLeagueMintIds,async()=>{},async()=>{});
 await pg.exec(`CREATE TABLE app.competitions(id integer PRIMARY KEY,name text,status text,tier text,entry_fee real,prize_key text);
 CREATE TABLE app.competition_entries(id integer PRIMARY KEY,user_id text,rank int,prize_card_id int,competition_id int,tiebreak_meta jsonb);
 CREATE TABLE app.competition_prize_awards(entry_id int,user_id text,prize_category text,status text,metadata jsonb,updated_at timestamptz);
 INSERT INTO app.competitions VALUES(1,'Free cup','completed','common',0,'free-common');
 INSERT INTO app.competition_entries VALUES(1,'prize',1,null,1,'{"settlement":{}}'),(2,'prize',2,null,1,'{"settlement":{}}');`);
 for(const entry of [1,2]){const prize=await db.transaction(tx=>claimPrize(tx,'prize',entry));assert([1,2,3,4].includes(Number((await pg.query('SELECT player_id FROM app.player_cards WHERE id=$1',[prize.id])).rows[0].player_id)));const replay=await db.transaction(tx=>claimPrize(tx,'prize',entry));assert.equal(replay.id,prize.id);assert(replay.replayed);}
 bootstrap=null;await pg.exec("INSERT INTO app.competition_entries VALUES(3,'prize',3,null,1,'{\"settlement\":{}}')");await assert.rejects(db.transaction(tx=>claimPrize(tx,'prize',3)),/No card was minted/);assert.equal((await pg.query('SELECT prize_card_id FROM app.competition_entries WHERE id=3')).rows[0].prize_card_id,null);bootstrap=original;
 // Exercise the real PL/pgSQL guard, not a JS approximation, including a transfer
 // arriving after candidate selection and the first grant of unowned inventory.
 const directorySource=await readFile('server/services/apiFootballPlayerDirectory.ts','utf8');const guard=directorySource.match(/sql`(create or replace function app\.guard_current_pl_owned_mint\(\)[\s\S]*?end \$\$)`/i)?.[1];assert(guard);await pg.exec(guard);await pg.exec('CREATE TRIGGER guard_current_pl_owned_mint BEFORE INSERT OR UPDATE OF owner_id ON app.player_cards FOR EACH ROW EXECUTE FUNCTION app.guard_current_pl_owned_mint()');
 await pg.exec("INSERT INTO app.player_cards(player_id,owner_id,rarity) VALUES(5,null,'common')");const unowned=(await pg.query('SELECT max(id) AS id FROM app.player_cards')).rows[0].id;
 await assert.rejects(pg.query("UPDATE app.player_cards SET owner_id='prize' WHERE id=$1",[unowned]),/unverified|unavailable/);
 await pg.exec("UPDATE app.players SET status='departed' WHERE id=1");await assert.rejects(pg.exec("INSERT INTO app.player_cards(player_id,owner_id,rarity) VALUES(1,'prize','rare')"),/unavailable/);
 await pg.exec("INSERT INTO app.api_football_transfers VALUES(502,999,current_date,now())");await assert.rejects(pg.exec("INSERT INTO app.player_cards(player_id,owner_id,rarity) VALUES(2,'prize','rare')"),/transferred/);
 await pg.exec("UPDATE app.api_football_players SET active=false WHERE api_player_id=504");await assert.rejects(pg.exec("INSERT INTO app.player_cards(player_id,owner_id,rarity) VALUES(4,'prize','rare')"),/unverified/);
 console.log('Current PL reward tests passed: stale Cartwright/reused IDs, unflagged exits, prior seasons, loans/transfers, stale squads, injured current players, real weekly/prize transactions, replay identity, unclaimed entitlement on outage, mint-time races and unowned inventory guards.');
}finally{delete globalThis.__mintFixture;await pg.close();await rm(temp,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {PgDialect} from 'drizzle-orm/pg-core';
const require=createRequire(import.meta.url);
function load(path, deps={}){
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('exports','require',code)(exports,n=>deps[n]||require(n));return exports;
}
const shared=load('shared/prize-notification-policy.ts');
assert.equal(shared.shouldPromptPrizeMint({gameWeek:7,status:'ready_to_mint'}),false);
assert.equal(shared.shouldPromptPrizeMint({gameWeek:8,status:'ready_to_mint'}),true);
assert.equal(shared.shouldPromptPrizeMint({gameWeek:8,status:'minted',cardId:99}),false);
const policy=load('server/services/prizeNotificationPolicy.ts',{'../../shared/prize-notification-policy.js':shared});
const dialect=new PgDialect();const query=dialect.sqlToQuery(policy.obsoletePrizePromptSql());
const result=execFileSync('python3',['-c',`
import sqlite3,json,sys
q=json.load(sys.stdin); db=sqlite3.connect(':memory:')
db.create_function('concat',-1,lambda *v: ''.join(map(str,v)))
db.execute("attach database ':memory:' as app")
db.executescript('create table app.competitions(id int,game_week int); create table app.competition_entries(id int,competition_id int,user_id text,prize_card_id int,tiebreak_meta text);create table app.notifications(user_id text,dedupe_key text);')
db.executemany('insert into app.competitions values(?,?)',[(1,7),(2,8)])
db.executemany('insert into app.competition_entries values(?,?,?,?,?)',[(11,1,'u',99,'{}'),(12,2,'u',None,'{}'),(13,2,'u',100,'{}')])
keys=[('competition:1:entry:11:free-card-claim-ready',1),('competition:1:entry:11:free-card-claimed',1),('competition:2:entry:12:free-card-claim-ready',0),('competition:2:entry:13:free-card-claim-ready',1),('competition:2:entry:13:free-card-claimed',0),('welcome:new-user:u',0)]
for key,want in keys:
 db.execute('delete from app.notifications');db.execute('insert into app.notifications values(?,?)',('u',key))
 value=db.execute('select '+q['sql'].replace('$1','?')+' from app.notifications n',q['params']).fetchone()[0]
 assert value==want,(key,value,want)
print('SQL policy: GW1–7 prompts hidden; unminted GW8 visible; issued-card reminders hidden; future receipts and unrelated notifications preserved.')
`],{input:JSON.stringify(query),encoding:'utf8'});
console.log(result.trim());
for(const channel of ['web','native']){
 const calls=[];await policy.retireQueuedPrizePrompts({execute:async s=>calls.push(dialect.sqlToQuery(s))},channel);
 assert.match(calls[0].sql,/status='failed'/);assert.match(calls[0].sql,/pending.*processing/);
 assert.ok(!/delete|player_cards.*update|owner_id\s*=/.test(calls[0].sql));
}
console.log('GW8 popup and queued push retirement checks passed; no card or award records changed.');

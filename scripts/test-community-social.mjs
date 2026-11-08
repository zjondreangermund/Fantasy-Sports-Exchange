import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {PgDialect} from 'drizzle-orm/pg-core';
import express from 'express';
const temp=await mkdtemp(path.join(tmpdir(),'community-social-')),pg=new PGlite(),dialect=new PgDialect();let server;
try {
  await pg.exec(`CREATE SCHEMA app;CREATE TABLE app.users(id varchar(255) PRIMARY KEY,email text,name text,avatar_url text,manager_team_name text,created_at timestamptz,updated_at timestamptz);
    INSERT INTO app.users(id,name) VALUES('a','Team A'),('b','Team B'),('admin','Admin');
    CREATE TABLE app.notifications(dedupe_key text);CREATE TABLE app.audit_logs(user_id text,action text,meta jsonb);`);
  const executor=handle=>({execute:statement=>{const query=dialect.sqlToQuery(statement);return handle.query(query.sql,query.params);}});
  globalThis.__socialDb={...executor(pg),transaction:fn=>pg.transaction(tx=>fn(executor(tx)))};
  await build({entryPoints:['server/routes/communityChatV2.routes.ts'],outdir:temp,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'},plugins:[{name:'fixtures',setup(b){
    b.onResolve({filter:/\/db\.js$/},()=>({path:'db',namespace:'fixture'}));
    b.onResolve({filter:/\/notifications\.js$/},()=>({path:'notifications',namespace:'fixture'}));
    b.onResolve({filter:/\/communityMentions\.js$/},()=>({path:'mentions',namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='db'?'export const db=globalThis.__socialDb; export const pool={};':args.path==='notifications'?'export const ensureNotificationsSchema=async()=>{};export const createNotificationOnce=async()=>true;':'export const searchCommunityMentions=async()=>[];',loader:'js'}));
  }}]});
  await build({entryPoints:['shared/community-social.ts'],outdir:temp,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
  const {COMMUNITY_EMOJIS}=await import(path.join(temp,'community-social.mjs'));
  const {registerCommunityChatV2Routes}=await import(path.join(temp,'communityChatV2.routes.mjs'));
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.authUserId=req.headers['x-user']||'';next();});
  registerCommunityChatV2Routes(app,{requireAuth:(req,res,next)=>req.authUserId?next():res.sendStatus(401),isAdmin:(req,res,next)=>req.authUserId==='admin'?next():res.sendStatus(403)});
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=(url,user='a',method='GET',body,extra={})=>fetch(base+url,{method,headers:{'x-user':user,'content-type':'application/json',...extra},body:body?JSON.stringify(body):undefined});
  const pause=()=>new Promise(resolve=>setTimeout(resolve,370));
  let response=await call('/community-live/messages','a','POST',{message:'Great goal 😂'});assert.equal(response.status,201);const message=(await response.json()).message;assert.equal(message.gifId,null);
  const url=`/community-live/messages/${message.id}/reactions`;
  assert.equal((await call(url,'','PUT',{emoji:'😂',active:true})).status,401);
  assert.equal((await call(url,'a','PUT',{emoji:'not-allowed',active:true})).status,400);
  assert.equal((await call(url,'a','PUT',{emoji:'😂',active:true},{origin:'https://evil.test'})).status,403);
  await pause();assert.equal((await call(url,'a','PUT',{emoji:'😂',active:true,userId:'b'})).status,200);
  response=await call(url,'b','PUT',{emoji:'😂',active:true});assert.equal(response.status,200);assert.deepEqual((await response.json()).message.reactions,[{emoji:'😂',count:2,mine:true}]);
  await pause();assert.equal((await call(url,'a','PUT',{emoji:'😂',active:true})).status,200);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM app.community_chat_reactions')).rows[0].n,2,'retry must not duplicate a reaction');
  await pause();await call(url,'a','PUT',{emoji:'😂',active:false});
  const a=(await (await call(`/community-live/messages/${message.id}`)).json()).message;
  assert.deepEqual(a.reactions,[{emoji:'😂',count:1,mine:false}],'another member reaction survives removal');
  for(const emoji of COMMUNITY_EMOJIS){await pause();assert.equal((await call(url,'admin','PUT',{emoji,active:true})).status,200,`Full picker reaction ${emoji}`);}
  await pg.exec(`INSERT INTO app.community_chat_messages(user_id,message,created_at) VALUES('a','expired',now()-interval '25 hours')`);
  const expired=(await pg.query("SELECT id FROM app.community_chat_messages WHERE message='expired'")).rows[0].id;
  await pause();assert.equal((await call(`/community-live/messages/${expired}/reactions`,'a','PUT',{emoji:'🔥',active:true})).status,404);
  await pause();assert.equal((await call('/community-live/messages','admin','POST',{gifId:'https://evil.test/payload.gif'})).status,400);
  await new Promise(resolve=>setTimeout(resolve,1250));response=await call('/community-live/messages','a','POST',{gifId:'lol'});assert.equal(response.status,400,'GIF-only messages are disabled');assert.equal((await call('/community-live/messages','a','POST',{message:'caption',gifId:'goal'})).status,400,'GIF attachments are disabled');
  await new Promise(resolve=>setTimeout(resolve,1250));await call(`/community-live/messages/${message.id}`,'a','DELETE');
  await pause();assert.equal((await call(url,'b','PUT',{emoji:'🔥',active:true})).status,404);
  const deleted=(await (await call(`/community-live/messages/${message.id}`)).json()).message;assert.equal(deleted.gifId,null);assert.deepEqual(deleted.reactions,[]);
  await pg.query('DELETE FROM app.community_chat_messages WHERE id=$1',[message.id]);assert.equal((await pg.query('SELECT count(*)::int AS n FROM app.community_chat_reactions')).rows[0].n,0,'expiry purge cascades reaction rows');
  console.log('Community social passed: text posts, all composer emojis as reactions, disabled GIFs, real reaction SQL, auth/origin/expiry guards, per-user state, retry idempotency, removal and deletion cleanup.');
} finally {if(server)await new Promise(resolve=>server.close(resolve));delete globalThis.__socialDb;await pg.close();await rm(temp,{recursive:true,force:true});}


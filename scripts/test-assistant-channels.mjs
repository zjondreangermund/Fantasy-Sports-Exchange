import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
const temp=await mkdtemp(path.join(tmpdir(),'assistant-channels-'));
let server;
try{
  let calls=[];
  globalThis.__assistantChannelPool={query:async(sql,params=[])=>{calls.push({sql,params});if(sql.includes('SELECT (SELECT count(*)::int FROM app.users)'))return {rows:[{users:4321}]};if(sql.includes('SELECT id,name,manager_team_name')&&!sql.includes('ILIKE'))return {rows:[{id:params[0],name:'Own account'}]};if(sql.includes('FROM app.wallets WHERE user_id=$1'))return {rows:[{balance:10,lockedBalance:0}]};return {rows:[]};}};
  const stubs={db:'export const pool=globalThis.__assistantChannelPool;',fpl:'export const fplApi={fixturesLive:async()=>[]};',football:'export const loadPremierAvailability=async()=>({injuries:[],confirmedAvailable:[],historicalInjuries:[]});',security:'export const securityOriginGuard=(req,res,next)=>next();export const securityControlMiddleware=(req,res,next)=>next();',readonly:'export const strictReadOnlyGuard=(req,res,next)=>next();'};
  await build({entryPoints:['server/routes/arenaAssistant.routes.ts'],outfile:path.join(temp,'routes.mjs'),bundle:true,platform:'node',format:'esm',plugins:[{name:'isolated-dependencies',setup(b){for(const [filter,name] of [[/\/db\.js$/,'db'],[/\/services\/fplApi\.js$/,'fpl'],[/\/footballData\.routes\.js$/,'football'],[/\/securityControl\.js$/,'security'],[/\/readOnlyGuard\.js$/,'readonly']])b.onResolve({filter},()=>({path:name,namespace:'isolated'}));b.onLoad({filter:/.*/,namespace:'isolated'},args=>({contents:stubs[args.path],loader:'js'}));}}]});
  const {registerArenaAssistantRoutes}=await import(path.join(temp,'routes.mjs'));
  const app=express();app.use(express.json());
  const requireAuth=(req,res,next)=>{const actor=req.get('x-test-user');if(!actor)return res.status(401).json({message:'Unauthorized'});req.authUserId=actor;req.user={id:actor,claims:{sub:actor}};next();};
  registerArenaAssistantRoutes(app,{requireAuth,isAdminUser:async req=>req.authUserId==='admin'});
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(route,user,body)=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{...(user?{'x-test-user':user}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
  for(const route of ['/api/assistant/admin/ask','/api/assistant/member/ask'])assert.equal((await request(route,null,{question:'wallet'})).status,401);
  for(const question of ['Platform overview','Site views today','Support inbox','Show latest game week log','Show all wallets']){
    for(const [route,user] of [['/api/assistant/admin/ask','member'],['/api/assistant/member/ask','member'],['/api/assistant/member/ask','admin'],['/api/assistant/ask','admin']]){
      calls=[];const result=await request(route,user,{question,admin:true,audience:'admin'});assert.equal(result.status,403,`${route}: ${question}`);assert(!JSON.stringify(result.data).includes('4321'));assert(!calls.some(c=>c.sql.includes('SELECT (SELECT count(*)::int FROM app.users)')));
    }
  }
  let result=await request('/api/assistant/admin/ask','admin',{question:'Platform overview'});assert.equal(result.status,200);assert.equal(result.data.audience,'admin');assert.equal(result.data.sections[0].rows[0].users,4321);
  for(const body of [{question:'wallet',userId:'bob'},{question:'wallet',userSearch:'Bob'},{question:'and yesterday',previousTopics:['visitors']},{question:'Run fixtures sync',context:{taskDraft:{kind:'admin_sync',fields:{jobType:'fixtures'}}}}]){
    result=await request('/api/assistant/member/ask','member',body);assert.equal(result.status,403);assert(!JSON.stringify(result.data).includes('4321'));
  }
  calls=[];result=await request('/api/assistant/member/ask','member',{question:'my wallet'});assert.equal(result.status,200);assert.equal(result.data.account.id,'member');for(const call of calls.filter(c=>/WHERE user_id=\$1/.test(c.sql)))assert.equal(call.params[0],'member');
  for(const [route,body] of [
    ['/api/assistant/admin/tasks/preview',{draft:{kind:'weekly_claim',fields:{}}}],
    ['/api/assistant/admin/actions/preview',{kind:'notification_read',recordId:1}],
    ['/api/assistant/admin/tasks/confirm',{token:'00000000-0000-4000-8000-000000000001',confirmed:true}],
  ])assert.equal((await request(route,'member',body)).status,403);
  assert.equal((await request('/api/assistant/admin/tasks/options','member')).status,403);
  assert.equal((await request('/api/assistant/member/tasks/options','member')).status,200);
  assert.equal((await request('/api/assistant/member/tasks/preview','admin',{draft:{kind:'admin_sync',fields:{jobType:'fixtures'}}})).status,403);
  assert.equal((await request('/api/assistant/member/actions/preview','admin',{kind:'support_status',recordId:7,status:'resolved'})).status,403);
  result=await request('/api/assistant/access','member');assert.deepEqual(result.data,{userId:'member',isAdmin:false});
  result=await request('/api/assistant/access','admin');assert.deepEqual(result.data,{userId:'admin',isAdmin:true});
  const widget=await readFile('client/src/components/FloatingSupportWidget.tsx','utf8');assert(widget.includes('currentUserId}:${adminChat?'));assert(widget.includes('["/api/assistant/access",currentUserId]'));assert(widget.includes('data.userId===currentUserId'));
  const panel=await readFile('client/src/components/ArenaAssistantPanel.tsx','utf8');assert(panel.includes('[userId,admin]'));assert(panel.includes("admin?'admin':'member'"));
  console.log('Assistant channel HTTP checks passed: separate namespaces, authenticated admin verification, body spoofing, legacy member scope, cross-account and inherited-topic rejection, task/action gates, own-wallet scope, identity-bound role cache and remounted role-specific chat state.');
}finally{if(server)await new Promise(resolve=>server.close(resolve));delete globalThis.__assistantChannelPool;await rm(temp,{recursive:true,force:true});}

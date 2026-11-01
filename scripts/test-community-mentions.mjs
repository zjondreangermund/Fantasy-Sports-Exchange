import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const temp=await mkdtemp(path.join(tmpdir(),'community-mentions-')),db=new PGlite();
try{
  await build({entryPoints:['shared/community-mentions.ts','server/services/communityMentions.ts','client/src/lib/community-intent.ts','client/src/lib/community-chat.ts'],outdir:temp,outbase:'.',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm'});
  const {communityMentionHandle,activeMentionToken,insertCommunityMention,extractCommunityMentions,communityMentionDestination,communityLinkIntent}=await import(path.join(temp,'shared/community-mentions.mjs'));
  assert.equal(communityMentionHandle(' Manchester United! '),'Manchester_United');
  let token=activeMentionToken('Hi @Liv',7);assert.deepEqual(token,{start:3,end:7,query:'Liv',explicit:true});
  assert.equal(insertCommunityMention('Hi @Liv',token,'Liverpool').value,'Hi @Liverpool ');
  assert.equal(activeMentionToken('Liverpool').explicit,false);assert.equal(activeMentionToken('L'),null);assert.equal(activeMentionToken('mail@example.com'),null);
  token=activeMentionToken('Hi @Liverpool next',7);assert.equal(insertCommunityMention('Hi @Liverpool next',token,'Leeds').value,'Hi @Leeds next');
  token=activeMentionToken('hello Liv');assert.equal(insertCommunityMention('hello Liv',token,'Liverpool').value,'hello @Liverpool ');
  token=activeMentionToken('x'.repeat(275)+' @Li');assert.equal(insertCommunityMention('x'.repeat(275)+' @Li',token,'Manchester_United'),null);
  assert.deepEqual(extractCommunityMentions('Hi @Liverpool and @LIVERPOOL @Leeds.' ).map(t=>t.toLowerCase()),['liverpool','leeds']);
  assert.deepEqual(extractCommunityMentions('@'+'a'.repeat(31)),[]);
  assert.deepEqual(extractCommunityMentions('mail@example.com and @Liv'),['Liv']);
  await db.exec(`CREATE SCHEMA app;CREATE TABLE app.users(id text,manager_team_name text,name text,email text,is_banned boolean);
    INSERT INTO app.users VALUES('self','MyTeam','PRIVATE SELF NAME','self-private@example.test',false),('liv','Liverpool','PRIVATE REAL NAME','liv-private@example.test',false),('man','Manchester United','PRIVATE MGR','manager-private@example.test',false),('city1','MAN-City',null,'secret1@example.test',false),('city2','MANCity',null,'secret2@example.test',false),('hidden',null,null,'hidden@example.test',false),('banned','Banned Club',null,'banned@example.test',true);`);
  const {searchCommunityMentions}=await import(path.join(temp,'server/services/communityMentions.mjs'));
  const q=async(sql,params)=>(await db.query(sql,params)).rows;
  let matches=await searchCommunityMentions(q,'self','liv',true);assert.equal(matches[0].teamName,'Liverpool');assert.equal(matches[0].handle,'Liverpool');assert.equal(matches[0].ambiguous,false);
  assert(!JSON.stringify(matches).includes('PRIVATE'));assert(!JSON.stringify(matches).includes('@example'));assert.deepEqual(Object.keys(matches[0]).sort(),['ambiguous','handle','teamName']);
  assert.equal((await searchCommunityMentions(q,'self','pool')).length,1);assert.equal((await searchCommunityMentions(q,'self','pool',true)).length,0);
  assert.equal((await searchCommunityMentions(q,'self','man')).filter(m=>m.ambiguous).length,2);
  assert.equal((await searchCommunityMentions(q,'self','MyTeam')).length,0);assert.equal((await searchCommunityMentions(q,'self','hidden')).length,0);assert.equal((await searchCommunityMentions(q,'self','Banned')).length,0);
  assert.equal((await searchCommunityMentions(q,'self',"%' OR true --")).length,0);
  assert.equal((await searchCommunityMentions(q,'self','%')).length,0);
  const destination=communityMentionDestination('community-mention:123:liv',456);assert.equal(destination,'/dashboard?community=1&communityMessage=123&notification=456');
  assert.deepEqual(communityLinkIntent(destination),{messageId:123,notificationId:456});assert.equal(communityLinkIntent('https://evil.test/?community=1'),null);
  assert.deepEqual(communityLinkIntent('http://localhost/dashboard?community=1','http://localhost'),{messageId:null,notificationId:null});
  assert.equal(communityLinkIntent('/dashboard?community=1&communityMessage=-2').messageId,null);
  for(const name of ['nativePush','webPush']){
    const source=await readFile(`server/services/${name}.ts`,'utf8'),start=source.indexOf('function notificationUrl('),end=source.indexOf('\n}',start)+2;
    await build({stdin:{contents:`import {communityMentionDestination} from './shared/community-mentions.js';\n${source.slice(start,end)}\nexport {notificationUrl};`,resolveDir:process.cwd(),loader:'ts'},outfile:path.join(temp,name+'.mjs'),bundle:true,platform:'node',format:'esm'});
    const {notificationUrl}=await import(path.join(temp,name+'.mjs'));assert.equal(notificationUrl('community-mention:123:liv',456),destination);assert.equal(notificationUrl('withdrawal:4',9),'/wallet');
  }
  // Execute the production service worker click handler for cold and already-open PWA cases.
  const events={},opened=[];let navigation='',focus=0;
  const ctx={URL,Number,Promise,self:{location:{origin:'https://playfantasyarena.com'},addEventListener:(name,handler)=>events[name]=handler,clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}}};
  vm.runInNewContext(await readFile('client/public/sw.js','utf8'),ctx);
  assert.equal(ctx.actionableNotificationPath('/community',456),'/dashboard?community=1&notification=456');
  let pending;events.notificationclick({notification:{close(){},data:{url:destination,notificationId:456}},waitUntil:p=>pending=p});await pending;assert.equal(opened[0],'https://playfantasyarena.com'+destination);
  ctx.self.clients.matchAll=async()=>[{url:'https://playfantasyarena.com/dashboard',navigate:async url=>navigation=url,focus:()=>focus++}];
  events.notificationclick({notification:{close(){},data:{url:destination,notificationId:456}},waitUntil:p=>pending=p});await pending;assert.equal(navigation,'https://playfantasyarena.com'+destination);assert.equal(focus,1);
  assert.equal(ctx.actionableNotificationPath('https://evil.test/',456),'/dashboard');
  // A sign-in redirect may remove the query: keep only numeric intent IDs until it mounts.
  const storage=new Map();globalThis.sessionStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k)};
  globalThis.window={location:new URL('https://playfantasyarena.com'+destination)};globalThis.history={state:null,replaceState:(state,title,url)=>window.location=new URL(url,window.location.origin)};
  const intent=await import(path.join(temp,'client/src/lib/community-intent.mjs'));
  intent.captureCommunityLink();window.location=new URL('https://playfantasyarena.com/dashboard');assert.deepEqual(intent.takeCommunityIntent(),{messageId:123,notificationId:456});assert.equal(intent.takeCommunityIntent(),null);
  window.location=new URL('https://playfantasyarena.com'+destination+'&keep=1');assert.deepEqual(intent.takeCommunityIntent(),{messageId:123,notificationId:456});assert.equal(window.location.search,'?keep=1');
  const {mergeCommunityMessages,communityMessagesWithTarget}=await import(path.join(temp,'client/src/lib/community-chat.mjs'));
  const rows=Array.from({length:300},(_,i)=>({id:i+1,userId:'manager',teamName:'Team',message:'hi',createdAt:new Date().toISOString()}));
  const clipped=mergeCommunityMessages(rows);assert.equal(clipped.length,250);assert(!clipped.some(r=>r.id===1));
  assert(communityMessagesWithTarget(clipped,rows[0]).some(r=>r.id===1));assert(!communityMessagesWithTarget(clipped,{...rows[0],createdAt:'2000-01-01'}).some(r=>r.id===1));
  const widget=await readFile('client/src/components/FloatingSupportWidget.tsx','utf8');assert(widget.includes('takeCommunityIntent'));assert(widget.includes('setHighlightedMessageId(messageId)'));assert(widget.includes('CommunityMentionComposer value={editingText}'));assert(widget.includes('setFollowingLatest(false)'));
  console.log('Community mention tests passed: partial-name insertion, cursor replacement, length/identity ambiguity, private-field exclusion, literal SQL search, exact native/web message URLs, PWA cold/warm clicks, external URL rejection, sign-in intent recovery, and Community highlighting.');
}finally{await db.close();delete globalThis.window;delete globalThis.history;delete globalThis.sessionStorage;await rm(temp,{recursive:true,force:true});}

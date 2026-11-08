import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {QueryClient,QueryObserver} from '@tanstack/react-query';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(compile(fs.readFileSync(path,'utf8'))).toString('base64'));
const {communityRequestPolicy,coalesceCommunityRefresh}=await load('client/src/lib/community-request-policy.ts');
for(const open of [true,false])for(const mode of ['community','help','admin-help']){
  assert.equal(communityRequestPolicy(open,mode,false,true).stream,false);
  assert.equal(communityRequestPolicy(open,mode,false,true).pollMs,false);
}
assert.deepEqual(communityRequestPolicy(false,'community',true,true),{stream:false,pollMs:60000});
assert.deepEqual(communityRequestPolicy(true,'community',true,true),{stream:true,pollMs:60000});
assert.deepEqual(communityRequestPolicy(true,'community',true,false),{stream:true,pollMs:15000});
let refreshes=0;
const burst=coalesceCommunityRefresh(()=>refreshes++,10);
for(let i=0;i<100;i++)burst.schedule();
await new Promise(resolve=>setTimeout(resolve,30));assert.equal(refreshes,1);
burst.schedule();burst.cancel();await new Promise(resolve=>setTimeout(resolve,30));assert.equal(refreshes,1);

const originalFetch=globalThis.fetch;
const {notificationQueryOptions}=await load('client/src/lib/notification-query.ts');
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});const unsubscribes=[];
try {
  let calls=0,signal;
  globalThis.document={visibilityState:'visible'};
  globalThis.fetch=async(_url,options)=>{calls++;signal=options.signal;await new Promise(resolve=>setTimeout(resolve,15));return {ok:true,json:async()=>({unreadCount:2,notifications:[]})};};
  for(let i=0;i<3;i++)unsubscribes.push(new QueryObserver(client,notificationQueryOptions('manager-a')).subscribe(()=>{}));
  await new Promise(resolve=>setTimeout(resolve,35));assert.equal(calls,1,'dot, toast and chat must share one concurrent request');
  assert.ok(signal instanceof AbortSignal);
  assert.notDeepEqual(notificationQueryOptions('manager-a').queryKey,notificationQueryOptions('manager-b').queryKey,'account caches must be isolated');
  globalThis.document={visibilityState:'hidden'};assert.equal(notificationQueryOptions('manager-a').refetchInterval(),false);
} finally {for(const unsubscribe of unsubscribes)unsubscribe();client.clear();globalThis.fetch=originalFetch;delete globalThis.document;}

// Strict identities must stay fresh even though their pure text transforms are memoized.
const identity={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('server/services/fplPlayerIdentity.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:identity});
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('server/services/apiFootballPlayerDirectory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,console,Map,Set,URL,Date,require(name){
  if(name==='./fplPlayerIdentity.js')return identity;
  if(name==='drizzle-orm')return {sql:()=>({})};
  if(name==='../db.js')return {db:{execute:async()=>({rows:[]})}};
  throw Error(name);
}});
const player={name:'Original Footballer',team:'Arsenal',position:'MID'};
const candidate={...player,apiPlayerId:123,firstName:'Original',lastName:'Footballer'};
assert.equal(exports.resolveApiFootballPlayer(player,[candidate])?.apiPlayerId,123);
candidate.name='Different Human';candidate.firstName='Different';candidate.lastName='Human';
assert.equal(exports.resolveApiFootballPlayer(player,[candidate]),null,'cached text must not pin an old match');
for(let i=0;i<9000;i++)identity.normalizePlayerText(`Éxample ${i}`);
assert.equal(identity.normalizePlayerText('  Émiliano &amp; Martínez '),'emiliano martinez');

let fetches=0;
const provider={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('server/services/fplApi.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:provider,console,Date,URL,AbortSignal,process:{env:{}},fetch:async(_url,options)=>{
  assert.ok(options.signal instanceof AbortSignal,'provider reads must be bounded');
  if(++fetches===1)throw new Error('provider timeout');
  return {ok:true,json:async()=>({events:[],elements:[]})};
}});
await assert.rejects(provider.fplApi.bootstrap(),/provider timeout/);
await provider.fplApi.bootstrap();assert.equal(fetches,2,'failed shared reads must release their in-flight slot');
console.log('Performance checks passed: hidden/closed chat, burst coalescing, shared viewer-scoped notifications, pure identity caching and provider failure recovery.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
for(const [file,name,arg] of [
  ['client/src/lib/notifications.ts','notificationDestination',{dedupeKey:'collection:common-limit-10:2026-11:v1'}],
  ['server/services/nativePush.ts','notificationUrl','collection:common-limit-10:2026-11:v1'],
  ['server/services/webPush.ts','notificationUrl','collection:common-limit-10:2026-11:v1'],
]) {
  const source=fs.readFileSync(file,'utf8');
  const start=source.indexOf(`function ${name}(`);
  const end=source.indexOf('\n}',start)+2;
  const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const resolve=new Function(js+`;return ${name};`)();
  assert.equal(resolve(arg),'/collection?reduceCommons=1',file);
}
console.log('Common reduction notification links passed for Inbox, Android and Web Push.');

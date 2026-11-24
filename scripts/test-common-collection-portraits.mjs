import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function compile(file,requireStub=()=>({})){const module={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports,requireStub);return module.exports;}
const {commonCollectionPortraitCard}=compile('client/src/lib/common-collection-portrait.ts');
const {buildCardImageCandidates}=compile('client/src/lib/card-image.ts',()=>({toApiUrl:value=>value}));
const card={id:27,name:'Player',imageUrl:'https://example.com/unverified.png'};
const apiCard=commonCollectionPortraitCard(card,{source:'api-football',player:{name:'Verified Player',apiFootballId:2937,imageUrl:'https://media.api-sports.io/football/players/2937.png'}});
const apiCandidates=buildCardImageCandidates(apiCard);
assert(apiCandidates[0].includes(encodeURIComponent('/football/players/2937.png')));
assert(!apiCandidates.some(url=>url.includes('/players/27.png')),'Never use the internal card ID as a provider ID');
const fplCard=commonCollectionPortraitCard(card,{source:'fpl-live',player:{imageUrl:'https://resources.premierleague.com/premierleague25/photos/players/110x140/1234.png'}});
assert(buildCardImageCandidates(fplCard)[0].includes('image-proxy?url='));
for(const profile of [undefined,{source:'card-fallback',player:{apiFootballId:2937,imageUrl:card.imageUrl}}]){
 assert.deepEqual(buildCardImageCandidates(commonCollectionPortraitCard(card,profile)),['/players/fallback.svg']);
}
assert(fs.readFileSync('client/src/components/CommonCollectionManager.tsx','utf8').includes('commonCollectionPortraitCard(card,data)'),'Collection rows must pass the verified profile to the photo component');
console.log('Common collection portraits passed: verified API/FPL photos, safe fallback and provider ID separation.');

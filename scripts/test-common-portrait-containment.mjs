import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.createSourceFile('CommonCollectionManager.tsx',fs.readFileSync('client/src/components/CommonCollectionManager.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function attr(node,name){const a=node.attributes?.properties.find(p=>p.name?.text===name);return a?.initializer?.text ?? (a?true:undefined);}
let portraits=0,scrolls=0,dialogs=0;
function visit(node){
 if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(source)==='CardPlayerImage'){
  portraits++;
  const parent=node.parent;
  assert(ts.isJsxElement(parent),'Absolute portrait must have a containing element');
  const classes=String(attr(parent.openingElement,'className')).split(/\s+/);
  for(const token of ['relative','h-12','w-10','shrink-0','overflow-hidden'])assert(classes.includes(token),`Portrait container requires ${token}`);
 }
 if(ts.isJsxOpeningElement(node)&&attr(node,'data-common-reduction-scroll')){
  scrolls++;const classes=String(attr(node,'className'));
  for(const token of ['min-h-0','flex-1','overflow-y-auto'])assert(classes.includes(token));
 }
 if(ts.isJsxOpeningElement(node)&&attr(node,'data-common-reduction-dialog')){
  dialogs++;const classes=String(attr(node,'className')).split(/\s+/);
  assert(classes.includes('flex')&&classes.includes('flex-col')&&classes.includes('overflow-hidden'));
 }
 ts.forEachChild(node,visit);
}
visit(source);assert.equal(portraits,1);assert.equal(scrolls,1);assert.equal(dialogs,1);
console.log('Common portrait containment and separate dialog scrolling regression checks passed.');

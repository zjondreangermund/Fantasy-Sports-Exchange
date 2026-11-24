import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=ts.createSourceFile('CommonCollectionManager.tsx',fs.readFileSync('client/src/components/CommonCollectionManager.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const attr=(node,name)=>node.attributes?.properties.find(p=>p.name?.text===name);
let checkbox,button;
function visit(node){
 if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(source)==='input'&&attr(node,'id')?.initializer?.text==='common-burn-acknowledgement')checkbox=node;
 if(ts.isJsxOpeningElement(node)&&node.tagName.getText(source)==='Button'&&attr(node,'onClick')?.initializer?.getText(source).includes('mutation.mutate'))button=node;
 ts.forEachChild(node,visit);
}
visit(source);assert(checkbox);assert(button);
const expression=node=>attr(node,'disabled').initializer.expression.getText(source);
const checkboxDisabled=new Function('mutation','ready',`return ${expression(checkbox)};`);
assert.equal(checkboxDisabled({isPending:false},false),false,'Consent must be tappable even when another selection rule blocks burning');
assert.equal(checkboxDisabled({isPending:true},true),true,'Do not change consent during an active burn');
const burnDisabled=new Function('mutation','ready','confirmed',`return ${expression(button)};`);
assert.equal(burnDisabled({isPending:false},false,true),true,'Consent cannot bypass protected cards or invalid teams');
assert.equal(burnDisabled({isPending:false},true,false),true,'Burn requires explicit consent');
assert.equal(burnDisabled({isPending:false},true,true),false,'Valid confirmed teams can proceed');
const text=source.text;assert(text.includes('Before burning: '));assert(text.includes('void refreshCollection()'));assert(text.includes('min-h-11'));assert(text.includes('setConfirmed(false);},[teams])'));
console.log('Burn acknowledgement checks passed: tappable consent, protected burn gate, visible blocker, lock refresh and mobile touch target.');

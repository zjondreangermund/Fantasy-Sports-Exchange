import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const temp=await mkdtemp(path.join(tmpdir(),'arena-popup-stack-'));
try{
 await build({entryPoints:['client/src/lib/popup-stack.ts'],outfile:path.join(temp,'stack.mjs'),bundle:true,platform:'node',format:'esm'});
 const {registerPopup,unregisterPopup,isTopPopup}=await import(path.join(temp,'stack.mjs'));
 const element=()=>({children:new Set(),contains(node){return this.children.has(node);}});
 const page=element(),chat=element(),welcome=element(),dropdown=element(),captain=element();chat.children.add(page);
 const chatLayer=registerPopup(chat);assert(chatLayer>=10000);assert(isTopPopup(page));
 const welcomeLayer=registerPopup(welcome);assert(welcomeLayer>chatLayer);assert(!isTopPopup(page));assert(isTopPopup(welcome));
 const selectLayer=registerPopup(dropdown);assert(selectLayer>welcomeLayer);unregisterPopup(dropdown);assert(isTopPopup(welcome));
 const captainLayer=registerPopup(captain,12000);assert(captainLayer>=12000);const confirmation=element();assert(registerPopup(confirmation)>captainLayer);unregisterPopup(confirmation);unregisterPopup(captain);assert(isTopPopup(welcome));
 unregisterPopup(welcome);assert(isTopPopup(chat));
 for(let i=0;i<500;i++){const popup=element();assert(registerPopup(popup)>chatLayer);assert(isTopPopup(popup));unregisterPopup(popup);assert(isTopPopup(page));}
 unregisterPopup(chat);const next=element();assert.equal(registerPopup(next),chatLayer);unregisterPopup(next);
 const portal=await readFile('client/src/components/ui/popup-portal.tsx','utf8');assert(portal.includes('document.body'));assert(portal.includes('<FocusScope loop trapped asChild>'));assert(portal.includes('<DismissableLayer disableOutsidePointerEvents asChild>'));
 // Audit all custom modal DOM roots: transformed page containers cannot own them.
 const files=['FloatingSupportWidget','InstallAppButton','PushNotificationControl','cards/CardProfileModal','cards/PremiumFootballCard','tournaments/EntryLineupEditor','native/NativePlayPage','native/NativeTournamentLeaderboard','native/NativeCardTradeSheet','native/NativeMarketPage','native/NativeAppUpdatePrompt','native/NativeMobileShell'];
 let modalRoots=0;
 for(const name of files){const file='client/src/components/'+name+'.tsx',source=await readFile(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const visit=node=>{if(ts.isJsxElement(node)){const role=node.openingElement.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(ast)==='role');if(role?.initializer&&ts.isStringLiteral(role.initializer)&&role.initializer.text==='dialog'){modalRoots++;let parent=node,portaled=false;while(parent){if(ts.isJsxElement(parent)&&parent.openingElement.tagName.getText(ast)==='PopupPortal')portaled=true;parent=parent.parent;}assert(portaled,file+' has a dialog trapped inside the page');}}ts.forEachChild(node,visit);};visit(ast);}
 assert(modalRoots>=10);
 console.log('Popup checks passed: foreground ordering, nested controls, explicit captain layer, chat focus handoff, dismissal/reopening, layer cleanup, and body portals for '+modalRoots+' custom modal roots.');
}finally{await rm(temp,{recursive:true,force:true});}

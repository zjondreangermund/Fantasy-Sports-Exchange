import fs from 'node:fs';
import path from 'node:path';
const entries=[];
function visit(dir){
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,item.name);
    if(item.isDirectory()){if(item.name!=='admin')visit(file);continue;}
    if(!file.endsWith('.tsx')||/admin|FloatingSupportWidget|ArenaAssistantPanel/i.test(file))continue;
    const text=fs.readFileSync(file,'utf8');
    for(const match of text.matchAll(/data-assistant-guide="([^"\n]{35,})"/g))entries.push({source:file.replace('client/src/',''),answer:match[1],kind:"authored-help"});

  }
}
visit('client/src');
const unique=[...new Map(entries.map(row=>[row.answer,row])).values()];
fs.writeFileSync('shared/arena-help-index.ts','// Generated public UI help; never includes server source or account data.\nexport const arenaHelpIndex: Array<{source:string;answer:string;kind?:"authored-help"}> = '+JSON.stringify(unique,null,2)+';\n');
console.log(`Indexed ${unique.length} public help explanations.`);

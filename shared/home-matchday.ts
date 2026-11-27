import {fixtureMatchesTab} from "./fixture-display.js";

export const HOME_RECAP_WINDOW_MS=24*60*60*1000;
export const HOME_PREMATCH_WINDOW_MS=90*60*1000;
export function homeApiFixtureId(f:any):number {
  if(f?.intelligenceAvailable===false || f?.source==="fpl")return 0;
  const id=Number(f?.apiFixtureId||0);
  return Number.isSafeInteger(id)&&id>0?id:0;
}
const kickoff=(f:any)=>Date.parse(String(f?.kickoffTime||""));
const updated=(f:any)=>Date.parse(String(f?.updatedAt||""))||0;
const phase=(f:any)=>fixtureMatchesTab(f,"finished")?3:fixtureMatchesTab(f,"live")?2:1;

// Only merge explicit API-Football identities. FPL-only IDs must never be
// interpreted as API-Football fixture IDs. Never derive FT from elapsed time.
export function selectHomeMatchday(live:any[],finished:any[],upcoming:any[],now:number,liveFeedHealthy:boolean){
  const rows=new Map<string,any>();
  for(const f of [...upcoming,...live,...finished]){
    if(!f||Number(f.leagueId)!==39)continue;
    const api=homeApiFixtureId(f);
    const key=api?"api:"+api:"display:"+String(f.fplFixtureId||f.id);
    const old=rows.get(key);
    // A confirmed full-time status must not be regressed by a stale live or schedule list.
    if(old&&phase(old)===3&&phase(f)!==3)continue;
    if(!old||phase(f)===3&&phase(old)!==3||updated(f)>updated(old)||(updated(f)===updated(old)&&phase(f)>=phase(old)))rows.set(key,f);
  }
  const all=[...rows.values()];
  const active=all.filter(f=>fixtureMatchesTab(f,"live")).sort((a,b)=>kickoff(a)-kickoff(b));
  const next=all.filter(f=>String(f.status).toUpperCase()==="NS"&&kickoff(f)>=now).sort((a,b)=>kickoff(a)-kickoff(b));
  const recent=all.filter(f=>fixtureMatchesTab(f,"finished")&&kickoff(f)<=now&&kickoff(f)>=now-HOME_RECAP_WINDOW_MS).sort((a,b)=>kickoff(b)-kickoff(a));
  if(active.length)return {mode:"live" as const,fixtures:active,next};
  if(!liveFeedHealthy)return {mode:"unavailable" as const,fixtures:[],next};
  if(next.length&&kickoff(next[0])-now<=HOME_PREMATCH_WINDOW_MS)return {mode:"upcoming" as const,fixtures:next.slice(0,4),next};
  if(recent.length)return {mode:"recap" as const,fixtures:recent.slice(0,10),next};
  if(next.length)return {mode:"upcoming" as const,fixtures:next.slice(0,4),next};
  return {mode:"normal" as const,fixtures:[],next};
}

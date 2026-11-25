import * as React from "react";

// Keeping is a prompt preference, not a card claim or forfeiture.
// Weekly and recovery reminders share the same account/window identity.
const PREFIX="fa:weekly-common-kept:";
const EVENT="fa:weekly-common-keep-changed";
const keptInMemory=new Set<string>();
export function weeklyCommonKeepKey(userId:string,windowStart:string):string {
  return userId && /^\d{4}-\d{2}-\d{2}$/.test(windowStart)
    ? `${PREFIX}${encodeURIComponent(userId)}:${windowStart}` : "";
}
export function hasKeptWeeklyCommon(userId:string,windowStart:string):boolean {
  const key=weeklyCommonKeepKey(userId,windowStart);
  if(!key)return false;
  if(keptInMemory.has(key))return true;
  try{return window.localStorage.getItem(key)==="keep";}catch{return false;}
}
export function rememberKeptWeeklyCommon(userId:string,windowStart:string):void {
  const key=weeklyCommonKeepKey(userId,windowStart);
  if(!key)return;
  keptInMemory.add(key);
  try{window.localStorage.setItem(key,"keep");}catch{/* memory fallback */}
  if(typeof window!=="undefined")window.dispatchEvent(new Event(EVENT));
}
export function useWeeklyCommonKeepRevision():number {
  const [revision,setRevision]=React.useState(0);
  React.useEffect(()=>{
    const refresh=()=>setRevision(value=>value+1);
    const onStorage=(event:StorageEvent)=>{if(!event.key || event.key.startsWith(PREFIX))refresh();};
    window.addEventListener(EVENT,refresh);
    window.addEventListener("storage",onStorage);
    return()=>{window.removeEventListener(EVENT,refresh);window.removeEventListener("storage",onStorage);};
  },[]);
  return revision;
}

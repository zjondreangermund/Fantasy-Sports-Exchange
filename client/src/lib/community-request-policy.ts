export function communityRequestPolicy(open:boolean, mode:string, visible:boolean, connected:boolean) {
  const active=open&&mode==='community'&&visible;
  return {stream:active, pollMs:!visible?false:active?(connected?60_000:15_000):60_000} as const;
}

// One refresh per burst, rather than one fetch per reaction per connected member.
export function coalesceCommunityRefresh(refresh:()=>void, delay=400) {
  let timer:ReturnType<typeof setTimeout>|undefined;
  return {
    schedule(){if(timer!==undefined)return;timer=setTimeout(()=>{timer=undefined;refresh();},delay);},
    cancel(){if(timer!==undefined)clearTimeout(timer);timer=undefined;},
  };
}

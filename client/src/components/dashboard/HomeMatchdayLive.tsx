import type {ReactNode} from "react";
import {useQueries,useQuery} from "@tanstack/react-query";
import {Link} from "wouter";
import {useAuth} from "../../hooks/use-auth";
import {apiRequest} from "../../lib/queryClient";
import {fixtureClock,fixtureMatchesTab} from "../../../../shared/fixture-display";

const list=(v:any):any[]=>Array.isArray(v)?v:[];
const points=(v:any)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString(undefined,{maximumFractionDigits:4});
const fixtureId=(f:any)=>f?.intelligenceAvailable===false?0:Number(f?.apiFixtureId||0);
const href=(f:any)=>"/premier-league?nativeFull=1&matchCentre=live"+(fixtureId(f)>0?"&apiFixtureId="+fixtureId(f):"");

export default function HomeMatchdayLive({fallback=null}:{fallback?:ReactNode}){
  const {user}=useAuth();
  const live=useQuery<any>({
    queryKey:["api-football-fixtures","premier-league","live",""],
    queryFn:async()=> (await apiRequest("GET","/api/football/fixtures/premier-league?status=live&limit=20")).json(),
    staleTime:15_000,refetchInterval:30_000,refetchOnWindowFocus:true,
  });
  const fixtures=list(live.data?.fixtures).filter(f=>fixtureMatchesTab(f,"live"));
  const ids=[...new Set(fixtures.map(fixtureId).filter(id=>Number.isSafeInteger(id)&&id>0))];
  const personal=useQueries({queries:ids.map(id=>({
    queryKey:["personal-match-performance",String(user?.id||""),id],
    queryFn:async()=> (await apiRequest("GET",`/api/epl/match-centre/${id}/my-performance`)).json(),
    enabled:Boolean(user?.id),staleTime:20_000,refetchInterval:30_000,refetchOnWindowFocus:true,
  }))});
  const entries=new Map<number,any>();
  const matchPlayers=new Map<number,any[]>();
  personal.forEach((q,index)=>{
    if(!q.data)return;
    const matchId=ids[index];
    const facts=new Map<number,any>(list(q.data.matchPlayers).map(p=>[Number(p.apiPlayerId),p]));
    const related:any[]=[];
    for(const entry of list(q.data.entries)){
      const existing=entries.get(Number(entry.entryId));
      if(!existing||(Date.parse(entry.updatedAt||"")||0)>=(Date.parse(existing.updatedAt||"")||0))entries.set(Number(entry.entryId),entry);
      for(const player of list(entry.players)){
        const fact=facts.get(Number(player.apiPlayerId));
        if(fact)related.push({...player,fact,entry});
      }
    }
    matchPlayers.set(matchId,related);
  });
  const sorted=[...fixtures].sort((a,b)=>Number(Boolean(matchPlayers.get(fixtureId(b))?.length))-Number(Boolean(matchPlayers.get(fixtureId(a))?.length)));
  if(!fixtures.length)return <>{fallback}</>;
  return <section data-home-matchday-live className="mb-3 space-y-4 overflow-hidden rounded-3xl border border-red-400/25 bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,.15),transparent_55%),linear-gradient(135deg,#111527,#070b17)] p-3 text-white sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-red-300"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>Matchday live</p><h1 className="mt-2 text-2xl font-black sm:text-4xl">Every minute matters.</h1><p className="mt-1 text-xs text-slate-300">Your football. Your players. Your tournament.</p></div><span className="shrink-0 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-200">{fixtures.length} live</span></div>
    {live.data?.stale?<p className="text-xs text-slate-400">Match feed delayed. Showing last received scores.</p>:null}
    <div className="grid gap-2 md:grid-cols-2">{sorted.map(f=>{
      const related=(matchPlayers.get(fixtureId(f))||[]).map(row=>{const latest=entries.get(Number(row.entry.entryId));const current=list(latest?.players).find(p=>Number(p.cardId)===Number(row.cardId)&&Number(p.apiPlayerId)===Number(row.apiPlayerId));return {...row,contribution:current?.contribution??null,entry:latest||row.entry};});
      const players=[...new Map(related.map(p=>[p.apiPlayerId,p])).values()];
      return <article key={f.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <Link href={href(f)} className="block"><div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase"><span className="text-red-300">{fixtureClock(f)}</span><span className="text-slate-400">{f.round||"Premier League"}</span></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">{[f.homeTeam].map(t=><div key="home">{t?.logo?<img src={t.logo} className="mx-auto mb-1 h-9 w-9 object-contain" alt=""/>:null}<p className="text-xs font-bold">{t?.name}</p></div>)}<b className="rounded-lg bg-white/5 px-3 py-2 text-2xl tabular-nums">{f.homeTeam?.score??"–"} : {f.awayTeam?.score??"–"}</b><div>{f.awayTeam?.logo?<img src={f.awayTeam.logo} className="mx-auto mb-1 h-9 w-9 object-contain" alt=""/>:null}<p className="text-xs font-bold">{f.awayTeam?.name}</p></div></div></Link>
        {players.length?<div className="mt-3 border-t border-white/10 pt-3"><h3 className="mb-2 text-xs font-black text-cyan-200">My players in this match</h3>{players.map(p=><div key={p.apiPlayerId} className="mb-2 rounded-xl bg-white/5 p-2"><div className="flex items-center gap-2"><img src={`https://media.api-sports.io/football/players/${p.apiPlayerId}.png`} loading="lazy" alt="" className="h-10 w-10 object-contain"/><div className="min-w-0 flex-1"><b className="text-xs">{p.name||p.fact.name}</b><p className="text-[10px] text-slate-400">{p.fact.minutes??"—"} min · {p.fact.statistics?.goals?.total??"—"} goals · {p.fact.statistics?.goals?.assists??"—"} assists</p></div></div>{related.filter(row=>row.apiPlayerId===p.apiPlayerId).map(row=><div key={row.entry.entryId+":"+row.cardId} className="mt-1 flex justify-between gap-2 text-[10px]"><span>{row.entry.competitionName}{row.captain?" · Captain":""}</span><b className="text-cyan-200">{points(row.contribution)} GW pts</b></div>)}</div>)}</div>:null}
        <Link href={href(f)} className="mt-3 block rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-2 text-center text-xs font-bold text-cyan-100">Open live match centre →</Link>
      </article>;
    })}</div>
    <div><div className="flex justify-between gap-2"><h2 className="font-black">My live tournaments</h2><Link href="/competitions" className="text-xs font-bold text-cyan-200">Standings →</Link></div>
      {entries.size?<div className="mt-2 grid gap-2 sm:grid-cols-2">{[...entries.values()].map(e=><div key={e.entryId} className="rounded-xl border border-cyan-300/15 bg-cyan-400/[.05] p-3"><p className="text-xs font-bold">{e.competitionName}</p><p className="text-[10px] text-slate-400">GW{e.gameWeek} · Entry #{e.entryId}</p><div className="mt-2 flex items-center justify-between gap-2"><b className="text-xl">{e.rank>0?`#${e.rank} / ${e.entryCount}`:"Pending"}</b><b className="text-lg text-cyan-200">{points(e.totalScore)} pts</b></div><p className="mt-1 text-[10px] text-slate-400">{e.final&&e.complete?"Final verified":e.hasScoringSnapshot?"Leaderboard score · provisional":"Leaderboard score · awaiting scoring"}{e.updatedAt?" · "+new Date(e.updatedAt).toLocaleTimeString("en-NA",{timeZone:"Africa/Windhoek",hour:"2-digit",minute:"2-digit"}):""}</p></div>)}</div>:<p className="mt-2 text-xs text-slate-400">{personal.some(q=>q.isLoading)?"Loading your entries…":personal.some(q=>q.isError)||!ids.length?"Personal scores are not available yet.":"No submitted tournament entries for these fixtures."}</p>}
      {personal.some(q=>q.isError)&&entries.size>0?<p className="mt-2 text-xs text-slate-400">Some personal match data is unavailable.</p>:null}
      <p className="mt-2 text-[10px] text-slate-400">Gameweek points include captain bonus where applicable. No points are added from match ratings. Live match facts and saved leaderboard scores may refresh at different times.</p>
    </div>
  </section>;
}

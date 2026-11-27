import type {ReactNode} from "react";
import {useQueries,useQuery} from "@tanstack/react-query";
import {Link} from "wouter";
import {useAuth} from "../../hooks/use-auth";
import {apiRequest} from "../../lib/queryClient";
import {fixtureClock} from "../../../../shared/fixture-display";
import {homeApiFixtureId,selectHomeMatchday} from "../../../../shared/home-matchday";

const list=(v:any):any[]=>Array.isArray(v)?v:[];
const points=(v:any)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString(undefined,{maximumFractionDigits:4});
const fixtureId=homeApiFixtureId;
const href=(f:any,mode:string)=>"/premier-league?nativeFull=1&matchCentre="+(mode==="recap"?"finished":mode==="live"?"live":"upcoming")+(fixtureId(f)>0?"&apiFixtureId="+fixtureId(f):"");
const kickoffLabel=(f:any)=>{const date=new Date(f.kickoffTime);return Number.isFinite(date.getTime())?date.toLocaleString("en-NA",{timeZone:"Africa/Windhoek",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hour12:false}):"Kickoff TBC";};

export default function HomeMatchdayLive({fallback=null}:{fallback?:ReactNode}){
  const {user}=useAuth();
  const live=useQuery<any>({
    queryKey:["api-football-fixtures","premier-league","live",""],
    queryFn:async()=> (await apiRequest("GET","/api/football/fixtures/premier-league?status=live&limit=20")).json(),
    staleTime:15_000,refetchInterval:30_000,refetchOnWindowFocus:true,
  });
  // All three reads reuse the Premier League centre's existing provider cache.
  const finished=useQuery<any>({
    queryKey:["api-football-fixtures","premier-league","finished",""],
    queryFn:async()=> (await apiRequest("GET","/api/football/fixtures/premier-league?status=finished&limit=20")).json(),
    staleTime:30_000,refetchInterval:60_000,refetchOnWindowFocus:true,
  });
  const upcoming=useQuery<any>({
    queryKey:["api-football-fixtures","premier-league","upcoming",""],
    queryFn:async()=> (await apiRequest("GET","/api/football/fixtures/premier-league?status=upcoming&limit=20")).json(),
    staleTime:60_000,refetchInterval:60_000,refetchOnWindowFocus:true,
  });
  const now=Date.now();
  const liveFeedHealthy=Boolean(live.data)&&!live.isError&&!live.data?.stale;
  const selection=selectHomeMatchday(list(live.data?.fixtures),list(finished.data?.fixtures),list(upcoming.data?.fixtures),now,liveFeedHealthy);
  const {mode,fixtures}=selection;
  const isLive=mode==="live",isRecap=mode==="recap",isUpcoming=mode==="upcoming";
  const ids=isLive||isRecap?[...new Set(fixtures.map(fixtureId).filter(id=>Number.isSafeInteger(id)&&id>0))]:[];
  const delayed=live.isError||live.data?.stale||finished.isError||finished.data?.stale||upcoming.isError||upcoming.data?.stale;
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
  if(mode==="unavailable")return <section className="mb-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-white"><p className="text-sm font-bold">{live.isLoading?"Loading matchday…":"Matchday feed unavailable"}</p><p className="mt-1 text-xs text-slate-400">{live.isLoading?"Checking current Premier League fixture status.":"Live status could not be confirmed. Your club dashboard is still available."}</p><Link href="/premier-league" className="mt-2 block text-xs font-bold text-cyan-200">Premier League →</Link></section>;
  if(!fixtures.length)return <>{fallback}</>;
  return <section data-home-matchday-live data-matchday-mode={mode} className={`mb-3 space-y-4 overflow-hidden rounded-3xl border p-3 text-white sm:p-6 ${isLive?"border-red-400/25 bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,.15),transparent_55%),linear-gradient(135deg,#111527,#070b17)]":isRecap?"border-emerald-400/25 bg-gradient-to-br from-emerald-950/60 to-[#070b17]":"border-cyan-300/25 bg-gradient-to-br from-cyan-950/60 to-[#070b17]"}`}>
    <div className="flex items-start justify-between gap-3"><div><p className={`flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] ${isLive?"text-red-300":isRecap?"text-emerald-300":"text-cyan-200"}`}>{isLive?<span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>:null}{isLive?"Matchday live":isRecap?"Matchday recap":"Next up · Premier League"}</p><h1 className="mt-2 text-2xl font-black sm:text-4xl">{isLive?"Every minute matters.":isRecap?"The final whistle.":"Get matchday ready."}</h1><p className="mt-1 text-xs text-slate-300">{isLive?"Your football. Your players. Your tournament.":isRecap?"Recent results, your players and current tournament standings.":"Upcoming fixtures and your next tournament opportunity."}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${isLive?"bg-red-500/15 text-red-200":isRecap?"bg-emerald-400/10 text-emerald-200":"bg-cyan-400/10 text-cyan-200"}`}>{isLive?fixtures.length+" live":isRecap?fixtures.length+" finished":"Scheduled"}</span></div>
    {delayed?<p className="text-xs text-slate-400">Some fixture data is delayed or unavailable. Showing confirmed information last received.</p>:null}
    <div className="grid gap-2 md:grid-cols-2">{sorted.map(f=>{
      const related=(matchPlayers.get(fixtureId(f))||[]).map(row=>{const latest=entries.get(Number(row.entry.entryId));const current=list(latest?.players).find(p=>Number(p.cardId)===Number(row.cardId)&&Number(p.apiPlayerId)===Number(row.apiPlayerId));return {...row,contribution:current?.contribution??null,entry:latest||row.entry};});
      const players=[...new Map(related.map(p=>[p.apiPlayerId,p])).values()].sort((a,b)=>Math.max(...related.filter(row=>row.apiPlayerId===b.apiPlayerId).map(row=>row.contribution==null?-Infinity:Number(row.contribution)))-Math.max(...related.filter(row=>row.apiPlayerId===a.apiPlayerId).map(row=>row.contribution==null?-Infinity:Number(row.contribution))));
      return <article key={f.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <Link href={href(f,mode)} className="block"><div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase"><span className={isLive?"text-red-300":isRecap?"text-emerald-300":"text-cyan-200"}>{isUpcoming?kickoffLabel(f):isRecap?"Full time · "+kickoffLabel(f):String(f.status)==="HT"?"Half-time":fixtureClock(f)}</span><span className="text-slate-400">{f.round||"Premier League"}</span></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">{[f.homeTeam].map(t=><div key="home">{t?.logo?<img src={t.logo} className="mx-auto mb-1 h-9 w-9 object-contain" alt=""/>:null}<p className="text-xs font-bold">{t?.name}</p></div>)}<b className="rounded-lg bg-white/5 px-3 py-2 text-2xl tabular-nums">{isUpcoming?"vs":`${f.homeTeam?.score??"–"} : ${f.awayTeam?.score??"–"}`}</b><div>{f.awayTeam?.logo?<img src={f.awayTeam.logo} className="mx-auto mb-1 h-9 w-9 object-contain" alt=""/>:null}<p className="text-xs font-bold">{f.awayTeam?.name}</p></div></div></Link>
        {players.length?<div className="mt-3 border-t border-white/10 pt-3"><h3 className="mb-2 text-xs font-black text-cyan-200">My players in this match</h3>{players.map(p=><div key={p.apiPlayerId} className="mb-2 rounded-xl bg-white/5 p-2"><div className="flex items-center gap-2"><img src={`https://media.api-sports.io/football/players/${p.apiPlayerId}.png`} loading="lazy" alt="" className="h-10 w-10 object-contain"/><div className="min-w-0 flex-1"><b className="text-xs">{p.name||p.fact.name}</b><p className="text-[10px] text-slate-400">{p.fact.minutes??"—"} min · {p.fact.statistics?.goals?.total??"—"} goals · {p.fact.statistics?.goals?.assists??"—"} assists</p></div></div>{related.filter(row=>row.apiPlayerId===p.apiPlayerId).map(row=><div key={row.entry.entryId+":"+row.cardId} className="mt-1 flex justify-between gap-2 text-[10px]"><span>{row.entry.competitionName}{row.captain?" · Captain":""}</span><b className="text-cyan-200">{points(row.contribution)} GW pts</b></div>)}</div>)}</div>:null}
        <Link href={href(f,mode)} className="mt-3 block rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-2 text-center text-xs font-bold text-cyan-100">{isLive?"Open live match centre →":isRecap?"Full match report →":"View match details →"}</Link>
      </article>;
    })}</div>
    {isUpcoming?<div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-3"><p className="text-xs text-slate-300">Tournament entry deadlines are shown on the Play page and may differ from individual match kickoffs.</p><Link href="/competitions" className="mt-2 block rounded-xl bg-cyan-300 p-2 text-center text-sm font-black text-slate-950">View tournaments →</Link></div>:<div><div className="flex justify-between gap-2"><h2 className="font-black">{isRecap?"My tournament results & standings":"My live tournaments"}</h2><Link href="/competitions" className="text-xs font-bold text-cyan-200">Standings →</Link></div>
      {entries.size?<div className="mt-2 grid gap-2 sm:grid-cols-2">{[...entries.values()].map(e=><div key={e.entryId} className="rounded-xl border border-cyan-300/15 bg-cyan-400/[.05] p-3"><p className="text-xs font-bold">{e.competitionName}</p><p className="text-[10px] text-slate-400">GW{e.gameWeek} · Entry #{e.entryId}</p><div className="mt-2 flex items-center justify-between gap-2"><b className="text-xl">{e.rank>0?`#${e.rank} / ${e.entryCount}`:"Pending"}</b><b className="text-lg text-cyan-200">{points(e.totalScore)} pts</b></div><p className="mt-1 text-[10px] text-slate-400">{e.status==="completed"&&e.final&&e.complete?"Settled · final verified":e.final&&e.complete?"Final scoring · settlement pending":e.hasScoringSnapshot?"Leaderboard score · provisional":"Leaderboard score · awaiting scoring"}{e.updatedAt?" · "+new Date(e.updatedAt).toLocaleTimeString("en-NA",{timeZone:"Africa/Windhoek",hour:"2-digit",minute:"2-digit"}):""}</p></div>)}</div>:<p className="mt-2 text-xs text-slate-400">{personal.some(q=>q.isLoading)?"Loading your entries…":personal.some(q=>q.isError)||!ids.length?"Personal scores are not available yet.":"No submitted tournament entries for these fixtures."}</p>}
      {personal.some(q=>q.isError)&&entries.size>0?<p className="mt-2 text-xs text-slate-400">Some personal match data is unavailable.</p>:null}
      <p className="mt-2 text-[10px] text-slate-400">Gameweek points include captain bonus where applicable. Match facts and saved leaderboard scores may refresh at different times. {isRecap?"A completed match does not mean its tournament is settled.":""}</p>
    </div>}
    {isRecap&&selection.next.length?<div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs font-bold text-cyan-200">Next fixture</p><Link href={href(selection.next[0],"upcoming")} className="mt-1 block text-sm font-bold">{selection.next[0].homeTeam?.name} vs {selection.next[0].awayTeam?.name} →</Link><p className="mt-1 text-xs text-slate-400">{kickoffLabel(selection.next[0])} · Namibia time</p></div>:null}
  </section>;
}

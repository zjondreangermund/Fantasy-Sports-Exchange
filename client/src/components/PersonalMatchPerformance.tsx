import {useQuery} from "@tanstack/react-query";
import {useAuth} from "../hooks/use-auth";
import {apiRequest} from "../lib/queryClient";
import {Button} from "./ui/button";

const items=(value:any):any[]=>Array.isArray(value)?value:[];
const number=(value:any)=>value==null||value===""||!Number.isFinite(Number(value))?"—":Number(value).toLocaleString("en-NA",{maximumFractionDigits:4});
export default function PersonalMatchPerformance({data,onPlayer}:{data:any;onPlayer:(id:number)=>void}){
  const {user}=useAuth();
  const fixture=data?.fixture;
  // Never use an unverified FPL fixture number as an API-Football fixture ID.
  const fixtureId=fixture?.intelligenceAvailable===false?0:Number(fixture?.apiFixtureId||data?.rawFixture?.fixture?.id||0);
  const query=useQuery<any>({
    queryKey:["personal-match-performance",String(user?.id||""),fixtureId],
    enabled:Boolean(user&&fixtureId>0),
    queryFn:async()=> (await apiRequest("GET",`/api/epl/match-centre/${fixtureId}/my-performance`)).json(),
    staleTime:20_000,refetchInterval:30_000,refetchOnWindowFocus:true,
  });
  if(!user||!fixtureId)return null;
  const entries=items(query.data?.entries);
  const players=items(data?.players).flatMap(group=>items(group?.players).map(item=>({...item,team:group.team})));
  const byId=new Map<number,any>(players.map(item=>[Number(item?.player?.id),item]));
  const lineupIds=new Set<number>(items(data?.lineups).flatMap(lineup=>[...items(lineup.startXI),...items(lineup.substitutes)]).map(item=>Number(item?.player?.id)));
  const matchIds=new Set([...byId.keys(),...lineupIds]);
  const related=entries.flatMap(entry=>items(entry.players).filter(p=>matchIds.has(Number(p.apiPlayerId))).map(p=>({...p,entry})));
  const grouped=new Map<number,any[]>();
  for(const row of related){const id=Number(row.apiPlayerId);grouped.set(id,[...(grouped.get(id)||[]),row]);}
  return <section data-personal-match-performance className="space-y-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/[.045] p-3">
    <div><h4 className="font-black text-cyan-200">My players &amp; live tournament standings</h4><p className="text-xs text-muted-foreground">Only players in your submitted teams. Match statistics are separate from gameweek scoring. GW points include the saved captain bonus.</p></div>
    {query.isLoading?<p className="text-sm">Loading your entries…</p>:query.isError?<div className="text-sm text-muted-foreground">Personal performance is not available yet. <Button size="sm" variant="outline" onClick={()=>void query.refetch()}>Retry</Button></div>:!entries.length?<p className="text-sm text-muted-foreground">No submitted entries in this fixture's verified competition window.</p>:<>
      <div className="space-y-2">{entries.map(e=><div key={e.entryId} className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{e.competitionName}</b><span className="text-xs text-cyan-200">GW{e.gameWeek} · Entry #{e.entryId}</span></div><div className="mt-2 grid grid-cols-2 gap-2"><div><p className="text-xs text-muted-foreground">Gameweek points</p><b className="text-lg">{number(e.totalScore)}</b></div><div><p className="text-xs text-muted-foreground">Tournament rank</p><b className="text-lg">{e.rank>0?`#${e.rank} / ${e.entryCount}`:"Pending"}</b></div></div><p className="mt-1 text-[10px] text-muted-foreground">{e.final&&e.complete?"Final verified score":e.hasScoringSnapshot?"Leaderboard score · provisional":"Leaderboard score · awaiting scoring"}{e.updatedAt?" · Updated "+new Date(e.updatedAt).toLocaleTimeString("en-NA",{hour:"2-digit",minute:"2-digit"}):""}</p></div>)}</div>
      {[...grouped].map(([id,rows])=>{
        const p=byId.get(id),stats=p?.statistics?.[0]||{},games=stats.games||{};
        return <div key={id} className="rounded-xl border border-white/10 bg-black/25 p-3"><button type="button" onClick={()=>onPlayer(id)} className="flex w-full items-center gap-3 text-left"><img loading="lazy" src={p?.player?.photo||`https://media.api-sports.io/football/players/${id}.png`} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" onError={e=>{e.currentTarget.style.visibility="hidden";}}/><div className="min-w-0 flex-1"><p className="font-bold">{p?.player?.name||rows[0].name}</p><p className="text-xs text-muted-foreground">{p?.team?.name||"Confirmed match squad"} · Rating {games.rating??"—"}</p></div></button><div className="mt-2 grid grid-cols-3 gap-2 text-xs">{[["Minutes",games.minutes],["Goals",stats.goals?.total],["Assists",stats.goals?.assists],["Shots",stats.shots?.total],["Tackles",stats.tackles?.total],["Saves",stats.goals?.saves]].map(([label,value])=><div key={String(label)} className="rounded-lg bg-white/5 p-2"><p className="text-muted-foreground">{label}</p><b>{number(value)}</b></div>)}</div>{rows.map(row=><div key={row.entry.entryId+":"+row.cardId} className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-xs"><span>{row.entry.competitionName}{row.captain?" · Captain":""}{row.rarity?" · "+row.rarity:""}</span><b className="shrink-0 text-cyan-200">{number(row.contribution)} GW pts</b></div>)}</div>;
      })}
      {!related.length?<p className="text-xs text-muted-foreground">None of your submitted players appear in the available lineups or match statistics yet.</p>:null}
    </>}
  </section>;
}

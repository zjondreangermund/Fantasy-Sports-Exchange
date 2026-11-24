import * as React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '../lib/queryClient';
import type { CardProfileData } from './cards/CardProfileModal';
import CardPlayerImage from './CardPlayerImage';
import { useAuth } from '../hooks/use-auth';
import { COMMON_KEEP_SLOTS, commonKeepSlotAccepts, validateCommonKeepTeams } from '../../../shared/common-collection';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
type Card = {id:number;name:string;position:string;team:string;overall:number;level:number;xp:number;blocked:boolean;imageUrl?:string|null};
type Plan = {cap:number;excess:number;cards:Card[]};
export function CommonReplacementSelect({value,onChange}:{value:number;onChange:(id:number)=>void}) {
  const {data}=useQuery<Plan>({queryKey:['/api/common-collection'],staleTime:0});
  return <label className="block space-y-2 text-sm">Choose the Common card to sacrifice and replace
    <select aria-label="Common card to replace" value={value} onChange={e=>onChange(Number(e.target.value))} className="w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white">
      <option value={0}>Select a card…</option>
      {data?.cards.map(card=><option key={card.id} value={card.id} disabled={card.blocked}>{card.name} · {card.position} · Lv {card.level}{card.blocked?' (protected)':''}</option>)}
    </select><p className="text-xs text-white/60">Confirming permanently sacrifices this card. A random current Premier League Common of the same position replaces it, retaining level and XP. Player ratings and performance belong to the new player.</p>
  </label>;
}
function PlayerRow({card,assignment,disabled,onSelect}:{card:Card;assignment:string;disabled:boolean;onSelect:()=>void}) {
  const {data,isLoading}=useQuery<CardProfileData>({
    queryKey:['/api/cards/profile',card.id],
    queryFn:async()=>{const response=await fetch(`/api/cards/${card.id}/profile`,{credentials:'include'});if(!response.ok)throw new Error('Recent points unavailable');return response.json();},
    staleTime:60_000,
  });
  const matches=data?.source!=='card-fallback' ? [...(data?.last10 || [])].sort((a,b)=>
    (b.gameweek-a.gameweek) || String(b.kickoffTime||'').localeCompare(String(a.kickoffTime||''))).slice(0,3) : [];
  return <button type="button" data-common-player-row aria-pressed={Boolean(assignment)} disabled={disabled} onClick={onSelect}
    className={`flex w-full items-center gap-2 border-b px-2 py-2 text-left disabled:opacity-50 ${assignment?'border-emerald-300/20 bg-emerald-400/10':'border-white/10 hover:bg-white/5'}`}>
    <span data-common-card-portrait className="relative block h-12 w-10 shrink-0 overflow-hidden rounded-md"><CardPlayerImage card={{id:card.id,player:{name:card.name,imageUrl:card.imageUrl}} as any} alt={card.name} className="h-full w-full object-contain"/></span>
    <span className="min-w-0 flex-1">
      <strong className="block truncate text-sm">{card.name}</strong>
      <span className="block truncate text-[10px] text-white/55">{card.team} · {card.position} · Lv {card.level}{card.blocked?' · Protected':''}</span>
      <span className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-cyan-100/80">{matches.length?matches.map((match,index)=><span key={`${match.gameweek}-${index}`} title={`GW ${match.gameweek} vs ${match.opponent}`}>GW{match.gameweek}: <b>{Number(Number(match.points).toFixed(2))}</b></span>):<span>{isLoading?'Loading points…':'Recent points unavailable'}</span>}</span>
    </span>
    <span className={`shrink-0 text-right text-[10px] font-bold ${assignment?'text-emerald-200':'text-cyan-200'}`}>{assignment||'SELECT'}</span>
  </button>;
}
const emptyTeams = ():number[][] => [Array(5).fill(0),Array(5).fill(0)];
export default function CommonCollectionManager() {
  const {user}=useAuth();
  // Scope the role check to this account so a cached admin result cannot
  // suppress a regular user's mandatory reduction after switching accounts.
  const adminCheck=useQuery<{isAdmin:boolean}>({
    queryKey:['/api/admin/check',user?.id],
    enabled:Boolean(user),
    queryFn:async()=>{
      const response=await fetch('/api/admin/check',{credentials:'include'});
      if(!response.ok)throw new Error('Could not verify admin access');
      return response.json();
    },
    retry:false,
    staleTime:60_000,
  });
  const {data}=useQuery<Plan>({queryKey:['/api/common-collection'],enabled:Boolean(user),staleTime:0,refetchInterval:60_000});
  const [teams,setTeams]=React.useState<number[][]>(emptyTeams);
  const [activeTeam,setActiveTeam]=React.useState(0);
  const [activeSlot,setActiveSlot]=React.useState(0);
  const [search,setSearch]=React.useState('');
  const [confirmed,setConfirmed]=React.useState(false);
  const selected=teams.flat().filter(Boolean);
  const kept=data?.cards.filter(c=>selected.includes(c.id)) || [];
  const burned=data?.cards.filter(c=>!selected.includes(c.id)) || [];
  const teamError=validateCommonKeepTeams(kept,teams);
  const protectedMissing=burned.filter(card=>card.blocked);
  const ready=Boolean(data && !teamError && protectedMissing.length===0);
  const mutation=useMutation({mutationFn:async()=>{
    const response=await apiRequest('POST','/api/common-collection/sacrifice',{keepCardIds:selected,teamCardIds:teams});return response.json();
  },onSuccess:async()=>{setTeams(emptyTeams());setConfirmed(false);await Promise.all(['/api/common-collection','/api/user/cards','/api/rewards/daily-login'].map(key=>queryClient.invalidateQueries({queryKey:[key]})));}});
  // Nothing is preselected, including protected cards. Refetches never choose for the user.
  React.useEffect(()=>{setTeams(emptyTeams());setActiveTeam(0);setActiveSlot(0);setSearch('');setConfirmed(false);},[user?.id,Boolean(data?.excess)]);
  React.useEffect(()=>{setConfirmed(false);},[teams]);
  if(!user || adminCheck.isPending || adminCheck.data?.isAdmin === true || !data?.excess)return null;
  const activeId=teams[activeTeam][activeSlot];
  const activePosition=COMMON_KEEP_SLOTS[activeSlot];
  const candidates=data.cards.filter(card=>commonKeepSlotAccepts(activePosition,card.position)
    && `${card.name} ${card.team}`.toLowerCase().includes(search.toLowerCase()));
  const choose=(card:Card)=>{
    if(selected.includes(card.id)&&activeId!==card.id)return;
    const next=teams.map(team=>[...team]);
    next[activeTeam][activeSlot]=activeId===card.id?0:card.id;
    setTeams(next);
    if(next[activeTeam][activeSlot]) {
      const slots=[...Array(10).keys()];
      const current=activeTeam*5+activeSlot;
      const nextEmpty=[...slots.slice(current+1),...slots.slice(0,current)].find(index=>!next[Math.floor(index/5)][index%5]);
      if(nextEmpty!==undefined){setActiveTeam(Math.floor(nextEmpty/5));setActiveSlot(nextEmpty%5);setSearch('');}
    }
  };
  return <Dialog open onOpenChange={()=>{}}><DialogContent onEscapeKeyDown={event=>event.preventDefault()} onPointerDownOutside={event=>event.preventDefault()} onInteractOutside={event=>event.preventDefault()} data-common-reduction-dialog className="[&>button.absolute]:hidden z-[160] flex h-[92dvh] max-h-[92dvh] w-[min(96vw,900px)] max-w-4xl flex-col gap-2 overflow-hidden bg-slate-950 p-3 text-white">
    <DialogHeader className="shrink-0 pr-0"><DialogTitle>Choose two Common teams to keep</DialogTitle><DialogDescription className="text-xs">Start with empty teams. Choose GK, DEF, MID, FWD and an outfield Utility for each. Your other {data.excess} Common cards will be burned after confirmation.</DialogDescription></DialogHeader>
    <div data-common-selection-summary className="shrink-0 space-y-2">
      <div className="flex items-center gap-2">{[0,1].map(team=><button type="button" key={team} disabled={mutation.isPending} onClick={()=>{setActiveTeam(team);setActiveSlot(Math.max(0,teams[team].findIndex(id=>!id)));setSearch('');}} className={`flex-1 rounded-lg border p-2 text-xs font-bold ${activeTeam===team?'border-cyan-300 bg-cyan-300/15':'border-white/15'}`}>Team {team+1} · {teams[team].filter(Boolean).length}/5</button>)}<span className="text-xs">{selected.length}/10</span></div>
      <div className="grid grid-cols-5 gap-1">{COMMON_KEEP_SLOTS.map((slot,index)=>{const card=data.cards.find(card=>card.id===teams[activeTeam][index]);return <button type="button" key={slot} disabled={mutation.isPending} aria-pressed={activeSlot===index} onClick={()=>{setActiveSlot(index);setSearch('');}} className={`min-w-0 rounded-lg border p-1.5 text-left ${activeSlot===index?'border-cyan-300 bg-cyan-300/10':'border-white/15'}`}><span className="block text-[10px] font-black text-cyan-100">{slot==='UTILITY'?'UTIL':slot}</span><span className="mt-1 block truncate text-[10px]">{card?.name||'Select'}</span></button>;})}</div>
      <div className="flex gap-2"><input aria-label="Search Common players" placeholder={`Search ${activePosition==='UTILITY'?'outfield':activePosition} players…`} value={search} onChange={event=>setSearch(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs"/><button type="button" disabled={mutation.isPending||!selected.length} onClick={()=>{setTeams(emptyTeams());setActiveTeam(0);setActiveSlot(0);}} className="text-xs text-white/60 disabled:opacity-40">Clear all</button></div>
    </div>
    <div data-common-reduction-scroll className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
      <p className="text-xs text-cyan-100">Team {activeTeam+1}: choose {activePosition} · last 3 game scores</p>
      <div className="overflow-hidden rounded-xl border border-white/10">{candidates.map(card=>{const teamIndex=teams.findIndex(team=>team.includes(card.id));const slotIndex=teamIndex>=0?teams[teamIndex].indexOf(card.id):-1;return <PlayerRow key={card.id} card={card} assignment={teamIndex>=0?`T${teamIndex+1} ${COMMON_KEEP_SLOTS[slotIndex]==='UTILITY'?'UTIL':COMMON_KEEP_SLOTS[slotIndex]}`:''} disabled={mutation.isPending||(selected.includes(card.id)&&activeId!==card.id)} onSelect={()=>choose(card)}/>;})}</div>
      {!candidates.length&&<p className="text-xs text-amber-200">No matching players. Choose another slot or clear the search.</p>}
      {protectedMissing.length>0&&<p className="text-xs text-amber-200">Protected cards cannot be burned. Add them yourself to your teams: {protectedMissing.map(card=>card.name).join(', ')}.</p>}
      {teamError&&<p className="text-xs text-white/55">{teamError}</p>}
      {!teamError&&<div className="rounded-xl border border-amber-300/30 p-3 text-xs"><strong>To burn ({burned.length}):</strong> {burned.map(c=>c.name).join(', ')}</div>}
      <p className="text-[10px] text-white/45">The server checks positions, ten different owned cards and current Premier League eligibility. This saves your collection; enter tournaments separately. Other rarities are unaffected.</p>
    </div>
    <div className="shrink-0 space-y-2 border-t border-white/10 pt-2">
      <label className="flex gap-2 text-xs"><input type="checkbox" disabled={!ready||mutation.isPending} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Keep these two teams and permanently burn my other {data.excess} Common cards.</label>
      {mutation.isError&&<p role="alert" className="text-xs text-red-300">{String((mutation.error as Error).message)}</p>}
      <Button className="h-10 w-full text-sm" disabled={!ready||!confirmed||mutation.isPending} onClick={()=>mutation.mutate()}>{mutation.isPending?'Updating collection…':`Keep two teams & burn ${data.excess} others`}</Button>
    </div>
  </DialogContent></Dialog>;
}

import * as React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '../lib/queryClient';
import type { CardProfileData } from './cards/CardProfileModal';
import CardPlayerImage from './CardPlayerImage';
import { useAuth } from '../hooks/use-auth';
import { supportsTwoCommonTeams } from '../../../shared/common-collection';
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
function KeepCard({card,kept,disabled,onToggle}:{card:Card;kept:boolean;disabled:boolean;onToggle:()=>void}) {
  const {data,isLoading,isError}=useQuery<CardProfileData>({
    queryKey:['/api/cards/profile',card.id],
    queryFn:async()=>{const response=await fetch(`/api/cards/${card.id}/profile`,{credentials:'include'});if(!response.ok)throw new Error('Recent points unavailable');return response.json();},
    staleTime:60_000,
  });
  const matches=data?.source!=='card-fallback' ? [...(data?.last10 || [])].sort((a,b)=>
    (b.gameweek-a.gameweek) || String(b.kickoffTime||'').localeCompare(String(a.kickoffTime||''))).slice(0,5) : [];
  return <article className={`rounded-2xl border p-3 ${kept?'border-emerald-300 bg-emerald-400/10':'border-white/15 bg-white/[.03]'}`}>
    <button type="button" aria-pressed={kept} disabled={disabled} onClick={onToggle} className="flex w-full items-center gap-3 text-left disabled:opacity-60">
      <span data-common-card-portrait className="relative block h-20 w-16 shrink-0 overflow-hidden rounded-lg"><CardPlayerImage card={{id:card.id,player:{name:card.name,imageUrl:card.imageUrl}} as any} alt={card.name} className="h-full w-full object-contain"/></span>
      <span className="min-w-0 flex-1"><strong className="block">{card.name}</strong><span className="block text-xs text-white/60">{card.team} · {card.position} · COMMON · Lv {card.level}</span><span className={`mt-2 block text-xs font-bold ${kept?'text-emerald-200':'text-amber-200'}`}>{kept?'✓ KEEP':'Will be burned'}{card.blocked?' · Protected — must keep':''}</span></span>
    </button>
    <p className="mt-3 text-xs font-bold text-cyan-100">Previous game points</p>
    {matches.length ? <div className="mt-2 flex flex-wrap gap-2">{matches.map((match,index)=><div key={`${match.gameweek}-${index}`} className="rounded-lg bg-black/30 p-2 text-center text-xs"><span className="block text-[10px] text-white/55">GW {match.gameweek} · {match.opponent}</span><strong>{Number(Number(match.points).toFixed(4))} pts</strong></div>)}</div>
      : <p className="mt-1 text-xs text-white/50">{isLoading?'Loading previous games…':isError?'Points unavailable. Try again shortly.':'No verified recent game points available.'}</p>}
  </article>;
}
export default function CommonCollectionManager() {
  const {user}=useAuth();
  const {data}=useQuery<Plan>({queryKey:['/api/common-collection'],enabled:Boolean(user),staleTime:0,refetchInterval:60_000});
  const [selected,setSelected]=React.useState<number[]>([]);
  const [confirmed,setConfirmed]=React.useState(false);
  const kept=data?.cards.filter(c=>selected.includes(c.id)) || [];
  const burned=data?.cards.filter(c=>!selected.includes(c.id)) || [];
  const protectedKept=burned.every(card=>!card.blocked);
  const ready=Boolean(data && kept.length===data.cap && protectedKept && supportsTwoCommonTeams(kept));
  const mutation=useMutation({mutationFn:async()=>{
    const response=await apiRequest('POST','/api/common-collection/sacrifice',{keepCardIds:selected});return response.json();
  },onSuccess:async()=>{setSelected([]);setConfirmed(false);await Promise.all(['/api/common-collection','/api/user/cards','/api/rewards/daily-login'].map(key=>queryClient.invalidateQueries({queryKey:[key]})));}});
  React.useEffect(()=>{setSelected([]);setConfirmed(false);},[user?.id]);
  React.useEffect(()=>{setConfirmed(false);},[selected]);
  // Protected cards are always retained. Users explicitly choose all other keepers.
  React.useEffect(()=>{if(data)setSelected(old=>Array.from(new Set([...old.filter(id=>data.cards.some(c=>c.id===id)),...data.cards.filter(c=>c.blocked).map(c=>c.id)])));},[data]);
  if(!user || !data?.excess)return null;
  return <Dialog open onOpenChange={()=>{}}><DialogContent onEscapeKeyDown={event=>event.preventDefault()} onPointerDownOutside={event=>event.preventDefault()} onInteractOutside={event=>event.preventDefault()} data-common-reduction-dialog className="[&>button.absolute]:hidden z-[160] flex h-[92dvh] max-h-[92dvh] w-[min(96vw,900px)] max-w-4xl flex-col overflow-hidden bg-slate-950 text-white">
    <DialogHeader className="shrink-0 pr-0"><DialogTitle>Choose your best 10 Common cards to keep</DialogTitle><DialogDescription>Required for GW12: select 10 Common players to KEEP. Other rarities have no 10-card limit. The remaining {data.excess} cards will be permanently burned only after confirmation. Compare previous game points below. Keep 2 GK, 2 DEF, 2 MID, 2 FWD and 2 extra outfield players for two teams.</DialogDescription></DialogHeader>
    <div data-common-selection-summary className="shrink-0 rounded-xl bg-slate-900 p-3 text-sm font-bold">Keeping {kept.length}/10 · To burn {burned.length} · {['GK','DEF','MID','FWD'].map(p=>`${p}: ${kept.filter(c=>c.position===p).length}`).join(' · ')}</div>
    <div data-common-reduction-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
    <div className="grid items-start gap-3 sm:grid-cols-2">{data.cards.map(card=><KeepCard key={card.id} card={card} kept={selected.includes(card.id)} disabled={mutation.isPending||card.blocked||(!selected.includes(card.id)&&selected.length>=data.cap)} onToggle={()=>setSelected(old=>old.includes(card.id)?old.filter(id=>id!==card.id):[...old,card.id])}/>)}</div>
    <p className="text-xs text-white/60">Protected cards are automatically kept. The server verifies current Premier League eligibility and two-team structure before burning anything. Points are historical player performance, not a guarantee of future scores.</p>
    {!supportsTwoCommonTeams(kept)&&<p className="text-sm text-amber-200">Your kept players still need the positions for two complete teams.</p>}
    {kept.length===data.cap&&<div className="rounded-xl border border-amber-300/30 p-3 text-sm"><strong>Cards to burn ({burned.length}):</strong> {burned.map(c=>c.name).join(', ')}</div>}
    <label className="flex gap-2 text-sm"><input type="checkbox" disabled={!ready||mutation.isPending} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Keep my selected 10 and permanently burn the other {data.excess} Common cards.</label>
    {mutation.isError&&<p role="alert" className="text-red-300">{String((mutation.error as Error).message)}</p>}
    <Button disabled={!ready||!confirmed||mutation.isPending} onClick={()=>mutation.mutate()}>{mutation.isPending?'Updating collection…':`Keep selected 10 & burn ${data.excess} other cards`}</Button>

    </div>
  </DialogContent></Dialog>;
}

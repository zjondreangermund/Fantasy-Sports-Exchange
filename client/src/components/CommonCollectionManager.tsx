import * as React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '../lib/queryClient';
import { useAuth } from '../hooks/use-auth';
import { supportsTwoCommonTeams } from '../../../shared/common-collection';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
type Card = {id:number;name:string;position:string;team:string;overall:number;level:number;xp:number;blocked:boolean};
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
export default function CommonCollectionManager() {
  const {user}=useAuth();
  const {data}=useQuery<Plan>({queryKey:['/api/common-collection'],enabled:Boolean(user),staleTime:0,refetchInterval:60_000});
  const [selected,setSelected]=React.useState<number[]>([]);
  const [confirmed,setConfirmed]=React.useState(false);
  const [snoozed,setSnoozed]=React.useState(false);
  const kept=data?.cards.filter(c=>!selected.includes(c.id)) || [];
  const ready=Boolean(data && selected.length===data.excess && supportsTwoCommonTeams(kept));
  const mutation=useMutation({mutationFn:async()=>{
    const response=await apiRequest('POST','/api/common-collection/sacrifice',{cardIds:selected});return response.json();
  },onSuccess:async()=>{setSelected([]);setConfirmed(false);await Promise.all(['/api/common-collection','/api/user/cards','/api/rewards/daily-login'].map(key=>queryClient.invalidateQueries({queryKey:[key]})));}});
  React.useEffect(()=>{setSelected([]);setConfirmed(false);setSnoozed(false);},[user?.id]);
  React.useEffect(()=>{setConfirmed(false);},[selected]);
  const inCollection=typeof window!=='undefined' && window.location.pathname==='/collection';
  if(!user || !data?.excess || (snoozed&&!inCollection))return null;
  return <Dialog open onOpenChange={open=>{if(!open&&!mutation.isPending)setSnoozed(true);}}><DialogContent className="z-[160] max-h-[90dvh] overflow-y-auto bg-slate-950 text-white">
    <DialogHeader><DialogTitle>Keep your best 10 Common cards</DialogTitle><DialogDescription>Select {data.excess} cards to sacrifice. Keep 2 GK, 2 DEF, 2 MID, 2 FWD and 2 extra outfield players for two teams. No cards are removed until you confirm.</DialogDescription></DialogHeader>
    <div className="text-sm">Kept: {kept.length}/10 · {['GK','DEF','MID','FWD'].map(p=>`${p}: ${kept.filter(c=>c.position===p).length}`).join(' · ')}</div>
    <div className="grid max-h-72 gap-2 overflow-auto">{data.cards.map(card=><label key={card.id} className="flex gap-3 rounded-lg border border-white/15 p-3"><input type="checkbox" disabled={card.blocked||mutation.isPending} checked={selected.includes(card.id)} onChange={()=>setSelected(old=>old.includes(card.id)?old.filter(id=>id!==card.id):[...old,card.id])}/><span>{card.name} · {card.position} · {card.overall} OVR · Lv {card.level}{card.blocked?' · Protected':''}</span></label>)}</div>
    <p className="text-xs text-white/60">Protected cards cannot be sacrificed. The server also verifies current Premier League eligibility before allowing the reduction. This preserves your squad structure; injuries and match availability can change.</p>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I understand the selected cards will be permanently sacrificed.</label>
    {mutation.isError&&<p role="alert" className="text-red-300">{String((mutation.error as Error).message)}</p>}
    <Button disabled={!ready||!confirmed||mutation.isPending} onClick={()=>mutation.mutate()}>{mutation.isPending?'Sacrificing…':`Sacrifice ${selected.length} selected cards`}</Button>
    {!inCollection&&<Button variant="outline" disabled={mutation.isPending} onClick={()=>setSnoozed(true)}>Review later in Collection</Button>}
  </DialogContent></Dialog>;
}

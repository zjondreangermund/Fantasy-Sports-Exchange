import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Crown, RefreshCcw, X, Clock3 } from "lucide-react";
import { Button } from "../ui/button";
import { queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import type { PlayerCardWithPlayer } from "../../../../shared/schema";

type TeamEntry = Record<string, any>;
const required = ["GK","DEF","MID","FWD","UTILITY"];
const idsOf = (entry: TeamEntry): number[] => {
  const raw=entry.lineupCardIds ?? entry.lineup_card_ids;
  return Array.isArray(raw) ? raw.map(Number).filter((id: number)=>Number.isInteger(id)&&id>0) : [];
};
const position = (card: PlayerCardWithPlayer) => String(card.player?.position || (card as any).position || "").toUpperCase();
const label = (card: PlayerCardWithPlayer) => `${card.player?.name || "Player"} • ${String(card.rarity || "").toUpperCase()} • ${card.player?.team || "PL"}`;

export function EntryLineupEditor({ entry, competition, cards, allEntries, onClose }: {
  entry: TeamEntry; competition: any; cards: PlayerCardWithPlayer[]; allEntries: TeamEntry[]; onClose:()=>void;
}) {
  const { toast } = useToast();
  const initialIds = idsOf(entry);
  const [slots,setSlots] = useState<number[]>(initialIds.length===5?initialIds:[0,0,0,0,0]);
  const [captain,setCaptain]=useState(Number(entry.captainId ?? entry.captain_id || 0));
  const deadline = new Date(String(competition?.submissionClosesAt || competition?.fixtureWindowStart || ""));
  const cutoff = Number.isFinite(deadline.getTime()) ? deadline.getTime() : 0;
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(t);},[]);
  const canEdit=String(competition?.status || "").toLowerCase()==="open" && cutoff>now;
  const otherUsed=useMemo(()=>new Set(allEntries
    .filter(row => Number(row.competitionId ?? row.competition_id)===Number(competition.id) && Number(row.id)!==Number(entry.id))
    .flatMap(idsOf)),[allEntries,competition.id,entry.id]);
  const byId=useMemo(()=>new Map(cards.map(card=>[Number(card.id),card])),[cards]);
  const candidate=(idx:number)=>cards.filter(card=>{
    const id=Number(card.id),p=position(card),rarity=String(card.rarity || "").toLowerCase();
    const cTier=String(competition.tier || "").toLowerCase();
    const allowed=["common","rare","unique","epic","legendary"];
    if(allowed.indexOf(rarity)<0 || allowed.indexOf(rarity)>allowed.indexOf(cTier))return false;
    if(card.forSale || otherUsed.has(id))return false;
    const league=String(card.player?.league || "").toLowerCase().replace(/[^a-z]/g,"");
    if(league && !["premierleague","englishpremierleague","epl"].includes(league))return false;
    if(idx===4?!["DEF","MID","FWD"].includes(p):p!==required[idx])return false;
    const selectedElsewhere=slots.some((v,i)=>i!==idx&&v===id);
    if(selectedElsewhere)return false;
    const footballer=Number(card.playerId || card.player?.id);
    if(slots.some((v,i)=>i!==idx&&Number(byId.get(v)?.playerId || byId.get(v)?.player?.id)===footballer))return false;
    return true;
  });
  const valid=slots.length===5&&slots.every(x=>x>0)&&new Set(slots).size===5&&slots.includes(captain);
  const save=useMutation({
    mutationFn:async()=>{
      const response=await fetch(`/api/competitions/entries/${Number(entry.id)}/lineup`,{
        method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({cardIds:slots,captainId:captain}),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(String(data?.message || "Lineup was not updated"));
      return data;
    },
    onSuccess:()=>{
      queryClient.invalidateQueries({queryKey:["/api/competitions/my-entries"]});
      queryClient.invalidateQueries({queryKey:["/api/competitions/my-entries",String(entry.userId || "")]});
      queryClient.invalidateQueries({queryKey:["/api/competitions"]});
      queryClient.invalidateQueries({queryKey:["/api/lineup"]});
      toast({title:"Lineup updated",description:"Changes saved. No extra entry fee was charged."});
      onClose();
    },
    onError:(error:any)=>toast({title:"Could not update team",description:error?.message||"Try again.",variant:"destructive"}),
  });
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 px-3 py-6 text-white" role="dialog" aria-modal="true" aria-label="Edit tournament lineup">
    <section className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-cyan-400/40 bg-[#080b1b] shadow-[0_0_70px_rgba(124,58,237,.3)]">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-violet-900/40 to-cyan-900/30 p-4">
        <div><h2 className="text-xl font-black">Edit submitted team</h2><p className="mt-1 text-xs text-white/70">{competition.name} · GW{competition.gameWeek ?? competition.game_week}</p></div>
        <button onClick={onClose} aria-label="Close lineup editor" className="rounded-xl border border-white/20 p-2"><X className="h-5 w-5"/></button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-8">
        <p className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-100"><Clock3 className="mr-1 inline h-3.5 w-3.5"/> {canEdit ? `Editable until ${deadline.toLocaleString("en-NA",{timeZone:"Africa/Windhoek",dateStyle:"medium",timeStyle:"short"})} (Namibia)` : "The entry window is closed. Your team cannot be changed."}</p>
        <p className="text-xs leading-5 text-slate-400">Change any player or your captain before the first Premier League kickoff. No additional payment. Each card may only be used in one entry in the same tournament.</p>
        {required.map((slot,i)=><label key={slot} className="block space-y-1 rounded-xl border border-white/10 bg-white/[.04] p-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">{slot}{i===4?" (DEF / MID / FWD)":""}</span>
          <select disabled={!canEdit||save.isPending} value={slots[i] || ""} onChange={event=>{
            const next=[...slots];next[i]=Number(event.target.value)||0;setSlots(next);
            if(captain&&!next.includes(captain))setCaptain(0);
          }} className="w-full min-w-0 rounded-lg border border-white/15 bg-[#10182b] p-2 text-sm text-white">
            <option value="">Choose a player</option>
            {slots[i]>0&&byId.get(slots[i])?<option value={slots[i]}>{label(byId.get(slots[i])!)}</option>:null}
            {candidate(i).filter(card=>Number(card.id)!==slots[i]).map(card=><option key={card.id} value={Number(card.id)}>{label(card)}</option>)}
          </select>
        </label>)}
        <label className="block space-y-1 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3">
          <span className="inline-flex items-center gap-1 text-xs font-black text-yellow-200"><Crown className="h-4 w-4"/> Captain</span>
          <select disabled={!canEdit||save.isPending} value={captain || ""} onChange={e=>setCaptain(Number(e.target.value)||0)}
            className="w-full rounded-lg border border-white/15 bg-[#10182b] p-2 text-sm text-white">
            <option value="">Choose captain</option>{slots.filter(Boolean).map(id=><option key={id} value={id}>{byId.get(id)?.player?.name || "Card "+id}</option>)}
          </select>
        </label>
      </div>
      <footer className="flex justify-between gap-3 border-t border-white/10 bg-[#070b17] p-4">
        <Button type="button" variant="outline" onClick={onClose} className="border-white/20 text-white">Cancel</Button>
        <Button type="button" onClick={()=>save.mutate()} disabled={!canEdit||!valid||save.isPending} className="bg-gradient-to-r from-fuchsia-600 to-cyan-400 font-black text-white disabled:opacity-40"><RefreshCcw className="mr-2 h-4 w-4"/>{save.isPending?"Saving…":"Save changes"}</Button>
      </footer>
    </section>
  </div>;
}

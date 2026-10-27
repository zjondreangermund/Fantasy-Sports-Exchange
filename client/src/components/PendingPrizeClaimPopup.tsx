import * as React from "react";
import { shouldPromptPrizeMint } from "../../../shared/prize-notification-policy";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckCircle2, Crown, Gift, Medal, Sparkles, Trophy } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import CardPlayerImage from "./CardPlayerImage";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

/** Tournament prizes are not weekly gifts: present each WON card exactly once
 * per device until the manager chooses to mint or snooze it. No auto-minting.
 * This works equally in the browser, installed PWA and native Android shell.
 */
type Award = {entryId:number;competitionName:string;gameWeek:number;rank:number;kind:string;rarity?:string;status:string};
type TrophyData = {awards:Award[]};
type RevealedCard={id:number;rarity:string;playerName?:string;playerTeam?:string;replayed?:boolean};
const onceKey=(userId:string,entryId:number)=>`fa:won-prize-prompt:${userId}:${entryId}`;
const isSnoozed=(key:string)=>{try{return localStorage.getItem(key)==="later";}catch{return false;}};

export default function PendingPrizeClaimPopup() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [localDismissed,setLocalDismissed]=React.useState<number[]>([]);
  const [revealed,setRevealed]=React.useState<RevealedCard|null>(null);
  const [pendingChoice,setPendingChoice]=React.useState(false);
  const {data:onboarding}=useQuery<{completed:boolean}>({
    queryKey:["/api/onboarding/status"],enabled:Boolean(user),staleTime:30_000,
  });
  const {data:history}=useQuery<TrophyData>({
    queryKey:["/api/trophy-cabinet"],enabled:Boolean(user)&&onboarding?.completed===true,
    staleTime:0,refetchInterval:20_000,refetchOnWindowFocus:true,
    queryFn:async()=>{
      const r=await fetch("/api/trophy-cabinet",{credentials:"include"});
      if(!r.ok)return {awards:[]};
      return r.json();
    },
  });
  const {data:ownedCards=[]}=useQuery<any[]>({
    queryKey:["/api/user/cards"],enabled:Boolean(user)&&Boolean(revealed?.id),staleTime:0,
    queryFn:async()=>{const r=await fetch("/api/user/cards",{credentials:"include"});const data=r.ok?await r.json():[];return Array.isArray(data)?data:Array.isArray(data?.cards)?data.cards:[];},
  });
  const userId=String(user?.id||"");
  const award=(Array.isArray(history?.awards)?history.awards:[]).find(a=>{
    if(a.kind!=="card"||!shouldPromptPrizeMint(a)||!userId||localDismissed.includes(a.entryId))return false;
    return !isSnoozed(onceKey(userId,a.entryId));
  })||null;
  const dismiss=()=>{
    if(revealed){setRevealed(null);return;}
    if(!award)return;
    setLocalDismissed(prev=>prev.includes(award.entryId)?prev:[...prev,award.entryId]);
    try{localStorage.setItem(onceKey(userId,award.entryId),"later");}catch{}
  };
  const openPage=(path:string)=>{
    setRevealed(null);
    setPendingChoice(false);
    if(award){
      setLocalDismissed(prev=>prev.includes(award.entryId)?prev:[...prev,award.entryId]);
      try{localStorage.setItem(onceKey(userId,award.entryId),"later");}catch{}
    }
    navigate(path);
  };
  const mint=useMutation({
    mutationFn:async()=>{if(!award)throw new Error("No prize available");const r=await apiRequest("POST",`/api/competitions/prizes/${award.entryId}/claim`,{});return r.json();},
    onSuccess:async(result:any)=>{
      if(award)setLocalDismissed(prev=>[...prev,award.entryId]);
      if(result.pendingChoice)setPendingChoice(false);
      else if(result.card)setRevealed(result.card);
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/trophy-cabinet"]}),
        queryClient.invalidateQueries({queryKey:["/api/competitions/my-entries"]}),
        queryClient.invalidateQueries({queryKey:["/api/common-card-reward-choices"]}),
        queryClient.invalidateQueries({queryKey:["/api/user/cards"]}),
        queryClient.invalidateQueries({queryKey:["/api/notifications"]}),
      ]);
      toast({title:result.pendingChoice?"One more choice required":result.card?.replayed?"Original prize card revealed":"🏆 Tournament prize card minted!",
        description:result.pendingChoice?"Your Common collection is full. Choose whether to keep or replace one eligible card.":result.card?.playerName?result.card?.replayed?`${result.card.playerName} is your original prize. No extra card was minted.`:`${result.card.playerName} is now in your Collection.`:"Your tournament reward has been recorded."});
    },
    onError:(error:any)=>toast({title:"Mint unsuccessful",description:error?.message||"Your reward remains available in the Trophy Cabinet.",variant:"destructive"}),
  });
  const open=Boolean(user&&onboarding?.completed&&(award||revealed||pendingChoice));
  if(!open)return null;
  const card=ownedCards.find(c=>Number(c.id)===Number(revealed?.id));
  return <Dialog open={open} onOpenChange={next=>{if(!next){setPendingChoice(false);dismiss();}}}>
    <DialogContent data-pending-prize-popup className="z-[145] max-h-[90dvh] w-[min(95vw,480px)] overflow-y-auto border-fuchsia-400/35 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.25),transparent_60%),#060a1b] text-white shadow-[0_0_60px_rgba(168,85,247,.2)]">
      <DialogHeader className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-amber-200/40 bg-amber-300/15 shadow-[0_0_55px_rgba(250,204,21,.3)]"><Trophy className="h-10 w-10 text-amber-200"/></div>
        <p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-fuchsia-200">Fantasy Arena • Tournament Achievement</p>
        <DialogTitle className="text-center text-3xl font-black text-white">{revealed?(revealed.replayed?"🏆 Your original prize card":"🏆 Prize card minted!"):pendingChoice?"🏆 Prize won — card choice required":"🎉 Congratulations, Manager!"}</DialogTitle>
        <DialogDescription className="mt-2 text-center text-sm leading-6 text-white/65">
          {revealed?.replayed?"This is the same card originally awarded for this tournament. No additional card has been minted.":revealed?`Your ${revealed.rarity?.toUpperCase()||""} winning player card is now in your collection and the victory stays in your Trophy Cabinet.`:
            pendingChoice?"Your Common collection is full. The reward is safe. Make your keep-or-replace decision to complete minting.":
            `You finished #${award?.rank} in ${award?.competitionName} (GW${award?.gameWeek})! You have won a ${String(award?.rarity||"PRIZE").toUpperCase()} player card. Tap Mint to reveal your random Premier League player.`}
        </DialogDescription>
      </DialogHeader>
      {revealed?<div className="mx-auto w-full max-w-[270px] rounded-3xl border border-cyan-300/35 bg-gradient-to-b from-blue-600/25 to-black/70 p-4 text-center">
        {card?<div className="pointer-events-none relative h-56 overflow-hidden rounded-2xl border border-white/10"><CardPlayerImage card={card} className="h-full w-full object-contain" alt={revealed.playerName||"Winning card"}/></div>:<div className="grid h-44 place-items-center"><Sparkles className="h-16 w-16 text-cyan-200"/></div>}
        <p className="mt-3 text-2xl font-black">{revealed.playerName||"Winning card"}</p><p className="text-sm text-white/60">{revealed.playerTeam||""} · {revealed.rarity?.toUpperCase()}</p>
       </div>:
       <div className="mx-auto flex max-w-[270px] flex-col items-center justify-center rounded-3xl border border-amber-300/25 bg-gradient-to-b from-amber-400/10 via-fuchsia-400/10 to-blue-500/10 p-5 shadow-[inset_0_0_35px_rgba(232,121,249,.06)]">
        <Crown className="h-10 w-10 text-amber-200"/><div className="mt-2 text-xs font-black uppercase tracking-[.2em] text-amber-200">Podium place #{award?.rank||"—"}</div>
        <Gift className="my-5 h-20 w-20 text-cyan-200"/><div className="text-2xl font-black">{String(award?.rarity||"").toUpperCase()} CARD</div><div className="mt-2 text-xs text-white/45">Random eligible Premier League player</div>
       </div>}
      {revealed||pendingChoice?<Button type="button" onClick={()=>openPage("/trophy-cabinet")} className="h-12 w-full bg-gradient-to-r from-amber-400 to-cyan-400 font-black text-slate-950"><Medal className="mr-2 h-5 w-5"/>Open my Trophy Cabinet</Button>:
       <Button data-mint-tournament-prize type="button" disabled={mint.isPending} onClick={()=>mint.mutate()} className="h-12 w-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-base font-black text-white">
        <Sparkles className="mr-2 h-5 w-5"/>{mint.isPending?"Minting your winning card…":"Mint my winning card"}
       </Button>}
      {revealed?<Button type="button" onClick={()=>openPage("/collection")} variant="outline" className="h-11 w-full border-white/20 text-white"><CheckCircle2 className="mr-2 h-4 w-4"/>View minted card in Collection</Button>:null}
      {!revealed&&!pendingChoice?<button type="button" onClick={dismiss} className="min-h-11 text-sm font-medium text-white/55">Later — keep this prize in my Trophy Cabinet</button>:null}
      <p className="text-center text-[11px] text-white/40">Your reward is minted only when you confirm. One tournament prize can only be minted once.</p>
    </DialogContent>
  </Dialog>;
}

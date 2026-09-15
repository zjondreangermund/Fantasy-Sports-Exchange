import * as React from "react";
import { useMutation,useQuery } from "@tanstack/react-query";
import { Gift,Trophy } from "lucide-react";
import { apiRequest,queryClient } from "../lib/queryClient";
import { isNativeMobileApp } from "../lib/site-view";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "./ui/dialog";

function object(value:unknown):Record<string,any>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,any>:{};}
function id(value:unknown){const n=Number(value||0);return Number.isInteger(n)&&n>0?n:0;}

export default function PendingPrizeClaimPopup(){
  const { toast }=useToast();
  const [dismissed,setDismissed]=React.useState<Set<number>>(()=>new Set());
  const browserOnly=!isNativeMobileApp()&&!(typeof window!=="undefined"&&window.matchMedia?.("(display-mode: standalone)").matches);
  const {data:entries=[]}=useQuery<any[]>({queryKey:["/api/competitions/my-entries","pending-prize-popup"],enabled:browserOnly,staleTime:0,refetchInterval:15000,queryFn:async()=>{const response=await fetch("/api/competitions/my-entries",{credentials:"include"});if(!response.ok)return[];const body=await response.json();return Array.isArray(body)?body:[];}});
  const entry=entries.find(row=>{const entryId=id(row?.id);const award=object(object(row?.tiebreakMeta??row?.tiebreak_meta).settlement).prizeAward;return entryId&&!dismissed.has(entryId)&&Boolean(award?.claimPending)&&!id(row?.prizeCardId??row?.prize_card_id);})||null;
  const award=object(object(entry?.tiebreakMeta??entry?.tiebreak_meta).settlement).prizeAward;
  const claim=useMutation({mutationFn:async()=>{const response=await apiRequest("POST",`/api/competitions/prizes/${id(entry?.id)}/claim`,{});return response.json();},onSuccess:async(body:any)=>{setDismissed(current=>new Set(current).add(id(entry?.id)));await Promise.all([queryClient.invalidateQueries({queryKey:["/api/competitions/my-entries"]}),queryClient.invalidateQueries({queryKey:["/api/common-card-reward-choices"]}),queryClient.invalidateQueries({queryKey:["/api/user/cards"]}),queryClient.invalidateQueries({queryKey:["/api/notifications"]})]);toast({title:body?.pendingChoice?"One more choice required":"Prize card claimed!",description:body?.pendingChoice?"Your Common collection is full. Choose which card to keep or replace.":body?.card?.playerName?`${body.card.playerName} is now in your Collection.`:"Your prize is now in your Collection."});},onError:(error:any)=>toast({title:"Prize claim failed",description:error?.message||"Your prize remains safe. Please try again.",variant:"destructive"})});
  if(!browserOnly||!entry)return null;
  const entryId=id(entry.id);
  return <Dialog open onOpenChange={open=>{if(!open)setDismissed(current=>new Set(current).add(entryId));}}><DialogContent data-pending-prize-popup className="z-[125] max-w-md border-emerald-300/30 bg-[#07100e] text-white"><DialogHeader><div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-emerald-200/30 bg-emerald-300/15 shadow-[0_0_35px_rgba(52,211,153,.25)]"><Trophy className="h-8 w-8 text-emerald-200"/></div><DialogTitle className="pt-2 text-center text-2xl font-black">Congratulations — prize waiting!</DialogTitle><DialogDescription className="text-center leading-6 text-emerald-50/70">You finished #{Number(entry.rank||award.rank||0)} and won a {String(award.rarity||"prize").toUpperCase()} card. It has not been minted yet—claim it now so it can be added safely to your Collection.</DialogDescription></DialogHeader><Button onClick={()=>claim.mutate()} disabled={claim.isPending} className="h-12 bg-emerald-300 text-base font-black text-emerald-950 hover:bg-emerald-200"><Gift className="mr-2 h-5 w-5"/>{claim.isPending?"Claiming safely…":"Claim my prize card"}</Button><Button variant="ghost" onClick={()=>setDismissed(current=>new Set(current).add(entryId))} className="text-white/55">Not now — remind me next visit</Button></DialogContent></Dialog>;
}

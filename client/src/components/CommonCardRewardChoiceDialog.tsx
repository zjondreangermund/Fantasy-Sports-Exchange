import * as React from "react";
import { CommonReplacementSelect } from "./CommonCollectionManager";
import { useMutation,useQuery } from "@tanstack/react-query";
import { ShieldCheck,Sparkles } from "lucide-react";
import { apiRequest,queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";
import { Button } from "./ui/button";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "./ui/dialog";

type Choice={ id:number;competitionName:string;rank:number };
type Card={ id:number;playerName:string;team:string;position:string };
type Payload={ cap:number;choices:Choice[];cards:Card[] };

export default function CommonCardRewardChoiceDialog(){
  const { toast }=useToast();
  const {user}=useAuth();
  const [selected,setSelected]=React.useState<number>(0);
  const { data }=useQuery<Payload>({ queryKey:["/api/common-card-reward-choices"],enabled:Boolean(user),staleTime:0,refetchInterval:15000 });
  const choice=Array.isArray(data?.choices)?data!.choices[0]:null;
  const cards=Array.isArray(data?.cards)?data!.cards:[];
  const mutation=useMutation({
    mutationFn:async(input:{action:"keep"|"replace";replaceCardId?:number})=>{
      const response=await apiRequest("POST",`/api/common-card-reward-choices/${choice!.id}`,input);
      return response.json();
    },
    onSuccess:async(result:any)=>{
      setSelected(0);
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/common-card-reward-choices"]}),
        queryClient.invalidateQueries({queryKey:["/api/user/cards"]}),
        queryClient.invalidateQueries({queryKey:["/api/common-collection"]}),
        queryClient.invalidateQueries({queryKey:["/api/competitions/my-entries"]}),
        queryClient.invalidateQueries({queryKey:["/api/notifications"]}),
        queryClient.invalidateQueries({queryKey:["/api/trophy-cabinet"]}),
      ]);
      toast({title:result?.status==="replaced"?"Common card replaced":"Current collection kept",description:result?.card?.playerName?`${result.card.playerName} is now in your Collection.`:"No new card was minted."});
    },
    onError:(error:any)=>toast({title:"Choice not completed",description:error?.message || "Your collection was not changed. Please try again.",variant:"destructive"}),
  });
  React.useEffect(()=>{setSelected(0);},[choice?.id]);
  if(!choice||!user)return null;
  const validSelection=cards.some(card=>card.id===selected);
  return <Dialog open onOpenChange={()=>{}}><DialogContent className="z-[155] max-h-[92dvh] max-w-xl overflow-y-auto border-cyan-300/30 bg-[#070b16] text-white [&>button.absolute]:hidden" onEscapeKeyDown={e=>e.preventDefault()} onPointerDownOutside={e=>e.preventDefault()}>
    <DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl font-black"><Sparkles className="text-cyan-300"/>Common collection full</DialogTitle><DialogDescription className="leading-6 text-white/60">Congratulations on placing #{choice.rank} in {choice.competitionName}. You already have {data?.cap || 10} Common cards. No prize card has been minted yet.</DialogDescription></DialogHeader>
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-50"><ShieldCheck className="mr-2 inline h-4 w-4"/>Keep all your current cards, or select exactly one eligible Common card below to replace with one random non-duplicate Premier League Common of the same position, retaining its level and XP. Other rarities have no 10-card collection limit. Keeping your current cards declines this specific prize.</div>
    <CommonReplacementSelect key={choice.id} value={selected} onChange={setSelected} allowedIds={cards.map(card=>card.id)} disabled={mutation.isPending}/>
    {!cards.length?<p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">Your Common cards are currently locked, listed, or in live tournament teams. Keep the collection now, or return after those locks finish.</p>:null}
    <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" disabled={mutation.isPending} onClick={()=>mutation.mutate({action:"keep"})}>Keep my current cards</Button><Button disabled={!validSelection || mutation.isPending} onClick={()=>mutation.mutate({action:"replace",replaceCardId:selected})}>{mutation.isPending?"Updating safely…":"Replace selected card"}</Button></div>
  </DialogContent></Dialog>;
}

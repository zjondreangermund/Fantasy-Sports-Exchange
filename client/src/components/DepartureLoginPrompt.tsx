import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";

export default function DepartureLoginPrompt() {
  const { user } = useAuth();
  const [reviewed, setReviewed] = React.useState<string[]>([]);
  const [error, setError] = React.useState("");
  const {data} = useQuery<{claims:any[]}>({queryKey:["/api/player-replacements"],enabled:Boolean(user),staleTime:0,refetchInterval:30000});
  const claim = data?.claims?.find(c=>!c.replacementCardId && !c.claimedAt && c.decision!=="keep" && !reviewed.includes(`${user?.id}:${c.id}`));
  const dismiss=()=>{if(claim)setReviewed(list=>[...list,`${user?.id}:${claim.id}`]);setError("");};
  const action=useMutation({mutationFn:async(kind:"claim"|"keep")=>{
    const response=await apiRequest("POST",`/api/player-replacements/${claim.id}/${kind}`,{});return response.json();
  },onSuccess:async()=>{dismiss();await Promise.all(["/api/player-replacements","/api/user/cards","/api/notifications"].map(key=>queryClient.invalidateQueries({queryKey:[key]})));},onError:(e:any)=>setError(e.message || "Your claim remains available. Please try again.")});
  // Wait for other reward dialogs to finish so focus is never trapped behind a modal.
  const [otherModal,setOtherModal]=React.useState(false);
  React.useEffect(()=>{const scan=()=>setOtherModal(Boolean(document.querySelector('[role="dialog"]:not([data-departure-login])')));scan();const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[]);
  if(!user || !claim || otherModal)return null;
  const loan=claim.departureKind==="real_life_loan";
  return <Dialog open onOpenChange={open=>{if(!open&&!action.isPending)dismiss();}}><DialogContent data-departure-login onPointerDownOutside={e=>e.preventDefault()}><DialogHeader><DialogTitle>Premier League player departure</DialogTitle><DialogDescription>{claim.sourcePlayerName} has left the Premier League{loan?" on loan":""}. Review this card before entering another team.</DialogDescription></DialogHeader><p className="text-sm">Mint one current Premier League player of the same position and rarity. {loan?"You may instead keep the loaned-out card until the player returns. Replacing it is permanent.":"Your replacement remains available in Inbox, with automatic minting after the 14-day claim window."}</p>{claim.locked?<p className="text-sm">An existing tournament still holds this card. Its historical entry will be preserved.</p>:null}{error?<p role="alert" className="text-red-400">{error}</p>:null}<Button disabled={action.isPending} onClick={()=>action.mutate("claim")}>{action.isPending?"Updating…":"Mint replacement"}</Button>{loan?<Button disabled={action.isPending} variant="outline" onClick={()=>action.mutate("keep")}>Keep until return</Button>:null}<Button variant="ghost" disabled={action.isPending} onClick={dismiss}>Reviewed — remind me next login</Button></DialogContent></Dialog>;
}

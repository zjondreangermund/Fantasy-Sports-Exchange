import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Award, Crown, Gift, Medal, ShieldCheck, Sparkles, Trophy, Wallet, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";

type AwardRecord={
 entryId:number;competitionId:number;competitionName:string;gameWeek:number;
 rank:number;tier:string;points:number;competitionDate?:string;
 kind:"card"|"vault"|"cash";title:string;rarity?:string;status:string;
 cardId?:number|null;playerName?:string|null;playerTeam?:string|null;
 position?:string|null;imageUrl?:string|null;serialId?:string|null;
 value?:number;category?:string;awardId?:number;
};
type Data={awards:AwardRecord[];summary:{total:number;mintedCards:number;readyToMint:number;vaultAwards:number;cashAwards:number}};
const tone:Record<string,{border:string;background:string,accent:string}>={
 common:{border:"border-slate-300/30",background:"from-slate-300/20 to-slate-950",accent:"text-slate-100"},
 rare:{border:"border-blue-400/40",background:"from-blue-600/25 to-slate-950",accent:"text-cyan-200"},
 unique:{border:"border-fuchsia-400/40",background:"from-fuchsia-600/25 to-slate-950",accent:"text-fuchsia-200"},
 epic:{border:"border-red-400/40",background:"from-red-600/25 to-slate-950",accent:"text-red-200"},
 legendary:{border:"border-amber-400/40",background:"from-amber-500/25 to-slate-950",accent:"text-amber-200"},
};
const time=(value:string|undefined)=>{if(!value)return "";const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleDateString("en-NA",{timeZone:"Africa/Windhoek",year:"numeric",month:"short",day:"numeric"}):"";};
export default function TrophyCabinetPage(){
 const {toast}=useToast();
 const [filter,setFilter]=useState("all");
 const [revealed,setRevealed]=useState<{name:string;rarity:string}|null>(null);
 const {data,isLoading,isError}=useQuery<Data>({
  queryKey:["/api/trophy-cabinet"],staleTime:0,refetchInterval:30_000,
  queryFn:async()=>{const r=await fetch("/api/trophy-cabinet",{credentials:"include"});if(!r.ok)throw new Error("Could not load awards");return r.json();}
 });
 const mint=useMutation({
  mutationFn:async(entryId:number)=>{
   const r=await fetch(`/api/competitions/prizes/${entryId}/claim`,{method:"POST",credentials:"include"});
   const body=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(body?.message||"Your card could not be minted");
   return body;
  },
  onSuccess:(body:any)=>{
   void Promise.all([
     queryClient.invalidateQueries({queryKey:["/api/trophy-cabinet"]}),
     queryClient.invalidateQueries({queryKey:["/api/competitions/my-entries"]}),
     queryClient.invalidateQueries({queryKey:["/api/user/cards"]}),
     queryClient.invalidateQueries({queryKey:["/api/common-card-reward-choices"]}),
     queryClient.invalidateQueries({queryKey:["/api/notifications"]}),
   ]);
   if(body.pendingChoice)toast({title:"Common collection full",description:"Choose a card to keep or replace. Your prize is still recorded in the Trophy Cabinet."});
   else{
    setRevealed({name:String(body.card?.playerName||"Your reward"),rarity:String(body.card?.rarity||"Prize")});
    toast({title:"🏆 Tournament prize minted!",description:"Your winning player card is now in your Collection."});
   }
  },
  onError:(e:any)=>toast({title:"Mint failed",description:e?.message||"Your prize remains safe. Try again.",variant:"destructive"}),
 });
 const all=data?.awards||[];
 const display=all.filter(a=>filter==="all"||filter===a.kind||(filter==="pending"&&["ready_to_mint","pending_claim","pending"].includes(a.status)));
 const summary=data?.summary;
 return <div className="mx-auto min-h-full w-full max-w-6xl space-y-5 px-3 pb-20 pt-5 text-white sm:px-7" data-trophy-cabinet>
  <header className="overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.19),transparent_55%),linear-gradient(135deg,#1b1133,#050817)] p-5 text-center sm:p-9">
   <div className="flex items-center justify-between gap-2 text-left"><Link href="/account"><Button variant="ghost" className="text-white/65"><ArrowLeft className="mr-2 h-4 w-4"/>My Club</Button></Link><Badge className="bg-amber-300/15 text-amber-100">FANTASY ARENA ACHIEVEMENTS</Badge></div>
   <Trophy className="mx-auto mt-1 h-14 w-14 text-amber-300 drop-shadow-[0_0_25px_rgba(251,191,36,.7)]"/>
   <p className="mt-4 text-xs font-black uppercase tracking-[.26em] text-amber-200">Your permanent achievement record</p>
   <h1 className="mt-1 text-4xl font-black tracking-tight sm:text-6xl">Trophy Cabinet</h1>
   <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">Every confirmed Fantasy Arena tournament reward in one place. Mint winning cards, celebrate your podium finishes, and track Prize Vault and cash awards.</p>
   <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
    <div className="rounded-xl border border-white/10 bg-white/[.04] px-2 py-4"><div className="text-3xl font-black text-amber-200">{summary?.total||0}</div><div className="text-[10px] uppercase tracking-wide text-white/60">Awards</div></div>
    <div className="rounded-xl border border-white/10 bg-white/[.04] px-2 py-4"><div className="text-3xl font-black text-cyan-200">{summary?.mintedCards||0}</div><div className="text-[10px] uppercase tracking-wide text-white/60">Cards minted</div></div>
    <div className="rounded-xl border border-white/10 bg-white/[.04] px-2 py-4"><div className="text-3xl font-black text-fuchsia-200">{summary?.readyToMint||0}</div><div className="text-[10px] uppercase tracking-wide text-white/60">Ready to mint</div></div>
   </div>
  </header>
  {revealed?<section className="rounded-2xl border border-emerald-300/35 bg-emerald-400/10 p-5 text-center">
    <Sparkles className="mx-auto h-9 w-9 text-emerald-200"/>
    <h2 className="mt-2 text-xl font-black">Congratulations! Your card has been minted!</h2>
    <p className="mt-2 text-2xl font-bold text-emerald-200">{revealed.name} · {revealed.rarity.toUpperCase()}</p>
    <div className="mt-4 flex flex-wrap justify-center gap-2"><Link href="/collection"><Button className="bg-emerald-300 font-black text-slate-950 hover:bg-emerald-200">See minted card in Collection</Button></Link><Button variant="ghost" onClick={()=>setRevealed(null)} className="text-white">Continue browsing trophies</Button></div>
   </section>:null}
  <nav className="flex flex-wrap gap-2" aria-label="Filter your awards">{[["all","All awards"],["card","Player cards"],["vault","Prize Vault"],["cash","Cash"],["pending","Action required"]].map(([key,label])=><button key={key} type="button" onClick={()=>setFilter(key)} className={`min-h-10 rounded-full border px-3 text-xs font-bold ${filter===key?"border-cyan-300/60 bg-cyan-300/15 text-cyan-100":"border-white/15 bg-white/[.03] text-slate-400"}`}>{label}</button>)}</nav>
  {isLoading?<p className="py-16 text-center text-slate-300">Loading your trophy cabinet…</p>:isError?<p className="rounded-2xl border border-rose-400/30 p-7 text-center text-rose-200">Your trophy history couldn't be loaded. Please refresh.</p>:!display.length?<div className="rounded-2xl border border-dashed border-white/15 bg-white/[.03] p-10 text-center"><Medal className="mx-auto h-10 w-10 text-slate-400"/><h2 className="mt-3 text-xl font-black">No awards in this section yet</h2><p className="mt-2 text-sm text-slate-400">Compete in a tournament to earn your first trophy.</p><Link href="/competitions"><Button className="mt-5 bg-cyan-400 text-slate-950">Explore tournaments</Button></Link></div>:<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
  {display.map((award)=>{
   const theme=tone[String(award.rarity||award.tier).toLowerCase()]||tone.common;
   const pending=award.status==="ready_to_mint"||award.status==="pending_claim"||award.status==="pending";
   return <article key={`${award.kind}:${award.entryId}`} className={`min-w-0 overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-5 ${theme.border} ${theme.background}`}>
    <div className="flex items-start justify-between gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/40">{award.kind==="cash"?<Wallet className="h-6 w-6 text-emerald-200"/>:award.kind==="vault"?<Gift className="h-6 w-6 text-amber-200"/>:<Crown className="h-6 w-6 text-amber-200"/>}</div><span className={`rounded-xl border px-3 py-1 text-xs font-black ${pending?"border-amber-300/40 bg-amber-400/10 text-amber-100":"border-emerald-300/30 bg-emerald-300/10 text-emerald-100"}`}>{pending?"ACTION REQUIRED":award.status==="minted"?"MINTED":award.status==="credited"?"CREDITED":award.status.replaceAll("_"," ").toUpperCase()}</span></div>
    <div className="mt-4 text-[11px] font-black uppercase tracking-[.18em] text-cyan-200/80">Gameweek {award.gameWeek} · Rank #{award.rank||"—"}</div>
    <h2 className="mt-1 break-words text-lg font-black leading-tight">{award.competitionName}</h2>
    <div className="mt-3 border-t border-white/10 pt-4">
      <div className="text-xs font-black uppercase tracking-[.12em] text-white/45">Reward won</div>
      <h3 className={`mt-1 text-2xl font-black ${theme.accent}`}>{award.title}</h3>
      {award.kind==="card"&&award.playerName?<p className="mt-2 font-bold">{award.playerName} <span className="text-sm font-normal text-white/50">{award.playerTeam||""}</span></p>:null}
      {award.kind==="card"&&award.serialId?<p className="mt-1 font-mono text-[11px] text-white/40">Card serial: {award.serialId}</p>:null}
      {award.kind!=="card"&&Number(award.value)>0?<p className="mt-2 text-xl font-black text-amber-100">N${Number(award.value).toLocaleString("en-NA",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>:null}
      <p className="mt-2 text-xs text-white/40">{time(award.competitionDate)} · {Number(award.points).toFixed(4)} pts</p>
    </div>
    {award.kind==="card"&&award.status==="ready_to_mint"?<Button onClick={()=>mint.mutate(award.entryId)} disabled={mint.isPending} className="mt-5 h-12 w-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 font-black text-white"><Sparkles className="mr-2 h-4 w-4"/>{mint.isPending?"Minting your reward…":"Mint winning player card"}</Button>
      :award.kind==="card"?<Link href="/collection"><Button variant="outline" className="mt-5 h-11 w-full border-white/20 text-white"><CheckCircle2 className="mr-2 h-4 w-4"/>See your Collection</Button></Link>
      :award.kind==="vault"?<Link href="/my-entries"><Button className="mt-5 h-11 w-full bg-amber-300 font-black text-slate-950">View claim details</Button></Link>
      :<Link href="/wallet"><Button variant="outline" className="mt-5 h-11 w-full border-white/20 text-white">View wallet activity</Button></Link>}
   </article>;
  })}
  </section>}
  <p className="rounded-xl border border-white/10 bg-black/25 p-3 text-center text-xs text-slate-400"><ShieldCheck className="mr-1 inline h-4 w-4"/>Card minting is a deliberate action and can only award your existing confirmed tournament prize once. This trophy history is retained even if you later trade the player card.</p>
 </div>;
}

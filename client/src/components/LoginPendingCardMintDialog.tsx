import * as React from "react";
import { hasKeptWeeklyCommon, useWeeklyCommonKeepRevision } from "../lib/weekly-common-keep";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/use-auth";
import { shouldPromptPrizeMint, shouldPromptLadderCash } from "../../../shared/prize-notification-policy";
import InboxMintActionDialog, {
  type InboxMintNote, type WeeklyMintStatus, type MissedMintStatus,
} from "./InboxMintActionDialog";

// LOGIN_PENDING_MINT_POPUPS_V1
// Read the manager's existing server-backed mint entitlements on login.
// Do not create or resend notification rows, web pushes or Android alerts.
// Each eligible card is shown separately, only once per browser session;
// after Later or Mint it remains independently accessible from Inbox.
type PrizeAward = {entryId:number;kind:string;gameWeek:number;status:string;cardId?:number|null;recordedAward?:boolean;prizeLadder?:boolean;value?:number;popupAcknowledged?:boolean};
type TrophyData = {awards?:PrizeAward[]};
type PendingReplacement = {id:number;replacementCardId?:number|null;claimedAt?:string|null;decision?:string};
type ReplacementData = {claims?:PendingReplacement[]};
type Prompt = {token:string;note:InboxMintNote};
const promptKey = (userId:string,token:string)=>`fa:login-unminted-card:${userId}:${token}`;
const replacementReviewKey = (userId:string,id:number)=>`fa:login-replacement-reviewed:${userId}:${id}`;
const prizeReviewKey = (userId:string,id:number)=>`fa:won-prize-prompt:${userId}:${id}`;
const sessionReviewed=(key:string)=>{
  try{return window.sessionStorage.getItem(key)==="later";}
  catch{return false;}
};
const reviewSession=(key:string)=>{
  try{window.sessionStorage.setItem(key,"later");}catch{/* memory-only fallback */}
};
async function getExisting<T>(path:string):Promise<T>{
  const response=await apiRequest("GET",path);
  if(!response.ok)throw new Error("Could not load pending card rewards");
  return response.json() as Promise<T>;
}

export default function LoginPendingCardMintDialog() {
  const {user}=useAuth();
  const userId=String(user?.id || "");
  const keepRevision=useWeeklyCommonKeepRevision();
  const [location]=useLocation();
  const previousAuthenticatedId=React.useRef(userId);
  const [active,setActive]=React.useState<Prompt|null>(null);
  const [reviewedInMemory,setReviewedInMemory]=React.useState<string[]>([]);
  const [otherModalOpen,setOtherModalOpen]=React.useState(true);
  const [,refreshPrizeReview]=React.useReducer(n=>n+1,0);
  React.useEffect(()=>{window.addEventListener("fa-prize-popup-review",refreshPrizeReview);return()=>window.removeEventListener("fa-prize-popup-review",refreshPrizeReview);},[]);

  const {data:onboarding}=useQuery<{completed:boolean}>({
    queryKey:["/api/onboarding/status"],enabled:Boolean(userId),staleTime:30_000,
  });
  const ready=Boolean(userId && onboarding?.completed === true);
  const weeklyQuery=useQuery<WeeklyMintStatus>({
    queryKey:["/api/rewards/daily-login","login-pending",userId],enabled:ready,staleTime:0,
    queryFn:()=>getExisting<WeeklyMintStatus>("/api/rewards/daily-login"),
  });
  const recoveryQuery=useQuery<MissedMintStatus>({
    queryKey:["/api/rewards/november-recovery","login-pending",userId],enabled:ready,staleTime:0,
    queryFn:()=>getExisting<MissedMintStatus>("/api/rewards/november-recovery"),
  });
  const replacementQuery=useQuery<ReplacementData>({
    queryKey:["/api/player-replacements","login-pending",userId],enabled:ready,staleTime:15_000,
    queryFn:()=>getExisting<ReplacementData>("/api/player-replacements"),
  });
  const prizeQuery=useQuery<TrophyData>({
    queryKey:["/api/trophy-cabinet","login-pending",userId],enabled:ready,staleTime:15_000,
    queryFn:()=>getExisting<TrophyData>("/api/trophy-cabinet"),
  });

  // Respect the existing welcome / tournament prize / departure choice popup:
  // do not put another dialog on top of a dialog already visible.
  React.useEffect(()=>{
    const scan=()=>{
      const blocked=Boolean(document.querySelector('[role="dialog"]:not([data-inbox-mint-popup])'));
      setOtherModalOpen(previous=>previous===blocked?previous:blocked);
    };
    const observer=new MutationObserver(scan);
    observer.observe(document.body,{childList:true,subtree:true});
    const frame=window.requestAnimationFrame(scan);
    return()=>{window.cancelAnimationFrame(frame);observer.disconnect();};
  },[]);

  // Auto-prompts must not replace a card's deliberate, already-open Inbox popup.
  const explicitMint=typeof window!=="undefined" && (() => {
    const params=new URLSearchParams(window.location.search);
    // An Inbox tab is still a legitimate login landing page. Only a
    // deliberate per-notification mint popup should suppress auto reminders.
    return params.get("mint")==="1" || params.has("mintPrizeEntry");
  })();

  const prizePending=Array.isArray(prizeQuery.data?.awards)
    && prizeQuery.data!.awards!.some(award=>
      ((award.kind==="card" && shouldPromptPrizeMint(award)) || shouldPromptLadderCash(award))
      && !sessionReviewed(prizeReviewKey(userId,Number(award.entryId))));
  const departurePending=Array.isArray(replacementQuery.data?.claims)
    && replacementQuery.data!.claims!.some(claim=>
      !claim.replacementCardId && !claim.claimedAt && claim.decision!=="keep"
      && !sessionReviewed(replacementReviewKey(userId,Number(claim.id))));

  const pending=React.useMemo<Prompt[]>(()=>{
    if(!ready)return [];
    const eligible:Prompt[]=[];
    const seen=new Set<string>();
    // Older outage windows first, each selected independently. Never
    // substitute the current week's card for a different historical week.
    const pendingWindows=recoveryQuery.data?.pendingWindows;
    const missed=Array.isArray(pendingWindows)
      ? [...new Set(pendingWindows)].sort():[];
    for(const week of missed){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(week) || seen.has(week))continue;
      seen.add(week);
      eligible.push({token:`recovery:${week}`,note:{
        id:0,title:`Your missed Common card — ${week}`,
        dedupeKey:`card:weekly-ready:${week}`,message:"Ready to review and mint",
      }});
    }
    const current=String(weeklyQuery.data?.eligibleFrom || "");
    if(weeklyQuery.data?.canClaim
        && /^\d{4}-\d{2}-\d{2}$/.test(current) && !seen.has(current)){
      eligible.push({token:`weekly:${current}`,note:{
        id:0,title:`Your weekly Common card — ${current}`,
        dedupeKey:`card:weekly-ready:${current}`,message:"Ready to review and mint",
      }});
    }
    return eligible;
  },[ready,recoveryQuery.data?.pendingWindows,weeklyQuery.data?.eligibleFrom,
     weeklyQuery.data?.canClaim,weeklyQuery.data?.capReached]);

  React.useEffect(()=>{
    if(!ready || active || otherModalOpen || explicitMint || prizePending || departurePending)return;
    // Wait for all existing mint sources to settle so a delayed prize fetch
    // can't open a second popup behind a weekly Common claim.
    if(weeklyQuery.isPending || recoveryQuery.isPending || prizeQuery.isPending
      || replacementQuery.isPending)return;
    const next=pending.find(item=>!hasKeptWeeklyCommon(userId,item.token.split(":")[1])
      && !reviewedInMemory.includes(item.token)
      && !sessionReviewed(promptKey(userId,item.token)));
    if(next)setActive(next);
  },[ready,active,otherModalOpen,explicitMint,prizePending,departurePending,
     weeklyQuery.isPending,recoveryQuery.isPending,prizeQuery.isPending,
     replacementQuery.isPending,pending,reviewedInMemory,userId,location,keepRevision]);

  // A genuine logout followed by a new login should offer still-unminted
  // rewards again, even if the same browser tab remains open.
  React.useEffect(()=>{
    const oldId=previousAuthenticatedId.current;
    if(oldId && !userId){
      const prefixes=[
        `fa:login-unminted-card:${oldId}:`,
        `fa:login-replacement-reviewed:${oldId}:`,
        `fa:won-prize-prompt:${oldId}:`,
      ];
      try{
        for(let i=window.sessionStorage.length-1;i>=0;i--){
          const key=window.sessionStorage.key(i);
          if(key && prefixes.some(prefix=>key.startsWith(prefix)))
            window.sessionStorage.removeItem(key);
        }
      }catch{/* private mode: in-memory gate still applies */}
    }
    previousAuthenticatedId.current=userId;
    setActive(null);
    setReviewedInMemory([]);
  },[userId]);

  const close=()=>{
    if(!active)return;
    reviewSession(promptKey(userId,active.token));
    setReviewedInMemory(previous=>[...new Set([...previous,active.token])]);
    setActive(null);
  };

  if(!ready || !active || explicitMint || otherModalOpen)return null;
  return (
    <InboxMintActionDialog
      key={`login:${userId}:${active.token}`}
      note={active.note}
      weekly={weeklyQuery.data}
      recovery={recoveryQuery.data}
      onClose={close}
    />
  );
}

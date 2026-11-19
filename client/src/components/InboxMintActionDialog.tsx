import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Gift, Sparkles, ShieldCheck, CheckCircle2, Clock3 } from "lucide-react";
import { queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

// INBOX_PER_CARD_MINT_POPUP_V1
// A notification identifies an exact mint entitlement; it is never itself
// permission to mint. All claims are checked again by their existing server APIs.
export type InboxMintNote = {
  id: number;
  dedupeKey?: string | null;
  title: string;
  message?: string | null;
  replacementClaimId?: number | null;
  replacementCardId?: number | null;
  replacementDecision?: string | null;
  replacementRarity?: string | null;
  replacementSourcePlayerName?: string | null;
  replacementSourcePosition?: string | null;
  replacementDepartureKind?: string | null;
};

export type WeeklyMintStatus = {
  eligibleFrom?: string | null;
  canClaim?: boolean;
  claimedThisWeek?: boolean;
  capReached?: boolean;
  commonCount?: number;
  cap?: number;
};
export type MissedMintStatus = {
  pendingWindows?: string[];
  capReached?: boolean;
  commonCount?: number;
  cap?: number;
  claimDeadline?: string;
};
type ReplacementClaim = {
  id: number;
  sourcePlayerName?: string;
  sourcePosition?: string;
  rarity?: string;
  departureKind?: string | null;
  decision?: string | null;
  replacementCardId?: number | null;
  claimedAt?: string | null;
};
type ReplacementData = { claims?: ReplacementClaim[] };

const WEEK_KEY = /^card:weekly-(?:ready|expiring):(\d{4}-\d{2}-\d{2})$/;
const REPLACEMENT_KEY = /^replacement-(?:claim|reminder):(\d+)$/;
const NOVEMBER_NOTICE_KEY = "football-data:2026-11:missed-weekly-recovery:v1";

export function isInboxMintNotice(note: InboxMintNote): boolean {
  const key = String(note.dedupeKey || "");
  return WEEK_KEY.test(key) || key === NOVEMBER_NOTICE_KEY
    || (REPLACEMENT_KEY.test(key) && Number(note.replacementClaimId || 0) > 0);
}

function readWindow(note: InboxMintNote): string | null {
  return WEEK_KEY.exec(String(note.dedupeKey || ""))?.[1] || null;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "The card could not be minted; the claim remains available if eligible.";
}

async function postJson(url: string): Promise<any> {
  const response = await fetch(url, { method:"POST", credentials:"include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.message || "Unable to process this mint. Please retry."));
  return data;
}

export default function InboxMintActionDialog({
  note, weekly, recovery, onClose,
}: {
  note: InboxMintNote;
  weekly?: WeeklyMintStatus;
  recovery?: MissedMintStatus;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const key = String(note.dedupeKey || "");
  const requestedWeek = readWindow(note);
  const isReplacement = REPLACEMENT_KEY.test(key) && Number(note.replacementClaimId || 0) > 0;
  const summary = key === NOVEMBER_NOTICE_KEY;
  const [chosenWeek, setChosenWeek] = React.useState<string | null>(null);
  const [reveal, setReveal] = React.useState<{ name:string; cardId?:number; kept?:boolean } | null>(null);
  const [failure, setFailure] = React.useState("");
  const weeks = Array.isArray(recovery?.pendingWindows) ? recovery.pendingWindows : [];
  const matchingCurrentWeek = Boolean(requestedWeek && requestedWeek === weekly?.eligibleFrom);
  // Historical notifications are tied to THEIR OWN seven-day window. Never
  // use an old message to mint the currently eligible week's reward.
  const activeWeek = summary ? chosenWeek : requestedWeek;
  const isCurrent = Boolean(activeWeek && activeWeek === weekly?.eligibleFrom);
  const isRecoverable = Boolean(activeWeek && weeks.includes(activeWeek));
  const collectionFull = Boolean(recovery?.capReached || weekly?.capReached);
  const canMintCurrent = Boolean(isCurrent && weekly?.canClaim && !collectionFull);
  const canRecover = Boolean(isRecoverable && !collectionFull);

  const replacementQuery = useQuery<ReplacementData>({
    queryKey:["/api/player-replacements"],
    enabled:isReplacement,
    staleTime:0,
    queryFn:async()=>{
      const response=await fetch("/api/player-replacements",{credentials:"include"});
      if(!response.ok) throw new Error("Could not check this player's replacement entitlement.");
      return response.json();
    },
  });
  const replacement = (replacementQuery.data?.claims || []).find(claim =>
    Number(claim.id) === Number(note.replacementClaimId)) || null;
  const replacementFinished = Boolean(replacement?.replacementCardId || replacement?.claimedAt
    || replacement?.decision === "keep" || note.replacementCardId || note.replacementDecision === "keep");
  const validReplacement = Boolean(isReplacement && replacement && !replacementFinished);
  const loan = String(note.replacementDepartureKind || replacement?.departureKind || "") === "real_life_loan";

  const mint = useMutation({
    mutationFn:async()=>{
      if(isReplacement){
        if(!validReplacement)throw new Error("This specific player's replacement is no longer available.");
        return { mode:"replacement" as const,
          response:await postJson(`/api/player-replacements/${Number(note.replacementClaimId)}/claim`) };
      }
      if(!activeWeek)throw new Error("Select the weekly reward you want to mint.");
      if(canRecover){
        return {mode:"recovery" as const,response:await postJson(
          `/api/rewards/november-recovery/${encodeURIComponent(activeWeek)}/claim`)};
      }
      if(canMintCurrent){
        // The weekly API also verifies the current signup-anchored window, the
        // 20-card cap, current EPL membership, and the user's previous claims.
        return {mode:"weekly" as const,response:await postJson("/api/rewards/daily-login/claim")};
      }
      throw new Error("This notification's specific card was already claimed or is not currently eligible.");
    },
    onSuccess:async ({mode,response})=>{
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/user/cards"]}),
        queryClient.invalidateQueries({queryKey:["/api/notifications"]}),
        queryClient.invalidateQueries({queryKey:["/api/rewards/daily-login"]}),
        queryClient.invalidateQueries({queryKey:["/api/rewards/november-recovery"]}),
        queryClient.invalidateQueries({queryKey:["/api/player-replacements"]}),
        queryClient.invalidateQueries({queryKey:["/api/trophy-cabinet"]}),
      ]);
      const card = response?.card || {};
      const name=String(mode==="recovery"? response?.playerName :
        mode==="replacement" ? card?.playerName || card?.player?.name :
        card?.player?.name || "");
      if(!response?.claimed && !response?.alreadyClaimed && mode!=="replacement" && !card.id)
        throw new Error("The server did not confirm a card mint. Check your Collection.");
      setFailure("");
      setReveal({name:name || "Your eligible Premier League player",cardId:Number(card.id || response.cardId || 0)||undefined});
      toast({title:response?.alreadyClaimed?"Already minted":"Card mint completed",
        description:name ? `${name} is in your Collection.`:"Your Collection has been updated."});
    },
    onError:(error)=>setFailure(errorMessage(error)),
  });

  const keep = useMutation({
    mutationFn:async()=>{
      if(!loan || !validReplacement)throw new Error("Keep-until-return is unavailable for this claim.");
      return postJson(`/api/player-replacements/${Number(note.replacementClaimId)}/keep`);
    },
    onSuccess:async()=>{
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/notifications"]}),
        queryClient.invalidateQueries({queryKey:["/api/player-replacements"]}),
        queryClient.invalidateQueries({queryKey:["/api/user/cards"]}),
      ]);
      setFailure("");
      setReveal({name:String(replacement?.sourcePlayerName||note.replacementSourcePlayerName||"Original player"),kept:true});
    },
    onError:(error)=>setFailure(errorMessage(error)),
  });

  const active = isReplacement ? replacement : null;
  const player = String(active?.sourcePlayerName || note.replacementSourcePlayerName || "this player");
  const position = String(active?.sourcePosition || note.replacementSourcePosition || "same position").toUpperCase();
  const rarity = String(active?.rarity || note.replacementRarity || "same rarity").toUpperCase();
  const busy = mint.isPending || keep.isPending;
  const blocked = collectionFull && !isReplacement;
  let subtitle = isReplacement
    ? `Replace ${player} with one verified current Premier League player in the same ${position} position and ${rarity} rarity.`
    : summary ? "Select each eligible missed weekly reward individually. Each seven-day window can be claimed only once."
    : `This reminder refers ONLY to the weekly Common reward starting ${requestedWeek || "unknown"}.`;

  return (
    <Dialog open onOpenChange={(open)=>{if(!open && !busy)onClose();}}>
      <DialogContent data-inbox-mint-popup className="z-[155] max-h-[90dvh] w-[min(95vw,520px)] overflow-y-auto border-cyan-300/30 bg-[#070b16] text-white shadow-2xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge className="border border-cyan-300/30 bg-cyan-300/15 text-cyan-100">
              {isReplacement ? rarity+" replacement" : "Weekly Common"}
            </Badge>
            {!isReplacement && <Badge className="bg-white/10 text-white/70">
              {Number(weekly?.commonCount || recovery?.commonCount || 0)}/{Number(weekly?.cap || recovery?.cap || 20)} Common
            </Badge>}
          </div>
          <DialogTitle className="flex items-start gap-2 text-xl font-black">
            {reveal ? <CheckCircle2 className="h-6 w-6 text-emerald-300" /> :
             isReplacement ? <ShieldCheck className="h-6 w-6 text-cyan-300" /> :
             <Gift className="h-6 w-6 text-cyan-300" />}
            {reveal ? (reveal.kept ? "Original card retained" : "Your card is minted!") :
             isReplacement ? `Mint ${player}'s replacement` : "Mint your Common card"}
          </DialogTitle>
          <DialogDescription className="leading-6 text-white/60">{subtitle}</DialogDescription>
        </DialogHeader>

        {reveal ? (
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-5 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-emerald-200"/>
            <div className="text-xl font-black">{reveal.name}</div>
            <p className="mt-2 text-sm text-emerald-50/70">
              {reveal.kept?"Your original loaned-out player's card remains yours until return.":
               "The same reward cannot be minted a second time. You can view the card in your Collection."}
            </p>
            <Button className="mt-4" onClick={onClose}>Done</Button>
          </div>
        ) : isReplacement ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
              <p className="text-xs uppercase tracking-widest text-white/45">Original player</p>
              <p className="mt-1 text-lg font-black">{player}</p>
              <p className="mt-1 text-sm text-white/70">{position} · {rarity}</p>
            </div>
            {replacementQuery.isFetching && <p className="text-sm text-white/60">Checking the player's claim...</p>}
            {replacementFinished ? <p className="text-sm text-amber-100">This card has already been replaced or kept. No second mint will be issued.</p> :
             replacementQuery.isError ? <p className="text-sm text-red-200">{errorMessage(replacementQuery.error)}</p> :
             !replacement && !replacementQuery.isFetching ? <p className="text-sm text-amber-100">This replacement is no longer pending.</p> : null}
            <Button className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={busy || !validReplacement || replacementQuery.isFetching}
              onClick={()=>mint.mutate()}>{busy?"Processing...":`Mint ${rarity} ${position} replacement`}</Button>
            {loan && <Button variant="outline" className="w-full" disabled={busy||!validReplacement||replacementQuery.isFetching}
              onClick={()=>keep.mutate()}>Keep original card until player returns</Button>}
          </div>
        ) : (
          <div className="space-y-3">
            {summary && !chosenWeek ? (
              weeks.length ? weeks.map(week=>(
                <Button key={week} variant="outline" className="w-full justify-between" onClick={()=>setChosenWeek(week)}>
                  <span>Weekly Common: {week}</span><Sparkles className="h-4 w-4"/>
                </Button>
              )) : <p className="text-sm text-white/60">There are no eligible unclaimed missed weeks on your account.</p>
            ) : (
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[.06] p-5 text-center">
                <Sparkles className="mx-auto mb-3 h-10 w-10 text-cyan-200"/>
                <div className="text-lg font-black">Random Premier League Common</div>
                <p className="mt-2 text-sm text-white/60">
                  Reward window: {activeWeek || "Not available"}
                </p>
                <p className="mt-2 text-xs text-white/55">
                  {canMintCurrent ? "This is your current, unclaimed weekly card." :
                   isRecoverable ? "This missed reward is eligible for the November interruption recovery." :
                   matchingCurrentWeek && weekly?.claimedThisWeek ? "You have already claimed this week's card." :
                   "This specific reward window is already claimed, expired without recovery eligibility, or not currently available."}
                </p>
                {blocked && <p className="mt-3 text-sm text-amber-200">Your Common collection is full (20-card cap). Make room before minting. No claim has been lost.</p>}
                <Button data-inbox-mint-confirm className="mt-4 w-full bg-cyan-300 font-bold text-slate-950 hover:bg-cyan-200"
                  disabled={busy || (!canMintCurrent && !canRecover)}
                  onClick={()=>mint.mutate()}>
                  {busy?"Minting...":"Mint Random Common Card"}
                </Button>
                {summary && chosenWeek && <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={()=>setChosenWeek(null)}>Choose another missed week</Button>}
              </div>
            )}
          </div>
        )}
        {failure && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{failure}</p>}
        {!reveal && <Button variant="ghost" className="w-full text-white/65" disabled={busy} onClick={onClose}>
          <Clock3 className="mr-2 h-4 w-4"/>Later — keep in Inbox
        </Button>}
        {!reveal && <p className="text-center text-[11px] text-white/45">
          Opening a reminder does not mint a card. The server verifies your specific entitlement when you confirm.
        </p>}
      </DialogContent>
    </Dialog>
  );
}

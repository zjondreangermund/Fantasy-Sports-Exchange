import { CommonReplacementSelect } from "./CommonCollectionManager";
import * as React from "react";
import { hasKeptWeeklyCommon, rememberKeptWeeklyCommon, useWeeklyCommonKeepRevision } from "../lib/weekly-common-keep";
import { useMutation, useQuery } from "@tanstack/react-query";
import { shouldPromptPrizeMint, shouldPromptLadderCash } from "../../../shared/prize-notification-policy";
import { Gift, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import CardPlayerImage from "./CardPlayerImage";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

type WeeklyRewardCard = {
  id: number;
  rarity: string;
  serialId?: string | null;
  serialNumber?: number | null;
  maxSupply?: number | null;
  player?: {
    id: number;
    name: string;
    team: string;
    position: string;
    overall?: number;
    imageUrl?: string | null;
  } | null;
};

type WeeklyRewardStatus = {
  claimed?: boolean;
  alreadyClaimed?: boolean;
  cap: number;
  commonCount: number;
  remaining: number;
  canClaim: boolean;
  capReached: boolean;
  rewardDay: string;
  claimedThisWeek?: boolean;
  eligibleFrom?: string | null;
  expiresAt?: string | null;
  card?: WeeklyRewardCard | null;
};

const WEEKLY_REWARD_KEY = ["/api/rewards/daily-login"] as const;

function expiryLabel(value?: string | null) {
  if (!value) return "before this weekly window closes";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "before this weekly window closes";
  return date.toLocaleString("en-NA", {
    timeZone: "Africa/Windhoek",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function WeeklyCommonMintDialog() {
  const { user, isLoading: authLoading } = useAuth();
  useWeeklyCommonKeepRevision();
  const { toast } = useToast();
  const [replaceCardId, setReplaceCardId] = React.useState(0);
  const [revealedCard, setRevealedCard] = React.useState<WeeklyRewardCard | null>(null);
  const [dismissedPromptKey, setDismissedPromptKey] = React.useState("");

  const { data: onboarding, isLoading: onboardingLoading } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/onboarding/status"],
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const rewardQuery = useQuery<WeeklyRewardStatus>({
    queryKey: WEEKLY_REWARD_KEY,
    enabled: Boolean(user) && onboarding?.completed === true,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  // Tournament wins take priority over the weekly gift. Only ONE mint modal
  // is shown at a time. Once a manager mints or postpones the tournament card,
  // their weekly Common prompt can display normally.
  const [,refreshPrizeReview]=React.useReducer(n=>n+1,0);
  React.useEffect(()=>{window.addEventListener("fa-prize-popup-review",refreshPrizeReview);return()=>window.removeEventListener("fa-prize-popup-review",refreshPrizeReview);},[]);
  const { data: trophies } = useQuery<{awards:Array<{entryId:number;kind:string;status:string;gameWeek?:number;cardId?:number|null;recordedAward?:boolean;prizeLadder?:boolean;value?:number;popupAcknowledged?:boolean}>}>({
    queryKey:["/api/trophy-cabinet","login-pending",String(user?.id||"")],
    enabled:Boolean(user)&&onboarding?.completed===true,
    staleTime:0,
    refetchInterval:20_000,
    queryFn:async()=>{
      const r=await apiRequest("GET","/api/trophy-cabinet");
      return r.json();
    },
  });
  const tournamentPromptActive=Boolean((trophies?.awards||[]).some(a=>{
    if(!(a.kind==="card"&&shouldPromptPrizeMint(a))&&!shouldPromptLadderCash(a))return false;
    try{return sessionStorage.getItem(`fa:won-prize-prompt:${user?.id}:${a.entryId}`)!=="later";}
    catch{return true;}
  }));

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rewards/daily-login/claim", {replaceCardId: rewardQuery.data?.capReached ? replaceCardId : undefined});
      return response.json() as Promise<WeeklyRewardStatus>;
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(WEEKLY_REWARD_KEY, result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/common-collection"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/rewards/daily-login"] }),
      ]);

      if (result.card?.player) {
        setRevealedCard(result.card);
        toast({
          title: result.alreadyClaimed ? "Weekly Common already minted" : "Weekly Common card minted",
          description: `${result.card.player.name} has been added to your Collection.`,
        });
        return;
      }

      toast({
        title: result.capReached ? "Common collection full" : "Weekly card not available",
        description: result.capReached
          ? `You already have the maximum of ${result.cap || 10} Common cards.`
          : "This weekly Common card could not be minted. Please try again.",
        variant: result.capReached ? "default" : "destructive",
      });
    },
    onError: (error: any) => toast({
      title: "Weekly Common mint failed",
      description: error?.message || "Your card was not minted. Please try again.",
      variant: "destructive",
    }),
  });

  React.useEffect(()=>{setReplaceCardId(0);},[user?.id,rewardQuery.data?.eligibleFrom]);

  if (authLoading || onboardingLoading || !user || onboarding?.completed !== true) return null;

  const status = rewardQuery.data;
  // WEEKLY_MINT_POPUP_SNOOZE_V1: show an unclaimed weekly reward only once
  // per claim window on this device. A manager can return and mint later.
  // Refetching every minute, switching tabs or restarting must NOT force the
  // popup open again after "Later". The reward and Inbox reminder remain.
  const windowId = String(status?.eligibleFrom || status?.rewardDay || "");
  const promptKey = user?.id && windowId ? `fantasy-arena:weekly-mint-prompt:${user.id}:${windowId}` : "";
  let previouslyDismissed = dismissedPromptKey === promptKey && Boolean(promptKey);
  if (!previouslyDismissed && promptKey && typeof window !== "undefined") {
    try { previouslyDismissed = window.localStorage.getItem(promptKey) === "later"; } catch { /* memory-only fallback */ }
  }
  // The Inbox now has its own targeted mint dialog. Avoid stacking the
  // auto-popup behind an explicitly opened notification/card claim.
  const inboxOpen = typeof window !== "undefined" &&
    window.location.pathname === "/account" &&
    new URLSearchParams(window.location.search).get("tab") === "inbox";
  const waitingToMint = Boolean(!hasKeptWeeklyCommon(String(user?.id||""),windowId) && status?.canClaim && status.commonCount <= status.cap && !previouslyDismissed && !tournamentPromptActive && !inboxOpen);
  const open = waitingToMint || Boolean(revealedCard);
  const dismissPrompt = () => {
    if (revealedCard) { setRevealedCard(null); return; }
    if (!promptKey) return;
    setReplaceCardId(0);
    setDismissedPromptKey(promptKey);
    try { window.localStorage.setItem(promptKey, "later"); } catch { /* memory-only fallback */ }
  };
  if (!open) return null;

  const card = revealedCard;
  const player = card?.player;
  const cap = Math.max(1, Number(status?.cap || 10));
  const count = Math.max(0, Number(status?.commonCount || 0));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !claimMutation.isPending) dismissPrompt(); }}>
      <DialogContent
        data-weekly-common-mint-dialog
        className="z-[125] max-h-[92dvh] max-w-lg overflow-y-auto border-cyan-300/30 bg-[#070b16] text-white shadow-2xl"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border border-cyan-300/30 bg-cyan-300/15 text-cyan-100">Weekly Common</Badge>
            <Badge className="border border-white/10 bg-white/[.06] text-white/70">{count}/{cap} Common cards</Badge>
          </div>
          <DialogTitle className="flex items-start gap-3 text-2xl font-black">
            <Gift className="mt-0.5 h-7 w-7 shrink-0 text-cyan-300" />
            {player ? "Your Common card is minted" : status?.capReached ? "Replace a Common with your weekly card?" : "Your weekly card is ready"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-white/60">
            {player
              ? `${player.name} has been added to your Fantasy Arena Collection.`
              : `Mint one random Premier League Common card now. This reward expires ${expiryLabel(status?.expiresAt)} and does not carry over if you miss the window.`}
          </DialogDescription>
        </DialogHeader>

        {player && card ? (
          <div className="overflow-hidden rounded-[1.75rem] border border-cyan-300/25 bg-gradient-to-b from-cyan-300/10 to-black/30 p-4">
            <div className="mx-auto flex max-w-[280px] flex-col items-center text-center">
              <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/35">
                <CardPlayerImage card={card as any} alt={player.name} className="h-full w-full object-contain object-top" />
              </div>
              <div className="mt-4 text-2xl font-black text-white">{player.name}</div>
              <div className="mt-1 text-sm font-bold text-cyan-100/75">{player.position} · {player.team}</div>
              <Badge className="mt-3 border border-slate-200/15 bg-slate-100/10 text-slate-100">COMMON</Badge>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-400/[.06] p-6">
            <div className="mx-auto flex h-64 max-w-[240px] flex-col items-center justify-center rounded-2xl border border-cyan-200/25 bg-gradient-to-br from-slate-900 via-cyan-950/70 to-slate-950 shadow-[0_0_50px_rgba(34,211,238,.12)]">
              <Sparkles className="h-12 w-12 text-cyan-300" />
              <div className="mt-4 text-center text-xs font-black uppercase tracking-[.22em] text-cyan-100/75">Fantasy Arena</div>
              <div className="mt-2 text-center text-2xl font-black">Random Common</div>
              <div className="mt-2 text-center text-xs text-white/45">Premier League player</div>
            </div>
          </div>
        )}

        {!player && status?.capReached && <><Button type="button" variant="outline" className="w-full" disabled={claimMutation.isPending} onClick={()=>{rememberKeptWeeklyCommon(String(user?.id||""),windowId);dismissPrompt();}}>Keep my current squads</Button><CommonReplacementSelect key={promptKey} value={replaceCardId} onChange={setReplaceCardId} disabled={claimMutation.isPending}/><p className="text-xs text-white/55">No card is minted or burned. Automatic reminders for this reward stop on this device; it remains available in Inbox while eligible.</p></>}

        {player ? (
          <Button
            type="button"
            onClick={() => setRevealedCard(null)}
            className="h-12 w-full bg-cyan-300 text-base font-black text-slate-950 hover:bg-cyan-200"
          >
            Continue to Fantasy Arena
          </Button>
        ) : (!status?.capReached || Boolean(replaceCardId)) ? (
          <Button
            type="button"
            data-weekly-common-mint-button
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending || rewardQuery.isFetching || Boolean(status?.capReached && !replaceCardId)}
            className="h-12 w-full bg-cyan-300 text-base font-black text-slate-950 hover:bg-cyan-200"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            {claimMutation.isPending ? "Minting your random Common…" : status?.capReached ? "Replace selected Common & mint" : "Mint Random Common Card"}
          </Button>
        ) : null}

        {!player ? <Button type="button" variant="outline" disabled={claimMutation.isPending} onClick={dismissPrompt} className="mt-2 h-11 w-full border-white/20 bg-white/5 text-white">Later — remind me in Inbox</Button> : null}

        {!player ? (
          <p className="text-center text-[11px] leading-5 text-white/40">The card is created only after you press Mint. No automatic background minting.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Gift, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { PremiumPanel } from "../premium";

type DailyRewardCard = {
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

type DailyRewardStatus = {
  claimed?: boolean;
  alreadyClaimed?: boolean;
  cap: number;
  cadenceDays?: number;
  commonCount: number;
  rewardCount: number;
  remaining: number;
  claimedToday: boolean;
  claimedThisWeek?: boolean;
  canClaim: boolean;
  capReached: boolean;
  rewardDay: string;
  signupDay?: string | null;
  firstEligibleFrom?: string | null;
  eligibleFrom?: string | null;
  eligibleForWeeklyReward?: boolean;
  lastRewardDay?: string | null;
  nextEligibleAt?: string | null;
  card?: DailyRewardCard | null;
};

const DAILY_REWARD_KEY = ["/api/rewards/daily-login"] as const;

function nextRewardLabel(value?: string | null) {
  if (!value) return "Next week";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Next week";
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

export default function DailyLoginRewardPanel() {
  const { toast } = useToast();
  const attemptedDay = useRef<string | null>(null);
  const rewardQuery = useQuery<DailyRewardStatus>({
    queryKey: DAILY_REWARD_KEY,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rewards/daily-login/claim", {});
      return response.json() as Promise<DailyRewardStatus>;
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(DAILY_REWARD_KEY, result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
      ]);
      if (result.claimed && result.card?.player) {
        toast({
          title: "Weekly common card collected",
          description: `${result.card.player.name} has been added to your collection.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Weekly reward unavailable",
        description: error?.message || "The reward could not be collected.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const status = rewardQuery.data;
    if (!status?.canClaim || claimMutation.isPending) return;
    const day = String(status.rewardDay || "today");
    if (attemptedDay.current === day) return;
    attemptedDay.current = day;
    claimMutation.mutate();
  }, [rewardQuery.data?.canClaim, rewardQuery.data?.rewardDay, claimMutation.isPending]);

  if (rewardQuery.isLoading || !rewardQuery.data) return null;

  const status = rewardQuery.data;
  const cap = Math.max(1, Number(status.cap || 20));
  const count = Math.max(0, Number(status.commonCount || 0));
  const cadenceDays = Math.max(1, Number(status.cadenceDays || 7));
  const progress = Math.min(100, Math.round((count / cap) * 100));
  const player = status.card?.player;
  const waitingForFirstWeekly = status.eligibleForWeeklyReward === false && !status.lastRewardDay;
  const waitingForNextWeekly = Boolean(status.claimedThisWeek && status.lastRewardDay);

  return (
    <PremiumPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-sky-300/20 bg-sky-300/10 text-sky-200">
            {player?.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : <Gift className="h-7 w-7" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[.18em] text-sky-200/75">Weekly Common reward</p>
              <Badge className="bg-sky-300/15 text-sky-100">{waitingForFirstWeekly ? "Starts Day 2" : `Every ${cadenceDays} days`}</Badge>
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {status.capReached
                ? "Your 20-card common collection is complete"
                : waitingForFirstWeekly
                  ? "Your first weekly card unlocks on Day 2"
                  : player
                    ? `${player.name} joined your club`
                    : claimMutation.isPending
                      ? "Opening this week’s common card…"
                      : waitingForNextWeekly
                        ? "This week’s card has been collected"
                        : "A weekly common card is waiting"}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {player ? `${player.position} • ${player.team}. ` : ""}
              {waitingForFirstWeekly
                ? `Your Starter 5 covers signup day. Your first free Common card unlocks on Day 2, then one card becomes available every ${cadenceDays} days.`
                : `Starter cards and weekly rewards count toward a maximum of ${cap} common cards.`}
            </p>
          </div>
        </div>

        <div className="min-w-[230px] rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="flex items-center justify-between gap-3 text-xs text-white/55">
            <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-sky-300" />Common cards</span>
            <b className="text-white">{count}/{cap}</b>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/50">
            <div className="h-full rounded-full bg-sky-300 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-white/45">
            {status.capReached ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <CalendarDays className="h-4 w-4 text-sky-300" />}
            <span>
              {status.capReached
                ? "Reward journey completed"
                : waitingForFirstWeekly
                  ? `First weekly card: ${nextRewardLabel(status.nextEligibleAt)}`
                  : waitingForNextWeekly
                    ? `Next weekly card: ${nextRewardLabel(status.nextEligibleAt)}`
                    : "Collecting this week’s card"}
            </span>
          </div>
        </div>
      </div>
    </PremiumPanel>
  );
}

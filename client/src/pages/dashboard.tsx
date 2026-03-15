import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
// Fixed: @/hooks -> ../hooks
import { useAuth } from "../hooks/use-auth";
import { queryClient } from "../lib/queryClient";
import Metal3DCard from "../components/Metal3DCard";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
// Fixed: @shared -> ../../../shared
import { type PlayerCardWithPlayer, type Wallet, type Lineup } from "../../../shared/schema";
import {
  Trophy,
  Wallet as WalletIcon,
  TrendingUp,
  Star,
  Package,
  ArrowLeftRight,
  Swords,
  Shield,
  Zap,
  ChevronUp,
  Percent,
  DollarSign,
  CheckCircle2,
  Circle,
  Timer,
  MessageCircle,
  Flame,
} from "lucide-react";
import { Link, useLocation } from "wouter";

type OnboardingConfig = {
  signupPacksEnabled: boolean;
  requireTeamName: boolean;
  teamNameMinLength: number;
  onboardingEntryPath: string;
  starterChecklistLabel: string;
  packLabels: string[];
};

type LiveChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  replyToMessageId?: string;
  replyToUserId?: string;
  replyToUserName?: string;
  replyToText?: string;
  createdAt: string;
};

type LivePointEvent = {
  id: string;
  gameId: number;
  team: string;
  delta: number;
  reason: string;
  createdAt: string;
};

type TournamentRewardStatus = {
  available: boolean;
  claimed: boolean;
  rarity: "rare" | "epic" | "legendary";
  competitionName?: string;
  competitionId?: number | null;
  entryId?: number | null;
  cardId?: number | null;
};


export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [cheers, setCheers] = useState(182);
  const [chatInput, setChatInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<LiveChatMessage | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
    queryFn: async () => {
      const res = await fetch("/api/wallet", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wallet");
      return res.json();
    },
  });

  const { data: lineup, isLoading: lineupLoading } = useQuery<{
    lineup: Lineup;
    cards: PlayerCardWithPlayer[];
  }>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const res = await fetch("/api/lineup", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lineup");
      return res.json();
    },
  });

  const { data: cards, isLoading: cardsLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cards");
      const data = await res.json();
      return Array.isArray(data) ? data : data.cards || [];
    },
  });

  const { data: onboardingConfig } = useQuery<OnboardingConfig>({
    queryKey: ["/api/onboarding/config"],
  });

  const { data: tournamentRewardStatus, refetch: refetchTournamentReward } = useQuery<TournamentRewardStatus | null>({
    queryKey: ["/api/rewards/tournament-status"],
    queryFn: async () => {
      const res = await fetch("/api/rewards/tournament-status", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const {
    data: liveChatMessages,
    refetch: refetchLiveChat,
    isFetching: liveChatLoading,
  } = useQuery<LiveChatMessage[]>({
    queryKey: ["/api/live-chat/messages?limit=40"],
    queryFn: async () => {
      const res = await fetch("/api/live-chat/messages?limit=40", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5000,
  });

  const { data: livePointEvents } = useQuery<LivePointEvent[]>({
    queryKey: ["/api/live/point-feed?limit=20"],
    queryFn: async () => {
      const res = await fetch("/api/live/point-feed?limit=20", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5000,
  });

  const sendLiveChatMutation = useMutation({
    mutationFn: async ({ text, replyToMessageId }: { text: string; replyToMessageId?: string }) => {
      const res = await fetch("/api/live-chat/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, replyToMessageId }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: async () => {
      setChatInput("");
      setReplyTarget(null);
      await refetchLiveChat();
    },
  });

  const claimTournamentRewardMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/rewards/tournament-claim", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to claim tournament reward");
      return res.json() as Promise<{ rarity: "rare" | "epic" | "legendary"; cardId: number }>;
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] }),
        refetchTournamentReward(),
      ]);
      const rarity = String(data?.rarity || "rare").toLowerCase();
      const cardId = Number(data?.cardId || 0);
      navigate(`/card-reveal?source=tournament-reward&rarity=${encodeURIComponent(rarity)}&cardId=${cardId}`);
    },
  });

  useEffect(() => {
    if (onboardingConfig?.signupPacksEnabled === false) return;
    if (cardsLoading) return;

    if (Array.isArray(cards) && cards.length === 0) {
      (async () => {
        try {
          await fetch("/api/onboarding/create-offer", { method: "POST" });
          navigate("/onboarding");
        } catch (err) {
          console.error("Failed to create onboarding offer:", err);
        }
      })();
    }
  }, [cardsLoading, cards, navigate, onboardingConfig?.signupPacksEnabled]);

  const totalScore = lineup?.cards?.reduce((sum, c) => {
    const scores = c.last5Scores as number[];
    return sum + (scores?.[scores.length - 1] || 0);
  }, 0) || 0;

  const hasCards = (cards?.length || 0) > 0;
  const hasLineup = (lineup?.cards?.length || 0) === 5;
  const hasBalance = (wallet?.balance || 0) > 0;

  const checklist = [
    { label: onboardingConfig?.starterChecklistLabel || "Open starter packs", done: hasCards },
    { label: "Set your 5-card lineup", done: hasLineup },
    { label: "Fund wallet for market moves", done: hasBalance },
  ];

  const onboardingEntryPath = onboardingConfig?.onboardingEntryPath || "/onboarding";

  const weeklyEvents = useMemo(
    () => [
      { title: "Derby Week Boost", desc: "Manchester derby cards +10% market demand", endsIn: "2d 14h" },
      { title: "Flash Volatility", desc: "Rare cards spread tightens for 6 hours", endsIn: "6h 08m" },
      { title: "Weekend Tournament", desc: "Top 100 split bonus prize pool", endsIn: "3d 01h" },
    ],
    [],
  );

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-welcome">
              Welcome back, {user?.firstName || "Manager"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Track live EPL performances, manage your squad, and climb the leaderboard
            </p>
          </div>
        </div>

        {Boolean(tournamentRewardStatus?.available) && (
          <Card className="p-5 mb-6 border-amber-400/40 bg-gradient-to-r from-amber-500/10 to-yellow-400/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-300 font-semibold">Tournament Winner Reward</p>
                <h3 className="text-lg font-semibold text-foreground">Congratulations! You won a {String(tournamentRewardStatus?.rarity || "rare").toUpperCase()} card</h3>
                <p className="text-sm text-muted-foreground">
                  {tournamentRewardStatus?.competitionName
                    ? `${tournamentRewardStatus.competitionName} victory reward is ready to reveal.`
                    : "Your tournament victory reward is ready to reveal."}
                </p>
              </div>
              <Button
                onClick={() => claimTournamentRewardMutation.mutate()}
                disabled={claimTournamentRewardMutation.isPending}
              >
                {claimTournamentRewardMutation.isPending ? "Claiming..." : "Claim & Reveal"}
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-green-500/10 flex items-center justify-center">
                <WalletIcon className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                {walletLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p
                    className="text-xl font-bold text-foreground"
                    data-testid="text-balance"
                  >
                    N${wallet?.balance?.toFixed(2) || "0.00"}
                  </p>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cards Owned</p>
                {cardsLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p
                    className="text-xl font-bold text-foreground"
                    data-testid="text-cards-count"
                  >
                    {cards?.length || 0}
                  </p>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-yellow-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Game Score</p>
                <p
                  className="text-xl font-bold text-foreground"
                  data-testid="text-score"
                >
                  {totalScore}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <Card className="p-5 lg:col-span-2 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Matchday Checklist
              </h2>
              <Badge variant="secondary" data-testid="badge-checklist-progress">
                {checklist.filter((step) => step.done).length}/3 complete
              </Badge>
            </div>

            <div className="space-y-2.5">
              {checklist.map((step) => (
                <div key={step.label} className="flex items-center gap-2 text-sm">
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 border-border/70">
            <h3 className="font-semibold text-foreground mb-1">Best Next Action</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasCards && hasLineup
                ? "Your core setup is done. Improve card quality in the market."
                : hasCards
                  ? "You have cards ready — lock your lineup to start competing."
                  : "Start by opening your packs and selecting your first 5 cards."}
            </p>

            {!hasCards ? (
              <Button onClick={() => navigate(onboardingEntryPath)} data-testid="button-next-onboarding">
                Go to Onboarding
              </Button>
            ) : !hasLineup ? (
              <Button onClick={() => navigate("/collection")} data-testid="button-next-lineup">
                Set Lineup
              </Button>
            ) : (
              <Button onClick={() => navigate("/marketplace")} data-testid="button-next-market">
                Open Marketplace
              </Button>
            )}
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Your Lineup
            </h2>
            <Link href="/collection">
              <Button variant="outline" size="sm" data-testid="link-view-collection">
                View Collection
              </Button>
            </Link>
          </div>

          {lineupLoading ? (
            <div className="flex flex-wrap gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="w-48 h-72 rounded-md" />
              ))}
            </div>
          ) : lineup?.cards && lineup.cards.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {lineup.cards.map((card) => (
                <Metal3DCard key={card.id} player={toFantasyCardData(card)} className="!w-[208px]" />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No lineup set yet. Visit your collection to set one up.
              </p>
            </Card>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/marketplace">
              <Card className="p-4 hover-elevate cursor-pointer">
                <h3 className="font-medium text-foreground mb-1">Marketplace</h3>
                <p className="text-sm text-muted-foreground">
                  Browse and buy rare cards from other managers
                </p>
              </Card>
            </Link>
            <Link href="/wallet">
              <Card className="p-4 hover-elevate cursor-pointer">
                <h3 className="font-medium text-foreground mb-1">Wallet</h3>
                <p className="text-sm text-muted-foreground">
                  Deposit funds and manage your balance
                </p>
              </Card>
            </Link>
            <Link href="/collection">
              <Card className="p-4 hover-elevate cursor-pointer">
                <h3 className="font-medium text-foreground mb-1">Collection</h3>
                <p className="text-sm text-muted-foreground">
                  View all your cards and manage your lineup
                </p>
              </Card>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
          <Card className="p-5 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Timer className="w-4 h-4 text-primary" />
                Weekly Live Events
              </h3>
              <Badge variant="secondary">Live Economy</Badge>
            </div>
            <div className="space-y-3">
              {weeklyEvents.map((evt) => (
                <div key={evt.title} className="rounded-lg border border-border/60 p-3 bg-background/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-sm">{evt.title}</p>
                    <Badge>{evt.endsIn}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{evt.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 border-border/70">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                Social Arena
              </h3>
              <Button size="sm" variant="outline" onClick={() => setCheers((v) => v + 1)}>
                <Flame className="w-4 h-4 mr-1 text-orange-500" /> Cheer ({cheers})
              </Button>
            </div>

            <div className="mb-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Live Point Dots</p>
              <div className="space-y-1.5 max-h-24 overflow-auto">
                {(livePointEvents || []).slice().reverse().slice(0, 8).map((event) => (
                  <div key={event.id} className="flex items-center gap-2 text-xs">
                    <span className={`h-2.5 w-2.5 rounded-full ${event.delta >= 0 ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-foreground">{event.team}</span>
                    <span className={event.delta >= 0 ? "text-green-500" : "text-red-500"}>
                      {event.delta >= 0 ? `+${event.delta}` : event.delta}
                    </span>
                    <span className="text-muted-foreground">{event.reason}</span>
                  </div>
                ))}
                {(!livePointEvents || livePointEvents.length === 0) && (
                  <p className="text-xs text-muted-foreground">No point events yet.</p>
                )}
              </div>
            </div>

            <div className="space-y-2 mb-3 max-h-36 overflow-auto">
              {(liveChatMessages || []).slice().reverse().slice(0, 8).map((message) => (
                <div key={message.id} className="text-sm rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-xs text-foreground">{message.userName || "Manager"}</span>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => {
                          setReplyTarget(message);
                          setChatInput((prev) => {
                            const tag = `@${message.userName} `;
                            if (prev.trim().length === 0) return tag;
                            if (prev.startsWith(tag)) return prev;
                            return `${tag}${prev}`;
                          });
                        }}
                      >
                        Reply
                      </button>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  {message.replyToMessageId && (
                    <div className="mb-1 rounded border border-primary/30 bg-primary/10 px-2 py-1">
                      <p className="text-[10px] text-primary font-medium">Replying to @{message.replyToUserName || "Manager"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{message.replyToText || "Message"}</p>
                    </div>
                  )}
                  <p className="text-xs text-foreground/90">{message.text}</p>
                </div>
              ))}
              {(!liveChatMessages || liveChatMessages.length === 0) && (
                <div className="text-xs rounded-md border border-border/60 bg-background/40 px-3 py-2 text-muted-foreground">
                  No chat messages yet.
                </div>
              )}
            </div>

            {replyTarget && (
              <div className="mb-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-primary font-medium">
                    Replying to @{replyTarget.userName}
                  </p>
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => setReplyTarget(null)}
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{replyTarget.text}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  liveChatLoading
                    ? "Refreshing chat..."
                    : replyTarget
                    ? `Reply to @${replyTarget.userName}`
                    : "Send a live message"
                }
                maxLength={280}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const text = chatInput.trim();
                    if (!text || sendLiveChatMutation.isPending) return;
                    sendLiveChatMutation.mutate({ text, replyToMessageId: replyTarget?.id });
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  const text = chatInput.trim();
                  if (!text) return;
                  sendLiveChatMutation.mutate({ text, replyToMessageId: replyTarget?.id });
                }}
                disabled={sendLiveChatMutation.isPending || chatInput.trim().length === 0}
              >
                Send
              </Button>
            </div>
          </Card>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            How It Works
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Everything you need to know about collecting, competing, and climbing the ranks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">1. Open Starter Packs</h3>
              <p className="text-sm text-muted-foreground">
                Sign up and receive 5 position-based packs (GK, DEF, MID, FWD, Wildcards) with 15 common players total. Pick 1 from each pack to form your starting lineup of 5.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                <Swords className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">2. Build Your SO5 Lineup</h3>
              <p className="text-sm text-muted-foreground">
                Your lineup needs exactly 5 cards: 1 GK, 1 DEF, 1 MID, 1 FWD, and 1 Utility (any position). Choose a captain for a 10% score bonus.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                <Trophy className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">3. Compete Weekly</h3>
              <p className="text-sm text-muted-foreground">
                Enter Common tier tournaments for free or Rare tier for N$20. Your players score based on real-world performance. Top 3 win prizes — 60/30/10 split of the prize pool plus bonus cards.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
                <ChevronUp className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">4. Level Up Cards</h3>
              <p className="text-sm text-muted-foreground">
                Cards earn XP from appearances, goals, assists, and minutes played. Every 1,000 XP levels up a card. Each level gives 5% more points than the previous — so a Level 3 card earns 10% bonus points.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mb-3">
                <ArrowLeftRight className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">5. Trade & Swap</h3>
              <p className="text-sm text-muted-foreground">
                Rare, Unique, Epic, and Legendary cards can be sold or swapped on the marketplace. You can also propose swap offers with optional cash top-ups. Common cards are free and untradable.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-3">
                <Percent className="w-5 h-5 text-cyan-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">6. Card Rarities</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-zinc-400 mr-1 align-middle" /> Common (Silver) —
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500 mr-1 ml-2 align-middle" /> Rare (Red) —
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-purple-500 to-pink-500 mr-1 ml-2 align-middle" /> Unique (Rainbow) —
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-900 mr-1 ml-2 align-middle" /> Epic (Black) —
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 mr-1 ml-2 align-middle" /> Legendary (Gold). Higher rarity = higher base stats and more points per game.
              </p>
            </Card>
          </div>

          <Card className="p-4 mt-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm">8% Platform Fee</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  An 8% fee applies to all financial transactions including deposits, marketplace sales, and swap deals. This keeps the platform running and funds the prize pools.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

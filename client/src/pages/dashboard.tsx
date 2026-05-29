import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Banknote, BellRing, CreditCard, Gavel, LayoutGrid, LineChart, ShoppingBag, Sparkles, Trophy, Users, Wallet as WalletIcon, Zap } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import Metal3DCard from "../components/Metal3DCard";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { useAuth } from "../hooks/use-auth";
import { type Competition, type CompetitionEntry, type PlayerCardWithPlayer, type Wallet } from "../../../shared/schema";

type CompetitionWithEntries = Competition & {
  entryCount?: number;
  max_entries?: number | null;
  maxEntries?: number | null;
  prize_pool_total?: number;
  platform_fee_total?: number;
};

type NotificationResponse = {
  notifications: Array<{ id: number; title: string; message: string; read: boolean; createdAt?: string | null }>;
  unreadCount: number;
};

type RetentionSummary = {
  missions?: Array<{ id: string; title: string; progress: number; target: number; completed: boolean }>;
  nextBestAction?: { key: string; title: string; ctaPath: string };
  deadline?: null | { competitionId: number; competitionName: string; startsAt: string };
};

function money(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "N$0.00";
  return `N$${n.toFixed(2)}`;
}

function rarityCounts(cards: PlayerCardWithPlayer[] | undefined) {
  const counts: Record<string, number> = { common: 0, rare: 0, unique: 0, legendary: 0 };
  for (const card of cards || []) {
    const rarity = String(card.rarity || "common").toLowerCase();
    counts[rarity] = (counts[rarity] || 0) + 1;
  }
  return counts;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
    queryFn: async () => {
      const res = await fetch("/api/wallet", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wallet");
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

  const { data: lineup, isLoading: lineupLoading } = useQuery<{ cards: PlayerCardWithPlayer[] }>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const res = await fetch("/api/lineup", { credentials: "include" });
      if (!res.ok) return { cards: [] };
      return res.json();
    },
  });

  const { data: competitions } = useQuery<CompetitionWithEntries[]>({
    queryKey: ["/api/competitions"],
    queryFn: async () => {
      const res = await fetch("/api/competitions", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.competitions || [];
    },
    refetchInterval: 30000,
  });

  const { data: myEntries } = useQuery<CompetitionEntry[]>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const res = await fetch("/api/competitions/my-entries", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery<NotificationResponse>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return { notifications: [], unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: retentionSummary } = useQuery<RetentionSummary>({
    queryKey: ["/api/retention/summary"],
    queryFn: async () => {
      const res = await fetch("/api/retention/summary", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: 30000,
  });

  const activeCompetitionIds = new Set((myEntries || []).map((entry) => entry.competitionId));
  const activeTournaments = (competitions || []).filter((comp) => activeCompetitionIds.has(comp.id) && (comp.status === "open" || comp.status === "active"));
  const openTournaments = (competitions || []).filter((comp) => comp.status === "open");
  const listedCards = (cards || []).filter((card) => card.forSale);
  const counts = rarityCounts(cards);
  const lineupCards = lineup?.cards || [];
  const lineupScore = lineupCards.reduce((sum, card) => {
    const scores = Array.isArray(card.last5Scores) ? card.last5Scores as number[] : [];
    return sum + Number(scores[scores.length - 1] || 0);
  }, 0);
  const walletBalance = Number(wallet?.balance || 0);

  const nextAction = useMemo(() => {
    if (!cards?.length) return { title: "Open starter packs", href: "/onboarding", cta: "Start" };
    if (lineupCards.length !== 5) return { title: "Set your 5-card lineup", href: "/collection", cta: "Set Lineup" };
    if (activeTournaments.length === 0) return { title: "Enter a tournament", href: "/competitions", cta: "Enter Now" };
    if (walletBalance <= 0) return { title: "Fund your wallet", href: "/wallet", cta: "Deposit" };
    return { title: retentionSummary?.nextBestAction?.title || "Review marketplace opportunities", href: retentionSummary?.nextBestAction?.ctaPath || "/marketplace", cta: "Review" };
  }, [cards?.length, lineupCards.length, activeTournaments.length, walletBalance, retentionSummary?.nextBestAction]);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/15 via-background/90 to-black/40 p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className="gap-1"><Sparkles className="h-3 w-3" /> Command Center</Badge>
                {notifications?.unreadCount ? <Badge variant="outline">{notifications.unreadCount} unread</Badge> : null}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-4xl">Welcome back, {user?.firstName || "Manager"}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Your wallet, squad, tournaments and market actions in one clean view.</p>
            </div>
            <Card className="min-w-[240px] border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Next Best Action</p>
              <h2 className="mt-2 font-bold text-foreground">{nextAction.title}</h2>
              <Link href={nextAction.href}><Button className="mt-3 w-full">{nextAction.cta}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            </Card>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<WalletIcon className="h-5 w-5" />} label="Wallet Balance" value={walletLoading ? null : money(walletBalance)} helper="Available funds" href="/wallet" />
          <MetricCard icon={<CreditCard className="h-5 w-5" />} label="Cards Owned" value={cardsLoading ? null : String(cards?.length || 0)} helper={`${listedCards.length} listed for sale`} href="/collection" />
          <MetricCard icon={<Trophy className="h-5 w-5" />} label="Live Entries" value={String(activeTournaments.length)} helper={`${openTournaments.length} open tournaments`} href="/competitions" />
          <MetricCard icon={<LineChart className="h-5 w-5" />} label="Lineup Score" value={lineupLoading ? null : String(lineupScore)} helper={`${lineupCards.length}/5 cards selected`} href="/live-lineup" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-lg font-bold">Current Lineup</h2><p className="text-sm text-muted-foreground">Your active 5-card squad.</p></div>
              <Link href="/collection"><Button size="sm" variant="outline">Edit Lineup</Button></Link>
            </div>
            {lineupLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-64 w-44 shrink-0 rounded-xl" />)}</div>
            ) : lineupCards.length ? (
              <div className="flex gap-3 overflow-x-auto pb-2">{lineupCards.map((card) => <Metal3DCard key={card.id} player={toFantasyCardData(card)} className="!w-[180px] shrink-0" />)}</div>
            ) : (
              <EmptyState title="No lineup set" body="Select 5 eligible cards from your collection before entering tournaments." action="Set Lineup" href="/collection" />
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /><h2 className="font-bold">Active Tournaments</h2></div>
              {activeTournaments.length ? (
                <div className="space-y-2">{activeTournaments.slice(0, 4).map((comp) => <CompactRow key={comp.id} title={comp.name} meta={`${String(comp.tier || "common").toUpperCase()} • ${money(comp.entryFee)}`} badge={comp.status} />)}</div>
              ) : (
                <EmptyState title="No active entries" body="Join a public tournament or enter a private PIN cup." action="Find Tournaments" href="/competitions" compact />
              )}
            </Card>
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" /><h2 className="font-bold">Important Updates</h2></div>
              {notifications?.notifications?.length ? (
                <div className="space-y-2">{notifications.notifications.slice(0, 3).map((note) => <CompactRow key={note.id} title={note.title} meta={note.message} badge={note.read ? "Read" : "New"} />)}</div>
              ) : (
                <p className="text-sm text-muted-foreground">No important notifications.</p>
              )}
            </Card>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ActionCard icon={<ShoppingBag className="h-5 w-5" />} title="Marketplace" body="Buy cards, manage listings and spot value opportunities." href="/marketplace" cta="Open Market" />
          <ActionCard icon={<Gavel className="h-5 w-5" />} title="Auctions" body="Bid on live auction cards and track current offers." href="/auctions" cta="View Auctions" />
          <ActionCard icon={<Users className="h-5 w-5" />} title="Create Tournament" body="Start a public cup or private PIN tournament with friends." href="/competitions" cta="Create Cup" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary" /><h2 className="font-bold">Collection Snapshot</h2></div>
            <div className="grid grid-cols-2 gap-2">
              <RarityPill label="Common" value={counts.common || 0} />
              <RarityPill label="Rare" value={counts.rare || 0} />
              <RarityPill label="Unique" value={counts.unique || 0} />
              <RarityPill label="Legendary" value={counts.legendary || 0} />
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /><h2 className="font-bold">Missions & Deadlines</h2></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                {(retentionSummary?.missions || []).slice(0, 3).map((mission) => (
                  <div key={mission.id} className="flex items-center justify-between rounded-xl border bg-background/60 p-3 text-sm">
                    <span className={mission.completed ? "text-green-500" : "text-foreground"}>{mission.title}</span>
                    <Badge variant={mission.completed ? "default" : "outline"}>{mission.progress}/{mission.target}</Badge>
                  </div>
                ))}
                {!(retentionSummary?.missions || []).length && <p className="text-sm text-muted-foreground">No missions right now.</p>}
              </div>
              <div className="rounded-xl border bg-background/60 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Deadline</p>
                <p className="mt-2 text-sm font-semibold">{retentionSummary?.deadline ? retentionSummary.deadline.competitionName : "No active deadline"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{retentionSummary?.deadline?.startsAt ? new Date(retentionSummary.deadline.startsAt).toLocaleString() : "You are clear for now."}</p>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, helper, href }: { icon: React.ReactNode; label: string; value: string | null; helper: string; href: string }) {
  return <Link href={href}><Card className="group cursor-pointer border-border/70 bg-background/80 p-4 transition hover:border-primary/40 hover:bg-primary/5"><div className="flex items-center justify-between gap-3"><div className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div><ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" /></div><p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>{value === null ? <Skeleton className="mt-2 h-7 w-24" /> : <p className="mt-1 text-2xl font-black text-foreground">{value}</p>}<p className="mt-1 text-xs text-muted-foreground">{helper}</p></Card></Link>;
}

function ActionCard({ icon, title, body, href, cta }: { icon: React.ReactNode; title: string; body: string; href: string; cta: string }) {
  return <Card className="p-5"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div><h3 className="font-bold">{title}</h3><p className="mt-1 min-h-10 text-sm text-muted-foreground">{body}</p><Link href={href}><Button className="mt-4 w-full" variant="outline">{cta}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link></Card>;
}

function CompactRow({ title, meta, badge }: { title: string; meta: string; badge: string }) {
  return <div className="flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p><p className="line-clamp-2 text-xs text-muted-foreground">{meta}</p></div><Badge variant="outline" className="shrink-0 capitalize">{badge}</Badge></div>;
}

function RarityPill({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-background/60 p-3"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p><p className="text-xl font-black">{value}</p></div>;
}

function EmptyState({ title, body, action, href, compact = false }: { title: string; body: string; action: string; href: string; compact?: boolean }) {
  return <div className={`rounded-2xl border border-dashed bg-background/50 text-center ${compact ? "p-4" : "p-8"}`}><p className="font-semibold">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p><Link href={href}><Button className="mt-4" size="sm">{action}</Button></Link></div>;
}

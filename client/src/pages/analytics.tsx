import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, ShieldCheck, Star, TrendingUp, Trophy } from "lucide-react";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { PremiumFootballCard } from "../components/cards";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type Lineup, type PlayerCardWithPlayer, type Wallet } from "../../../shared/schema";

function getScores(card: PlayerCardWithPlayer) {
  const scores = Array.isArray(card.last5Scores) ? card.last5Scores.map((v: any) => Number(v || 0)) : [];
  while (scores.length < 5) scores.push(0);
  return scores.slice(0, 5);
}

function cardTotal(card: PlayerCardWithPlayer) {
  return getScores(card).reduce((sum, value) => sum + value, 0);
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub: string; icon: typeof Activity }) {
  return (
    <Card className="rounded-2xl border-slate-800 bg-slate-950/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{sub}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function FormBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values.map((v) => Number(v || 0)));
  return (
    <div className="flex h-44 items-end gap-3 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
      {values.map((value, index) => (
        <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end rounded-xl bg-slate-900/80 p-1">
            <div
              className="w-full rounded-lg bg-gradient-to-t from-blue-600 to-emerald-300 shadow-[0_0_18px_rgba(52,211,153,.22)]"
              style={{ height: `${Math.max(10, (Number(value || 0) / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-400">G{index + 1}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: wallet } = useQuery<Wallet>({
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

  const { data: lineupData } = useQuery<{ lineup: Lineup; cards: PlayerCardWithPlayer[] }>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const res = await fetch("/api/lineup", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lineup");
      return res.json();
    },
  });

  const analytics = useMemo(() => {
    const owned = cards || [];
    const lineup = lineupData?.cards || [];
    const totalPoints = owned.reduce((sum, card) => sum + cardTotal(card), 0);
    const lineupPoints = lineup.reduce((sum, card) => sum + cardTotal(card), 0);
    const avgRating = owned.length
      ? owned.reduce((sum, card) => sum + Number(card.player?.overall || card.decisiveScore || 0), 0) / owned.length
      : 0;
    const tradeable = owned.filter((card) => String(card.rarity || "common").toLowerCase() !== "common").length;
    const topCards = [...owned].sort((a, b) => cardTotal(b) - cardTotal(a)).slice(0, 4);
    const recentForm = [0, 1, 2, 3, 4].map((index) => owned.reduce((sum, card) => sum + Number(getScores(card)[index] || 0), 0));
    return { owned, lineup, totalPoints, lineupPoints, avgRating, tradeable, topCards, recentForm };
  }, [cards, lineupData?.cards]);

  return (
    <div className="relative min-h-full flex-1 overflow-auto bg-[#07111f] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(37,99,235,.16),transparent_34%),linear-gradient(180deg,#07111f_0%,#050812_100%)]" />
      <div className="relative mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.24em] text-blue-300/70">Manager Intelligence</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Analytics</h1>
            <p className="mt-1 text-sm text-slate-400">Clean view of form, points, lineup strength and market readiness.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Wallet</p>
            <p className="text-lg font-black text-white">N${Number(wallet?.balance || 0).toFixed(2)}</p>
          </div>
        </div>

        {cardsLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl bg-slate-800" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Points" value={String(Math.round(analytics.totalPoints))} sub="All owned player cards" icon={TrendingUp} />
            <StatCard label="Lineup Points" value={String(Math.round(analytics.lineupPoints))} sub={`${analytics.lineup.length}/5 active lineup cards`} icon={Trophy} />
            <StatCard label="Avg Rating" value={analytics.avgRating.toFixed(1)} sub={`${analytics.owned.length} cards owned`} icon={Star} />
            <StatCard label="Tradeable" value={String(analytics.tradeable)} sub="Rare+ market cards" icon={ShieldCheck} />
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <Card className="rounded-3xl border-slate-800 bg-slate-950/60 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white">Recent Form</h2>
                <p className="text-sm text-slate-500">Combined points from your cards over the last five games.</p>
              </div>
              <BarChart3 className="h-5 w-5 text-blue-300" />
            </div>
            <FormBars values={analytics.recentForm} />
          </Card>

          <Card className="rounded-3xl border-slate-800 bg-slate-950/60 p-5">
            <h2 className="text-lg font-black text-white">Lineup Health</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-black/25 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Lineup completion</span>
                  <span className="font-black text-white">{analytics.lineup.length}/5</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-emerald-300" style={{ width: `${Math.min(100, (analytics.lineup.length / 5) * 100)}%` }} />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-black/25 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Market readiness</span>
                  <span className="font-black text-white">{analytics.tradeable}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Tradeable cards are Rare, Unique, Epic and Legendary.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-black/25 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Squad depth</span>
                  <span className="font-black text-white">{analytics.owned.length}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">More depth gives you better tournament options.</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-800 bg-slate-950/60 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">Top Performers</h2>
              <p className="text-sm text-slate-500">Your clean shortlist. No clutter.</p>
            </div>
            <Activity className="h-5 w-5 text-emerald-300" />
          </div>
          {analytics.topCards.length ? (
            <div className="grid justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {analytics.topCards.map((card) => (
                <PremiumFootballCard key={card.id} player={toFantasyCardData(card, { imageWidth: 640 })} size="sm" />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-black/25 p-8 text-center text-slate-500">No player data yet.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

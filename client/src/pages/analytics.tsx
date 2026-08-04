import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, ShieldCheck, Star, TrendingUp, Trophy } from "lucide-react";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { PremiumFootballCard } from "../components/cards";
import CardProfileModal from "../components/cards/CardProfileModal";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type Lineup, type PlayerCardWithPlayer, type Wallet } from "../../../shared/schema";

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

export default function AnalyticsPage() {
  const [selectedCard, setSelectedCard] = useState<PlayerCardWithPlayer | null>(null);
  const { data: wallet } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
    queryFn: async () => {
      const res = await fetch("/api/wallet", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wallet");
      return res.json();
    },
  });

  const { data: cards = [], isLoading: cardsLoading } = useQuery<PlayerCardWithPlayer[]>({
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
    const ownedRows = owned.map((card) => ({ card, data: toFantasyCardData(card, { imageWidth: 640 }) }));
    const lineupRows = lineup.map((card) => ({ card, data: toFantasyCardData(card, { imageWidth: 640 }) }));
    const verifiedOwned = ownedRows.filter((row) => row.data.statsVerified);
    const verifiedLineup = lineupRows.filter((row) => row.data.statsVerified);
    const totalPoints = verifiedOwned.reduce((sum, row) => sum + Number(row.data.totalPoints || 0), 0);
    const lineupPoints = verifiedLineup.reduce((sum, row) => sum + Number(row.data.totalPoints || 0), 0);
    const avgRating = verifiedOwned.length
      ? verifiedOwned.reduce((sum, row) => sum + Number(row.data.rating || 0), 0) / verifiedOwned.length
      : null;
    const tradeable = owned.filter((card) => String(card.rarity || "common").toLowerCase() !== "common").length;
    const topCards = [...verifiedOwned]
      .sort((a, b) => Number(b.data.totalPoints || 0) - Number(a.data.totalPoints || 0))
      .slice(0, 4);
    const coverage = owned.length ? Math.round((verifiedOwned.length / owned.length) * 100) : 0;
    return {
      owned,
      lineup,
      verifiedOwned,
      verifiedLineup,
      totalPoints,
      lineupPoints,
      avgRating,
      tradeable,
      topCards,
      coverage,
      unverifiedCount: Math.max(0, owned.length - verifiedOwned.length),
    };
  }, [cards, lineupData?.cards]);

  return (
    <main className="relative min-h-full overflow-x-hidden bg-[#07111f] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(37,99,235,.16),transparent_34%),linear-gradient(180deg,#07111f_0%,#050812_100%)]" />
      <div className="relative mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.24em] text-blue-300/70">Manager Intelligence</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Verified Analytics</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">Only provider-linked Premier League statistics are included. Unverified values are excluded rather than estimated.</p>
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
            <StatCard label="Official Season Points" value={analytics.verifiedOwned.length ? String(Math.round(analytics.totalPoints)) : "—"} sub={`${analytics.verifiedOwned.length}/${analytics.owned.length} verified cards`} icon={TrendingUp} />
            <StatCard label="Lineup Season Points" value={analytics.verifiedLineup.length ? String(Math.round(analytics.lineupPoints)) : "—"} sub={`${analytics.verifiedLineup.length}/${analytics.lineup.length} verified lineup cards`} icon={Trophy} />
            <StatCard label="Avg Arena OVR" value={analytics.avgRating === null ? "—" : analytics.avgRating.toFixed(1)} sub="Derived from verified FPL inputs" icon={Star} />
            <StatCard label="Tradeable" value={String(analytics.tradeable)} sub="Rare+ market cards" icon={ShieldCheck} />
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <Card className="rounded-3xl border-slate-800 bg-slate-950/60 p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black">Official Data Coverage</h2>
                <p className="mt-1 text-sm text-slate-500">Cards without a confirmed provider identity are not counted in performance totals.</p>
              </div>
              <BarChart3 className="h-5 w-5 text-blue-300" />
            </div>
            <div className="mt-6 rounded-2xl border border-slate-800 bg-black/25 p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-4xl font-black">{analytics.coverage}%</p>
                  <p className="mt-1 text-xs text-slate-500">{analytics.verifiedOwned.length} verified • {analytics.unverifiedCount} awaiting official link</p>
                </div>
                <Activity className="h-8 w-8 text-emerald-300" />
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-300" style={{ width: `${analytics.coverage}%` }} />
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl border-slate-800 bg-slate-950/60 p-5 text-white">
            <h2 className="text-lg font-black">Data Policy</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"><b className="text-emerald-200">Included:</b> official FPL season points, form, player identity, club and position. Arena OVR is a Fantasy Arena rating derived from verified FPL inputs.</div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4"><b className="text-amber-200">Not estimated:</b> missing player ratings, reconstructed match totals or invented recent-form results.</div>
              <div className="rounded-2xl border border-slate-800 bg-black/25 p-4">Open any verified card below to inspect its provider and complete match history.</div>
            </div>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-800 bg-slate-950/60 p-5 text-white">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Top Verified Performers</h2>
              <p className="text-sm text-slate-500">Ranked only by official season points.</p>
            </div>
            <Activity className="h-5 w-5 text-emerald-300" />
          </div>
          {analytics.topCards.length ? (
            <div className="grid justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {analytics.topCards.map(({ card, data }) => (
                <PremiumFootballCard key={card.id} player={data} size="sm" onClick={() => setSelectedCard(card)} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-black/25 p-8 text-center text-slate-500">No provider-verified player data is available yet.</div>
          )}
        </Card>
      </div>
      {selectedCard ? <CardProfileModal card={selectedCard} onClose={() => setSelectedCard(null)} /> : null}
    </main>
  );
}
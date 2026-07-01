import { useQuery } from "@tanstack/react-query";
import { X, Activity, BarChart3, CalendarDays, Shield, Star, TrendingUp } from "lucide-react";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";
import { toFantasyCardData } from "../../lib/fantasy-card-adapter";
import CollectionStableCard from "./CollectionStableCard";

export type CardProfileData = {
  source: "fpl-live" | "card-fallback";
  player: { name?: string; webName?: string; team?: string; position?: string; imageUrl?: string; status?: string; news?: string };
  last10: Array<{ gameweek: number; opponent: string; points: number; minutes: number; goals: number; assists: number; kickoffTime?: string | null; wasHome?: boolean }>;
  stats: { matchesPlayed: number; minutes: number; goals: number; assists: number; cleanSheets?: number; yellowCards: number; redCards: number; bonus?: number; totalPoints: number; selectedBy?: string | null; value?: number | null };
};

function fallbackData(card: PlayerCardWithPlayer): CardProfileData {
  const scores = Array.isArray(card.last5Scores) ? card.last5Scores.map((score) => Number(score || 0)) : [];
  const padded = [...scores];
  while (padded.length < 10) padded.unshift(0);
  return {
    source: "card-fallback",
    player: { name: card.player?.name, team: card.player?.team, position: card.player?.position, imageUrl: card.player?.imageUrl },
    last10: padded.slice(-10).map((points, index) => ({ gameweek: index + 1, opponent: `GW${index + 1}`, points, minutes: 0, goals: 0, assists: 0 })),
    stats: { matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, totalPoints: Number(card.totalPoints || 0), selectedBy: null, value: null },
  };
}

function maxPoints(history: CardProfileData["last10"]) {
  return Math.max(1, ...history.map((item) => Number(item.points || 0)));
}

export default function CardProfileModal({ card, onClose }: { card: PlayerCardWithPlayer; onClose: () => void }) {
  const fantasyCard = toFantasyCardData(card, { imageWidth: 900 });
  const fallback = fallbackData(card);
  const { data = fallback, isLoading } = useQuery<CardProfileData>({
    queryKey: ["/api/cards/profile", card.id],
    queryFn: async () => {
      const res = await fetch(`/api/cards/${card.id}/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch card profile");
      return res.json();
    },
    staleTime: 60_000,
  });
  const history = data.last10?.length ? data.last10 : fallback.last10;
  const peak = maxPoints(history);
  const displayName = data.player?.name || card.player?.name || "Unknown Player";
  const team = data.player?.team || card.player?.team || "Fantasy Arena";
  const position = data.player?.position || card.player?.position || "N/A";

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/82 p-3 backdrop-blur-xl sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto min-h-full max-w-6xl py-4 sm:py-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#080d1f]/95 shadow-[0_30px_100px_rgba(0,0,0,.72)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">Live Card Profile</p>
              <h2 className="text-xl font-black text-white sm:text-2xl">{displayName}</h2>
            </div>
            <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[300px_1fr] lg:p-5">
            <aside className="space-y-4">
              <div className="flex justify-center rounded-[1.6rem] border border-white/10 bg-white/[.04] p-4">
                <CollectionStableCard player={fantasyCard} size="md" showPrice={Boolean(card.forSale)} />
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/25 p-4">
                <h3 className="text-2xl font-black text-white">{displayName}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-white/80">
                  <span className="rounded-xl bg-white/[.08] px-3 py-2">{position}</span>
                  <span className="rounded-xl bg-white/[.08] px-3 py-2">{team}</span>
                  <span className="rounded-xl bg-cyan-400/10 px-3 py-2 text-cyan-100">{data.source === "fpl-live" ? "FPL live linked" : "Card data"}</span>
                </div>
                {data.player?.news ? <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">{data.player.news}</p> : null}
              </div>
            </aside>

            <section className="space-y-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[.045] p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className="flex items-center gap-2 text-lg font-black text-white"><BarChart3 className="h-5 w-5 text-cyan-200" /> Last 10 Game Points</h3><p className="text-sm text-white/45">Bars show points by gameweek and opponent.</p></div>
                  {isLoading ? <span className="text-xs text-white/45">Updating...</span> : null}
                </div>
                <div className="flex h-64 items-end gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/24 px-3 pb-4 pt-6">
                  {history.map((item, index) => {
                    const height = Math.max(8, Math.round((Number(item.points || 0) / peak) * 190));
                    return (
                      <div key={`${item.gameweek}-${index}`} className="flex min-w-[42px] flex-col items-center justify-end gap-2">
                        <div className="rounded-full border border-white/10 bg-white/[.08] px-2 py-1 text-[10px] font-black text-white">{item.points}</div>
                        <div className="w-8 rounded-t-xl bg-gradient-to-t from-blue-600 via-cyan-400 to-emerald-300 shadow-[0_0_18px_rgba(34,211,238,.35)]" style={{ height }} />
                        <div className="text-center leading-tight"><p className="text-[10px] font-black text-white/75">{item.opponent}</p><p className="text-[9px] text-white/35">GW{item.gameweek || index + 1}</p></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[.045] p-4">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><TrendingUp className="h-5 w-5 text-violet-200" /> Value Trend</h3>
                  <div className="relative h-48 overflow-hidden rounded-2xl border border-white/10 bg-black/24 p-4">
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(59,130,246,.18),transparent)]" />
                    <svg viewBox="0 0 500 170" className="relative h-full w-full overflow-visible">
                      <polyline points="0,130 60,110 120,118 180,90 240,96 300,68 360,74 420,50 500,58" fill="none" stroke="rgba(56,189,248,.95)" strokeWidth="5" strokeLinecap="round" />
                      <polyline points="0,130 60,110 120,118 180,90 240,96 300,68 360,74 420,50 500,58" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
                    </svg>
                    <p className="absolute bottom-3 left-4 text-xs font-bold text-white/45">Market value placeholder until trade history is expanded</p>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[.045] p-4">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Activity className="h-5 w-5 text-emerald-200" /> Statistics</h3>
                  <div className="space-y-2">
                    <Stat icon={<CalendarDays className="h-4 w-4" />} label="Matches" value={data.stats.matchesPlayed} />
                    <Stat icon={<Activity className="h-4 w-4" />} label="Minutes" value={data.stats.minutes} />
                    <Stat icon={<Star className="h-4 w-4" />} label="Goals" value={data.stats.goals} />
                    <Stat icon={<Star className="h-4 w-4" />} label="Assists" value={data.stats.assists} />
                    <Stat icon={<Shield className="h-4 w-4" />} label="Clean sheets" value={data.stats.cleanSheets || 0} />
                    <Stat icon={<Activity className="h-4 w-4" />} label="Yellow cards" value={data.stats.yellowCards} />
                    <Stat icon={<Star className="h-4 w-4" />} label="Total points" value={data.stats.totalPoints} />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/22 px-3 py-2 text-sm"><span className="flex items-center gap-2 text-white/65">{icon}{label}</span><span className="font-black text-white">{value}</span></div>;
}

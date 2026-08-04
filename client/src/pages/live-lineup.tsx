import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CircleDot, Crown, Radio, ShieldCheck, Trophy } from "lucide-react";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { PremiumFootballCard } from "../components/cards";
import CardProfileModal from "../components/cards/CardProfileModal";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";

type LivePointEvent = {
  id: string;
  gameId: number;
  team: string;
  delta: number;
  reason: string;
  createdAt: string;
};

type LineupSlot = "GK" | "DEF" | "MID" | "FWD" | "UTIL";

const SLOT_ORDER: LineupSlot[] = ["GK", "DEF", "MID", "FWD", "UTIL"];

function normalizePosition(value: unknown): LineupSlot {
  const text = String(value || "").toUpperCase();
  if (text.includes("GK") || text.includes("GOAL")) return "GK";
  if (text.includes("DEF") || text.includes("CB") || text.includes("LB") || text.includes("RB")) return "DEF";
  if (text.includes("MID") || text.includes("CM") || text.includes("DM") || text.includes("AM")) return "MID";
  if (text.includes("FWD") || text.includes("ST") || text.includes("FW") || text.includes("ATT")) return "FWD";
  return "UTIL";
}

function buildSlots(cards: PlayerCardWithPlayer[]) {
  const slots: Record<LineupSlot, PlayerCardWithPlayer | null> = { GK: null, DEF: null, MID: null, FWD: null, UTIL: null };
  for (const card of cards) {
    const position = normalizePosition(card.player?.position);
    if (position !== "UTIL" && !slots[position]) slots[position] = card;
    else if (!slots.UTIL) slots.UTIL = card;
  }
  return slots;
}

function shortTeam(value: unknown) {
  return String(value || "FA").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "FA";
}

function statText(value: unknown, verified: boolean, decimals = 0) {
  if (!verified) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return decimals ? number.toFixed(decimals) : String(Math.round(number));
}

function SlotCard({
  label,
  card,
  captain,
  onInspect,
}: {
  label: LineupSlot;
  card: PlayerCardWithPlayer | null;
  captain: boolean;
  onInspect: (card: PlayerCardWithPlayer) => void;
}) {
  if (!card) {
    return (
      <div className="relative flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/20 p-4 text-center">
        <div className="absolute left-3 top-3 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1 text-[10px] font-black uppercase tracking-[.18em] text-slate-400">{label}</div>
        <CircleDot className="mb-3 h-9 w-9 text-slate-700" />
        <p className="font-black text-slate-400">Empty {label}</p>
        <p className="mt-1 text-xs text-slate-600">Choose this position in Collection.</p>
      </div>
    );
  }

  const data = toFantasyCardData(card, { imageWidth: 640 });
  const verified = Boolean(data.statsVerified);
  return (
    <div className="relative flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/20 p-3 backdrop-blur-sm">
      <div className="absolute left-3 top-3 z-20 rounded-full border border-slate-700 bg-slate-950/80 px-2 py-1 text-[10px] font-black uppercase tracking-[.18em] text-slate-300">{label}</div>
      {captain ? (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[.16em] text-amber-200">
          <Crown className="h-3 w-3" /> Captain
        </div>
      ) : null}
      <PremiumFootballCard player={data} size="sm" onClick={() => onInspect(card)} />
      <div className="mt-3 grid w-full grid-cols-4 gap-2 text-center">
        <Metric label="Team" value={shortTeam(data.team)} />
        <Metric label="Season PTS" value={statText(data.totalPoints, verified)} />
        <Metric label="Form" value={statText(data.form, verified, 1)} />
        <Metric label="A-OVR" value={statText(data.rating, verified)} />
      </div>
      <p className={`mt-3 text-center text-[10px] font-bold uppercase tracking-[.14em] ${verified ? "text-emerald-300" : "text-amber-200"}`}>
        {verified ? "Official stats • Arena OVR derived from FPL" : "Official statistics unavailable — no estimate shown"}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-2">
      <p className="text-[8px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

export default function LiveLineupPage() {
  const [selectedCard, setSelectedCard] = useState<PlayerCardWithPlayer | null>(null);
  const { data: lineupData, isLoading } = useQuery<{ lineup: Lineup; cards: PlayerCardWithPlayer[] }>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const res = await fetch("/api/lineup", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lineup");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: livePointEvents = [] } = useQuery<LivePointEvent[]>({
    queryKey: ["/api/live/point-feed?limit=40"],
    queryFn: async () => {
      const res = await fetch("/api/live/point-feed?limit=40", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 10_000,
  });

  const lineupCards = lineupData?.cards || [];
  const slots = useMemo(() => buildSlots(lineupCards), [lineupCards]);
  const rows = useMemo(() => lineupCards.map((card) => ({ card, data: toFantasyCardData(card, { imageWidth: 640 }) })), [lineupCards]);
  const verifiedRows = rows.filter((row) => row.data.statsVerified);
  const officialSeasonPoints = verifiedRows.reduce((sum, row) => sum + Number(row.data.totalPoints || 0), 0);
  const captainId = Number((lineupData?.lineup as any)?.captainId ?? (lineupData?.lineup as any)?.captain_id ?? 0);
  const teams = new Set(lineupCards.map((card) => String(card.player?.team || "").toLowerCase()).filter(Boolean));
  const relevantTeamEvents = livePointEvents
    .filter((event) => {
      const eventTeam = String(event.team || "").toLowerCase();
      return Array.from(teams).some((team) => team.includes(eventTeam) || eventTeam.includes(team) || shortTeam(team) === shortTeam(eventTeam));
    })
    .slice(0, 16);

  return (
    <main className="relative min-h-full overflow-x-hidden bg-[#07111f] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_10%,rgba(34,197,94,.14),transparent_30%),radial-gradient(circle_at_78%_8%,rgba(37,99,235,.16),transparent_30%),linear-gradient(180deg,#07111f_0%,#050812_100%)]" />
      <div className="relative mx-auto max-w-[1500px] space-y-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.24em] text-emerald-300/70">Matchday Control</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Live Lineup</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">Official season statistics are shown on player cards. Team-feed events remain separate and are never assigned to an individual player without a verified player event.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-200">
            <Radio className="h-4 w-4" /> Team feed live
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Lineup" value={`${lineupCards.length}/5`} helper="Selected cards" icon={Trophy} />
          <Summary label="Verified Cards" value={`${verifiedRows.length}/${lineupCards.length}`} helper="Provider linked" icon={ShieldCheck} />
          <Summary label="Official Season PTS" value={verifiedRows.length ? String(Math.round(officialSeasonPoints)) : "—"} helper="No reconstructed totals" icon={Activity} />
          <Summary label="Team Events" value={String(relevantTeamEvents.length)} helper="Not player-attributed" icon={Radio} />
        </section>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {SLOT_ORDER.map((slot) => <Skeleton key={slot} className="h-[300px] rounded-3xl bg-slate-800" />)}
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {SLOT_ORDER.map((slot) => {
              const card = slots[slot];
              return <SlotCard key={slot} label={slot} card={card} captain={Boolean(card && Number(card.id) === captainId)} onInspect={setSelectedCard} />;
            })}
          </section>
        )}

        <section className="grid gap-5 xl:grid-cols-[1fr_.72fr]">
          <Card className="rounded-3xl border-slate-800 bg-slate-950/60 p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black">Relevant Team Feed</h2>
                <p className="mt-1 text-sm text-slate-500">Raw team-level updates for clubs represented in your lineup. These values are not added to player or lineup totals.</p>
              </div>
              <Radio className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="mt-4 space-y-2">
              {relevantTeamEvents.length ? relevantTeamEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-black/25 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-black">{event.team || "Premier League"}</p>
                    <p className="truncate text-xs text-slate-500">{event.reason || "Official live update"}</p>
                  </div>
                  <div className="text-right">
                    <p className={Number(event.delta || 0) >= 0 ? "font-black text-emerald-300" : "font-black text-red-300"}>{Number(event.delta || 0) >= 0 ? `+${Number(event.delta || 0)}` : Number(event.delta || 0)}</p>
                    <p className="text-[9px] uppercase tracking-wide text-slate-600">Team feed</p>
                  </div>
                </div>
              )) : <div className="rounded-2xl border border-slate-800 bg-black/25 p-8 text-center text-slate-500">No relevant official team events are available right now.</div>}
            </div>
          </Card>

          <Card className="rounded-3xl border-slate-800 bg-slate-950/60 p-5 text-white">
            <h2 className="text-lg font-black">Accuracy Guard</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"><b className="text-emerald-200">Player cards:</b> official provider-linked identity, season points and form. Arena OVR is derived from verified FPL inputs.</div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4"><b className="text-amber-200">Unavailable data:</b> displayed as a dash rather than estimated from card rarity, stored decisive score or team events.</div>
              <div className="rounded-2xl border border-slate-800 bg-black/25 p-4">Click a player card to view its full verified profile, providers and match history.</div>
            </div>
          </Card>
        </section>
      </div>
      {selectedCard ? <CardProfileModal card={selectedCard} onClose={() => setSelectedCard(null)} /> : null}
    </main>
  );
}

function Summary({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof Activity }) {
  return (
    <Card className="rounded-2xl border-slate-800 bg-slate-950/65 p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{helper}</p></div>
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><Icon className="h-5 w-5" /></div>
      </div>
    </Card>
  );
}
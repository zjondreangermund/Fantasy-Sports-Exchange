import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ArrowDown, ArrowUp, Radio, Swords } from "lucide-react";
import { type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";

type LivePointEvent = {
  id: string;
  gameId: number;
  team: string;
  delta: number;
  reason: string;
  createdAt: string;
};

function shortTeam(value: unknown) {
  return String(value || "FA").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "FA";
}

function eventMatchesCard(event: LivePointEvent, card: PlayerCardWithPlayer) {
  const team = String(card.player?.team || "").toLowerCase();
  const eventTeam = String(event.team || "").toLowerCase();
  return Boolean(team && eventTeam && (team.includes(eventTeam) || eventTeam.includes(team) || shortTeam(team).toLowerCase() === shortTeam(eventTeam).toLowerCase()));
}

export default function MatchdayQuickDock() {
  const { data: lineupData } = useQuery<{ lineup: Lineup; cards: PlayerCardWithPlayer[] }>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const res = await fetch("/api/lineup", { credentials: "include" });
      if (!res.ok) return { lineup: {} as Lineup, cards: [] };
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: livePointEvents } = useQuery<LivePointEvent[]>({
    queryKey: ["/api/live/point-feed?limit=20"],
    queryFn: async () => {
      const res = await fetch("/api/live/point-feed?limit=20", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 7000,
  });

  const cards = lineupData?.cards || [];
  const events = livePointEvents || [];
  const linkedEvents = useMemo(() => events.filter((event) => cards.some((card) => eventMatchesCard(event, card))), [cards, events]);
  const liveDelta = useMemo(() => linkedEvents.reduce((sum, event) => sum + Number(event.delta || 0), 0), [linkedEvents]);

  if (!cards.length && !linkedEvents.length) return null;

  const positive = liveDelta >= 0;
  const DeltaIcon = positive ? ArrowUp : ArrowDown;

  return (
    <Link href="/collection?editLineup=1">
      <div className="fixed bottom-4 left-1/2 z-[60] hidden -translate-x-1/2 cursor-pointer items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/92 px-3 py-2 text-white shadow-[0_18px_60px_rgba(0,0,0,.45)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/50 md:bottom-5 md:flex md:px-4 md:py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200"><Radio className="h-4 w-4" /></div>
        <div className="hidden min-w-[120px] md:block"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Matchday</p><p className="text-sm font-black text-white">Edit Lineup</p></div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-black/30 px-2 py-1.5"><Swords className="h-3.5 w-3.5 text-slate-400" /><span className="text-xs font-black">{cards.length}/5</span></div>
        <div className={positive ? "flex items-center gap-1 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-2 py-1.5 text-emerald-300" : "flex items-center gap-1 rounded-xl border border-red-400/25 bg-red-400/10 px-2 py-1.5 text-red-300"}><DeltaIcon className="h-3.5 w-3.5" /><span className="text-xs font-black">{positive ? `+${liveDelta}` : liveDelta}</span></div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-black/30 px-2 py-1.5 text-slate-300"><Activity className="h-3.5 w-3.5 text-yellow-300" /><span className="text-xs font-black">{linkedEvents.length}</span></div>
      </div>
    </Link>
  );
}

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ChevronRight, ShieldCheck, Trophy, UsersRound } from "lucide-react";
import CardPlayerImage from "../CardPlayerImage";
import type { CompetitionEntry, PlayerCardWithPlayer } from "../../../../shared/schema";

type Tournament = any;
type RarityKey = "common" | "rare" | "unique" | "epic" | "legendary";

const rarityTone: Record<RarityKey, { text: string; border: string; soft: string; glow: string }> = {
  common: { text: "text-slate-100", border: "border-slate-200/25", soft: "bg-slate-200/[.055]", glow: "shadow-[0_0_18px_rgba(226,232,240,.08)]" },
  rare: { text: "text-sky-200", border: "border-sky-300/30", soft: "bg-sky-400/[.065]", glow: "shadow-[0_0_20px_rgba(56,189,248,.12)]" },
  unique: { text: "text-violet-200", border: "border-violet-300/30", soft: "bg-violet-400/[.07]", glow: "shadow-[0_0_20px_rgba(168,85,247,.13)]" },
  epic: { text: "text-rose-200", border: "border-rose-300/30", soft: "bg-rose-400/[.065]", glow: "shadow-[0_0_20px_rgba(244,63,94,.12)]" },
  legendary: { text: "text-amber-200", border: "border-amber-300/35", soft: "bg-amber-300/[.07]", glow: "shadow-[0_0_22px_rgba(251,191,36,.13)]" },
};

function listFrom<T>(value: unknown, keys: string[] = []): T[] {
  const data: any = value;
  if (Array.isArray(data)) return data as T[];
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key] as T[];
  return [];
}

function toneFor(value: unknown) {
  const key = String(value || "common").toLowerCase() as RarityKey;
  return rarityTone[key] || rarityTone.common;
}

function competitionId(entry: CompetitionEntry) {
  return Number((entry as any).competitionId ?? (entry as any).competition_id ?? 0);
}

function points(card: PlayerCardWithPlayer) {
  return Number((card as any).currentGameweekPoints ?? (card as any).gameweekPoints ?? 0);
}

export default function NativeSquadPage() {
  const { data: lineupRaw, isLoading } = useQuery<any>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const response = await fetch("/api/lineup", { credentials: "include" });
      if (!response.ok) return { cards: [] };
      return response.json();
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
  });
  const { data: entriesRaw } = useQuery<any>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const response = await fetch("/api/competitions/my-entries", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
  });
  const { data: competitionsRaw } = useQuery<any>({
    queryKey: ["/api/competitions"],
    queryFn: async () => {
      const response = await fetch("/api/competitions", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    staleTime: 30_000,
  });

  const cards = React.useMemo(() => listFrom<PlayerCardWithPlayer>(lineupRaw, ["cards", "lineup", "items"]), [lineupRaw]);
  const entries = React.useMemo(() => listFrom<CompetitionEntry>(entriesRaw, ["entries", "items"]), [entriesRaw]);
  const competitions = React.useMemo(() => listFrom<Tournament>(competitionsRaw, ["competitions", "items"]), [competitionsRaw]);
  const score = cards.reduce((total, card) => total + points(card), 0);
  const competitionById = React.useMemo(() => new Map(competitions.map((item) => [Number(item.id), item])), [competitions]);
  const activeEntries = React.useMemo(() => entries
    .map((entry) => ({ entry, competition: competitionById.get(competitionId(entry)) }))
    .filter((row) => row.competition && !["completed", "cancelled", "closed"].includes(String(row.competition.status || "").toLowerCase()))
    .slice(0, 5), [competitionById, entries]);

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-3 pb-4 pt-3" data-native-squad>
      <section className="overflow-hidden rounded-[1.55rem] border border-cyan-300/10 bg-gradient-to-br from-cyan-300/[.09] via-[#0a0e1c] to-violet-400/[.08] p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Matchday five</p><h2 className="mt-1 text-2xl font-black">Your squad at a glance</h2><p className="mt-1 text-xs leading-5 text-slate-400">Five cards, one captain and real Premier League performances. No oversized cards, just the information you need.</p></div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><UsersRound className="h-5 w-5" /></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label="Cards" value={`${cards.length}/5`} />
          <Metric label="Live PTS" value={score.toFixed(2)} />
          <Metric label="Entries" value={String(activeEntries.length)} />
        </div>
      </section>

      <section className="rounded-[1.45rem] border border-white/[.08] bg-white/[.03] p-3.5">
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-black">Current five</h3></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${cards.length === 5 ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{cards.length === 5 ? "READY" : "INCOMPLETE"}</span></div>
        {isLoading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/[.035]" />)}</div> : cards.length ? <div className="space-y-2">{cards.slice(0, 5).map((card, index) => <SquadRow key={card.id} card={card} index={index} />)}</div> : <div className="rounded-2xl border border-dashed border-white/[.08] p-6 text-center"><ShieldCheck className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-2 text-sm font-black">No active five-card squad</p><p className="mt-1 text-xs text-slate-500">Enter a tournament and your submitted team will appear here.</p><Link href="/competitions" className="mt-3 inline-flex rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950">Find a Cup</Link></div>}
        <Link href="/live-lineup?nativeFull=1" className="mt-3 flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.025] px-3.5 py-3 text-xs font-bold text-slate-400"><span>Detailed lineup & scoring view</span><ChevronRight className="h-4 w-4" /></Link>
      </section>

      <section className="rounded-[1.45rem] border border-white/[.08] bg-white/[.03] p-3.5">
        <div className="mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-300" /><h3 className="text-sm font-black">My active entries</h3></div>
        {activeEntries.length ? <div className="space-y-2">{activeEntries.map(({ entry, competition }) => {
          const tone = toneFor(competition.tier);
          return <div key={(entry as any).id} className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border ${tone.border} ${tone.soft} p-3 ${tone.glow}`}><span className={`absolute inset-y-3 left-0 w-0.5 rounded-full ${tone.text.replace("text-", "bg-")}`} /><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${tone.border} ${tone.soft} ${tone.text}`}><Trophy className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{competition.name}</p><p className={`mt-0.5 text-[9px] font-black uppercase tracking-[.1em] ${tone.text}`}>GW{competition.gameWeek || competition.game_week || "-"} · {String(competition.tier || "common").toUpperCase()}</p></div><span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[9px] font-black text-emerald-200">LIVE</span></div>;
        })}</div> : <p className="rounded-2xl border border-dashed border-white/[.07] p-4 text-center text-xs text-slate-500">No live entries yet.</p>}
        <Link href="/competitions" className="mt-3 flex items-center justify-between rounded-2xl bg-violet-300/[.06] px-3.5 py-3 text-xs font-black text-violet-100"><span>Enter another tournament</span><ChevronRight className="h-4 w-4" /></Link>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/[.06] bg-black/20 p-2.5"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-1 truncate text-sm font-black">{value}</p></div>;
}

function SquadRow({ card, index }: { card: PlayerCardWithPlayer; index: number }) {
  const position = String(card.player?.position || ["GK", "DEF", "MID", "FWD", "UTIL"][index] || "-").toUpperCase();
  const tone = toneFor(card.rarity);
  return <div className={`flex items-center gap-3 rounded-2xl border ${tone.border} bg-black/15 p-2.5`}><div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-900"><CardPlayerImage card={card} alt={card.player?.name || "Player"} className="h-full w-full object-cover object-top" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`rounded-md px-1.5 py-0.5 text-[8px] font-black ${tone.soft} ${tone.text}`}>{position}</span><p className="truncate text-sm font-black">{card.player?.name || "Player"}</p></div><p className="mt-1 truncate text-[10px] text-slate-500">{card.player?.team || "Premier League"} · {String(card.rarity || "common").toUpperCase()}</p></div><div className="text-right"><p className="text-sm font-black text-cyan-100">{points(card).toFixed(2)}</p><p className="text-[8px] font-black uppercase tracking-[.12em] text-slate-600">PTS</p></div></div>;
}
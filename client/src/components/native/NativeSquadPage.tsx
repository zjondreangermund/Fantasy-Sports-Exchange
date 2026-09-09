import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ChevronRight, Trophy, UsersRound } from "lucide-react";
import TournamentEntryTeamCard from "../tournaments/TournamentEntryTeamCard";
import type { CompetitionEntry } from "../../../../shared/schema";

type Tournament = any;

function listFrom<T>(value: unknown, keys: string[] = []): T[] {
  const data: any = value;
  if (Array.isArray(data)) return data as T[];
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key] as T[];
  return [];
}

function competitionId(entry: CompetitionEntry) {
  return Number((entry as any).competitionId ?? (entry as any).competition_id ?? 0);
}

function entryPoints(entry: CompetitionEntry) {
  return Number((entry as any).totalScore ?? (entry as any).total_score ?? 0);
}

function entryId(entry: CompetitionEntry) {
  return Number((entry as any).id || 0);
}

function isFinished(competition: Tournament | undefined) {
  return ["completed", "cancelled"].includes(String(competition?.status || "").toLowerCase());
}

export default function NativeSquadPage() {
  const { data: entriesRaw, isLoading: entriesLoading } = useQuery<any>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const response = await fetch("/api/competitions/my-entries", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const { data: competitionsRaw, isLoading: competitionsLoading } = useQuery<any>({
    queryKey: ["/api/competitions"],
    queryFn: async () => {
      const response = await fetch("/api/competitions", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const entries = React.useMemo(() => listFrom<CompetitionEntry>(entriesRaw, ["entries", "items"]), [entriesRaw]);
  const competitions = React.useMemo(() => listFrom<Tournament>(competitionsRaw, ["competitions", "items"]), [competitionsRaw]);
  const competitionById = React.useMemo(() => new Map(competitions.map((item) => [Number(item.id), item])), [competitions]);
  const enteredTeams = React.useMemo(() => entries
    .map((entry) => ({ entry, competition: competitionById.get(competitionId(entry)) }))
    .filter((row) => Boolean(row.competition))
    .sort((a, b) => {
      const activeDiff = Number(isFinished(a.competition)) - Number(isFinished(b.competition));
      return activeDiff || entryId(b.entry) - entryId(a.entry);
    }), [competitionById, entries]);
  const activeTeams = enteredTeams.filter((row) => !isFinished(row.competition));
  const finishedTeams = enteredTeams.filter((row) => isFinished(row.competition));
  const totalPoints = entries.reduce((sum, entry) => sum + entryPoints(entry), 0);
  const loading = entriesLoading || competitionsLoading;

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-3 pb-4 pt-3" data-native-squad>
      <section className="overflow-hidden rounded-[1.55rem] border border-cyan-300/10 bg-gradient-to-br from-cyan-300/[.09] via-[#0a0e1c] to-violet-400/[.08] p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Tournament squads</p><h2 className="mt-1 text-2xl font-black">Your entered teams</h2><p className="mt-1 text-xs leading-5 text-slate-400">Every submitted five-card team is tied to the tournament it entered. Live scores and captain contributions stay with that exact entry.</p></div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><UsersRound className="h-5 w-5" /></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label="Teams" value={String(enteredTeams.length)} />
          <Metric label="Active" value={String(activeTeams.length)} />
          <Metric label="Total PTS" value={totalPoints.toFixed(2)} />
        </div>
      </section>

      <section className="rounded-[1.45rem] border border-white/[.08] bg-white/[.03] p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-black">Entered tournament teams</h3></div><span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black text-cyan-200">{activeTeams.length} ACTIVE</span></div>
        {loading ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-white/[.035]" />)}</div>
          : activeTeams.length ? <div className="space-y-3">{activeTeams.map(({ entry, competition }) => <TournamentEntryTeamCard key={entryId(entry)} entry={entry} competition={competition} compact />)}</div>
            : <div className="rounded-2xl border border-dashed border-white/[.08] p-6 text-center"><Trophy className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-2 text-sm font-black">No active tournament teams</p><p className="mt-1 text-xs text-slate-500">Enter a tournament and the exact submitted lineup will appear here.</p><Link href="/competitions" className="mt-3 inline-flex rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950">Find a Cup</Link></div>}
        <Link href="/live-lineup?nativeFull=1" className="mt-3 flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.025] px-3.5 py-3 text-xs font-bold text-slate-400"><span>Full entered-team & scoring view</span><ChevronRight className="h-4 w-4" /></Link>
      </section>

      {finishedTeams.length ? <section className="rounded-[1.45rem] border border-white/[.08] bg-white/[.03] p-3.5">
        <div className="mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-slate-400" /><h3 className="text-sm font-black">Completed tournament teams</h3></div>
        <div className="space-y-3">{finishedTeams.map(({ entry, competition }) => <TournamentEntryTeamCard key={entryId(entry)} entry={entry} competition={competition} compact />)}</div>
      </section> : null}

      <Link href="/competitions" className="flex items-center justify-between rounded-[1.35rem] bg-violet-300/[.07] px-4 py-3.5 text-xs font-black text-violet-100"><span>Enter another tournament</span><ChevronRight className="h-4 w-4" /></Link>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/[.06] bg-black/20 p-2.5"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-1 truncate text-sm font-black">{value}</p></div>;
}

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, AlertTriangle, CalendarDays, ChevronRight, Shield, Trophy } from "lucide-react";

function arrayFrom(value: any, keys: string[] = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function teamName(value: any, fallback: string) {
  if (typeof value === "string") return value;
  return String(value?.name || value?.team?.name || fallback);
}

function normalizeFixture(item: any) {
  const home = item?.homeTeam ?? item?.home ?? item?.teams?.home;
  const away = item?.awayTeam ?? item?.away ?? item?.teams?.away;
  return {
    ...item,
    homeName: teamName(home, "Home"),
    awayName: teamName(away, "Away"),
    homeGoals: item?.homeGoals ?? home?.score ?? item?.goals?.home ?? null,
    awayGoals: item?.awayGoals ?? away?.score ?? item?.goals?.away ?? null,
    kickoff: item?.matchDate || item?.kickoffTime || item?.date || item?.fixture?.date || null,
    statusText: String(item?.status?.short || item?.status || item?.fixture?.status?.short || (item?.started ? "LIVE" : item?.finished ? "FT" : "NS")),
  };
}

function timeLabel(value: unknown) {
  if (!value) return "TBD";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "TBD";
  return date.toLocaleString("en-NA", { timeZone: "Africa/Windhoek", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function initials(name: string) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : String(words[0] || "FA").slice(0, 2).toUpperCase();
}

type Tab = "matches" | "table" | "injuries";

export default function NativePremierLeaguePage() {
  const [tab, setTab] = React.useState<Tab>("matches");
  const { data: liveRaw } = useQuery<any>({
    queryKey: ["/api/epl/live-games"],
    queryFn: async () => {
      const response = await fetch("/api/epl/live-games", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    refetchInterval: 30_000,
  });
  const { data: fixturesRaw, isLoading: fixturesLoading } = useQuery<any>({
    queryKey: ["/api/epl/fixtures", "upcoming"],
    queryFn: async () => {
      const response = await fetch("/api/epl/fixtures?status=upcoming", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: standingsRaw, isLoading: standingsLoading } = useQuery<any>({
    queryKey: ["/api/epl/standings"],
    queryFn: async () => {
      const response = await fetch("/api/epl/standings", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 60_000,
  });
  const { data: injuriesRaw } = useQuery<any>({
    queryKey: ["/api/epl/injuries"],
    queryFn: async () => {
      const response = await fetch("/api/epl/injuries", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 60_000,
  });

  const live = React.useMemo(() => arrayFrom(liveRaw, ["games", "fixtures", "response"]).map(normalizeFixture), [liveRaw]);
  const fixtures = React.useMemo(() => arrayFrom(fixturesRaw, ["fixtures", "response"]).map(normalizeFixture), [fixturesRaw]);
  const standings = React.useMemo(() => arrayFrom(standingsRaw, ["standings", "response"]), [standingsRaw]);
  const injuries = React.useMemo(() => arrayFrom(injuriesRaw, ["injuries", "response"]), [injuriesRaw]);
  const matchRows = live.length ? live : fixtures;

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-premier-league>
      <section className="overflow-hidden rounded-[1.55rem] border border-indigo-300/15 bg-[radial-gradient(circle_at_90%_0%,rgba(99,102,241,.2),transparent_34%),linear-gradient(145deg,#0a0e20,#070916)] p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-indigo-200/70">Premier League</p><h2 className="mt-1 text-2xl font-black">Matchday at a glance.</h2><p className="mt-1 text-xs leading-5 text-slate-400">Fixtures, table and availability without the giant desktop data screens.</p></div><div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/8 bg-white/[.045] text-indigo-200"><Trophy className="h-5 w-5" />{live.length ? <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-[#0a0e20] bg-red-500" /> : null}</div></div>
        <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-black/20 p-2.5 text-center"><p className="text-[9px] font-black uppercase text-slate-600">Live</p><p className="mt-1 text-base font-black text-red-200">{live.length}</p></div><div className="rounded-2xl bg-black/20 p-2.5 text-center"><p className="text-[9px] font-black uppercase text-slate-600">Next matches</p><p className="mt-1 text-base font-black">{fixtures.length}</p></div><div className="rounded-2xl bg-black/20 p-2.5 text-center"><p className="text-[9px] font-black uppercase text-slate-600">Injuries</p><p className="mt-1 text-base font-black text-amber-100">{injuries.length}</p></div></div>
      </section>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/[.06] bg-black/20 p-1">
        <button onClick={() => setTab("matches")} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${tab === "matches" ? "bg-white/[.08] text-white" : "text-slate-600"}`}><CalendarDays className="mx-auto mb-1 h-4 w-4" />Matches</button>
        <button onClick={() => setTab("table")} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${tab === "table" ? "bg-white/[.08] text-white" : "text-slate-600"}`}><Trophy className="mx-auto mb-1 h-4 w-4" />Table</button>
        <button onClick={() => setTab("injuries")} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${tab === "injuries" ? "bg-white/[.08] text-white" : "text-slate-600"}`}><AlertTriangle className="mx-auto mb-1 h-4 w-4" />Injuries</button>
      </div>

      {tab === "matches" ? <div className="mt-3 space-y-2">
        {fixturesLoading && !matchRows.length ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl border border-white/6 bg-white/[.025]" />) : null}
        {matchRows.slice(0, 6).map((match: any, index: number) => {
          const isLive = ["LIVE", "1H", "2H", "HT"].includes(String(match.statusText).toUpperCase());
          const hasScore = match.homeGoals !== null || match.awayGoals !== null;
          return <div key={match.id || `${match.homeName}-${match.awayName}-${index}`} className={`rounded-2xl border p-3 ${isLive ? "border-red-300/20 bg-red-400/[.055]" : "border-white/[.07] bg-white/[.03]"}`}><div className="mb-3 flex items-center justify-between gap-2"><span className={`text-[9px] font-black uppercase tracking-[.13em] ${isLive ? "text-red-200" : "text-slate-600"}`}>{isLive ? "● LIVE" : timeLabel(match.kickoff)}</span><span className="rounded-full bg-white/[.05] px-2 py-1 text-[9px] font-black text-slate-500">{String(match.statusText || "NS")}</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="min-w-0 text-center"><div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-white/[.055] text-[10px] font-black text-slate-300">{initials(match.homeName)}</div><p className="mt-1.5 truncate text-xs font-black">{match.homeName}</p></div><div className="min-w-12 text-center"><p className="text-xl font-black">{hasScore ? `${match.homeGoals ?? 0}–${match.awayGoals ?? 0}` : "VS"}</p></div><div className="min-w-0 text-center"><div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-white/[.055] text-[10px] font-black text-slate-300">{initials(match.awayName)}</div><p className="mt-1.5 truncate text-xs font-black">{match.awayName}</p></div></div></div>;
        })}
        {!fixturesLoading && !matchRows.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No Premier League match data is available right now.</div> : null}
      </div> : null}

      {tab === "table" ? <div className="mt-3 overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.03]">
        <div className="grid grid-cols-[32px_1fr_34px_40px] gap-2 border-b border-white/[.06] px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-slate-600"><span>#</span><span>Club</span><span className="text-center">P</span><span className="text-right">Pts</span></div>
        {standingsLoading ? <div className="h-64 animate-pulse bg-white/[.02]" /> : standings.slice(0, 10).map((row: any, index: number) => { const rank = Number(row.rank ?? row.position ?? index + 1); const name = String(row.team?.name || row.teamName || row.name || "Club"); return <div key={row.teamId || row.team?.id || `${name}-${rank}`} className="grid grid-cols-[32px_1fr_34px_40px] items-center gap-2 border-b border-white/[.045] px-3 py-2.5 last:border-b-0"><span className={`text-xs font-black ${rank <= 4 ? "text-cyan-200" : rank >= 18 ? "text-red-200" : "text-slate-500"}`}>{rank}</span><div className="flex min-w-0 items-center gap-2"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[.05] text-[8px] font-black text-slate-400">{initials(name)}</div><span className="truncate text-xs font-black">{name}</span></div><span className="text-center text-xs text-slate-500">{Number(row.played ?? row.all?.played ?? 0)}</span><span className="text-right text-sm font-black">{Number(row.points ?? row.pts ?? 0)}</span></div>; })}
      </div> : null}

      {tab === "injuries" ? <div className="mt-3 space-y-2">
        {injuries.slice(0, 8).map((row: any, index: number) => { const player = String(row.player?.name || row.playerName || row.name || "Player"); const club = String(row.team?.name || row.teamName || row.team || "Premier League"); const reason = String(row.reason || row.type || row.description || "Unavailable"); return <div key={row.id || row.player?.id || `${player}-${index}`} className="flex items-center gap-3 rounded-2xl border border-amber-300/10 bg-amber-300/[.035] p-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-100"><Shield className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{player}</p><p className="mt-0.5 truncate text-[10px] text-slate-600">{club} · {reason}</p></div></div>; })}
        {!injuries.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No injury list is available right now.</div> : null}
      </div> : null}

      <Link href="/premier-league?nativeFull=1"><button className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.03] p-3 text-left"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-300/10 text-indigo-200"><Activity className="h-4 w-4" /></div><div><p className="text-xs font-black">Full Premier League centre</p><p className="mt-0.5 text-[10px] text-slate-500">Players, deeper stats and complete league tables.</p></div></div><ChevronRight className="h-4 w-4 text-slate-600" /></button></Link>
    </div>
  );
}

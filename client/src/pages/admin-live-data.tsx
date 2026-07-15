import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, CheckCircle2, Clock3, Database, History, Play, RefreshCw, Search, ServerCog, ShieldCheck, Table2, XCircle } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";

function currentSeason() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function fmtDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not yet";
}

const syncJobs = [
  { key: "fixtures", label: "Sync Fixtures", description: "Imports upcoming and recent Premier League fixtures." },
  { key: "live", label: "Sync Live Matches", description: "Checks live matches only when a stored fixture is inside a match window." },
  { key: "completed_stats", label: "Import Completed Stats", description: "Imports player statistics once for finished matches." },
  { key: "standings", label: "Sync Standings", description: "Refreshes the current Premier League table." },
  { key: "teams", label: "Sync Teams & Logos", description: "Refreshes team details through the fixture feed." },
] as const;

export default function AdminLiveDataPage() {
  const { toast } = useToast();
  const [season, setSeason] = useState(currentSeason());
  const [date, setDate] = useState("");
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  const [fixtureQueryEnabled, setFixtureQueryEnabled] = useState(false);

  const syncCentre = useQuery<any>({ queryKey: ["/api/admin/live-data/sync-centre"], refetchInterval: 30_000 });
  const status = useQuery<any>({ queryKey: ["/api/admin/live-data/status"], refetchInterval: 60_000 });
  const fixtureUrl = `/api/admin/live-data/fixtures?season=${season}${date ? `&date=${encodeURIComponent(date)}` : ""}`;
  const fixtures = useQuery<any>({ queryKey: [fixtureUrl], enabled: fixtureQueryEnabled, staleTime: 5 * 60_000 });
  const playersUrl = selectedFixtureId ? `/api/admin/live-data/fixture/${selectedFixtureId}/players` : "";
  const players = useQuery<any>({ queryKey: [playersUrl], enabled: Boolean(selectedFixtureId), staleTime: 15 * 60_000 });

  const syncMutation = useMutation({
    mutationFn: async (jobType: string) => {
      const response = await fetch(`/api/admin/live-data/sync/${jobType}`, { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Sync failed");
      return data;
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/live-data/sync-centre"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/live-data/status"] }),
      ]);
      toast({ title: "Sync complete", description: data?.message || data?.result?.message || "Database updated." });
    },
    onError: (error: any) => toast({ title: "Sync failed", description: error?.message || "Please check the sync history.", variant: "destructive" }),
  });

  const fixtureRows = asArray(fixtures.data?.fixtures);
  const selectedFixture = useMemo(() => fixtureRows.find((row: any) => Number(row?.fixture?.id) === selectedFixtureId), [fixtureRows, selectedFixtureId]);
  const teams = asArray(players.data?.teams);
  const summary = syncCentre.data || {};
  const usage = summary.budget || status.data?.budget || {};
  const counts = summary.counts || {};
  const schedule = summary.schedule || {};
  const history = asArray(summary.lastRuns);
  const used = Number(usage.used || 0);
  const cap = Number(usage.cap || 90);
  const remaining = Number(usage.remaining ?? Math.max(0, cap - used));
  const usagePercent = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  return (
    <main className="min-h-full overflow-x-hidden bg-slate-950 px-3 pb-32 pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(6,182,212,.16),rgba(37,99,235,.12),rgba(2,6,23,.96))] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-emerald-100"><ShieldCheck className="h-3.5 w-3.5" />Database-first production mode</div>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">API-Football Sync Centre</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">API-Football feeds the background sync service. Fantasy Arena pages read stored database records instead of consuming a provider request whenever a user opens a page.</p>
            </div>
            <Button onClick={() => { syncCentre.refetch(); status.refetch(); }} variant="outline" className="border-white/15 bg-white/5 text-white"><RefreshCw className="mr-2 h-4 w-4" />Refresh dashboard</Button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Configured" value={summary.configured ?? status.data?.configured ? "Yes" : "No"} good={Boolean(summary.configured ?? status.data?.configured)} />
          <Metric label="Connected" value={status.data?.connected ? "Online" : "Not checked"} good={Boolean(status.data?.connected)} />
          <Metric label="League / Season" value={`${summary.leagueId || status.data?.leagueId || 39} / ${summary.season || season}`} good />
          <Metric label="Used today" value={`${used}/${cap}`} good={remaining > 10} />
          <Metric label="Safe requests left" value={remaining} good={remaining > 0} />
        </section>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-bold">Daily API safety budget</span><span className="text-white/45">Resets at 00:00 UTC • database reads use no provider calls</span></div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/40"><div className={`h-full rounded-full ${usagePercent >= 90 ? "bg-red-400" : usagePercent >= 70 ? "bg-amber-300" : "bg-emerald-300"}`} style={{ width: `${usagePercent}%` }} /></div>
          <div className="mt-2 flex justify-between text-xs text-white/45"><span>{used} provider calls used</span><span>{remaining} available within the {cap}-request cap</span></div>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DatabaseMetric icon={CalendarDays} label="Fixtures stored" value={counts.fixtures || 0} />
          <DatabaseMetric icon={ServerCog} label="Teams stored" value={counts.teams || 0} />
          <DatabaseMetric icon={Activity} label="Player stat rows" value={counts.playerStats || 0} />
          <DatabaseMetric icon={Table2} label="Standing rows" value={counts.standings || 0} />
        </section>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex items-center gap-2 text-xl font-black"><Clock3 className="h-5 w-5 text-cyan-200" />Automatic schedule</div><p className="mt-1 text-sm text-white/45">Existing scheduler settings from the backend sync service.</p></div>
            <Badge className="bg-emerald-500/20 text-emerald-100">Scheduler active</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><Info label="Fixture interval" value={`Every ${schedule.fixtureSyncHours || 6} hours`} /><Info label="Live polling" value={`Every ${schedule.livePollMinutes || 15} minutes when needed`} /><Info label="Next fixture sync" value={fmtDate(schedule.nextFixtureSync)} /></div>
        </Card>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex items-center gap-2 text-xl font-black"><Play className="h-5 w-5 text-purple-200" />Manual sync controls</div>
          <p className="mt-1 text-sm text-white/45">These use the existing sync jobs. They do not create new systems or duplicate data.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {syncJobs.map((job) => <button key={job.key} onClick={() => syncMutation.mutate(job.key)} disabled={syncMutation.isPending || remaining <= 0} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/5 disabled:opacity-50"><div className="font-black">{job.label}</div><div className="mt-2 text-xs leading-5 text-white/40">{job.description}</div></button>)}
          </div>
        </Card>

        {status.isError && <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{(status.error as Error)?.message || "Connection failed"}</div>}

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex items-center gap-2 text-xl font-black"><History className="h-5 w-5 text-amber-200" />Sync history</div>
          <div className="mt-4 space-y-2">
            {history.length ? history.map((run: any) => <div key={run.id} className="grid gap-2 rounded-xl border border-white/10 bg-black/25 p-3 text-sm sm:grid-cols-[150px_100px_1fr_130px]"><div><div className="font-bold capitalize">{String(run.jobType || "sync").replace(/_/g, " ")}</div><div className="text-xs text-white/35">{fmtDate(run.startedAt)}</div></div><div><StatusBadge status={run.status} /></div><div className="min-w-0 text-white/50">{run.message || "No message"}</div><div className="text-xs text-white/40">{Number(run.recordsProcessed || 0)} records • {Number(run.providerCalls || 0)} calls</div></div>) : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/40">No sync history yet. The first scheduled or manual sync will appear here.</div>}
          </div>
        </Card>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xl font-black"><CalendarDays className="h-5 w-5 text-cyan-200" />Provider preview tools</div>{fixtures.data && <Badge className={fixtures.data?.cached ? "bg-emerald-500/20 text-emerald-100" : "bg-cyan-500/20 text-cyan-100"}>{fixtures.data?.cached ? "Served from cache" : "Fresh provider data"}</Badge>}</div>
          <p className="mt-1 text-sm text-white/45">Kept for admin verification. This does not replace the database sync pipeline.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_220px_auto]">
            <label className="text-xs text-white/55">Season<Input type="number" value={season} onChange={(e) => setSeason(Number(e.target.value) || currentSeason())} className="mt-1 border-white/10 bg-black/35" /></label>
            <label className="text-xs text-white/55">Date (optional)<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 border-white/10 bg-black/35" /></label>
            <div className="flex items-end"><Button onClick={() => { setFixtureQueryEnabled(true); setSelectedFixtureId(null); setTimeout(() => fixtures.refetch(), 0); }} disabled={!status.data?.connected || fixtures.isFetching || remaining <= 0} className="min-h-10 w-full bg-cyan-300 font-black text-slate-950"><Search className="mr-2 h-4 w-4" />{fixtures.isFetching ? "Loading fixtures…" : "Preview fixtures"}</Button></div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{fixtureRows.map((row: any) => { const id = Number(row?.fixture?.id || 0); const home = row?.teams?.home; const away = row?.teams?.away; const active = selectedFixtureId === id; return <button key={id} onClick={() => setSelectedFixtureId(id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25 hover:border-white/25"}`}><div className="flex items-center justify-between gap-2"><Badge variant="outline">{row?.fixture?.status?.short || "NS"}</Badge><span className="text-[10px] text-white/40">Fixture #{id}</span></div><div className="mt-3 font-black">{home?.name || "Home"} vs {away?.name || "Away"}</div><div className="mt-1 text-xs text-white/45">{fmtDate(row?.fixture?.date)}</div><div className="mt-1 text-xs text-white/35">{row?.league?.round || "Round unavailable"}</div></button>; })}</div>
        </Card>

        {selectedFixtureId && <Card className="min-w-0 border-white/10 bg-white/[.06] p-4 text-white sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-xl font-black"><Activity className="h-5 w-5 text-emerald-200" />Player-stat preview</div><p className="mt-1 text-sm text-white/45">{selectedFixture?.teams?.home?.name || "Home"} vs {selectedFixture?.teams?.away?.name || "Away"}</p></div><Badge className={players.data?.cached ? "bg-emerald-500/20 text-emerald-100" : "bg-cyan-500/20 text-cyan-100"}>{players.data?.cached ? "Cached stats" : "Fresh stats"}</Badge></div>{players.isFetching ? <div className="mt-5 p-8 text-center text-white/45">Loading player statistics…</div> : <div className="mt-5 grid gap-4 xl:grid-cols-2">{teams.map((team: any) => <section key={team?.team?.id || team?.team?.name} className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center gap-3"><img src={team?.team?.logo || "/players/fallback.svg"} alt="" className="h-10 w-10 object-contain" /><div><div className="font-black">{team?.team?.name || "Team"}</div><div className="text-xs text-white/40">{asArray(team?.players).length} player records</div></div></div><div className="mt-4 space-y-2">{asArray(team?.players).map((row: any) => { const s = row?.statistic || {}; const p = row?.player || {}; const preview = row?.fantasyArenaPreview || {}; return <details key={p.id} className="rounded-xl border border-white/10 bg-white/[.03] p-3"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate font-bold">{p.name || `Player ${p.id}`}</div><div className="text-xs text-white/40">{s?.games?.position || "-"} • {s?.games?.minutes || 0} min</div></div><div className="text-lg font-black text-cyan-200">{Number(preview.score || 0).toFixed(1)}</div></div></summary></details>; })}</div></section>)}</div>}</Card>}
      </div>
    </main>
  );
}

function Metric({ label, value, good }: { label: string; value: any; good: boolean }) {
  return <Card className="border-white/10 bg-white/[.06] p-4 text-white"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.14em] text-white/40">{label}</span>{good ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <XCircle className="h-4 w-4 text-red-300" />}</div><div className="mt-3 break-words text-2xl font-black">{String(value)}</div></Card>;
}

function DatabaseMetric({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return <Card className="border-white/10 bg-white/[.06] p-4 text-white"><Icon className="h-5 w-5 text-cyan-300" /><div className="mt-3 text-2xl font-black">{Number(value || 0).toLocaleString()}</div><div className="mt-1 text-xs text-white/40">{label}</div></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-2 text-sm font-bold">{value}</div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const good = status === "success";
  const failed = status === "failed";
  return <Badge className={good ? "bg-emerald-500/20 text-emerald-100" : failed ? "bg-red-500/20 text-red-100" : "bg-amber-500/20 text-amber-100"}>{status || "unknown"}</Badge>;
}

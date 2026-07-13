import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, CheckCircle2, Database, RefreshCw, Search, ShieldCheck, Wifi, XCircle } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

function currentSeason() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function fmtDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown date";
}

export default function AdminLiveDataPage() {
  const [season, setSeason] = useState(currentSeason());
  const [date, setDate] = useState("");
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  const [fixtureQueryEnabled, setFixtureQueryEnabled] = useState(false);

  const status = useQuery<any>({ queryKey: ["/api/admin/live-data/status"] });
  const fixtureUrl = `/api/admin/live-data/fixtures?season=${season}${date ? `&date=${encodeURIComponent(date)}` : ""}`;
  const fixtures = useQuery<any>({ queryKey: [fixtureUrl], enabled: fixtureQueryEnabled });
  const playersUrl = selectedFixtureId ? `/api/admin/live-data/fixture/${selectedFixtureId}/players` : "";
  const players = useQuery<any>({ queryKey: [playersUrl], enabled: Boolean(selectedFixtureId) });

  const fixtureRows = asArray(fixtures.data?.fixtures);
  const selectedFixture = useMemo(() => fixtureRows.find((row: any) => Number(row?.fixture?.id) === selectedFixtureId), [fixtureRows, selectedFixtureId]);
  const teams = asArray(players.data?.teams);

  return (
    <main className="min-h-full overflow-x-hidden bg-slate-950 px-3 pb-32 pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(6,182,212,.16),rgba(37,99,235,.12),rgba(2,6,23,.96))] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" /> Safe read-only mode
              </div>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">API-Football Live Data</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">Test the connection, inspect fixtures and preview real player statistics. Nothing on this page writes to tournaments, wallets, cards, prizes or settlements.</p>
            </div>
            <Button onClick={() => status.refetch()} variant="outline" className="border-white/15 bg-white/5 text-white">
              <RefreshCw className="mr-2 h-4 w-4" /> Check connection
            </Button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="Configured" value={status.data?.configured ? "Yes" : "No"} good={Boolean(status.data?.configured)} />
          <Metric label="Connected" value={status.data?.connected ? "Online" : "Offline"} good={Boolean(status.data?.connected)} />
          <Metric label="League" value={String(status.data?.leagueId || 39)} good />
          <Metric label="Requests left" value={status.data?.rateLimit?.remaining ?? "Unknown"} good={status.data?.rateLimit?.remaining !== 0} />
        </section>

        {status.isError && <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{(status.error as Error)?.message || "Connection failed"}</div>}
        {status.data?.message && !status.data?.connected && <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">{status.data.message}</div>}

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex items-center gap-2 text-xl font-black"><CalendarDays className="h-5 w-5 text-cyan-200" /> Fixture lookup</div>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_220px_auto]">
            <label className="text-xs text-white/55">Season<Input type="number" value={season} onChange={(e) => setSeason(Number(e.target.value) || currentSeason())} className="mt-1 border-white/10 bg-black/35" /></label>
            <label className="text-xs text-white/55">Date (optional)<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 border-white/10 bg-black/35" /></label>
            <div className="flex items-end"><Button onClick={() => { setFixtureQueryEnabled(true); setSelectedFixtureId(null); setTimeout(() => fixtures.refetch(), 0); }} disabled={!status.data?.connected || fixtures.isFetching} className="min-h-10 w-full bg-cyan-300 font-black text-slate-950"><Search className="mr-2 h-4 w-4" />{fixtures.isFetching ? "Loading fixtures…" : "Find fixtures"}</Button></div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fixtureRows.map((row: any) => {
              const id = Number(row?.fixture?.id || 0);
              const home = row?.teams?.home;
              const away = row?.teams?.away;
              const active = selectedFixtureId === id;
              return <button key={id} onClick={() => setSelectedFixtureId(id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25 hover:border-white/25"}`}>
                <div className="flex items-center justify-between gap-2"><Badge variant="outline">{row?.fixture?.status?.short || "NS"}</Badge><span className="text-[10px] text-white/40">Fixture #{id}</span></div>
                <div className="mt-3 font-black">{home?.name || "Home"} vs {away?.name || "Away"}</div>
                <div className="mt-1 text-xs text-white/45">{fmtDate(row?.fixture?.date)}</div>
                <div className="mt-1 text-xs text-white/35">{row?.league?.round || "Round unavailable"}</div>
              </button>;
            })}
          </div>
          {fixtureQueryEnabled && !fixtures.isFetching && fixtureRows.length === 0 && <div className="mt-5 rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/40">No fixtures returned for this season/date.</div>}
        </Card>

        {selectedFixtureId && <Card className="min-w-0 border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex items-center gap-2 text-xl font-black"><Activity className="h-5 w-5 text-emerald-200" /> Player-stat preview</div><p className="mt-1 text-sm text-white/45">{selectedFixture?.teams?.home?.name || "Home"} vs {selectedFixture?.teams?.away?.name || "Away"} • Read-only preview</p></div>
            <Badge className="bg-emerald-500/20 text-emerald-100">No database writes</Badge>
          </div>

          {players.isFetching ? <div className="mt-5 p-8 text-center text-white/45">Loading both teams’ player statistics…</div> : players.isError ? <div className="mt-5 rounded-xl border border-red-300/20 bg-red-500/10 p-4 text-red-100">{(players.error as Error)?.message || "Player-stat request failed"}</div> : <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {teams.map((team: any) => <section key={team?.team?.id || team?.team?.name} className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-3"><img src={team?.team?.logo || "/players/fallback.svg"} alt="" className="h-10 w-10 object-contain" /><div><div className="font-black">{team?.team?.name || "Team"}</div><div className="text-xs text-white/40">{asArray(team?.players).length} player records</div></div></div>
              <div className="mt-4 space-y-2">{asArray(team?.players).map((row: any) => {
                const s = row?.statistic || {};
                const p = row?.player || {};
                const preview = row?.fantasyArenaPreview || {};
                return <details key={p.id} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                  <summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate font-bold">{p.name || `Player ${p.id}`}</div><div className="text-xs text-white/40">{s?.games?.position || "-"} • {s?.games?.minutes || 0} min • Rating {s?.games?.rating || "-"}</div></div><div className="text-right"><div className="text-lg font-black text-cyan-200">{Number(preview.score || 0).toFixed(1)}</div><div className="text-[9px] uppercase text-white/35">Preview score</div></div></div></summary>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-4"><Stat label="Goals" value={s?.goals?.total} /><Stat label="Assists" value={s?.goals?.assists} /><Stat label="Shots on" value={s?.shots?.on} /><Stat label="Passes" value={s?.passes?.total} /><Stat label="Key passes" value={s?.passes?.key} /><Stat label="Tackles" value={s?.tackles?.total} /><Stat label="Interceptions" value={s?.tackles?.interceptions} /><Stat label="Duels won" value={s?.duels?.won} /><Stat label="Saves" value={s?.goals?.saves} /><Stat label="Yellow" value={s?.cards?.yellow} /><Stat label="Red" value={s?.cards?.red} /><Stat label="Penalty saved" value={s?.penalty?.saved} /></div>
                  <div className="mt-3 grid grid-cols-3 gap-2"><Stat label="Decisive" value={preview.decisiveScore} /><Stat label="All-around" value={preview.allAroundScore} /><Stat label="Official" value={preview.score} /></div>
                </details>;
              })}</div>
            </section>)}
          </div>}
        </Card>}

        <div className="flex items-start gap-3 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4 text-sm text-blue-100"><Database className="mt-0.5 h-4 w-4 shrink-0" /><p>This phase performs API reads only. Importing player mappings, saving fixtures, updating gameweek scores and affecting tournament rankings will remain disabled until the preview is verified.</p></div>
      </div>
    </main>
  );
}

function Metric({ label, value, good }: { label: string; value: any; good: boolean }) {
  return <Card className="border-white/10 bg-white/[.06] p-4 text-white"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.14em] text-white/40">{label}</span>{good ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <XCircle className="h-4 w-4 text-red-300" />}</div><div className="mt-3 break-words text-2xl font-black">{String(value)}</div></Card>;
}

function Stat({ label, value }: { label: string; value: any }) {
  const number = Number(value || 0);
  return <div className="rounded-lg border border-white/10 bg-black/25 p-2"><div className="text-[9px] font-black uppercase tracking-[.1em] text-white/30">{label}</div><div className="mt-1 font-black">{Number.isFinite(number) ? (Number.isInteger(number) ? number : number.toFixed(1)) : String(value || 0)}</div></div>;
}

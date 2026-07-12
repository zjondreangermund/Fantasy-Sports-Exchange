import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Beaker, CheckCircle2, FastForward, Pause, Play, RefreshCw, RotateCcw, ShieldAlert, Trophy } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

const rarities = ["common", "rare", "unique", "epic", "legendary"];

type ConsoleData = {
  tournaments: Array<{ id: number; name: string; tier: string; status: string; gameWeek: number; entryCount: number }>;
  users: Array<{ id: string }>;
  counts: { testTournaments: number; testEntries: number; testTransactions: number };
};

type RunLog = {
  id: string;
  gameWeek: number;
  rarity: string;
  stage: string;
  status: "running" | "done" | "error" | "stopped";
  message: string;
};

export default function AdminSeasonSimulatorPage() {
  const [fromGw, setFromGw] = useState(1);
  const [toGw, setToGw] = useState(5);
  const [rarity, setRarity] = useState("common");
  const [allRarities, setAllRarities] = useState(false);
  const [entriesPerTournament, setEntriesPerTournament] = useState(10);
  const [scoreMode, setScoreMode] = useState("random");
  const [autoComplete, setAutoComplete] = useState(true);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [completedSteps, setCompletedSteps] = useState(0);
  const stopRef = useRef(false);

  const { data, refetch } = useQuery<ConsoleData>({ queryKey: ["/api/admin/test-console"] });

  const weeks = useMemo(() => {
    const start = Math.max(1, Math.min(38, fromGw));
    const end = Math.max(start, Math.min(38, toGw));
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [fromGw, toGw]);

  const selectedRarities = allRarities ? rarities : [rarity];
  const stagesPerTournament = autoComplete ? 4 : 3;
  const totalSteps = weeks.length * selectedRarities.length * stagesPerTournament;
  const progress = totalSteps ? Math.min(100, Math.round((completedSteps / totalSteps) * 100)) : 0;

  const addLog = (gameWeek: number, rarityName: string, stage: string, status: RunLog["status"], message: string) => {
    setLogs((current) => [{ id: `${Date.now()}-${Math.random()}`, gameWeek, rarity: rarityName, stage, status, message }, ...current].slice(0, 250));
  };

  const refreshAffectedData = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }),
    ]);
  };

  const runSeason = async () => {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    setCompletedSteps(0);
    setLogs([]);

    try {
      for (const gameWeek of weeks) {
        for (const rarityName of selectedRarities) {
          if (stopRef.current) {
            addLog(gameWeek, rarityName, "Stopped", "stopped", "Simulation stopped by admin.");
            return;
          }

          addLog(gameWeek, rarityName, "Create", "running", "Creating isolated test tournament…");
          const createResponse = await apiRequest("POST", "/api/admin/test-console/create-tournament", {
            gameWeek,
            rarity: rarityName,
            maxEntries: Math.max(2, entriesPerTournament),
          });
          const created = await createResponse.json();
          const tournamentId = Number(created?.tournament?.id || 0);
          if (!tournamentId) throw new Error(`No tournament ID returned for GW${gameWeek} ${rarityName}`);
          setCompletedSteps((value) => value + 1);
          addLog(gameWeek, rarityName, "Create", "done", `Tournament #${tournamentId} created.`);

          if (stopRef.current) return;
          addLog(gameWeek, rarityName, "Fill", "running", `Adding up to ${entriesPerTournament} simulated entries…`);
          const fillResponse = await apiRequest("POST", `/api/admin/test-console/tournament/${tournamentId}/fill`, {
            count: Math.max(1, entriesPerTournament),
          });
          const filled = await fillResponse.json();
          setCompletedSteps((value) => value + 1);
          addLog(gameWeek, rarityName, "Fill", "done", `${filled?.inserted || 0} entries added.`);

          if (stopRef.current) return;
          addLog(gameWeek, rarityName, "Score", "running", `Applying ${scoreMode} scores and ranks…`);
          const scoreResponse = await apiRequest("POST", `/api/admin/test-console/tournament/${tournamentId}/score`, {
            mode: scoreMode,
          });
          const scored = await scoreResponse.json();
          setCompletedSteps((value) => value + 1);
          addLog(gameWeek, rarityName, "Score", "done", `${scored?.scored || 0} entries scored and ranked.`);

          if (autoComplete) {
            if (stopRef.current) return;
            addLog(gameWeek, rarityName, "Complete", "running", "Closing the simulated gameweek…");
            await apiRequest("POST", `/api/admin/test-console/tournament/${tournamentId}/status`, { status: "completed" });
            setCompletedSteps((value) => value + 1);
            addLog(gameWeek, rarityName, "Complete", "done", "Tournament marked completed.");
          }
        }
      }
      await refreshAffectedData();
    } catch (error: any) {
      addLog(0, "system", "Error", "error", error?.message || "Season simulation failed");
    } finally {
      setRunning(false);
      await refreshAffectedData();
    }
  };

  const stopSeason = () => {
    stopRef.current = true;
    setRunning(false);
  };

  const cleanup = async () => {
    if (running) return;
    await apiRequest("DELETE", "/api/admin/test-console/cleanup");
    setLogs([]);
    setCompletedSteps(0);
    await refreshAffectedData();
  };

  return (
    <main className="min-h-full overflow-x-hidden bg-slate-950 px-3 pb-32 pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-purple-300/20 bg-[linear-gradient(135deg,rgba(124,58,237,.18),rgba(37,99,235,.12),rgba(2,6,23,.96))] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-purple-100"><FastForward className="h-3.5 w-3.5" /> Multi-gameweek automation</div>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">Season Simulator</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Run several gameweeks in minutes. Every generated tournament remains isolated with a <b>[TEST]</b> prefix.</p>
            </div>
            <div className="flex flex-wrap gap-2"><Link href="/admin/test-console"><Button variant="outline" className="border-white/15 bg-white/5 text-white"><ArrowLeft className="mr-2 h-4 w-4" />Test Console</Button></Link><Button onClick={() => refreshAffectedData()} variant="outline" className="border-white/15 bg-white/5 text-white"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>This runner never updates normal competitions. Stop requests take effect after the current API step finishes.</p></div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <Summary label="Existing tests" value={data?.counts?.testTournaments || 0} />
          <Summary label="Test entries" value={data?.counts?.testEntries || 0} />
          <Summary label="Available users" value={data?.users?.length || 0} />
        </section>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex items-center gap-2 text-xl font-black"><Beaker className="h-5 w-5 text-purple-200" />Simulation setup</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-white/55">From gameweek<Input type="number" min={1} max={38} value={fromGw} disabled={running} onChange={(e) => setFromGw(Math.max(1, Math.min(38, Number(e.target.value) || 1)))} className="mt-1 border-white/10 bg-black/35" /></label>
            <label className="text-xs text-white/55">To gameweek<Input type="number" min={1} max={38} value={toGw} disabled={running} onChange={(e) => setToGw(Math.max(1, Math.min(38, Number(e.target.value) || 1)))} className="mt-1 border-white/10 bg-black/35" /></label>
            <label className="text-xs text-white/55">Rarity<select value={rarity} disabled={running || allRarities} onChange={(e) => setRarity(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-black/35 px-3">{rarities.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-xs text-white/55">Entries per tournament<Input type="number" min={1} max={100} value={entriesPerTournament} disabled={running} onChange={(e) => setEntriesPerTournament(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="mt-1 border-white/10 bg-black/35" /></label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm"><input type="checkbox" checked={allRarities} disabled={running} onChange={(e) => setAllRarities(e.target.checked)} />Run all five rarities</label>
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm"><input type="checkbox" checked={autoComplete} disabled={running} onChange={(e) => setAutoComplete(e.target.checked)} />Complete each tournament</label>
            <label className="text-xs text-white/55">Score scenario<select value={scoreMode} disabled={running} onChange={(e) => setScoreMode(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-black/35 px-3"><option value="random">Random realistic</option><option value="ascending">Predictable ascending</option><option value="tie">Forced tie</option></select></label>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-black">{weeks.length} gameweek{weeks.length === 1 ? "" : "s"} × {selectedRarities.length} rarit{selectedRarities.length === 1 ? "y" : "ies"}</div><div className="mt-1 text-xs text-white/45">{totalSteps} API stages will run sequentially.</div></div><Badge className="bg-purple-500/20 text-purple-100">{progress}%</Badge></div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {!running ? <Button onClick={runSeason} className="min-h-12 bg-purple-500 font-black hover:bg-purple-400"><Play className="mr-2 h-4 w-4" />Run simulation</Button> : <Button onClick={stopSeason} variant="destructive" className="min-h-12"><Pause className="mr-2 h-4 w-4" />Stop safely</Button>}
            <Button onClick={() => { setLogs([]); setCompletedSteps(0); }} disabled={running} variant="outline" className="min-h-12 border-white/15 bg-white/5 text-white"><RotateCcw className="mr-2 h-4 w-4" />Clear run log</Button>
            <Button onClick={cleanup} disabled={running} variant="outline" className="min-h-12 border-red-300/20 bg-red-500/10 text-red-100"><Trophy className="mr-2 h-4 w-4" />Remove all test tournaments</Button>
          </div>
        </Card>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex items-center justify-between gap-3"><div className="text-xl font-black">Live run log</div><div className="text-xs text-white/45">Newest first</div></div>
          <div className="mt-4 max-h-[38rem] space-y-2 overflow-y-auto pr-1">
            {logs.length ? logs.map((log) => <div key={log.id} className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><StatusIcon status={log.status} /><b>{log.gameWeek ? `GW${log.gameWeek} ${log.rarity}` : log.rarity}</b><Badge variant="outline">{log.stage}</Badge></div><span className={`text-xs font-black uppercase ${log.status === "error" ? "text-red-300" : log.status === "done" ? "text-emerald-300" : log.status === "stopped" ? "text-amber-300" : "text-cyan-300"}`}>{log.status}</span></div><div className="mt-1 text-sm text-white/55">{log.message}</div></div>) : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/40">Run a simulation to see each gameweek stage here.</div>}
          </div>
        </Card>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <Card className="border-white/10 bg-white/[.06] p-3 text-white sm:p-4"><div className="text-2xl font-black">{value}</div><div className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-white/45">{label}</div></Card>;
}

function StatusIcon({ status }: { status: RunLog["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (status === "error") return <ShieldAlert className="h-4 w-4 text-red-300" />;
  if (status === "stopped") return <Pause className="h-4 w-4 text-amber-300" />;
  return <RefreshCw className="h-4 w-4 animate-spin text-cyan-300" />;
}

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
const ladderSweep = [1, 10, 19, 20, 49, 50, 99, 100, 249, 250, 499, 500, 999, 1000, 2499, 2500, 4999, 5000];

type EntryMode = "fixed" | "step" | "random" | "custom" | "ladder";

type ConsoleData = {
  tournaments: Array<{ id: number; name: string; tier: string; status: string; gameWeek: number; entryCount: number }>;
  users: Array<{ id: string }>;
  counts: { testTournaments: number; testEntries: number; testTransactions: number };
};

type RunLog = {
  id: string;
  gameWeek: number;
  rarity: string;
  status: "running" | "done" | "error" | "stopped";
  message: string;
};

type PlannedRun = {
  gameWeek: number;
  rarity: string;
  entries: number;
};

function clampEntries(value: number) {
  return Math.max(1, Math.min(5000, Math.floor(Number(value) || 1)));
}

export default function AdminSeasonSimulatorPage() {
  const [fromGw, setFromGw] = useState(1);
  const [toGw, setToGw] = useState(5);
  const [rarity, setRarity] = useState("common");
  const [allRarities, setAllRarities] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>("step");
  const [fixedEntries, setFixedEntries] = useState(100);
  const [startEntries, setStartEntries] = useState(10);
  const [entryStep, setEntryStep] = useState(50);
  const [randomMin, setRandomMin] = useState(10);
  const [randomMax, setRandomMax] = useState(1000);
  const [customEntries, setCustomEntries] = useState("10, 20, 50, 100, 250, 500, 1000");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [completedRuns, setCompletedRuns] = useState(0);
  const stopRef = useRef(false);

  const { data, refetch } = useQuery<ConsoleData>({ queryKey: ["/api/admin/test-console"] });

  const weeks = useMemo(() => {
    const start = Math.max(1, Math.min(38, fromGw));
    const end = Math.max(start, Math.min(38, toGw));
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [fromGw, toGw]);

  const selectedRarities = allRarities ? rarities : [rarity];

  const parsedCustomEntries = useMemo(() => {
    const values = customEntries
      .split(/[,;\s]+/)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map(clampEntries);
    return values.length ? values : [100];
  }, [customEntries]);

  const plannedRuns = useMemo<PlannedRun[]>(() => {
    const combinations: Array<{ gameWeek: number; rarity: string }> = [];
    for (const gameWeek of weeks) {
      for (const rarityName of selectedRarities) combinations.push({ gameWeek, rarity: rarityName });
    }

    return combinations.map((item, index) => {
      let count = fixedEntries;
      if (entryMode === "step") count = startEntries + entryStep * index;
      if (entryMode === "random") {
        const min = Math.min(randomMin, randomMax);
        const max = Math.max(randomMin, randomMax);
        count = Math.floor(min + Math.random() * (max - min + 1));
      }
      if (entryMode === "custom") count = parsedCustomEntries[index % parsedCustomEntries.length];
      if (entryMode === "ladder") count = ladderSweep[index % ladderSweep.length];
      return { ...item, entries: clampEntries(count) };
    });
  }, [weeks, selectedRarities, entryMode, fixedEntries, startEntries, entryStep, randomMin, randomMax, parsedCustomEntries]);

  const totalRuns = plannedRuns.length;
  const totalPlannedEntries = plannedRuns.reduce((sum, run) => sum + run.entries, 0);
  const progress = totalRuns ? Math.min(100, Math.round((completedRuns / totalRuns) * 100)) : 0;

  const addLog = (gameWeek: number, rarityName: string, status: RunLog["status"], message: string) => {
    setLogs((current) => [
      { id: `${Date.now()}-${Math.random()}`, gameWeek, rarity: rarityName, status, message },
      ...current,
    ].slice(0, 250));
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
    setCompletedRuns(0);
    setLogs([]);

    try {
      for (const run of plannedRuns) {
        if (stopRef.current) {
          addLog(run.gameWeek, run.rarity, "stopped", "Simulation stopped by admin.");
          return;
        }

        addLog(run.gameWeek, run.rarity, "running", `Generating ${run.entries.toLocaleString()} bots, cards, scores and rankings…`);
        const response = await apiRequest("POST", "/api/admin/simulator/run", {
          name: `[TEST] GW${run.gameWeek} ${run.rarity.toUpperCase()} ${run.entries} Entries`,
          gameWeek: run.gameWeek,
          rarity: run.rarity,
          entries: run.entries,
        });
        const result = await response.json();
        setCompletedRuns((value) => value + 1);
        addLog(
          run.gameWeek,
          run.rarity,
          "done",
          `${Number(result?.entries || run.entries).toLocaleString()} bot entries created and ranked. ${result?.activePrize?.title ? `Prize Vault unlocked: ${result.activePrize.title}.` : "No prize tier unlocked yet."}`,
        );
      }
    } catch (error: any) {
      addLog(0, "system", "error", error?.message || "Season simulation failed");
    } finally {
      setRunning(false);
      await refreshAffectedData();
    }
  };

  const stopSeason = () => {
    stopRef.current = true;
  };

  const cleanup = async () => {
    if (running) return;
    await apiRequest("DELETE", "/api/admin/simulator/cleanup");
    setLogs([]);
    setCompletedRuns(0);
    await refreshAffectedData();
  };

  return (
    <main className="min-h-full overflow-x-hidden bg-slate-950 px-3 pb-32 pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-purple-300/20 bg-[linear-gradient(135deg,rgba(124,58,237,.18),rgba(37,99,235,.12),rgba(2,6,23,.96))] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-purple-100"><FastForward className="h-3.5 w-3.5" /> Prize-ladder test automation</div>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">Season Simulator</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Each tournament can now receive a different bot-entry count so you can confirm Prize Vault unlocks at low, boundary and high participation levels.</p>
            </div>
            <div className="flex flex-wrap gap-2"><Link href="/admin/test-console"><Button variant="outline" className="border-white/15 bg-white/5 text-white"><ArrowLeft className="mr-2 h-4 w-4" />Test Console</Button></Link><Button onClick={() => refreshAffectedData()} variant="outline" className="border-white/15 bg-white/5 text-white"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>Use Prize Ladder Sweep for automatic boundary testing, or enter your own sequence such as 19, 20, 49, 50, 99, 100.</p></div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <Summary label="Existing tests" value={data?.counts?.testTournaments || 0} />
          <Summary label="Test entries" value={data?.counts?.testEntries || 0} />
          <Summary label="Registered users" value={data?.users?.length || 0} />
        </section>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex items-center gap-2 text-xl font-black"><Beaker className="h-5 w-5 text-purple-200" />Simulation setup</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-white/55">From gameweek<Input type="number" min={1} max={38} value={fromGw} disabled={running} onChange={(e) => setFromGw(Math.max(1, Math.min(38, Number(e.target.value) || 1)))} className="mt-1 border-white/10 bg-black/35" /></label>
            <label className="text-xs text-white/55">To gameweek<Input type="number" min={1} max={38} value={toGw} disabled={running} onChange={(e) => setToGw(Math.max(1, Math.min(38, Number(e.target.value) || 1)))} className="mt-1 border-white/10 bg-black/35" /></label>
            <label className="text-xs text-white/55">Rarity<select value={rarity} disabled={running || allRarities} onChange={(e) => setRarity(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-black/35 px-3">{rarities.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-xs text-white/55">Entry-count pattern<select value={entryMode} disabled={running} onChange={(e) => setEntryMode(e.target.value as EntryMode)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-black/35 px-3"><option value="step">Increase each tournament</option><option value="ladder">Prize Ladder sweep</option><option value="custom">Custom list</option><option value="random">Random range</option><option value="fixed">Same amount</option></select></label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {entryMode === "fixed" && <label className="text-xs text-white/55">Entries per tournament<Input type="number" min={1} max={5000} value={fixedEntries} disabled={running} onChange={(e) => setFixedEntries(clampEntries(Number(e.target.value)))} className="mt-1 border-white/10 bg-black/35" /></label>}
            {entryMode === "step" && <><label className="text-xs text-white/55">Starting entries<Input type="number" min={1} max={5000} value={startEntries} disabled={running} onChange={(e) => setStartEntries(clampEntries(Number(e.target.value)))} className="mt-1 border-white/10 bg-black/35" /></label><label className="text-xs text-white/55">Increase per tournament<Input type="number" min={0} max={5000} value={entryStep} disabled={running} onChange={(e) => setEntryStep(Math.max(0, Math.min(5000, Number(e.target.value) || 0)))} className="mt-1 border-white/10 bg-black/35" /></label></>}
            {entryMode === "random" && <><label className="text-xs text-white/55">Minimum entries<Input type="number" min={1} max={5000} value={randomMin} disabled={running} onChange={(e) => setRandomMin(clampEntries(Number(e.target.value)))} className="mt-1 border-white/10 bg-black/35" /></label><label className="text-xs text-white/55">Maximum entries<Input type="number" min={1} max={5000} value={randomMax} disabled={running} onChange={(e) => setRandomMax(clampEntries(Number(e.target.value)))} className="mt-1 border-white/10 bg-black/35" /></label></>}
            {entryMode === "custom" && <label className="text-xs text-white/55 md:col-span-2 xl:col-span-3">Custom sequence<Input value={customEntries} disabled={running} onChange={(e) => setCustomEntries(e.target.value)} placeholder="19, 20, 49, 50, 99, 100" className="mt-1 border-white/10 bg-black/35" /></label>}
            {entryMode === "ladder" && <div className="rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-sm text-purple-100 md:col-span-2 xl:col-span-3">Sweep sequence: {ladderSweep.join(", ")}. Values repeat if you create more tournaments than the sequence length.</div>}
          </div>

          <div className="mt-4"><label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm"><input type="checkbox" checked={allRarities} disabled={running} onChange={(e) => setAllRarities(e.target.checked)} />Run all five rarities for every selected gameweek</label></div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-black">{plannedRuns.length} tournaments planned</div><div className="mt-1 text-xs text-white/45">{totalPlannedEntries.toLocaleString()} total generated entries with different counts</div></div><Badge className="bg-purple-500/20 text-purple-100">{progress}%</Badge></div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{plannedRuns.slice(0, 18).map((run, index) => <div key={`${run.gameWeek}-${run.rarity}-${index}`} className="min-w-[132px] rounded-xl border border-white/10 bg-white/5 p-2"><div className="text-[9px] font-black uppercase text-white/35">GW{run.gameWeek} {run.rarity}</div><div className="mt-1 font-black text-cyan-200">{run.entries.toLocaleString()} entries</div></div>)}</div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {!running ? <Button onClick={runSeason} className="min-h-12 bg-purple-500 font-black hover:bg-purple-400"><Play className="mr-2 h-4 w-4" />Run varied simulation</Button> : <Button onClick={stopSeason} variant="destructive" className="min-h-12"><Pause className="mr-2 h-4 w-4" />Stop after current tournament</Button>}
            <Button onClick={() => { setLogs([]); setCompletedRuns(0); }} disabled={running} variant="outline" className="min-h-12 border-white/15 bg-white/5 text-white"><RotateCcw className="mr-2 h-4 w-4" />Clear run log</Button>
            <Button onClick={cleanup} disabled={running} variant="outline" className="min-h-12 border-red-300/20 bg-red-500/10 text-red-100"><Trophy className="mr-2 h-4 w-4" />Remove all test data</Button>
          </div>
        </Card>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex items-center justify-between gap-3"><div className="text-xl font-black">Live run log</div><div className="text-xs text-white/45">Newest first</div></div>
          <div className="mt-4 max-h-[38rem] space-y-2 overflow-y-auto pr-1">
            {logs.length ? logs.map((log) => <div key={log.id} className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><StatusIcon status={log.status} /><b>{log.gameWeek ? `GW${log.gameWeek} ${log.rarity}` : log.rarity}</b></div><span className={`text-xs font-black uppercase ${log.status === "error" ? "text-red-300" : log.status === "done" ? "text-emerald-300" : log.status === "stopped" ? "text-amber-300" : "text-cyan-300"}`}>{log.status}</span></div><div className="mt-1 text-sm text-white/55">{log.message}</div></div>) : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/40">Run a simulation to see each generated tournament here.</div>}
          </div>
        </Card>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <Card className="border-white/10 bg-white/[.06] p-3 text-white sm:p-4"><div className="text-2xl font-black">{Number(value || 0).toLocaleString()}</div><div className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-white/45">{label}</div></Card>;
}

function StatusIcon({ status }: { status: RunLog["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (status === "error") return <ShieldAlert className="h-4 w-4 text-red-300" />;
  if (status === "stopped") return <Pause className="h-4 w-4 text-amber-300" />;
  return <RefreshCw className="h-4 w-4 animate-spin text-cyan-300" />;
}

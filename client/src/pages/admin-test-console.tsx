import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Beaker, Bot, CalendarDays, CheckCircle2, Coins, FastForward, RefreshCw, ShieldAlert, Trash2, Trophy } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

const rarities = ["common", "rare", "unique", "epic", "legendary"];
const statuses = ["open", "active", "completed"];

type TestTournament = {
  id: number;
  name: string;
  tier: string;
  status: string;
  gameWeek: number;
  entryFee: number;
  entryCount: number;
  maxEntries?: number | null;
};

type ConsoleData = {
  tournaments: TestTournament[];
  users: Array<{ id: string; email?: string; name?: string; managerTeamName?: string; balance?: number }>;
  counts: { testTournaments: number; testEntries: number; testTransactions: number };
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

export default function AdminTestConsolePage() {
  const { toast } = useToast();
  const [gameWeek, setGameWeek] = useState(1);
  const [rarity, setRarity] = useState("common");
  const [maxEntries, setMaxEntries] = useState(20);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [botCount, setBotCount] = useState(10);
  const [scoreMode, setScoreMode] = useState("random");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [walletAmount, setWalletAmount] = useState(100);

  const { data, isLoading, refetch } = useQuery<ConsoleData>({
    queryKey: ["/api/admin/test-console"],
  });

  const selectedTournament = useMemo(
    () => data?.tournaments?.find((row) => row.id === selectedTournamentId) || data?.tournaments?.[0] || null,
    [data?.tournaments, selectedTournamentId],
  );

  const refreshAll = async () => {
    await refetch();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }),
    ]);
  };

  const createTournament = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/test-console/create-tournament", { gameWeek, rarity, maxEntries })).json(),
    onSuccess: async (body: any) => {
      setSelectedTournamentId(Number(body?.tournament?.id || 0) || null);
      await refreshAll();
      toast({ title: "Test tournament created", description: `GW${gameWeek} ${rarity} test tournament is ready.` });
    },
    onError: (error: any) => toast({ title: "Could not create test tournament", description: error.message, variant: "destructive" }),
  });

  const fillTournament = useMutation({
    mutationFn: async () => {
      if (!selectedTournament) throw new Error("Select a test tournament first");
      return (await apiRequest("POST", `/api/admin/test-console/tournament/${selectedTournament.id}/fill`, { count: botCount })).json();
    },
    onSuccess: async (body: any) => {
      await refreshAll();
      toast({ title: "Tournament filled", description: `${body.inserted || 0} simulated entries added.` });
    },
    onError: (error: any) => toast({ title: "Could not add entries", description: error.message, variant: "destructive" }),
  });

  const scoreTournament = useMutation({
    mutationFn: async () => {
      if (!selectedTournament) throw new Error("Select a test tournament first");
      return (await apiRequest("POST", `/api/admin/test-console/tournament/${selectedTournament.id}/score`, { mode: scoreMode })).json();
    },
    onSuccess: async () => {
      await refreshAll();
      toast({ title: "Scores simulated", description: "Entries were scored and ranked immediately." });
    },
    onError: (error: any) => toast({ title: "Could not simulate scores", description: error.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!selectedTournament) throw new Error("Select a test tournament first");
      return (await apiRequest("POST", `/api/admin/test-console/tournament/${selectedTournament.id}/status`, { status })).json();
    },
    onSuccess: async (_body, status) => {
      await refreshAll();
      toast({ title: `Tournament ${status}`, description: "Status changed immediately for testing." });
    },
    onError: (error: any) => toast({ title: "Could not update tournament", description: error.message, variant: "destructive" }),
  });

  const adjustWallet = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("Select a user");
      return (await apiRequest("POST", "/api/admin/test-console/wallet", { userId: selectedUserId, amount: walletAmount })).json();
    },
    onSuccess: async () => {
      await refreshAll();
      toast({ title: "Wallet adjusted", description: `${money(walletAmount)} test adjustment recorded.` });
    },
    onError: (error: any) => toast({ title: "Wallet adjustment failed", description: error.message, variant: "destructive" }),
  });

  const cleanup = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", "/api/admin/test-console/cleanup")).json(),
    onSuccess: async (body: any) => {
      setSelectedTournamentId(null);
      await refreshAll();
      toast({ title: "Test data removed", description: `${body.deletedTournaments || 0} test tournaments cleaned up.` });
    },
    onError: (error: any) => toast({ title: "Cleanup failed", description: error.message, variant: "destructive" }),
  });

  return (
    <main className="min-h-full overflow-x-hidden bg-slate-950 px-3 pb-32 pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,.12),rgba(124,58,237,.10),rgba(2,6,23,.96))] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-amber-100"><Beaker className="h-3.5 w-3.5" /> Admin-only sandbox</div>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">Gameweek Test Console</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Create isolated test tournaments, fill them with simulated entries, score them, complete them and test wallet flows without waiting for a real gameweek.</p>
            </div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => refreshAll()} variant="outline" className="border-white/15 bg-white/5 text-white"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={() => cleanup.mutate()} disabled={cleanup.isPending} variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Remove test data</Button></div>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-500/10 p-3 text-sm text-red-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>Only items prefixed with <b>[TEST]</b> are modified by this console. Normal live tournaments and real user transactions are left untouched.</p></div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <Stat icon={Trophy} label="Test tournaments" value={data?.counts?.testTournaments || 0} />
          <Stat icon={Bot} label="Simulated entries" value={data?.counts?.testEntries || 0} />
          <Stat icon={Coins} label="Test transactions" value={data?.counts?.testTransactions || 0} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-5">
            <Heading icon={CalendarDays} title="1. Create any gameweek" subtitle="Build a safe tournament for GW1–GW38." />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-white/55">Gameweek<Input type="number" min={1} max={38} value={gameWeek} onChange={(e) => setGameWeek(Math.max(1, Math.min(38, Number(e.target.value) || 1)))} className="mt-1 border-white/10 bg-black/35" /></label>
              <label className="text-xs text-white/55">Rarity<select value={rarity} onChange={(e) => setRarity(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-white">{rarities.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs text-white/55">Maximum entries<Input type="number" min={2} max={500} value={maxEntries} onChange={(e) => setMaxEntries(Math.max(2, Number(e.target.value) || 20))} className="mt-1 border-white/10 bg-black/35" /></label>
            </div>
            <Button onClick={() => createTournament.mutate()} disabled={createTournament.isPending} className="mt-4 w-full bg-purple-500 font-black hover:bg-purple-400"><Beaker className="mr-2 h-4 w-4" />Create isolated test tournament</Button>
          </Card>

          <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-5">
            <Heading icon={Trophy} title="2. Select test tournament" subtitle="All controls below apply only to this selection." />
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
              {isLoading ? <div className="text-sm text-white/45">Loading…</div> : data?.tournaments?.length ? data.tournaments.map((row) => <button key={row.id} onClick={() => setSelectedTournamentId(row.id)} className={`w-full rounded-xl border p-3 text-left ${selectedTournament?.id === row.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25"}`}><div className="flex items-start justify-between gap-2"><div><b>{row.name}</b><div className="mt-1 text-xs text-white/50">GW{row.gameWeek} • {row.tier} • {money(row.entryFee)}</div></div><Badge className="capitalize">{row.status}</Badge></div><div className="mt-2 text-xs text-cyan-100/70">{row.entryCount}/{row.maxEntries || "∞"} entries</div></button>) : <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">No test tournaments yet.</div>}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-white/10 bg-white/[.06] p-4 text-white"><Heading icon={Bot} title="3. Fill with simulated entries" subtitle="Uses existing testable users and owned cards." /><Input type="number" min={1} max={200} value={botCount} onChange={(e) => setBotCount(Math.max(1, Number(e.target.value) || 1))} className="mt-4 border-white/10 bg-black/35" /><Button onClick={() => fillTournament.mutate()} disabled={!selectedTournament || fillTournament.isPending} className="mt-3 w-full"><Bot className="mr-2 h-4 w-4" />Add entries</Button></Card>
          <Card className="border-white/10 bg-white/[.06] p-4 text-white"><Heading icon={Activity} title="4. Simulate scores" subtitle="Ranks all entrants instantly." /><select value={scoreMode} onChange={(e) => setScoreMode(e.target.value)} className="mt-4 h-10 w-full rounded-md border border-white/10 bg-black/35 px-3"><option value="random">Random realistic scores</option><option value="ascending">Ascending test scores</option><option value="tie">Force a tie</option></select><Button onClick={() => scoreTournament.mutate()} disabled={!selectedTournament || scoreTournament.isPending} className="mt-3 w-full"><FastForward className="mr-2 h-4 w-4" />Score and rank now</Button></Card>
          <Card className="border-white/10 bg-white/[.06] p-4 text-white"><Heading icon={CheckCircle2} title="5. Change lifecycle" subtitle="Test open, live and completed states." /><div className="mt-4 grid gap-2">{statuses.map((status) => <Button key={status} onClick={() => setStatus.mutate(status)} disabled={!selectedTournament || setStatus.isPending} variant={selectedTournament?.status === status ? "default" : "outline"} className="capitalize">Set {status}</Button>)}</div></Card>
        </section>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-5">
          <Heading icon={Coins} title="Wallet flow tester" subtitle="Creates an auditable admin test adjustment for a selected account." />
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="h-11 rounded-md border border-white/10 bg-black/35 px-3"><option value="">Select user</option>{data?.users?.map((user) => <option key={user.id} value={user.id}>{user.managerTeamName || user.name || user.email || user.id} — {money(user.balance)}</option>)}</select>
            <Input type="number" value={walletAmount} onChange={(e) => setWalletAmount(Number(e.target.value) || 0)} className="h-11 border-white/10 bg-black/35" />
            <Button onClick={() => adjustWallet.mutate()} disabled={!selectedUserId || !walletAmount || adjustWallet.isPending} className="h-11"><Coins className="mr-2 h-4 w-4" />Apply adjustment</Button>
          </div>
        </Card>
      </div>
    </main>
  );
}

function Heading({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return <div><div className="flex items-center gap-2 text-lg font-black"><Icon className="h-5 w-5 text-cyan-200" />{title}</div><p className="mt-1 text-xs text-white/45">{subtitle}</p></div>;
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return <Card className="border-white/10 bg-white/[.06] p-3 text-white sm:p-4"><Icon className="h-4 w-4 text-amber-200" /><div className="mt-3 text-2xl font-black">{value}</div><div className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-white/45">{label}</div></Card>;
}

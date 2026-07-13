import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity,
  Beaker,
  Bot,
  ChevronLeft,
  ChevronRight,
  Coins,
  FastForward,
  Gift,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

const rarities = ["common", "rare", "unique", "epic", "legendary"];

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

type LegacyPoints = {
  minutes?: number;
  goal?: number;
  assist?: number;
  cleanSheet?: number;
  bonus?: number;
  cards?: number;
  total?: number;
};

type Performance = {
  minutes?: number;
  goals?: number;
  assists?: number;
  cleanSheet?: boolean;
  penaltySave?: boolean;
  penaltyMiss?: boolean;
  redCard?: boolean;
  yellowCard?: boolean;
  ownGoal?: boolean;
  passes?: number;
  keyPasses?: number;
  tackles?: number;
  interceptions?: number;
  duelsWon?: number;
  shotsOnTarget?: number;
  saves?: number;
  possessionLost?: number;
};

type CardBreakdown = {
  id: number;
  playerId?: number;
  name: string;
  team: string;
  position: string;
  points?: LegacyPoints;
  score?: number;
  decisiveScore?: number;
  allAroundScore?: number;
  performance?: Performance;
};

type Ranking = {
  entryId: number;
  rank: number;
  totalScore: number;
  userId: string;
  managerName: string;
  captainId: number;
  cardIds: number[];
  pointsMeta?: {
    cardBreakdown?: CardBreakdown[];
    captainMultiplier?: number;
    captainBonus?: number;
    highestCard?: number;
    allAroundTotal?: number;
  };
  prizeAmount?: number;
  prizeCardId?: number | null;
};

type RankingsData = {
  tournament: TestTournament & { rarity?: string };
  total: number;
  page: number;
  limit: number;
  rankings: Ranking[];
  activePrize?: { title: string; value: number; requiredEntrants: number; key: string } | null;
  nextPrize?: { title: string; value: number; requiredEntrants: number; key: string } | null;
  entrantsToNext: number;
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
}

function numberValue(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export default function AdminTestConsolePage() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [gameWeek, setGameWeek] = useState(1);
  const [rarity, setRarity] = useState("common");
  const [entries, setEntries] = useState(100);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [rankPage, setRankPage] = useState(1);
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery<ConsoleData>({ queryKey: ["/api/admin/test-console"] });
  const rankingsUrl = selectedTournamentId
    ? `/api/admin/simulator/tournament/${selectedTournamentId}/rankings?page=${rankPage}&limit=100`
    : "";
  const {
    data: rankingsData,
    isFetching: rankingsLoading,
    refetch: refetchRankings,
  } = useQuery<RankingsData>({ queryKey: [rankingsUrl], enabled: Boolean(selectedTournamentId) });

  const selectedTournament = useMemo(
    () => data?.tournaments?.find((row) => row.id === selectedTournamentId) || null,
    [data?.tournaments, selectedTournamentId],
  );
  const totalPages = Math.max(1, Math.ceil(numberValue(rankingsData?.total) / 100));

  const refreshAll = async () => {
    await refetch();
    if (selectedTournamentId) await refetchRankings();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }),
    ]);
  };

  const runSimulation = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/admin/simulator/run", { name, gameWeek, rarity, entries })).json(),
    onSuccess: async (body: any) => {
      const id = Number(body?.tournament?.id || 0);
      setSelectedTournamentId(id || null);
      setRankPage(1);
      setExpandedEntryId(null);
      await refreshAll();
      toast({
        title: "Simulation complete",
        description: `${body.entries || entries} bots scored and ranked. ${body.activePrize?.title || "Prize ladder calculated"}.`,
      });
    },
    onError: (error: any) =>
      toast({ title: "Simulation failed", description: error.message, variant: "destructive" }),
  });

  const settleTournament = useMutation({
    mutationFn: async () => {
      if (!selectedTournamentId) throw new Error("Select a tournament first");
      return (await apiRequest("POST", `/api/admin/simulator/tournament/${selectedTournamentId}/settle`)).json();
    },
    onSuccess: async (body: any) => {
      await refreshAll();
      toast({
        title: "Tournament settled",
        description: `${body.winner?.managerName || "Winner"} won ${body.prize?.title}. ${body.runnerUpCardsAwarded || 0} runner-up cards awarded.`,
      });
    },
    onError: (error: any) =>
      toast({ title: "Settlement failed", description: error.message, variant: "destructive" }),
  });

  const cleanup = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", "/api/admin/test-console/cleanup")).json(),
    onSuccess: async (body: any) => {
      setSelectedTournamentId(null);
      setRankPage(1);
      setExpandedEntryId(null);
      await refreshAll();
      toast({
        title: "Test tournaments removed",
        description: `${body.deletedTournaments || 0} isolated tournaments deleted.`,
      });
    },
    onError: (error: any) =>
      toast({ title: "Cleanup failed", description: error.message, variant: "destructive" }),
  });

  return (
    <main className="min-h-full overflow-x-hidden bg-slate-950 px-3 pb-32 pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-purple-300/20 bg-[linear-gradient(135deg,rgba(124,58,237,.18),rgba(37,99,235,.12),rgba(2,6,23,.96))] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-purple-100">
                <Beaker className="h-3.5 w-3.5" /> Unified admin simulator
              </div>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">Tournament Simulation Studio</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">
                Run test tournaments, inspect shared gameweek scores and verify Prize Vault unlocks before settlement.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/season-simulator">
                <Button variant="outline" className="border-white/15 bg-white/5 text-white">
                  <FastForward className="mr-2 h-4 w-4" /> Season Runner
                </Button>
              </Link>
              <Button onClick={() => refreshAll()} variant="outline" className="border-white/15 bg-white/5 text-white">
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button onClick={() => cleanup.mutate()} disabled={cleanup.isPending} variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Remove tests
              </Button>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Test tournaments use no entry fee pool. Shared rarity Prize Vault progression is tested separately from settlement.</p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <Stat icon={Trophy} label="Test tournaments" value={data?.counts?.testTournaments || 0} />
          <Stat icon={Bot} label="Bot entries" value={data?.counts?.testEntries || 0} />
          <Stat icon={Coins} label="Test adjustments" value={data?.counts?.testTransactions || 0} />
        </section>

        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">
          <div className="flex items-center gap-2 text-xl font-black">
            <Sparkles className="h-5 w-5 text-purple-200" /> Create and simulate
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-white/55">
              Tournament name
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional custom name" className="mt-1 border-white/10 bg-black/35" />
            </label>
            <label className="text-xs text-white/55">
              Gameweek
              <Input type="number" min={1} max={38} value={gameWeek} onChange={(e) => setGameWeek(Math.max(1, Math.min(38, Number(e.target.value) || 1)))} className="mt-1 border-white/10 bg-black/35" />
            </label>
            <label className="text-xs text-white/55">
              Rarity
              <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-black/35 px-3">
                {rarities.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/55">
              Entries (1–5,000)
              <Input type="number" min={1} max={5000} value={entries} onChange={(e) => setEntries(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} className="mt-1 border-white/10 bg-black/35" />
            </label>
          </div>
          <Button onClick={() => runSimulation.mutate()} disabled={runSimulation.isPending} className="mt-4 min-h-12 w-full bg-purple-500 font-black hover:bg-purple-400">
            <FastForward className="mr-2 h-4 w-4" />
            {runSimulation.isPending ? "Creating rankings…" : "Run complete simulation"}
          </Button>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[.72fr_1.28fr]">
          <Card className="border-white/10 bg-white/[.06] p-4 text-white">
            <div className="flex items-center gap-2 text-lg font-black">
              <Trophy className="h-5 w-5 text-cyan-200" /> Simulated tournaments
            </div>
            <div className="mt-4 max-h-[46rem] space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="text-sm text-white/45">Loading…</div>
              ) : data?.tournaments?.length ? (
                data.tournaments.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => {
                      setSelectedTournamentId(row.id);
                      setRankPage(1);
                      setExpandedEntryId(null);
                    }}
                    className={`w-full rounded-xl border p-3 text-left ${selectedTournamentId === row.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <b className="break-words">{row.name}</b>
                        <div className="mt-1 text-xs text-white/50">GW{row.gameWeek} • {row.tier} • {row.entryCount.toLocaleString()} entries</div>
                      </div>
                      <Badge className="capitalize">{row.status}</Badge>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/40">Run your first simulation.</div>
              )}
            </div>
          </Card>

          <Card className="min-w-0 border-white/10 bg-white/[.06] p-4 text-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-lg font-black">
                  <Activity className="h-5 w-5 text-emerald-200" /> Rankings before settlement
                </div>
                <p className="mt-1 text-xs text-white/45">Open an entry to inspect its five card scores.</p>
              </div>
              {selectedTournament && (
                <Button
                  onClick={() => settleTournament.mutate()}
                  disabled={settleTournament.isPending || selectedTournament.status === "completed" || !rankingsData?.activePrize}
                  className="bg-emerald-400 font-black text-slate-950 hover:bg-emerald-300"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  {selectedTournament.status === "completed" ? "Settled" : "Settle tournament"}
                </Button>
              )}
            </div>

            {!selectedTournamentId ? (
              <div className="mt-4 rounded-xl border border-dashed border-white/15 p-10 text-center text-white/40">Select a simulated tournament.</div>
            ) : rankingsLoading && !rankingsData ? (
              <div className="mt-4 p-8 text-center text-white/45">Loading rankings…</div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Mini label="Entries" value={numberValue(rankingsData?.total).toLocaleString()} />
                  <Mini label="Unlocked prize" value={rankingsData?.activePrize?.title || "Not unlocked"} />
                  <Mini label="Prize value" value={rankingsData?.activePrize ? money(rankingsData.activePrize.value) : `${rankingsData?.entrantsToNext || 0} more entries`} />
                </div>

                {numberValue(rankingsData?.total) > 100 && (
                  <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">
                    2nd–5th will each receive one random card matching the tournament rarity when settled.
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-black/35 text-[10px] uppercase tracking-[.12em] text-white/45">
                      <tr>
                        <th className="p-3">Rank</th>
                        <th className="p-3">Manager</th>
                        <th className="p-3">Score</th>
                        <th className="p-3">Cards</th>
                        <th className="p-3">Reward</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingsData?.rankings?.map((row) => (
                        <Fragment key={row.entryId}>
                          <tr className="border-t border-white/10">
                            <td className="p-3 font-black">#{row.rank}</td>
                            <td className="p-3">
                              <div className="font-bold">{row.managerName}</div>
                              <div className="max-w-[180px] truncate text-[10px] text-white/35">{row.userId}</div>
                            </td>
                            <td className="p-3 text-lg font-black text-cyan-200">{numberValue(row.totalScore).toFixed(1)}</td>
                            <td className="p-3">{row.pointsMeta?.cardBreakdown?.length || row.cardIds?.length || 0}</td>
                            <td className="p-3">{row.prizeAmount ? money(row.prizeAmount) : row.prizeCardId ? `Card #${row.prizeCardId}` : "—"}</td>
                            <td className="p-3">
                              <Button size="sm" variant="outline" onClick={() => setExpandedEntryId(expandedEntryId === row.entryId ? null : row.entryId)}>
                                {expandedEntryId === row.entryId ? "Hide points" : "View points"}
                              </Button>
                            </td>
                          </tr>

                          {expandedEntryId === row.entryId && (
                            <tr className="border-t border-white/10 bg-black/20">
                              <td colSpan={6} className="p-3">
                                <CardDetails row={row} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="outline" disabled={rankPage <= 1} onClick={() => setRankPage((page) => Math.max(1, page - 1))}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                  </Button>
                  <div className="text-xs text-white/45">Page {rankPage} of {totalPages}</div>
                  <Button variant="outline" disabled={rankPage >= totalPages} onClick={() => setRankPage((page) => page + 1)}>
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}

function CardDetails({ row }: { row: Ranking }) {
  const cards = row.pointsMeta?.cardBreakdown || [];
  if (!cards.length) return <div className="text-sm text-white/40">No card breakdown is available for this older test entry.</div>;

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {cards.map((card) => {
        const captain = numberValue(card.id) === numberValue(row.captainId);
        const legacy = card.points;
        const performance = card.performance || {};
        const officialScore = card.score ?? legacy?.total ?? 0;
        const captainMultiplier = numberValue(row.pointsMeta?.captainMultiplier) || 1;
        const counted = numberValue(officialScore) * (captain ? captainMultiplier : 1);

        return (
          <div key={card.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <b>{card.name || "Player"}</b>
                <div className="text-xs text-white/45">{card.team || "—"} • {card.position || "—"} • Card #{card.id}</div>
              </div>
              {captain && <Badge className="bg-yellow-300/20 text-yellow-100">Captain ×{captainMultiplier.toFixed(1)}</Badge>}
            </div>

            {legacy ? (
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                <Point label="Minutes" value={numberValue(legacy.minutes)} />
                <Point label="Goal" value={numberValue(legacy.goal)} />
                <Point label="Assist" value={numberValue(legacy.assist)} />
                <Point label="Clean sheet" value={numberValue(legacy.cleanSheet)} />
                <Point label="Bonus" value={numberValue(legacy.bonus)} />
                <Point label="Cards" value={numberValue(legacy.cards)} />
                <Point label="Base total" value={numberValue(legacy.total)} />
                <Point label="Counted" value={counted} />
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Point label="Official score" value={numberValue(card.score)} />
                  <Point label="Decisive" value={numberValue(card.decisiveScore)} />
                  <Point label="All-around" value={numberValue(card.allAroundScore)} />
                  <Point label="Counted" value={counted} />
                  <Point label="Minutes" value={numberValue(performance.minutes)} />
                  <Point label="Goals" value={numberValue(performance.goals)} />
                  <Point label="Assists" value={numberValue(performance.assists)} />
                  <Point label="Key passes" value={numberValue(performance.keyPasses)} />
                  <Point label="Tackles" value={numberValue(performance.tackles)} />
                  <Point label="Interceptions" value={numberValue(performance.interceptions)} />
                  <Point label="Duels won" value={numberValue(performance.duelsWon)} />
                  <Point label="Shots on target" value={numberValue(performance.shotsOnTarget)} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                  {performance.cleanSheet && <Badge variant="outline">Clean sheet</Badge>}
                  {performance.penaltySave && <Badge variant="outline">Penalty save</Badge>}
                  {performance.yellowCard && <Badge variant="outline">Yellow card</Badge>}
                  {performance.redCard && <Badge variant="destructive">Red card</Badge>}
                  {performance.ownGoal && <Badge variant="destructive">Own goal</Badge>}
                  {performance.penaltyMiss && <Badge variant="destructive">Penalty miss</Badge>}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="border-white/10 bg-white/[.06] p-3 text-white sm:p-4">
      <Icon className="h-4 w-4 text-amber-200" />
      <div className="mt-3 text-2xl font-black">{numberValue(value).toLocaleString()}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-white/45">{label}</div>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-[9px] font-black uppercase tracking-[.12em] text-white/35">{label}</div>
      <div className="mt-1 break-words font-black">{value}</div>
    </div>
  );
}

function Point({ label, value }: { label: string; value: number }) {
  const safeValue = numberValue(value);
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="text-[9px] uppercase text-white/35">{label}</div>
      <div className={`mt-1 font-black ${safeValue < 0 ? "text-red-300" : "text-white"}`}>
        {safeValue > 0 ? `+${Number.isInteger(safeValue) ? safeValue : safeValue.toFixed(1)}` : safeValue}
      </div>
    </div>
  );
}

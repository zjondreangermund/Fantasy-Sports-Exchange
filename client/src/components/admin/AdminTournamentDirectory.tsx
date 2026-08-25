import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import {
  ArrowLeft,
  BarChart3,
  CreditCard,
  Eye,
  Gift,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

type DirectoryProps = {
  onOpenUser: (userId: string) => void;
  onOpenCard: (cardId: string) => void;
  onOpenBackoffice: () => void;
  onOpenTransactions: () => void;
};

type PrizeState = {
  label: string;
  value: number;
  unlocked: boolean;
  nextLabel?: string;
  nextTarget?: number;
};

const categories = [
  { key: "prize-ladder", label: "Prize Ladders", helper: "Paid official tournaments linked to the Prize Vault" },
  { key: "free-cup", label: "FREE Card Cups", helper: "N$0 official card-reward tournaments" },
  { key: "user-cash", label: "User-created / cash", helper: "Creator tournaments and cash-pool competitions" },
];

function money(value: unknown) {
  const amount = Number(value || 0);
  return `N$${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function statusTone(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (["open", "active"].includes(value)) return "bg-emerald-500/20 text-emerald-100";
  if (value === "upcoming") return "bg-cyan-500/20 text-cyan-100";
  if (value === "cancelled") return "bg-rose-500/20 text-rose-100";
  if (["completed", "closed"].includes(value)) return "bg-slate-500/20 text-slate-200";
  return "bg-white/10 text-white/70";
}

function categoryTone(category: unknown) {
  if (category === "free-cup") return "border-emerald-300/25 bg-emerald-400/[.07]";
  if (category === "user-cash") return "border-amber-300/25 bg-amber-400/[.07]";
  return "border-purple-300/25 bg-purple-400/[.07]";
}

function compactDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NA", {
    timeZone: "Africa/Windhoek",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date) + " CAT";
}

export default function AdminTournamentDirectory({
  onOpenUser,
  onOpenCard,
  onOpenBackoffice,
  onOpenTransactions,
}: DirectoryProps) {
  const { toast } = useToast();
  const [selectedGameWeek, setSelectedGameWeek] = useState(0);
  const [statusFilter, setStatusFilter] = useState("current");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedTournamentId, setSelectedTournamentId] = useState(0);

  const {
    data: directoryPayload,
    isFetching: directoryFetching,
    refetch: refetchDirectory,
  } = useQuery<any>({
    queryKey: ["/api/admin/tournament-directory"],
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const { data: prizePayload } = useQuery<any>({ queryKey: ["/api/admin/prizes"] });

  const detailUrl = selectedTournamentId ? `/api/admin/competitions/${selectedTournamentId}/entrants` : "";
  const {
    data: detailPayload,
    isFetching: detailFetching,
    refetch: refetchDetail,
  } = useQuery<any>({ queryKey: [detailUrl], enabled: Boolean(selectedTournamentId), staleTime: 0 });

  const tournaments = asArray(directoryPayload?.tournaments);
  const gameWeeks = asArray<number>(directoryPayload?.gameWeeks);
  const prizes = asArray(prizePayload?.prizes);

  useEffect(() => {
    if (selectedGameWeek || !gameWeeks.length) return;
    const current = tournaments
      .filter((row: any) => ["open", "active"].includes(String(row.status || "").toLowerCase()))
      .map((row: any) => Number(row.gameWeek || 0))
      .filter(Boolean)
      .sort((a: number, b: number) => a - b)[0];
    const upcoming = tournaments
      .filter((row: any) => String(row.status || "").toLowerCase() === "upcoming")
      .map((row: any) => Number(row.gameWeek || 0))
      .filter(Boolean)
      .sort((a: number, b: number) => a - b)[0];
    setSelectedGameWeek(current || upcoming || Number(gameWeeks[0] || 1));
  }, [gameWeeks, selectedGameWeek, tournaments]);

  const prizesByRarity = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const prize of prizes) {
      const rarity = String(prize.rarity || "common").toLowerCase();
      (groups[rarity] ||= []).push(prize);
    }
    for (const group of Object.values(groups)) group.sort((a, b) => Number(a.requiredEntrants || 0) - Number(b.requiredEntrants || 0));
    return groups;
  }, [prizes]);

  const getPrizeState = (row: any): PrizeState => {
    const category = String(row?.category || "");
    if (category === "free-cup") {
      const rarity = String(row?.prizeCardRarity || "").toLowerCase();
      return {
        label: row?.prizeDescription || (rarity ? `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Player Card` : "Player Card"),
        value: 0,
        unlocked: true,
      };
    }
    if (category === "user-cash") {
      return { label: "Current cash prize pool", value: Number(row?.prizePoolTotal || 0), unlocked: true };
    }
    const rarity = String(row?.tier || "common").toLowerCase();
    const ladder = prizesByRarity[rarity] || [];
    const entries = Number(row?.entryCount || 0);
    const unlocked = [...ladder].filter((prize) => Number(prize.requiredEntrants || 0) <= entries).pop();
    const next = ladder.find((prize) => Number(prize.requiredEntrants || 0) > entries);
    return {
      label: unlocked?.title || "No prize unlocked yet",
      value: Number(unlocked?.value || 0),
      unlocked: Boolean(unlocked),
      nextLabel: next?.title,
      nextTarget: next ? Number(next.requiredEntrants || 0) : undefined,
    };
  };

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tournaments.filter((row: any) => {
      if (selectedGameWeek && Number(row.gameWeek || 0) !== selectedGameWeek) return false;
      if (rarityFilter !== "all" && String(row.tier || "").toLowerCase() !== rarityFilter) return false;
      if (categoryFilter !== "all" && String(row.category || "") !== categoryFilter) return false;
      const status = String(row.status || "").toLowerCase();
      if (statusFilter === "current" && !["open", "active", "upcoming"].includes(status)) return false;
      if (statusFilter === "archived" && !["completed", "closed", "cancelled"].includes(status)) return false;
      if (statusFilter !== "all" && !["current", "archived"].includes(statusFilter) && status !== statusFilter) return false;
      if (needle && !`${row.name} ${row.tier} ${row.status} ${row.creatorName} ${row.category} ${row.id}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [tournaments, selectedGameWeek, rarityFilter, categoryFilter, statusFilter, search]);

  const visibleTotals = useMemo(() => visible.reduce((totals: any, row: any) => {
    const prize = getPrizeState(row);
    const retained = Number(row.retainedEntryAmount || 0);
    totals.entries += Number(row.entryCount || 0);
    totals.received += retained;
    totals.prizes += prize.value;
    totals.profit += retained - prize.value;
    return totals;
  }, { entries: 0, received: 0, prizes: 0, profit: 0 }), [visible, prizesByRarity]);

  const removeMutation = useMutation({
    mutationFn: async ({ competitionId, entryId, reason }: { competitionId: number; entryId: number; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/competitions/${competitionId}/entrants/${entryId}/remove`, { reason });
      return response.json();
    },
    onSuccess: async (result: any) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/tournament-directory"] }),
        queryClient.invalidateQueries({ queryKey: [detailUrl] }),
        queryClient.invalidateQueries({ queryKey: ["/api/competitions"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/tournament-financials"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }),
      ]);
      void refetchDirectory();
      void refetchDetail();
      toast({
        title: result?.refundAmount > 0 ? "Entrant removed and refunded" : "Entrant removed",
        description: result?.refundAmount > 0 ? `${money(result.refundAmount)} returned to the user's wallet.` : "The user no longer counts as an entrant in this tournament.",
      });
    },
    onError: (error: any) => toast({ title: "Entrant removal failed", description: error?.message || "Could not remove this entrant", variant: "destructive" }),
  });

  const requestRemoval = (entry: any) => {
    const reason = window.prompt(
      `Reason for removing ${entry.teamName || entry.email || entry.userId}? This reason is saved to the audit trail.`,
      "Fraud / rules violation",
    );
    if (reason === null) return;
    if (reason.trim().length < 3) {
      toast({ title: "Reason required", description: "Enter a short reason before removing the entrant.", variant: "destructive" });
      return;
    }
    const refund = Number(entry.entryFeePaid || 0);
    const ok = window.confirm(
      refund > 0
        ? `Remove this entrant and refund ${money(refund)} to their Fantasy Arena wallet? Their tournament card locks will also be released.`
        : "Remove this entrant from the tournament? Their tournament card locks will also be released.",
    );
    if (!ok) return;
    removeMutation.mutate({ competitionId: selectedTournamentId, entryId: Number(entry.entryId), reason: reason.trim() });
  };

  if (selectedTournamentId) {
    const tournament = detailPayload?.tournament || tournaments.find((row: any) => Number(row.id) === selectedTournamentId) || {};
    const entrants = asArray(detailPayload?.entrants);
    const removed = asArray(detailPayload?.removed);
    const prize = getPrizeState(tournament);
    const retained = Number(tournament.retainedEntryAmount ?? tournament.activeEntryAmount ?? 0);
    const profit = retained - prize.value;

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <button type="button" onClick={() => setSelectedTournamentId(0)} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-cyan-200 hover:text-cyan-100"><ArrowLeft className="h-4 w-4" />Back to grouped tournaments</button>
            <div className="mt-3 flex flex-wrap items-center gap-2"><Badge className={statusTone(tournament.status)}>{String(tournament.status || "unknown")}</Badge><Badge variant="outline" className="capitalize border-white/15 text-white/70">GW{tournament.gameWeek} · {tournament.tier}</Badge></div>
            <h3 className="mt-2 break-words text-2xl font-black">{tournament.name || `Tournament #${selectedTournamentId}`}</h3>
            <p className="mt-1 text-xs text-white/45">Tournament #{selectedTournamentId} · {tournament.creatorName || "Fantasy Arena"} · {tournament.visibility || "public"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onOpenBackoffice} className="border-white/15 bg-white/[.04] text-white"><BarChart3 className="mr-2 h-4 w-4" />Builder / finance</Button>
            <Link href="/prize-vault"><Button type="button" variant="outline" className="border-emerald-300/25 bg-emerald-400/[.07] text-emerald-100"><Gift className="mr-2 h-4 w-4" />Prize Vault</Button></Link>
            <Link href="/competitions"><Button type="button" variant="outline" className="border-cyan-300/25 bg-cyan-400/[.07] text-cyan-100"><Trophy className="mr-2 h-4 w-4" />Tournament Arena</Button></Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <Stat label="Active entries" value={String(entrants.length || tournament.entryCount || 0)} helper={tournament.maxEntries ? `Max ${tournament.maxEntries}` : "No fixed cap"} />
          <Stat label="Entry fee" value={money(tournament.entryFee)} helper="Per entrant" />
          <Stat label="Received" value={money(retained)} helper="After admin entry refunds" />
          <Stat label="Current prize" value={money(prize.value)} helper={prize.label} />
          <Stat label="Profit" value={money(profit)} helper="Received minus current prize" warning={profit < 0} />
          <Stat label="Admin removed" value={String(removed.length || tournament.adminRemovedCount || 0)} helper={`Refunded ${money(tournament.adminRemovalRefundTotal || 0)}`} />
          <Stat label="Starts" value={compactDate(tournament.startDate)} helper="Tournament window" />
          <Stat label="Ends" value={compactDate(tournament.endDate)} helper="Settlement window" />
        </div>

        <Card className="border-purple-300/20 bg-purple-400/[.06] p-4 text-white">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div><div className="text-xs font-black uppercase tracking-[.13em] text-purple-200">Prize ladder check</div><div className="mt-1 text-lg font-black">{prize.label}</div></div>
            <div className="text-sm text-white/60">{prize.unlocked ? `Current prize cost ${money(prize.value)}` : prize.nextLabel ? `Next: ${prize.nextLabel} at ${prize.nextTarget} entries` : "No Prize Vault step is configured for this rarity."}</div>
          </div>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-black/25 text-white">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex items-center gap-2 text-lg font-black"><Users className="h-5 w-5 text-cyan-200" />Entrants</div><p className="mt-1 text-xs text-white/45">Open any user, inspect their lineup card IDs, or remove/refund an entrant when there is fraud or another valid admin reason.</p></div>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetchDetail()} disabled={detailFetching} className="border-white/15 bg-white/[.04] text-white"><RefreshCw className={`mr-2 h-4 w-4 ${detailFetching ? "animate-spin" : ""}`} />Refresh</Button>
          </div>
          <div className="divide-y divide-white/[.07]">
            {detailFetching && !detailPayload ? <div className="p-8 text-center text-sm text-white/45">Loading entrants…</div> : null}
            {!detailFetching && entrants.length === 0 ? <div className="p-8 text-center text-sm text-white/45">No active entrants in this tournament.</div> : null}
            {entrants.map((entry: any) => (
              <div key={entry.entryId} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => onOpenUser(String(entry.userId))} className="font-black text-cyan-100 hover:underline">{entry.teamName || entry.email || entry.userId}</button>{entry.rank ? <Badge variant="outline" className="border-white/15 text-white/65">Rank #{entry.rank}</Badge> : null}</div>
                  <div className="mt-1 break-all text-xs text-white/40">{entry.email || entry.userId} · Entry #{entry.entryId} · Joined {compactDate(entry.joinedAt)}</div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60"><span>Paid <b className="text-white">{money(entry.entryFeePaid)}</b></span><span>Score <b className="text-white">{Number(entry.totalScore || 0).toFixed(4)}</b></span><span>Wallet <b className="text-white">{money(entry.walletBalance)}</b></span><span>{asArray(entry.lineupCardIds).length} lineup cards</span></div>
                  {asArray(entry.lineupCardIds).length ? <details className="mt-2 text-xs"><summary className="cursor-pointer font-bold text-white/55">Lineup card IDs</summary><div className="mt-2 flex flex-wrap gap-1.5">{asArray(entry.lineupCardIds).map((cardId: any) => <button key={String(cardId)} type="button" onClick={() => onOpenCard(String(cardId))} className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 font-bold text-cyan-100 hover:bg-cyan-300/20">#{cardId}</button>)}</div></details> : null}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button type="button" size="sm" variant="outline" onClick={() => onOpenUser(String(entry.userId))} className="border-white/15 bg-white/[.04] text-white"><UserRound className="mr-2 h-4 w-4" />User</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => requestRemoval(entry)} disabled={removeMutation.isPending || String(tournament.status).toLowerCase() === "completed" || String(tournament.status).toLowerCase() === "cancelled"} className="border-rose-300/25 bg-rose-400/[.07] text-rose-100"><Trash2 className="mr-2 h-4 w-4" />{Number(entry.entryFeePaid || 0) > 0 ? `Remove + refund ${money(entry.entryFeePaid)}` : "Remove entrant"}</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <details className="rounded-2xl border border-rose-300/15 bg-rose-400/[.04] p-4 text-white">
          <summary className="cursor-pointer font-black"><span className="inline-flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-200" />Removed / refunded entrant history ({removed.length})</span></summary>
          <div className="mt-3 space-y-2">
            {removed.length ? removed.map((entry: any) => <div key={`${entry.entryId}-${entry.removedAt}`} className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><button type="button" onClick={() => onOpenUser(String(entry.userId))} className="font-black text-cyan-100 hover:underline">{entry.teamName || entry.email || entry.userId}</button><div className="mt-1 text-xs text-white/40">Entry #{entry.entryId} · removed {compactDate(entry.removedAt)}</div></div><div className="text-right"><div className="font-black text-emerald-200">Refund {money(entry.refundAmount)}</div>{entry.refundTransactionId ? <button type="button" onClick={onOpenTransactions} className="mt-1 text-xs font-bold text-cyan-200 hover:underline">Transaction #{entry.refundTransactionId}</button> : null}</div></div><div className="mt-2 text-xs text-white/60">Reason: {entry.removalReason || "Administrative removal"}</div></div>) : <div className="text-sm text-white/45">No admin removals have been recorded for this tournament.</div>}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="flex items-center gap-2 text-lg font-black"><Trophy className="h-5 w-5 text-amber-200" />Tournament directory</div><p className="mt-1 max-w-3xl text-sm text-white/45">Grouped by gameweek and tournament type so the full season is not dumped onto one screen. Open a tournament for entrants, refunds, prize ladder and live profit detail.</p></div>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onOpenBackoffice} className="border-white/15 bg-white/[.04] text-white"><BarChart3 className="mr-2 h-4 w-4" />Builder / full finance</Button><Button type="button" variant="outline" onClick={() => void refetchDirectory()} disabled={directoryFetching} className="border-white/15 bg-white/[.04] text-white"><RefreshCw className={`mr-2 h-4 w-4 ${directoryFetching ? "animate-spin" : ""}`} />Refresh</Button></div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[150px_170px_170px_150px_minmax(220px,1fr)]">
          <label className="text-xs text-white/55"><span className="mb-1 block">Gameweek</span><select value={selectedGameWeek || ""} onChange={(event) => setSelectedGameWeek(Number(event.target.value || 0))} className="h-10 w-full rounded-md border border-white/10 bg-[#080d1f] px-3 text-white"><option value="">All gameweeks</option>{gameWeeks.map((gw) => <option key={gw} value={gw}>GW{gw}</option>)}</select></label>
          <label className="text-xs text-white/55"><span className="mb-1 block">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#080d1f] px-3 text-white"><option value="current">Current / upcoming</option><option value="archived">Archived</option><option value="all">All status</option><option value="open">Open</option><option value="active">Active</option><option value="upcoming">Upcoming</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
          <label className="text-xs text-white/55"><span className="mb-1 block">Tournament type</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#080d1f] px-3 text-white"><option value="all">All types</option><option value="prize-ladder">Prize Ladders</option><option value="free-cup">FREE Card Cups</option><option value="user-cash">User-created / cash</option></select></label>
          <label className="text-xs text-white/55"><span className="mb-1 block">Rarity</span><select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#080d1f] px-3 capitalize text-white"><option value="all">All rarities</option><option value="common">common</option><option value="rare">rare</option><option value="unique">unique</option><option value="epic">epic</option><option value="legendary">legendary</option></select></label>
          <label className="text-xs text-white/55"><span className="mb-1 block">Search</span><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, creator, rarity or ID" className="h-10 border-white/10 bg-[#080d1f] pl-9 text-white" /></div></label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Visible entries" value={String(visibleTotals.entries)} helper={`${visible.length} tournament(s)`} />
        <Stat label="Entry amount received" value={money(visibleTotals.received)} helper="Retained after admin entry refunds" />
        <Stat label="Current prizes" value={money(visibleTotals.prizes)} helper="Unlocked / current prize cost" />
        <Stat label="Current profit" value={money(visibleTotals.profit)} helper="Entry amount minus current prizes" warning={visibleTotals.profit < 0} />
      </div>

      {categories.map((group) => {
        const rows = visible.filter((row: any) => row.category === group.key);
        if (!rows.length) return null;
        return <details key={group.key} open className={`rounded-2xl border ${categoryTone(group.key)} p-3 sm:p-4`}><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><div className="font-black">{group.label} <span className="text-white/40">({rows.length})</span></div><div className="mt-1 text-xs text-white/45">{group.helper}</div></div><Badge variant="outline" className="border-white/15 text-white/65">GW{selectedGameWeek || "All"}</Badge></div></summary><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rows.map((row: any) => {
          const prize = getPrizeState(row);
          const retained = Number(row.retainedEntryAmount || 0);
          const profit = retained - prize.value;
          return <button key={row.id} type="button" onClick={() => setSelectedTournamentId(Number(row.id))} className="rounded-xl border border-white/10 bg-black/30 p-3 text-left transition hover:border-cyan-300/35 hover:bg-white/[.06]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate font-black text-white">{row.name}</div><div className="mt-1 text-[10px] text-white/40">Tournament #{row.id} · GW{row.gameWeek} · {row.creatorName || "Fantasy Arena"}</div></div><Badge className={statusTone(row.status)}>{row.status}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Metric label="Entries" value={`${row.entryCount || 0}${row.maxEntries ? `/${row.maxEntries}` : ""}`} /><Metric label="Received" value={money(retained)} /><Metric label="Current prize" value={prize.unlocked ? money(prize.value) : "Not unlocked"} /><Metric label="Profit" value={money(profit)} good={profit >= 0} /></div><div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[.07] pt-2 text-[10px] text-white/45"><span className="truncate">{prize.label}{!prize.unlocked && prize.nextTarget ? ` · next at ${prize.nextTarget}` : ""}</span><span className="shrink-0 font-black uppercase tracking-[.1em] text-cyan-200">Open →</span></div></button>;
        })}</div></details>;
      })}

      {!directoryFetching && visible.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-10 text-center"><Trophy className="mx-auto h-8 w-8 text-white/25" /><div className="mt-3 font-black text-white/70">No tournaments match these filters.</div><button type="button" onClick={() => { setStatusFilter("all"); setRarityFilter("all"); setCategoryFilter("all"); setSearch(""); }} className="mt-2 text-sm font-bold text-cyan-200 hover:underline">Clear filters</button></div> : null}
    </div>
  );
}

function Stat({ label, value, helper, warning = false }: { label: string; value: string; helper?: string; warning?: boolean }) {
  return <div className={`min-w-0 rounded-xl border p-3 ${warning ? "border-rose-300/20 bg-rose-400/[.06]" : "border-white/10 bg-black/25"}`}><div className="text-[9px] font-black uppercase tracking-[.13em] text-white/35">{label}</div><div className={`mt-1 break-words text-lg font-black ${warning ? "text-rose-100" : "text-white"}`}>{value}</div>{helper ? <div className="mt-1 line-clamp-2 text-[10px] text-white/40">{helper}</div> : null}</div>;
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div className="rounded-lg border border-white/[.07] bg-white/[.025] p-2"><div className="text-[9px] font-black uppercase tracking-[.1em] text-white/30">{label}</div><div className={`mt-1 font-black ${good === undefined ? "text-white/80" : good ? "text-emerald-200" : "text-rose-200"}`}>{value}</div></div>;
}

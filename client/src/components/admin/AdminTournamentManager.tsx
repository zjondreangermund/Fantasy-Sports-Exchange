import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";
import { CheckCircle2, Gift, Plus, Save, Trash2, Trophy } from "lucide-react";
import { AlertTriangle, BarChart3, RefreshCw, Search } from "lucide-react";

const rarityOptions = ["common", "rare", "unique", "epic", "legendary"];
const statusOptions = ["open", "upcoming", "active", "closed"];
const entryFeeByRarity: Record<string, number> = { common: 10, rare: 50, unique: 100, epic: 250, legendary: 500 };
const marginByRarity: Record<string, number> = { common: 2.0, rare: 1.8, unique: 1.7, epic: 1.6, legendary: 1.5 };
const nextCardRarity: Record<string, string> = { common: "rare", rare: "unique", unique: "epic", epic: "legendary", legendary: "legendary" };
const rarityTone: Record<string, string> = {
  common: "border-slate-300/30 bg-slate-300/10 text-slate-100",
  rare: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  unique: "border-purple-300/40 bg-purple-500/15 text-purple-100",
  epic: "border-red-300/40 bg-red-500/15 text-red-100",
  legendary: "border-amber-300/40 bg-amber-400/15 text-amber-100",
};

function cap(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : ""; }
function money(value: unknown) { const n = Number(value || 0); return `N$${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`; }
function isoLocal(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultStartForGw(gw: number) { const base = new Date("2026-08-14T19:00:00+02:00"); base.setDate(base.getDate() + (Math.max(1, gw) - 1) * 7); return isoLocal(base); }
function defaultEndForGw(gw: number) {
  const d = new Date(defaultStartForGw(gw));
  let daysForward = (2 - d.getDay() + 7) % 7;
  if (daysForward === 0) daysForward = 7;
  d.setDate(d.getDate() + daysForward);
  d.setHours(23, 59, 0, 0);
  return isoLocal(d);
}
function settlementLabel(value: unknown) {
  if (!value) return "Not set";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-NA", { timeZone: "Africa/Windhoek", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(date) + " CAT";
}
function buildEmptyForm() {
  return {
    id: "", name: "GW1 Rare Vault", tier: "rare", status: "open", gameWeek: "1",
    entryFee: "50", maxEntries: "5000", visibility: "public", rewardMode: "ladder",
    prizeType: "goods", prizeKey: "ladder", prizeDescription: "Rare Prize Vault ladder",
    cardPrizeRarity: "unique", startDate: defaultStartForGw(1), endDate: defaultEndForGw(1),
  };
}

export default function AdminTournamentManager() {
  const { toast } = useToast();
  const [form, setForm] = useState(buildEmptyForm());
  const [previewRarity, setPreviewRarity] = useState("rare");
  const [financialSearch, setFinancialSearch] = useState("");
  const [tournamentListView, setTournamentListView] = useState<"current" | "closed">("closed");
  const [selectedGameWeek, setSelectedGameWeek] = useState("");
  const [bulkSettlement, setBulkSettlement] = useState<any>(null);
  const { data: competitions } = useQuery<any[]>({ queryKey: ["/api/competitions"] });
  const { data: prizePayload } = useQuery<any>({ queryKey: ["/api/admin/prizes"] });
  const { data: financialPayload, isFetching: financialsFetching, refetch: refreshFinancials } = useQuery<any>({
    queryKey: ["/api/admin/tournament-financials"],
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const financialSummary = financialPayload?.summary || {};
  const financialRows = Array.isArray(financialPayload?.tournaments) ? financialPayload.tournaments : [];
  const visibleFinancialRows = useMemo(() => {
    const needle = financialSearch.trim().toLowerCase();
    if (!needle) return financialRows;
    return financialRows.filter((row: any) => `${row.name} ${row.creatorName} ${row.category} ${row.tier} ${row.status} ${row.gameWeek}`.toLowerCase().includes(needle));
  }, [financialRows, financialSearch]);
  const prizes = Array.isArray(prizePayload?.prizes) ? prizePayload.prizes : [];
  const sortedCompetitions = useMemo(() => [...(Array.isArray(competitions) ? competitions : [])].sort((a, b) => Number(a.gameWeek || 0) - Number(b.gameWeek || 0) || Number(a.id || 0) - Number(b.id || 0)), [competitions]);
  const officialCompetitions = sortedCompetitions.filter((comp) => String(comp.prizeKey || comp.prize_key || "") !== "user-cash");
  const activeCompetitions = officialCompetitions.filter((comp) => !["completed", "closed", "cancelled"].includes(String(comp.status || "").toLowerCase()));
  const completedCompetitions = officialCompetitions.filter((comp) => ["completed", "closed", "cancelled"].includes(String(comp.status || "").toLowerCase()));
  const latestFinishedGameWeek = Math.max(1, ...officialCompetitions.filter((comp) => { const deadline = Date.parse(String(comp.endDate || comp.end_date || "")); return Number.isFinite(deadline) && deadline <= Date.now(); }).map((comp) => Number(comp.gameWeek || comp.game_week || 0)));
  const targetGameWeek = Number(selectedGameWeek || latestFinishedGameWeek);
  const { data: gwRecovery, isFetching: gwAuditing, refetch: auditGw } = useQuery<any>({
    queryKey: [`/api/admin/competitions/recovery-audit/${targetGameWeek}`],
    enabled: false,
    staleTime: 0,
  });
  const prizesByRarity = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const rarity of rarityOptions) groups[rarity] = [];
    for (const prize of prizes) groups[String(prize.rarity || "common").toLowerCase()]?.push(prize);
    for (const rarity of rarityOptions) groups[rarity].sort((a, b) => Number(a.requiredEntrants || 0) - Number(b.requiredEntrants || 0));
    return groups;
  }, [prizes]);
  const selectedLadder = prizesByRarity[form.tier] || [];
  const nextPrize = selectedLadder[0];
  const isCardPrize = form.rewardMode === "card";

  const setField = (key: string, value: string) => {
    setForm((prev) => {
      const next: any = { ...prev, [key]: value };
      if (key === "gameWeek") {
        const gw = Number(value || 1);
        const scheduled = officialCompetitions.find((comp: any) =>
          Number(comp.gameWeek || comp.game_week || 0) === gw &&
          String(comp.prizeKey || comp.prize_key || "") === "ladder");
        next.startDate = scheduled ? isoLocal(scheduled.startDate || scheduled.start_date) : defaultStartForGw(gw);
        next.endDate = scheduled ? isoLocal(scheduled.endDate || scheduled.end_date) : defaultEndForGw(gw);
      }
      if (key === "rewardMode" && value === "card") {
        next.tier = "common";
        next.entryFee = "0";
        next.cardPrizeRarity = "rare";
        next.prizeKey = "free-weighted-card";
        next.prizeDescription = "1st Rare 95%, Unique 4.5%, Epic 0.45%, Legendary 0.05%; 2nd & 3rd Common";
      }
      if (key === "tier" && next.rewardMode !== "card") {
        setPreviewRarity(value);
        next.entryFee = String(entryFeeByRarity[value] || 50);
        next.prizeKey = "ladder";
        next.prizeDescription = `${cap(value)} Prize Vault ladder`;
      }
      if (key === "rewardMode" && value !== "card") {
        next.entryFee = String(entryFeeByRarity[String(next.tier)] || 50);
        next.prizeKey = "ladder";
        next.prizeDescription = `${cap(String(next.tier))} Prize Vault ladder`;
      }
      if (key === "gameWeek" || key === "rewardMode" || key === "tier") {
        if (!String(prev.name || "").trim() || /^GW\d+\s/i.test(String(prev.name))) {
          next.name = next.rewardMode === "card"
            ? `GW${next.gameWeek || 1} FREE Common Card Cup`
            : `GW${next.gameWeek || 1} ${cap(String(next.tier))} Vault`;
        }
      }
      return next;
    });
  };

  const applyFreeCupPreset = (_tier: string = "common") => {
    setForm((prev) => ({
      ...prev,
      id: "",
      tier: "common",
      rewardMode: "card",
      entryFee: "0",
      cardPrizeRarity: "rare",
      prizeType: "goods",
      prizeKey: "free-weighted-card",
      prizeDescription: "1st Rare 95%, Unique 4.5%, Epic 0.45%, Legendary 0.05%; 2nd & 3rd Common",
      name: `GW${prev.gameWeek || 1} FREE Common Card Cup`,
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cardMode = form.rewardMode === "card";
      const body = {
        name: form.name,
        tier: cardMode ? "common" : form.tier,
        status: form.status,
        gameWeek: Number(form.gameWeek || 1),
        entryFee: cardMode ? 0 : Number(form.entryFee || 0),
        maxEntries: Number(form.maxEntries || 0),
        visibility: form.visibility,
        prizeMode: cardMode ? "card" : "ladder",
        prizeCardRarity: cardMode ? form.cardPrizeRarity : null,
        prizeType: "goods",
        prizeKey: cardMode ? "free-weighted-card" : "ladder",
        prizeDescription: cardMode ? "1st Rare 95%, Unique 4.5%, Epic 0.45%, Legendary 0.05%; 2nd & 3rd Common" : `${cap(form.tier)} Prize Vault ladder`,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      };
      const res = await apiRequest(form.id ? "PATCH" : "POST", form.id ? `/api/admin/competitions/${form.id}` : "/api/admin/competitions", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tournament-financials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: form.id ? "Tournament updated" : "Tournament created",
        description: form.rewardMode === "card" ? "One weekly Free Cup with securely drawn first-place card rarity." : `${cap(form.tier)} Prize Ladder linked (admin only).`,
      });
      if (!form.id) setForm(buildEmptyForm());
    },
    onError: (error: any) => toast({ title: "Tournament save failed", description: error.message, variant: "destructive" }),
  });

  const settleMutation = useMutation({
    mutationFn: async (competitionId: number) => (await apiRequest("POST", `/api/admin/competitions/settle/${competitionId}`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions/my-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backoffice?range=30d"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tournament-financials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      void auditGw();
      toast({ title: "Tournament settled", description: "Final-match verified scores, ranks and prizes are now final." });
    },
    onError: (error: any) => {
      const raw = String(error?.message || "Unable to settle tournament");
      let message = raw;
      try {
        const jsonStart = raw.indexOf("{");
        if (jsonStart >= 0) {
          const payload = JSON.parse(raw.slice(jsonStart));
          message = String(payload?.message || raw);
          if (payload?.code === "SCORING_NOT_VERIFIED") {
            window.alert("Settlement blocked — not all players have verified final statistics.\n\n" + message + "\n\nThe tournament remains unsettled, and prizes have not been issued by this attempt.");
            return;
          }
        }
      } catch {}
      window.alert("Tournament settlement could not finish.\n\n" + message);
      toast({ title: "Tournament settlement failed", description: message, variant: "destructive" });
    },
  });

  const settleGameWeekMutation = useMutation({
    mutationFn: async (gameWeek: number) => (await apiRequest("POST", `/api/admin/competitions/settle-gameweek/${gameWeek}`, {})).json(),
    onSuccess: (result: any) => {
      setBulkSettlement(result);
      for (const key of ["/api/competitions", "/api/competitions/my-entries", "/api/prize-vault", "/api/admin/tournament-financials", "/api/admin/stats", "/api/admin/entry-monitor"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast({
        title: result.blocked ? `GW${result.gameWeek}: ${result.blocked} need attention` : `GW${result.gameWeek} settled`,
        description: `${result.settled} tournament(s) settled; previously completed results and rewards preserved.`,
        variant: result.blocked ? "destructive" : undefined,
      });
    },
    onError: (error: any) => toast({ title: "Gameweek settlement failed", description: String(error?.message || "Unknown error"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (competitionId: number) => (await apiRequest("DELETE", `/api/admin/competitions/${competitionId}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backoffice?range=30d"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tournament-financials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setForm(buildEmptyForm());
      toast({ title: "Tournament deleted" });
    },
    onError: (error: any) => toast({ title: "Tournament deletion failed", description: error.message, variant: "destructive" }),
  });

  const requestGameWeekSettlement = () => {
    if (!window.confirm(`Settle every eligible tournament in Gameweek ${targetGameWeek}? Empty cups will close with no rewards. Already completed awards will never be rerolled. Unverified scores will remain blocked.`)) return;
    settleGameWeekMutation.mutate(targetGameWeek);
  };

  const requestDelete = (comp: any) => {
    if (!window.confirm(`Delete "${comp.name || "this tournament"}" and all related entries? This cannot be undone.`)) return;
    deleteMutation.mutate(Number(comp.id));
  };
  const requestSettlement = (comp: any) => {
    if (!window.confirm(`Settle "${comp.name || "this tournament"}" using the score frozen at ${settlementLabel(comp.endDate || comp.end_date)}?`)) return;
    settleMutation.mutate(Number(comp.id));
  };

  const loadCompetition = (comp: any) => {
    const tier = String(comp.tier || "common").toLowerCase();
    const prizeKey = String(comp.prizeKey || comp.prize_key || "");
    const prizeCardRarity = String(comp.prizeCardRarity || comp.prize_card_rarity || nextCardRarity[tier] || tier).toLowerCase();
    const rewardMode = prizeKey.startsWith("free-") && Boolean(prizeCardRarity) ? "card" : "ladder";
    setPreviewRarity(tier);
    setForm({
      id: String(comp.id || ""), name: comp.name || "", tier, status: String(comp.status || "open"),
      gameWeek: String(comp.gameWeek || comp.game_week || 1),
      entryFee: rewardMode === "card" ? "0" : String(comp.entryFee ?? comp.entry_fee ?? entryFeeByRarity[tier] ?? 50),
      maxEntries: String(comp.maxEntries ?? comp.max_entries ?? ""), visibility: String(comp.visibility || "public"),
      rewardMode, prizeType: "goods", prizeKey: rewardMode === "card" ? prizeKey : "ladder",
      prizeDescription: String(comp.prizeDescription || comp.prize_description || (rewardMode === "card" ? `${cap(prizeCardRarity)} Player Card` : `${cap(tier)} Prize Vault ladder`)),
      cardPrizeRarity: prizeCardRarity,
      startDate: isoLocal(comp.startDate || comp.start_date), endDate: isoLocal(comp.endDate || comp.end_date),
    });
  };

  return (
    <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-black"><Trophy className="h-5 w-5 text-yellow-300" /> Official Tournament Builder</div>
          <p className="mt-1 text-sm text-white/45">Prize Ladder and player-card prizes are official admin rewards. User-created tournaments are kept separate and cash-only.</p>
        </div>
        <div className="flex gap-2"><Link href="/prize-vault"><Button variant="outline" className="rounded-xl border-emerald-300/30 bg-emerald-300/10 text-emerald-100"><Gift className="mr-2 h-4 w-4" />Prize Vault</Button></Link><Button onClick={() => setForm(buildEmptyForm())} className="rounded-xl bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><Plus className="mr-2 h-4 w-4" />New</Button></div>
      </div>

      <section className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-400/[.04] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[140px] flex-1 space-y-1 text-sm">
            <span className="font-bold text-emerald-100">Settle whole gameweek</span>
            <select value={targetGameWeek} onChange={(event) => setSelectedGameWeek(event.target.value)} className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white">
              {Array.from({length:38}, (_, index) => index + 1).map((week) => <option key={week} value={week}>Gameweek {week}</option>)}
            </select>
          </label>
          <Button type="button" disabled={settleGameWeekMutation.isPending} onClick={requestGameWeekSettlement} className="bg-emerald-300 font-black text-slate-950 hover:bg-emerald-200">
            <CheckCircle2 className="mr-2 h-4 w-4" />{settleGameWeekMutation.isPending ? "Settling gameweek…" : "Settle Gameweek"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-white/60">Settles every eligible cup for the selected week, including cups with zero entries. Pending API-Football scores remain blocked. Completed rewards are not repeated.</p>
        {bulkSettlement ? <div className="mt-3 max-h-[65vh] space-y-3 overflow-y-auto rounded-lg border border-white/10 p-3 text-xs">
          <p className="font-bold">GW{bulkSettlement.gameWeek}: {bulkSettlement.settled} settled, {bulkSettlement.blocked} blocked</p>
          {bulkSettlement.blocked > 0 ? <div role="alert" className="rounded-lg border border-red-300/30 bg-red-400/10 p-3">
            <p className="mb-2 font-bold text-red-100">{bulkSettlement.blocked} tournament(s) need attention — no prizes issued for these blocked cups</p>
            {bulkSettlement.results?.filter((item: any) => item.result === "blocked").map((item: any) => <div key={item.id} className="border-t border-red-200/15 py-2">
              <p className="font-semibold text-white">{item.name} (#{item.id}) {item.code ? `• ${item.code}` : ""}</p>
              <p className="mt-1 text-red-100">{item.message}</p>
              {item.cutoffAt ? <p className="mt-1 text-white/75">Settlement cutoff: {settlementLabel(item.cutoffAt)}</p> : null}
              {item.unresolvedCardIds?.length ? <p className="mt-1 text-white/70">Unverified card IDs: {item.unresolvedCardIds.join(", ")}</p> : null}
            </div>)}
          </div> : null}
          {bulkSettlement.results?.filter((item: any) => item.result !== "blocked").map((item: any) =>
            <div key={item.id} className="break-words border-t border-white/10 py-2"><span className="font-semibold">{item.name}</span> — {item.result.replaceAll("_"," ")}: {item.message}</div>
          )}
          {bulkSettlement.nextGameweek ? <p className="rounded-lg border border-white/10 p-2 text-white/80">
            GW{bulkSettlement.nextGameweek.gameWeek} opening: {String(bulkSettlement.nextGameweek.status || "unknown").replaceAll("_"," ")}.
            {Number(bulkSettlement.nextGameweek.opened || 0) > 0 ? ` ${bulkSettlement.nextGameweek.opened} official cups opened; notifications link to Play.` : ""}
          </p> : null}
        </div> : null}
      </section>

      <section className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-400/[.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-black text-amber-100">GW{targetGameWeek} settlement recovery audit</h3><p className="mt-1 text-xs text-white/60">Review original scoring, locks, payouts and prizes here. For a Closed cup, use Settle Gameweek above; completed cups remain protected against duplicate awards.</p></div>
          <Button type="button" variant="outline" disabled={gwAuditing} onClick={() => { void auditGw(); }} className="border-amber-300/30 text-amber-100"><RefreshCw className={`mr-2 h-4 w-4 ${gwAuditing ? "animate-spin" : ""}`} />{gwAuditing ? `Checking GW${targetGameWeek}…` : `Audit GW${targetGameWeek}`}</Button>
        </div>
        {gwRecovery ? <div className="mt-3 space-y-2">{gwRecovery.tournaments?.length ? gwRecovery.tournaments.map((cup: any) => <div key={cup.id} className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-white">{cup.name}</b><Badge variant="outline">{cup.status}</Badge></div><div className="mt-2 text-white/65">{cup.entryCount} entries · {cup.unverifiedEntries} unverified snapshots · {cup.activeCardLocks} active card locks · {cup.paidEntryCount} cash payouts · {cup.mintedPrizeCount} minted cards · {cup.prizeAwardCount} award records ({cup.unclaimedAwardCount} pending claims)</div><p className="mt-1 text-amber-100">{cup.recoveryStatus}</p>
            {cup.unfinishedFixtureDetails?.length ? <div className="mt-2 space-y-2">{cup.unfinishedFixtureDetails.map((fixture: any) => <div key={fixture.id} className="rounded-lg border border-orange-300/20 bg-orange-400/10 p-2 text-xs text-orange-100"><b>{fixture.homeTeam} vs {fixture.awayTeam}</b> · Fixture #{fixture.id}<div className="mt-0.5">Scheduled: {fixture.kickoffTime ? settlementLabel(fixture.kickoffTime) : "Date not supplied"} · FPL FT: {fixture.fplFinished ? "Yes" : "No"} · API-Football matched FT: {fixture.verifiedByApiFootball ? "Yes" : "No"}</div><p className="mt-0.5 text-orange-100/75">Not verified final; not necessarily postponed. Check the official match result before excluding it.</p></div>)}</div> : null}
            {cup.postponedFixtureDetails?.length ? <div className="mt-2 rounded-lg border border-sky-300/20 bg-sky-400/10 p-2 text-xs text-sky-100"><b>Moved outside this GW (excluded from points):</b>{cup.postponedFixtureDetails.map((fixture: any) => <p key={fixture.id} className="mt-1">#{fixture.id}: {fixture.homeTeam} vs {fixture.awayTeam} · {fixture.kickoffTime ? settlementLabel(fixture.kickoffTime) : "Rescheduled date not confirmed"}</p>)}</div> : null}{String(cup.status).toLowerCase() === "closed" ? <Button type="button" disabled={settleMutation.isPending || Number(cup.unverifiedEntries || 0) > 0} onClick={() => requestSettlement(cup)} className="mt-3 w-full bg-emerald-300 font-black text-slate-950 hover:bg-emerald-200"><CheckCircle2 className="mr-2 h-4 w-4" />{settleMutation.isPending ? "Settling…" : Number(cup.unverifiedEntries || 0) > 0 ? "Waiting for verified scores" : `Settle GW${targetGameWeek} — finalize prizes & unlock cards`}</Button> : null}</div>) : <p className="text-sm text-white/60">No tournaments found for GW{targetGameWeek}.</p>}<p className="text-xs text-white/50">Completed tournaments cannot be safely settled a second time without reconciling original rewards. A zero-point player is not automatically an unverified player.</p></div> : null}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-black/30">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black"><BarChart3 className="h-4 w-4 text-cyan-200" />Tournament entries &amp; financial reconciliation</h3>
            <p className="mt-1 text-xs text-white/50">Every official, free and user-created tournament, using recorded Fantasy Arena entries, fees, refunds and payouts.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" /><Input value={financialSearch} onChange={(event) => setFinancialSearch(event.target.value)} placeholder="Search tournaments, managers, GW…" className="h-9 w-full border-white/10 bg-black/40 pl-8 text-xs text-white lg:w-64" /></div>
            <Button type="button" size="icon" variant="outline" aria-label="Refresh actual tournament values" onClick={() => { void refreshFinancials(); }} className="h-9 w-9 shrink-0 border-white/15 bg-white/[.04] text-white"><RefreshCw className={`h-4 w-4 ${financialsFetching ? "animate-spin" : ""}`} /></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4 xl:grid-cols-8">
          <FinancialStat label="Tournaments" value={String(financialSummary.tournaments || 0)} helper="All tournament types" />
          <FinancialStat label="Actual entries" value={String(financialSummary.entries || 0)} helper={`${financialSummary.paidEntries || 0} paid · ${financialSummary.freeEntries || 0} free`} />
          <FinancialStat label="Collected" value={money(financialSummary.grossEntryAmount)} helper="Recorded entry payments" />
          <FinancialStat label="Net receipts" value={money(financialSummary.netCollected)} helper={`Refunds ${money(financialSummary.refunds)}`} />
          <FinancialStat label="Platform fees" value={money(financialSummary.platformFees)} helper="Actually recorded" />
          <FinancialStat label="Prize pools" value={money(financialSummary.prizePools)} helper="Actual tournament pools" />
          <FinancialStat label="Paid out" value={money(financialSummary.cashPayouts)} helper={`Outstanding ${money(financialSummary.outstandingPrizePools)}`} />
          <FinancialStat label="Mismatches" value={String(financialSummary.reconciliationDifferences || 0)} helper="Expected versus collected" warning={Number(financialSummary.reconciliationDifferences || 0) > 0} />
        </div>
        <div className="max-h-[24rem] overflow-auto border-t border-white/10">
          <table className="w-full min-w-[1140px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#101423] text-[10px] font-black uppercase tracking-[.12em] text-white/50"><tr>{["Tournament / owner", "GW / status", "Entries", "Entry fee", "Collected", "Difference", "Platform", "Prize pool", "Paid / refunded"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
            <tbody>{visibleFinancialRows.length ? visibleFinancialRows.map((row: any) => <tr key={row.id} className="border-t border-white/[.07] text-white/80 hover:bg-white/[.035]"><td className="px-3 py-3"><div className="max-w-[240px] truncate font-bold text-white">{row.name}</div><div className="mt-0.5 text-[10px] text-white/45">{row.category === "user-cash" ? `Cash · ${row.creatorName}` : row.category === "free-cup" ? "Official free card cup" : "Official Prize Vault"}</div></td><td className="px-3 py-3"><div>GW{row.gameWeek}</div><div className="capitalize text-white/45">{row.status}</div></td><td className="px-3 py-3 font-bold">{row.entryCount}{Number(row.maxEntries) > 0 ? `/${row.maxEntries}` : ""}<div className="text-[10px] font-normal text-white/45">{row.uniqueManagers} managers</div></td><td className="px-3 py-3">{money(row.entryFee)}</td><td className="px-3 py-3 font-bold text-emerald-200">{money(row.grossEntryAmount)}</td><td className={`px-3 py-3 font-bold ${Number(row.entryAmountDifference) !== 0 ? "text-amber-200" : "text-white/55"}`}>{Number(row.entryAmountDifference) !== 0 ? money(row.entryAmountDifference) : "Balanced"}</td><td className="px-3 py-3">{money(row.platformFees)}<div className="text-[10px] text-white/45">{Number(row.platformFeeRate || 0) * 100}%</div></td><td className="px-3 py-3">{money(row.prizePool)}</td><td className="px-3 py-3"><div>{money(row.cashPayouts)} paid</div><div className="text-[10px] text-white/45">{money(row.refundTotal)} refunded{Number(row.awardedCards) > 0 ? ` · ${row.awardedCards} cards` : ""}</div></td></tr>) : <tr><td colSpan={9} className="px-4 py-8 text-center text-white/45">{financialsFetching ? "Loading actual tournament records…" : "No tournaments match this search."}</td></tr>}</tbody>
          </table>
        </div>
        <p className="border-t border-white/10 px-4 py-2 text-[10px] text-white/45">Values refresh every 15 seconds. Recorded entries and wallet movements are never estimated or counted twice.</p>
      </section>

      <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
        <div className="mb-2 text-xs font-black uppercase tracking-[.16em] text-emerald-100">Weekly FREE Card Cup — one tournament per GW</div>
        <Button type="button" size="sm" variant="outline" onClick={() => applyFreeCupPreset("common")} className="border-emerald-300/30 bg-black/20 text-emerald-50">Set up FREE Common Card Cup</Button>
        <p className="mt-2 text-xs text-emerald-100/70">1st place odds: Rare 95%, Unique 4.5%, Epic 0.45%, Legendary 0.05%. Second and third receive Common cards.</p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2"><span className="text-white/55">Tournament name</span><Input value={form.name} onChange={(e) => setField("name", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Gameweek 26/27</span><Input type="number" min="1" max="38" value={form.gameWeek} onChange={(e) => setField("gameWeek", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Entry card rarity</span><select value={isCardPrize ? "common" : form.tier} disabled={isCardPrize} onChange={(e) => setField("tier", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 capitalize text-white">{rarityOptions.map((x) => <option key={x} value={x}>{x} cards</option>)}</select></label>
            <label className="space-y-1 text-sm md:col-span-2"><span className="text-white/55">Official prize mode</span><select value={form.rewardMode} onChange={(e) => setField("rewardMode", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="ladder">Prize Ladder — admin only</option><option value="card">FREE Player Card Prize</option></select></label>
            {isCardPrize && <p className="md:col-span-2 rounded-lg border border-emerald-300/20 p-3 text-xs text-emerald-100">Winner rarity is a secure one-time draw at settlement: Rare 95%, Unique 4.5%, Epic 0.45%, Legendary 0.05%. No manual override.</p>}
            <label className="space-y-1 text-sm"><span className="text-white/55">Entry fee</span><Input type="number" min="0" disabled={isCardPrize} value={isCardPrize ? "0" : form.entryFee} onChange={(e) => setField("entryFee", e.target.value)} className="border-white/10 bg-black/40 text-white disabled:opacity-70" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Max players</span><Input type="number" min="2" value={form.maxEntries} onChange={(e) => setField("maxEntries", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Status</span><select value={form.status} onChange={(e) => setField("status", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 capitalize text-white">{statusOptions.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Visibility</span><select value={form.visibility} onChange={(e) => setField("visibility", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="public">Public</option><option value="private">Private PIN</option></select></label>
            <div className={`md:col-span-2 rounded-xl border p-3 text-sm ${isCardPrize ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-50"}`}>
              {isCardPrize ? <><b>FREE card prize:</b> N$0 entry using {cap(form.tier)} cards. 1st receives a weighted-rarity Premier League card; 2nd and 3rd receive Common cards.</> : <><b>Admin Prize Ladder:</b> {form.tier.toUpperCase()} ladder. First unlock: {nextPrize ? `${nextPrize.title} at ${nextPrize.requiredEntrants} entries` : "loading..."}. Margin: {marginByRarity[form.tier] || 1.8}x.</>}
            </div>
            <label className="space-y-1 text-sm"><span className="text-white/55">Entries open from</span><Input type="datetime-local" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Final Premier League match settlement cutoff</span><Input type="datetime-local" value={form.endDate} onChange={(e) => setField("endDate", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <div className="md:col-span-2 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">Only Fantasy Arena points from linked Premier League match actions recorded before this settlement cutoff count. FA Cup matches are excluded, and a postponed Premier League fixture does not count if it is played after the next gameweek has started.</div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full rounded-xl bg-yellow-300 font-black text-slate-950 hover:bg-yellow-200"><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving..." : form.id ? "Save Changes" : isCardPrize ? "Create FREE Card Cup" : "Create Prize Ladder Tournament"}</Button>
        </div>

        <div className="space-y-3">
          {isCardPrize ? <div className={`rounded-2xl border p-5 ${rarityTone[form.cardPrizeRarity] || rarityTone.common}`}><div className="text-xs font-black uppercase tracking-[.18em]">Player card prize</div><div className="mt-2 text-2xl font-black">Weighted first-place card</div><div className="mt-2 text-sm opacity-75">Winner: Rare 95%, Unique 4.5%, Epic 0.45%, Legendary 0.05%. Rarity is locked at settlement; the winner then mints the eligible Premier League player card. 2nd and 3rd: Common.</div><Badge className="mt-4 bg-emerald-300 text-emerald-950">N$0 ENTRY</Badge></div> : <div className={`rounded-2xl border p-3 ${rarityTone[previewRarity] || rarityTone.common}`}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black uppercase tracking-[.14em]">{previewRarity} Prize Ladder preview</h3><Badge className="capitalize">Entry {money(entryFeeByRarity[previewRarity] || 0)}</Badge></div><div className="mb-3 flex flex-wrap gap-2">{rarityOptions.map((r) => <button key={r} onClick={() => setPreviewRarity(r)} className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${previewRarity === r ? "bg-white text-slate-950" : "border-white/15 bg-black/25 text-white/70"}`}>{r}</button>)}</div><div className="grid max-h-[24rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2">{(prizesByRarity[previewRarity] || []).map((p: any) => <div key={p.key} className="rounded-xl border border-white/10 bg-black/25 p-2 text-xs"><div className="font-bold text-white">#{p.tierIndex} {p.title}</div><div className="text-white/55">Value {money(p.value)} • target {money(p.unlockTarget)}</div><div className="mt-1 font-black text-cyan-100">Unlocks at {p.requiredEntrants} entries</div></div>)}</div></div>}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tournament status">
              <Button type="button" size="sm" variant={tournamentListView === "closed" ? "default" : "outline"} onClick={() => setTournamentListView("closed")}>Closed & Completed ({completedCompetitions.length})</Button>
              <Button type="button" size="sm" variant={tournamentListView === "current" ? "default" : "outline"} onClick={() => setTournamentListView("current")}>Current & Upcoming ({activeCompetitions.length})</Button>
            </div>
            <div className="max-h-[34rem] overflow-y-auto pr-1">
              {tournamentListView === "closed"
                ? <TournamentList title="Closed & Completed" competitions={completedCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onSettle={requestSettlement} deleting={deleteMutation.isPending} settling={settleMutation.isPending} />
                : <TournamentList title="Current & Upcoming" competitions={activeCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onSettle={requestSettlement} deleting={deleteMutation.isPending} settling={settleMutation.isPending} />}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FinancialStat({ label, value, helper, warning = false }: { label: string; value: string; helper: string; warning?: boolean }) {
  return <div className={`min-w-0 rounded-xl border p-3 ${warning ? "border-amber-300/35 bg-amber-300/10" : "border-white/10 bg-white/[.035]"}`}><div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[.11em] text-white/50">{warning ? <AlertTriangle className="h-3 w-3 text-amber-200" /> : null}{label}</div><div className={`mt-1 truncate text-base font-black ${warning ? "text-amber-200" : "text-white"}`}>{value}</div><div className="mt-1 truncate text-[10px] text-white/45">{helper}</div></div>;
}

function TournamentList({ title, competitions, selectedId, onLoad, onDelete, onSettle, deleting, settling }: any) {
  return <section><div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-black uppercase tracking-[.14em] text-white/60">{title}</h4><Badge variant="outline">{competitions.length}</Badge></div><div className="space-y-2">{competitions.length ? competitions.map((comp: any) => { const status = String(comp.status || "").toLowerCase(); const settlement = comp.endDate || comp.end_date; const settlementMs = new Date(String(settlement || "")).getTime(); const readyToSettle = ["active", "closed"].includes(status) && Number.isFinite(settlementMs) && Date.now() >= settlementMs; const key = String(comp.prizeKey || comp.prize_key || ""); const isCard = key.startsWith("free-"); const prizeRarity = String(comp.prizeCardRarity || comp.prize_card_rarity || ""); return <div key={comp.id} className={`rounded-xl border p-3 text-sm transition ${String(selectedId) === String(comp.id) ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25"}`}><button onClick={() => onLoad(comp)} className="w-full text-left"><div className="flex items-center justify-between gap-3"><span className="font-bold">{comp.name}</span><Badge className="capitalize">{comp.status}</Badge></div><div className="mt-1 text-white/50">GW {comp.gameWeek ?? comp.game_week} • {comp.tier} cards • {isCard ? `FREE → ${key === "free-weighted-card" ? "weighted 1st / Common 2nd–3rd" : prizeRarity || "card"} prize` : `Prize Ladder • Entry ${money(comp.entryFee ?? comp.entry_fee)}`}</div><div className="mt-1 text-xs text-cyan-100/60">Settlement: {settlementLabel(settlement)} • Entries: {comp.entryCount ?? comp.entry_count ?? 0}</div></button>{readyToSettle ? <Button size="sm" disabled={settling} onClick={() => onSettle(comp)} className="mt-3 w-full bg-emerald-300 font-black text-slate-950 hover:bg-emerald-200"><CheckCircle2 className="mr-2 h-4 w-4" />{settling ? "Settling..." : "Settle Tuesday Results"}</Button> : null}<Button variant="destructive" size="sm" disabled={deleting} onClick={() => onDelete(comp)} className="mt-2 w-full"><Trash2 className="mr-2 h-4 w-4" />Delete Tournament</Button></div>; }) : <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/40">No tournaments in this section.</div>}</div></section>;
}


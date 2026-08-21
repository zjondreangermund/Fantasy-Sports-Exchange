import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, Save, Users } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import PremiumFootballCard from "../components/PremiumFootballCard";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";

function formatDate(value: any) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function SelectSquadPage() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: cards, isLoading: cardsLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cards");
      const data = await res.json();
      return Array.isArray(data) ? data : data.cards || [];
    },
  });

  const { data: lineupData, isLoading: lineupLoading } = useQuery<{ lineup: Lineup; cards: PlayerCardWithPlayer[] }>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const res = await fetch("/api/lineup", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lineup");
      return res.json();
    },
  });

  useEffect(() => {
    if (lineupData?.lineup?.cardIds) setSelected(new Set(lineupData.lineup.cardIds));
  }, [lineupData?.lineup?.cardIds]);

  const selectedApiPlayerIds = useMemo(() => {
    const values = (cards || [])
      .filter((card) => selected.has(card.id))
      .map((card) => Number((card.player as any)?.apiFootballId || 0))
      .filter((id) => Number.isInteger(id) && id > 0);
    return Array.from(new Set(values)).slice(0, 5);
  }, [cards, selected]);

  const intelligence = useQuery<any>({
    queryKey: ["api-football-lineup-intelligence", selectedApiPlayerIds.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/football/lineup-intelligence/premier-league?players=${selectedApiPlayerIds.join(",")}`, { credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Could not load lineup intelligence");
      return payload;
    },
    enabled: selectedApiPlayerIds.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const saveLineup = useMutation({
    mutationFn: async (cardIds: number[]) => {
      const res = await apiRequest("POST", "/api/lineup", { cardIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lineup"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      toast({ title: "Squad saved", description: "Your 5-card lineup is ready for matchday." });
    },
    onError: (error: any) => toast({ title: "Could not save squad", description: error.message, variant: "destructive" }),
  });

  const playableCards = (cards || []).filter((card) => !card.forSale);

  const toggleCard = (cardId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else if (next.size < 5) next.add(cardId);
      else toast({ title: "Lineup full", description: "Remove one card before selecting another." });
      return next;
    });
  };

  const isLoading = cardsLoading || lineupLoading;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 pb-28 text-white sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-cyan-300/20 bg-slate-950/75 p-4 backdrop-blur-xl">
        <div>
          <Link href="/"><Button variant="ghost" size="sm" className="mb-2 text-white/70"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Button></Link>
          <div className="flex items-center gap-2"><Users className="h-6 w-6 text-cyan-300" /><h1 className="text-2xl font-black sm:text-4xl">Select Your Squad</h1></div>
          <p className="mt-1 text-sm text-white/55">Choose exactly 5 playable cards for Matchday Center and tournaments.</p>
        </div>
        <Button onClick={() => saveLineup.mutate(Array.from(selected))} disabled={saveLineup.isPending || selected.size !== 5} className="bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200">
          <Save className="mr-2 h-4 w-4" /> Save Squad ({selected.size}/5)
        </Button>
      </div>

      <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200/60">Current selection</p>
            <p className="mt-1 text-sm text-white/55">Selected cards are highlighted. Listed cards are hidden because they cannot be used in your lineup.</p>
          </div>
          {selected.size === 5 ? <div className="flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Ready</div> : null}
        </div>
      </Card>

      {selectedApiPlayerIds.length ? <TeamAssistant data={intelligence.data} loading={intelligence.isLoading} linked={selectedApiPlayerIds.length} selected={selected.size} /> : null}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => <Skeleton key={index} className="h-[270px] rounded-[28px] bg-white/10" />)}
        </div>
      ) : playableCards.length ? (
        <div className="grid grid-cols-2 justify-items-center gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {playableCards.map((card) => {
            const isSelected = selected.has(card.id);
            return (
              <button key={card.id} type="button" onClick={() => toggleCard(card.id)} className={`rounded-[30px] text-left transition ${isSelected ? "ring-2 ring-cyan-300 shadow-[0_0_34px_rgba(34,211,238,.32)]" : "hover:scale-[1.02]"}`}>
                <PremiumFootballCard player={toFantasyCardData(card, { imageWidth: 320 })} selected={isSelected} size="md" />
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-white/15 bg-black/25 p-8 text-center text-white">
          <p className="font-bold">No playable cards available.</p>
          <p className="mt-1 text-sm text-white/50">Open packs or cancel listed cards before selecting your squad.</p>
          <Link href="/collection"><Button className="mt-4">Open Collection</Button></Link>
        </Card>
      )}
    </div>
  );
}

function TeamAssistant({ data, loading, linked, selected }: { data: any; loading: boolean; linked: number; selected: number }) {
  const rows = Array.isArray(data?.players) ? data.players : [];
  return <Card className="space-y-3 border-violet-400/20 bg-violet-500/[0.06] p-4 text-white"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2 font-black"><Activity className="h-5 w-5 text-violet-300" /> Tournament Team Assistant</div><p className="mt-1 text-xs text-white/50">Factual API-Football status checks only: current squad, injuries/suspensions, next fixture and confirmed lineup status. It does not predict fantasy results.</p></div><Badge variant="outline">{linked}/{selected} cards API-linked</Badge></div>{loading ? <Skeleton className="h-28 w-full bg-white/10" /> : rows.length ? <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">{rows.map((row: any) => <AssistantPlayer key={row.playerId} row={row} />)}</div> : <div className="text-sm text-white/50">No intelligence returned yet.</div>}</Card>;
}

function AssistantPlayer({ row }: { row: any }) {
  const warnings = Array.isArray(row?.warnings) ? row.warnings : [];
  const next = row?.nextFixture;
  const lineup = row?.lineup?.status === "confirmed_starter" ? "Starter" : row?.lineup?.status === "confirmed_bench" ? "Bench" : row?.lineup?.status === "not_in_announced_squad" ? "Not in squad" : "Not announced";
  const danger = warnings.some((warning: any) => warning?.level === "danger");
  const warning = warnings.some((item: any) => item?.level === "warning");
  return <div className={`rounded-xl border p-3 ${danger ? "border-red-400/30 bg-red-500/10" : warning ? "border-amber-400/30 bg-amber-500/10" : "border-emerald-400/20 bg-emerald-500/5"}`}><div className="flex items-center justify-between gap-2"><div className="font-black">{row?.player?.name || `Player ${row.playerId}`}</div><Badge variant="outline">{lineup}</Badge></div><div className="mt-2 text-xs text-white/60">Current squad: {row.currentSquad === false ? "No" : row.currentSquad === true ? "Yes" : "Unknown"}</div>{next ? <div className="mt-1 text-xs text-white/60">Next: {next.homeTeam?.name} vs {next.awayTeam?.name} · {formatDate(next.kickoffTime)}</div> : null}{warnings.length ? <div className="mt-2 space-y-1">{warnings.map((item: any, index: number) => <div key={`${item.code}-${index}`} className="flex items-start gap-1 text-xs"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /><span>{item.message}</span></div>)}</div> : <div className="mt-2 text-xs text-emerald-200">No provider availability warning.</div>}</div>;
}

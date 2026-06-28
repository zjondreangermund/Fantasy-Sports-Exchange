import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Save, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import PremiumFootballCard from "../components/PremiumFootballCard";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";

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

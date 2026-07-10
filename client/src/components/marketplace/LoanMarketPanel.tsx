import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { useToast } from "../../hooks/use-toast";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";
import {
  getLoanFeeBreakdown,
  getLoanFloorPerGameweek,
  LOAN_DURATIONS_GAMEWEEKS,
} from "../../../../shared/loan-market";

type LoanListing = Record<string, any>;

function money(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "N$0.00";
  return `N$${n.toFixed(2)}`;
}

function rarityOf(card: PlayerCardWithPlayer) {
  return String(card.rarity || "common").toLowerCase();
}

function loanTotal(loan: LoanListing) {
  return Number(
    loan.gross_amount ||
      loan.grossAmount ||
      Number(loan.price_per_gameweek || loan.pricePerGameweek || 0) * Number(loan.gameweeks || 1),
  );
}

export function LoanMarketPanel({
  myCards,
  walletBalance,
}: {
  myCards: PlayerCardWithPlayer[];
  walletBalance: number;
}) {
  const { toast } = useToast();
  const loanableCards = useMemo(
    () => myCards.filter((card) => getLoanFloorPerGameweek(rarityOf(card)) > 0 && !card.forSale),
    [myCards],
  );
  const requestedCardId = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const value = Number(new URLSearchParams(window.location.search).get("cardId") || 0);
    return Number.isInteger(value) && value > 0 ? value : 0;
  }, []);
  const [selectedCardId, setSelectedCardId] = useState<number>(requestedCardId || loanableCards[0]?.id || 0);
  const selectedCard = loanableCards.find((card) => card.id === selectedCardId) || loanableCards[0];
  useEffect(() => {
    if (requestedCardId && loanableCards.some((card) => card.id === requestedCardId)) {
      setSelectedCardId(requestedCardId);
    } else if (!selectedCardId && loanableCards[0]?.id) {
      setSelectedCardId(loanableCards[0].id);
    }
  }, [loanableCards, requestedCardId, selectedCardId]);
  const selectedRarity = selectedCard ? rarityOf(selectedCard) : "rare";
  const floor = getLoanFloorPerGameweek(selectedRarity) || 20;
  const [gameweeks, setGameweeks] = useState(1);
  const [pricePerGameweek, setPricePerGameweek] = useState(floor);
  const breakdown = getLoanFeeBreakdown({ rarity: selectedRarity, pricePerGameweek, gameweeks });

  const { data, isLoading } = useQuery<{ loans: LoanListing[] }>({
    queryKey: ["/api/marketplace/loans"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/loans", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loan listings");
      return res.json();
    },
  });

  const listLoanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCard) throw new Error("Choose a card to loan out");
      const res = await apiRequest("POST", "/api/marketplace/loans/list", {
        cardId: selectedCard.id,
        gameweeks,
        pricePerGameweek,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      toast({ title: "Loan listing created" });
    },
    onError: (error: any) => toast({ title: "Loan listing failed", description: error.message, variant: "destructive" }),
  });

  const acceptLoanMutation = useMutation({
    mutationFn: async (loanId: number) => {
      const res = await apiRequest("POST", `/api/marketplace/loans/${loanId}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      toast({ title: "Loan accepted", description: "The card is now temporarily in your collection." });
    },
    onError: (error: any) => toast({ title: "Could not accept loan", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-cyan-300/15 bg-slate-950/70 p-5 text-white">
        <div className="mb-4 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-cyan-300" />
          <h2 className="font-black">Loan Out a Card</h2>
        </div>
        {loanableCards.length ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Card</label>
              <select
                value={selectedCard?.id || 0}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  const nextCard = loanableCards.find((card) => card.id === nextId);
                  const nextFloor = nextCard ? getLoanFloorPerGameweek(rarityOf(nextCard)) : 20;
                  setSelectedCardId(nextId);
                  setPricePerGameweek(nextFloor || 20);
                }}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/45 px-3 text-sm text-white outline-none"
              >
                {loanableCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.player?.name || "Player"} • {card.rarity}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Duration</label>
                <select
                  value={gameweeks}
                  onChange={(e) => setGameweeks(Number(e.target.value))}
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/45 px-3 text-sm text-white outline-none"
                >
                  {LOAN_DURATIONS_GAMEWEEKS.map((weeks) => (
                    <option key={weeks} value={weeks}>{weeks} gameweek{weeks > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Price / GW</label>
                <Input
                  type="number"
                  value={pricePerGameweek}
                  min={floor}
                  onChange={(e) => setPricePerGameweek(Number(e.target.value))}
                  className="h-11 border-white/10 bg-black/45 text-white"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
              <p className="text-white/55">Floor: {money(floor)} / gameweek</p>
              <p>Total paid by borrower: <span className="font-black text-white">{money(breakdown.gross)}</span></p>
              <p>App fee 8%: <span className="font-black text-amber-200">{money(breakdown.fee)}</span></p>
              <p>You receive: <span className="font-black text-emerald-300">{money(breakdown.ownerReceives)}</span></p>
            </div>

            <Button
              onClick={() => listLoanMutation.mutate()}
              disabled={listLoanMutation.isPending || !selectedCard || pricePerGameweek < floor}
              className="w-full bg-cyan-400 font-black text-black hover:bg-cyan-300"
            >
              {listLoanMutation.isPending ? "Listing..." : "Create Loan Listing"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-white/50">No rare, unique, epic or legendary cards available to loan out. Common cards are tournament-only.</p>
        )}
      </Card>

      <Card className="border-white/10 bg-slate-950/70 p-5 text-white">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black">Available Loans</h2>
            <p className="text-sm text-white/45">Pay once, use the card until expiry, then it returns automatically.</p>
          </div>
          <Badge variant="outline" className="border-cyan-300/25 text-cyan-100">Balance {money(walletBalance)}</Badge>
        </div>
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl bg-slate-800" />)
          ) : (data?.loans || []).length ? (
            (data?.loans || []).map((loan) => {
              const gross = loanTotal(loan);
              return (
                <div key={Number(loan.id)} className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:grid-cols-[1.2fr_0.8fr_0.8fr]">
                  <div>
                    <p className="font-black">{loan.player_name || loan.playerName || "Player"}</p>
                    <p className="text-xs text-white/45">{loan.team || "Club"} • {String(loan.position || "Player")} • <span className="capitalize">{loan.rarity}</span></p>
                    <p className="text-[11px] text-white/35">Owner: {loan.owner_name || loan.ownerName || "Manager"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Loan Terms</p>
                    <p className="font-black">{Number(loan.gameweeks || 1)} GW × {money(loan.price_per_gameweek || loan.pricePerGameweek)}</p>
                    <p className="text-xs text-white/45">Total {money(gross)}</p>
                  </div>
                  <div className="flex items-center justify-end">
                    <Button
                      size="sm"
                      disabled={acceptLoanMutation.isPending || walletBalance < gross}
                      onClick={() => acceptLoanMutation.mutate(Number(loan.id))}
                      className="bg-emerald-400 font-black text-black hover:bg-emerald-300"
                    >
                      {walletBalance < gross ? "Insufficient" : acceptLoanMutation.isPending ? "Accepting..." : "Accept Loan"}
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-white/50">No loan listings available yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Clock3,
  Crown,
  Gem,
  Handshake,
  Plus,
  Shield,
  Star,
  WalletCards,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import CardShowcase from "../CardShowcase";
import { useToast } from "../../hooks/use-toast";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";
import {
  getLoanFeeBreakdown,
  getLoanFloorPerGameweek,
  LOAN_DURATIONS_GAMEWEEKS,
} from "../../../../shared/loan-market";

type LoanListing = Record<string, any>;
type SortMode = "performance" | "priceAsc" | "priceDesc" | "rarity";

const rarityOrder: Record<string, number> = {
  common: 0,
  rare: 1,
  unique: 2,
  epic: 3,
  legendary: 4,
};

const rarityGlow: Record<string, string> = {
  common: "rgba(148,163,184,.22)",
  rare: "rgba(59,130,246,.36)",
  epic: "rgba(168,85,247,.42)",
  unique: "rgba(236,72,153,.42)",
  legendary: "rgba(251,191,36,.48)",
};

function money(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "N$0.00";
  return `N$${n.toFixed(2)}`;
}

function rarityOfCard(card: PlayerCardWithPlayer) {
  return String(card.rarity || "common").toLowerCase();
}

function rarityOfLoan(loan: LoanListing) {
  return String(loan.rarity || "common").toLowerCase();
}

function loanTotal(loan: LoanListing) {
  return Number(
    loan.gross_amount ||
      loan.grossAmount ||
      Number(loan.price_per_gameweek || loan.pricePerGameweek || 0) * Number(loan.gameweeks || 1),
  );
}

function loanImage(loan: LoanListing) {
  return String(
    loan.image_url ||
      loan.imageUrl ||
      loan.player_image_url ||
      loan.playerImageUrl ||
      "/brand/fantasy-arena-logo.jpg?v=lion-jpg-2026-08",
  );
}

function loanPlayerName(loan: LoanListing) {
  return String(loan.player_name || loan.playerName || "Player");
}

function loanOwnerName(loan: LoanListing) {
  return String(loan.owner_name || loan.ownerName || "Manager");
}

function loanCard(loan: LoanListing): PlayerCardWithPlayer {
  if (loan.card?.id) return loan.card as PlayerCardWithPlayer;
  return {
    id: Number(loan.card_id || loan.cardId || 0),
    playerId: Number(loan.player_id || loan.playerId || 0),
    ownerId: String(loan.original_owner_id || loan.ownerId || ""),
    rarity: rarityOfLoan(loan) as any,
    serialId: loan.serial_id || loan.serialId || null,
    serialNumber: loan.serial_number == null ? null : Number(loan.serial_number),
    maxSupply: loan.max_supply == null ? null : Number(loan.max_supply),
    level: Number(loan.level || 1),
    xp: Number(loan.xp || 0),
    decisiveScore: 0,
    last5Scores: [],
    forSale: false,
    price: 0,
    acquiredAt: loan.acquired_at || null,
    player: {
      id: Number(loan.player_id || loan.playerId || 0),
      name: loanPlayerName(loan),
      team: loan.team || "",
      position: loan.position || "",
      league: loan.league || "Premier League",
      overall: loan.official_overall ?? null,
      totalPoints: loan.official_total_points ?? null,
      form: loan.official_form ?? null,
      imageUrl: loanImage(loan),
      verifiedImageUrl: loanImage(loan),
      identityVerified: Boolean(loan.identity_verified),
      identitySource: loan.identity_source || "unverified-card-data",
    } as any,
  } as PlayerCardWithPlayer;
}

function loanOfficialPoints(loan: LoanListing): number | null {
  if (!loan.identity_verified) return null;
  const value = loan.official_total_points ?? loan.card?.player?.totalPoints;
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? null : number;
}

function loanOfficialOverall(loan: LoanListing): number | null {
  if (!loan.identity_verified) return null;
  const value = loan.official_overall ?? loan.card?.player?.overall;
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? null : number;
}

function statText(value: number | null) {
  return value === null ? "—" : value.toFixed(0);
}

function RarityIcon({ rarity }: { rarity: string }) {
  if (rarity === "legendary") return <Crown className="h-4 w-4 text-amber-300" />;
  if (rarity === "unique" || rarity === "epic") return <Gem className="h-4 w-4 text-fuchsia-300" />;
  if (rarity === "rare") return <Star className="h-4 w-4 text-blue-300" />;
  return <Shield className="h-4 w-4 text-slate-300" />;
}

export function LoanMarketPanel({
  myCards,
  walletBalance,
  search = "",
  rarity = "all",
  sortBy = "performance",
  onViewProfile,
}: {
  myCards: PlayerCardWithPlayer[];
  walletBalance: number;
  search?: string;
  rarity?: string;
  sortBy?: SortMode;
  onViewProfile?: (card: PlayerCardWithPlayer) => void;
}) {
  const { toast } = useToast();
  const loanableCards = useMemo(
    () => myCards.filter((card) => getLoanFloorPerGameweek(rarityOfCard(card)) > 0 && !card.forSale),
    [myCards],
  );

  const requestedCardId = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const value = Number(new URLSearchParams(window.location.search).get("cardId") || 0);
    return Number.isInteger(value) && value > 0 ? value : 0;
  }, []);

  const [selectedCardId, setSelectedCardId] = useState<number>(requestedCardId || loanableCards[0]?.id || 0);
  const [showListDialog, setShowListDialog] = useState(false);
  const [confirmingLoan, setConfirmingLoan] = useState<LoanListing | null>(null);
  const [gameweeks, setGameweeks] = useState(1);
  const [pricePerGameweek, setPricePerGameweek] = useState(20);

  const selectedCard = loanableCards.find((card) => card.id === selectedCardId) || loanableCards[0];
  const selectedRarity = selectedCard ? rarityOfCard(selectedCard) : "rare";
  const floor = getLoanFloorPerGameweek(selectedRarity) || 20;
  const breakdown = getLoanFeeBreakdown({ rarity: selectedRarity, pricePerGameweek, gameweeks });

  useEffect(() => {
    if (requestedCardId && loanableCards.some((card) => card.id === requestedCardId)) {
      setSelectedCardId(requestedCardId);
      setShowListDialog(true);
    } else if (!selectedCardId && loanableCards[0]?.id) {
      setSelectedCardId(loanableCards[0].id);
    }
  }, [loanableCards, requestedCardId, selectedCardId]);

  useEffect(() => {
    if (!selectedCard) return;
    setPricePerGameweek(getLoanFloorPerGameweek(rarityOfCard(selectedCard)) || 20);
  }, [selectedCard?.id]);

  const { data, isLoading } = useQuery<{ loans: LoanListing[] }>({
    queryKey: ["/api/marketplace/loans"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/loans", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loan listings");
      return res.json();
    },
  });

  const filteredLoans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(data?.loans || [])]
      .filter((loan) => {
        const haystack = `${loanPlayerName(loan)} ${loan.team || ""} ${loan.position || ""} ${loanOwnerName(loan)}`.toLowerCase();
        return (!query || haystack.includes(query)) && (rarity === "all" || rarityOfLoan(loan) === rarity);
      })
      .sort((a, b) => {
        if (sortBy === "priceAsc") return loanTotal(a) - loanTotal(b);
        if (sortBy === "priceDesc") return loanTotal(b) - loanTotal(a);
        if (sortBy === "rarity") return (rarityOrder[rarityOfLoan(b)] || 0) - (rarityOrder[rarityOfLoan(a)] || 0);
        return (loanOfficialPoints(b) ?? -1) - (loanOfficialPoints(a) ?? -1);
      });
  }, [data?.loans, rarity, search, sortBy]);

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
      setShowListDialog(false);
      toast({ title: "Loan listing created", description: "Your card is now visible on the loan marketplace." });
    },
    onError: (error: any) => {
      toast({ title: "Loan listing failed", description: error.message, variant: "destructive" });
    },
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
      setConfirmingLoan(null);
      toast({ title: "Loan accepted", description: "The card is now temporarily in your collection." });
    },
    onError: (error: any) => {
      toast({ title: "Could not accept loan", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-cyan-300/15 bg-slate-950/70 p-4 text-white sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <Handshake className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-black">Loan Marketplace</h2>
            <p className="text-sm text-white/45">Borrow premium cards for a fixed number of gameweeks.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-cyan-300/25 text-cyan-100">
            <WalletCards className="mr-1 h-3.5 w-3.5" /> Balance {money(walletBalance)}
          </Badge>
          <Button
            onClick={() => setShowListDialog(true)}
            disabled={!loanableCards.length}
            className="rounded-xl bg-cyan-300 font-black text-black hover:bg-cyan-200"
          >
            <Plus className="mr-1 h-4 w-4" /> List a Card
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-[1.5rem] bg-slate-800" />
          ))
        ) : filteredLoans.length ? (
          filteredLoans.map((loan) => (
            <LoanMarketRow
              key={Number(loan.id)}
              loan={loan}
              walletBalance={walletBalance}
              accepting={acceptLoanMutation.isPending}
              onAccept={() => setConfirmingLoan(loan)}
              onDetails={() => onViewProfile?.(loanCard(loan))}
            />
          ))
        ) : (
          <Card className="border-slate-800 bg-slate-950/60 p-12 text-center text-white">
            <Handshake className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <p className="text-lg text-slate-300">No loan cards match your search.</p>
            <p className="mt-2 text-sm text-slate-500">List one of your eligible cards to open the loan market.</p>
          </Card>
        )}
      </div>

      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent className="max-w-3xl border-white/10 bg-[#070b18] text-white">
          <DialogHeader>
            <DialogTitle>Create Loan Listing</DialogTitle>
            <DialogDescription className="text-slate-400">
              Choose a card, duration and price per gameweek. Common cards cannot be loaned.
            </DialogDescription>
          </DialogHeader>
          {loanableCards.length ? (
            <div className="grid gap-5 py-3 md:grid-cols-[0.8fr_1.2fr]">
              <div className="flex items-start justify-center">
                {selectedCard ? <CardShowcase card={selectedCard} size="sm" /> : null}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loanCard">Card</Label>
                  <select
                    id="loanCard"
                    value={selectedCard?.id || 0}
                    onChange={(event) => setSelectedCardId(Number(event.target.value))}
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
                    <Label htmlFor="loanDuration">Duration</Label>
                    <select
                      id="loanDuration"
                      value={gameweeks}
                      onChange={(event) => setGameweeks(Number(event.target.value))}
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/45 px-3 text-sm text-white outline-none"
                    >
                      {LOAN_DURATIONS_GAMEWEEKS.map((weeks) => (
                        <option key={weeks} value={weeks}>{weeks} gameweek{weeks > 1 ? "s" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loanPrice">Price / GW</Label>
                    <Input
                      id="loanPrice"
                      type="number"
                      value={pricePerGameweek}
                      min={floor}
                      onChange={(event) => setPricePerGameweek(Number(event.target.value))}
                      className="h-11 border-white/10 bg-black/45 text-white"
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                  <p className="text-white/55">Minimum: {money(floor)} per gameweek</p>
                  <p>Total paid by borrower: <strong>{money(breakdown.gross)}</strong></p>
                  <p>Fantasy Arena fee: <strong className="text-amber-200">{money(breakdown.fee)}</strong></p>
                  <p>You receive: <strong className="text-emerald-300">{money(breakdown.ownerReceives)}</strong></p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-slate-400">
              No rare, unique, epic or legendary cards are currently available to loan out.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowListDialog(false)}>Cancel</Button>
            <Button
              onClick={() => listLoanMutation.mutate()}
              disabled={listLoanMutation.isPending || !selectedCard || pricePerGameweek < floor}
              className="bg-cyan-300 font-black text-black hover:bg-cyan-200"
            >
              {listLoanMutation.isPending ? "Listing..." : "Create Loan Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmingLoan} onOpenChange={(open) => !open && setConfirmingLoan(null)}>
        <DialogContent className="border-white/10 bg-[#070b18] text-white">
          <DialogHeader>
            <DialogTitle>Confirm Loan</DialogTitle>
            <DialogDescription className="text-slate-400">
              The full loan amount is paid once and the card returns automatically after expiry.
            </DialogDescription>
          </DialogHeader>
          {confirmingLoan ? (
            <div className="space-y-4 py-3">
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <img
                  src={loanImage(confirmingLoan)}
                  alt={loanPlayerName(confirmingLoan)}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-xl font-black">{loanPlayerName(confirmingLoan)}</p>
                  <p className="text-sm text-white/45">{confirmingLoan.team || "Club"} • {confirmingLoan.position || "Player"}</p>
                  <p className="mt-2 font-black text-emerald-300">{money(loanTotal(confirmingLoan))}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-white/45">Duration</p>
                  <p className="font-black">{Number(confirmingLoan.gameweeks || 1)} gameweek{Number(confirmingLoan.gameweeks || 1) > 1 ? "s" : ""}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-white/45">Your balance</p>
                  <p className="font-black">{money(walletBalance)}</p>
                </div>
              </div>
              {walletBalance < loanTotal(confirmingLoan) ? (
                <p className="text-sm font-bold text-red-300">Your wallet balance is too low for this loan.</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingLoan(null)}>Cancel</Button>
            <Button
              disabled={!confirmingLoan || acceptLoanMutation.isPending || walletBalance < loanTotal(confirmingLoan)}
              onClick={() => confirmingLoan && acceptLoanMutation.mutate(Number(confirmingLoan.id))}
              className="bg-emerald-400 font-black text-black hover:bg-emerald-300"
            >
              {acceptLoanMutation.isPending ? "Accepting..." : "Confirm Loan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoanMarketRow({
  loan,
  walletBalance,
  accepting,
  onAccept,
  onDetails,
}: {
  loan: LoanListing;
  walletBalance: number;
  accepting: boolean;
  onAccept: () => void;
  onDetails: () => void;
}) {
  const rarity = rarityOfLoan(loan);
  const glow = rarityGlow[rarity] || rarityGlow.common;
  const gross = loanTotal(loan);
  const gameweeks = Number(loan.gameweeks || 1);
  const overall = loanOfficialOverall(loan);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`View verified stats for ${loanPlayerName(loan)}`}
      onClick={onDetails}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onDetails(); }}
      className="relative cursor-pointer overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-3 text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/30"
      style={{ boxShadow: `0 0 30px ${glow}, 0 18px 48px rgba(0,0,0,.35)` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.07),transparent)]" />
      <div className="relative grid gap-3 md:grid-cols-[1.45fr_0.72fr_0.72fr_1fr_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-3 text-left">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/35">
            <img src={loanImage(loan)} alt={loanPlayerName(loan)} className="h-full w-full object-cover" />
            <div className="absolute left-1 top-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-black">{statText(overall)}</div>
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black">{loanPlayerName(loan)}</p>
            <p className="truncate text-xs text-white/50">{loan.team || "Club"} • {loan.position || "Player"}</p>
            <p className="truncate text-[11px] text-white/35">Lender: {loanOwnerName(loan)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
          <RarityIcon rarity={rarity} />
          <span className="font-bold capitalize">{rarity}</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-[.14em] text-white/40"><Clock3 className="h-3 w-3" /> Duration</p>
          <p className="font-black">{gameweeks} GW</p>
        </div>

        <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[.14em] text-emerald-100/60">Loan Total</p>
          <p className="text-lg font-black text-emerald-300">{money(gross)}</p>
          <p className="text-[10px] text-emerald-100/45">{money(loan.price_per_gameweek || loan.pricePerGameweek)} / GW</p>
        </div>

        <div className="flex items-center justify-end">
          <Button
            size="sm"
            disabled={accepting || walletBalance < gross}
            onClick={(event) => { event.stopPropagation(); onAccept(); }}
            className="rounded-xl bg-cyan-300 font-black text-black hover:bg-cyan-200"
          >
            {walletBalance < gross ? "Insufficient" : "Loan"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

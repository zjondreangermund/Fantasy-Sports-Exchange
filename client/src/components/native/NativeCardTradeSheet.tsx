import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Clock3, Handshake, ShoppingBag, Tag, X } from "lucide-react";
import CardThumbnail from "../CardThumbnail";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import type { PlayerCardWithPlayer } from "../../../../shared/schema";
import {
  getMarketplaceFloorPrice,
  isMarketplaceTradableRarity,
  MARKETPLACE_FEE_RATE,
} from "../../../../shared/card-economy";
import {
  getLoanFeeBreakdown,
  getLoanFloorPerGameweek,
  LOAN_DURATIONS_GAMEWEEKS,
  normalizeLoanRarity,
} from "../../../../shared/loan-market";

type LoanMinimum = {
  cardId: number;
  rarity: string;
  costBasis: number;
  acquisitionSource: "marketplace" | "auction" | "rarity_floor";
  minimumPricePerGameweek: number;
};

type MyLoan = {
  id: number;
  card_id?: number;
  cardId?: number;
  status: string;
  relation?: "lender" | "borrower";
  gameweeks?: number;
  expires_at?: string | null;
  expiresAt?: string | null;
  price_per_gameweek?: number;
  pricePerGameweek?: number;
};

type Mode = "actions" | "sell" | "loan";

function money(value: unknown) {
  const amount = Number(value || 0);
  return `N$${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function cardLoanId(loan: MyLoan) {
  return Number(loan.card_id ?? loan.cardId ?? 0);
}

function expiryLabel(value: unknown) {
  if (!value) return "after the agreed gameweeks";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "after the agreed gameweeks";
  return date.toLocaleString("en-NA", {
    timeZone: "Africa/Windhoek",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function NativeCardTradeSheet({
  card,
  myLoans,
  onClose,
}: {
  card: PlayerCardWithPlayer;
  myLoans: MyLoan[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<Mode>("actions");
  const rarity = String(card.rarity || "common").toLowerCase();
  const saleFloor = getMarketplaceFloorPrice(rarity);
  const [salePrice, setSalePrice] = React.useState(Math.max(Number(card.price || 0), saleFloor || 0));
  const [gameweeks, setGameweeks] = React.useState(1);
  const [loanPrice, setLoanPrice] = React.useState(0);

  const { data: minimumData } = useQuery<{ minimums: LoanMinimum[] }>({
    queryKey: ["/api/marketplace/loans/my-minimums"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/loans/my-minimums", { credentials: "include" });
      if (!response.ok) return { minimums: [] };
      return response.json();
    },
    staleTime: 30_000,
  });

  const currentLoan = React.useMemo(
    () => myLoans.find((loan) => cardLoanId(loan) === Number(card.id) && ["open", "active"].includes(String(loan.status || "").toLowerCase())),
    [card.id, myLoans],
  );
  const activeBorrow = currentLoan?.relation === "borrower" && String(currentLoan.status).toLowerCase() === "active";
  const openLoanListing = currentLoan?.relation === "lender" && String(currentLoan.status).toLowerCase() === "open";
  const minimum = (minimumData?.minimums || []).find((item) => Number(item.cardId) === Number(card.id));
  const costBasis = Number(minimum?.costBasis || 0);
  const loanFloor = Number(minimum?.minimumPricePerGameweek ?? getLoanFloorPerGameweek(rarity, costBasis));
  const effectiveLoanPrice = Math.max(Number(loanPrice || 0), loanFloor || 0);
  const loanBreakdown = getLoanFeeBreakdown({ rarity, pricePerGameweek: effectiveLoanPrice, gameweeks, costBasis });
  const saleFee = Math.round(Math.max(0, salePrice) * MARKETPLACE_FEE_RATE * 100) / 100;
  const saleNet = Math.round((Math.max(0, salePrice) - saleFee) * 100) / 100;
  const tradable = isMarketplaceTradableRarity(rarity);
  const loanRarity = Boolean(normalizeLoanRarity(rarity));
  const canSell = tradable && !activeBorrow && !openLoanListing;
  const canLoan = loanRarity && !card.forSale && !activeBorrow && !openLoanListing;

  React.useEffect(() => {
    setMode("actions");
    setSalePrice(Math.max(Number(card.price || 0), saleFloor || 0));
    setGameweeks(1);
  }, [card.id, card.price, saleFloor]);

  React.useEffect(() => {
    if (loanFloor > 0) setLoanPrice(loanFloor);
  }, [card.id, loanFloor]);

  const refreshTradeData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
    queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
    queryClient.invalidateQueries({ queryKey: ["/api/marketplace/loans"] });
    queryClient.invalidateQueries({ queryKey: ["/api/marketplace/loans/mine"] });
    queryClient.invalidateQueries({ queryKey: ["/api/marketplace/loans/my-minimums"] });
  };

  const listSaleMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/marketplace/list", { cardId: card.id, price: salePrice })).json(),
    onSuccess: () => {
      refreshTradeData();
      setMode("actions");
      toast({ title: "Card listed for sale", description: `${money(salePrice)} asking price · ${(MARKETPLACE_FEE_RATE * 100).toFixed(0)}% market fee only when sold.` });
    },
    onError: (error: any) => toast({ title: "Could not list card", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  const cancelSaleMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/marketplace/cancel/${Number(card.id)}`, {})).json(),
    onSuccess: () => {
      refreshTradeData();
      toast({ title: "Sale listing cancelled" });
      onClose();
    },
    onError: (error: any) => toast({ title: "Could not cancel listing", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  const listLoanMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/marketplace/loans/list", {
      cardId: card.id,
      gameweeks,
      pricePerGameweek: effectiveLoanPrice,
    })).json(),
    onSuccess: () => {
      refreshTradeData();
      setMode("actions");
      toast({ title: "Loan listing created", description: "The card remains yours and returns automatically after an accepted loan expires." });
    },
    onError: (error: any) => toast({ title: "Could not create loan", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  const cancelLoanMutation = useMutation({
    mutationFn: async () => {
      if (!currentLoan?.id) throw new Error("Loan listing not found");
      return (await apiRequest("POST", `/api/marketplace/loans/${Number(currentLoan.id)}/cancel`, {})).json();
    },
    onSuccess: () => {
      refreshTradeData();
      toast({ title: "Loan listing cancelled" });
      onClose();
    },
    onError: (error: any) => toast({ title: "Could not cancel loan listing", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  const validSale = tradable && salePrice >= Math.max(0.01, saleFloor);
  const validLoan = canLoan && effectiveLoanPrice >= loanFloor && LOAN_DURATIONS_GAMEWEEKS.includes(gameweeks as any);

  return (
    <div className="fixed inset-0 z-[145] flex items-end bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${card.player?.name || "Card"} trading actions`}>
      <button className="absolute inset-0" onClick={onClose} aria-label="Close trading actions" />
      <section className="relative z-10 max-h-[90dvh] w-full overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-[#090d1c] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5" aria-label="Close"><X className="h-4 w-4" /></button>

        <div className="flex items-start gap-3 pr-11">
          <div className="shrink-0"><CardThumbnail card={card} size="xs" showMeta={false} showStats={false} /></div>
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[9px] font-black uppercase tracking-[.15em] text-cyan-200/70">{rarity} · {card.player?.position || "-"}</p>
            <h3 className="mt-1 truncate text-lg font-black">{card.player?.name || "Player"}</h3>
            <p className="mt-1 truncate text-xs text-slate-500">{card.player?.team || "Premier League"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {card.forSale ? <StatusPill label={`For sale · ${money(card.price)}`} /> : null}
              {openLoanListing ? <StatusPill label="Loan market" /> : null}
              {activeBorrow ? <StatusPill label="Borrowed card" amber /> : null}
            </div>
          </div>
        </div>

        {mode === "actions" ? (
          <>
            {activeBorrow ? (
              <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-400/[.07] p-3 text-xs leading-5 text-amber-100">
                This card is temporarily in your collection on loan. It returns to the lender automatically {expiryLabel(currentLoan?.expires_at || currentLoan?.expiresAt)} and cannot be sold or re-loaned.
              </div>
            ) : null}
            {openLoanListing ? (
              <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[.06] p-3 text-xs leading-5 text-cyan-100">
                This card is listed for loan. If another manager accepts it, the full loan amount is paid once, Fantasy Arena keeps the loan fee, and the card returns automatically after the selected gameweeks.
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Link href="/marketplace?mode=buy" onClick={onClose} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.07] px-2 py-3 text-center text-[10px] font-black text-emerald-100"><ShoppingBag className="h-4 w-4" />Buy cards</Link>
              {card.forSale ? (
                <button onClick={() => cancelSaleMutation.mutate()} disabled={cancelSaleMutation.isPending} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-rose-300/15 bg-rose-300/[.07] px-2 py-3 text-[10px] font-black text-rose-100 disabled:opacity-50"><Tag className="h-4 w-4" />{cancelSaleMutation.isPending ? "Cancelling…" : "Cancel sale"}</button>
              ) : (
                <button onClick={() => canSell && setMode("sell")} disabled={!canSell} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-violet-300/15 bg-violet-300/[.07] px-2 py-3 text-[10px] font-black text-violet-100 disabled:opacity-35"><Tag className="h-4 w-4" />Sell</button>
              )}
              {openLoanListing ? (
                <button onClick={() => cancelLoanMutation.mutate()} disabled={cancelLoanMutation.isPending} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.07] px-2 py-3 text-[10px] font-black text-cyan-100 disabled:opacity-50"><Handshake className="h-4 w-4" />{cancelLoanMutation.isPending ? "Cancelling…" : "Cancel loan"}</button>
              ) : (
                <button onClick={() => canLoan && setMode("loan")} disabled={!canLoan} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.07] px-2 py-3 text-[10px] font-black text-cyan-100 disabled:opacity-35"><Handshake className="h-4 w-4" />Loan</button>
              )}
            </div>

            {!tradable ? <p className="mt-3 text-center text-[10px] leading-4 text-slate-500">Common cards are tournament cards and cannot be sold or loaned.</p> : null}
            {card.forSale ? <p className="mt-3 text-center text-[10px] leading-4 text-slate-500">Cancel the sale listing before creating a loan listing.</p> : null}
          </>
        ) : mode === "sell" ? (
          <div className="mt-4">
            <button onClick={() => setMode("actions")} className="mb-3 text-[10px] font-black uppercase tracking-[.12em] text-slate-500">← Trading actions</button>
            <h4 className="text-lg font-black">List card for sale</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">Minimum {money(saleFloor)}. Fantasy Arena charges {(MARKETPLACE_FEE_RATE * 100).toFixed(0)}% only when the card sells.</p>
            <label className="mt-4 block text-[10px] font-black uppercase tracking-[.13em] text-slate-500">Sale price</label>
            <input type="number" min={saleFloor} step="0.01" value={salePrice} onChange={(event) => setSalePrice(Number(event.target.value))} className="mt-1 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-base font-black text-white outline-none" />
            <div className="mt-3 grid grid-cols-3 gap-2"><TradeMetric label="Buyer pays" value={money(salePrice)} /><TradeMetric label="App fee" value={money(saleFee)} /><TradeMetric label="You receive" value={money(saleNet)} /></div>
            <button onClick={() => listSaleMutation.mutate()} disabled={!validSale || listSaleMutation.isPending} className="mt-4 h-12 w-full rounded-2xl bg-violet-300 text-xs font-black text-slate-950 disabled:opacity-35">{listSaleMutation.isPending ? "Listing…" : `List for ${money(salePrice)}`}</button>
          </div>
        ) : (
          <div className="mt-4">
            <button onClick={() => setMode("actions")} className="mb-3 text-[10px] font-black uppercase tracking-[.12em] text-slate-500">← Trading actions</button>
            <h4 className="text-lg font-black">Create loan listing</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">The borrower pays once. Fantasy Arena keeps 10%, you receive 90%, and the card returns automatically when the loan expires.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block"><span className="text-[9px] font-black uppercase tracking-[.11em] text-slate-500">Duration</span><select value={gameweeks} onChange={(event) => setGameweeks(Number(event.target.value))} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-xs font-black text-white outline-none">{LOAN_DURATIONS_GAMEWEEKS.map((weeks) => <option key={weeks} value={weeks}>{weeks} gameweek{weeks > 1 ? "s" : ""}</option>)}</select></label>
              <label className="block"><span className="text-[9px] font-black uppercase tracking-[.11em] text-slate-500">Price / GW</span><input type="number" min={loanFloor} step="0.01" value={effectiveLoanPrice} onChange={(event) => setLoanPrice(Number(event.target.value))} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-xs font-black text-white outline-none" /></label>
            </div>
            <div className="mt-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3 text-[10px] leading-5 text-slate-400"><Clock3 className="mr-1 inline h-3.5 w-3.5" />Minimum {money(loanFloor)} / GW · {costBasis > 0 ? `10% of your ${money(costBasis)} acquisition price` : `10% of the ${rarity} marketplace floor`}.</div>
            <div className="mt-3 grid grid-cols-3 gap-2"><TradeMetric label="Borrower pays" value={money(loanBreakdown.gross)} /><TradeMetric label="App fee" value={money(loanBreakdown.fee)} /><TradeMetric label="You receive" value={money(loanBreakdown.ownerReceives)} /></div>
            <button onClick={() => listLoanMutation.mutate()} disabled={!validLoan || listLoanMutation.isPending} className="mt-4 h-12 w-full rounded-2xl bg-cyan-300 text-xs font-black text-slate-950 disabled:opacity-35">{listLoanMutation.isPending ? "Listing…" : "Create loan listing"}</button>
          </div>
        )}
      </section>
    </div>
  );
}

function TradeMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[.07] bg-white/[.03] p-2 text-center"><p className="text-[8px] font-black uppercase tracking-[.09em] text-slate-600">{label}</p><p className="mt-1 truncate text-[10px] font-black text-white">{value}</p></div>;
}

function StatusPill({ label, amber = false }: { label: string; amber?: boolean }) {
  return <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[.09em] ${amber ? "bg-amber-300/10 text-amber-200" : "bg-cyan-300/10 text-cyan-100"}`}>{label}</span>;
}

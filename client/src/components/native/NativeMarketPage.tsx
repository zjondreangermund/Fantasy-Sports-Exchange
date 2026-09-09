import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUpDown, ChevronRight, Clock3, Handshake, Search, ShoppingBag, WalletCards, X } from "lucide-react";
import CardPlayerImage from "../CardPlayerImage";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import type { PlayerCardWithPlayer, Wallet } from "../../../../shared/schema";

const rarities = ["all", "common", "rare", "unique", "epic", "legendary"] as const;

// MARKETPLACE_RARITY_GLOW_V2
const marketRarityTone: Record<string, { edge: string; glow: string; ink: string }> = {
  common: { edge: "#e2e8f0", glow: "rgba(226,232,240,.34)", ink: "#f8fafc" },
  rare: { edge: "#3b82f6", glow: "rgba(59,130,246,.48)", ink: "#bfdbfe" },
  unique: { edge: "#c084fc", glow: "rgba(192,132,252,.52)", ink: "#e9d5ff" },
  epic: { edge: "#fb3b4a", glow: "rgba(251,59,74,.52)", ink: "#fecdd3" },
  legendary: { edge: "#fbbf24", glow: "rgba(251,191,36,.56)", ink: "#fde68a" },
};

function marketTone(value: unknown) {
  return marketRarityTone[String(value || "common").toLowerCase()] || marketRarityTone.common;
}

type SortMode = "points" | "low" | "high";
type MarketMode = "buy" | "loan";
type LoanListing = Record<string, any>;

function initialMarketMode(): MarketMode {
  if (typeof window === "undefined") return "buy";
  return new URLSearchParams(window.location.search).get("mode") === "loan" ? "loan" : "buy";
}

function normalizeCards(value: unknown): PlayerCardWithPlayer[] {
  const data: any = value;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.cards)) return data.cards;
  if (Array.isArray(data?.listings)) return data.listings;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function normalizeLoans(value: unknown): LoanListing[] {
  const data: any = value;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.loans)) return data.loans;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return `N$${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function cardPrice(card: any) {
  return Number(card?.price || card?.listedPrice || 0);
}

function points(card: any) {
  return Number(card?.currentGameweekPoints ?? card?.player?.currentGameweekPoints ?? 0);
}

function cardSerial(card: any) {
  return String(card?.serialId || card?.serial_id || "");
}

function loanCard(loan: LoanListing): PlayerCardWithPlayer {
  return (loan.card || {
    id: Number(loan.card_id || loan.cardId || 0),
    playerId: Number(loan.player_id || loan.playerId || 0),
    ownerId: String(loan.original_owner_id || ""),
    rarity: String(loan.rarity || "rare"),
    serialId: loan.serial_id || null,
    serialNumber: loan.serial_number == null ? null : Number(loan.serial_number),
    maxSupply: loan.max_supply == null ? null : Number(loan.max_supply),
    level: Number(loan.level || 1),
    xp: Number(loan.xp || 0),
    decisiveScore: 0,
    last5Scores: [],
    forSale: false,
    price: 0,
    player: {
      id: Number(loan.player_id || loan.playerId || 0),
      name: loan.player_name || loan.playerName || "Player",
      team: loan.team || "Premier League",
      position: loan.position || "-",
      league: loan.league || "Premier League",
      imageUrl: loan.image_url || loan.imageUrl || null,
      verifiedImageUrl: loan.image_url || loan.imageUrl || null,
      totalPoints: loan.official_total_points ?? null,
    },
  }) as PlayerCardWithPlayer;
}

function loanTotal(loan: LoanListing) {
  const explicit = Number(loan.gross_amount ?? loan.grossAmount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return Number(loan.price_per_gameweek || loan.pricePerGameweek || 0) * Number(loan.gameweeks || 1);
}

function loanPricePerGw(loan: LoanListing) {
  return Number(loan.price_per_gameweek || loan.pricePerGameweek || 0);
}

function loanName(loan: LoanListing) {
  return String(loan.player_name || loan.playerName || loan.card?.player?.name || "Player");
}

export default function NativeMarketPage() {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<MarketMode>(() => initialMarketMode());
  const [search, setSearch] = React.useState("");
  const [rarity, setRarity] = React.useState<(typeof rarities)[number]>("all");
  const [sort, setSort] = React.useState<SortMode>("points");
  const [selected, setSelected] = React.useState<PlayerCardWithPlayer | null>(null);
  const [selectedLoan, setSelectedLoan] = React.useState<LoanListing | null>(null);

  const setMarketMode = (next: MarketMode) => {
    setMode(next);
    setSelected(null);
    setSelectedLoan(null);
    if (typeof window !== "undefined") window.history.replaceState(null, "", next === "loan" ? "/marketplace?mode=loan" : "/marketplace?mode=buy");
  };

  const { data: listingsRaw, isLoading } = useQuery<any>({
    queryKey: ["/api/marketplace"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load marketplace");
      return response.json();
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: loansRaw, isLoading: loansLoading } = useQuery<any>({
    queryKey: ["/api/marketplace/loans"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/loans", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load loan marketplace");
      return response.json();
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
    queryFn: async () => {
      const response = await fetch("/api/wallet", { credentials: "include" });
      return response.ok ? response.json() : ({ balance: 0 } as Wallet);
    },
    staleTime: 15_000,
  });

  const { data: myCardsRaw } = useQuery<any>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const response = await fetch("/api/user/cards", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 30_000,
  });

  const listings = React.useMemo(() => normalizeCards(listingsRaw), [listingsRaw]);
  const loans = React.useMemo(() => normalizeLoans(loansRaw), [loansRaw]);
  const myCards = React.useMemo(() => normalizeCards(myCardsRaw), [myCardsRaw]);
  const myCardIds = React.useMemo(() => new Set(myCards.map((card) => Number(card.id))), [myCards]);
  const myListedIds = React.useMemo(
    () => new Set(myCards.filter((card: any) => card.forSale).map((card: any) => Number(card.id))),
    [myCards],
  );

  const shown = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return listings
      .filter((card: any) => rarity === "all" || String(card.rarity || "common").toLowerCase() === rarity)
      .filter((card: any) => {
        if (!needle) return true;
        return `${card.player?.name || ""} ${card.player?.team || ""} ${card.player?.position || ""} ${card.rarity || ""}`.toLowerCase().includes(needle);
      })
      .sort((a: any, b: any) => {
        if (sort === "low") return cardPrice(a) - cardPrice(b);
        if (sort === "high") return cardPrice(b) - cardPrice(a);
        return points(b) - points(a) || cardPrice(a) - cardPrice(b);
      });
  }, [listings, rarity, search, sort]);

  const shownLoans = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [...loans]
      .filter((loan) => rarity === "all" || String(loan.rarity || loan.card?.rarity || "common").toLowerCase() === rarity)
      .filter((loan) => {
        if (!needle) return true;
        return `${loanName(loan)} ${loan.team || loan.card?.player?.team || ""} ${loan.position || loan.card?.player?.position || ""} ${loan.owner_name || ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (sort === "low") return loanTotal(a) - loanTotal(b);
        if (sort === "high") return loanTotal(b) - loanTotal(a);
        return Number(b.official_total_points || b.card?.player?.totalPoints || 0) - Number(a.official_total_points || a.card?.player?.totalPoints || 0) || loanTotal(a) - loanTotal(b);
      });
  }, [loans, rarity, search, sort]);

  const buyMutation = useMutation({
    mutationFn: async (card: PlayerCardWithPlayer) => {
      return (await apiRequest("POST", `/api/marketplace/buy/${Number(card.id)}`, { serialId: cardSerial(card) })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setSelected(null);
      toast({ title: "Card purchased", description: "It is now in your collection." });
    },
    onError: (error: any) => toast({ title: "Purchase failed", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  const acceptLoanMutation = useMutation({
    mutationFn: async (loan: LoanListing) => (await apiRequest("POST", `/api/marketplace/loans/${Number(loan.id)}/accept`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/loans/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setSelectedLoan(null);
      toast({ title: "Loan accepted", description: "The card is temporarily in your collection and returns automatically when the loan expires." });
    },
    onError: (error: any) => toast({ title: "Loan failed", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  const walletBalance = Number((wallet as any)?.balance || 0);
  const selectedPrice = selected ? cardPrice(selected) : 0;
  const selectedIsMine = selected ? myListedIds.has(Number(selected.id)) : false;
  const selectedLoanTotal = selectedLoan ? loanTotal(selectedLoan) : 0;
  const selectedLoanMine = selectedLoan ? myCardIds.has(Number(selectedLoan.card_id || selectedLoan.cardId || selectedLoan.card?.id || 0)) : false;
  const activeCount = mode === "loan" ? shownLoans.length : shown.length;

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-market data-native-market-trading="NATIVE_MARKET_BUY_LOAN_V2">
      <section className="overflow-hidden rounded-[1.55rem] border border-white/[.08] bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,.14),transparent_34%),linear-gradient(145deg,#0b1020,#070916)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Transfer floor</p>
            <h2 className="mt-1 text-2xl font-black">Buy or borrow cards.</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Switch between permanent purchases and fixed-gameweek loans without leaving the app.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[.045] px-3 py-2 text-right">
            <div className="text-[9px] font-black uppercase tracking-[.16em] text-slate-500">Balance</div>
            <div className="mt-0.5 text-sm font-black text-emerald-200">{money(walletBalance)}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/25 p-1">
          <button type="button" onClick={() => setMarketMode("buy")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${mode === "buy" ? "bg-emerald-300 text-slate-950" : "text-slate-500"}`}><ShoppingBag className="mr-1.5 inline h-4 w-4" />Buy</button>
          <button type="button" onClick={() => setMarketMode("loan")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${mode === "loan" ? "bg-cyan-300 text-slate-950" : "text-slate-500"}`}><Handshake className="mr-1.5 inline h-4 w-4" />Loan</button>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player, club or position" className="h-11 rounded-2xl border-white/10 bg-black/25 pl-10 text-white" />
        </div>
      </section>

      <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {rarities.map((item) => <button key={item} onClick={() => setRarity(item)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.11em] ${rarity === item ? "border-cyan-300/45 bg-cyan-300/10 text-cyan-100" : "border-white/8 bg-white/[.03] text-slate-500"}`}>{item}</button>)}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 px-1">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-600">{mode === "loan" ? "Loan cards" : "Sale cards"}</p><p className="text-sm font-black">{activeCount} listing{activeCount === 1 ? "" : "s"}</p></div>
        <button onClick={() => setSort((value) => value === "points" ? "low" : value === "low" ? "high" : "points")} className="inline-flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[.035] px-3 py-2 text-[10px] font-black text-slate-300"><ArrowUpDown className="h-3.5 w-3.5" />{sort === "points" ? "Form" : sort === "low" ? "Price ↑" : "Price ↓"}</button>
      </div>

      {mode === "buy" ? (
        <div className="mt-2 space-y-2">
          {isLoading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[86px] animate-pulse rounded-2xl border border-white/6 bg-white/[.025]" />) : null}
          {!isLoading && shown.slice(0, 20).map((card: any) => {
            const mine = myListedIds.has(Number(card.id));
            const tone = marketTone(card.rarity);
            return <button key={card.id} type="button" onClick={() => setSelected(card)} className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-white/[.032] p-2.5 text-left transition active:scale-[.995]" style={{ borderColor: tone.edge, boxShadow: `0 0 22px ${tone.glow}, inset 0 0 26px ${tone.glow}` }}>
              <span className="pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ background: tone.edge, boxShadow: `0 0 12px ${tone.edge}` }} />
              <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border bg-slate-900" style={{ borderColor: tone.edge, boxShadow: `0 0 18px ${tone.glow}` }}><CardPlayerImage card={card} alt={card.player?.name || "Player"} className="h-full w-full object-cover object-top" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="truncate text-sm font-black text-white">{card.player?.name || "Player"}</p><span className="shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase" style={{ borderColor: tone.edge, color: tone.ink, background: tone.glow, boxShadow: `0 0 10px ${tone.glow}` }}>{String(card.rarity || "common")}</span></div>
                <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{card.player?.team || "Premier League"} · {card.player?.position || "—"}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[10px]"><span className="font-black text-cyan-200">GW {points(card)} pts</span>{mine ? <span className="font-black text-violet-200">Your listing</span> : null}</div>
              </div>
              <div className="shrink-0 text-right"><p className="text-sm font-black text-emerald-200">{money(cardPrice(card))}</p><ChevronRight className="ml-auto mt-2 h-4 w-4 text-slate-600" /></div>
            </button>;
          })}
          {!isLoading && !shown.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No sale cards match those filters.</div> : null}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {loansLoading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[96px] animate-pulse rounded-2xl border border-white/6 bg-white/[.025]" />) : null}
          {!loansLoading && shownLoans.slice(0, 20).map((loan) => {
            const card = loanCard(loan);
            const tone = marketTone(card.rarity);
            const mine = myCardIds.has(Number(card.id));
            return <button key={Number(loan.id)} type="button" onClick={() => setSelectedLoan(loan)} className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-white/[.032] p-2.5 text-left transition active:scale-[.995]" style={{ borderColor: tone.edge, boxShadow: `0 0 22px ${tone.glow}` }}>
              <span className="pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ background: tone.edge, boxShadow: `0 0 12px ${tone.edge}` }} />
              <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border bg-slate-900" style={{ borderColor: tone.edge }}><CardPlayerImage card={card} alt={loanName(loan)} className="h-full w-full object-cover object-top" /></div>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-black">{loanName(loan)}</p><span className="shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase" style={{ borderColor: tone.edge, color: tone.ink, background: tone.glow }}>{String(card.rarity || "rare")}</span></div><p className="mt-1 truncate text-[10px] text-slate-500">{card.player?.team || loan.team || "Premier League"} · {Number(loan.gameweeks || 1)} GW</p><p className="mt-1 text-[9px] font-bold text-cyan-200">{money(loanPricePerGw(loan))} / GW{mine ? " · YOUR LISTING" : ""}</p></div>
              <div className="shrink-0 text-right"><p className="text-sm font-black text-emerald-200">{money(loanTotal(loan))}</p><p className="mt-1 text-[8px] font-black uppercase text-slate-600">total</p><ChevronRight className="ml-auto mt-1 h-4 w-4 text-slate-600" /></div>
            </button>;
          })}
          {!loansLoading && !shownLoans.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No loan cards match those filters.</div> : null}
        </div>
      )}

      {(mode === "buy" ? shown.length : shownLoans.length) > 20 ? <div className="mt-3 text-center"><Link href={mode === "loan" ? "/marketplace?mode=loan&nativeFull=1" : "/marketplace?nativeFull=1"}><Button variant="outline" className="rounded-xl border-white/10 bg-white/[.035] text-white">Open all listings</Button></Link></div> : null}

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-violet-300/10 bg-violet-400/[.055] p-3"><div><p className="text-xs font-black">Selling or lending one of yours?</p><p className="mt-0.5 text-[10px] text-slate-500">Open My Cards, tap the card and choose Sell or Loan.</p></div><Link href="/collection"><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white">My Cards</Button></Link></div>

      {selected ? <div className="fixed inset-0 z-[120] flex items-end bg-black/70 backdrop-blur-sm">
        <button className="absolute inset-0" onClick={() => setSelected(null)} aria-label="Close purchase sheet" />
        <section className="relative z-10 w-full rounded-t-[2rem] border-t border-white/10 bg-[#0a0d1c] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-4 shadow-[0_-2rem_5rem_rgba(0,0,0,.7)]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <button onClick={() => setSelected(null)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"><X className="h-4 w-4" /></button>
          <div className="flex items-center gap-3 pr-11"><div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10"><CardPlayerImage card={selected} alt={selected.player?.name || "Player"} className="h-full w-full object-cover object-top" /></div><div className="min-w-0"><p className="truncate text-xl font-black">{selected.player?.name || "Player"}</p><p className="mt-1 text-xs text-slate-500">{selected.player?.team || "Premier League"} · {selected.player?.position || "—"}</p><p className="mt-2 text-lg font-black text-emerald-200">{money(selectedPrice)}</p></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/[.04] p-2.5 text-center"><p className="text-[9px] uppercase text-slate-600">Rarity</p><p className="mt-1 text-xs font-black uppercase">{String(selected.rarity || "common")}</p></div><div className="rounded-xl bg-white/[.04] p-2.5 text-center"><p className="text-[9px] uppercase text-slate-600">GW points</p><p className="mt-1 text-xs font-black">{points(selected)}</p></div><div className="rounded-xl bg-white/[.04] p-2.5 text-center"><p className="text-[9px] uppercase text-slate-600">After buy</p><p className="mt-1 text-xs font-black">{money(walletBalance - selectedPrice)}</p></div></div>
          {selectedIsMine ? <div className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-400/[.07] p-3 text-center text-sm font-black text-violet-100">This is your own marketplace listing. Manage it from My Cards.</div> : <Button onClick={() => buyMutation.mutate(selected)} disabled={buyMutation.isPending || selectedPrice > walletBalance} className="mt-4 h-12 w-full rounded-2xl bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><ShoppingBag className="mr-2 h-4 w-4" />{selectedPrice > walletBalance ? "Not enough balance" : buyMutation.isPending ? "Buying…" : `Buy for ${money(selectedPrice)}`}</Button>}
          <Link href="/wallet"><button className="mt-3 flex w-full items-center justify-center gap-2 text-xs font-bold text-slate-500"><WalletCards className="h-4 w-4" />Wallet balance {money(walletBalance)}</button></Link>
        </section>
      </div> : null}

      {selectedLoan ? <div className="fixed inset-0 z-[120] flex items-end bg-black/70 backdrop-blur-sm">
        <button className="absolute inset-0" onClick={() => setSelectedLoan(null)} aria-label="Close loan sheet" />
        <section className="relative z-10 w-full rounded-t-[2rem] border-t border-white/10 bg-[#0a0d1c] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-4 shadow-[0_-2rem_5rem_rgba(0,0,0,.7)]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <button onClick={() => setSelectedLoan(null)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"><X className="h-4 w-4" /></button>
          <div className="flex items-center gap-3 pr-11"><div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl border border-cyan-300/20"><CardPlayerImage card={loanCard(selectedLoan)} alt={loanName(selectedLoan)} className="h-full w-full object-cover object-top" /></div><div className="min-w-0"><p className="truncate text-xl font-black">{loanName(selectedLoan)}</p><p className="mt-1 text-xs text-slate-500">{loanCard(selectedLoan).player?.team || "Premier League"} · {loanCard(selectedLoan).player?.position || "—"}</p><p className="mt-2 text-lg font-black text-emerald-200">{money(selectedLoanTotal)} total</p></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/[.04] p-2.5 text-center"><p className="text-[9px] uppercase text-slate-600">Duration</p><p className="mt-1 text-xs font-black">{Number(selectedLoan.gameweeks || 1)} GW</p></div><div className="rounded-xl bg-white/[.04] p-2.5 text-center"><p className="text-[9px] uppercase text-slate-600">Per GW</p><p className="mt-1 text-xs font-black">{money(loanPricePerGw(selectedLoan))}</p></div><div className="rounded-xl bg-white/[.04] p-2.5 text-center"><p className="text-[9px] uppercase text-slate-600">After loan</p><p className="mt-1 text-xs font-black">{money(walletBalance - selectedLoanTotal)}</p></div></div>
          <div className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.045] p-3 text-[10px] leading-5 text-cyan-100"><Clock3 className="mr-1 inline h-3.5 w-3.5" />You pay the full loan amount once. The card is temporary and returns automatically to the lender after the agreed gameweeks.</div>
          {selectedLoanMine ? <div className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-400/[.07] p-3 text-center text-sm font-black text-violet-100">This is your own loan listing. Manage or cancel it from My Cards.</div> : <Button onClick={() => acceptLoanMutation.mutate(selectedLoan)} disabled={acceptLoanMutation.isPending || selectedLoanTotal > walletBalance} className="mt-4 h-12 w-full rounded-2xl bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><Handshake className="mr-2 h-4 w-4" />{selectedLoanTotal > walletBalance ? "Not enough balance" : acceptLoanMutation.isPending ? "Accepting…" : `Loan for ${money(selectedLoanTotal)}`}</Button>}
          <Link href="/wallet"><button className="mt-3 flex w-full items-center justify-center gap-2 text-xs font-bold text-slate-500"><WalletCards className="h-4 w-4" />Wallet balance {money(walletBalance)}</button></Link>
        </section>
      </div> : null}
    </div>
  );
}

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, Filter, Handshake, Search, ShoppingBag, Sparkles } from "lucide-react";
import CardThumbnail from "../CardThumbnail";
import NativeCardTradeSheet from "./NativeCardTradeSheet";
import type { PlayerCardWithPlayer } from "../../../../shared/schema";

type RarityFilter = "all" | "common" | "rare" | "unique" | "epic" | "legendary";
const rarityFilters: RarityFilter[] = ["all", "common", "rare", "unique", "epic", "legendary"];

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

function normalizeCards(value: unknown): PlayerCardWithPlayer[] {
  const data: any = value;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.cards)) return data.cards;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function normalizeLoans(value: unknown): MyLoan[] {
  const data: any = value;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.loans)) return data.loans;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function gameweekPoints(card: PlayerCardWithPlayer) {
  return Number((card as any).currentGameweekPoints ?? (card as any).gameweekPoints ?? 0);
}

function totalPoints(card: PlayerCardWithPlayer) {
  const value = Number((card as any).totalPoints ?? (card.player as any)?.totalPoints ?? gameweekPoints(card));
  return Number.isFinite(value) ? value : 0;
}

function cardLevel(card: PlayerCardWithPlayer) {
  const value = Number((card as any).level ?? 1);
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

function cardForm(card: PlayerCardWithPlayer) {
  const value = Number((card as any).form ?? (card.player as any)?.form ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function compactStat(value: number, digits = 1) {
  return Number(value.toFixed(digits)).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function NativeCardsPage() {
  const [rarity, setRarity] = React.useState<RarityFilter>("all");
  const [search, setSearch] = React.useState("");
  const [visibleCount, setVisibleCount] = React.useState(12);
  const [selected, setSelected] = React.useState<PlayerCardWithPlayer | null>(null);

  const { data: cardsRaw, isLoading } = useQuery<any>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const response = await fetch("/api/user/cards", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    staleTime: 25_000,
    refetchInterval: 60_000,
  });

  const { data: myLoansRaw } = useQuery<any>({
    queryKey: ["/api/marketplace/loans/mine"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/loans/mine", { credentials: "include" });
      if (!response.ok) return { loans: [] };
      return response.json();
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const cards = React.useMemo(() => normalizeCards(cardsRaw), [cardsRaw]);
  const myLoans = React.useMemo(() => normalizeLoans(myLoansRaw), [myLoansRaw]);

  const counts = React.useMemo(() => {
    const result: Record<string, number> = { all: cards.length, common: 0, rare: 0, unique: 0, epic: 0, legendary: 0 };
    for (const card of cards) {
      const key = String(card.rarity || "common").toLowerCase();
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }, [cards]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cards.filter((card) => {
      if (rarity !== "all" && String(card.rarity || "common").toLowerCase() !== rarity) return false;
      if (!needle) return true;
      const haystack = `${card.player?.name || ""} ${card.player?.team || ""} ${card.player?.position || ""} ${card.rarity || ""}`.toLowerCase();
      return haystack.includes(needle);
    }).sort((a, b) => gameweekPoints(b) - gameweekPoints(a));
  }, [cards, rarity, search]);

  const activeLoanCount = myLoans.filter((loan) => ["open", "active"].includes(String(loan.status || "").toLowerCase())).length;
  const lenderActiveCount = myLoans.filter((loan) => loan.relation === "lender" && String(loan.status || "").toLowerCase() === "active").length;

  React.useEffect(() => setVisibleCount(12), [rarity, search]);

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-cards>
      <section className="rounded-[1.55rem] border border-white/[.08] bg-gradient-to-br from-[#11162a] via-[#090d19] to-violet-400/[.07] p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-200/70">Club collection</p><h2 className="mt-1 text-2xl font-black">Own. Buy. Sell. Loan.</h2><p className="mt-1 text-xs leading-5 text-slate-400">Tap any card to manage it directly. Sale and loan fees use the same live rules as the full website.</p></div><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-300/10 text-violet-200"><Sparkles className="h-5 w-5" /></div></div>
        <div className="mt-4 grid grid-cols-4 gap-1.5"><Stat label="Cards" value={String(cards.length)} /><Stat label="For sale" value={String(cards.filter((card) => card.forSale).length)} /><Stat label="Loans" value={String(activeLoanCount)} /><Stat label="GW PTS" value={cards.reduce((total, card) => total + gameweekPoints(card), 0).toFixed(1)} /></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/marketplace?mode=buy" className="flex items-center justify-between rounded-2xl border border-emerald-300/15 bg-emerald-300/[.07] px-3 py-2.5 text-[10px] font-black text-emerald-100"><span className="flex items-center gap-1.5"><ShoppingBag className="h-4 w-4" />Buy cards</span><ChevronRight className="h-4 w-4" /></Link>
          <Link href="/marketplace?mode=loan" className="flex items-center justify-between rounded-2xl border border-cyan-300/15 bg-cyan-300/[.07] px-3 py-2.5 text-[10px] font-black text-cyan-100"><span className="flex items-center gap-1.5"><Handshake className="h-4 w-4" />Loan market</span><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {lenderActiveCount > 0 ? <div className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.045] px-3.5 py-3 text-[10px] leading-4 text-cyan-100"><Handshake className="mr-1.5 inline h-3.5 w-3.5" />{lenderActiveCount} of your card{lenderActiveCount === 1 ? " is" : "s are"} currently out on loan. Active loans return automatically when their agreed gameweeks expire.</div> : null}

      <div className="mt-3 flex gap-2">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player, club or position" className="h-11 w-full rounded-2xl border border-white/[.08] bg-white/[.035] pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600" /></div>
        <Link href="/collection?nativeFull=1" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/[.08] bg-white/[.035] text-slate-400" aria-label="Open full collection tools"><Filter className="h-4 w-4" /></Link>
      </div>

      <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {rarityFilters.map((item) => <button key={item} onClick={() => setRarity(item)} className={`shrink-0 rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-[.1em] ${rarity === item ? "border-cyan-300/45 bg-cyan-300/10 text-cyan-100" : "border-white/[.07] bg-white/[.025] text-slate-500"}`}>{item} · {counts[item] || 0}</button>)}
      </div>

      {isLoading ? (
        <div className="mt-3 grid grid-cols-3 justify-items-center gap-x-1 gap-y-2.5">{Array.from({ length: 9 }).map((_, index) => <div key={index} className="h-[176px] w-full max-w-[104px] animate-pulse rounded-xl bg-white/[.035]" />)}</div>
      ) : filtered.length ? (
        <>
          <div className="mt-3 grid grid-cols-3 items-start justify-items-center gap-x-1 gap-y-2.5" data-native-static-card-grid>
            {filtered.slice(0, visibleCount).map((card) => (
              <div
                key={card.id}
                className="flex w-full min-w-0 justify-center rounded-xl border border-white/[.055] bg-black/15 px-1 pb-1.5 pt-1.5"
              >
                <div className="w-[96px] max-w-full" data-native-static-card>
                  <div className="mx-auto flex w-[96px] max-w-full justify-center" onClick={() => setSelected(card)}>
                    <CardThumbnail card={card} size="xs" showMeta={false} showStats={false} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(card)}
                    className="mt-1 grid w-full grid-cols-3 gap-1 text-left"
                    aria-label={`Open ${card.player?.name || "player"} card stats`}
                    data-native-card-stats
                  >
                    <MiniStat label="LVL" value={String(cardLevel(card))} />
                    <MiniStat label="PTS" value={compactStat(totalPoints(card), 1)} />
                    <MiniStat label="FORM" value={compactStat(cardForm(card), 1)} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(card)}
                    className="mt-1 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 text-left"
                    aria-label={`Open ${card.player?.name || "player"} trading actions`}
                  >
                    <span className="min-w-0 justify-self-start truncate rounded-md bg-white/[.05] px-1.5 py-0.5 text-[7px] font-black uppercase text-slate-500">{String(card.player?.position || "-").toUpperCase()}</span>
                    <span className="justify-self-end rounded-md bg-cyan-300/[.08] px-1.5 py-0.5 text-[8px] font-black tabular-nums text-cyan-100">GW {gameweekPoints(card).toFixed(2)}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
          {visibleCount < filtered.length ? <button onClick={() => setVisibleCount((value) => value + 12)} className="mt-3 w-full rounded-2xl border border-white/[.08] bg-white/[.03] py-3 text-xs font-black text-slate-300">Show 12 more</button> : null}
        </>
      ) : <div className="mt-4 rounded-2xl border border-dashed border-white/[.08] p-7 text-center text-xs text-slate-500">No cards match this filter.</div>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/marketplace?mode=buy" className="flex items-center justify-between rounded-2xl border border-emerald-300/10 bg-emerald-300/[.045] p-3 text-xs font-black text-emerald-100"><span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Marketplace</span><ChevronRight className="h-4 w-4" /></Link>
        <Link href="/collection?nativeFull=1" className="flex items-center justify-between rounded-2xl border border-violet-300/10 bg-violet-300/[.045] p-3 text-xs font-black text-violet-100"><span>Full tools</span><ChevronRight className="h-4 w-4" /></Link>
      </div>

      {selected ? <NativeCardTradeSheet card={selected} myLoans={myLoans} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <span className="min-w-0 rounded-md border border-white/[.07] bg-white/[.04] px-0.5 py-1 text-center"><span className="block text-[5px] font-black uppercase tracking-[.08em] text-slate-600">{label}</span><span className="mt-0.5 block truncate text-[7px] font-black tabular-nums text-white/90">{value}</span></span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl border border-white/[.06] bg-black/20 p-2"><p className="truncate text-[7px] font-black uppercase tracking-[.08em] text-slate-600">{label}</p><p className="mt-1 truncate text-xs font-black">{value}</p></div>;
}

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUpDown, ChevronRight, Search, ShoppingBag, WalletCards, X } from "lucide-react";
import CardPlayerImage from "../CardPlayerImage";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import type { PlayerCardWithPlayer, Wallet } from "../../../../shared/schema";

const rarities = ["all", "common", "rare", "unique", "epic", "legendary"] as const;
type SortMode = "points" | "low" | "high";

function normalizeCards(value: unknown): PlayerCardWithPlayer[] {
  const data: any = value;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.cards)) return data.cards;
  if (Array.isArray(data?.listings)) return data.listings;
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

export default function NativeMarketPage() {
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [rarity, setRarity] = React.useState<(typeof rarities)[number]>("all");
  const [sort, setSort] = React.useState<SortMode>("points");
  const [selected, setSelected] = React.useState<PlayerCardWithPlayer | null>(null);

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
  const myListedIds = React.useMemo(
    () => new Set(normalizeCards(myCardsRaw).filter((card: any) => card.forSale).map((card: any) => Number(card.id))),
    [myCardsRaw],
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

  const walletBalance = Number((wallet as any)?.balance || 0);
  const selectedPrice = selected ? cardPrice(selected) : 0;
  const selectedIsMine = selected ? myListedIds.has(Number(selected.id)) : false;

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-market>
      <section className="overflow-hidden rounded-[1.55rem] border border-white/[.08] bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,.14),transparent_34%),linear-gradient(145deg,#0b1020,#070916)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Transfer floor</p>
            <h2 className="mt-1 text-2xl font-black">Find your next card.</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Fast browsing only. Tap a player for the purchase sheet.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[.045] px-3 py-2 text-right">
            <div className="text-[9px] font-black uppercase tracking-[.16em] text-slate-500">Balance</div>
            <div className="mt-0.5 text-sm font-black text-emerald-200">{money(walletBalance)}</div>
          </div>
        </div>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player, club or position" className="h-11 rounded-2xl border-white/10 bg-black/25 pl-10 text-white" />
        </div>
      </section>

      <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {rarities.map((item) => <button key={item} onClick={() => setRarity(item)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.11em] ${rarity === item ? "border-cyan-300/45 bg-cyan-300/10 text-cyan-100" : "border-white/8 bg-white/[.03] text-slate-500"}`}>{item}</button>)}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 px-1">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-600">Available now</p><p className="text-sm font-black">{shown.length} listing{shown.length === 1 ? "" : "s"}</p></div>
        <button onClick={() => setSort((value) => value === "points" ? "low" : value === "low" ? "high" : "points")} className="inline-flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[.035] px-3 py-2 text-[10px] font-black text-slate-300"><ArrowUpDown className="h-3.5 w-3.5" />{sort === "points" ? "Form" : sort === "low" ? "Price ↑" : "Price ↓"}</button>
      </div>

      <div className="mt-2 space-y-2">
        {isLoading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[86px] animate-pulse rounded-2xl border border-white/6 bg-white/[.025]" />) : null}
        {!isLoading && shown.slice(0, 20).map((card: any) => {
          const mine = myListedIds.has(Number(card.id));
          return <button key={card.id} type="button" onClick={() => setSelected(card)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.032] p-2.5 text-left active:scale-[.995]">
            <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border border-white/8 bg-slate-900"><CardPlayerImage card={card} alt={card.player?.name || "Player"} className="h-full w-full object-cover object-top" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><p className="truncate text-sm font-black text-white">{card.player?.name || "Player"}</p><span className="shrink-0 rounded-full bg-white/[.06] px-2 py-0.5 text-[8px] font-black uppercase text-slate-400">{String(card.rarity || "common")}</span></div>
              <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{card.player?.team || "Premier League"} · {card.player?.position || "—"}</p>
              <div className="mt-1.5 flex items-center gap-3 text-[10px]"><span className="font-black text-cyan-200">GW {points(card)} pts</span>{mine ? <span className="font-black text-violet-200">Your listing</span> : null}</div>
            </div>
            <div className="shrink-0 text-right"><p className="text-sm font-black text-emerald-200">{money(cardPrice(card))}</p><ChevronRight className="ml-auto mt-2 h-4 w-4 text-slate-600" /></div>
          </button>;
        })}
        {!isLoading && !shown.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No cards match those filters.</div> : null}
      </div>

      {shown.length > 20 ? <div className="mt-3 text-center"><Link href="/marketplace?nativeFull=1"><Button variant="outline" className="rounded-xl border-white/10 bg-white/[.035] text-white">Open all {shown.length} listings</Button></Link></div> : null}

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-violet-300/10 bg-violet-400/[.055] p-3"><div><p className="text-xs font-black">Need advanced market tools?</p><p className="mt-0.5 text-[10px] text-slate-500">Loans, watchlist, detailed stats and listing management.</p></div><Link href="/marketplace?nativeFull=1"><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white">Full market</Button></Link></div>

      {selected ? <div className="fixed inset-0 z-[120] flex items-end bg-black/70 backdrop-blur-sm">
        <button className="absolute inset-0" onClick={() => setSelected(null)} aria-label="Close purchase sheet" />
        <section className="relative z-10 w-full rounded-t-[2rem] border-t border-white/10 bg-[#0a0d1c] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-4 shadow-[0_-2rem_5rem_rgba(0,0,0,.7)]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <button onClick={() => setSelected(null)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"><X className="h-4 w-4" /></button>
          <div className="flex items-center gap-3 pr-11"><div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10"><CardPlayerImage card={selected} alt={selected.player?.name || "Player"} className="h-full w-full object-cover object-top" /></div><div className="min-w-0"><p className="truncate text-xl font-black">{selected.player?.name || "Player"}</p><p className="mt-1 text-xs text-slate-500">{selected.player?.team || "Premier League"} · {selected.player?.position || "—"}</p><p className="mt-2 text-lg font-black text-emerald-200">{money(selectedPrice)}</p></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/[.04] p-2.5 text-center"><p className="text-[9px] uppercase text-slate-600">Rarity</p><p className="mt-1 text-xs font-black uppercase">{String(selected.rarity || "common")}</p></div><div className="rounded-xl bg-white/[.04] p-2.5 text-center"><p className="text-[9px] uppercase text-slate-600">GW points</p><p className="mt-1 text-xs font-black">{points(selected)}</p></div><div className="rounded-xl bg-white/[.04] p-2.5 text-center"><p className="text-[9px] uppercase text-slate-600">After buy</p><p className="mt-1 text-xs font-black">{money(walletBalance - selectedPrice)}</p></div></div>
          {selectedIsMine ? <div className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-400/[.07] p-3 text-center text-sm font-black text-violet-100">This is your own marketplace listing.</div> : <Button onClick={() => buyMutation.mutate(selected)} disabled={buyMutation.isPending || selectedPrice > walletBalance} className="mt-4 h-12 w-full rounded-2xl bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><ShoppingBag className="mr-2 h-4 w-4" />{selectedPrice > walletBalance ? "Not enough balance" : buyMutation.isPending ? "Buying…" : `Buy for ${money(selectedPrice)}`}</Button>}
          <Link href="/wallet"><button className="mt-3 flex w-full items-center justify-center gap-2 text-xs font-bold text-slate-500"><WalletCards className="h-4 w-4" />Wallet balance {money(walletBalance)}</button></Link>
        </section>
      </div> : null}
    </div>
  );
}

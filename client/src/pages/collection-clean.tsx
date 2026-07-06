import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { useToast } from "../hooks/use-toast";
import { useIsMobile } from "../hooks/use-mobile";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import CollectionStableCard from "../components/cards/CollectionStableCard";
import CardProfileModal from "../components/cards/CardProfileModal";
import { type PlayerCardWithPlayer, type Lineup } from "../../../shared/schema";
import { Archive, ChevronLeft, ChevronRight, Crown, DollarSign, Gem, Search, ShieldCheck, Sparkles, Trophy, X } from "lucide-react";

type RarityKey = "all" | "common" | "rare" | "epic" | "unique" | "legendary";
const PAGE_SIZE = 25;
const BASE_PRICES: Record<string, number> = { common: 0, rare: 20, unique: 50, epic: 50, legendary: 100 };
const rarityOrder: Record<string, number> = { legendary: 5, unique: 4, epic: 3, rare: 2, common: 1 };
function rarityOf(card: PlayerCardWithPlayer) { return String(card.rarity || "common").toLowerCase(); }
function money(value: unknown) { const n = Number(value || 0); return Number.isFinite(n) ? `N$${n.toFixed(2)}` : "N$0.00"; }
function normalizeCards(data: unknown): PlayerCardWithPlayer[] { if (Array.isArray(data)) return data as PlayerCardWithPlayer[]; if (Array.isArray((data as any)?.cards)) return (data as any).cards; return []; }
function playerName(card: PlayerCardWithPlayer) { return String(card.player?.name || "").toLowerCase(); }
function cardValue(card: PlayerCardWithPlayer) { return Number(card.price || BASE_PRICES[rarityOf(card)] || 0); }

export default function CollectionCleanPage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<RarityKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingLineup, setEditingLineup] = useState(false);
  const [selectedForLineup, setSelectedForLineup] = useState<Set<number>>(new Set());
  const [profileCard, setProfileCard] = useState<PlayerCardWithPlayer | null>(null);
  const [listingCard, setListingCard] = useState<PlayerCardWithPlayer | null>(null);
  const [listingPrice, setListingPrice] = useState("");

  const { data: cards = [], isLoading } = useQuery<PlayerCardWithPlayer[]>({ queryKey: ["/api/user/cards"], queryFn: async () => { const res = await fetch("/api/user/cards", { credentials: "include" }); if (!res.ok) throw new Error("Failed to fetch cards"); return normalizeCards(await res.json()); } });
  const { data: lineupData } = useQuery<{ lineup: Lineup; cards: PlayerCardWithPlayer[] }>({ queryKey: ["/api/lineup"], queryFn: async () => { const res = await fetch("/api/lineup", { credentials: "include" }); if (!res.ok) throw new Error("Failed to fetch lineup"); return res.json(); } });
  const saveLineupMutation = useMutation({ mutationFn: async (cardIds: number[]) => (await apiRequest("POST", "/api/lineup", { cardIds })).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] }); queryClient.invalidateQueries({ queryKey: ["/api/lineup"] }); setEditingLineup(false); toast({ title: "Lineup saved" }); }, onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }) });
  const listMutation = useMutation({ mutationFn: async ({ cardId, price }: { cardId: number; price: number }) => (await apiRequest("POST", "/api/marketplace/list", { cardId, price })).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] }); queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] }); setListingCard(null); setListingPrice(""); toast({ title: "Card listed" }); }, onError: (error: any) => toast({ title: "Error", description: error.message || "Failed to list card", variant: "destructive" }) });
  const cancelMutation = useMutation({ mutationFn: async (cardId: number) => (await apiRequest("POST", `/api/marketplace/cancel/${cardId}`, {})).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] }); queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] }); toast({ title: "Listing cancelled" }); }, onError: (error: any) => toast({ title: "Error", description: error.message || "Failed to cancel", variant: "destructive" }) });

  const counts = useMemo(() => { const base: Record<string, number> = { common: 0, rare: 0, epic: 0, unique: 0, legendary: 0 }; cards.forEach((card) => { const r = rarityOf(card); if (base[r] !== undefined) base[r] += 1; }); return base; }, [cards]);
  const collectionValue = useMemo(() => cards.reduce((sum, card) => sum + cardValue(card), 0), [cards]);
  const listedCount = cards.filter((card) => card.forSale).length;
  const premiumCount = cards.filter((card) => rarityOf(card) !== "common").length;
  const filteredCards = useMemo(() => cards.filter((card) => (filter === "all" || rarityOf(card) === filter) && (!search || playerName(card).includes(search.toLowerCase()))).sort((a, b) => (rarityOrder[rarityOf(b)] || 0) - (rarityOrder[rarityOf(a)] || 0) || playerName(a).localeCompare(playerName(b))), [cards, filter, search]);
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedCards = useMemo(() => filteredCards.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredCards, safePage]);
  const pageStart = filteredCards.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filteredCards.length);
  const listingRarity = listingCard ? rarityOf(listingCard) : "common";
  const minimumPrice = BASE_PRICES[listingRarity] || 1;
  const numericListingPrice = Number(listingPrice || 0);
  const listingIsValid = Boolean(listingCard && Number.isFinite(numericListingPrice) && numericListingPrice >= minimumPrice);

  useEffect(() => { setPage(1); }, [filter, search]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  function startEditLineup() { setEditingLineup(true); setSelectedForLineup(new Set(lineupData?.lineup?.cardIds || [])); }
  function toggleLineupCard(cardId: number) { setSelectedForLineup((prev) => { const next = new Set(prev); if (next.has(cardId)) next.delete(cardId); else if (next.size < 5) next.add(cardId); return next; }); }
  function handleCardTap(card: PlayerCardWithPlayer) { if (editingLineup) toggleLineupCard(card.id); else setProfileCard(card); }
  function openSellModal(card: PlayerCardWithPlayer) { const rarity = rarityOf(card); if (rarity === "common") return toast({ title: "Cannot sell common cards", variant: "destructive" }); setListingCard(card); setListingPrice(String(BASE_PRICES[rarity] || 1)); }
  function confirmListing() { if (!listingCard) return; if (!listingIsValid) return toast({ title: "Price too low", description: `Minimum price is ${money(minimumPrice)}`, variant: "destructive" }); listMutation.mutate({ cardId: listingCard.id, price: numericListingPrice }); }

  const filters = [
    { value: "all" as RarityKey, label: "All", icon: <Archive className="h-4 w-4" />, count: cards.length },
    { value: "common" as RarityKey, label: "Common", icon: <ShieldCheck className="h-4 w-4" />, count: counts.common },
    { value: "rare" as RarityKey, label: "Rare", icon: <Sparkles className="h-4 w-4" />, count: counts.rare },
    { value: "epic" as RarityKey, label: "Epic", icon: <Sparkles className="h-4 w-4" />, count: counts.epic },
    { value: "unique" as RarityKey, label: "Unique", icon: <Gem className="h-4 w-4" />, count: counts.unique },
    { value: "legendary" as RarityKey, label: "Legendary", icon: <Crown className="h-4 w-4" />, count: counts.legendary },
  ];

  const gridClass = "collection-card-grid grid grid-cols-2 justify-items-center gap-x-4 gap-y-8 pb-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5";

  return (
    <main className="collection-page relative min-h-full overflow-x-hidden overflow-y-visible bg-[#030817] px-3 pb-[calc(11rem+env(safe-area-inset-bottom,0px))] pt-4 text-white sm:px-6" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(124,58,237,.35),transparent_34%),radial-gradient(circle_at_80%_12%,rgba(14,165,233,.22),transparent_34%),radial-gradient(circle_at_48%_42%,rgba(245,158,11,.10),transparent_35%),linear-gradient(180deg,#060b1d_0%,#040716_48%,#020512_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-20 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.065] p-4 shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.22em] text-violet-100"><Trophy className="h-3.5 w-3.5" /> Fantasy Arena Vault</div>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Premium Collection</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">Showing 25 cards per page for faster scrolling and cleaner browsing.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]"><Stat label="Cards" value={cards.length} /><Stat label="Premium" value={premiumCount} /><Stat label="Value" value={money(collectionValue)} /></div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your players..." className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-10 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-violet-300/50" /></div>
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:max-w-[620px]">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black transition ${filter === item.value ? "border-violet-300/70 bg-violet-500 text-white shadow-[0_0_26px_rgba(139,92,246,.45)]" : "border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/[0.1]"}`}>{item.icon}{item.label}<span className="text-xs opacity-70">{item.count || 0}</span></button>)}</div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={startEditLineup} className="rounded-xl border-white/15 bg-white/[0.06] text-white hover:bg-white/10">Edit Lineup</Button>{editingLineup ? <Button size="sm" onClick={() => saveLineupMutation.mutate(Array.from(selectedForLineup))} disabled={saveLineupMutation.isPending || selectedForLineup.size !== 5} className="rounded-xl bg-emerald-400 font-black text-black hover:bg-emerald-300">Save Lineup ({selectedForLineup.size}/5)</Button> : null}<Badge className="rounded-xl bg-amber-400/15 px-3 py-1 text-amber-100">{listedCount} on market</Badge></div><div className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-white/70">Showing {pageStart}-{pageEnd} of {filteredCards.length}</div></div>
        </section>
        {editingLineup ? <Card className="border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-50">Pick exactly 5 cards. Selected cards get a green glow.</Card> : null}
        {isLoading ? <div className={gridClass}>{Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-[236px] w-[164px] rounded-[22px] bg-slate-800" />)}</div> : filteredCards.length ? <><div className={gridClass}>{pagedCards.map((card) => { const fantasyCard = toFantasyCardData(card, { imageWidth: 720 }); const rarity = rarityOf(card); const isSelected = selectedForLineup.has(card.id); return <div key={card.id} className="group flex w-full max-w-[190px] touch-pan-y flex-col items-center gap-2"><div className="relative transition duration-300 md:group-hover:-translate-y-1">{card.forSale ? <Badge className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-amber-400 px-3 py-1 font-black text-black shadow-[0_0_22px_rgba(251,191,36,.55)]">Listed</Badge> : null}<CollectionStableCard player={fantasyCard} selected={isSelected} onClick={() => handleCardTap(card)} showPrice={Boolean(card.forSale)} size={isMobile ? "sm" : "md"} /></div>{card.forSale ? <button onClick={() => cancelMutation.mutate(card.id)} disabled={cancelMutation.isPending} className="h-9 w-full rounded-2xl border border-white/50 bg-gradient-to-b from-white via-slate-200 to-slate-500 px-3 text-[11px] font-black uppercase tracking-[.1em] text-slate-950 shadow-[0_8px_22px_rgba(0,0,0,.45)]">Cancel {money(card.price)}</button> : rarity === "common" ? <button disabled className="h-9 w-full rounded-2xl border border-white/25 bg-gradient-to-b from-white/45 to-slate-500/60 px-3 text-[11px] font-black uppercase tracking-[.1em] text-slate-950 opacity-70">Tournament Only</button> : <button onClick={() => openSellModal(card)} disabled={listMutation.isPending} className="h-9 w-full rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-300 via-lime-200 to-amber-200 px-3 text-[11px] font-black uppercase tracking-[.1em] text-black shadow-[0_0_22px_rgba(52,211,153,.35)]"><DollarSign className="mr-1 inline h-3 w-3" /> Sell</button>}</div>; })}</div><Pagination page={safePage} totalPages={totalPages} setPage={setPage} /></> : <Card className="border-white/10 bg-white/[0.06] p-8 text-center text-white"><p className="text-white/60">No cards found with this filter.</p></Card>}
      </div>
      {profileCard ? <CardProfileModal card={profileCard} onClose={() => setProfileCard(null)} /> : null}
      {listingCard ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"><div className="w-full max-w-md rounded-[1.75rem] border border-white/15 bg-[#090d1f] p-5 text-white shadow-[0_30px_100px_rgba(0,0,0,.7)]"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-200">List Card</p><h2 className="mt-1 text-2xl font-black">Set Sale Price</h2><p className="mt-1 text-sm text-white/50">Minimum for {listingRarity}: {money(minimumPrice)}</p></div><button onClick={() => setListingCard(null)} className="rounded-full border border-white/10 bg-white/5 p-2"><X className="h-4 w-4" /></button></div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="font-bold">{listingCard.player?.name}</p><p className="text-sm capitalize text-white/50">{listingRarity} • {listingCard.player?.position}</p><label className="mt-4 block text-xs font-black uppercase tracking-[.16em] text-white/40">Price (N$)</label><Input type="number" min={minimumPrice} step="1" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)} className="mt-2 h-12 border-white/10 bg-black/35 text-lg font-black text-white" autoFocus /><div className="mt-3 flex gap-2">{[10, 50, 100].map((add) => <button key={add} onClick={() => setListingPrice(String(Math.max(minimumPrice, Number(listingPrice || minimumPrice) + add)))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/75">+N${add}</button>)}</div>{!listingIsValid ? <p className="mt-3 text-sm text-red-300">Enter at least {money(minimumPrice)}.</p> : <p className="mt-3 text-sm text-emerald-300">Ready to list for {money(numericListingPrice)}.</p>}</div><div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => setListingCard(null)} className="rounded-xl border-white/15 bg-white/5 text-white">Cancel</Button><Button onClick={confirmListing} disabled={!listingIsValid || listMutation.isPending} className="rounded-xl bg-emerald-400 font-black text-black hover:bg-emerald-300">{listMutation.isPending ? "Listing..." : "Confirm Listing"}</Button></div></div></div> : null}
    </main>
  );
}

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (page: number) => void }) {
  const pages = Array.from(new Set([1, Math.max(1, page - 1), page, Math.min(totalPages, page + 1), totalPages])).filter((p) => p >= 1 && p <= totalPages);
  return <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto mt-4 flex max-w-fit items-center gap-2 rounded-2xl border border-white/10 bg-black/70 p-2 shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur-2xl md:static md:mb-8"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-xl border-white/10 bg-white/5 px-2 text-white"><ChevronLeft className="h-4 w-4" /></Button>{pages.map((p) => <button key={p} onClick={() => setPage(p)} className={`h-9 min-w-9 rounded-xl px-3 text-sm font-black ${p === page ? "bg-violet-500 text-white shadow-[0_0_22px_rgba(139,92,246,.55)]" : "border border-white/10 bg-white/5 text-white/70"}`}>{p}</button>)}<Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-xl border-white/10 bg-white/5 px-2 text-white"><ChevronRight className="h-4 w-4" /></Button></div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">{label}</p><p className="mt-1 truncate text-lg font-black text-white">{value}</p></div>;
}

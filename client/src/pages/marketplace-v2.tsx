import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { LiveHero, LivePageShell, LiveStatCard } from "../components/layout/LivePageShell";
import CardShowcase from "../components/CardShowcase";
import { LoanMarketPanel } from "../components/marketplace/LoanMarketPanel";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type PlayerCardWithPlayer, type Wallet } from "../../../shared/schema";
import { ArrowRight, Crown, Gem, Handshake, Heart, Search, Shield, ShoppingCart, Star, Tag, TrendingUp, WalletCards, Zap } from "lucide-react";
import { useToast } from "../hooks/use-toast";

type SortMode = "performance" | "priceAsc" | "priceDesc" | "rarity";
type MarketMode = "buy" | "loan";

const rarityOrder: Record<string, number> = { common: 0, rare: 1, unique: 2, epic: 3, legendary: 4 };
const rarityGlow: Record<string, string> = {
  common: "rgba(148,163,184,.22)",
  rare: "rgba(59,130,246,.36)",
  epic: "rgba(168,85,247,.42)",
  unique: "rgba(236,72,153,.42)",
  legendary: "rgba(251,191,36,.48)",
};

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
function money(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "N$0.00";
  return `N$${n.toFixed(2)}`;
}
function rarityOf(card: PlayerCardWithPlayer) { return String(card.rarity || "common").toLowerCase(); }
function cardId(card: PlayerCardWithPlayer) { const id = Number((card as any).id ?? (card as any).cardId ?? 0); return Number.isInteger(id) ? id : 0; }
function cardPrice(card: PlayerCardWithPlayer) { return Number((card as any).price || (card as any).listedPrice || 0); }
function cardSerial(card: PlayerCardWithPlayer) { return String((card as any).serialId || ""); }
function ownerName(card: PlayerCardWithPlayer) { return String((card as any).ownerUsername || (card as any).ownerName || "Fantasy Arena"); }

export default function MarketplaceV2Page() {
  const { toast } = useToast();
  const [marketMode, setMarketMode] = useState<MarketMode>(() => initialMarketMode());
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("all");
  const [sortBy, setSortBy] = useState<SortMode>("performance");
  const [selected, setSelected] = useState<PlayerCardWithPlayer | null>(null);
  const [buying, setBuying] = useState<PlayerCardWithPlayer | null>(null);
  const [watchlist, setWatchlist] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("market_watchlist_card_ids") || "[]"); } catch { return []; }
  });

  const setMode = (mode: MarketMode) => {
    setMarketMode(mode);
    if (typeof window !== "undefined") window.history.replaceState(null, "", mode === "loan" ? "/marketplace?mode=loan" : "/marketplace");
  };

  const { data: listings = [], isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/marketplace"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch marketplace");
      return normalizeCards(await res.json());
    },
  });

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
    queryFn: async () => { const res = await fetch("/api/wallet", { credentials: "include" }); if (!res.ok) throw new Error("Failed to fetch wallet"); return res.json(); },
  });
  const { data: myCards = [] } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => { const res = await fetch("/api/user/cards", { credentials: "include" }); if (!res.ok) return []; return normalizeCards(await res.json()); },
  });

  const buyMutation = useMutation({
    mutationFn: async (card: PlayerCardWithPlayer) => {
      const res = await apiRequest("POST", `/api/marketplace/buy/${cardId(card)}`, { serialId: cardSerial(card) });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      setBuying(null);
      toast({ title: "Card purchased!" });
    },
    onError: (error: any) => toast({ title: "Purchase failed", description: error.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const source = normalizeCards(listings);
    return source.filter((card) => {
      const fantasy = toFantasyCardData(card, { imageWidth: 320 });
      const haystack = `${fantasy.name} ${fantasy.team || ""} ${fantasy.club || ""} ${fantasy.position || ""}`.toLowerCase();
      return (!search || haystack.includes(search.toLowerCase())) && (rarity === "all" || rarityOf(card) === rarity);
    }).sort((a, b) => {
      if (sortBy === "priceAsc") return cardPrice(a) - cardPrice(b);
      if (sortBy === "priceDesc") return cardPrice(b) - cardPrice(a);
      if (sortBy === "rarity") return (rarityOrder[rarityOf(b)] || 0) - (rarityOrder[rarityOf(a)] || 0);
      return Number(b.decisiveScore || 0) - Number(a.decisiveScore || 0);
    });
  }, [listings, search, rarity, sortBy]);

  const avgPrice = filtered.length ? filtered.reduce((sum, card) => sum + cardPrice(card), 0) / filtered.length : 0;
  const premium = filtered.filter((card) => ["unique", "epic", "legendary"].includes(rarityOf(card))).length;
  const myListed = normalizeCards(myCards).filter((card) => card.forSale).length;
  const hotCards = filtered.slice(0, 3);
  const walletBalance = Number(wallet?.balance || 0);

  const toggleWatch = (id: number) => {
    setWatchlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("market_watchlist_card_ids", JSON.stringify(next));
      return next;
    });
  };

  return (
    <LivePageShell tone="trading">
      <LiveHero eyebrow="Transfer Market" title="Premium Trading Floor" description="Buy premium chrome cards, enter the loan market, and track every listing from one high-end market hub.">
        <LiveStatCard label="Sale Listings" value={String(filtered.length)} helper="Available now" />
        <LiveStatCard label="Average Sale" value={money(avgPrice)} helper="Filtered price" />
        <LiveStatCard label="Balance" value={money(walletBalance)} helper="Wallet funds" />
      </LiveHero>

      <section className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
        <Card className="cinematic-glass border-cyan-300/15 bg-white/[0.06] p-5 text-white backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-cyan-300" /><h2 className="font-black">Market Pulse</h2></div>
          <div className="grid grid-cols-2 gap-3"><Pulse label="Watchlist" value={String(watchlist.length)} icon={<Heart className="h-4 w-4" />} /><Pulse label="Premium" value={String(premium)} icon={<Gem className="h-4 w-4" />} /><Pulse label="My Listings" value={String(myListed)} icon={<Tag className="h-4 w-4" />} /><Pulse label="Wallet" value={money(walletBalance)} icon={<WalletCards className="h-4 w-4" />} /></div>
        </Card>
        <Card className="cinematic-glass border-white/10 bg-slate-950/60 p-5 text-white backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-emerald-300" /><h2 className="font-black">Hot Board</h2></div>
          <div className="grid gap-2 sm:grid-cols-3">{hotCards.length ? hotCards.map((card) => <HotCard key={cardId(card)} card={card} onClick={() => setSelected(card)} />) : <p className="text-sm text-white/50">No live listings yet.</p>}</div>
        </Card>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/35 p-4 shadow-[0_24px_80px_rgba(0,0,0,.35)] backdrop-blur-2xl">
        <div className="mb-4 grid gap-3 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/45 p-1">
            <Button size="sm" variant={marketMode === "buy" ? "default" : "ghost"} onClick={() => setMode("buy")} className="gap-2 rounded-xl"><ShoppingCart className="h-4 w-4" /> Buy</Button>
            <Button size="sm" variant={marketMode === "loan" ? "default" : "ghost"} onClick={() => setMode("loan")} className="gap-2 rounded-xl"><Handshake className="h-4 w-4" /> Loan</Button>
          </div>
          <div className="relative min-w-0"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players, team, position..." className="h-12 border-white/10 bg-black/45 pl-10 text-white" /></div>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-black/45 px-3 text-sm text-white outline-none"><option value="all">All Rarities</option><option value="common">Common</option><option value="rare">Rare</option><option value="unique">Unique</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)} className="h-12 rounded-xl border border-white/10 bg-black/45 px-3 text-sm text-white outline-none"><option value="performance">Performance</option><option value="priceAsc">Price ↑</option><option value="priceDesc">Price ↓</option><option value="rarity">Rarity</option></select>
        </div>

        {marketMode === "loan" ? <LoanMarketPanel myCards={normalizeCards(myCards)} walletBalance={walletBalance} /> : (
          <div className="grid gap-3">{isLoading ? <div className="grid gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[1.5rem] bg-slate-800" />)}</div> : filtered.length ? filtered.map((card) => <MarketRow key={cardId(card)} card={card} watched={watchlist.includes(cardId(card))} onWatch={() => toggleWatch(cardId(card))} onBuy={() => setBuying(card)} onDetails={() => setSelected(card)} />) : <Card className="border-slate-800 bg-slate-950/60 p-12 text-center"><ShoppingCart className="mx-auto mb-4 h-12 w-12 text-slate-600" /><p className="text-lg text-slate-300">No cards match your search.</p></Card>}</div>
        )}
      </section>

      <Dialog open={!!buying} onOpenChange={(open) => !open && setBuying(null)}>
        <DialogContent className="border-white/10 bg-[#070b18] text-white shadow-[0_30px_100px_rgba(0,0,0,.75)]"><DialogHeader><DialogTitle>Confirm Purchase</DialogTitle></DialogHeader>{buying ? <div className="py-4"><div className="mb-4 flex justify-center"><CardShowcase card={buying} size="sm" /></div><div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p>Buy <strong>{buying.player?.name}</strong> for <strong className="text-emerald-300">{money(cardPrice(buying))}</strong>?</p><p className="mt-1 text-sm text-slate-400">Seller: {ownerName(buying)}</p><p className="mt-2 text-sm text-slate-400">Your Balance: {money(walletBalance)}</p>{walletBalance < cardPrice(buying) ? <p className="mt-2 text-sm font-bold text-red-300">Insufficient wallet balance.</p> : null}</div></div> : null}<DialogFooter><Button variant="outline" onClick={() => setBuying(null)}>Cancel</Button><Button disabled={!buying || buyMutation.isPending || walletBalance < cardPrice(buying)} onClick={() => buying && buyMutation.mutate(buying)}>{buyMutation.isPending ? "Processing..." : "Confirm Purchase"}</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl border-white/10 bg-[#070b18] text-white"><DialogHeader><DialogTitle>Market Details</DialogTitle></DialogHeader>{selected ? <div className="space-y-4"><MarketRow card={selected} watched={watchlist.includes(cardId(selected))} onWatch={() => toggleWatch(cardId(selected))} onBuy={() => setBuying(selected)} /><div className="grid gap-3 rounded-2xl border border-white/10 bg-black/35 p-4 text-sm text-slate-300 sm:grid-cols-3"><p>Seller: <strong className="text-white">{ownerName(selected)}</strong></p><p>Price: <strong className="text-emerald-300">{money(cardPrice(selected))}</strong></p><p>Rarity: <strong className="capitalize text-white">{rarityOf(selected)}</strong></p></div></div> : null}</DialogContent>
      </Dialog>
    </LivePageShell>
  );
}

function Pulse({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">{icon}</div><p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>; }
function RarityIcon({ rarity }: { rarity: string }) { if (rarity === "legendary") return <Crown className="h-4 w-4 text-amber-300" />; if (rarity === "unique" || rarity === "epic") return <Gem className="h-4 w-4 text-fuchsia-300" />; if (rarity === "rare") return <Star className="h-4 w-4 text-blue-300" />; return <Shield className="h-4 w-4 text-slate-300" />; }
function HotCard({ card, onClick }: { card: PlayerCardWithPlayer; onClick: () => void }) { const fantasy = toFantasyCardData(card, { imageWidth: 320 }); return <button onClick={onClick} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-left transition hover:bg-cyan-400/10"><div className="flex items-center gap-3"><img src={fantasy.image} alt={fantasy.name} className="h-12 w-12 rounded-xl object-cover" /><div className="min-w-0"><p className="truncate font-bold">{fantasy.name}</p><p className="truncate text-xs text-white/45">{fantasy.team || fantasy.club}</p><Badge className="mt-1 bg-emerald-400 text-black">{money(cardPrice(card))}</Badge></div></div></button>; }
function MarketRow({ card, watched, onWatch, onBuy, onDetails }: { card: PlayerCardWithPlayer; watched: boolean; onWatch?: () => void; onBuy?: () => void; onDetails?: () => void }) { const fantasy = toFantasyCardData(card, { imageWidth: 420 }); const price = cardPrice(card); const rarity = rarityOf(card); const glow = rarityGlow[rarity] || rarityGlow.common; return <article className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/30" style={{ boxShadow: `0 0 30px ${glow}, 0 18px 48px rgba(0,0,0,.35)` }}><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.07),transparent)]" /><div className="relative grid gap-3 md:grid-cols-[1.45fr_0.7fr_0.7fr_0.9fr_auto] md:items-center"><button onClick={onDetails} className="flex min-w-0 items-center gap-3 text-left"><div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/35"><img src={fantasy.image} alt={fantasy.name} className="h-full w-full object-cover" /><div className="absolute left-1 top-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-black">{Number(fantasy.rating || 0).toFixed(0)}</div></div><div className="min-w-0"><p className="truncate text-lg font-black">{fantasy.name}</p><p className="truncate text-xs text-white/50">{fantasy.team || fantasy.club} • {fantasy.position}</p><p className="truncate text-[11px] text-white/35">Seller: {ownerName(card)}</p></div></button><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/22 px-3 py-2"><RarityIcon rarity={rarity} /><span className="font-bold capitalize">{rarity}</span></div><div className="rounded-xl border border-white/10 bg-black/22 px-3 py-2"><p className="text-[10px] uppercase tracking-[.14em] text-white/40">Points</p><p className="font-black">{Number(fantasy.totalPoints || card.decisiveScore || 0).toFixed(0)}</p></div><div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2"><p className="text-[10px] uppercase tracking-[.14em] text-emerald-100/60">Buy Now</p><p className="text-lg font-black text-emerald-300">{money(price)}</p></div><div className="flex items-center justify-end gap-2"><Button size="sm" onClick={onBuy} className="rounded-xl bg-cyan-300 font-black text-black hover:bg-cyan-200">Buy <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" onClick={onWatch} className={watched ? "text-red-300" : "text-white/45"}><Heart className={watched ? "h-5 w-5 fill-current" : "h-5 w-5"} /></Button></div></div></article>; }

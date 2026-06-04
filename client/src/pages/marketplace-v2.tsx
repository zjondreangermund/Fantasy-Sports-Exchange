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
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { queryClient as qc } from "../lib/queryClient";
import { type PlayerCardWithPlayer, type Wallet } from "../../../shared/schema";
import { Crown, Gem, Heart, Search, Shield, ShoppingCart, Star, Tag, TrendingUp, WalletCards, Zap } from "lucide-react";
import { useToast } from "../hooks/use-toast";

type SortMode = "performance" | "priceAsc" | "priceDesc" | "rarity";

const rarityOrder: Record<string, number> = { common: 0, rare: 1, unique: 2, epic: 3, legendary: 4 };

function money(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "N$0.00";
  return `N$${n.toFixed(2)}`;
}

function rarityOf(card: PlayerCardWithPlayer) {
  return String(card.rarity || "common").toLowerCase();
}

function cardId(card: PlayerCardWithPlayer) {
  const id = Number((card as any).id ?? (card as any).cardId ?? 0);
  return Number.isInteger(id) ? id : 0;
}

function cardPrice(card: PlayerCardWithPlayer) {
  return Number((card as any).price || (card as any).listedPrice || 0);
}

function cardSerial(card: PlayerCardWithPlayer) {
  return String((card as any).serialId || "");
}

function ownerName(card: PlayerCardWithPlayer) {
  return String((card as any).ownerUsername || (card as any).ownerName || "Fantasy Arena");
}

export default function MarketplaceV2Page() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("all");
  const [sortBy, setSortBy] = useState<SortMode>("performance");
  const [selected, setSelected] = useState<PlayerCardWithPlayer | null>(null);
  const [buying, setBuying] = useState<PlayerCardWithPlayer | null>(null);
  const [watchlist, setWatchlist] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("market_watchlist_card_ids") || "[]"); } catch { return []; }
  });

  const { data: listings, isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/marketplace"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch marketplace");
      return res.json();
    },
  });

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
    queryFn: async () => {
      const res = await fetch("/api/wallet", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wallet");
      return res.json();
    },
  });

  const { data: myCards } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.cards || [];
    },
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
    const source = listings || [];
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
  const myListed = (myCards || []).filter((card) => card.forSale).length;
  const hotCards = filtered.slice(0, 3);

  const toggleWatch = (id: number) => {
    setWatchlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("market_watchlist_card_ids", JSON.stringify(next));
      return next;
    });
  };

  return (
    <LivePageShell tone="trading">
      <LiveHero eyebrow="Trading Floor" title="Marketplace Exchange" description="A live transfer market for buying premium cards and tracking your own listings.">
        <LiveStatCard label="Listings" value={String(filtered.length)} helper="Available now" />
        <LiveStatCard label="Average" value={money(avgPrice)} helper="Filtered price" />
        <LiveStatCard label="Balance" value={money(wallet?.balance)} helper="Wallet funds" />
      </LiveHero>

      <section className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <Card className="cinematic-glass border-cyan-300/15 bg-white/[0.06] p-5 text-white backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-cyan-300" /><h2 className="font-black">Market Pulse</h2></div>
          <div className="grid grid-cols-2 gap-3">
            <Pulse label="Watchlist" value={String(watchlist.length)} icon={<Heart className="h-4 w-4" />} />
            <Pulse label="Premium" value={String(premium)} icon={<Gem className="h-4 w-4" />} />
            <Pulse label="My Listings" value={String(myListed)} icon={<Tag className="h-4 w-4" />} />
            <Pulse label="Wallet" value={money(wallet?.balance)} icon={<WalletCards className="h-4 w-4" />} />
          </div>
        </Card>

        <Card className="border-white/10 bg-slate-950/60 p-5 text-white backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-emerald-300" /><h2 className="font-black">Hot Board</h2></div>
          <div className="space-y-2">
            {hotCards.length ? hotCards.map((card) => {
              const fantasy = toFantasyCardData(card);
              return <button key={cardId(card)} onClick={() => setSelected(card)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/25 p-3 text-left hover:bg-cyan-400/10"><div><p className="font-bold">{fantasy.name}</p><p className="text-xs text-white/45">{fantasy.team || fantasy.club} • {fantasy.position}</p></div><Badge className="bg-emerald-400 text-black">{money(cardPrice(card))}</Badge></button>;
            }) : <p className="text-sm text-white/50">No live listings yet.</p>}
          </div>
        </Card>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/35 p-4 backdrop-blur-2xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-lg"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players, team, position..." className="h-12 border-white/10 bg-black/45 pl-10 text-white" /></div>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-black/45 px-3 text-sm text-white outline-none"><option value="all">All Rarities</option><option value="common">Common</option><option value="rare">Rare</option><option value="unique">Unique</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)} className="h-12 rounded-xl border border-white/10 bg-black/45 px-3 text-sm text-white outline-none"><option value="performance">Performance</option><option value="priceAsc">Price ↑</option><option value="priceDesc">Price ↓</option><option value="rarity">Rarity</option></select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-cyan-900/30 bg-slate-950/45">
          {isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-slate-800" />)}</div> : filtered.length ? filtered.map((card) => <MarketRow key={cardId(card)} card={card} watched={watchlist.includes(cardId(card))} onWatch={() => toggleWatch(cardId(card))} onBuy={() => setBuying(card)} onDetails={() => setSelected(card)} />) : <Card className="m-4 border-slate-800 bg-slate-950/60 p-12 text-center"><ShoppingCart className="mx-auto mb-4 h-12 w-12 text-slate-600" /><p className="text-lg text-slate-300">No cards match your search.</p></Card>}
        </div>
      </section>

      <Dialog open={!!buying} onOpenChange={(open) => !open && setBuying(null)}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white"><DialogHeader><DialogTitle>Confirm Purchase</DialogTitle></DialogHeader>{buying ? <div className="py-4"><div className="mb-4 flex justify-center"><CardShowcase card={buying} size="sm" /></div><p>Buy <strong>{buying.player?.name}</strong> for {money(cardPrice(buying))}?</p><p className="mt-1 text-sm text-slate-400">Seller: {ownerName(buying)}</p><p className="mt-2 text-sm text-slate-400">Your Balance: {money(wallet?.balance)}</p></div> : null}<DialogFooter><Button variant="outline" onClick={() => setBuying(null)}>Cancel</Button><Button disabled={!buying || buyMutation.isPending || Number(wallet?.balance || 0) < cardPrice(buying)} onClick={() => buying && buyMutation.mutate(buying)}>{buyMutation.isPending ? "Processing..." : "Confirm Purchase"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl border-slate-800 bg-slate-950 text-white"><DialogHeader><DialogTitle>Market Details</DialogTitle></DialogHeader>{selected ? <div className="space-y-4"><MarketRow card={selected} watched={watchlist.includes(cardId(selected))} onWatch={() => toggleWatch(cardId(selected))} onBuy={() => setBuying(selected)} /><div className="rounded-xl border border-slate-800 bg-black/35 p-4 text-sm text-slate-300"><p>Seller: {ownerName(selected)}</p><p>Price: {money(cardPrice(selected))}</p><p>Rarity: <span className="capitalize">{rarityOf(selected)}</span></p></div></div> : null}</DialogContent>
      </Dialog>
    </LivePageShell>
  );
}

function Pulse({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">{icon}</div><p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>;
}

function RarityIcon({ rarity }: { rarity: string }) {
  if (rarity === "legendary") return <Crown className="h-4 w-4 text-amber-300" />;
  if (rarity === "unique" || rarity === "epic") return <Gem className="h-4 w-4 text-fuchsia-300" />;
  if (rarity === "rare") return <Star className="h-4 w-4 text-blue-300" />;
  return <Shield className="h-4 w-4 text-slate-300" />;
}

function MarketRow({ card, watched, onWatch, onBuy, onDetails }: { card: PlayerCardWithPlayer; watched: boolean; onWatch?: () => void; onBuy?: () => void; onDetails?: () => void }) {
  const fantasy = toFantasyCardData(card, { imageWidth: 640 });
  const price = cardPrice(card);
  const rarity = rarityOf(card);
  return <div className="grid gap-3 border-b border-cyan-900/30 bg-black/25 p-4 text-white hover:bg-cyan-400/5 lg:grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.8fr]"><button onClick={onDetails} className="flex items-center gap-3 text-left"><div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-xl font-black">{Number(fantasy.rating || 0).toFixed(0)}</div><div><p className="font-black">{fantasy.name}</p><p className="text-xs text-white/45">{fantasy.team || fantasy.club} • {fantasy.position}</p><p className="text-[11px] text-white/35">Seller: {ownerName(card)}</p></div></button><div className="flex items-center gap-2"><RarityIcon rarity={rarity} /><span className="capitalize">{rarity}</span></div><div><p className="text-xs text-white/40">Points</p><p className="font-black">{Number(fantasy.totalPoints || card.decisiveScore || 0).toFixed(0)}</p></div><div><p className="text-xs text-white/40">Price</p><p className="font-black text-emerald-300">{money(price)}</p></div><div className="flex items-center justify-end gap-2"><Button size="sm" onClick={onBuy} className="bg-cyan-400 font-black text-black hover:bg-cyan-300">Buy</Button><Button size="icon" variant="ghost" onClick={onWatch} className={watched ? "text-red-300" : "text-white/45"}><Heart className={watched ? "h-5 w-5 fill-current" : "h-5 w-5"} /></Button></div></div>;
}

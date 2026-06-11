import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import CollectionPlayerCard from "../components/CollectionPlayerCard";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { type PlayerCardWithPlayer, type Lineup } from "../../../shared/schema";
import { Archive, Crown, DollarSign, Filter, Gem, Lock, ShieldCheck, Sparkles, Trophy, Vault } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { useIsMobile } from "../hooks/use-mobile";
import { LiveHero, LivePageShell, LiveStatCard } from "../components/layout/LivePageShell";

type RarityKey = "all" | "common" | "rare" | "unique" | "legendary";

const BASE_PRICES: Record<string, number> = { common: 0, rare: 20, unique: 50, epic: 50, legendary: 100 };
const COLLECTION_TARGETS: Record<string, number> = { common: 120, rare: 120, unique: 120, legendary: 120 };

function rarityOf(card: PlayerCardWithPlayer) {
  return String(card.rarity || "common").toLowerCase();
}

function money(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "N$0.00";
  return `N$${n.toFixed(2)}`;
}

function pct(value: number, target: number) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function cardValue(card: PlayerCardWithPlayer) {
  const listed = Number(card.price || 0);
  if (Number.isFinite(listed) && listed > 0) return listed;
  return BASE_PRICES[rarityOf(card)] || 0;
}

export default function CollectionPage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<RarityKey>("all");
  const [visibleCount, setVisibleCount] = useState(16);
  const [editingLineup, setEditingLineup] = useState(false);
  const [selectedForLineup, setSelectedForLineup] = useState<Set<number>>(new Set());
  const [listCard, setListCard] = useState<PlayerCardWithPlayer | null>(null);
  const [listPrice, setListPrice] = useState("");

  const { data: cards, isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cards");
      const data = await res.json();
      return Array.isArray(data) ? data : data.cards || [];
    },
  });

  const { data: lineupData } = useQuery<{ lineup: Lineup; cards: PlayerCardWithPlayer[] }>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const res = await fetch("/api/lineup", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lineup");
      return res.json();
    },
  });

  const saveLineupMutation = useMutation({
    mutationFn: async (cardIds: number[]) => {
      const res = await apiRequest("POST", "/api/lineup", { cardIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lineup"] });
      setEditingLineup(false);
      toast({ title: "Lineup saved" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const listForSaleMutation = useMutation({
    mutationFn: async ({ cardId, price }: { cardId: number; price: number }) => {
      const res = await apiRequest("POST", "/api/marketplace/list", { cardId, price });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      setListCard(null);
      setListPrice("");
      toast({ title: "Card listed for sale" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message || "Failed to list card", variant: "destructive" }),
  });

  const cancelListingMutation = useMutation({
    mutationFn: async (cardId: number) => {
      const res = await apiRequest("POST", `/api/marketplace/cancel/${cardId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      toast({ title: "Listing cancelled" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message || "Failed to cancel listing", variant: "destructive" }),
  });

  const counts = useMemo(() => {
    const base: Record<string, number> = { common: 0, rare: 0, unique: 0, legendary: 0 };
    for (const card of cards || []) {
      const rarity = rarityOf(card);
      if (base[rarity] !== undefined) base[rarity] += 1;
    }
    return base;
  }, [cards]);

  const listedCount = (cards || []).filter((card) => card.forSale).length;
  const eligibleCount = (cards || []).filter((card) => !card.forSale).length;
  const strongestRarity = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "common";
  const collectionValue = useMemo(() => (cards || []).reduce((sum, card) => sum + cardValue(card), 0), [cards]);
  const momentum = Math.max(0, counts.legendary * 9 + counts.unique * 5 + counts.rare * 2 - listedCount);
  const namibiaRank = collectionValue > 0 ? `#${Math.max(1, 250 - Math.min(220, Math.floor(collectionValue / 25)))}` : "—";

  const filteredCards = useMemo(() => (cards || []).filter((c) => filter === "all" || rarityOf(c) === filter), [cards, filter]);
  const visibleCards = isMobile ? filteredCards.slice(0, visibleCount) : filteredCards;
  const showcaseCards = [...(cards || [])].sort((a, b) => {
    const power: Record<string, number> = { legendary: 5, epic: 4, unique: 3, rare: 2, common: 1 };
    return (power[rarityOf(b)] || 0) - (power[rarityOf(a)] || 0);
  }).slice(0, 3);

  useEffect(() => setVisibleCount(16), [filter, isMobile, cards?.length]);

  const startEditLineup = () => {
    setEditingLineup(true);
    if (lineupData?.lineup?.cardIds) setSelectedForLineup(new Set(lineupData.lineup.cardIds));
  };

  const toggleLineupCard = (cardId: number) => {
    setSelectedForLineup((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else if (next.size < 5) next.add(cardId);
      return next;
    });
  };

  const handleListCard = (card: PlayerCardWithPlayer) => {
    const rarity = rarityOf(card);
    if (rarity === "common") {
      toast({ title: "Cannot sell common cards", description: "Common cards are tournament-only and can’t be sold.", variant: "destructive" });
      return;
    }
    setListCard(card);
    setListPrice(String(BASE_PRICES[rarity] || 1));
  };

  const handleConfirmList = () => {
    if (!listCard) return;
    const price = parseFloat(listPrice);
    const rarity = rarityOf(listCard);
    const basePrice = BASE_PRICES[rarity] || 0;
    if (Number.isNaN(price) || price <= 0) return toast({ title: "Invalid price", variant: "destructive" });
    if (basePrice && price < basePrice) return toast({ title: "Price too low", description: `Minimum price for ${rarity} cards is N$${basePrice}`, variant: "destructive" });
    listForSaleMutation.mutate({ cardId: listCard.id, price });
  };

  const rarityFilters: Array<{ value: RarityKey; label: string; icon: React.ReactNode }> = [
    { value: "all", label: "All", icon: <Archive className="h-4 w-4" /> },
    { value: "common", label: "Common", icon: <ShieldCheck className="h-4 w-4" /> },
    { value: "rare", label: "Rare", icon: <Sparkles className="h-4 w-4" /> },
    { value: "unique", label: "Unique", icon: <Gem className="h-4 w-4" /> },
    { value: "legendary", label: "Legendary", icon: <Crown className="h-4 w-4" /> },
  ];

  return (
    <LivePageShell tone="vault">
      <LiveHero eyebrow="Collection Vault" title="Your Card Vault" description="Browse your cards like high-value assets. Build your lineup, protect tournament-only cards and list premium cards on the market.">
        <LiveStatCard label="Total Cards" value={String(cards?.length || 0)} helper="Owned assets" />
        <LiveStatCard label="Playable" value={String(eligibleCount)} helper="Not listed" />
        <LiveStatCard label="Listed" value={String(listedCount)} helper="On market" />
      </LiveHero>

      <Card className="overflow-hidden border-white/10 bg-gradient-to-r from-slate-950 via-violet-950/70 to-slate-950 p-5 text-white shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-violet-200/70">Collection Value</p>
            <div className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{money(collectionValue)}</div>
            <p className="mt-2 text-sm text-white/55">Estimated from rarity floors and active listing prices.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-white/35">Rank</p><p className="mt-1 text-lg font-black">{namibiaRank}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-white/35">Momentum</p><p className="mt-1 text-lg font-black">+{momentum}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-white/35">Legendary</p><p className="mt-1 text-lg font-black">{counts.legendary || 0}</p></div>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
        <Card className="cinematic-glass border-white/10 bg-white/[0.06] p-5 text-white backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2"><Vault className="h-5 w-5 text-violet-300" /><h2 className="font-black">Vault Progress</h2></div>
          <div className="space-y-3">
            {Object.entries(COLLECTION_TARGETS).map(([rarity, target]) => <ProgressRow key={rarity} label={rarity} value={counts[rarity] || 0} target={target} />)}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-white/55">Strongest section: <span className="font-black capitalize text-white">{strongestRarity}</span></div>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-slate-950/60 p-5 text-white backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-black">Showcase Pedestal</h2><p className="text-sm text-white/50">Highest rarity cards in your vault.</p></div>
            <Badge variant="outline" className="border-white/20 text-white"><Trophy className="mr-1 h-3 w-3" /> Top Assets</Badge>
          </div>
          {isLoading ? <div className="grid grid-cols-3 gap-3"><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-52 rounded-2xl" /></div> : showcaseCards.length ? (
            <div className="flex gap-3 overflow-x-auto pb-2">{showcaseCards.map((card) => <div key={card.id} className="shrink-0 scale-[0.92] sm:scale-100"><CollectionPlayerCard player={toFantasyCardData(card, { imageWidth: 640 })} /></div>)}</div>
          ) : <p className="text-sm text-white/50">No cards yet. Open starter packs to begin your vault.</p>}
        </Card>
      </section>

      <section className="sticky top-0 z-20 rounded-3xl border border-white/10 bg-black/35 p-3 backdrop-blur-2xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0"><Filter className="h-4 w-4 shrink-0 text-white/50" />{rarityFilters.map((f) => <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)} data-testid={`button-filter-${f.value}`} className="shrink-0 gap-1">{f.icon}{f.label}<span className="ml-1 text-xs opacity-70">{f.value === "all" ? cards?.length || 0 : counts[f.value] || 0}</span></Button>)}</div>
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={startEditLineup}>Edit Lineup</Button>{editingLineup ? <Button size="sm" onClick={() => saveLineupMutation.mutate(Array.from(selectedForLineup))} disabled={saveLineupMutation.isPending || selectedForLineup.size !== 5}>Save ({selectedForLineup.size}/5)</Button> : null}</div>
        </div>
      </section>

      {editingLineup && <Card className="border-emerald-400/20 bg-emerald-400/10 p-4 text-white backdrop-blur-xl"><p className="text-sm"><Lock className="mr-2 inline h-4 w-4 text-emerald-300" />Select exactly 5 available cards for your lineup. Listed cards should be removed from sale before tournament entry.</p></Card>}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-[218px] rounded-[26px] sm:h-[232px]" />)}</div>
      ) : filteredCards.length > 0 ? (
        <div className="grid grid-cols-2 justify-items-center gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleCards.map((card) => {
            const fantasyCard = toFantasyCardData(card, { imageWidth: 640 });
            const isSelected = selectedForLineup.has(card.id);
            const rarity = rarityOf(card);
            return (
              <div key={card.id} className="flex flex-col items-center gap-2">
                <div className={`relative rounded-[28px] ${editingLineup && isSelected ? "ring-2 ring-emerald-400" : ""}`}>
                  {card.forSale && <Badge className="absolute left-2 top-2 z-30 bg-amber-400 text-black">Listed</Badge>}
                  <CollectionPlayerCard player={fantasyCard} selected={isSelected} onClick={editingLineup ? () => toggleLineupCard(card.id) : undefined} />
                </div>
                <div className="z-30 flex min-h-8 gap-2">
                  {card.forSale ? <Button size="sm" variant="destructive" onClick={() => cancelListingMutation.mutate(card.id)} disabled={cancelListingMutation.isPending} className="h-8 text-xs">Cancel {money(card.price)}</Button> : rarity === "common" ? <Button size="sm" variant="outline" disabled className="h-8 text-xs">Tournament Only</Button> : <Button size="sm" onClick={() => handleListCard(card)} className="h-8 bg-gradient-to-r from-emerald-400 to-lime-300 text-xs font-black text-black"><DollarSign className="mr-1 h-3 w-3" /> Sell</Button>}
                </div>
              </div>
            );
          })}
          {isMobile && filteredCards.length > visibleCount ? <div className="col-span-2 mt-2 flex w-full justify-center sm:col-span-3"><Button variant="outline" onClick={() => setVisibleCount((prev) => prev + 16)}>Load More</Button></div> : null}
        </div>
      ) : <Card className="border-white/10 bg-white/[0.06] p-8 text-center text-white"><p className="text-white/60">No cards found with this filter.</p></Card>}

      <Dialog open={!!listCard} onOpenChange={() => setListCard(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>List Card for Sale</DialogTitle><DialogDescription>{listCard && BASE_PRICES[rarityOf(listCard)] ? `Minimum price for ${listCard.rarity} cards: N$${BASE_PRICES[rarityOf(listCard)]}` : "Set your listing price"}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4"><div><p className="font-semibold">{listCard?.player?.name}</p><p className="text-sm text-muted-foreground capitalize">{listCard?.rarity} • {listCard?.player?.position}</p></div><div className="space-y-2"><label className="text-sm font-medium">Price (N$)</label><Input type="number" value={listPrice} onChange={(e) => setListPrice(e.target.value)} placeholder={listCard ? `Min: ${BASE_PRICES[rarityOf(listCard)] || 1}` : "Enter price"} min={listCard ? BASE_PRICES[rarityOf(listCard)] || 1 : 1} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setListCard(null)}>Cancel</Button><Button onClick={handleConfirmList} disabled={listForSaleMutation.isPending || !listPrice || parseFloat(listPrice) <= 0}>{listForSaleMutation.isPending ? "Listing..." : "List for Sale"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </LivePageShell>
  );
}

function ProgressRow({ label, value, target }: { label: string; value: number; target: number }) {
  const progress = pct(value, target);
  return <div><div className="mb-1 flex items-center justify-between text-xs"><span className="font-bold capitalize text-white">{label}</span><span className="text-white/50">{value}/{target} • {progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-300" style={{ width: `${progress}%` }} /></div></div>;
}

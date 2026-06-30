import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { PremiumFootballCard } from "../components/cards";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { type PlayerCardWithPlayer, type Wallet } from "../../../shared/schema";
import { Crown, Gem, HandCoins, Search, Shield, ShoppingCart, Star, Tag, XCircle } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";

type MarketResponse = PlayerCardWithPlayer[] | { listings?: PlayerCardWithPlayer[]; cards?: PlayerCardWithPlayer[] };
type CardsResponse = PlayerCardWithPlayer[] | { cards?: PlayerCardWithPlayer[] };
type RarityFilter = "all" | "common" | "rare" | "epic" | "unique" | "legendary";

const rarityMeta: Record<string, { label: string; className: string; Icon: typeof Shield; order: number }> = {
  common: { label: "COMMON", className: "border-slate-500/40 bg-slate-500/10 text-slate-200", Icon: Shield, order: 0 },
  rare: { label: "RARE", className: "border-blue-400/40 bg-blue-500/10 text-blue-300", Icon: Star, order: 1 },
  epic: { label: "EPIC", className: "border-violet-400/40 bg-violet-500/10 text-violet-300", Icon: Gem, order: 2 },
  unique: { label: "UNIQUE", className: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300", Icon: Gem, order: 3 },
  legendary: { label: "LEGENDARY", className: "border-amber-400/45 bg-amber-400/10 text-amber-300", Icon: Crown, order: 4 },
};

function normalizeMarketplaceResponse(data: MarketResponse): PlayerCardWithPlayer[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.listings)) return data.listings;
  if (Array.isArray(data?.cards)) return data.cards;
  return [];
}

function normalizeCardsResponse(data: CardsResponse): PlayerCardWithPlayer[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.cards)) return data.cards;
  return [];
}

function getCardPrice(card: PlayerCardWithPlayer) {
  return Number((card as any).price || (card as any).listedPrice || 0);
}

function resolveCardId(card: PlayerCardWithPlayer): number {
  const raw = (card as any).id ?? (card as any).cardId ?? (card as any).playerCardId;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function getOwner(card: PlayerCardWithPlayer) {
  return String((card as any).ownerUsername || (card as any).ownerName || "Fantasy Arena");
}

function getRarity(card: PlayerCardWithPlayer) {
  return String((card as any).rarity || "common").toLowerCase();
}

function RarityBadge({ rarity }: { rarity: string }) {
  const meta = rarityMeta[rarity] || rarityMeta.common;
  const Icon = meta.Icon;
  return (
    <Badge variant="outline" className={`gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}

function MarketCard({
  card,
  mode,
  onBuy,
  onCancel,
  busy,
}: {
  card: PlayerCardWithPlayer;
  mode: "buy" | "sell";
  onBuy?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const fantasy = toFantasyCardData(card, { imageWidth: 640 });
  const price = getCardPrice(card);
  const rarity = getRarity(card);
  const team = fantasy.team || fantasy.club || "Free Agent";

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-950/70 text-white shadow-[0_16px_40px_rgba(0,0,0,.28)]">
      <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr_auto] md:items-center">
        <div className="flex justify-center">
          <PremiumFootballCard player={fantasy} size="sm" showPrice />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <RarityBadge rarity={rarity} />
            <Badge variant="outline" className="border-cyan-400/30 bg-cyan-400/10 text-cyan-200">{fantasy.position || "N/A"}</Badge>
          </div>
          <div>
            <h3 className="truncate text-2xl font-black tracking-tight">{fantasy.name}</h3>
            <p className="text-sm text-slate-400">{team}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <SmallStat label="Rating" value={Number(fantasy.rating || 0).toFixed(0)} />
            <SmallStat label="Seller" value={getOwner(card)} />
            <SmallStat label="Serial" value={`#${fantasy.serial || 1}/${fantasy.maxSupply || 1000}`} />
            <SmallStat label="Card ID" value={String(resolveCardId(card) || "—")} />
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-3 md:min-w-[180px]">
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-200/80">Price</p>
            <p className="text-2xl font-black text-emerald-200">N${price.toFixed(2)}</p>
          </div>
          {mode === "buy" ? (
            <Button onClick={onBuy} disabled={busy} className="rounded-xl bg-blue-600 font-black text-white hover:bg-blue-500">
              <ShoppingCart className="mr-2 h-4 w-4" /> Buy Now
            </Button>
          ) : (
            <Button onClick={onCancel} disabled={busy} variant="destructive" className="rounded-xl font-black">
              <XCircle className="mr-2 h-4 w-4" /> Cancel Listing
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-black/25 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="truncate text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export default function MarketplacePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [buyCard, setBuyCard] = useState<PlayerCardWithPlayer | null>(null);

  const { data: listings = [], isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/marketplace"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch marketplace listings");
      return normalizeMarketplaceResponse(await res.json());
    },
  });

  const { data: myCards = [] } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch my cards");
      return normalizeCardsResponse(await res.json());
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

  const buyMutation = useMutation({
    mutationFn: async (cardId: number) => {
      const res = await apiRequest("POST", "/api/marketplace/buy", { cardId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      setBuyCard(null);
      toast({ title: "Card purchased!" });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (cardId: number) => {
      const res = await apiRequest("POST", `/api/marketplace/cancel/${cardId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      toast({ title: "Listing cancelled" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to cancel listing", variant: "destructive" });
    },
  });

  const sortedListings = useMemo(() => {
    const filtered = listings.filter((card) => {
      const fantasy = toFantasyCardData(card, { imageWidth: 320 });
      const haystack = `${fantasy.name} ${fantasy.team || ""} ${fantasy.club || ""} ${fantasy.position || ""}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesRarity = rarityFilter === "all" || getRarity(card) === rarityFilter;
      return matchesSearch && matchesRarity;
    });
    return filtered.sort((a, b) => {
      const bOrder = rarityMeta[getRarity(b)]?.order ?? 0;
      const aOrder = rarityMeta[getRarity(a)]?.order ?? 0;
      return bOrder - aOrder || getCardPrice(a) - getCardPrice(b);
    });
  }, [listings, rarityFilter, search]);

  const myListedCards = useMemo(() => myCards.filter((card) => Boolean((card as any).forSale)), [myCards]);

  return (
    <div className="relative min-h-full flex-1 overflow-auto bg-[#050b17] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,.18),transparent_34%),radial-gradient(circle_at_85%_5%,rgba(14,165,233,.10),transparent_30%),linear-gradient(180deg,#07111f_0%,#050812_100%)]" />
      <div className="relative mx-auto max-w-[1500px] space-y-6">
        <Card className="overflow-hidden rounded-3xl border-slate-800 bg-gradient-to-r from-[#0b1730] via-[#101f3b] to-[#0a1430] p-5 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
          <div className="grid gap-5 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.2em] text-cyan-300/80">Transfer Hub</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Marketplace</h1>
              <p className="mt-1 text-sm text-slate-300">Buy, manage listings, and prepare temporary card deals from the single card engine.</p>
            </div>
            <HeaderStat label="Active Listings" value={String(sortedListings.length)} />
            <HeaderStat label="My Listings" value={String(myListedCards.length)} />
            <HeaderStat label="Balance" value={`N$${Number(wallet?.balance || 0).toFixed(2)}`} highlight />
          </div>
        </Card>

        <Tabs defaultValue="buy" className="w-full">
          <TabsList className="rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
            <TabsTrigger value="buy" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white"><ShoppingCart className="mr-2 h-4 w-4" />Buy Cards</TabsTrigger>
            <TabsTrigger value="sell" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white"><Tag className="mr-2 h-4 w-4" />My Listings</TabsTrigger>
            <TabsTrigger value="loan" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white"><HandCoins className="mr-2 h-4 w-4" />Loan</TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="mt-5 space-y-4">
            <Card className="border-slate-800 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[260px] flex-1 max-w-lg"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input placeholder="Search players..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-12 rounded-xl border-slate-800 bg-black/45 pl-10 text-white placeholder:text-slate-500" /></div>
                <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as RarityFilter)} className="h-12 rounded-xl border border-slate-800 bg-black/45 px-3 text-sm text-white outline-none">
                  <option value="all">All Rarities</option><option value="common">Common</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="unique">Unique</option><option value="legendary">Legendary</option>
                </select>
              </div>
            </Card>
            {isLoading ? <LoadingRows /> : sortedListings.length ? <div className="grid gap-4">{sortedListings.map((card) => <MarketCard key={resolveCardId(card) || `${(card as any).serialId || "no-serial"}-${(card as any).playerId || "player"}-${getCardPrice(card)}`} card={card} mode="buy" onBuy={() => setBuyCard(card)} busy={buyMutation.isPending} />)}</div> : <EmptyState icon="cart" title={search ? "No cards match your search" : "No cards for sale"} />}
          </TabsContent>

          <TabsContent value="sell" className="mt-5 space-y-4">
            {myListedCards.length ? <div className="grid gap-4">{myListedCards.map((card) => <MarketCard key={resolveCardId(card) || `${(card as any).serialId || "no-serial"}-${(card as any).playerId || "player"}-${getCardPrice(card)}`} card={card} mode="sell" onCancel={() => cancelMutation.mutate(resolveCardId(card))} busy={cancelMutation.isPending} />)}</div> : <EmptyState icon="tag" title="You don't have any cards listed for sale" subtitle="Go to your Collection to list cards." />}
          </TabsContent>

          <TabsContent value="loan" className="mt-5">
            <Card className="border-cyan-400/20 bg-cyan-400/10 p-8 text-center text-white"><HandCoins className="mx-auto mb-4 h-12 w-12 text-cyan-200" /><h2 className="text-2xl font-black">Loan tab restored</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-cyan-100/75">The UI entry point is back. Backend offer terms can be connected next without creating another card component.</p></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!buyCard} onOpenChange={(open) => !open && setBuyCard(null)}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white">
          <DialogHeader><DialogTitle>Confirm Purchase</DialogTitle></DialogHeader>
          <div className="py-4">{buyCard ? <div className="mb-4 flex justify-center"><PremiumFootballCard player={toFantasyCardData(buyCard, { imageWidth: 640 })} size="sm" showPrice /></div> : null}<p>Buy <strong>{buyCard?.player?.name}</strong> for N${Number(buyCard ? getCardPrice(buyCard) : 0).toFixed(2)}?</p><p className="mt-1 text-sm text-slate-400">Seller: {buyCard ? getOwner(buyCard) : "Fantasy Arena"}</p><p className="mt-2 text-sm text-slate-400">Your Balance: N${Number(wallet?.balance || 0).toFixed(2)}</p></div>
          <DialogFooter><Button variant="outline" onClick={() => setBuyCard(null)}>Cancel</Button><Button onClick={() => { if (!buyCard) return; const cardId = resolveCardId(buyCard); if (!cardId) { toast({ title: "Error", description: "This listing has an invalid card id.", variant: "destructive" }); return; } buyMutation.mutate(cardId); }} disabled={buyMutation.isPending || Number(wallet?.balance || 0) < Number(buyCard ? getCardPrice(buyCard) : 0)}>{buyMutation.isPending ? "Processing..." : "Confirm Purchase"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HeaderStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-2xl border p-3 ${highlight ? "border-emerald-500/30 bg-emerald-500/10" : "border-slate-700/70 bg-slate-950/45"}`}><p className={`text-[10px] font-bold uppercase tracking-wide ${highlight ? "text-emerald-200/90" : "text-slate-400"}`}>{label}</p><p className={`mt-1 text-2xl font-black ${highlight ? "text-emerald-200" : "text-white"}`}>{value}</p></div>;
}

function LoadingRows() {
  return <div className="grid gap-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-56 rounded-3xl bg-slate-800" />)}</div>;
}

function EmptyState({ icon, title, subtitle }: { icon: "cart" | "tag"; title: string; subtitle?: string }) {
  const Icon = icon === "cart" ? ShoppingCart : Tag;
  return <Card className="border-slate-800 bg-slate-950/60 p-12 text-center"><Icon className="mx-auto mb-4 h-12 w-12 text-slate-600" /><p className="text-lg text-slate-300">{title}</p>{subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}</Card>;
}

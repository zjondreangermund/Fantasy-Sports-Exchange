import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import CardShowcase from "../components/CardShowcase";
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
import {
  BookmarkPlus,
  CheckCircle2,
  Crown,
  Gem,
  Heart,
  Search,
  Shield,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";
import { useUiSound } from "../hooks/use-ui-sound";
import { useIsMobile } from "../hooks/use-mobile";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type PlayerCardData } from "../components/cards/types";

type SortMode = "priceAsc" | "priceDesc" | "rarity" | "performance";

type MarketSignal = {
  listedPrice: number;
  lastSale: number;
  avgSale: number;
  salesCount30d: number;
  tradeCount: number;
  listedSinceDays: number | null;
  velocity: "low" | "medium" | "high";
  confidence: "low" | "medium" | "strong";
};

const rarityMeta: Record<string, { label: string; className: string; Icon: typeof Shield; order: number }> = {
  common: { label: "COMMON", className: "border-slate-500/40 bg-slate-500/10 text-slate-200", Icon: Shield, order: 0 },
  rare: { label: "RARE", className: "border-blue-400/40 bg-blue-500/10 text-blue-300", Icon: Star, order: 1 },
  unique: { label: "UNIQUE", className: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300", Icon: Gem, order: 2 },
  epic: { label: "EPIC", className: "border-violet-400/40 bg-violet-500/10 text-violet-300", Icon: Gem, order: 3 },
  legendary: { label: "LEGENDARY", className: "border-amber-400/45 bg-amber-400/10 text-amber-300", Icon: Crown, order: 4 },
};

function getLastFive(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.slice(0, 5).map((v) => Number(v || 0)) : [];
  while (scores.length < 5) scores.push(0);
  return scores;
}

function getPoints(player: PlayerCardData) {
  const scores = getLastFive(player).filter((value) => value > 0);
  const total = Number(player.totalPoints || scores.reduce((sum, value) => sum + value, 0));
  const last = scores.length ? scores[scores.length - 1] : Number(player.rating || 0);
  return {
    total: Math.round(total * 10) / 10,
    last: Math.round(last * 10) / 10,
  };
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
function resolveSerialId(card: PlayerCardWithPlayer): string {
  return String((card as any).serialId || "").trim();
}

function RarityBadge({ rarity, serial, maxSupply }: { rarity: string; serial?: number; maxSupply?: number }) {
  const meta = rarityMeta[String(rarity || "common").toLowerCase()] || rarityMeta.common;
  const Icon = meta.Icon;
  return (
    <div className="flex flex-col gap-1">
      <div className={`inline-flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${meta.className}`}>
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </div>
      <p className="text-xs text-slate-500">#{String(serial || 1).padStart(3, "0")}/{Number(maxSupply || 1000)}</p>
    </div>
  );
}

function LastFiveBars({ scores }: { scores: number[] }) {
  return (
    <div className="flex items-end gap-3">
      {scores.map((score, index) => {
        const height = Math.max(14, Math.min(42, Number(score || 0) * 3.3));
        return (
          <div key={`${score}-${index}`} className="flex flex-col items-center gap-1">
            <div className="w-3 rounded-t bg-gradient-to-t from-emerald-600 to-lime-300 shadow-[0_0_14px_rgba(74,222,128,.28)]" style={{ height }} />
            <span className="text-[10px] font-medium text-slate-400">{Number(score || 0).toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

function PlayerMarketRow({
  card,
  watched,
  onBuy,
  onDetails,
  onToggleWatchlist,
}: {
  card: PlayerCardWithPlayer;
  watched: boolean;
  onBuy?: () => void;
  onDetails?: () => void;
  onToggleWatchlist?: () => void;
}) {
  const fantasy = toFantasyCardData(card, { imageWidth: 640 });
  const [failed, setFailed] = useState(false);
  const points = getPoints(fantasy);
  const lastFive = getLastFive(fantasy);
  const price = getCardPrice(card);
  const image = fantasy.image || fantasy.imageUrl || fantasy.photo || fantasy.imageCandidates?.[0];
  const showImage = Boolean(image) && !failed;

  return (
    <div className="group relative grid grid-cols-[minmax(260px,2.2fr)_1.1fr_.8fr_.55fr_.55fr_.8fr_1.15fr_1fr] items-center gap-4 border-b border-slate-800/80 bg-slate-950/50 px-4 py-3 transition hover:bg-slate-900/70 max-xl:grid-cols-[minmax(260px,2fr)_1fr_.6fr_.8fr_1fr] max-lg:grid-cols-1 max-lg:rounded-2xl max-lg:border max-lg:p-4">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[linear-gradient(90deg,rgba(30,64,175,.08)_0%,rgba(14,165,233,.03)_45%,transparent_100%)]" />
      <button type="button" onClick={onDetails} className="flex min-w-0 items-center gap-4 text-left">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,.26),transparent_48%)]" />
          {showImage ? (
            <img
              src={image}
              alt={fantasy.name}
              onError={() => setFailed(true)}
              className="absolute bottom-0 left-1/2 h-[112%] w-[112%] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_12px_10px_rgba(0,0,0,.55)]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xl font-black text-slate-600">FA</div>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-cyan-300/50 bg-gradient-to-b from-cyan-400/25 to-blue-600/25 text-2xl font-black text-white shadow-[0_0_28px_rgba(56,189,248,.26)]">
            {Number(fantasy.rating || 0).toFixed(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-black text-white">{fantasy.name}</p>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-400" />
            </div>
            <p className="text-xs uppercase tracking-wide text-slate-400">AGE {fantasy.level || 1} · {fantasy.nationality || "FC"} · {fantasy.team || fantasy.club || "Free Agent"}</p>
            <p className="mt-1 text-[11px] text-slate-500">Seller: {getOwner(card)}</p>
          </div>
        </div>
      </button>

      <div className="max-lg:flex max-lg:justify-between">
        <span className="hidden text-xs uppercase text-slate-500 max-lg:block">Rarity</span>
        <RarityBadge rarity={fantasy.rarity} serial={fantasy.serial} maxSupply={fantasy.maxSupply} />
      </div>

      <div className="flex items-center gap-3 max-xl:hidden">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-black text-slate-300">
          {(fantasy.team || fantasy.club || "FA").slice(0, 3).toUpperCase()}
        </div>
        <span className="truncate text-sm text-slate-300">{fantasy.team || fantasy.club || "Free Agent"}</span>
      </div>

      <div className="text-sm font-black text-cyan-100 max-lg:flex max-lg:justify-between">
        <span className="hidden text-xs font-semibold uppercase text-slate-500 max-lg:block">POS</span>
        {fantasy.position || "N/A"}
      </div>

      <div className="text-sm font-black text-white max-lg:hidden">{Number(fantasy.rating || 0).toFixed(0)}</div>

      <div className="max-lg:flex max-lg:items-center max-lg:justify-between">
        <span className="hidden text-xs uppercase text-slate-500 max-lg:block">Points</span>
        <div>
          <p className="text-lg font-black text-white">{points.total}</p>
          <p className="text-xs text-slate-500">Total · Last {points.last}</p>
        </div>
      </div>

      <div className="max-xl:hidden">
        <LastFiveBars scores={lastFive} />
      </div>

      <div className="flex items-center justify-between gap-3 max-lg:border-t max-lg:border-slate-800 max-lg:pt-3">
        <div>
          <p className="text-lg font-black text-emerald-300">N${price.toFixed(2)}</p>
          <p className="text-xs text-slate-500">≈ ${(price / 18.5).toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-2">
          {onBuy ? (
            <Button size="sm" onClick={onBuy} className="rounded-xl bg-blue-600 px-4 font-bold text-white hover:bg-blue-500">
              Buy Now
            </Button>
          ) : null}
          {onToggleWatchlist ? (
            <Button size="icon" variant="ghost" onClick={onToggleWatchlist} className={watched ? "text-red-300" : "text-slate-400"}>
              <Heart className={watched ? "h-5 w-5 fill-current" : "h-5 w-5"} />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { play } = useUiSound();
  const previousBuyCardId = useRef<number | null>(null);
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [buyCard, setBuyCard] = useState<PlayerCardWithPlayer | null>(null);
  const [detailCard, setDetailCard] = useState<PlayerCardWithPlayer | null>(null);
  const [activeTab, setActiveTab] = useState("buy");
  const [buyVisibleCount, setBuyVisibleCount] = useState(12);
  const [sellVisibleCount, setSellVisibleCount] = useState(12);
  const [sortBy, setSortBy] = useState<SortMode>("performance");
  const [eligibilityOnly, setEligibilityOnly] = useState(false);
  const [watchlist, setWatchlist] = useState<number[]>([]);
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; search: string; rarity: string; sortBy: SortMode; eligibilityOnly: boolean }>>([]);

  const { data: marketSignal } = useQuery<MarketSignal>({
    queryKey: ["/api/marketplace/signals", detailCard?.id],
    enabled: !!detailCard?.id,
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/signals/${detailCard?.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch listing signals");
      return res.json();
    },
  });
  
  const { data: listings, isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/marketplace"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch marketplace listings");
      return res.json();
    },
  });

  const { data: myCards } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch my cards");
      const data = await res.json();
      return Array.isArray(data) ? data : data.cards || [];
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
      const card = listings?.find((item) => resolveCardId(item) === cardId);
      const res = await apiRequest("POST", `/api/marketplace/buy/${cardId}`, {
        serialId: card ? resolveSerialId(card) : undefined,
      });
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem("market_watchlist_card_ids");
      if (raw) setWatchlist(JSON.parse(raw));
      const rawFilters = localStorage.getItem("market_saved_filters");
      if (rawFilters) setSavedFilters(JSON.parse(rawFilters));
    } catch {
      // ignore local storage parse issues
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("market_watchlist_card_ids", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem("market_saved_filters", JSON.stringify(savedFilters));
  }, [savedFilters]);

  const filteredListings = listings?.filter((card) => {
    const fantasy = toFantasyCardData(card, { imageWidth: 320 });
    const haystack = `${fantasy.name} ${fantasy.team || ""} ${fantasy.club || ""} ${fantasy.position || ""}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesRarity = rarityFilter === "all" || String(card.rarity || "").toLowerCase() === rarityFilter;
    const isEligible = Number(card.decisiveScore || fantasy.rating || 0) >= 60;
    const matchesEligibility = !eligibilityOnly || isEligible;
    return matchesSearch && matchesRarity && matchesEligibility;
  });

  const sortedListings = [...(filteredListings || [])].sort((a, b) => {
    if (sortBy === "priceAsc") return getCardPrice(a) - getCardPrice(b);
    if (sortBy === "priceDesc") return getCardPrice(b) - getCardPrice(a);
    if (sortBy === "performance") return Number(b.decisiveScore || 0) - Number(a.decisiveScore || 0);
    const aOrder = rarityMeta[String(a.rarity || "common").toLowerCase()]?.order ?? 0;
    const bOrder = rarityMeta[String(b.rarity || "common").toLowerCase()]?.order ?? 0;
    return bOrder - aOrder;
  });

  const myListedCards = myCards?.filter((card) => card.forSale);
  const visibleBuyListings = isMobile ? sortedListings.slice(0, buyVisibleCount) : sortedListings;
  const visibleSellListings = isMobile ? (myListedCards || []).slice(0, sellVisibleCount) : (myListedCards || []);

  useEffect(() => {
    setBuyVisibleCount(12);
  }, [search, rarityFilter, activeTab, isMobile, sortBy, eligibilityOnly]);

  useEffect(() => {
    setSellVisibleCount(12);
  }, [activeTab, isMobile, myListedCards?.length]);

  useEffect(() => {
    const currentId = buyCard?.id ?? null;
    if (currentId && previousBuyCardId.current !== currentId) play("reveal");
    previousBuyCardId.current = currentId;
  }, [buyCard?.id, play]);

  const handleOpenBuyCard = (card: PlayerCardWithPlayer) => {
    play("click");
    setBuyCard(card);
  };

  const toggleWatchlist = (cardId: number) => {
    setWatchlist((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  };

  const saveCurrentFilter = () => {
    const name = `Filter ${savedFilters.length + 1}`;
    setSavedFilters((prev) => [...prev, { name, search, rarity: rarityFilter, sortBy, eligibilityOnly }].slice(-5));
    toast({ title: "Filter saved", description: "Saved to local watch settings." });
  };

  return (
    <div className="relative min-h-full flex-1 overflow-auto bg-[#040812] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(56,189,248,.22),transparent_30%),radial-gradient(circle_at_90%_5%,rgba(168,85,247,.16),transparent_28%),radial-gradient(circle_at_50%_120%,rgba(30,64,175,.25),transparent_45%),linear-gradient(180deg,#040812_0%,#030611_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative mx-auto max-w-[1560px]">
        <div className="mb-5 rounded-3xl border border-cyan-700/35 bg-gradient-to-r from-[#07142f] via-[#111a3f] to-[#220b3f] p-5 shadow-[0_24px_70px_rgba(0,0,0,.45)]">
          <div className="grid gap-5 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.2em] text-cyan-300/80">Transfer Hub</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Marketplace</h1>
              <p className="mt-1 text-sm text-slate-300">Scouting-grade cards, instant checkout, live pricing confidence.</p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Active Listings</p>
              <p className="mt-1 text-2xl font-black text-white">{sortedListings.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Watchlist</p>
              <p className="mt-1 text-2xl font-black text-rose-300">{watchlist.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-200/90">Balance</p>
              <p className="mt-1 text-2xl font-black text-emerald-200">N${Number(wallet?.balance || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Buy and sell rare player cards</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Balance</p>
            <p className="text-lg font-black text-white">N${Number(wallet?.balance || 0).toFixed(2)}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <TabsList className="rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
              <TabsTrigger value="buy" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Buy Cards
              </TabsTrigger>
              <TabsTrigger value="sell" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Tag className="mr-2 h-4 w-4" />
                My Listings
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Sort by</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortMode)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="performance">Performance</option>
                <option value="priceAsc">Price ↑</option>
                <option value="priceDesc">Price ↓</option>
                <option value="rarity">Rarity</option>
              </select>
            </div>
          </div>

          <TabsContent value="buy">
            <div className="relative overflow-hidden rounded-2xl border border-cyan-500/45 bg-[radial-gradient(circle_at_10%_10%,rgba(56,189,248,.28),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,.2),transparent_30%),linear-gradient(135deg,rgba(2,6,23,.95),rgba(8,47,73,.72)_52%,rgba(2,6,23,.95))] p-4 shadow-[0_28px_80px_rgba(8,47,73,.42)]">
              <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(56,189,248,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,.16)_1px,transparent_1px)] [background-size:24px_24px]" />
              <div className="pointer-events-none absolute -right-10 top-4 text-[72px] font-black uppercase tracking-[0.3em] text-cyan-300/10">
                BUY
              </div>
              <div className="relative mb-3 inline-flex items-center rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">
                Buyer Exchange Floor
              </div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Search players..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-12 rounded-xl border-slate-800 bg-black/45 pl-10 text-white placeholder:text-slate-500"
                />
              </div>
              <Button variant={eligibilityOnly ? "default" : "outline"} onClick={() => setEligibilityOnly((v) => !v)} className="h-12 rounded-xl border-slate-800">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Eligible (60+)
              </Button>
              <select
                value={rarityFilter}
                onChange={(event) => setRarityFilter(event.target.value)}
                className="h-12 rounded-xl border border-slate-800 bg-black/45 px-3 text-sm text-white outline-none"
              >
                <option value="all">All Rarities</option>
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="unique">Unique</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
              <Button variant="outline" onClick={saveCurrentFilter} className="h-12 rounded-xl border-slate-800">
                <BookmarkPlus className="mr-2 h-4 w-4" />
                Save Filter
              </Button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              {savedFilters.map((filter, index) => (
                <Button
                  key={`${filter.name}-${index}`}
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-slate-400 hover:text-white"
                  onClick={() => {
                    setSearch(filter.search);
                    setRarityFilter(filter.rarity);
                    setSortBy(filter.sortBy);
                    setEligibilityOnly(filter.eligibilityOnly);
                  }}
                >
                  {filter.name}
                </Button>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/45 shadow-[0_24px_80px_rgba(0,0,0,.28)]">
              <div className="grid grid-cols-[minmax(260px,2.2fr)_1.1fr_.8fr_.55fr_.55fr_.8fr_1.15fr_1fr] gap-4 border-b border-slate-800 bg-slate-950/90 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 max-xl:grid-cols-[minmax(260px,2fr)_1fr_.6fr_.8fr_1fr] max-lg:hidden">
                <span>Player</span>
                <span>Rarity</span>
                <span className="max-xl:hidden">Team</span>
                <span>POS</span>
                <span className="max-lg:hidden">OVR</span>
                <span>Points</span>
                <span className="max-xl:hidden">Last 5</span>
                <span>Price / Action</span>
              </div>

              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full rounded-xl bg-slate-800" />
                  ))}
                </div>
              ) : visibleBuyListings.length > 0 ? (
                <div>
                  {visibleBuyListings.map((card) => (
                    <PlayerMarketRow
                  key={resolveCardId(card) || `${card.serialId || "no-serial"}-${card.playerId || "player"}-${getCardPrice(card)}`}
                      card={card}
                      watched={watchlist.includes(resolveCardId(card))}
                      onBuy={() => handleOpenBuyCard(card)}
                      onDetails={() => setDetailCard(card)}
                      onToggleWatchlist={() => toggleWatchlist(resolveCardId(card))}
                    />
                  ))}
                </div>
              ) : (
                <Card className="m-4 border-slate-800 bg-slate-950/60 p-12 text-center">
                  <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                  <p className="text-lg text-slate-300">{search ? "No cards match your search" : "No cards for sale"}</p>
                </Card>
              )}
            </div>

            {isMobile && sortedListings.length > buyVisibleCount ? (
              <div className="mt-5 flex justify-center">
                <Button variant="outline" onClick={() => setBuyVisibleCount((prev) => prev + 12)}>Load More Listings</Button>
              </div>
            ) : null}
            </div>
          </TabsContent>

          <TabsContent value="sell">
            <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/40 bg-[radial-gradient(circle_at_88%_12%,rgba(236,72,153,.24),transparent_36%),radial-gradient(circle_at_0%_100%,rgba(168,85,247,.2),transparent_36%),linear-gradient(135deg,rgba(30,27,75,.88),rgba(88,28,135,.48)_48%,rgba(2,6,23,.94))] p-4 shadow-[0_28px_80px_rgba(88,28,135,.38)]">
              <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(217,70,239,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(217,70,239,.18)_1px,transparent_1px)] [background-size:24px_24px]" />
              <div className="pointer-events-none absolute -left-8 top-4 text-[72px] font-black uppercase tracking-[0.3em] text-fuchsia-300/10">
                SELL
              </div>
              <div className="relative mb-3 inline-flex items-center rounded-lg border border-fuchsia-300/35 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-200">
                Seller Listing Desk
              </div>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/45">
              {visibleSellListings.length > 0 ? (
                visibleSellListings.map((card) => (
                  <PlayerMarketRow key={resolveCardId(card) || `${card.serialId || "no-serial"}-${card.playerId || "player"}-${getCardPrice(card)}`} card={card} watched={watchlist.includes(resolveCardId(card))} onDetails={() => setDetailCard(card)} />
                ))
              ) : (
                <Card className="m-4 border-slate-800 bg-slate-950/60 p-12 text-center">
                  <Tag className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                  <p className="text-lg text-slate-300">You don't have any cards listed for sale</p>
                  <p className="mt-2 text-sm text-slate-500">Go to your Collection to list cards</p>
                </Card>
              )}
            </div>
            {isMobile && (myListedCards?.length || 0) > sellVisibleCount ? (
              <div className="mt-5 flex justify-center">
                <Button variant="outline" onClick={() => setSellVisibleCount((prev) => prev + 12)}>Load More My Listings</Button>
              </div>
            ) : null}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-right text-sm text-slate-500">
          Showing {visibleBuyListings.length} of {sortedListings.length} players
        </div>
      </div>

      <Dialog open={!!buyCard} onOpenChange={(open) => !open && setBuyCard(null)}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {buyCard ? (
              <div className="mb-4 flex justify-center">
                <CardShowcase card={buyCard} size="sm" />
              </div>
            ) : null}
            <p>Buy <strong>{buyCard?.player?.name}</strong> for N${Number(buyCard ? getCardPrice(buyCard) : 0).toFixed(2)}?</p>
            <p className="mt-1 text-sm text-slate-400">Seller: {buyCard ? getOwner(buyCard) : "Fantasy Arena"}</p>
            <p className="mt-2 text-sm text-slate-400">Your Balance: N${Number(wallet?.balance || 0).toFixed(2)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { play("click"); setBuyCard(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!buyCard) return;
                play("click");
                const purchaseCardId = resolveCardId(buyCard);
                if (!purchaseCardId) {
                  toast({ title: "Error", description: "This listing has an invalid card id.", variant: "destructive" });
                  return;
                }
                buyMutation.mutate(purchaseCardId);
              }}
              disabled={buyMutation.isPending || Number(wallet?.balance || 0) < Number(buyCard ? getCardPrice(buyCard) : 0)}
            >
              {buyMutation.isPending ? "Processing..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailCard} onOpenChange={(open) => !open && setDetailCard(null)}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Player Market Details</DialogTitle>
          </DialogHeader>
          {detailCard ? (
            <div className="space-y-3">
              <PlayerMarketRow card={detailCard} watched={watchlist.includes(resolveCardId(detailCard))} onBuy={() => handleOpenBuyCard(detailCard)} onToggleWatchlist={() => toggleWatchlist(resolveCardId(detailCard))} />
              <div className="rounded-xl border border-slate-800 bg-black/35 p-4 text-sm text-slate-300">
                <p>Listed: N${Number(marketSignal?.listedPrice || getCardPrice(detailCard)).toFixed(2)}</p>
                <p>Last Sale: N${Number(marketSignal?.lastSale || 0).toFixed(2)} · Avg Sale: N${Number(marketSignal?.avgSale || 0).toFixed(2)}</p>
                <p>Velocity: {marketSignal?.velocity || "low"} · Confidence: {marketSignal?.confidence || "low"}</p>
                <p>Sales (30d): {marketSignal?.salesCount30d || 0} · Listed Days: {marketSignal?.listedSinceDays ?? "—"}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

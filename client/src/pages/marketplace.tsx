import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import CollectionPlayerCard from "../components/CollectionPlayerCard";
import CardShowcase from "../components/CardShowcase";
import SceneAtmosphere from "../components/SceneAtmosphere";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
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
import { type PlayerCardWithPlayer, type Wallet, SITE_FEE_RATE } from "../../../shared/schema";
import { BookmarkPlus, Heart, Search, ShieldCheck, ShoppingCart, SlidersHorizontal, Tag, TrendingUp } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";
import { useUiSound } from "../hooks/use-ui-sound";
import { useIsMobile } from "../hooks/use-mobile";

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
  const [sortBy, setSortBy] = useState<"priceAsc" | "priceDesc" | "rarity" | "performance">("priceAsc");
  const [eligibilityOnly, setEligibilityOnly] = useState(false);
  const [watchlist, setWatchlist] = useState<number[]>([]);
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; search: string; rarity: string; sortBy: string; eligibilityOnly: boolean }>>([]);

  const { data: marketSignal } = useQuery<{
    listedPrice: number;
    lastSale: number;
    avgSale: number;
    salesCount30d: number;
    tradeCount: number;
    listedSinceDays: number | null;
    velocity: "low" | "medium" | "high";
    confidence: "low" | "medium" | "strong";
  }>({
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
      const res = await apiRequest("POST", `/api/marketplace/buy/${cardId}`, {});
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
      // ignore parse issues
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("market_watchlist_card_ids", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem("market_saved_filters", JSON.stringify(savedFilters));
  }, [savedFilters]);

  const filteredListings = listings?.filter((card) => {
    const matchesSearch =
      !search ||
      card.player?.name?.toLowerCase().includes(search.toLowerCase()) ||
      card.player?.team?.toLowerCase().includes(search.toLowerCase());
    const matchesRarity = rarityFilter === "all" || card.rarity === rarityFilter;
    const isEligible = (card.decisiveScore || 0) >= 60;
    const matchesEligibility = !eligibilityOnly || isEligible;
    return matchesSearch && matchesRarity && matchesEligibility;
  });

  // Sort listings based on selected strategy
  const sortedListings = [...(filteredListings || [])].sort((a, b) => {
    if (sortBy === "priceAsc") return (a.price || 0) - (b.price || 0);
    if (sortBy === "priceDesc") return (b.price || 0) - (a.price || 0);
    if (sortBy === "performance") return (b.decisiveScore || 0) - (a.decisiveScore || 0);

    const rarityOrder = ["common", "rare", "unique", "epic", "legendary"];
    return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
  });

  // Filter user's listed cards
  const myListedCards = myCards?.filter(card => card.forSale);
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
    if (currentId && previousBuyCardId.current !== currentId) {
      play("reveal");
    }
    previousBuyCardId.current = currentId;
  }, [buyCard?.id, play]);

  useEffect(() => {
    if (!visibleBuyListings.length) return;
    const snapshot = visibleBuyListings.slice(0, 5).map((card) => {
      const fantasy = toFantasyCardData(card, { imageWidth: 1024 });
      return {
        id: card.id,
        name: card.player?.name,
        rarity: card.rarity,
        image: fantasy.image,
        candidates: fantasy.imageCandidates?.slice(0, 3),
      };
    });
    console.info("[Marketplace] card render debug", snapshot);
  }, [visibleBuyListings]);

  const handleOpenBuyCard = (card: PlayerCardWithPlayer) => {
    play("click");
    setBuyCard(card);
  };

  const toggleWatchlist = (cardId: number) => {
    setWatchlist((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  };

  const saveCurrentFilter = () => {
    const name = `Filter ${savedFilters.length + 1}`;
    setSavedFilters((prev) => {
      const next = [...prev, { name, search, rarity: rarityFilter, sortBy, eligibilityOnly }];
      return next.slice(-5);
    });
    toast({ title: "Filter saved", description: "Saved to local watch settings." });
  };

  return (
    <div className="relative flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <SceneAtmosphere variant="cabinet" />
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
            <p className="text-muted-foreground text-sm">Buy and sell rare player cards</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Balance: N${wallet?.balance || 0}
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="buy" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Buy Cards
            </TabsTrigger>
            <TabsTrigger value="sell" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              My Listings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant={eligibilityOnly ? "default" : "outline"}
                onClick={() => setEligibilityOnly((v) => !v)}
                className="gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Eligible (60+)
              </Button>
              <Button variant="outline" onClick={saveCurrentFilter} className="gap-2">
                <BookmarkPlus className="w-4 h-4" />
                Save Filter
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              {(["priceAsc", "priceDesc", "rarity", "performance"] as const).map((opt) => (
                <Button
                  key={opt}
                  size="sm"
                  variant={sortBy === opt ? "default" : "outline"}
                  onClick={() => setSortBy(opt)}
                >
                  {opt === "priceAsc" ? "Price ↑" : opt === "priceDesc" ? "Price ↓" : opt === "rarity" ? "Rarity" : "Performance"}
                </Button>
              ))}
              {savedFilters.map((f, i) => (
                <Button
                  key={`${f.name}-${i}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearch(f.search);
                    setRarityFilter(f.rarity);
                    setSortBy(f.sortBy as "priceAsc" | "priceDesc" | "rarity" | "performance");
                    setEligibilityOnly(f.eligibilityOnly);
                  }}
                >
                  {f.name}
                </Button>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[400px] w-full rounded-xl" />
                ))}
              </div>
            ) : sortedListings && sortedListings.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-5">
                {visibleBuyListings.map((card) => (
                  <div key={card.id} className="flex items-center justify-center min-h-[360px]">
                    <div className="flex flex-col items-center gap-2">
                      <button type="button" className="w-full text-left" onClick={() => handleOpenBuyCard(card)}>
                        <CollectionPlayerCard player={toFantasyCardData(card, { imageWidth: 1024 })} className={isMobile ? "!w-[172px]" : "!w-[220px]"} />
                      </button>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDetailCard(card)}>
                          Details
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleWatchlist(card.id)}>
                          <Heart className={`w-4 h-4 ${watchlist.includes(card.id) ? "fill-current text-red-500" : "text-muted-foreground"}`} />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Seller: {card.ownerUsername || card.ownerName || "FantasyFC"}
                      </p>
                      <p className="text-sm font-semibold text-green-500">
                        N${(card.price || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                {isMobile && sortedListings.length > buyVisibleCount ? (
                  <div className="col-span-full flex justify-center mt-2">
                    <Button variant="outline" onClick={() => setBuyVisibleCount((prev) => prev + 12)}>
                      Load More Listings
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Card className="p-12 text-center bg-background/50 backdrop-blur-sm border-border/50">
                <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">
                  {search ? "No cards match your search" : "No cards for sale"}
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sell">
            {myListedCards && myListedCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-5">
                {visibleSellListings.map((card) => (
                  <div key={card.id} className="relative flex items-center justify-center min-h-[360px]">
                    <div className="flex flex-col items-center gap-2">
                      <CollectionPlayerCard player={toFantasyCardData(card, { imageWidth: 1024 })} className={isMobile ? "!w-[172px]" : "!w-[220px]"} />
                      <p className="text-sm font-semibold text-green-500">
                        N${(card.price || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                {isMobile && myListedCards.length > sellVisibleCount ? (
                  <div className="col-span-full flex justify-center mt-2">
                    <Button variant="outline" onClick={() => setSellVisibleCount((prev) => prev + 12)}>
                      Load More My Listings
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Card className="p-12 text-center bg-background/50 backdrop-blur-sm border-border/50">
                <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">
                  You don't have any cards listed for sale
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Go to your Collection to list cards
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Buy Dialog */}
      <Dialog
        open={!!buyCard}
        onOpenChange={(open) => {
          if (!open) setBuyCard(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {buyCard && (
              <div className="mb-4 flex justify-center">
                <CardShowcase card={buyCard} size="sm" />
              </div>
            )}
            <p>Are you sure you want to buy <strong>{buyCard?.player?.name}</strong> for N${buyCard?.price}?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Seller: {buyCard?.ownerUsername || buyCard?.ownerName || "FantasyFC"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Your Balance: N${wallet?.balance || 0}</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                play("click");
                setBuyCard(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!buyCard) return;
                play("click");
                buyMutation.mutate(buyCard.id);
              }}
              disabled={buyMutation.isPending || (wallet?.balance || 0) < (buyCard?.price || 0)}
            >
              {buyMutation.isPending ? "Processing..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailCard}
        onOpenChange={(open) => {
          if (!open) setDetailCard(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Card Details</DialogTitle>
          </DialogHeader>
          {detailCard ? (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{detailCard.player?.name}</strong> · {detailCard.player?.team}
              </p>
              <p className="text-sm text-muted-foreground">
                Decisive Score: {detailCard.decisiveScore || 0} · Last 5: {(detailCard.last5Scores || []).join(", ")}
              </p>
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <p>Listed: N${(marketSignal?.listedPrice || detailCard.price || 0).toFixed(2)}</p>
                <p>Last Sale: N${(marketSignal?.lastSale || 0).toFixed(2)} · Avg Sale: N${(marketSignal?.avgSale || 0).toFixed(2)}</p>
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

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
// Fixed: @/lib -> ../lib
import { apiRequest, queryClient } from "../lib/queryClient";
// Fixed: @/components -> ../components
import Card3D from "../components/Card3D";
import LockerRoomScene from "../components/locker/LockerRoomScene";
import PlayerCard from "../components/PlayerCard";
import CardVaultUnlock from "../components/scenes/CardVaultUnlock";
import FeaturedCard3D from "../components/cards/FeaturedCard3D";
import CardTile2D from "../components/cards/CardTile2D";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
// Fixed: @shared -> ../../../shared
import { type PlayerCardWithPlayer, type Lineup } from "../../../shared/schema";
import { Filter, DollarSign } from "lucide-react";
import { LOCKER_ROOM_MODE } from "../lib/featureFlags";
// Fixed: @/hooks -> ../hooks
import { useToast } from "../hooks/use-toast";

export default function CollectionPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [editingLineup, setEditingLineup] = useState(false);
  const [selectedForLineup, setSelectedForLineup] = useState<Set<number>>(
    new Set(),
  );
  const [listCard, setListCard] = useState<PlayerCardWithPlayer | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "locker">("grid");
  const [lockerAmbientAudio, setLockerAmbientAudio] = useState(false);
  const [vaultUnlockOpen, setVaultUnlockOpen] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [featuredCardId, setFeaturedCardId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("lockerAmbientAudio");
    if (saved === "true") {
      setLockerAmbientAudio(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lockerAmbientAudio", lockerAmbientAudio ? "true" : "false");
  }, [lockerAmbientAudio]);

  useEffect(() => {
    if (!LOCKER_ROOM_MODE) return;
    try {
      const unlocked = localStorage.getItem("collectionVaultUnlocked") === "true";
      setVaultUnlocked(unlocked);
      if (!unlocked) {
        setVaultUnlockOpen(true);
      }
    } catch {
      setVaultUnlockOpen(true);
    }
  }, []);

  const BASE_PRICES: Record<string, number> = {
    rare: 100,
    unique: 250,
    legendary: 500,
  };

  const { data: cards, isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cards");
      const data = await res.json();
      return Array.isArray(data) ? data : data.cards || [];
    },
  });

  const { data: lineupData } = useQuery<{
    lineup: Lineup;
    cards: PlayerCardWithPlayer[];
  }>({
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
      setEditingLineup(false);
      toast({ title: "Lineup saved!" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const listForSaleMutation = useMutation({
    mutationFn: async ({ cardId, price }: { cardId: number; price: number }) => {
      const res = await apiRequest("POST", "/api/marketplace/list", { cardId, price });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      setListCard(null);
      setListPrice("");
      toast({ title: "Card listed for sale!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to list card", 
        variant: "destructive" 
      });
    },
  });

  const cancelListingMutation = useMutation({
    mutationFn: async (cardId: number) => {
      const res = await apiRequest("POST", `/api/marketplace/cancel/${cardId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      toast({ title: "Listing cancelled" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to cancel listing", 
        variant: "destructive" 
      });
    },
  });

  const handleListCard = (card: PlayerCardWithPlayer) => {
    if (String(card.rarity || "").toLowerCase() === "common") {
      toast({
        title: "Cannot sell common cards",
        description: "Common cards are tournament-only and can’t be sold.",
        variant: "destructive",
      });
      return;
    }
    setListCard(card);
    const basePrice = BASE_PRICES[card.rarity] || 0;
    setListPrice(basePrice.toString());
  };

  const handleConfirmList = () => {
    if (!listCard) return;
    const price = parseFloat(listPrice);
    const basePrice = BASE_PRICES[listCard.rarity] || 0;
    
    if (isNaN(price) || price <= 0) {
      toast({ title: "Invalid price", variant: "destructive" });
      return;
    }
    
    if (basePrice && price < basePrice) {
      toast({ 
        title: "Price too low", 
        description: `Minimum price for ${listCard.rarity} cards is N$${basePrice}`,
        variant: "destructive" 
      });
      return;
    }
    
    listForSaleMutation.mutate({ cardId: listCard.id, price });
  };

  const filteredCards = cards?.filter((c) => {
    if (filter === "all") return true;
    return c.rarity === filter;
  });

  useEffect(() => {
    if (!filteredCards?.length) {
      setFeaturedCardId(null);
      return;
    }

    if (!featuredCardId || !filteredCards.some((c) => String(c.id) === featuredCardId)) {
      setFeaturedCardId(String(filteredCards[0].id));
    }
  }, [filteredCards, featuredCardId]);

  const featuredCard = useMemo(() => {
    if (!filteredCards?.length) return null;
    return filteredCards.find((c) => String(c.id) === featuredCardId) || filteredCards[0] || null;
  }, [filteredCards, featuredCardId]);

  const startEditLineup = () => {
    setEditingLineup(true);
    if (lineupData?.lineup?.cardIds) {
      setSelectedForLineup(new Set(lineupData.lineup.cardIds));
    }
  };

  const toggleLineupCard = (cardId: number) => {
    setSelectedForLineup((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else if (next.size < 5) {
        next.add(cardId);
      }
      return next;
    });
  };

  const rarityFilters = [
    { value: "all", label: "All" },
    { value: "common", label: "Common" },
    { value: "rare", label: "Rare" },
    { value: "unique", label: "Unique" },
    { value: "legendary", label: "Legendary" },
  ];

  const lastFivePoints = (card: PlayerCardWithPlayer) => {
    const scores = Array.isArray(card.last5Scores)
      ? card.last5Scores.map((value) => Number(value || 0)).slice(-5)
      : [];
    while (scores.length < 5) scores.unshift(0);
    return scores;
  };

  const raritySurfaceGlow: Record<string, string> = {
    common: "rgba(203,213,225,0.22)",
    rare: "rgba(248,113,113,0.26)",
    unique: "rgba(216,180,254,0.28)",
    epic: "rgba(165,180,252,0.24)",
    legendary: "rgba(251,191,36,0.3)",
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <CardVaultUnlock
        open={vaultUnlockOpen}
        onClose={() => setVaultUnlockOpen(false)}
        onUnlocked={() => {
          setVaultUnlocked(true);
          localStorage.setItem("collectionVaultUnlocked", "true");
        }}
      />

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Collection</h1>
            <p className="text-muted-foreground text-sm">
              {cards?.length || 0} cards in your collection
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "default" : "outline"}
              onClick={() => setViewMode("grid")}
            >
              Grid
            </Button>
            <Button
              size="sm"
              variant={viewMode === "locker" ? "default" : "outline"}
              onClick={() => setViewMode("locker")}
              disabled={!LOCKER_ROOM_MODE}
            >
              Locker Room Scene
            </Button>
            {viewMode === "locker" && LOCKER_ROOM_MODE && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVaultUnlockOpen(true)}
              >
                {vaultUnlocked ? "Unlock Vault (Replay)" : "Unlock Vault"}
              </Button>
            )}
            {viewMode === "locker" && LOCKER_ROOM_MODE && (
              <Button
                size="sm"
                variant={lockerAmbientAudio ? "default" : "outline"}
                onClick={() => setLockerAmbientAudio((prev) => !prev)}
              >
                Ambient Audio {lockerAmbientAudio ? "On" : "Off"}
              </Button>
            )}
            {!LOCKER_ROOM_MODE && <Badge variant="outline">LOCKER_ROOM_MODE=false</Badge>}
            {LOCKER_ROOM_MODE && <Badge variant="secondary">LOCKER_ROOM_MODE=true</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {rarityFilters.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.value)}
              data-testid={`button-filter-${f.value}`}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-wrap gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="w-48 h-72 rounded-md" />
            ))}
          </div>
        ) : filteredCards && filteredCards.length > 0 ? (
          viewMode === "locker" && LOCKER_ROOM_MODE ? (
            <div className="relative min-h-[calc(100vh-80px)] rounded-2xl overflow-hidden">
              <LockerRoomScene enabled={LOCKER_ROOM_MODE} />

              <div className="relative z-10 px-4">
                <div className="mx-auto max-w-6xl">
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm text-white/80">Display Cabinet</div>
                      <div className="text-xs text-white/60">Locker Room Shelf</div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-[320px_1fr]">
                      <div className="flex justify-center">
                        {featuredCard ? <FeaturedCard3D card={featuredCard} /> : null}
                      </div>

                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {filteredCards.map((card) => {
                          return (
                            <CardTile2D
                              key={card.id}
                              selected={String(card.id) === String(featuredCard?.id || "")}
                              onClick={() => setFeaturedCardId(String(card.id))}
                            >
                              <PlayerCard card={card} size="sm" />
                              <div className="mt-2 rounded-lg border border-border/60 bg-background/75 p-2">
                                <div className="mb-2">
                                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 5 Games</div>
                                  <div className="mt-1 flex items-center gap-1">
                                    {lastFivePoints(card).map((value, idx) => (
                                      <span
                                        key={`${card.id}-l5-${idx}`}
                                        className="min-w-[26px] rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white/85"
                                      >
                                        {value}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {card.forSale ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => cancelListingMutation.mutate(card.id)}
                                    disabled={cancelListingMutation.isPending}
                                    className="text-xs w-full"
                                  >
                                    Cancel (N${card.price})
                                  </Button>
                                ) : String(card.rarity || "").toLowerCase() === "common" ? (
                                  <Button size="sm" variant="outline" disabled className="text-xs w-full">
                                    Tournament Only
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="secondary" onClick={() => handleListCard(card)} className="text-xs w-full">
                                    <DollarSign className="w-3 h-3 mr-1" />
                                    Sell
                                  </Button>
                                )}
                              </div>
                            </CardTile2D>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-white/50">
                      Tap a card to feature it. Long press to toggle rotation (optional).
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-8 justify-center preserve-3d" style={{ transformStyle: "preserve-3d" }}>
              {filteredCards.map((card) => {
                return (
                  <div
                    key={card.id}
                    className="card-3d-container bg-transparent shadow-none p-0"
                    style={{ transformStyle: "preserve-3d", minHeight: "380px", position: "relative" }}
                  >
                    <PlayerCard card={card} size="md" />
                    <div className="mt-2 rounded-lg border border-border/60 bg-background/80 p-2 relative z-20">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 5 Games</div>
                      <div className="mt-1 flex items-center gap-1">
                        {lastFivePoints(card).map((value, idx) => (
                          <span
                            key={`${card.id}-grid-l5-${idx}`}
                            className="min-w-[30px] rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white/85"
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 flex justify-center gap-2">
                      {card.forSale ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => cancelListingMutation.mutate(card.id)}
                          disabled={cancelListingMutation.isPending}
                          className="text-xs"
                        >
                          Cancel (N${card.price})
                        </Button>
                      ) : String(card.rarity || "").toLowerCase() === "common" ? (
                        <Button size="sm" variant="outline" disabled className="text-xs">
                          Tournament Only
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => handleListCard(card)} className="text-xs">
                          <DollarSign className="w-3 h-3 mr-1" />
                          Sell
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No cards found with this filter.
            </p>
          </Card>
        )}
      </div>

      {/* List for Sale Dialog */}
      <Dialog open={!!listCard} onOpenChange={() => setListCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>List Card for Sale</DialogTitle>
            <DialogDescription>
              {listCard && BASE_PRICES[listCard.rarity] 
                ? `Minimum price for ${listCard.rarity} cards: N$${BASE_PRICES[listCard.rarity]}`
                : "Set your listing price"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <p className="font-semibold">{listCard?.player?.name}</p>
              <p className="text-sm text-muted-foreground capitalize">{listCard?.rarity} • {listCard?.player?.position}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Price (N$)</label>
              <Input
                type="number"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder={listCard && BASE_PRICES[listCard.rarity] ? `Min: ${BASE_PRICES[listCard.rarity]}` : "Enter price"}
                min={listCard ? BASE_PRICES[listCard.rarity] || 1 : 1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListCard(null)}>Cancel</Button>
            <Button 
              onClick={handleConfirmList}
              disabled={listForSaleMutation.isPending || !listPrice || parseFloat(listPrice) <= 0}
            >
              {listForSaleMutation.isPending ? "Listing..." : "List for Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

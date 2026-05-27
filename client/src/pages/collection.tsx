import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import CollectionPlayerCard from "../components/CollectionPlayerCard";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
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
import { type PlayerCardWithPlayer, type Lineup } from "../../../shared/schema";
import { Filter, DollarSign } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { useIsMobile } from "../hooks/use-mobile";

export default function CollectionPage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(16);
  const [editingLineup, setEditingLineup] = useState(false);
  const [selectedForLineup, setSelectedForLineup] = useState<Set<number>>(new Set());
  const [listCard, setListCard] = useState<PlayerCardWithPlayer | null>(null);
  const [listPrice, setListPrice] = useState("");

  const BASE_PRICES: Record<string, number> = {
    common: 0,
    rare: 20,
    unique: 50,
    epic: 50,
    legendary: 100,
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
    onError: (error: any) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      setListCard(null);
      setListPrice("");
      toast({ title: "Card listed for sale" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to list card", variant: "destructive" });
    },
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
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to cancel listing", variant: "destructive" });
    },
  });

  const handleListCard = (card: PlayerCardWithPlayer) => {
    const rarity = String(card.rarity || "common").toLowerCase();
    if (rarity === "common") {
      toast({
        title: "Cannot sell common cards",
        description: "Common cards are tournament-only and can’t be sold.",
        variant: "destructive",
      });
      return;
    }
    setListCard(card);
    setListPrice(String(BASE_PRICES[rarity] || 1));
  };

  const handleConfirmList = () => {
    if (!listCard) return;
    const price = parseFloat(listPrice);
    const rarity = String(listCard.rarity || "common").toLowerCase();
    const basePrice = BASE_PRICES[rarity] || 0;

    if (isNaN(price) || price <= 0) {
      toast({ title: "Invalid price", variant: "destructive" });
      return;
    }

    if (basePrice && price < basePrice) {
      toast({ title: "Price too low", description: `Minimum price for ${rarity} cards is N$${basePrice}`, variant: "destructive" });
      return;
    }

    listForSaleMutation.mutate({ cardId: listCard.id, price });
  };

  const filteredCards = cards?.filter((c) => filter === "all" || String(c.rarity || "").toLowerCase() === filter);

  useEffect(() => {
    setVisibleCount(16);
  }, [filter, isMobile, cards?.length]);

  const visibleCards = isMobile ? (filteredCards || []).slice(0, visibleCount) : (filteredCards || []);

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

  const rarityFilters = [
    { value: "all", label: "All" },
    { value: "common", label: "Common" },
    { value: "rare", label: "Rare" },
    { value: "unique", label: "Unique" },
    { value: "legendary", label: "Legendary" },
  ];

  return (
    <div className="flex-1 overflow-auto p-3 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
          <div>
            <h1 className="text-2xl font-black text-white">My Team</h1>
            <p className="text-sm text-slate-400">{cards?.length || 0} cards in your collection</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEditLineup}>Edit Lineup</Button>
            {editingLineup ? (
              <Button size="sm" onClick={() => saveLineupMutation.mutate(Array.from(selectedForLineup))} disabled={saveLineupMutation.isPending}>
                Save ({selectedForLineup.size}/5)
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-2 backdrop-blur-xl">
          <Filter className="h-4 w-4 shrink-0 text-slate-400" />
          {rarityFilters.map((f) => (
            <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)} data-testid={`button-filter-${f.value}`} className="shrink-0">
              {f.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-[218px] rounded-[26px] sm:h-[232px]" />)}
          </div>
        ) : filteredCards && filteredCards.length > 0 ? (
          <div className="grid grid-cols-2 justify-items-center gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visibleCards.map((card) => {
              const fantasyCard = toFantasyCardData(card, { imageWidth: 640 });
              const isSelected = selectedForLineup.has(card.id);
              return (
                <div key={card.id} className="flex flex-col items-center gap-2">
                  <div className={editingLineup ? `rounded-[28px] ${isSelected ? "ring-2 ring-emerald-400" : ""}` : ""}>
                    <CollectionPlayerCard player={fantasyCard} selected={isSelected} onClick={editingLineup ? () => toggleLineupCard(card.id) : undefined} />
                  </div>
                  <div className="z-30 flex min-h-8 gap-2">
                    {card.forSale ? (
                      <Button size="sm" variant="destructive" onClick={() => cancelListingMutation.mutate(card.id)} disabled={cancelListingMutation.isPending} className="h-8 text-xs">
                        Cancel N${card.price}
                      </Button>
                    ) : String(card.rarity || "").toLowerCase() === "common" ? (
                      <Button size="sm" variant="outline" disabled className="h-8 text-xs">Tournament Only</Button>
                    ) : (
                      <Button size="sm" onClick={() => handleListCard(card)} className="h-8 bg-gradient-to-r from-emerald-500 to-lime-500 text-xs font-black text-black">
                        <DollarSign className="mr-1 h-3 w-3" /> Sell
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {isMobile && filteredCards.length > visibleCount ? (
              <div className="col-span-2 mt-2 flex w-full justify-center sm:col-span-3">
                <Button variant="outline" onClick={() => setVisibleCount((prev) => prev + 16)}>Load More</Button>
              </div>
            ) : null}
          </div>
        ) : (
          <Card className="p-8 text-center"><p className="text-muted-foreground">No cards found with this filter.</p></Card>
        )}
      </div>

      <Dialog open={!!listCard} onOpenChange={() => setListCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>List Card for Sale</DialogTitle>
            <DialogDescription>
              {listCard && BASE_PRICES[String(listCard.rarity || "").toLowerCase()] ? `Minimum price for ${listCard.rarity} cards: N$${BASE_PRICES[String(listCard.rarity || "").toLowerCase()]}` : "Set your listing price"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="font-semibold">{listCard?.player?.name}</p>
              <p className="text-sm text-muted-foreground capitalize">{listCard?.rarity} • {listCard?.player?.position}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Price (N$)</label>
              <Input type="number" value={listPrice} onChange={(e) => setListPrice(e.target.value)} placeholder={listCard ? `Min: ${BASE_PRICES[String(listCard.rarity || "").toLowerCase()] || 1}` : "Enter price"} min={listCard ? BASE_PRICES[String(listCard.rarity || "").toLowerCase()] || 1 : 1} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListCard(null)}>Cancel</Button>
            <Button onClick={handleConfirmList} disabled={listForSaleMutation.isPending || !listPrice || parseFloat(listPrice) <= 0}>
              {listForSaleMutation.isPending ? "Listing..." : "List for Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

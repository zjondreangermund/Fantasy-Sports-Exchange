import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
// Fixed: @/lib -> ../lib
import { apiRequest, queryClient } from "../lib/queryClient";
// Fixed: @/components -> ../components
import Card3D from "../components/Card3D";
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
import { Filter, Save, Check, DollarSign } from "lucide-react";
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

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Collection</h1>
            <p className="text-muted-foreground text-sm">
              {cards?.length || 0} cards in your collection
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editingLineup ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectedForLineup.size}/5 selected
                </span>
                <Button
                  onClick={() =>
                    saveLineupMutation.mutate(Array.from(selectedForLineup))
                  }
                  disabled={
                    selectedForLineup.size !== 5 ||
                    saveLineupMutation.isPending
                  }
                  data-testid="button-save-lineup"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {saveLineupMutation.isPending ? "Saving..." : "Save Lineup"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingLineup(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={startEditLineup}
                data-testid="button-edit-lineup"
              >
                Edit Lineup
              </Button>
            )}
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
          <div 
            className="flex flex-wrap gap-8 justify-center preserve-3d"
            style={{ transformStyle: "preserve-3d" }}
          >
            {filteredCards.map((card) => {
              const isInLineup = lineupData?.lineup?.cardIds?.includes(card.id);
              return (
                <div 
                  key={card.id} 
                  className="card-3d-container" 
                  style={{ 
                    transformStyle: "preserve-3d",
                    minHeight: "380px",
                    position: "relative"
                  }}
                >
                  <Card3D
                    card={card}
                    selected={
                      editingLineup
                        ? selectedForLineup.has(card.id)
                        : !!isInLineup
                    }
                    selectable={editingLineup}
                    onClick={
                      editingLineup
                        ? () => toggleLineupCard(card.id)
                        : undefined
                    }
                  />
                  {isInLineup && !editingLineup && (
                    <Badge className="absolute -top-2 -left-2 z-30 bg-primary text-primary-foreground text-[10px] no-default-hover-elevate no-default-active-elevate">
                      In Lineup
                    </Badge>
                  )}
                  {!editingLineup && (
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-30 flex gap-2">
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
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleListCard(card)}
                          className="text-xs"
                        >
                          <DollarSign className="w-3 h-3 mr-1" />
                          Sell
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

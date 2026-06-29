import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import CollectionPlayerCard from "../components/CollectionPlayerCard";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { type PlayerCardWithPlayer, type Lineup } from "../../../shared/schema";
import { Filter, Save } from "lucide-react";
import { useToast } from "../hooks/use-toast";

type CardsResponse = PlayerCardWithPlayer[] | { cards?: PlayerCardWithPlayer[] };

function normalizeCardsResponse(data: CardsResponse | undefined): PlayerCardWithPlayer[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.cards)) return data.cards;
  return [];
}

export default function CollectionPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [editingLineup, setEditingLineup] = useState(false);
  const [selectedForLineup, setSelectedForLineup] = useState<Set<number>>(
    new Set(),
  );

  const { data: cards = [], isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/cards/my"],
    queryFn: async () => {
      const res = await fetch("/api/cards/my", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch collection cards");
      return normalizeCardsResponse(await res.json());
    },
  });

  const { data: lineupData } = useQuery<{
    lineup: Lineup;
    cards: PlayerCardWithPlayer[];
  }>({
    queryKey: ["/api/lineup"],
  });

  const saveLineupMutation = useMutation({
    mutationFn: async (cardIds: number[]) => {
      const res = await apiRequest("POST", "/api/lineup", { cardIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lineup"] });
      setEditingLineup(false);
      toast({ title: "Lineup saved!" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredCards = cards.filter((c) => {
    if (filter === "all") return true;
    return String(c.rarity || "").toLowerCase() === filter;
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
    { value: "epic", label: "Epic" },
    { value: "legendary", label: "Legendary" },
  ];

  return (
    <div className="flex-1 overflow-auto p-3 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Collection</h1>
            <p className="text-muted-foreground text-sm">
              {cards.length} cards in your collection
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-72 rounded-md" />
            ))}
          </div>
        ) : filteredCards.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {filteredCards.map((card) => {
              const isInLineup = lineupData?.lineup?.cardIds?.includes(card.id);
              return (
                <div key={card.id} className="relative min-w-0">
                  <CollectionPlayerCard
                    card={card}
                    size="md"
                    selected={
                      editingLineup
                        ? selectedForLineup.has(card.id)
                        : !!isInLineup
                    }
                    selectable={editingLineup}
                    showActions={!editingLineup}
                    showBuy
                    onClick={
                      editingLineup
                        ? () => toggleLineupCard(card.id)
                        : undefined
                    }
                    onBuy={() => toast({ title: "Browse marketplace to buy cards" })}
                    onSell={() => {
                      toast({ title: "List for sale", description: "Open Marketplace to set a sale price." });
                    }}
                    onLoan={() => toast({ title: "Loan offer", description: "Loan feature coming soon." })}
                  />
                  {isInLineup && !editingLineup && (
                    <Badge className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-primary text-primary-foreground text-[10px] no-default-hover-elevate no-default-active-elevate">
                      In Lineup
                    </Badge>
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
    </div>
  );
}

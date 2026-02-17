import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
// Fixed: @/lib -> ../lib
import { apiRequest, queryClient } from "../lib/queryClient";
// Fixed: @/components -> ../components
import PlayerCard from "../components/threeplayercards";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
// Fixed: @shared -> ../../../shared
import { type PlayerCardWithPlayer, type Lineup } from "../../../shared/schema";
import { Filter, Save, Check } from "lucide-react";
// Fixed: @/hooks -> ../hooks
import { useToast } from "../hooks/use-toast";

export default function CollectionPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [editingLineup, setEditingLineup] = useState(false);
  const [selectedForLineup, setSelectedForLineup] = useState<Set<number>>(
    new Set(),
  );

  const { data: cards, isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/cards"],
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
          <div className="flex flex-wrap gap-6">
            {filteredCards.map((card) => {
              const isInLineup = lineupData?.lineup?.cardIds?.includes(card.id);
              return (
                <div key={card.id} className="relative">
                  <PlayerCard
                    card={card}
                    size="md"
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

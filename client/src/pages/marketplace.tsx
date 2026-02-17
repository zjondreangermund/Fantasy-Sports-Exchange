import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
// IMPORT YOUR 3D CARD COMPONENT HERE
import ThreePlayerCard from "../components/threeplayercards"; 
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { type PlayerCardWithPlayer, type Wallet, SITE_FEE_RATE } from "../../../shared/schema";
import { Search, Filter, ShoppingCart, Tag, DollarSign, ArrowLeftRight, TrendingUp } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";

export default function MarketplacePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [buyCard, setBuyCard] = useState<PlayerCardWithPlayer | null>(null);
  const [sellCard, setSellCard] = useState<PlayerCardWithPlayer | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  
  const { data: listings, isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/marketplace"],
  });

  const { data: myCards } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/cards"],
  });

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
  });

  const buyMutation = useMutation({
    mutationFn: async (cardId: number) => {
      const res = await apiRequest("POST", "/api/marketplace/buy", { cardId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
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

  const filteredListings = listings?.filter((card) => {
    const matchesSearch =
      !search ||
      card.player?.name?.toLowerCase().includes(search.toLowerCase()) ||
      card.player?.team?.toLowerCase().includes(search.toLowerCase());
    const matchesRarity = rarityFilter === "all" || card.rarity === rarityFilter;
    return matchesSearch && matchesRarity;
  });

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
            <p className="text-muted-foreground text-sm">Buy and sell rare player cards</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[400px] w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings?.map((card) => (
              <div 
                key={card.id} 
                className="relative group h-[450px] w-full bg-card/50 rounded-xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => setBuyCard(card)}
              >
                {/* 3D CARD INTEGRATION */}
                <ThreePlayerCard player={card.player as any} />
                
                {/* Overlay price for Marketplace feel */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur">
                    {card.rarity.toUpperCase()}
                  </Badge>
                  <div className="text-primary font-bold text-lg drop-shadow-md">
                    ${card.price}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Buy Dialog */}
      <Dialog open={!!buyCard} onOpenChange={() => setBuyCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to buy <strong>{buyCard?.player?.name}</strong> for ${buyCard?.price}?</p>
            <p className="text-sm text-muted-foreground mt-2">Your Balance: ${wallet?.balance || 0}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyCard(null)}>Cancel</Button>
            <Button 
              onClick={() => buyCard && buyMutation.mutate(buyCard.id)}
              disabled={buyMutation.isPending || (wallet?.balance || 0) < (buyCard?.price || 0)}
            >
              {buyMutation.isPending ? "Processing..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

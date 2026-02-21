import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
// IMPORT YOUR 3D CARD COMPONENT HERE
import Card3D from "../components/Card3D";
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
  const [activeTab, setActiveTab] = useState("buy");
  
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

  const filteredListings = listings?.filter((card) => {
    const matchesSearch =
      !search ||
      card.player?.name?.toLowerCase().includes(search.toLowerCase()) ||
      card.player?.team?.toLowerCase().includes(search.toLowerCase());
    const matchesRarity = rarityFilter === "all" || card.rarity === rarityFilter;
    return matchesSearch && matchesRarity;
  });

  // Sort listings: group by rarity, then by price (lowest first)
  const sortedListings = filteredListings?.sort((a, b) => {
    const rarityOrder = ["common", "rare", "unique", "epic", "legendary"];
    const rarityA = rarityOrder.indexOf(a.rarity);
    const rarityB = rarityOrder.indexOf(b.rarity);
    
    if (rarityA !== rarityB) {
      return rarityA - rarityB;
    }
    
    return (a.price || 0) - (b.price || 0);
  });

  // Filter user's listed cards
  const myListedCards = myCards?.filter(card => card.forSale);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[400px] w-full rounded-xl" />
                ))}
              </div>
            ) : sortedListings && sortedListings.length > 0 ? (
              <div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 preserve-3d"
                style={{ transformStyle: "preserve-3d" }}
              >
                {sortedListings.map((card) => (
                  <div 
                    key={card.id} 
                    className="flex justify-center items-center card-3d-container"
                    style={{ 
                      transformStyle: "preserve-3d",
                      minHeight: "380px",
                      perspectiveOrigin: "center"
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Card3D
                        card={card}
                        size="md"
                        showPrice
                        selectable
                        onClick={() => setBuyCard(card)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Seller: {card.ownerUsername || card.ownerName || "FantasyFC"}
                      </p>
                    </div>
                  </div>
                ))}
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
              <div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 preserve-3d"
                style={{ transformStyle: "preserve-3d" }}
              >
                {myListedCards.map((card) => (
                  <div 
                    key={card.id} 
                    className="flex justify-center items-center card-3d-container relative"
                    style={{ 
                      transformStyle: "preserve-3d",
                      minHeight: "380px",
                      perspectiveOrigin: "center"
                    }}
                  >
                    <Card3D
                      card={card}
                      size="md"
                      showPrice
                    />
                  </div>
                ))}
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
      <Dialog open={!!buyCard} onOpenChange={() => setBuyCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to buy <strong>{buyCard?.player?.name}</strong> for N${buyCard?.price}?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Seller: {buyCard?.ownerUsername || buyCard?.ownerName || "FantasyFC"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Your Balance: N${wallet?.balance || 0}</p>
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

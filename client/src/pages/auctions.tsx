import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Card3D from "@/components/Card3D";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Gavel, Zap, TrendingUp } from "lucide-react";

export default function AuctionsPage() {
  const queryClient = useQueryClient();
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [showBidDialog, setShowBidDialog] = useState(false);

  // Fetch active auctions
  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ["/api/auctions/active"],
    queryFn: async () => {
      const res = await fetch("/api/auctions/active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch auctions");
      return res.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds for live updates
  });

  // Place bid mutation
  const bidMutation = useMutation({
    mutationFn: async ({ auctionId, amount }: { auctionId: number; amount: number }) => {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to place bid");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/active"] });
      setShowBidDialog(false);
      setBidAmount("");
      setSelectedAuction(null);
    },
  });

  // Buy now mutation
  const buyNowMutation = useMutation({
    mutationFn: async (auctionId: number) => {
      const res = await fetch(`/api/auctions/${auctionId}/buy-now`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to buy now");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/active"] });
    },
  });

  const formatTimeRemaining = (endsAt: string) => {
    const end = new Date(endsAt).getTime();
    const now = Date.now();
    const remaining = end - now;

    if (remaining <= 0) return "Ended";

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const handlePlaceBid = (auction: any) => {
    setSelectedAuction(auction);
    const minBid = auction.currentBid + (auction.minIncrement || 1);
    setBidAmount(minBid.toString());
    setShowBidDialog(true);
  };

  const handleSubmitBid = () => {
    if (!selectedAuction) return;
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) return;

    bidMutation.mutate({ auctionId: selectedAuction.id, amount });
  };

  const handleBuyNow = (auctionId: number) => {
    if (confirm("Are you sure you want to buy this card now?")) {
      buyNowMutation.mutate(auctionId);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading auctions...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gavel className="h-8 w-8" />
            Live Auctions
          </h1>
          <p className="text-muted-foreground mt-2">
            Bid on rare player cards and win them at the best price
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Updates every 5s</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Auctions</CardDescription>
            <CardTitle className="text-3xl">{auctions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Bids</CardDescription>
            <CardTitle className="text-3xl">
              {auctions.reduce((sum: number, a: any) => sum + (a.bidCount || 0), 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ending Soon</CardDescription>
            <CardTitle className="text-3xl">
              {auctions.filter((a: any) => {
                const remaining = new Date(a.endsAt).getTime() - Date.now();
                return remaining > 0 && remaining < 3600000; // Less than 1 hour
              }).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Auctions Grid */}
      {auctions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gavel className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">No active auctions at the moment</p>
            <p className="text-sm text-muted-foreground mt-2">Check back later for new listings!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {auctions.map((auction: any) => {
            const timeRemaining = formatTimeRemaining(auction.endsAt);
            const isEndingSoon = timeRemaining.includes("h") && !timeRemaining.includes("d");

            return (
              <Card key={auction.id} className="relative overflow-hidden">
                {isEndingSoon && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="destructive" className="animate-pulse">
                      <Clock className="h-3 w-3 mr-1" />
                      Ending Soon
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {auction.card?.player?.name || "Unknown Player"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {timeRemaining}
                      </CardDescription>
                    </div>
                    <Badge variant={auction.card?.rarity === "legendary" ? "default" : "secondary"}>
                      {auction.card?.rarity || "common"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Card Preview */}
                  <div className="flex justify-center">
                    <div className="w-48">
                      <Card3D card={auction.card} />
                    </div>
                  </div>

                  {/* Bid Info */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current Bid</span>
                      <span className="font-bold text-lg">N${auction.currentBid.toFixed(2)}</span>
                    </div>
                    {auction.bidCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Bids</span>
                        <span className="font-medium flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {auction.bidCount}
                        </span>
                      </div>
                    )}
                    {auction.buyNowPrice && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Buy Now Price</span>
                        <span className="font-medium">N${auction.buyNowPrice.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handlePlaceBid(auction)}
                      className="flex-1"
                      variant="default"
                    >
                      <Gavel className="h-4 w-4 mr-2" />
                      Place Bid
                    </Button>
                    {auction.buyNowPrice && (
                      <Button
                        onClick={() => handleBuyNow(auction.id)}
                        variant="secondary"
                        className="flex-1"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Buy Now
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bid Dialog */}
      <Dialog open={showBidDialog} onOpenChange={setShowBidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Bid</DialogTitle>
            <DialogDescription>
              Enter your bid amount for {selectedAuction?.card?.player?.name || "this card"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Bid</Label>
              <div className="text-2xl font-bold">N${selectedAuction?.currentBid.toFixed(2)}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bidAmount">Your Bid</Label>
              <Input
                id="bidAmount"
                type="number"
                min={selectedAuction?.currentBid + (selectedAuction?.minIncrement || 1)}
                step={selectedAuction?.minIncrement || 1}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="Enter bid amount"
              />
              <p className="text-xs text-muted-foreground">
                Minimum bid: N$
                {(selectedAuction?.currentBid + (selectedAuction?.minIncrement || 1)).toFixed(2)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBidDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitBid}
              disabled={bidMutation.isPending}
            >
              {bidMutation.isPending ? "Placing Bid..." : "Place Bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

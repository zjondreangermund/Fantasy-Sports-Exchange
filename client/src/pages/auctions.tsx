import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Metal3DCard from "../components/Metal3DCard";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Clock, Gavel, Zap, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function AuctionsPage() {
  const queryClient = useQueryClient();
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [selectedPackAuction, setSelectedPackAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [showBidDialog, setShowBidDialog] = useState(false);
  const [showPackBidDialog, setShowPackBidDialog] = useState(false);
  const [showCreatePackDialog, setShowCreatePackDialog] = useState(false);
  const [packRarity, setPackRarity] = useState("rare");
  const [packStartPrice, setPackStartPrice] = useState("100");
  const [packBuyNow, setPackBuyNow] = useState("0");

  const { data: adminCheck, isLoading: isAdminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      const res = await fetch("/api/admin/check", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to verify admin access");
      return res.json();
    },
  });

  // Fetch active auctions
  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ["/api/auctions/active"],
    queryFn: async () => {
      const res = await fetch("/api/auctions/active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch auctions");
      return res.json();
    },
    enabled: adminCheck?.isAdmin === true,
    refetchInterval: 5000, // Auto-refresh every 5 seconds for live updates
  });

  const { data: packAuctions = [] } = useQuery({
    queryKey: ["/api/auctions/packs/active"],
    queryFn: async () => {
      const res = await fetch("/api/auctions/packs/active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pack auctions");
      return res.json();
    },
    enabled: adminCheck?.isAdmin === true,
    refetchInterval: 5000,
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

  const createPackAuctionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        rarity: packRarity,
        startPrice: Number(packStartPrice || 0),
        buyNowPrice: Number(packBuyNow || 0) > 0 ? Number(packBuyNow) : null,
      };
      const res = await fetch("/api/auctions/packs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create pack auction");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/packs/active"] });
      setShowCreatePackDialog(false);
    },
  });

  const packBidMutation = useMutation({
    mutationFn: async ({ auctionId, amount }: { auctionId: number; amount: number }) => {
      const res = await fetch(`/api/auctions/packs/${auctionId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to place pack bid");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/packs/active"] });
      setShowPackBidDialog(false);
      setSelectedPackAuction(null);
      setBidAmount("");
    },
  });

  const packBuyNowMutation = useMutation({
    mutationFn: async (auctionId: number) => {
      const res = await fetch(`/api/auctions/packs/${auctionId}/buy-now`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to buy pack");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/packs/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
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

  const handlePlacePackBid = (auction: any) => {
    setSelectedPackAuction(auction);
    const minBid = Number(auction.currentBid || 0) + Number(auction.minIncrement || 1);
    setBidAmount(minBid.toString());
    setShowPackBidDialog(true);
  };

  const handleSubmitPackBid = () => {
    if (!selectedPackAuction) return;
    const amount = Number(bidAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    packBidMutation.mutate({ auctionId: Number(selectedPackAuction.id), amount });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading auctions...</div>
      </div>
    );
  }

  if (isAdminLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Checking admin access...</div>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Auctions Are Admin-Only</CardTitle>
            <CardDescription>
              Pack release auctions are managed by admins only.
            </CardDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/account">
                <Button variant="outline" size="sm">Open Account</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">Go to Dashboard</Button>
              </Link>
            </div>
          </CardHeader>
        </Card>
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
          <Link href="/admin">
            <Button variant="outline" size="sm">Back to Admin</Button>
          </Link>
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Updates every 5s</span>
          <Button variant="outline" size="sm" onClick={() => setShowCreatePackDialog(true)}>
            Create Pack Auction
          </Button>
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
                      <Metal3DCard player={toFantasyCardData(auction.card)} className="!w-full" />
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

      <div className="pt-4 border-t">
        <h2 className="text-2xl font-bold mb-2">Pack Auctions</h2>
        <p className="text-muted-foreground mb-4">5-card rarity packs with live bidding and countdown timers.</p>
        {packAuctions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No live pack auctions yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packAuctions.map((auction: any) => (
              <Card key={`pack-${auction.id}`} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg capitalize">{auction.rarity} Pack</CardTitle>
                    <Badge>{formatTimeRemaining(auction.endsAt)}</Badge>
                  </div>
                  <CardDescription>
                    {auction.bidCount || 0} bids • Current: N${Number(auction.currentBid || 0).toFixed(2)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-5 gap-2">
                    {(Array.isArray(auction.cards) ? auction.cards : []).slice(0, 5).map((card: any) => (
                      <div key={card.id} className="text-center">
                        <div className="text-[10px] truncate text-muted-foreground">{card?.player?.position || "-"}</div>
                        <div className="text-[11px] font-semibold truncate">{card?.player?.name || "Player"}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => handlePlacePackBid(auction)}>
                      <Gavel className="h-4 w-4 mr-1" /> Bid
                    </Button>
                    {auction.buyNowPrice ? (
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => packBuyNowMutation.mutate(Number(auction.id))}
                      >
                        <Zap className="h-4 w-4 mr-1" /> Buy Now
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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

      <Dialog open={showPackBidDialog} onOpenChange={setShowPackBidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Pack Bid</DialogTitle>
            <DialogDescription>
              Bid on this {selectedPackAuction?.rarity || ""} pack auction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="packBidAmount">Your Bid</Label>
            <Input
              id="packBidAmount"
              type="number"
              value={bidAmount}
              min={Number(selectedPackAuction?.currentBid || 0) + Number(selectedPackAuction?.minIncrement || 1)}
              onChange={(e) => setBidAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackBidDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitPackBid} disabled={packBidMutation.isPending}>
              {packBidMutation.isPending ? "Placing..." : "Place Bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatePackDialog} onOpenChange={setShowCreatePackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Pack Auction</DialogTitle>
            <DialogDescription>
              Creates a 5-card auction pack from your available cards of one rarity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="packRarity">Rarity</Label>
              <select
                id="packRarity"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={packRarity}
                onChange={(e) => setPackRarity(e.target.value)}
              >
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
                <option value="unique">Unique</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="packStartPrice">Start Price</Label>
              <Input id="packStartPrice" type="number" value={packStartPrice} onChange={(e) => setPackStartPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="packBuyNow">Buy Now Price (optional)</Label>
              <Input id="packBuyNow" type="number" value={packBuyNow} onChange={(e) => setPackBuyNow(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePackDialog(false)}>Cancel</Button>
            <Button onClick={() => createPackAuctionMutation.mutate()} disabled={createPackAuctionMutation.isPending}>
              {createPackAuctionMutation.isPending ? "Creating..." : "Create Pack Auction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

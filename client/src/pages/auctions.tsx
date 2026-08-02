import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Clock,
  Eye,
  Gavel,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";

const DURATION_OPTIONS = [1, 3, 6, 12, 24, 48, 72, 168];

type RarityKey = "common" | "rare" | "unique" | "epic" | "legendary";

const RARITY_THEME: Record<RarityKey, {
  border: string;
  gradient: string;
  glow: string;
  badge: string;
  text: string;
  button: string;
  soft: string;
}> = {
  common: {
    border: "border-slate-300/35",
    gradient: "from-slate-400/18 via-slate-600/5 to-transparent",
    glow: "shadow-[0_0_34px_rgba(148,163,184,.14)]",
    badge: "border-slate-300/35 bg-slate-400/15 text-slate-100",
    text: "text-slate-200",
    button: "bg-slate-200 text-slate-950 hover:bg-white",
    soft: "border-slate-300/20 bg-slate-400/10",
  },
  rare: {
    border: "border-blue-400/45",
    gradient: "from-blue-500/25 via-cyan-500/8 to-transparent",
    glow: "shadow-[0_0_38px_rgba(59,130,246,.22)]",
    badge: "border-blue-300/45 bg-blue-500/20 text-blue-100",
    text: "text-blue-200",
    button: "bg-blue-500 text-white hover:bg-blue-400",
    soft: "border-blue-400/25 bg-blue-500/10",
  },
  unique: {
    border: "border-pink-400/45",
    gradient: "from-pink-500/25 via-fuchsia-500/8 to-transparent",
    glow: "shadow-[0_0_38px_rgba(236,72,153,.22)]",
    badge: "border-pink-300/45 bg-pink-500/20 text-pink-100",
    text: "text-pink-200",
    button: "bg-pink-500 text-white hover:bg-pink-400",
    soft: "border-pink-400/25 bg-pink-500/10",
  },
  epic: {
    border: "border-violet-400/45",
    gradient: "from-violet-500/25 via-purple-500/8 to-transparent",
    glow: "shadow-[0_0_38px_rgba(139,92,246,.24)]",
    badge: "border-violet-300/45 bg-violet-500/20 text-violet-100",
    text: "text-violet-200",
    button: "bg-violet-500 text-white hover:bg-violet-400",
    soft: "border-violet-400/25 bg-violet-500/10",
  },
  legendary: {
    border: "border-amber-300/55",
    gradient: "from-amber-400/28 via-yellow-500/8 to-transparent",
    glow: "shadow-[0_0_42px_rgba(251,191,36,.25)]",
    badge: "border-amber-300/55 bg-amber-400/20 text-amber-100",
    text: "text-amber-200",
    button: "bg-amber-400 text-slate-950 hover:bg-amber-300",
    soft: "border-amber-300/30 bg-amber-400/10",
  },
};

function rarityKey(value: unknown): RarityKey {
  const rarity = String(value || "common").toLowerCase();
  if (rarity === "rare" || rarity === "unique" || rarity === "epic" || rarity === "legendary") {
    return rarity;
  }
  return "common";
}

function rarityTheme(value: unknown) {
  return RARITY_THEME[rarityKey(value)];
}

async function responseError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return new Error(body?.message || fallback);
  } catch {
    return new Error(fallback);
  }
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return `N$${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function cardsInPack(auction: any): any[] {
  return Array.isArray(auction?.cards) ? auction.cards.slice(0, 5) : [];
}

export default function AuctionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [selectedPackAuction, setSelectedPackAuction] = useState<any>(null);
  const [viewingPackAuction, setViewingPackAuction] = useState<any>(null);
  const [editingPackAuction, setEditingPackAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [showBidDialog, setShowBidDialog] = useState(false);
  const [showPackBidDialog, setShowPackBidDialog] = useState(false);
  const [showCreatePackDialog, setShowCreatePackDialog] = useState(false);
  const [showEditPackDialog, setShowEditPackDialog] = useState(false);

  const [packRarity, setPackRarity] = useState("rare");
  const [packStartPrice, setPackStartPrice] = useState("100");
  const [packBuyNow, setPackBuyNow] = useState("0");
  const [packMinIncrement, setPackMinIncrement] = useState("10");
  const [packDurationHours, setPackDurationHours] = useState("24");

  const [editDurationHours, setEditDurationHours] = useState("24");
  const [editStartPrice, setEditStartPrice] = useState("100");
  const [editBuyNow, setEditBuyNow] = useState("0");
  const [editMinIncrement, setEditMinIncrement] = useState("10");

  const { data: adminCheck, isLoading: isAdminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      const res = await fetch("/api/admin/check", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to verify admin access");
      return res.json();
    },
  });

  const { data: auctions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/auctions/active"],
    queryFn: async () => {
      const res = await fetch("/api/auctions/active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch auctions");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: packAuctions = [], isLoading: packLoading } = useQuery<any[]>({
    queryKey: ["/api/auctions/packs/active"],
    queryFn: async () => {
      const res = await fetch("/api/auctions/packs/active", { credentials: "include" });
      if (!res.ok) throw await responseError(res, "Failed to fetch pack auctions");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const bidMutation = useMutation({
    mutationFn: async ({ auctionId, amount }: { auctionId: number; amount: number }) => {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw await responseError(res, "Failed to place bid");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/active"] });
      setShowBidDialog(false);
      setBidAmount("");
      setSelectedAuction(null);
      toast({ title: "Bid placed" });
    },
    onError: (error: any) => {
      toast({
        title: "Bid failed",
        description: error?.message || "Could not place bid.",
        variant: "destructive",
      });
    },
  });

  const buyNowMutation = useMutation({
    mutationFn: async (auctionId: number) => {
      const res = await fetch(`/api/auctions/${auctionId}/buy-now`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw await responseError(res, "Failed to buy now");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({ title: "Purchase complete" });
    },
    onError: (error: any) => {
      toast({
        title: "Buy now failed",
        description: error?.message || "Could not complete purchase.",
        variant: "destructive",
      });
    },
  });

  const createPackAuctionMutation = useMutation({
    mutationFn: async () => {
      const durationHours = Number(packDurationHours || 24);
      const payload = {
        rarity: packRarity,
        startPrice: Number(packStartPrice || 0),
        buyNowPrice: Number(packBuyNow || 0) > 0 ? Number(packBuyNow) : null,
        minIncrement: Number(packMinIncrement || 1),
        endsAt: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
      };
      const res = await fetch("/api/auctions/packs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw await responseError(res, "Failed to create pack auction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/packs/active"] });
      setShowCreatePackDialog(false);
      toast({ title: "Pack auction created" });
    },
    onError: (error: any) => {
      toast({
        title: "Pack auction not created",
        description: error?.message || "Could not create pack auction.",
        variant: "destructive",
      });
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
      if (!res.ok) throw await responseError(res, "Failed to place pack bid");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/packs/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setShowPackBidDialog(false);
      setSelectedPackAuction(null);
      setBidAmount("");
      toast({ title: "Pack bid placed" });
    },
    onError: (error: any) => {
      toast({
        title: "Pack bid failed",
        description: error?.message || "Could not place pack bid.",
        variant: "destructive",
      });
    },
  });

  const packBuyNowMutation = useMutation({
    mutationFn: async (auctionId: number) => {
      const res = await fetch(`/api/auctions/packs/${auctionId}/buy-now`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw await responseError(res, "Failed to buy pack");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/packs/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setViewingPackAuction(null);
      toast({ title: "Pack purchased" });
    },
    onError: (error: any) => {
      toast({
        title: "Pack purchase failed",
        description: error?.message || "Could not buy pack.",
        variant: "destructive",
      });
    },
  });

  const updatePackMutation = useMutation({
    mutationFn: async () => {
      if (!editingPackAuction) throw new Error("Choose a pack auction");
      const hasBids = Number(editingPackAuction.bidCount || 0) > 0;
      const payload: Record<string, any> = {
        durationHours: Number(editDurationHours || 0),
      };
      if (!hasBids) {
        payload.startPrice = Number(editStartPrice || 0);
        payload.buyNowPrice = Number(editBuyNow || 0) > 0 ? Number(editBuyNow) : null;
        payload.minIncrement = Number(editMinIncrement || 1);
      }
      const res = await fetch(`/api/admin/auctions/packs/${Number(editingPackAuction.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw await responseError(res, "Failed to update pack auction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/packs/active"] });
      setShowEditPackDialog(false);
      setEditingPackAuction(null);
      toast({ title: "Auction updated", description: "The new duration is now active." });
    },
    onError: (error: any) => {
      toast({
        title: "Auction not updated",
        description: error?.message || "Could not update auction.",
        variant: "destructive",
      });
    },
  });

  const deletePackMutation = useMutation({
    mutationFn: async (auctionId: number) => {
      const res = await fetch(`/api/admin/auctions/packs/${auctionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: "Removed from the auction screen by administrator" }),
      });
      if (!res.ok) throw await responseError(res, "Failed to delete pack auction");
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions/packs/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setViewingPackAuction(null);
      toast({
        title: "Auction deleted",
        description: result?.refundedBids
          ? `${result.refundedBids} held bid(s) were safely refunded.`
          : "The auction was removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Auction not deleted",
        description: error?.message || "Could not delete auction.",
        variant: "destructive",
      });
    },
  });

  const formatTimeRemaining = (endsAt: string) => {
    const remaining = new Date(endsAt).getTime() - Date.now();
    if (remaining <= 0) return "Ended";
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${minutes}m`;
  };

  const handlePlaceBid = (auction: any) => {
    setSelectedAuction(auction);
    const currentBid = Number(auction.currentBid || 0);
    const minIncrement = Number(auction.minIncrement || 1);
    const minBid = Number(auction.bidCount || 0) > 0
      ? currentBid + minIncrement
      : Number(auction.startPrice || currentBid);
    setBidAmount(minBid.toString());
    setShowBidDialog(true);
  };

  const handlePlacePackBid = (auction: any) => {
    setSelectedPackAuction(auction);
    const currentBid = Number(auction.currentBid || 0);
    const minIncrement = Number(auction.minIncrement || 1);
    const minBid = Number(auction.bidCount || 0) > 0
      ? currentBid + minIncrement
      : Number(auction.startPrice || currentBid);
    setBidAmount(minBid.toString());
    setShowPackBidDialog(true);
  };

  const openPackBidFromPreview = (auction: any) => {
    setViewingPackAuction(null);
    handlePlacePackBid(auction);
  };

  const openEditPack = (auction: any) => {
    setEditingPackAuction(auction);
    setEditDurationHours("24");
    setEditStartPrice(String(Number(auction.startPrice || 0)));
    setEditBuyNow(String(Number(auction.buyNowPrice || 0)));
    setEditMinIncrement(String(Number(auction.minIncrement || 1)));
    setShowEditPackDialog(true);
  };

  const deletePack = (auction: any) => {
    const bidCount = Number(auction.bidCount || 0);
    const warning = bidCount > 0
      ? `Delete this auction? ${bidCount} held bid(s) will be refunded automatically.`
      : "Delete this auction? The five cards will be unlocked and returned to the seller.";
    if (window.confirm(warning)) deletePackMutation.mutate(Number(auction.id));
  };

  if (isLoading || packLoading || isAdminLoading) {
    return <div className="container mx-auto py-12 text-center">Loading auctions...</div>;
  }

  const totalBids = auctions.reduce(
    (sum, auction) => sum + Number(auction.bidCount || 0),
    0,
  ) + packAuctions.reduce(
    (sum, auction) => sum + Number(auction.bidCount || 0),
    0,
  );
  const endingSoon = [...auctions, ...packAuctions].filter((auction) => {
    const remaining = new Date(auction.endsAt).getTime() - Date.now();
    return remaining > 0 && remaining < 3600000;
  }).length;

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Gavel className="h-8 w-8" /> Live Auctions
          </h1>
          <p className="mt-2 text-muted-foreground">
            Bid on player cards and open five-card rarity packs to inspect every card.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Updates every 5 seconds</span>
          {adminCheck?.isAdmin ? (
            <>
              <Link href="/admin">
                <Button variant="outline" size="sm">Back to Admin</Button>
              </Link>
              <Button size="sm" onClick={() => setShowCreatePackDialog(true)}>
                <Plus className="mr-1 h-4 w-4" /> Create Pack Auction
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Auctions</CardDescription>
            <CardTitle className="text-3xl">{auctions.length + packAuctions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Bids</CardDescription>
            <CardTitle className="text-3xl">{totalBids}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ending Soon</CardDescription>
            <CardTitle className="text-3xl">{endingSoon}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section>
        <h2 className="mb-2 text-2xl font-bold">Player Card Auctions</h2>
        <p className="mb-4 text-muted-foreground">
          Every auction carries the colour of its card rarity.
        </p>
        {auctions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Gavel className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No individual card auctions are live.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {auctions.map((auction) => {
              const timeRemaining = formatTimeRemaining(auction.endsAt);
              const rarity = rarityKey(auction.card?.rarity || auction.rarity);
              const theme = rarityTheme(rarity);
              return (
                <Card
                  key={auction.id}
                  className={`relative overflow-hidden border ${theme.border} ${theme.glow}`}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />
                  {timeRemaining !== "Ended" && !timeRemaining.includes("d") ? (
                    <Badge
                      variant="destructive"
                      className="absolute right-2 top-2 z-20"
                    >
                      <Clock className="mr-1 h-3 w-3" /> Ending Soon
                    </Badge>
                  ) : null}
                  <CardHeader className="relative z-10 pb-4">
                    <div className="flex items-start justify-between gap-3 pr-24">
                      <div>
                        <CardTitle className="text-lg">
                          {auction.card?.player?.name || "Unknown Player"}
                        </CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {timeRemaining}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className={`capitalize ${theme.badge}`}
                      >
                        {rarity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4">
                    <div className="flex justify-center">
                      <div className="w-48">
                        <Metal3DCard
                          player={toFantasyCardData(auction.card)}
                          className="!w-full"
                        />
                      </div>
                    </div>
                    <div className={`space-y-2 rounded-xl border p-3 ${theme.soft}`}>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current Bid</span>
                        <span className={`text-lg font-bold ${theme.text}`}>
                          {money(auction.currentBid)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Bids</span>
                        <span className="flex items-center gap-1 font-medium">
                          <TrendingUp className="h-3 w-3" />
                          {Number(auction.bidCount || 0)}
                        </span>
                      </div>
                      {auction.buyNowPrice ? (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Buy Now</span>
                          <span className="font-medium">{money(auction.buyNowPrice)}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handlePlaceBid(auction)}
                        className={`flex-1 ${theme.button}`}
                      >
                        <Gavel className="mr-2 h-4 w-4" /> Place Bid
                      </Button>
                      {auction.buyNowPrice ? (
                        <Button
                          onClick={() => window.confirm("Buy this card now?")
                            && buyNowMutation.mutate(Number(auction.id))}
                          variant="secondary"
                          className="flex-1"
                        >
                          <Zap className="mr-2 h-4 w-4" /> Buy Now
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-t pt-6">
        <h2 className="mb-2 text-2xl font-bold">Pack Auctions</h2>
        <p className="mb-4 text-muted-foreground">
          Open any pack to see all five cards before bidding or buying.
        </p>
        {packAuctions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No live pack auctions yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {packAuctions.map((auction) => {
              const rarity = rarityKey(auction.rarity);
              const theme = rarityTheme(rarity);
              const cards = cardsInPack(auction);
              return (
                <Card
                  key={`pack-${auction.id}`}
                  className={`relative overflow-hidden border ${theme.border} ${theme.glow}`}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />
                  <CardHeader className="relative z-10 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Badge
                          variant="outline"
                          className={`mb-2 capitalize ${theme.badge}`}
                        >
                          {rarity}
                        </Badge>
                        <CardTitle className={`text-xl capitalize ${theme.text}`}>
                          {rarity} Pack
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className={theme.badge}>
                        <Clock className="mr-1 h-3 w-3" />
                        {formatTimeRemaining(auction.endsAt)}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2">
                      {Number(auction.bidCount || 0)} bids • Current: {money(auction.currentBid)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4">
                    <button
                      type="button"
                      onClick={() => setViewingPackAuction(auction)}
                      className={`group grid w-full grid-cols-5 gap-2 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${theme.soft}`}
                      aria-label={`Open ${rarity} pack and view its cards`}
                    >
                      {cards.map((card: any) => {
                        const fantasy = toFantasyCardData(card, { imageWidth: 160 });
                        return (
                          <div key={card.id} className="min-w-0 text-center">
                            <div className="mx-auto mb-1 h-12 w-12 overflow-hidden rounded-xl border border-white/15 bg-black/30">
                              <img
                                src={fantasy.image}
                                alt={fantasy.name}
                                className="h-full w-full object-cover transition group-hover:scale-105"
                              />
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {card?.player?.position || "-"}
                            </div>
                            <div className="truncate text-[11px] font-semibold">
                              {card?.player?.name || "Player"}
                            </div>
                          </div>
                        );
                      })}
                    </button>

                    <Button
                      variant="outline"
                      className={`w-full ${theme.badge}`}
                      onClick={() => setViewingPackAuction(auction)}
                    >
                      <Eye className="mr-2 h-4 w-4" /> Open Pack & View Cards
                    </Button>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={`rounded-lg border p-2 ${theme.soft}`}>
                        <p className="text-xs text-muted-foreground">Start Price</p>
                        <p className={`font-bold ${theme.text}`}>{money(auction.startPrice)}</p>
                      </div>
                      <div className={`rounded-lg border p-2 ${theme.soft}`}>
                        <p className="text-xs text-muted-foreground">Buy Now</p>
                        <p className={`font-bold ${theme.text}`}>
                          {auction.buyNowPrice ? money(auction.buyNowPrice) : "Not set"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className={`flex-1 ${theme.button}`}
                        onClick={() => handlePlacePackBid(auction)}
                      >
                        <Gavel className="mr-1 h-4 w-4" /> Bid
                      </Button>
                      {auction.buyNowPrice ? (
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => window.confirm("Buy this five-card pack now?")
                            && packBuyNowMutation.mutate(Number(auction.id))}
                        >
                          <Zap className="mr-1 h-4 w-4" /> Buy Now
                        </Button>
                      ) : null}
                    </div>

                    {adminCheck?.isAdmin ? (
                      <div className="flex gap-2 border-t border-white/10 pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditPack(auction)}
                        >
                          <Pencil className="mr-1 h-4 w-4" /> Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          disabled={deletePackMutation.isPending}
                          onClick={() => deletePack(auction)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Delete
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={Boolean(viewingPackAuction)}
        onOpenChange={(open) => !open && setViewingPackAuction(null)}
      >
        <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto border-white/10 bg-[#070b18] text-white">
          {viewingPackAuction ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`capitalize ${rarityTheme(viewingPackAuction.rarity).badge}`}
                  >
                    {rarityKey(viewingPackAuction.rarity)}
                  </Badge>
                  <DialogTitle className={rarityTheme(viewingPackAuction.rarity).text}>
                    Inside this {rarityKey(viewingPackAuction.rarity)} Pack
                  </DialogTitle>
                </div>
                <DialogDescription className="text-slate-400">
                  These are the exact five cards included in this auction pack.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
                {cardsInPack(viewingPackAuction).map((card: any, index: number) => {
                  const fantasy = toFantasyCardData(card);
                  return (
                    <div
                      key={card.id}
                      className={`rounded-2xl border p-3 ${rarityTheme(viewingPackAuction.rarity).soft}`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <Badge variant="outline">Card {index + 1}</Badge>
                        <span className="text-xs text-white/50">
                          {card?.player?.position || fantasy.position || "-"}
                        </span>
                      </div>
                      <div className="mx-auto w-full max-w-[220px]">
                        <Metal3DCard player={fantasy} className="!w-full" />
                      </div>
                      <div className="mt-3 text-center">
                        <p className="font-black">{card?.player?.name || fantasy.name || "Player"}</p>
                        <p className="text-xs text-white/50">
                          {card?.player?.team || fantasy.team || fantasy.club || "Club"}
                        </p>
                        {card?.serialId ? (
                          <p className="mt-1 text-[11px] text-white/35">#{card.serialId}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-4 ${rarityTheme(viewingPackAuction.rarity).soft}`}>
                <div>
                  <p className="text-xs text-white/45">Current Bid</p>
                  <p className={`text-lg font-black ${rarityTheme(viewingPackAuction.rarity).text}`}>
                    {money(viewingPackAuction.currentBid)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Total Bids</p>
                  <p className="text-lg font-black">{Number(viewingPackAuction.bidCount || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Buy Now</p>
                  <p className="text-lg font-black">
                    {viewingPackAuction.buyNowPrice
                      ? money(viewingPackAuction.buyNowPrice)
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Time Remaining</p>
                  <p className="text-lg font-black">
                    {formatTimeRemaining(viewingPackAuction.endsAt)}
                  </p>
                </div>
              </div>

              <DialogFooter className="mt-2 gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => setViewingPackAuction(null)}>
                  Close
                </Button>
                <Button
                  className={rarityTheme(viewingPackAuction.rarity).button}
                  onClick={() => openPackBidFromPreview(viewingPackAuction)}
                >
                  <Gavel className="mr-2 h-4 w-4" /> Place Bid
                </Button>
                {viewingPackAuction.buyNowPrice ? (
                  <Button
                    variant="secondary"
                    disabled={packBuyNowMutation.isPending}
                    onClick={() => window.confirm("Buy this exact five-card pack now?")
                      && packBuyNowMutation.mutate(Number(viewingPackAuction.id))}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    {packBuyNowMutation.isPending ? "Buying..." : "Buy Now"}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showBidDialog} onOpenChange={setShowBidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Bid</DialogTitle>
            <DialogDescription>
              Enter your bid for {selectedAuction?.card?.player?.name || "this card"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-muted-foreground">
              Current bid: <strong className="text-foreground">{money(selectedAuction?.currentBid)}</strong>
            </p>
            <Label htmlFor="bidAmount">Your Bid</Label>
            <Input
              id="bidAmount"
              type="number"
              value={bidAmount}
              onChange={(event) => setBidAmount(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBidDialog(false)}>Cancel</Button>
            <Button
              disabled={bidMutation.isPending}
              onClick={() => selectedAuction && bidMutation.mutate({
                auctionId: Number(selectedAuction.id),
                amount: Number(bidAmount),
              })}
            >
              {bidMutation.isPending ? "Placing..." : "Place Bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPackBidDialog} onOpenChange={setShowPackBidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={rarityTheme(selectedPackAuction?.rarity).text}>
              Place {rarityKey(selectedPackAuction?.rarity)} Pack Bid
            </DialogTitle>
            <DialogDescription>
              Bid on this exact five-card pack.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-muted-foreground">
              Current bid: <strong className="text-foreground">{money(selectedPackAuction?.currentBid)}</strong>
            </p>
            <Label htmlFor="packBidAmount">Your Bid</Label>
            <Input
              id="packBidAmount"
              type="number"
              value={bidAmount}
              onChange={(event) => setBidAmount(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackBidDialog(false)}>Cancel</Button>
            <Button
              className={rarityTheme(selectedPackAuction?.rarity).button}
              disabled={packBidMutation.isPending}
              onClick={() => selectedPackAuction && packBidMutation.mutate({
                auctionId: Number(selectedPackAuction.id),
                amount: Number(bidAmount),
              })}
            >
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
              Create a five-card pack from available cards of one rarity.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Field label="Rarity">
              <select
                className={`h-10 w-full rounded-md border px-3 text-sm ${rarityTheme(packRarity).badge}`}
                value={packRarity}
                onChange={(event) => setPackRarity(event.target.value)}
              >
                <option value="rare">Rare</option>
                <option value="unique">Unique</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </Field>
            <Field label="Duration">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={packDurationHours}
                onChange={(event) => setPackDurationHours(event.target.value)}
              >
                {DURATION_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours < 24
                      ? `${hours} hour${hours === 1 ? "" : "s"}`
                      : `${hours / 24} day${hours === 24 ? "" : "s"}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start Price">
              <Input
                type="number"
                value={packStartPrice}
                onChange={(event) => setPackStartPrice(event.target.value)}
              />
            </Field>
            <Field label="Minimum Increment">
              <Input
                type="number"
                value={packMinIncrement}
                onChange={(event) => setPackMinIncrement(event.target.value)}
              />
            </Field>
            <Field label="Buy Now Price (optional)" className="sm:col-span-2">
              <Input
                type="number"
                value={packBuyNow}
                onChange={(event) => setPackBuyNow(event.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePackDialog(false)}>Cancel</Button>
            <Button
              className={rarityTheme(packRarity).button}
              disabled={createPackAuctionMutation.isPending}
              onClick={() => createPackAuctionMutation.mutate()}
            >
              {createPackAuctionMutation.isPending ? "Creating..." : "Create Auction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditPackDialog} onOpenChange={setShowEditPackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pack Auction</DialogTitle>
            <DialogDescription>
              Set how much longer the auction should remain open. Prices are locked once bidding starts.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Field label="New Duration From Now" className="sm:col-span-2">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={editDurationHours}
                onChange={(event) => setEditDurationHours(event.target.value)}
              >
                {DURATION_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours < 24
                      ? `${hours} hour${hours === 1 ? "" : "s"}`
                      : `${hours / 24} day${hours === 24 ? "" : "s"}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start Price">
              <Input
                type="number"
                disabled={Number(editingPackAuction?.bidCount || 0) > 0}
                value={editStartPrice}
                onChange={(event) => setEditStartPrice(event.target.value)}
              />
            </Field>
            <Field label="Minimum Increment">
              <Input
                type="number"
                disabled={Number(editingPackAuction?.bidCount || 0) > 0}
                value={editMinIncrement}
                onChange={(event) => setEditMinIncrement(event.target.value)}
              />
            </Field>
            <Field label="Buy Now Price" className="sm:col-span-2">
              <Input
                type="number"
                disabled={Number(editingPackAuction?.bidCount || 0) > 0}
                value={editBuyNow}
                onChange={(event) => setEditBuyNow(event.target.value)}
              />
            </Field>
            {Number(editingPackAuction?.bidCount || 0) > 0 ? (
              <p className="text-sm text-amber-600 sm:col-span-2">
                This auction already has bids. Only the duration can be changed.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPackDialog(false)}>Cancel</Button>
            <Button
              disabled={updatePackMutation.isPending}
              onClick={() => updatePackMutation.mutate()}
            >
              {updatePackMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

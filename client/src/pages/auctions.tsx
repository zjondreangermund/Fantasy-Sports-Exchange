import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Clock,
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

export default function AuctionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [selectedPackAuction, setSelectedPackAuction] = useState<any>(null);
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
      toast({ title: "Bid failed", description: error?.message || "Could not place bid.", variant: "destructive" });
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
      toast({ title: "Buy now failed", description: error?.message || "Could not complete purchase.", variant: "destructive" });
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
      toast({ title: "Pack auction not created", description: error?.message || "Could not create pack auction.", variant: "destructive" });
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
      toast({ title: "Pack bid failed", description: error?.message || "Could not place pack bid.", variant: "destructive" });
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
      toast({ title: "Pack purchased" });
    },
    onError: (error: any) => {
      toast({ title: "Pack purchase failed", description: error?.message || "Could not buy pack.", variant: "destructive" });
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
      toast({ title: "Auction not updated", description: error?.message || "Could not update auction.", variant: "destructive" });
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
      toast({
        title: "Auction deleted",
        description: result?.refundedBids ? `${result.refundedBids} held bid(s) were safely refunded.` : "The auction was removed.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Auction not deleted", description: error?.message || "Could not delete auction.", variant: "destructive" });
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
    const minBid = Number(auction.currentBid || 0) + Number(auction.minIncrement || 1);
    setBidAmount(minBid.toString());
    setShowBidDialog(true);
  };

  const handlePlacePackBid = (auction: any) => {
    setSelectedPackAuction(auction);
    const minBid = Number(auction.currentBid || 0) + Number(auction.minIncrement || 1);
    setBidAmount(minBid.toString());
    setShowPackBidDialog(true);
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

  const totalBids = auctions.reduce((sum, auction) => sum + Number(auction.bidCount || 0), 0)
    + packAuctions.reduce((sum, auction) => sum + Number(auction.bidCount || 0), 0);
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
          <p className="mt-2 text-muted-foreground">Bid on player cards and five-card rarity packs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Updates every 5 seconds</span>
          {adminCheck?.isAdmin ? (
            <>
              <Link href="/admin"><Button variant="outline" size="sm">Back to Admin</Button></Link>
              <Button size="sm" onClick={() => setShowCreatePackDialog(true)}>
                <Plus className="mr-1 h-4 w-4" /> Create Pack Auction
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Active Auctions</CardDescription><CardTitle className="text-3xl">{auctions.length + packAuctions.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Bids</CardDescription><CardTitle className="text-3xl">{totalBids}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Ending Soon</CardDescription><CardTitle className="text-3xl">{endingSoon}</CardTitle></CardHeader></Card>
      </div>

      <section>
        <h2 className="mb-2 text-2xl font-bold">Player Card Auctions</h2>
        <p className="mb-4 text-muted-foreground">Bid on individual cards or use the buy-now option.</p>
        {auctions.length === 0 ? (
          <Card><CardContent className="py-10 text-center"><Gavel className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="text-muted-foreground">No individual card auctions are live.</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {auctions.map((auction) => {
              const timeRemaining = formatTimeRemaining(auction.endsAt);
              return (
                <Card key={auction.id} className="relative overflow-hidden">
                  {timeRemaining !== "Ended" && !timeRemaining.includes("d") ? <Badge variant="destructive" className="absolute right-2 top-2 z-10"><Clock className="mr-1 h-3 w-3" /> Ending Soon</Badge> : null}
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">{auction.card?.player?.name || "Unknown Player"}</CardTitle>
                    <CardDescription className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeRemaining}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-center"><div className="w-48"><Metal3DCard player={toFantasyCardData(auction.card)} className="!w-full" /></div></div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current Bid</span><span className="text-lg font-bold">{money(auction.currentBid)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Bids</span><span className="flex items-center gap-1 font-medium"><TrendingUp className="h-3 w-3" />{Number(auction.bidCount || 0)}</span></div>
                      {auction.buyNowPrice ? <div className="flex justify-between text-sm"><span className="text-muted-foreground">Buy Now</span><span className="font-medium">{money(auction.buyNowPrice)}</span></div> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handlePlaceBid(auction)} className="flex-1"><Gavel className="mr-2 h-4 w-4" /> Place Bid</Button>
                      {auction.buyNowPrice ? <Button onClick={() => window.confirm("Buy this card now?") && buyNowMutation.mutate(Number(auction.id))} variant="secondary" className="flex-1"><Zap className="mr-2 h-4 w-4" /> Buy Now</Button> : null}
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
        <p className="mb-4 text-muted-foreground">Five-card rarity packs with live bidding, editable duration and safe admin removal.</p>
        {packAuctions.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No live pack auctions yet.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {packAuctions.map((auction) => (
              <Card key={`pack-${auction.id}`} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg capitalize">{auction.rarity} Pack</CardTitle>
                    <Badge>{formatTimeRemaining(auction.endsAt)}</Badge>
                  </div>
                  <CardDescription>{Number(auction.bidCount || 0)} bids • Current: {money(auction.currentBid)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-5 gap-2 rounded-xl border bg-muted/20 p-3">
                    {(Array.isArray(auction.cards) ? auction.cards : []).slice(0, 5).map((card: any) => (
                      <div key={card.id} className="min-w-0 text-center">
                        <div className="truncate text-[10px] text-muted-foreground">{card?.player?.position || "-"}</div>
                        <div className="truncate text-[11px] font-semibold">{card?.player?.name || "Player"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">Start Price</p><p className="font-bold">{money(auction.startPrice)}</p></div>
                    <div className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">Buy Now</p><p className="font-bold">{auction.buyNowPrice ? money(auction.buyNowPrice) : "Not set"}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => handlePlacePackBid(auction)}><Gavel className="mr-1 h-4 w-4" /> Bid</Button>
                    {auction.buyNowPrice ? <Button variant="secondary" className="flex-1" onClick={() => window.confirm("Buy this five-card pack now?") && packBuyNowMutation.mutate(Number(auction.id))}><Zap className="mr-1 h-4 w-4" /> Buy Now</Button> : null}
                  </div>
                  {adminCheck?.isAdmin ? (
                    <div className="flex gap-2 border-t pt-3">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditPack(auction)}><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
                      <Button variant="destructive" size="sm" className="flex-1" disabled={deletePackMutation.isPending} onClick={() => deletePack(auction)}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={showBidDialog} onOpenChange={setShowBidDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Place Bid</DialogTitle><DialogDescription>Enter your bid for {selectedAuction?.card?.player?.name || "this card"}.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-muted-foreground">Current bid: <strong className="text-foreground">{money(selectedAuction?.currentBid)}</strong></p>
            <Label htmlFor="bidAmount">Your Bid</Label>
            <Input id="bidAmount" type="number" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowBidDialog(false)}>Cancel</Button><Button disabled={bidMutation.isPending} onClick={() => selectedAuction && bidMutation.mutate({ auctionId: Number(selectedAuction.id), amount: Number(bidAmount) })}>{bidMutation.isPending ? "Placing..." : "Place Bid"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPackBidDialog} onOpenChange={setShowPackBidDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Place Pack Bid</DialogTitle><DialogDescription>Bid on this {selectedPackAuction?.rarity || ""} five-card pack.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-muted-foreground">Current bid: <strong className="text-foreground">{money(selectedPackAuction?.currentBid)}</strong></p>
            <Label htmlFor="packBidAmount">Your Bid</Label>
            <Input id="packBidAmount" type="number" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowPackBidDialog(false)}>Cancel</Button><Button disabled={packBidMutation.isPending} onClick={() => selectedPackAuction && packBidMutation.mutate({ auctionId: Number(selectedPackAuction.id), amount: Number(bidAmount) })}>{packBidMutation.isPending ? "Placing..." : "Place Bid"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatePackDialog} onOpenChange={setShowCreatePackDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Pack Auction</DialogTitle><DialogDescription>Create a five-card pack from available cards of one rarity.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Field label="Rarity"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={packRarity} onChange={(event) => setPackRarity(event.target.value)}><option value="rare">Rare</option><option value="unique">Unique</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select></Field>
            <Field label="Duration"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={packDurationHours} onChange={(event) => setPackDurationHours(event.target.value)}>{DURATION_OPTIONS.map((hours) => <option key={hours} value={hours}>{hours < 24 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${hours / 24} day${hours === 24 ? "" : "s"}`}</option>)}</select></Field>
            <Field label="Start Price"><Input type="number" value={packStartPrice} onChange={(event) => setPackStartPrice(event.target.value)} /></Field>
            <Field label="Minimum Increment"><Input type="number" value={packMinIncrement} onChange={(event) => setPackMinIncrement(event.target.value)} /></Field>
            <Field label="Buy Now Price (optional)" className="sm:col-span-2"><Input type="number" value={packBuyNow} onChange={(event) => setPackBuyNow(event.target.value)} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreatePackDialog(false)}>Cancel</Button><Button disabled={createPackAuctionMutation.isPending} onClick={() => createPackAuctionMutation.mutate()}>{createPackAuctionMutation.isPending ? "Creating..." : "Create Auction"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditPackDialog} onOpenChange={setShowEditPackDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Pack Auction</DialogTitle><DialogDescription>Set how much longer the auction should remain open. Prices are locked once bidding starts.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Field label="New Duration From Now" className="sm:col-span-2"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editDurationHours} onChange={(event) => setEditDurationHours(event.target.value)}>{DURATION_OPTIONS.map((hours) => <option key={hours} value={hours}>{hours < 24 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${hours / 24} day${hours === 24 ? "" : "s"}`}</option>)}</select></Field>
            <Field label="Start Price"><Input type="number" disabled={Number(editingPackAuction?.bidCount || 0) > 0} value={editStartPrice} onChange={(event) => setEditStartPrice(event.target.value)} /></Field>
            <Field label="Minimum Increment"><Input type="number" disabled={Number(editingPackAuction?.bidCount || 0) > 0} value={editMinIncrement} onChange={(event) => setEditMinIncrement(event.target.value)} /></Field>
            <Field label="Buy Now Price" className="sm:col-span-2"><Input type="number" disabled={Number(editingPackAuction?.bidCount || 0) > 0} value={editBuyNow} onChange={(event) => setEditBuyNow(event.target.value)} /></Field>
            {Number(editingPackAuction?.bidCount || 0) > 0 ? <p className="text-sm text-amber-600 sm:col-span-2">This auction already has bids. Only the duration can be changed.</p> : null}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowEditPackDialog(false)}>Cancel</Button><Button disabled={updatePackMutation.isPending} onClick={() => updatePackMutation.mutate()}>{updatePackMutation.isPending ? "Saving..." : "Save Changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>;
}

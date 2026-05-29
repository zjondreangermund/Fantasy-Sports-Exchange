import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import CardThumbnail from "../components/CardThumbnail";
import TournamentLeaderboardMini from "../components/tournaments/TournamentLeaderboardMini";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { type Competition, type CompetitionEntry, type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";
import { Clock, Copy, Crown, DollarSign, Shield, Sparkles, Trophy, Users } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";

type EnrichedEntry = CompetitionEntry & { userName?: string; userImage?: string | null };
type CompetitionWithEntries = Competition & {
  submissionClosesAt?: string;
  entryOpen?: boolean;
  entries?: EnrichedEntry[];
  entryCount?: number;
  join_pin?: string | null;
  joinPin?: string | null;
  visibility?: string;
  max_entries?: number | null;
  maxEntries?: number | null;
  created_by_user_id?: string | null;
  createdByUserId?: string | null;
  platform_fee_total?: number;
  prize_pool_total?: number;
};

type EntryMode = "standard" | "pin";

const rarityOptions = ["common", "rare", "unique", "legendary"];

function money(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

function normalizeTier(value: unknown) {
  return String(value || "common").toLowerCase();
}

function getInviteLink(pin: string) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/join/${pin}`;
}

export default function CompetitionsPage() {
  const { toast } = useToast();
  const initialPin = typeof window !== "undefined" ? (window.location.pathname.match(/\/join\/([A-Z0-9]+)/i)?.[1] || "") : "";
  const [selectedComp, setSelectedComp] = useState<CompetitionWithEntries | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>("standard");
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [pinCode, setPinCode] = useState(initialPin.toUpperCase());
  const [pinTournament, setPinTournament] = useState<CompetitionWithEntries | null>(null);
  const [createdPin, setCreatedPin] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "Friday Friends Cup",
    tier: "common",
    entryFee: "20",
    maxEntries: "10",
    visibility: "private",
  });

  const { data: competitions, isLoading } = useQuery<CompetitionWithEntries[]>({
    queryKey: ["/api/competitions"],
    queryFn: async () => {
      const res = await fetch("/api/competitions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tournaments");
      const data = await res.json();
      return Array.isArray(data) ? data : data?.competitions || [];
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

  const { data: savedLineup } = useQuery<{ lineup: Lineup; cards: PlayerCardWithPlayer[] }>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const res = await fetch("/api/lineup", { credentials: "include" });
      if (!res.ok) return { lineup: { cardIds: [] } as Lineup, cards: [] };
      return res.json();
    },
  });

  const { data: myEntries } = useQuery<CompetitionEntry[]>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const res = await fetch("/api/competitions/my-entries", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const liveComps = useMemo(() => (Array.isArray(competitions) ? competitions : []).filter((c) => c.status === "open" || c.status === "active"), [competitions]);
  const upcomingComps = useMemo(() => (Array.isArray(competitions) ? competitions : []).filter((c) => c.status === "upcoming"), [competitions]);
  const completedComps = useMemo(() => (Array.isArray(competitions) ? competitions : []).filter((c) => c.status === "completed"), [competitions]);
  const myEntryByCompetitionId = useMemo(() => new Map((Array.isArray(myEntries) ? myEntries : []).map((entry) => [entry.competitionId, entry] as const)), [myEntries]);
  const myLiveComps = liveComps.filter((comp) => myEntryByCompetitionId.has(comp.id));
  const enteredCompetitionIds = new Set((Array.isArray(myEntries) ? myEntries : []).map((entry) => entry.competitionId));
  const myCommonCards = (Array.isArray(myCards) ? myCards : []).filter((card) => normalizeTier(card.rarity) === "common" && !card.forSale);

  const requiredTier = normalizeTier(selectedComp?.tier);
  const availableCards = (Array.isArray(myCards) ? myCards : [])
    .filter((card) => card && !card.forSale)
    .filter((card) => !selectedComp || normalizeTier(card.rarity) === requiredTier);

  const selectedCardObjects = availableCards.filter((card) => selectedCards.includes(card.id));
  const positionCounts: Record<string, number> = {};
  selectedCardObjects.forEach((card) => {
    const pos = card.player?.position || "";
    positionCounts[pos] = (positionCounts[pos] || 0) + 1;
  });
  const hasGK = (positionCounts.GK || 0) >= 1;
  const hasDEF = (positionCounts.DEF || 0) >= 1;
  const hasMID = (positionCounts.MID || 0) >= 1;
  const hasFWD = (positionCounts.FWD || 0) >= 1;
  const lineupValid = selectedCards.length === 5 && hasGK && hasDEF && hasMID && hasFWD;

  const cardIdsForTier = (ids: unknown, tier: string) => {
    const sourceIds = Array.isArray(ids) ? ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)) : [];
    const allowed = new Set((Array.isArray(myCards) ? myCards : [])
      .filter((card) => !card.forSale && normalizeTier(card.rarity) === normalizeTier(tier))
      .map((card) => card.id));
    return sourceIds.filter((id) => allowed.has(id)).slice(0, 5);
  };

  const previousEntryForTier = (tier: string, excludeCompetitionId?: number) => [...(Array.isArray(myEntries) ? myEntries : [])]
    .filter((entry) => entry.competitionId !== excludeCompetitionId && Array.isArray(entry.lineupCardIds) && entry.lineupCardIds.length > 0)
    .sort((a: any, b: any) => new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime())
    .find((entry) => cardIdsForTier(entry.lineupCardIds, tier).length === 5);

  const previousEntry = selectedComp ? previousEntryForTier(selectedComp.tier, selectedComp.id) : undefined;
  const previousLineupIds = cardIdsForTier(previousEntry?.lineupCardIds, selectedComp?.tier || "");
  const savedLineupIds = cardIdsForTier(savedLineup?.lineup?.cardIds, selectedComp?.tier || "");

  const applyLineupPreset = (ids: unknown, label: string) => {
    if (!selectedComp) return;
    const validIds = cardIdsForTier(ids, selectedComp.tier);
    if (validIds.length !== 5) {
      toast({ title: `${label} not available`, description: `You need 5 available ${selectedComp.tier} cards.`, variant: "destructive" });
      return;
    }
    setSelectedCards(validIds);
    setCaptainId(validIds[0]);
    toast({ title: `${label} applied`, description: "Review your captain before entering." });
  };

  const openCompetitionAction = (comp: CompetitionWithEntries, mode: EntryMode = "standard") => {
    if (comp.status !== "open") {
      toast({ title: "Tournament unavailable", description: "This tournament is not open for new entries." });
      return;
    }
    if (comp.entryOpen === false) {
      toast({ title: "Submission closed", description: "This gameweek is locked because kickoff has started." });
      return;
    }
    setSelectedComp(comp);
    setEntryMode(mode);
    const savedIds = cardIdsForTier(savedLineup?.lineup?.cardIds, comp.tier);
    const previousEntry = previousEntryForTier(comp.tier, comp.id);
    const previousIds = cardIdsForTier(previousEntry?.lineupCardIds, comp.tier);
    const startingIds = savedIds.length === 5 ? savedIds : previousIds;
    setSelectedCards(startingIds);
    setCaptainId(startingIds[0] || null);
  };

  const toggleCard = (cardId: number) => {
    setSelectedCards((prev) => {
      if (prev.includes(cardId)) {
        const remaining = prev.filter((id) => id !== cardId);
        if (captainId === cardId) setCaptainId(remaining[0] || null);
        return remaining;
      }
      if (prev.length >= 5) return prev;
      const next = [...prev, cardId];
      if (!captainId) setCaptainId(cardId);
      return next;
    });
  };

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!selectedComp || !captainId) throw new Error("Select a tournament and captain");
      const payload = { competitionId: selectedComp.id, cardIds: selectedCards, captainId };
      if (entryMode === "pin") {
        const res = await apiRequest("POST", "/api/user-tournaments/join-pin", { pin: selectedComp.join_pin || selectedComp.joinPin || pinCode, cardIds: selectedCards, captainId });
        return res.json();
      }
      const res = await apiRequest("POST", "/api/competitions/join", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions/my-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setSelectedComp(null);
      setSelectedCards([]);
      setCaptainId(null);
      toast({ title: "Entered tournament!" });
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

  const createTournamentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user-tournaments/create", {
        name: createForm.name,
        tier: createForm.tier,
        entryFee: Number(createForm.entryFee || 0),
        maxEntries: Number(createForm.maxEntries || 0),
        visibility: createForm.visibility,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      const nextPin = data?.pin || data?.tournament?.join_pin || null;
      setCreatedPin(nextPin);
      toast({ title: "Tournament created", description: nextPin ? `PIN: ${nextPin}` : "Your tournament is live." });
    },
    onError: (error: any) => toast({ title: "Could not create tournament", description: error.message, variant: "destructive" }),
  });

  const findPinMutation = useMutation({
    mutationFn: async () => {
      const pin = pinCode.trim().toUpperCase();
      if (!pin) throw new Error("Enter a PIN code");
      const res = await fetch(`/api/user-tournaments/pin/${encodeURIComponent(pin)}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Tournament PIN not found");
      return data;
    },
    onSuccess: (data: any) => {
      setPinTournament(data.tournament);
      toast({ title: "Tournament found", description: data.tournament?.name || "PIN tournament loaded." });
    },
    onError: (error: any) => toast({ title: "PIN not found", description: error.message, variant: "destructive" }),
  });

  const platformFeePreview = Number(createForm.entryFee || 0) * 0.2;
  const prizePreview = Number(createForm.entryFee || 0) - platformFeePreview;
  const createdInviteLink = createdPin ? getInviteLink(createdPin) : "";
  const foundInviteLink = pinCode ? getInviteLink(pinCode.trim().toUpperCase()) : "";

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center"><Trophy className="w-5 h-5 text-primary" /></div>
              <div><h1 className="text-2xl font-bold text-foreground">Tournaments</h1><p className="text-sm text-muted-foreground">Create private PIN cups, join public tournaments, and win better cards.</p></div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              <InfoPill label="Common cards ready" value={`${myCommonCards.length}`} helper="Use commons to compete." />
              <InfoPill label="Live entries" value={`${myLiveComps.length}`} helper="Track your current runs." />
              <InfoPill label="Platform fee" value="20%" helper="Applies to all tournaments." />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-yellow-500" /><h2 className="font-semibold">Tournament Economy</h2></div>
            <div className="space-y-2 text-sm">
              <EconomyRow label="Entry fees" value="20% platform / 80% prize pool" />
              <EconomyRow label="Private tournaments" value="PIN + invite link" />
              <EconomyRow label="Lineup rule" value="5 cards: GK / DEF / MID / FWD + utility" />
            </div>
          </Card>
        </div>

        <Tabs defaultValue={initialPin ? "pin" : "live"} className="w-full">
          <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="live" className="rounded-full border px-4">🔴 Public</TabsTrigger>
            <TabsTrigger value="pin" className="rounded-full border px-4">🔐 Join by PIN</TabsTrigger>
            <TabsTrigger value="create" className="rounded-full border px-4">➕ Create</TabsTrigger>
            <TabsTrigger value="my-live" className="rounded-full border px-4">⭐ My Live</TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-full border px-4">📅 Upcoming</TabsTrigger>
            <TabsTrigger value="completed" className="rounded-full border px-4">✅ Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            {isLoading ? <LoadingGrid /> : liveComps.length > 0 ? <CompetitionGrid comps={liveComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="No public live tournaments available." />}
          </TabsContent>
          <TabsContent value="my-live">
            {myLiveComps.length > 0 ? <CompetitionGrid comps={myLiveComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="You are not currently entered in a live tournament." />}
          </TabsContent>
          <TabsContent value="upcoming">
            {isLoading ? <LoadingGrid /> : upcomingComps.length > 0 ? <CompetitionGrid comps={upcomingComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="No upcoming tournaments available." />}
          </TabsContent>
          <TabsContent value="completed">
            {isLoading ? <LoadingGrid /> : completedComps.length > 0 ? <CompetitionGrid comps={completedComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="No completed tournaments yet." />}
          </TabsContent>

          <TabsContent value="pin">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /><h2 className="font-semibold text-lg">Join a Private Tournament</h2></div>
              <p className="text-sm text-muted-foreground">Enter the PIN from your friend or competition creator. You will still pay the listed entry fee and must use the correct rarity cards.</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input className="rounded-xl border bg-background px-4 py-3 text-lg uppercase tracking-[0.25em]" placeholder="PIN CODE" value={pinCode} onChange={(e) => setPinCode(e.target.value.toUpperCase())} />
                <Button onClick={() => findPinMutation.mutate()} disabled={findPinMutation.isPending}>{findPinMutation.isPending ? "Searching..." : "Find Tournament"}</Button>
              </div>
              {pinCode && <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground break-all">Invite link: {foundInviteLink}</div>}
              {pinTournament && <Card className="p-4 border-primary/20 bg-primary/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-bold text-lg">{pinTournament.name}</h3><p className="text-sm text-muted-foreground">{pinTournament.entryCount || 0}{(pinTournament.max_entries || pinTournament.maxEntries) ? ` / ${pinTournament.max_entries || pinTournament.maxEntries}` : ""} players joined</p></div>
                  <Badge className="capitalize">{pinTournament.tier}</Badge>
                </div>
                <div className="grid sm:grid-cols-3 gap-2 my-4 text-sm"><InfoPill label="Entry" value={`N$${money(pinTournament.entryFee)}`} helper="Paid from wallet." /><InfoPill label="Platform" value={`N$${money(Number(pinTournament.entryFee || 0) * 0.2)}`} helper="20% fee." /><InfoPill label="Prize pool" value={`N$${money(Number(pinTournament.entryFee || 0) * 0.8)}`} helper="Added per entry." /></div>
                <TournamentLeaderboardMini competitionId={pinTournament.id} compact />
                <Button onClick={() => openCompetitionAction(pinTournament, "pin")}>Choose Lineup & Join</Button>
              </Card>}
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-500" /><h2 className="font-semibold text-lg">Create Tournament</h2></div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm"><span className="text-muted-foreground">Name</span><input className="w-full rounded-xl border bg-background px-3 py-2" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} /></label>
                <label className="space-y-1 text-sm"><span className="text-muted-foreground">Rarity</span><select className="w-full rounded-xl border bg-background px-3 py-2 capitalize" value={createForm.tier} onChange={(e) => setCreateForm({ ...createForm, tier: e.target.value })}>{rarityOptions.map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label>
                <label className="space-y-1 text-sm"><span className="text-muted-foreground">Entry Fee (N$)</span><input type="number" min="0" className="w-full rounded-xl border bg-background px-3 py-2" value={createForm.entryFee} onChange={(e) => setCreateForm({ ...createForm, entryFee: e.target.value })} /></label>
                <label className="space-y-1 text-sm"><span className="text-muted-foreground">Max Players</span><input type="number" min="2" className="w-full rounded-xl border bg-background px-3 py-2" value={createForm.maxEntries} onChange={(e) => setCreateForm({ ...createForm, maxEntries: e.target.value })} /></label>
                <label className="space-y-1 text-sm md:col-span-2"><span className="text-muted-foreground">Visibility</span><select className="w-full rounded-xl border bg-background px-3 py-2" value={createForm.visibility} onChange={(e) => setCreateForm({ ...createForm, visibility: e.target.value })}><option value="private">Private PIN</option><option value="public">Public</option></select></label>
              </div>
              <div className="grid sm:grid-cols-3 gap-2"><InfoPill label="Platform fee" value={`N$${money(platformFeePreview)}`} helper="20% per entry." /><InfoPill label="Prize pool" value={`N$${money(prizePreview)}`} helper="80% per entry." /><InfoPill label="Creator can enter" value="Yes" helper="Normal fee applies." /></div>
              <Button onClick={() => createTournamentMutation.mutate()} disabled={createTournamentMutation.isPending}>{createTournamentMutation.isPending ? "Creating..." : "Create Tournament"}</Button>
              {createdPin && <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm space-y-3"><div><div className="text-muted-foreground mb-1">Private tournament PIN</div><div className="flex items-center gap-2"><code className="text-2xl font-bold tracking-[0.3em]">{createdPin}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(createdPin); toast({ title: "PIN copied" }); }}><Copy className="w-4 h-4" /></Button></div></div><div><div className="text-muted-foreground mb-1">Invite link</div><div className="flex items-center gap-2"><code className="text-xs break-all rounded bg-background/70 px-2 py-1">{createdInviteLink}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(createdInviteLink); toast({ title: "Invite link copied" }); }}><Copy className="w-4 h-4" /></Button></div></div></div>}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedComp} onOpenChange={() => setSelectedComp(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>Enter {selectedComp?.name}</DialogTitle></DialogHeader>
          {selectedComp && <div className="py-4 space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">This tournament requires <span className="font-semibold text-foreground capitalize">{selectedComp.tier}</span> cards only. Pick 5 cards and set a captain.</div>
            <div className="flex flex-wrap gap-2"><Badge variant="outline">Entry: N${money(selectedComp.entryFee)}</Badge><Badge variant="outline">Platform: N${money(Number(selectedComp.entryFee || 0) * 0.2)}</Badge><Badge variant="outline">Prize pool add: N${money(Number(selectedComp.entryFee || 0) * 0.8)}</Badge></div>
            <TournamentLeaderboardMini competitionId={selectedComp.id} />
            <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => applyLineupPreset(savedLineupIds, "Saved lineup")} disabled={savedLineupIds.length !== 5}>Use Saved Lineup ({savedLineupIds.length}/5)</Button><Button variant="outline" onClick={() => applyLineupPreset(previousLineupIds, "Previous tournament lineup")} disabled={previousLineupIds.length !== 5}>Use Previous Lineup ({previousLineupIds.length}/5)</Button></div>
            <p className="text-sm text-muted-foreground">Selected: {selectedCards.length}/5. Need at least 1 GK, 1 DEF, 1 MID and 1 FWD.</p>
            {selectedCards.length > 0 && !lineupValid && <div className="flex flex-wrap gap-1">{!hasGK && <Badge variant="outline" className="text-red-400 border-red-400">Need GK</Badge>}{!hasDEF && <Badge variant="outline" className="text-red-400 border-red-400">Need DEF</Badge>}{!hasMID && <Badge variant="outline" className="text-red-400 border-red-400">Need MID</Badge>}{!hasFWD && <Badge variant="outline" className="text-red-400 border-red-400">Need FWD</Badge>}</div>}
            <div className="flex flex-wrap gap-4 justify-center max-h-96 overflow-auto preserve-3d" style={{ transformStyle: "preserve-3d" }}>{availableCards.map((card) => <div key={card.id} className="relative card-3d-container bg-transparent shadow-none p-0" style={{ transformStyle: "preserve-3d", minHeight: "300px" }}><CardThumbnail card={card} size="sm" selected={selectedCards.includes(card.id)} selectable onClick={() => toggleCard(card.id)} />{selectedCards.includes(card.id) && <button className={`absolute -top-1 -left-1 z-30 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${captainId === card.id ? "bg-yellow-500 text-black" : "bg-muted text-muted-foreground hover:bg-yellow-500 hover:text-black"}`} onClick={(e) => { e.stopPropagation(); setCaptainId(card.id); }} title="Set captain">C</button>}</div>)}</div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setSelectedComp(null)}>Cancel</Button><Button onClick={() => joinMutation.mutate()} disabled={!lineupValid || !captainId || joinMutation.isPending}>{joinMutation.isPending ? "Entering..." : selectedComp?.entryFee ? `Enter (N$${money(selectedComp.entryFee)})` : "Enter Free"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoPill({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-2xl border bg-background/70 p-3"><div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div><div className="text-lg font-bold mt-1">{value}</div><div className="text-xs text-muted-foreground mt-1">{helper}</div></div>;
}

function EconomyRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-muted-foreground">{label}</span><Badge variant="outline">{value}</Badge></div>;
}

function LoadingGrid() {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-md" />)}</div>;
}

function EmptyCard({ text }: { text: string }) {
  return <Card className="p-8 text-center"><p className="text-muted-foreground">{text}</p></Card>;
}

function CompetitionGrid({ comps, enteredIds, onJoin }: { comps: CompetitionWithEntries[]; enteredIds: Set<number>; onJoin: (comp: CompetitionWithEntries) => void }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{comps.map((comp) => <CompetitionCard key={comp.id} comp={comp} entered={enteredIds.has(comp.id)} onJoin={() => onJoin(comp)} />)}</div>;
}

function CompetitionCard({ comp, entered, onJoin }: { comp: CompetitionWithEntries; entered: boolean; onJoin: () => void }) {
  const entryCount = Number(comp.entryCount || (comp.entries || []).length || 0);
  const maxEntries = Number(comp.max_entries || comp.maxEntries || 0);
  const prizePool = Number((comp as any).prize_pool_total || 0);
  const platformFees = Number((comp as any).platform_fee_total || 0);
  return <Card className="p-5 space-y-4 border-border/70">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-lg font-bold text-foreground">{comp.name}</h3><p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="w-3 h-3" />GW {comp.gameWeek} • {comp.status}</p></div>
      <Badge className="capitalize">{comp.tier}</Badge>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <MiniStat icon={<DollarSign className="w-3 h-3" />} label="Entry" value={`N$${money(comp.entryFee)}`} />
      <MiniStat icon={<Users className="w-3 h-3" />} label="Players" value={`${entryCount}${maxEntries ? `/${maxEntries}` : ""}`} />
      <MiniStat icon={<Trophy className="w-3 h-3" />} label="Prize pool" value={`N$${money(prizePool || Number(comp.entryFee || 0) * 0.8 * entryCount)}`} />
      <MiniStat icon={<Shield className="w-3 h-3" />} label="Platform" value={`N$${money(platformFees || Number(comp.entryFee || 0) * 0.2 * entryCount)}`} />
    </div>
    {(comp.status === "open" || comp.status === "active") && <TournamentLeaderboardMini competitionId={comp.id} compact />}
    <div className="flex flex-wrap gap-2"><Badge variant="outline" className="capitalize">Prize: {comp.prizeCardRarity || comp.tier} card</Badge>{entered && <Badge variant="outline" className="border-green-500 text-green-500">Entered</Badge>}</div>
    <Button className="w-full" onClick={onJoin} disabled={entered || comp.status !== "open"}>{entered ? "Already Entered" : comp.status === "open" ? "Enter Tournament" : "Not Open"}</Button>
  </Card>;
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div><div className="font-semibold mt-1">{value}</div></div>;
}

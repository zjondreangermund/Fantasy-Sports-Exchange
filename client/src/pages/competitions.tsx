import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import CardThumbnail from "../components/CardThumbnail";
import TournamentLeaderboardMini from "../components/tournaments/TournamentLeaderboardMini";
import TournamentCreatorHub from "../components/tournaments/TournamentCreatorHub";
import { LiveHero, LivePageShell, LiveStatCard } from "../components/layout/LivePageShell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { type Competition, type CompetitionEntry, type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";
import { Clock, Copy, Crown, DollarSign, Shield, Sparkles, Trophy, Users, Lock, Flame } from "lucide-react";
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

function tournamentCountdown(comp: CompetitionWithEntries) {
  const raw = comp.submissionClosesAt || (comp as any).endsAt || (comp as any).endDate || (comp as any).startsAt;
  if (!raw) return comp.status === "open" ? "Open now" : String(comp.status || "Arena ready");
  const target = new Date(raw).getTime();
  if (!Number.isFinite(target)) return comp.status === "open" ? "Open now" : String(comp.status || "Arena ready");
  const diff = target - Date.now();
  if (diff <= 0) return comp.entryOpen === false ? "Locked" : "Final moments";
  const totalMinutes = Math.ceil(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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
  const [createForm, setCreateForm] = useState({ name: "Friday Friends Cup", tier: "common", entryFee: "20", maxEntries: "10", visibility: "private" });

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
  const privateComps = liveComps.filter((comp) => String(comp.visibility || "").toLowerCase() === "private" || comp.join_pin || comp.joinPin);
  const totalPrizePool = liveComps.reduce((sum, comp) => sum + Number((comp as any).prize_pool_total || Number(comp.entryFee || 0) * 0.8 * Number(comp.entryCount || 0)), 0);

  const requiredTier = normalizeTier(selectedComp?.tier);
  const availableCards = (Array.isArray(myCards) ? myCards : []).filter((card) => card && !card.forSale).filter((card) => !selectedComp || normalizeTier(card.rarity) === requiredTier);
  const selectedCardObjects = availableCards.filter((card) => selectedCards.includes(card.id));
  const positionCounts: Record<string, number> = {};
  selectedCardObjects.forEach((card) => { const pos = card.player?.position || ""; positionCounts[pos] = (positionCounts[pos] || 0) + 1; });
  const hasGK = (positionCounts.GK || 0) >= 1;
  const hasDEF = (positionCounts.DEF || 0) >= 1;
  const hasMID = (positionCounts.MID || 0) >= 1;
  const hasFWD = (positionCounts.FWD || 0) >= 1;
  const lineupValid = selectedCards.length === 5 && hasGK && hasDEF && hasMID && hasFWD;

  const cardIdsForTier = (ids: unknown, tier: string) => {
    const sourceIds = Array.isArray(ids) ? ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)) : [];
    const allowed = new Set((Array.isArray(myCards) ? myCards : []).filter((card) => !card.forSale && normalizeTier(card.rarity) === normalizeTier(tier)).map((card) => card.id));
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
    if (validIds.length !== 5) return toast({ title: `${label} not available`, description: `You need 5 available ${selectedComp.tier} cards.`, variant: "destructive" });
    setSelectedCards(validIds);
    setCaptainId(validIds[0]);
    toast({ title: `${label} applied`, description: "Review your captain before entering." });
  };

  const openCompetitionAction = (comp: CompetitionWithEntries, mode: EntryMode = "standard") => {
    if (comp.status !== "open") return toast({ title: "Tournament unavailable", description: "This tournament is not open for new entries." });
    if (comp.entryOpen === false) return toast({ title: "Submission closed", description: "This gameweek is locked because kickoff has started." });
    setSelectedComp(comp);
    setEntryMode(mode);
    const savedIds = cardIdsForTier(savedLineup?.lineup?.cardIds, comp.tier);
    const previousEntry = previousEntryForTier(comp.tier, comp.id);
    const previousIds = cardIdsForTier(previousEntry?.lineupCardIds, comp.tier);
    const startingIds = savedIds.length === 5 ? savedIds : previousIds;
    setSelectedCards(startingIds);
    setCaptainId(startingIds[0] || null);
  };

  const toggleCard = (cardId: number) => setSelectedCards((prev) => {
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

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!selectedComp || !captainId) throw new Error("Select a tournament and captain");
      const pin = selectedComp.join_pin || selectedComp.joinPin || pinCode;
      const res = await apiRequest("POST", "/api/competitions/join", {
        competitionId: selectedComp.id,
        pin: entryMode === "pin" ? pin : undefined,
        cardIds: selectedCards,
        captainId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions/my-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setSelectedComp(null); setSelectedCards([]); setCaptainId(null);
      toast({ title: "Entered tournament!" });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) { toast({ title: "Unauthorized", variant: "destructive" }); setTimeout(() => { window.location.href = "/api/login"; }, 500); return; }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createTournamentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user-tournaments/create", { name: createForm.name, tier: createForm.tier, entryFee: Number(createForm.entryFee || 0), maxEntries: Number(createForm.maxEntries || 0), visibility: createForm.visibility });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-tournaments/mine"] });
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
    onSuccess: (data: any) => { setPinTournament(data.tournament); toast({ title: "Tournament found", description: data.tournament?.name || "PIN tournament loaded." }); },
    onError: (error: any) => toast({ title: "PIN not found", description: error.message, variant: "destructive" }),
  });

  const platformFeePreview = Number(createForm.entryFee || 0) * 0.2;
  const prizePreview = Number(createForm.entryFee || 0) - platformFeePreview;
  const createdInviteLink = createdPin ? getInviteLink(createdPin) : "";
  const foundInviteLink = pinCode ? getInviteLink(pinCode.trim().toUpperCase()) : "";

  return (
    <LivePageShell tone="arena">
      <LiveHero eyebrow="Tournament Arena" title="Compete under the lights" description="Create private PIN cups, join public tournaments, reuse previous lineups, and track live leaderboards from one arena.">
        <LiveStatCard label="Open Cups" value={String(liveComps.length)} helper={`${privateComps.length} private`} />
        <LiveStatCard label="My Entries" value={String(myLiveComps.length)} helper="Live runs" />
        <LiveStatCard label="Prize Pool" value={`N$${money(totalPrizePool)}`} helper="Current arena" />
      </LiveHero>

      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/80 p-4 text-white shadow-[0_24px_80px_rgba(8,47,73,.28)] sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,.24),transparent_35%),radial-gradient(circle_at_90%_20%,rgba(168,85,247,.22),transparent_34%),linear-gradient(180deg,rgba(255,255,255,.08),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-24 bg-cyan-300/20 blur-3xl" />
        <div className="relative grid gap-3 md:grid-cols-4">
          <ArenaPulse label="Live stadium" value={`${liveComps.length} cups`} helper={`${upcomingComps.length} upcoming`} icon={<Flame className="h-4 w-4" />} />
          <ArenaPulse label="Entrants" value={String(liveComps.reduce((sum, comp) => sum + Number(comp.entryCount || 0), 0))} helper="Across open cups" icon={<Users className="h-4 w-4" />} />
          <ArenaPulse label="Prize lights" value={`N$${money(totalPrizePool)}`} helper="Available pool" icon={<Trophy className="h-4 w-4" />} />
          <ArenaPulse label="Ready cards" value={String(myCommonCards.length)} helper="Common eligible" icon={<Sparkles className="h-4 w-4" />} />
        </div>
      </section>

      <Tabs defaultValue={initialPin ? "pin" : "live"} className="w-full">
        <TabsList className="arena-filter-chips mb-4 flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="live" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">🔴 Public</TabsTrigger>
          <TabsTrigger value="pin" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">🔐 Join by PIN</TabsTrigger>
          <TabsTrigger value="create" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">➕ Create</TabsTrigger>
          <TabsTrigger value="mine" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">🏟 My Tournaments</TabsTrigger>
          <TabsTrigger value="my-live" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">⭐ My Live</TabsTrigger>
          <TabsTrigger value="completed" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">✅ Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="live">{isLoading ? <LoadingGrid /> : liveComps.length > 0 ? <CompetitionGrid comps={liveComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="No public live tournaments available." />}</TabsContent>
        <TabsContent value="my-live">{myLiveComps.length > 0 ? <CompetitionGrid comps={myLiveComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="You are not currently entered in a live tournament." />}</TabsContent>
        <TabsContent value="completed">{isLoading ? <LoadingGrid /> : completedComps.length > 0 ? <CompetitionGrid comps={completedComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="No completed tournaments yet." />}</TabsContent>
        <TabsContent value="mine"><TournamentCreatorHub /></TabsContent>

        <TabsContent value="pin"><Card className="cinematic-glass space-y-4 border-white/10 bg-white/[0.06] p-5 text-white backdrop-blur-xl"><div className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-300" /><h2 className="font-semibold text-lg">Join a Private Tournament</h2></div><p className="text-sm text-white/55">Enter the PIN from the tournament creator. Entry fees, rarity rules and lineup validation still apply.</p><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><input className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-lg uppercase tracking-[0.25em] text-white" placeholder="PIN CODE" value={pinCode} onChange={(e) => setPinCode(e.target.value.toUpperCase())} /><Button onClick={() => findPinMutation.mutate()} disabled={findPinMutation.isPending}>{findPinMutation.isPending ? "Searching..." : "Find Tournament"}</Button></div>{pinCode && <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/55 break-all">Invite link: {foundInviteLink}</div>}{pinTournament && <Card className="p-4 border-amber-400/20 bg-amber-400/10 text-white"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-lg">{pinTournament.name}</h3><p className="text-sm text-white/50">{pinTournament.entryCount || 0}{(pinTournament.max_entries || pinTournament.maxEntries) ? ` / ${pinTournament.max_entries || pinTournament.maxEntries}` : ""} players joined</p></div><Badge className="capitalize">{pinTournament.tier}</Badge></div><div className="grid sm:grid-cols-3 gap-2 my-4 text-sm"><InfoPill label="Entry" value={`N$${money(pinTournament.entryFee)}`} helper="Paid from wallet." /><InfoPill label="Platform" value={`N$${money(Number(pinTournament.entryFee || 0) * 0.2)}`} helper="20% fee." /><InfoPill label="Prize pool" value={`N$${money(Number(pinTournament.entryFee || 0) * 0.8)}`} helper="Added per entry." /></div><TournamentLeaderboardMini competitionId={pinTournament.id} compact /><Button onClick={() => openCompetitionAction(pinTournament, "pin")}>Choose Lineup & Join</Button></Card>}</Card></TabsContent>

        <TabsContent value="create"><Card className="cinematic-glass space-y-4 border-white/10 bg-white/[0.06] p-5 text-white backdrop-blur-xl"><div className="flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-300" /><h2 className="font-semibold text-lg">Create Tournament</h2></div><div className="grid gap-3 md:grid-cols-2"><label className="space-y-1 text-sm"><span className="text-white/55">Name</span><input className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} /></label><label className="space-y-1 text-sm"><span className="text-white/55">Rarity</span><select className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 capitalize text-white" value={createForm.tier} onChange={(e) => setCreateForm({ ...createForm, tier: e.target.value })}>{rarityOptions.map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label><label className="space-y-1 text-sm"><span className="text-white/55">Entry Fee (N$)</span><input type="number" min="0" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.entryFee} onChange={(e) => setCreateForm({ ...createForm, entryFee: e.target.value })} /></label><label className="space-y-1 text-sm"><span className="text-white/55">Max Players</span><input type="number" min="2" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.maxEntries} onChange={(e) => setCreateForm({ ...createForm, maxEntries: e.target.value })} /></label><label className="space-y-1 text-sm md:col-span-2"><span className="text-white/55">Visibility</span><select className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.visibility} onChange={(e) => setCreateForm({ ...createForm, visibility: e.target.value })}><option value="private">Private PIN</option><option value="public">Public</option></select></label></div><div className="grid sm:grid-cols-3 gap-2"><InfoPill label="Platform fee" value={`N$${money(platformFeePreview)}`} helper="20% per entry." /><InfoPill label="Prize pool" value={`N$${money(prizePreview)}`} helper="80% per entry." /><InfoPill label="Creator can enter" value="Yes" helper="Normal fee applies." /></div><Button onClick={() => createTournamentMutation.mutate()} disabled={createTournamentMutation.isPending}>{createTournamentMutation.isPending ? "Creating..." : "Create Tournament"}</Button>{createdPin && <div className="rounded-xl border border-green-400/30 bg-green-400/10 p-4 text-sm space-y-3"><div><div className="text-white/55 mb-1">Private tournament PIN</div><div className="flex items-center gap-2"><code className="text-2xl font-bold tracking-[0.3em]">{createdPin}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(createdPin); toast({ title: "PIN copied" }); }}><Copy className="w-4 h-4" /></Button></div></div><div><div className="text-white/55 mb-1">Invite link</div><div className="flex items-center gap-2"><code className="text-xs break-all rounded bg-black/40 px-2 py-1">{createdInviteLink}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(createdInviteLink); toast({ title: "Invite link copied" }); }}><Copy className="w-4 h-4" /></Button></div></div></div>}</Card></TabsContent>
      </Tabs>

      <Dialog open={!!selectedComp} onOpenChange={() => setSelectedComp(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>Enter {selectedComp?.name}</DialogTitle></DialogHeader>
          {selectedComp && <div className="py-4 space-y-4"><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">This tournament requires <span className="font-semibold text-foreground capitalize">{selectedComp.tier}</span> cards only. Pick 5 cards and set a captain.</div><div className="flex flex-wrap gap-2"><Badge variant="outline">Entry: N${money(selectedComp.entryFee)}</Badge><Badge variant="outline">Platform: N${money(Number(selectedComp.entryFee || 0) * 0.2)}</Badge><Badge variant="outline">Prize pool add: N${money(Number(selectedComp.entryFee || 0) * 0.8)}</Badge></div><TournamentLeaderboardMini competitionId={selectedComp.id} /><div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => applyLineupPreset(savedLineupIds, "Saved lineup")} disabled={savedLineupIds.length !== 5}>Use Saved Lineup ({savedLineupIds.length}/5)</Button><Button variant="outline" onClick={() => applyLineupPreset(previousLineupIds, "Previous tournament lineup")} disabled={previousLineupIds.length !== 5}>Use Previous Lineup ({previousLineupIds.length}/5)</Button></div><p className="text-sm text-muted-foreground">Selected: {selectedCards.length}/5. Need at least 1 GK, 1 DEF, 1 MID and 1 FWD.</p>{selectedCards.length > 0 && !lineupValid && <div className="flex flex-wrap gap-1">{!hasGK && <Badge variant="outline" className="text-red-400 border-red-400">Need GK</Badge>}{!hasDEF && <Badge variant="outline" className="text-red-400 border-red-400">Need DEF</Badge>}{!hasMID && <Badge variant="outline" className="text-red-400 border-red-400">Need MID</Badge>}{!hasFWD && <Badge variant="outline" className="text-red-400 border-red-400">Need FWD</Badge>}</div>}<div className="flex flex-wrap gap-4 justify-center max-h-96 overflow-auto preserve-3d" style={{ transformStyle: "preserve-3d" }}>{availableCards.map((card) => <div key={card.id} className="relative card-3d-container bg-transparent shadow-none p-0" style={{ transformStyle: "preserve-3d", minHeight: "300px" }}><CardThumbnail card={card} size="sm" selected={selectedCards.includes(card.id)} selectable onClick={() => toggleCard(card.id)} />{selectedCards.includes(card.id) && <button className={`absolute -top-1 -left-1 z-30 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${captainId === card.id ? "bg-yellow-500 text-black" : "bg-muted text-muted-foreground hover:bg-yellow-500 hover:text-black"}`} onClick={(e) => { e.stopPropagation(); setCaptainId(card.id); }} title="Set captain">C</button>}</div>)}</div></div>}
          <DialogFooter><Button variant="outline" onClick={() => setSelectedComp(null)}>Cancel</Button><Button onClick={() => joinMutation.mutate()} disabled={!lineupValid || !captainId || joinMutation.isPending}>{joinMutation.isPending ? "Entering..." : selectedComp?.entryFee ? `Enter (N$${money(selectedComp.entryFee)})` : "Enter Free"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </LivePageShell>
  );
}

function ArenaPulse({ label, value, helper, icon }: { label: string; value: string; helper: string; icon: ReactNode }) {
  return <div className="rounded-3xl border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"><div className="mb-3 flex items-center justify-between"><div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">{icon}</div><span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Arena</span></div><div className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</div><div className="mt-1 text-2xl font-black text-white">{value}</div><div className="mt-1 text-xs text-white/45">{helper}</div></div>;
}
function InfoPill({ label, value, helper }: { label: string; value: string; helper: string }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</div><div className="text-lg font-bold mt-1 text-white">{value}</div><div className="text-xs text-white/45 mt-1">{helper}</div></div>; }
function LoadingGrid() { return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-[2rem]" />)}</div>; }
function EmptyCard({ text }: { text: string }) { return <Card className="p-8 text-center border-white/10 bg-white/[0.06] text-white backdrop-blur-xl"><p className="text-white/55">{text}</p></Card>; }
function CompetitionGrid({ comps, enteredIds, onJoin }: { comps: CompetitionWithEntries[]; enteredIds: Set<number>; onJoin: (comp: CompetitionWithEntries) => void }) { return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{comps.map((comp) => <CompetitionCard key={comp.id} comp={comp} entered={enteredIds.has(comp.id)} onJoin={() => onJoin(comp)} />)}</div>; }
function CompetitionCard({ comp, entered, onJoin }: { comp: CompetitionWithEntries; entered: boolean; onJoin: () => void }) { const entryCount = Number(comp.entryCount || (comp.entries || []).length || 0); const maxEntries = Number(comp.max_entries || comp.maxEntries || 0); const prizePool = Number((comp as any).prize_pool_total || 0); const platformFees = Number((comp as any).platform_fee_total || 0); const isPrivate = Boolean(comp.join_pin || comp.joinPin || String(comp.visibility || "") === "private"); const progress = maxEntries ? Math.min(100, Math.round((entryCount / maxEntries) * 100)) : Math.min(100, entryCount * 10); const countdown = tournamentCountdown(comp); return <Card className="group relative overflow-hidden rounded-[2rem] border-white/10 bg-slate-950/70 p-0 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,.28)]"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,.22),transparent_38%),radial-gradient(circle_at_92%_18%,rgba(249,115,22,.18),transparent_34%)] opacity-90" /><div className="pointer-events-none absolute inset-x-6 top-0 h-20 bg-white/10 blur-3xl" /><div className="relative space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2"><Badge className="capitalize bg-cyan-300 text-slate-950">{comp.tier}</Badge>{isPrivate && <Badge variant="outline" className="border-amber-300/40 text-amber-200"><Lock className="mr-1 h-3 w-3" />PIN</Badge>}{entered && <Badge variant="outline" className="border-green-400 text-green-300">Entered</Badge>}</div><h3 className="text-xl font-black leading-tight text-white">{comp.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-white/50"><Clock className="h-3 w-3" />GW {comp.gameWeek} • {comp.status}</p></div><div className="rounded-3xl border border-white/10 bg-black/30 px-3 py-2 text-right"><div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Countdown</div><div className="text-sm font-black text-cyan-100">{countdown}</div></div></div><div className="grid grid-cols-2 gap-2 text-sm"><MiniStat icon={<DollarSign className="w-3 h-3" />} label="Entry" value={`N$${money(comp.entryFee)}`} /><MiniStat icon={<Users className="w-3 h-3" />} label="Players" value={`${entryCount}${maxEntries ? `/${maxEntries}` : ""}`} /><MiniStat icon={<Trophy className="w-3 h-3" />} label="Prize pool" value={`N$${money(prizePool || Number(comp.entryFee || 0) * 0.8 * entryCount)}`} /><MiniStat icon={<Shield className="w-3 h-3" />} label="Platform" value={`N$${money(platformFees || Number(comp.entryFee || 0) * 0.2 * entryCount)}`} /></div><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-white/65">Entrant counter</span><span className="text-white/45">{progress}% full</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300" style={{ width: `${progress}%` }} /></div></div>{(comp.status === "open" || comp.status === "active") && <TournamentLeaderboardMini competitionId={comp.id} compact />}<div className="flex flex-wrap gap-2"><Badge variant="outline" className="capitalize border-white/20 text-white">Prize: {comp.prizeCardRarity || comp.tier} card</Badge><Badge variant="outline" className="border-orange-300/40 text-orange-200"><Flame className="mr-1 h-3 w-3" />20% fee</Badge></div><Button className="w-full rounded-2xl font-black" onClick={onJoin} disabled={entered || comp.status !== "open"}>{entered ? "Already Entered" : comp.status === "open" ? "Enter Tournament" : "Not Open"}</Button></div></Card>; }
function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-white/45">{icon}{label}</div><div className="font-semibold mt-1 text-white">{value}</div></div>; }

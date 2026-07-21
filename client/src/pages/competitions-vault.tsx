import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import CardThumbnail from "../components/CardThumbnail";
import TournamentCreatorHub from "../components/tournaments/TournamentCreatorHub";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { type CompetitionEntry, type PlayerCardWithPlayer } from "../../../shared/schema";
import { CalendarDays, CheckCircle2, Clock3, Crown, Filter, Gift, KeyRound, Lock, Plus, ShieldCheck, Trophy, Users } from "lucide-react";
import { useToast } from "../hooks/use-toast";

const rarityOrder = ["common", "rare", "unique", "epic", "legendary"];
const rarityTheme: Record<string, { accent: string; glow: string; gradient: string }> = {
  common: { accent: "#60a5fa", glow: "rgba(59,130,246,.45)", gradient: "from-blue-500/25 via-slate-900/70 to-black" },
  rare: { accent: "#22d3ee", glow: "rgba(34,211,238,.48)", gradient: "from-cyan-500/25 via-slate-900/70 to-black" },
  unique: { accent: "#c084fc", glow: "rgba(168,85,247,.5)", gradient: "from-purple-500/30 via-slate-900/70 to-black" },
  epic: { accent: "#fb3b4a", glow: "rgba(251,59,74,.5)", gradient: "from-rose-500/30 via-slate-900/70 to-black" },
  legendary: { accent: "#f59e0b", glow: "rgba(245,158,11,.5)", gradient: "from-amber-500/30 via-slate-900/70 to-black" },
};

const slotDefinitions = [
  { label: "Goalkeeper", short: "GK", position: "GK" },
  { label: "Defender", short: "DEF", position: "DEF" },
  { label: "Midfielder", short: "MID", position: "MID" },
  { label: "Forward", short: "FWD", position: "FWD" },
  { label: "Utility", short: "UTIL", position: null },
] as const;

type Position = "GK" | "DEF" | "MID" | "FWD";
type Tournament = any;
type VaultSummary = {
  currentGameWeek?: number;
  currentEntries?: number;
  targetEntries?: number;
  entryFee?: number;
  activePrize?: { title?: string; requiredEntrants?: number } | null;
  nextPrize?: { title?: string; requiredEntrants?: number } | null;
  entrantsToNext?: number;
};
type VaultPayload = { summary?: Record<string, VaultSummary> };

const emptyLineup = (): Array<number | null> => [null, null, null, null, null];
const money = (value: unknown) => `N$${Number(value || 0).toFixed(2)}`;
const tier = (value: unknown) => String(value || "common").toLowerCase();
const normalizeLeague = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const isPremierLeague = (value: unknown) => ["premierleague", "englishpremierleague", "epl"].includes(normalizeLeague(value));
const playerPosition = (card: PlayerCardWithPlayer | undefined | null) => String(card?.player?.position || "").toUpperCase() as Position;
const dateLabel = (value: unknown) => {
  const d = new Date(String(value || ""));
  return Number.isFinite(d.getTime()) ? d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Fixture controlled";
};
const percentage = (entries: number, target: number) => target ? Math.min(100, Math.round((entries / target) * 100)) : 0;
const isPublicArenaTournament = (comp: Tournament) => String(comp.visibility || "public").toLowerCase() !== "private";
const entryCompetitionId = (entry: CompetitionEntry) => Number((entry as any).competitionId ?? (entry as any).competition_id ?? 0);
const entryLineupCardIds = (entry: CompetitionEntry) => {
  const raw = (entry as any).lineupCardIds ?? (entry as any).lineup_card_ids;
  return Array.isArray(raw) ? raw.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
};

export default function CompetitionsVaultPage() {
  const { toast } = useToast();
  const [activeRarity, setActiveRarity] = useState("common");
  const [gameweekFilter, setGameweekFilter] = useState<number | "current">("current");
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [lineupSlots, setLineupSlots] = useState<Array<number | null>>(emptyLineup);
  const [activeSlot, setActiveSlot] = useState<number | null>(0);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [pinTournament, setPinTournament] = useState<Tournament | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "Private Friends Cup", tier: "rare", entryFee: "50", maxEntries: "20" });

  const { data: competitions = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/competitions"],
    queryFn: async () => {
      const res = await fetch("/api/competitions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tournaments");
      const data = await res.json();
      return Array.isArray(data) ? data : data.competitions || [];
    },
    refetchInterval: 30000,
  });
  const { data: prizeVault } = useQuery<VaultPayload>({
    queryKey: ["/api/prize-vault"],
    queryFn: async () => {
      const res = await fetch("/api/prize-vault", { credentials: "include" });
      if (!res.ok) return { summary: {} };
      return res.json();
    },
    refetchInterval: 30000,
  });
  const { data: myCards = [] } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.cards || [];
    },
  });
  const { data: entries = [] } = useQuery<CompetitionEntry[]>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const res = await fetch("/api/competitions/my-entries", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    refetchInterval: 30000,
  });

  const official = useMemo(
    () => competitions.filter((c) => rarityOrder.includes(tier(c.tier)) && isPublicArenaTournament(c) && !["completed", "closed", "cancelled"].includes(String(c.status || "").toLowerCase())),
    [competitions],
  );
  const completedOfficial = useMemo(
    () => competitions.filter((c) => rarityOrder.includes(tier(c.tier)) && isPublicArenaTournament(c) && ["completed", "closed"].includes(String(c.status || "").toLowerCase())),
    [competitions],
  );
  const currentGw = useMemo(() => {
    const live = official.filter((c) => ["open", "active"].includes(String(c.status))).map((c) => Number(c.gameWeek || c.game_week || 0)).filter(Boolean).sort((a, b) => a - b);
    if (live.length) return live[0];
    const upcoming = official.filter((c) => c.status === "upcoming").map((c) => Number(c.gameWeek || c.game_week || 0)).filter(Boolean).sort((a, b) => a - b);
    return upcoming[0] || 1;
  }, [official]);
  const gameweeks = useMemo(
    () => [...new Set<number>(official.map((c) => Number(c.gameWeek || c.game_week || 0)).filter(Boolean))].sort((a, b) => a - b),
    [official],
  );
  const shownGw = gameweekFilter === "current" ? currentGw : gameweekFilter;
  const visible = official.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === activeRarity);
  const selectedTier = tier(selected?.tier);

  const competitionById = useMemo(() => new Map(competitions.map((competition) => [Number(competition.id), competition])), [competitions]);
  const entryCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of entries) {
      const competitionId = entryCompetitionId(entry);
      counts.set(competitionId, (counts.get(competitionId) || 0) + 1);
    }
    return counts;
  }, [entries]);
  const unavailableCardIds = useMemo(() => {
    const ids = new Set<number>();
    for (const entry of entries) {
      const competition = competitionById.get(entryCompetitionId(entry));
      const status = String(competition?.status || "").toLowerCase();
      if (["completed", "cancelled"].includes(status)) continue;
      for (const cardId of entryLineupCardIds(entry)) ids.add(cardId);
    }
    return ids;
  }, [competitionById, entries]);

  const tournamentCards = useMemo(
    () => myCards.filter((card) => !card.forSale && tier(card.rarity) === selectedTier && isPremierLeague(card.player?.league) && !unavailableCardIds.has(Number(card.id))),
    [myCards, selectedTier, unavailableCardIds],
  );
  const cardById = useMemo(() => new Map(tournamentCards.map((card) => [Number(card.id), card])), [tournamentCards]);
  const selectedCards = lineupSlots.map((cardId) => cardId ? cardById.get(Number(cardId)) || null : null);
  const selectedIds = lineupSlots.filter((id): id is number => Number.isInteger(id));
  const selectedPlayerIds = new Set(selectedCards.filter(Boolean).map((card) => Number(card!.playerId)));
  const firstEmptySlot = lineupSlots.findIndex((cardId) => !cardId);
  const currentSlotCard = activeSlot === null ? null : selectedCards[activeSlot];
  const activePosition = activeSlot === null
    ? null
    : slotDefinitions[activeSlot].position || (currentSlotCard ? playerPosition(currentSlotCard) : null);
  const candidateCards = activeSlot === null ? [] : tournamentCards.filter((card) => {
    const cardId = Number(card.id);
    const playerId = Number(card.playerId);
    const currentCardId = lineupSlots[activeSlot];
    const currentPlayerId = currentSlotCard ? Number(currentSlotCard.playerId) : null;
    if (activePosition && playerPosition(card) !== activePosition) return false;
    if (selectedIds.includes(cardId) && cardId !== currentCardId) return false;
    if (selectedPlayerIds.has(playerId) && playerId !== currentPlayerId) return false;
    return true;
  }).sort((a, b) => Number(b.player?.overall || 0) - Number(a.player?.overall || 0));

  const validLineup = lineupSlots.every(Boolean)
    && new Set(selectedIds).size === 5
    && selectedCards.every(Boolean)
    && slotDefinitions.slice(0, 4).every((slot, index) => playerPosition(selectedCards[index]) === slot.position)
    && new Set(selectedCards.map((card) => Number(card?.playerId))).size === 5;

  const sharedSummaryFor = (comp: Tournament): VaultSummary | undefined => {
    if (!isPublicArenaTournament(comp)) return undefined;
    const summary = prizeVault?.summary?.[tier(comp.tier)];
    const competitionGw = Number(comp.gameWeek || comp.game_week || 0);
    return Number(summary?.currentGameWeek || 0) === competitionGw ? summary : undefined;
  };

  const closeBuilder = () => {
    setSelected(null);
    setLineupSlots(emptyLineup());
    setActiveSlot(0);
    setCaptainId(null);
  };

  const openTournament = (comp: Tournament) => {
    if (comp.entryOpen === false || comp.status !== "open") {
      toast({ title: "Entries closed", description: "This tournament locks at the first Premier League kickoff." });
      return;
    }
    setSelected(comp);
    setLineupSlots(emptyLineup());
    setActiveSlot(0);
    setCaptainId(null);
  };

  const chooseCard = (card: PlayerCardWithPlayer) => {
    if (activeSlot === null) return;
    const replacedCardId = lineupSlots[activeSlot];
    const nextSlots = [...lineupSlots];
    nextSlots[activeSlot] = Number(card.id);
    setLineupSlots(nextSlots);
    if (replacedCardId && Number(replacedCardId) === Number(captainId) && Number(replacedCardId) !== Number(card.id)) setCaptainId(null);
    const nextEmpty = nextSlots.findIndex((cardId) => !cardId);
    setActiveSlot(nextEmpty === -1 ? null : nextEmpty);
  };

  const openSlot = (index: number) => {
    if (lineupSlots[index]) {
      setActiveSlot(index);
      return;
    }
    if (index === firstEmptySlot) setActiveSlot(index);
  };

  const findPinMutation = useMutation({
    mutationFn: async () => {
      const normalized = pin.trim().toUpperCase();
      if (!normalized) throw new Error("Enter a tournament PIN");
      const res = await fetch(`/api/user-tournaments/pin/${encodeURIComponent(normalized)}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Tournament not found");
      return body;
    },
    onSuccess: (body: any) => {
      const tournament = body?.tournament;
      if (!tournament) return;
      setPinTournament(tournament);
      setPin("");
    },
    onError: (error: any) => toast({ title: "PIN lookup failed", description: error.message, variant: "destructive" }),
  });
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !captainId || !validLineup) throw new Error("Complete the five-player lineup and select a captain");
      return (await apiRequest("POST", "/api/competitions/join", { competitionId: selected.id, cardIds: selectedIds, captainId })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions/my-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] });
      closeBuilder();
      toast({ title: "Team submitted", description: "This tournament entry is now locked and cannot be changed." });
    },
    onError: (error: any) => toast({ title: "Could not enter", description: error.message, variant: "destructive" }),
  });
  const createMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/user-tournaments/create", { name: createForm.name, tier: createForm.tier, entryFee: Number(createForm.entryFee), maxEntries: Number(createForm.maxEntries), visibility: "private", gameWeek: shownGw })).json(),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-tournaments/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] });
      setCreateOpen(false);
      toast({ title: "Private tournament created", description: `PIN: ${data?.pin || data?.tournament?.join_pin || "created"}` });
    },
    onError: (error: any) => toast({ title: "Could not create tournament", description: error.message, variant: "destructive" }),
  });

  const activeSlotTitle = activeSlot === null
    ? "Lineup complete"
    : activeSlot === 4 && activePosition
      ? `Replace Utility ${activePosition}`
      : activeSlot === 4
        ? "Choose Utility player"
        : `Choose ${slotDefinitions[activeSlot].label}`;

  return (
    <main className="relative flex-1 touch-pan-y overflow-auto overscroll-y-contain bg-[#02040c] px-3 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_80%_0%,rgba(124,58,237,.3),transparent_30%),linear-gradient(180deg,#090d20,#040711)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/70">Official 2026/27 Arena</div>
              <h1 className="mt-2 text-4xl font-black sm:text-6xl">Rarity Tournaments</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/55">Premier League cards only. All current public tournaments of the same rarity feed one shared Prize Vault ladder.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={CalendarDays} label="Gameweek" value={`GW${shownGw}`} />
              <Stat icon={Trophy} label="Rarities" value="5" />
              <Stat icon={Clock3} label="Window" value="Tue–Tue" />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {rarityOrder.map((rarity) => {
              const t = rarityTheme[rarity];
              const count = official.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === rarity).length;
              const vaultEntries = Number(prizeVault?.summary?.[rarity]?.currentGameWeek) === Number(shownGw) ? Number(prizeVault?.summary?.[rarity]?.currentEntries || 0) : 0;
              return (
                <button key={rarity} onClick={() => setActiveRarity(rarity)} className="min-h-[82px] min-w-0 rounded-2xl border px-4 py-3 text-left" style={{ borderColor: activeRarity === rarity ? t.accent : "rgba(255,255,255,.1)", background: activeRarity === rarity ? `${t.accent}18` : "rgba(0,0,0,.22)", boxShadow: activeRarity === rarity ? `0 0 28px ${t.glow}` : undefined }}>
                  <div className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: t.accent }}>{rarity}</div>
                  <div className="mt-1 break-words font-black">{count ? `${count} tournament${count > 1 ? "s" : ""}` : "No tournament"}</div>
                  <div className="mt-1 text-[10px] text-white/40">{vaultEntries} shared vault entries</div>
                </button>
              );
            })}
            <button onClick={() => setCreateOpen(true)} className="min-h-[82px] min-w-0 rounded-2xl border border-purple-300/25 bg-black/25 px-4 py-3 text-left transition hover:border-purple-300/50 hover:bg-purple-500/10">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.18em] text-purple-300"><Plus className="h-3.5 w-3.5" />Create</div>
              <div className="mt-1 break-words font-black text-white">Private tournament</div>
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-white/45"><Filter className="h-4 w-4" />Gameweek filter</div>
            <select value={gameweekFilter} onChange={(e) => setGameweekFilter(e.target.value === "current" ? "current" : Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white">
              <option value="current">Current gameweek (GW{currentGw})</option>
              {gameweeks.map((gw) => <option key={gw} value={gw}>GW{gw}</option>)}
            </select>
            <Link href={`/prize-vault?rarity=${activeRarity}`} className="sm:ml-auto"><Button variant="outline" className="w-full border-white/15 bg-white/5 text-white sm:w-auto"><Gift className="mr-2 h-4 w-4" />View {activeRarity} ladder</Button></Link>
          </div>
          <div className="mt-4 grid gap-2 rounded-2xl border border-purple-300/20 bg-purple-500/10 p-3 sm:grid-cols-[1fr_auto]">
            <div className="relative"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-200/60" /><Input value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") findPinMutation.mutate(); }} placeholder="Enter private tournament PIN" className="h-11 border-white/10 bg-black/35 pl-10 uppercase text-white" /></div>
            <Button onClick={() => findPinMutation.mutate()} disabled={findPinMutation.isPending} className="bg-purple-500 font-black hover:bg-purple-400">{findPinMutation.isPending ? "Finding…" : "Find tournament"}</Button>
          </div>
        </section>

        {pinTournament ? <section><TournamentCard comp={pinTournament} entryCount={entryCounts.get(Number(pinTournament.id)) || 0} onEnter={() => openTournament(pinTournament)} /></section> : null}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? <Card className="col-span-full border-white/10 bg-white/5 p-8 text-center text-white/50">Loading tournaments…</Card> : visible.length ? visible.map((comp) => <TournamentCard key={comp.id} comp={comp} vault={sharedSummaryFor(comp)} entryCount={entryCounts.get(Number(comp.id)) || 0} onEnter={() => openTournament(comp)} />) : <Card className="col-span-full border-white/10 bg-white/5 p-8 text-center text-white/50">No {activeRarity} tournament found for GW{shownGw}.</Card>}
        </section>
        {completedOfficial.length ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">Completed Tournaments</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{completedOfficial.map((comp) => <TournamentCard key={comp.id} comp={comp} entryCount={entryCounts.get(Number(comp.id)) || 0} onEnter={() => toast({ title: "Tournament completed", description: "This tournament is kept for records and can no longer be entered." })} />)}</div></section> : null}
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">My Private Tournaments</h2><TournamentCreatorHub /></section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader><DialogTitle>Create Private Tournament</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Tournament name" />
            <select value={createForm.tier} onChange={(e) => setCreateForm({ ...createForm, tier: e.target.value, entryFee: String(({ common: 10, rare: 50, unique: 100, epic: 250, legendary: 500 } as any)[e.target.value]) })} className="rounded-md border border-white/10 bg-black/40 p-3">{rarityOrder.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            <Input type="number" value={createForm.entryFee} readOnly />
            <Input type="number" min="2" value={createForm.maxEntries} onChange={(e) => setCreateForm({ ...createForm, maxEntries: e.target.value })} placeholder="Maximum entrants" />
            <div className="rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-sm text-purple-100">Private PIN tournament • Premier League cards only • submitted teams are final.</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create & Generate PIN"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) closeBuilder(); }}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-hidden border-white/10 bg-slate-950 p-0 text-white">
          <div className="flex max-h-[94vh] min-h-0 flex-col">
            <DialogHeader className="border-b border-white/10 px-5 py-4 sm:px-6">
              <DialogTitle>Enter {selected?.name}</DialogTitle>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/55">
                <Badge className="bg-purple-500/15 text-purple-200">{selectedTier.toUpperCase()}</Badge>
                <Badge className="bg-emerald-500/15 text-emerald-200"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Premier League only</Badge>
                <Badge className="bg-sky-500/15 text-sky-200"><Users className="mr-1 h-3.5 w-3.5" />Multiple teams allowed</Badge>
              </div>
            </DialogHeader>

            {selected ? (
              <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)] lg:overflow-hidden">
                <section className="min-w-0 border-b border-white/10 p-4 sm:p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[.2em] text-purple-300">Step {activeSlot === null ? 5 : activeSlot + 1} of 5</div>
                    <h3 className="mt-1 text-xl font-black">{activeSlotTitle}</h3>
                    <p className="mt-1 text-sm text-white/50">Select GK, DEF, MID and FWD in order. The fifth Utility slot can use any remaining position. Cards already submitted in an unresolved tournament are hidden.</p>
                  </div>

                  {activeSlot === null ? (
                    <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-center">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
                      <div className="mt-2 font-black">Your five-player team is ready</div>
                      <div className="mt-1 text-sm text-white/55">Choose a captain in the lineup panel, then submit the team.</div>
                    </div>
                  ) : candidateCards.length ? (
                    <div className="mt-4 grid max-h-[56vh] grid-cols-1 gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-2 md:grid-cols-3">
                      {candidateCards.map((card) => (
                        <div key={card.id} className="relative mx-auto">
                          <CardThumbnail card={card} size="sm" selected={Number(lineupSlots[activeSlot]) === Number(card.id)} selectable onClick={() => chooseCard(card)} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-5 text-center text-amber-100">
                      No unused {activePosition || "Premier League"} {selectedTier} card is available for this slot.
                    </div>
                  )}
                </section>

                <section className="min-w-0 bg-black/20 p-4 sm:p-5 lg:overflow-y-auto">
                  <div className="flex items-center justify-between gap-3">
                    <div><div className="text-[10px] font-black uppercase tracking-[.2em] text-white/40">Submitted team</div><h3 className="mt-1 text-xl font-black">Lineup & Captain</h3></div>
                    <Badge className="bg-white/10 text-white">{selectedIds.length}/5</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {slotDefinitions.map((slot, index) => (
                      <LineupSlotCard
                        key={slot.short}
                        slotLabel={slot.label}
                        slotShort={slot.short}
                        card={selectedCards[index]}
                        active={activeSlot === index}
                        captain={Boolean(selectedCards[index] && Number(selectedCards[index]?.id) === Number(captainId))}
                        lockedEmpty={Boolean(!lineupSlots[index] && index !== firstEmptySlot)}
                        onOpen={() => openSlot(index)}
                        captainEnabled={validLineup}
                        onCaptain={() => selectedCards[index] && setCaptainId(Number(selectedCards[index]!.id))}
                      />
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                    <div className="flex items-center gap-2 font-black text-white"><Lock className="h-4 w-4 text-purple-300" />Submission is final</div>
                    <p className="mt-1">You may enter this tournament again with five different, unused cards. A submitted card cannot be reused while its tournament entry remains locked.</p>
                  </div>
                </section>
              </div>
            ) : null}

            <DialogFooter className="border-t border-white/10 bg-slate-950 px-5 py-4 sm:px-6">
              <Button variant="outline" onClick={closeBuilder}>Cancel</Button>
              <Button onClick={() => joinMutation.mutate()} disabled={!validLineup || !captainId || joinMutation.isPending}>
                {joinMutation.isPending ? "Submitting…" : `Submit team • ${money(selected?.entryFee ?? selected?.entry_fee)}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function LineupSlotCard({ slotLabel, slotShort, card, active, captain, lockedEmpty, captainEnabled, onOpen, onCaptain }: { slotLabel: string; slotShort: string; card: PlayerCardWithPlayer | null; active: boolean; captain: boolean; lockedEmpty: boolean; captainEnabled: boolean; onOpen: () => void; onCaptain: () => void }) {
  const player = card?.player;
  const initials = String(player?.name || slotShort).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`relative min-w-0 rounded-2xl border p-3 transition ${active ? "border-purple-300/70 bg-purple-500/15" : "border-white/10 bg-white/[0.04]"}`}>
      <button type="button" onClick={onOpen} disabled={lockedEmpty} className="flex w-full min-w-0 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-40">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/35 font-black text-white/40">
          {player?.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-cover object-top" /> : initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-[.18em] text-purple-300">{slotShort} • {slotLabel}</div>
          <div className="mt-1 truncate font-black">{player?.name || (lockedEmpty ? "Complete the previous slot" : "Select player")}</div>
          <div className="truncate text-[10px] uppercase tracking-[.12em] text-white/40">{player ? `${player.position} • ${player.team}` : "Premier League"}</div>
        </div>
        {captain ? <Crown className="h-5 w-5 shrink-0 text-yellow-300" /> : null}
      </button>
      {card && captainEnabled ? (
        <button type="button" onClick={onCaptain} className={`mt-3 w-full rounded-xl border px-3 py-2 text-xs font-black ${captain ? "border-yellow-300/50 bg-yellow-300 text-black" : "border-white/10 bg-black/30 text-white/70 hover:border-yellow-300/40 hover:text-yellow-200"}`}>
          {captain ? "Captain selected" : "Make captain"}
        </button>
      ) : null}
    </div>
  );
}

function TournamentCard({ comp, vault, entryCount, onEnter }: { comp: Tournament; vault?: VaultSummary; entryCount: number; onEnter: () => void }) {
  const r = tier(comp.tier);
  const t = rarityTheme[r] || rarityTheme.common;
  const tournamentEntries = Number(comp.entryCount ?? comp.entry_count ?? 0);
  const sharedEntries = Number(vault?.currentEntries ?? tournamentEntries);
  const target = Number(vault?.targetEntries ?? comp.requiredEntrants ?? 0);
  const p = percentage(sharedEntries, target);
  const prizeTitle = vault?.activePrize?.title || vault?.nextPrize?.title || comp.prizeDescription || comp.prize_description || "Prize ladder";
  const status = comp.entryOpen === false ? "Locked" : String(comp.status || "open");
  const maxEntries = Number(comp.maxEntries || comp.max_entries || 0);
  const canEnter = comp.entryOpen !== false && comp.status === "open";
  return (
    <Card className={`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br ${t.gradient} p-5 text-white`} style={{ borderColor: `${t.accent}55`, boxShadow: `0 0 35px ${t.glow},0 24px 60px rgba(0,0,0,.45)` }}>
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.12)_18%,transparent_38%)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color: t.accent }}>{r} tournament</div><h2 className="mt-2 text-2xl font-black">{comp.name}</h2></div><Badge className="capitalize" style={{ background: `${t.accent}22`, color: t.accent }}>{status}</Badge></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric label="Entry" value={money(comp.entryFee ?? comp.entry_fee)} />
          <Metric label="Tournament entries" value={maxEntries ? `${tournamentEntries}/${maxEntries}` : String(tournamentEntries)} />
          <Metric label="My submitted teams" value={String(entryCount)} />
          <Metric label="Shared vault entries" value={`${sharedEntries}/${target || 0}`} />
          <Metric label="Current prize" value={prizeTitle} />
          <Metric label="Cutoff" value={dateLabel(comp.submissionClosesAt || comp.endDate || comp.end_date)} />
        </div>
        <div className="mt-4"><div className="flex justify-between text-xs text-white/55"><span>Shared {r} Prize Vault progress</span><b>{p}%</b></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: `${p}%`, background: t.accent, boxShadow: `0 0 18px ${t.glow}` }} /></div></div>
        <div className="mt-4 flex gap-2">
          <Link href={`/prize-vault?rarity=${r}`} className="flex-1"><Button variant="outline" className="w-full border-white/15 bg-black/20 text-white"><Gift className="mr-2 h-4 w-4" />Prize ladder</Button></Link>
          <Button onClick={onEnter} disabled={!canEnter} className="flex-1 font-black" style={{ background: canEnter ? t.accent : "#334155", color: r === "legendary" && canEnter ? "#111827" : "white" }}>{!canEnter ? <><Lock className="mr-2 h-4 w-4" />Closed</> : entryCount > 0 ? "Enter another team" : "Enter"}</Button>
        </div>
      </div>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" />{label}</div><div className="mt-2 font-black">{value}</div></div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase tracking-[.13em] text-white/35">{label}</div><div className="mt-1 line-clamp-2 text-sm font-black">{value}</div></div>;
}

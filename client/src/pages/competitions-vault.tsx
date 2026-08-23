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
import {
  getTournamentRarityRequirement,
  isCardRarityAllowedInTournament,
  normalizeTournamentRarity,
  validateTournamentRarityLineup,
  TOURNAMENT_UTILITY_POSITIONS,
  type TournamentRarity,
} from "../../../shared/game-rules";
import { Activity, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Crown, Eye, Filter, Gift, KeyRound, Lock, Plus, ShieldCheck, Trophy, Users } from "lucide-react";
import { useToast } from "../hooks/use-toast";

const rarityOrder: TournamentRarity[] = ["common", "rare", "unique", "epic", "legendary"];
const rarityTheme: Record<TournamentRarity, { accent: string; glow: string; gradient: string }> = {
  common: { accent: "#60a5fa", glow: "rgba(59,130,246,.45)", gradient: "from-blue-500/25 via-slate-900/70 to-black" },
  rare: { accent: "#168cff", glow: "rgba(22,140,255,.48)", gradient: "from-blue-500/25 via-slate-900/70 to-black" },
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
type TournamentLeaderboardEntry = {
  entryId: number;
  userId?: string;
  teamName: string;
  totalScore: number;
  rank: number;
  captainId?: number | null;
};
type TournamentLeaderboardPayload = {
  leaderboard: TournamentLeaderboardEntry[];
  viewerEntry?: TournamentLeaderboardEntry | null;
  totalEntries: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
type TournamentScoreReason = {
  label: string;
  points: number;
  category: string;
};
type TournamentTeamPlayer = {
  cardId: number;
  name: string;
  team: string;
  position: string;
  rarity: string;
  imageUrl?: string | null;
  captain: boolean;
  points: number;
  captainBonus: number;
  contribution: number;
  minutes: number;
  source: string;
  identityStatus?: string;
  identityMessage?: string;
  identityProvider?: string | null;
  breakdown: { decisive: number; performance: number; penalties: number; bonus: number };
  reasons: TournamentScoreReason[];
};
type TournamentTeamDetails = {
  entryId: number;
  competitionName: string;
  gameWeek: number;
  teamName: string;
  totalScore: number;
  captainBonus: number;
  updatedAt?: string | null;
  finalized: boolean;
  players: TournamentTeamPlayer[];
};

const emptyLineup = (): Array<number | null> => [null, null, null, null, null];
const money = (value: unknown) => `N$${Number(value || 0).toFixed(2)}`;
const scoreLabel = (value: unknown) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
const tier = (value: unknown) => normalizeTournamentRarity(value);
const normalizeLeague = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const isPremierLeague = (value: unknown) => ["premierleague", "englishpremierleague", "epl"].includes(normalizeLeague(value));
const playerPosition = (card: PlayerCardWithPlayer | undefined | null) => String(card?.player?.position || "").toUpperCase() as Position;
const isUtilityPosition = (value: unknown) => TOURNAMENT_UTILITY_POSITIONS.includes(String(value || "").toUpperCase() as typeof TOURNAMENT_UTILITY_POSITIONS[number]);
const isCurrentPremierLeagueCard = (card: PlayerCardWithPlayer) => isPremierLeague(card.player?.league)
  || (card.player as any)?.premierLeagueEligible === true;
const playerEligibilityMessage = (card: PlayerCardWithPlayer) => String((card.player as any)?.selectionEligibility?.message || "").trim();
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
  const [activeRarity, setActiveRarity] = useState<TournamentRarity>("common");
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
  const selectedRequirement = getTournamentRarityRequirement(selectedTier);

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
    const selectedCompetitionId = Number(selected?.id || 0);
    if (!selectedCompetitionId) return ids;
    for (const entry of entries) {
      const competitionId = entryCompetitionId(entry);
      if (competitionId !== selectedCompetitionId) continue;
      const competition = competitionById.get(competitionId);
      const status = String(competition?.status || "").toLowerCase();
      if (["completed", "cancelled"].includes(status)) continue;
      for (const cardId of entryLineupCardIds(entry)) ids.add(cardId);
    }
    return ids;
  }, [competitionById, entries, selected?.id]);

  const cardById = useMemo(() => new Map(myCards.map((card) => [Number(card.id), card])), [myCards]);
  const selectedCards = lineupSlots.map((cardId) => cardId ? cardById.get(Number(cardId)) || null : null);
  const selectedIds = lineupSlots.filter((id): id is number => Number.isInteger(id));
  const selectedPlayerIds = new Set(selectedCards.filter(Boolean).map((card) => Number(card!.playerId)));
  const selectedRarityValidation = validateTournamentRarityLineup(selectedCards.filter(Boolean).map((card) => card!.rarity), selectedTier);
  const selectedTierCount = selectedCards.filter((card) => card && tier(card.rarity) === selectedTier).length;
  const firstEmptySlot = lineupSlots.findIndex((cardId) => !cardId);
  const currentSlotCard = activeSlot === null ? null : selectedCards[activeSlot];
  const activePosition = activeSlot === null || activeSlot === 4 ? null : slotDefinitions[activeSlot].position;
  const candidateRows = activeSlot === null ? [] : myCards.map((card) => {
    const cardId = Number(card.id);
    const playerId = Number(card.playerId);
    const currentCardId = lineupSlots[activeSlot];
    const currentPlayerId = currentSlotCard ? Number(currentSlotCard.playerId) : null;
    const position = playerPosition(card);
    const provider = String((card.player as any)?.selectionEligibility?.provider || "stored card data")
      .replace("api-football", "API-Football")
      .replace("fpl-fallback", "FPL fallback");
    const positionMatches = activeSlot === 4 ? isUtilityPosition(position) : !activePosition || position === activePosition;
    let reason: string | null = null;
    if (!positionMatches) reason = activeSlot === 4
      ? `Unavailable: ${provider} links this player as ${position}; Utility requires DEF, MID or FWD.`
      : `Unavailable: ${provider} links this player as ${position}; ${activePosition} is required in this slot.`;
    else if (card.forSale) reason = "Unavailable: listed on the marketplace.";
    else if (!isCardRarityAllowedInTournament(card.rarity, selectedTier)) reason = `Unavailable: ${String(card.rarity).toUpperCase()} rarity is not allowed in this ${selectedTier.toUpperCase()} tournament.`;
    else if (!isCurrentPremierLeagueCard(card)) reason = playerEligibilityMessage(card) || "Unavailable: this player is not linked to a current Premier League squad by API-Football or the FPL fallback.";
    else if (unavailableCardIds.has(cardId)) reason = "Unavailable: this card is already used in another entry in this tournament.";
    else if (selectedIds.includes(cardId) && cardId !== currentCardId) reason = "Unavailable: this card is already selected in your lineup.";
    else if (selectedPlayerIds.has(playerId) && playerId !== currentPlayerId) reason = "Unavailable: another card for this player is already selected.";
    return { card, reason };
  }).sort((a, b) => {
    if (Boolean(a.reason) !== Boolean(b.reason)) return a.reason ? 1 : -1;
    const aPositionMatch = activeSlot === 4 ? isUtilityPosition(playerPosition(a.card)) : !activePosition || playerPosition(a.card) === activePosition;
    const bPositionMatch = activeSlot === 4 ? isUtilityPosition(playerPosition(b.card)) : !activePosition || playerPosition(b.card) === activePosition;
    if (aPositionMatch !== bPositionMatch) return aPositionMatch ? -1 : 1;
    const aExact = tier(a.card.rarity) === selectedTier ? 1 : 0;
    const bExact = tier(b.card.rarity) === selectedTier ? 1 : 0;
    return bExact - aExact || Number(b.card.player?.overall || 0) - Number(a.card.player?.overall || 0);
  });
  const validLineup = lineupSlots.every(Boolean)
    && new Set(selectedIds).size === 5
    && selectedCards.every(Boolean)
    && selectedCards.every((card) => card && !card.forSale && isCurrentPremierLeagueCard(card) && isCardRarityAllowedInTournament(card.rarity, selectedTier) && !unavailableCardIds.has(Number(card.id)))
    && slotDefinitions.slice(0, 4).every((slot, index) => playerPosition(selectedCards[index]) === slot.position)
    && isUtilityPosition(playerPosition(selectedCards[4]))
    && new Set(selectedCards.map((card) => Number(card?.playerId))).size === 5
    && selectedRarityValidation.valid;

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
    if (lineupSlots[index]) return setActiveSlot(index);
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
      if (!selected || !captainId || !validLineup) throw new Error(selectedRarityValidation.message || "Complete the five-player lineup and select a captain");
      return (await apiRequest("POST", "/api/competitions/join", { competitionId: selected.id, cardIds: selectedIds, captainId })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions/leaderboard"] });
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

  const activeSlotTitle = activeSlot === null ? "Lineup complete" : activeSlot === 4 ? "Choose Utility player" : `Choose ${slotDefinitions[activeSlot].label}`;

  return (
    <main className="relative flex-1 touch-pan-y overflow-auto overscroll-y-contain bg-[#02040c] px-3 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_80%_0%,rgba(124,58,237,.3),transparent_30%),linear-gradient(180deg,#090d20,#040711)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/70">Official 2026/27 Arena</div><h1 className="mt-2 text-4xl font-black sm:text-6xl">Rarity Tournaments</h1><p className="mt-2 max-w-3xl text-sm text-white/55">Every entry uses five Premier League cards. Entries lock at the first Premier League kickoff; scores freeze and results settle after the following Tuesday cutoff.</p></div>
            <div className="grid grid-cols-3 gap-2"><Stat icon={CalendarDays} label="Gameweek" value={`GW${shownGw}`} /><Stat icon={Trophy} label="Rarities" value="5" /><Stat icon={Clock3} label="Settlement" value="Tuesday" /></div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {rarityOrder.map((rarity) => {
              const t = rarityTheme[rarity];
              const count = official.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === rarity).length;
              const vaultEntries = Number(prizeVault?.summary?.[rarity]?.currentGameWeek) === Number(shownGw) ? Number(prizeVault?.summary?.[rarity]?.currentEntries || 0) : 0;
              return <button key={rarity} onClick={() => setActiveRarity(rarity)} className="min-h-[100px] min-w-0 rounded-2xl border px-4 py-3 text-left" style={{ borderColor: activeRarity === rarity ? t.accent : "rgba(255,255,255,.1)", background: activeRarity === rarity ? `${t.accent}18` : "rgba(0,0,0,.22)", boxShadow: activeRarity === rarity ? `0 0 28px ${t.glow}` : undefined }}><div className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: t.accent }}>{rarity}</div><div className="mt-1 break-words font-black">{count ? `${count} tournament${count > 1 ? "s" : ""}` : "No tournament"}</div><div className="mt-1 text-[10px] font-semibold text-white/65">{getTournamentRarityRequirement(rarity).shortLabel}</div><div className="mt-1 text-[10px] text-white/40">{vaultEntries} shared vault entries</div></button>;
            })}
            <button onClick={() => setCreateOpen(true)} className="min-h-[100px] min-w-0 rounded-2xl border border-purple-300/25 bg-black/25 px-4 py-3 text-left transition hover:border-purple-300/50 hover:bg-purple-500/10"><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.18em] text-purple-300"><Plus className="h-3.5 w-3.5" />Create</div><div className="mt-1 break-words font-black text-white">Private tournament</div></button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-white/45"><Filter className="h-4 w-4" />Gameweek filter</div><select value={gameweekFilter} onChange={(e) => setGameweekFilter(e.target.value === "current" ? "current" : Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="current">Current gameweek (GW{currentGw})</option>{gameweeks.map((gw) => <option key={gw} value={gw}>GW{gw}</option>)}</select><Link href={`/prize-vault?rarity=${activeRarity}`} className="sm:ml-auto"><Button variant="outline" className="w-full border-white/15 bg-white/5 text-white sm:w-auto"><Gift className="mr-2 h-4 w-4" />View {activeRarity} ladder</Button></Link></div>
          <div className="mt-4 grid gap-2 rounded-2xl border border-purple-300/20 bg-purple-500/10 p-3 sm:grid-cols-[1fr_auto]"><div className="relative"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-200/60" /><Input value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") findPinMutation.mutate(); }} placeholder="Enter private tournament PIN" className="h-11 border-white/10 bg-black/35 pl-10 uppercase text-white" /></div><Button onClick={() => findPinMutation.mutate()} disabled={findPinMutation.isPending} className="bg-purple-500 font-black hover:bg-purple-400">{findPinMutation.isPending ? "Finding…" : "Find tournament"}</Button></div>
        </section>

        {pinTournament ? <section><TournamentCard comp={pinTournament} entryCount={entryCounts.get(Number(pinTournament.id)) || 0} onEnter={() => openTournament(pinTournament)} /></section> : null}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{isLoading ? <Card className="col-span-full border-white/10 bg-white/5 p-8 text-center text-white/50">Loading tournaments…</Card> : visible.length ? visible.map((comp) => <TournamentCard key={comp.id} comp={comp} vault={sharedSummaryFor(comp)} entryCount={entryCounts.get(Number(comp.id)) || 0} onEnter={() => openTournament(comp)} />) : <Card className="col-span-full border-white/10 bg-white/5 p-8 text-center text-white/50">No {activeRarity} tournament found for GW{shownGw}.</Card>}</section>
        {completedOfficial.length ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">Completed Tournaments</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{completedOfficial.map((comp) => <TournamentCard key={comp.id} comp={comp} entryCount={entryCounts.get(Number(comp.id)) || 0} onEnter={() => toast({ title: "Tournament completed", description: "This tournament is kept for records and can no longer be entered." })} />)}</div></section> : null}
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">My Private Tournaments</h2><TournamentCreatorHub /></section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="border-white/10 bg-slate-950 text-white"><DialogHeader><DialogTitle>Create Private Tournament</DialogTitle></DialogHeader><div className="grid gap-3"><Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Tournament name" /><select value={createForm.tier} onChange={(e) => setCreateForm({ ...createForm, tier: e.target.value, entryFee: String(({ common: 10, rare: 50, unique: 100, epic: 250, legendary: 500 } as any)[e.target.value]) })} className="rounded-md border border-white/10 bg-black/40 p-3">{rarityOrder.map((r) => <option key={r} value={r}>{r}</option>)}</select><Input type="number" value={createForm.entryFee} readOnly /><Input type="number" min="2" value={createForm.maxEntries} onChange={(e) => setCreateForm({ ...createForm, maxEntries: e.target.value })} placeholder="Maximum entrants" /><div className="rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-sm text-purple-100">{getTournamentRarityRequirement(createForm.tier).description} Premier League cards only; submitted teams are final.</div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create & Generate PIN"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) closeBuilder(); }}><DialogContent className="max-h-[94vh] w-[min(96vw,1280px)] max-w-7xl overflow-hidden border-white/10 bg-slate-950 p-0 text-white"><div className="flex max-h-[94vh] min-h-0 flex-col"><DialogHeader className="border-b border-white/10 px-5 py-4 sm:px-6"><DialogTitle>Enter {selected?.name}</DialogTitle><div className="mt-2 flex flex-wrap gap-2 text-xs text-white/55"><Badge className="bg-purple-500/15 text-purple-200">{selectedTier.toUpperCase()}</Badge><Badge className="bg-emerald-500/15 text-emerald-200"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Premier League only</Badge><Badge className="bg-sky-500/15 text-sky-200"><Users className="mr-1 h-3.5 w-3.5" />Multiple teams allowed</Badge><Badge className="bg-amber-500/15 text-amber-100">{selectedRequirement.shortLabel}</Badge></div></DialogHeader>
        {selected ? <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(420px,.72fr)] lg:overflow-hidden"><section className="min-w-0 border-b border-white/10 p-4 sm:p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-black uppercase tracking-[.2em] text-purple-300">Step {activeSlot === null ? 5 : activeSlot + 1} of 5</div><h3 className="mt-1 text-xl font-black">{activeSlotTitle}</h3><p className="mt-1 text-sm text-white/50">Select GK, DEF, MID and FWD in order. The fifth Utility slot may use any unused outfield player: DEF, MID or FWD. {selectedRequirement.description}</p></div>
          {activeSlot === null ? <div className={`mt-4 rounded-2xl border p-5 text-center ${selectedRarityValidation.valid ? "border-emerald-300/20 bg-emerald-500/10" : "border-amber-300/25 bg-amber-500/10"}`}><CheckCircle2 className={`mx-auto h-8 w-8 ${selectedRarityValidation.valid ? "text-emerald-300" : "text-amber-300"}`} /><div className="mt-2 font-black">{selectedRarityValidation.valid ? "Your five-player team is ready" : "Rarity requirement not met"}</div><div className="mt-1 text-sm text-white/55">{selectedRarityValidation.valid ? "Choose a captain in the lineup panel, then submit the team." : selectedRarityValidation.message}</div></div> : candidateRows.length ? <><div className="mt-4 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/55">All owned cards are shown. Unavailable cards explain exactly why they cannot fill this slot.</div><div className="mt-3 grid max-h-[56vh] grid-cols-1 gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-2 md:grid-cols-3">{candidateRows.map(({ card, reason }) => <div key={card.id} className={`relative mx-auto ${reason ? "opacity-60" : ""}`}><CardThumbnail card={card} size="sm" selected={Number(lineupSlots[activeSlot]) === Number(card.id)} selectable={!reason} onClick={() => { if (!reason) chooseCard(card); }} />{reason ? <div className="mt-2 max-w-48 rounded-lg border border-amber-300/20 bg-amber-400/10 px-2.5 py-2 text-center text-[11px] font-bold leading-snug text-amber-100">{reason}</div> : <div className="mt-2 text-center text-[11px] font-bold text-emerald-200">Available • {String((card.player as any)?.selectionEligibility?.provider || "Premier League").replace("api-football", "API-Football").replace("fpl-fallback", "FPL fallback")}</div>}</div>)}</div></> : <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-5 text-center text-amber-100">Your collection has no player cards.</div>}
        </section><section className="min-w-0 bg-black/20 p-4 sm:p-5 lg:overflow-y-auto"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-white/40">Your squad</div><h3 className="mt-1 text-xl font-black">Selected lineup</h3></div><Badge className="bg-white/10 text-white">{selectedIds.length}/5</Badge></div><div className="mt-3 rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-xs text-purple-100"><b>{selectedTierCount}/{selectedRequirement.requiredTournamentRarityCards} required {selectedTier} cards selected.</b><div className="mt-1 text-purple-100/65">{selectedRequirement.shortLabel}</div></div><div className="mt-4 grid grid-cols-1 gap-2.5">{slotDefinitions.map((slot, index) => <LineupSlotCard key={slot.short} slotLabel={slot.label} slotShort={slot.short} card={selectedCards[index]} active={activeSlot === index} captain={Boolean(selectedCards[index] && Number(selectedCards[index]?.id) === Number(captainId))} lockedEmpty={Boolean(!lineupSlots[index] && index !== firstEmptySlot)} onOpen={() => openSlot(index)} captainEnabled={validLineup} onCaptain={() => selectedCards[index] && setCaptainId(Number(selectedCards[index]!.id))} />)}</div><div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55"><div className="flex items-center gap-2 font-black text-white"><Lock className="h-4 w-4 text-purple-300" />Submission is final</div><p className="mt-1">You may enter again with five different, unused cards. Submitted cards remain locked until settlement or cancellation.</p></div></section></div> : null}
        <DialogFooter className="border-t border-white/10 bg-slate-950 px-5 py-4 sm:px-6"><Button variant="outline" onClick={closeBuilder}>Cancel</Button><Button onClick={() => joinMutation.mutate()} disabled={!validLineup || !captainId || joinMutation.isPending}>{joinMutation.isPending ? "Submitting…" : `Submit team • ${money(selected?.entryFee ?? selected?.entry_fee)}`}</Button></DialogFooter></div></DialogContent></Dialog>
    </main>
  );
}

function LineupSlotCard({ slotLabel, slotShort, card, active, captain, lockedEmpty, captainEnabled, onOpen, onCaptain }: { slotLabel: string; slotShort: string; card: PlayerCardWithPlayer | null; active: boolean; captain: boolean; lockedEmpty: boolean; captainEnabled: boolean; onOpen: () => void; onCaptain: () => void }) {
  const player = card?.player;
  const initials = String(player?.name || slotShort).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <div className={`relative min-w-0 rounded-2xl border p-3 transition ${active ? "border-purple-300/70 bg-purple-500/15" : "border-white/10 bg-white/[0.04]"}`}><button type="button" onClick={onOpen} disabled={lockedEmpty} className="flex w-full min-w-0 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-40"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/35 font-black text-white/40">{player?.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : initials}</div><div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase tracking-[.18em] text-purple-300">{slotShort} • {slotLabel}</div><div className="mt-1 line-clamp-2 font-black leading-tight">{player?.name || (lockedEmpty ? "Complete the previous slot" : "Select player")}</div><div className="truncate text-[10px] uppercase tracking-[.12em] text-white/40">{player ? `${player.position} • ${player.team} • ${String(card?.rarity || "")}` : "Premier League"}</div></div>{captain ? <Crown className="h-5 w-5 shrink-0 text-yellow-300" /> : null}</button>{card && captainEnabled ? <button type="button" onClick={onCaptain} className={`mt-3 w-full rounded-xl border px-3 py-2 text-xs font-black ${captain ? "border-yellow-300/50 bg-yellow-300 text-black" : "border-white/10 bg-black/30 text-white/70 hover:border-yellow-300/40 hover:text-yellow-200"}`}>{captain ? "Captain selected" : "Make captain"}</button> : null}</div>;
}

function TournamentCard({ comp, vault, entryCount, onEnter }: { comp: Tournament; vault?: VaultSummary; entryCount: number; onEnter: () => void }) {
  const r = tier(comp.tier);
  const t = rarityTheme[r];
  const requirement = getTournamentRarityRequirement(r);
  const tournamentEntries = Number(comp.entryCount ?? comp.entry_count ?? 0);
  const sharedEntries = Number(vault?.currentEntries ?? tournamentEntries);
  const target = Number(vault?.targetEntries ?? comp.requiredEntrants ?? 0);
  const p = percentage(sharedEntries, target);
  const prizeTitle = vault?.activePrize?.title || vault?.nextPrize?.title || comp.prizeDescription || comp.prize_description || "Prize ladder";
  const status = comp.entryOpen === false ? "Locked" : String(comp.status || "open");
  const maxEntries = Number(comp.maxEntries || comp.max_entries || 0);
  const canEnter = comp.entryOpen !== false && comp.status === "open";
  const submissionClosesAt = comp.submissionClosesAt || comp.submission_closes_at;
  const settlementAt = comp.settlementAt || comp.settlement_at || comp.endDate || comp.end_date;
  const entryLockLabel = submissionClosesAt ? dateLabel(submissionClosesAt) : "First PL kickoff";
  return <Card className={`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br ${t.gradient} p-5 text-white`} style={{ borderColor: `${t.accent}55`, boxShadow: `0 0 35px ${t.glow},0 24px 60px rgba(0,0,0,.45)` }}><div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.12)_18%,transparent_38%)]" /><div className="relative"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color: t.accent }}>{r} tournament</div><h2 className="mt-2 text-2xl font-black">{comp.name}</h2></div><Badge className="capitalize" style={{ background: `${t.accent}22`, color: t.accent }}>{status}</Badge></div><div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase tracking-[.15em] text-white/40">Cards required</div><div className="mt-1 text-sm font-black" style={{ color: t.accent }}>{requirement.shortLabel}</div></div><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Entry" value={money(comp.entryFee ?? comp.entry_fee)} /><Metric label="Tournament entries" value={maxEntries ? `${tournamentEntries}/${maxEntries}` : String(tournamentEntries)} /><Metric label="My submitted teams" value={String(entryCount)} /><Metric label="Shared vault entries" value={`${sharedEntries}/${target || 0}`} /><Metric label="Current prize" value={prizeTitle} /><Metric label="Entry lock" value={entryLockLabel} /><Metric label="Settlement" value={dateLabel(settlementAt)} /></div><div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/10 p-3 text-[11px] leading-5 text-amber-100">Only Premier League points recorded for this gameweek before Tuesday settlement count. FA Cup matches and Premier League fixtures played after settlement are excluded.</div><div className="mt-4"><div className="flex justify-between text-xs text-white/55"><span>Shared {r} Prize Vault progress</span><b>{p}%</b></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: `${p}%`, background: t.accent, boxShadow: `0 0 18px ${t.glow}` }} /></div><div className="mt-4 flex gap-2"><Link href={`/prize-vault?rarity=${r}`} className="flex-1"><Button variant="outline" className="w-full border-white/15 bg-black/20 text-white"><Gift className="mr-2 h-4 w-4" />Prize ladder</Button></Link><Button onClick={onEnter} disabled={!canEnter} className="flex-1 font-black" style={{ background: canEnter ? t.accent : "#334155", color: r === "legendary" && canEnter ? "#111827" : "white" }}>{!canEnter ? <><Lock className="mr-2 h-4 w-4" />Closed</> : entryCount > 0 ? "Enter another team" : "Enter"}</Button></div></div><TournamentLeaderboardPreview comp={comp} /></div></Card>;
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" />{label}</div><div className="mt-2 font-black">{value}</div></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase tracking-[.13em] text-white/35">{label}</div><div className="mt-1 line-clamp-2 text-sm font-black">{value}</div></div>; }

function TournamentLeaderboardPreview({ comp }: { comp: Tournament }) {
  const competitionId = Number(comp.id || 0);
  const accent = rarityTheme[tier(comp.tier)].accent;
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<TournamentLeaderboardEntry | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const preview = (Array.isArray(comp.entries) ? comp.entries : [])
    .slice(0, 5)
    .map((entry: any, index: number): TournamentLeaderboardEntry => ({
      entryId: Number(entry.entryId || entry.id || 0),
      userId: entry.userId,
      teamName: String(entry.teamName || entry.userName || "Manager"),
      totalScore: Number(entry.totalScore || 0),
      rank: Number(entry.rank || index + 1),
      captainId: entry.captainId || null,
    }));
  const totalEntries = Number(comp.entryCount ?? comp.entry_count ?? preview.length);

  const { data: leaderboard, isLoading: leaderboardLoading, isError: leaderboardError } = useQuery<TournamentLeaderboardPayload>({
    queryKey: ["/api/competitions/leaderboard", competitionId, page],
    queryFn: async () => {
      const response = await fetch(
        `/api/competitions/${competitionId}/leaderboard?page=${page}&pageSize=100`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to load the tournament leaderboard");
      return response.json();
    },
    enabled: open && competitionId > 0,
    refetchInterval: open ? 30000 : false,
  });

  const { data: team, isLoading: teamLoading, isError: teamError } = useQuery<TournamentTeamDetails>({
    queryKey: ["/api/competitions/entry-score", competitionId, selectedEntry?.entryId || 0],
    queryFn: async () => {
      const response = await fetch(
        `/api/competitions/${competitionId}/entries/${selectedEntry?.entryId}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to load the submitted team");
      return response.json();
    },
    enabled: open && competitionId > 0 && Number(selectedEntry?.entryId || 0) > 0,
    refetchInterval: open && selectedEntry ? 30000 : false,
  });

  const openEntry = (entry: TournamentLeaderboardEntry) => {
    setSelectedEntry(entry);
    setExpandedCardId(null);
    setOpen(true);
  };
  const totalPages = Math.max(1, Number(leaderboard?.totalPages || 1));
  const expandedPlayer = team?.players.find((player) => Number(player.cardId) === Number(expandedCardId || 0)) || null;

  return <>
    <section className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-white/85">
          <Trophy className="h-4 w-4" style={{ color: accent }} />Leaderboard
        </div>
        <span className="text-[10px] font-bold text-white/45">Top 5 • {totalEntries} teams</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {preview.length ? preview.map((entry) => <button
          key={entry.entryId}
          type="button"
          onClick={() => openEntry(entry)}
          className="grid w-full grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.035] px-2.5 py-2 text-left transition hover:border-white/20 hover:bg-white/[.08]"
        >
          <span className="text-xs font-black" style={{ color: entry.rank <= 3 ? accent : "rgba(255,255,255,.55)" }}>#{entry.rank}</span>
          <span className="truncate text-xs font-bold text-white">{entry.teamName}</span>
          <span className="text-xs font-black text-emerald-200">{scoreLabel(entry.totalScore)} pts</span>
        </button>) : <div className="rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-white/45">No teams have entered yet.</div>}
      </div>
      <button
        type="button"
        onClick={() => { setPage(1); setSelectedEntry(null); setExpandedCardId(null); setOpen(true); }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[.05] px-3 py-2 text-xs font-black text-white/80 transition hover:border-white/25 hover:bg-white/10"
      >
        <Eye className="h-3.5 w-3.5" />Open all {totalEntries ? `(${totalEntries})` : ""}
      </button>
    </section>

    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setExpandedCardId(null); }}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1240px)] max-w-6xl overflow-hidden border-white/10 bg-slate-950 p-0 text-white">
        <div className="flex max-h-[92vh] min-h-0 flex-col">
          <DialogHeader className="border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="text-[10px] font-black uppercase tracking-[.22em]" style={{ color: accent }}>GW{Number(comp.gameWeek || comp.game_week || 0)} • Tournament leaderboard</div>
            <DialogTitle className="mt-1 text-xl">{String(comp.name || "Tournament")}</DialogTitle>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/55">
              <Badge className="bg-white/10 text-white">{Number(leaderboard?.totalEntries ?? totalEntries)} entered teams</Badge>
              <Badge className="bg-emerald-500/15 text-emerald-200"><Activity className="mr-1 h-3.5 w-3.5" />Live gameweek points</Badge>
              <Badge className="bg-purple-500/15 text-purple-200">100 teams per page</Badge>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(360px,.78fr)] lg:overflow-hidden">
            <section className="min-w-0 border-b border-white/10 p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r">
              <div className="mb-3 grid grid-cols-[48px_minmax(0,1fr)_90px] gap-2 px-3 text-[10px] font-black uppercase tracking-[.15em] text-white/40">
                <span>Rank</span><span>Entered team</span><span className="text-right">Total points</span>
              </div>
              {leaderboardLoading ? <div className="rounded-xl border border-white/10 p-5 text-center text-sm text-white/55">Loading leaderboard…</div>
                : leaderboardError ? <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-5 text-center text-sm text-rose-100">Could not load this leaderboard.</div>
                  : leaderboard?.leaderboard?.length ? <div className="space-y-1.5">{leaderboard.leaderboard.map((entry) => <button
                    key={entry.entryId}
                    type="button"
                    onClick={() => openEntry(entry)}
                    className={`grid w-full grid-cols-[48px_minmax(0,1fr)_90px] items-center gap-2 rounded-xl border px-3 py-3 text-left transition ${Number(selectedEntry?.entryId || 0) === Number(entry.entryId) ? "border-purple-300/45 bg-purple-500/15" : "border-white/[.07] bg-white/[.035] hover:border-white/20 hover:bg-white/[.07]"}`}
                  >
                    <span className="text-sm font-black" style={{ color: Number(entry.rank) <= 3 ? accent : "rgba(255,255,255,.7)" }}>#{entry.rank}</span>
                    <span className="truncate text-sm font-bold text-white">{entry.teamName}</span>
                    <span className="text-right text-sm font-black text-emerald-200">{scoreLabel(entry.totalScore)}</span>
                  </button>)}</div>
                    : <div className="rounded-xl border border-dashed border-white/12 p-6 text-center text-sm text-white/50">No tournament teams have been submitted yet.</div>}

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.035] p-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button>
                <span className="text-xs font-bold text-white/65">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  Next<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </section>

            <section className="min-w-0 bg-black/20 p-4 lg:overflow-y-auto">
              {!selectedEntry ? <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[.025] p-6 text-center"><div><Users className="mx-auto h-8 w-8 text-purple-300" /><div className="mt-3 font-black">Open an entered team</div><div className="mt-1 text-sm text-white/50">Select any team to view its five-player lineup and exact scoring actions.</div></div></div>
                : teamLoading ? <div className="rounded-xl border border-white/10 p-5 text-center text-sm text-white/55">Loading team lineup…</div>
                  : teamError ? <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-5 text-center text-sm text-rose-100">Could not load this team’s scoring details.</div>
                    : team ? <>
                      <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                        <div className="text-[10px] font-black uppercase tracking-[.17em] text-purple-300">Submitted lineup</div>
                        <div className="mt-1 text-xl font-black">{team.teamName}</div>
                        <div className="mt-3 flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.15em] text-white/45">Total points</div><div className="mt-1 text-3xl font-black text-emerald-200">{scoreLabel(team.totalScore)}</div></div><div className="text-right text-xs text-white/50">{team.finalized ? "Final score" : "Live score"}<br />{team.updatedAt ? dateLabel(team.updatedAt) : "Awaiting match update"}</div></div>
                        {Number(team.captainBonus || 0) !== 0 ? <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"><Crown className="mr-1 inline h-3.5 w-3.5" />Captain bonus: +{scoreLabel(team.captainBonus)} points</div> : null}
                      </div>

                      <div className="mt-4 space-y-2.5">{team.players.map((player) => {
                        const expanded = expandedCardId === Number(player.cardId);
                        const initials = player.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
                        return <div key={player.cardId} className={`overflow-hidden rounded-2xl border ${expanded ? "border-purple-300/35 bg-purple-500/[.08]" : "border-white/10 bg-white/[.04]"}`}>
                          <button type="button" onClick={() => setExpandedCardId(expanded ? null : Number(player.cardId))} className="flex w-full items-center gap-3 p-3 text-left">
                            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 text-xs font-black text-white/50">{player.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : initials}</div>
                            <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-white">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</div><div className="mt-1 truncate text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{player.position} • {player.team} • {player.minutes} min</div></div>
                            <div className="shrink-0 text-right"><div className="text-base font-black text-emerald-200">{scoreLabel(player.points)}</div><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/40">points</div></div>
                            {expanded ? <ChevronUp className="h-4 w-4 text-white/45" /> : <ChevronDown className="h-4 w-4 text-white/45" />}
                          </button>
                          {player.identityStatus && player.identityStatus !== "verified" ? <div className="border-t border-amber-300/15 bg-amber-500/[.08] px-3 py-2 text-[11px] leading-4 text-amber-100">{player.identityMessage || "This player is awaiting an official scoring link."}</div> : null}
                        </div>;
                      })}</div>
                    </> : null}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(expandedPlayer)} onOpenChange={(value) => { if (!value) setExpandedCardId(null); }}>
      <DialogContent className="max-h-[88dvh] w-[min(94vw,680px)] max-w-2xl gap-0 overflow-hidden border-white/10 bg-[#080d1f] p-0 text-white">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-200">Official player scoring</div>
          <DialogTitle className="mt-1 text-xl">{expandedPlayer?.name || "Player points"}</DialogTitle>
          <div className="text-xs text-white/50">{expandedPlayer?.position} • {expandedPlayer?.team} • {expandedPlayer?.minutes || 0} minutes</div>
        </DialogHeader>
        {expandedPlayer ? <div className="max-h-[calc(88dvh-105px)] overflow-y-auto overscroll-contain p-5">
          {expandedPlayer.identityMessage ? <div className={`mb-4 rounded-xl border px-3 py-2 text-xs ${expandedPlayer.identityStatus === "verified" ? "border-cyan-300/20 bg-cyan-400/[.06] text-cyan-100" : "border-amber-300/20 bg-amber-500/[.08] text-amber-100"}`}>{expandedPlayer.identityMessage}</div> : null}
          <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4"><div className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-100/70">Player total</div><div className="mt-1 text-3xl font-black text-emerald-200">{scoreLabel(expandedPlayer.points)} points</div></div>
          <div className="grid grid-cols-2 gap-2"><ScoreCategory label="Decisive" points={expandedPlayer.breakdown.decisive} /><ScoreCategory label="Performance" points={expandedPlayer.breakdown.performance} /><ScoreCategory label="Penalties" points={expandedPlayer.breakdown.penalties} /><ScoreCategory label="Bonus" points={expandedPlayer.breakdown.bonus} /></div>
          <div className="mt-4 text-[10px] font-black uppercase tracking-[.15em] text-white/45">How points were earned</div>
          {expandedPlayer.reasons.length ? <div className="mt-2 space-y-1.5">{expandedPlayer.reasons.map((reason, index) => <div key={`${reason.label}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/[.07] bg-white/[.035] px-2.5 py-2 text-xs"><span className="min-w-0 flex-1 text-white/75">{reason.label}</span><span className={`shrink-0 font-black ${Number(reason.points) < 0 ? "text-rose-300" : "text-emerald-200"}`}>{Number(reason.points) > 0 ? "+" : ""}{scoreLabel(reason.points)}</span></div>)}</div> : <div className="mt-2 rounded-lg border border-dashed border-white/10 px-2.5 py-3 text-xs text-white/50">No scoring actions recorded for this player yet.</div>}
          {expandedPlayer.captain ? <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-500/10 px-2.5 py-2 text-xs font-bold text-amber-100"><Crown className="mr-1 inline h-3.5 w-3.5" />Captain contribution: {scoreLabel(expandedPlayer.points)} + {scoreLabel(expandedPlayer.captainBonus)} bonus = {scoreLabel(expandedPlayer.contribution)} points</div> : null}
        </div> : null}
      </DialogContent>
    </Dialog>
  </>;
}

function ScoreCategory({ label, points }: { label: string; points: number }) {
  const value = Number(points || 0);
  return <div className="rounded-xl border border-white/10 bg-white/[.035] p-2"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/40">{label}</div><div className={`mt-1 text-sm font-black ${value < 0 ? "text-rose-300" : "text-emerald-200"}`}>{value > 0 ? "+" : ""}{scoreLabel(value)}</div></div>;
}

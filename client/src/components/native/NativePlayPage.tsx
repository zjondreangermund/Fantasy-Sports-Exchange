import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  KeyRound,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import CardPlayerImage from "../CardPlayerImage";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import type { CompetitionEntry, PlayerCardWithPlayer } from "../../../../shared/schema";
import {
  getTournamentRarityRequirement,
  isCardRarityAllowedInTournament,
  normalizeTournamentRarity,
  TOURNAMENT_UTILITY_POSITIONS,
  type TournamentRarity,
} from "../../../../shared/game-rules";

const rarities: TournamentRarity[] = ["common", "rare", "unique", "epic", "legendary"];
const slots = [
  { label: "GK", position: "GK" },
  { label: "DEF", position: "DEF" },
  { label: "MID", position: "MID" },
  { label: "FWD", position: "FWD" },
  { label: "UTIL", position: null },
] as const;

type Tournament = any;
type Tab = "cups" | "entries";

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `N$${amount.toFixed(2)}` : "N$0.00";
}

function normalizeLeague(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isPremierLeague(card: PlayerCardWithPlayer) {
  return ["premierleague", "englishpremierleague", "epl"].includes(normalizeLeague(card.player?.league))
    || (card.player as any)?.premierLeagueEligible === true;
}

function cardPosition(card: PlayerCardWithPlayer) {
  return String(card.player?.position || "").toUpperCase();
}

function utilityPosition(position: string) {
  return TOURNAMENT_UTILITY_POSITIONS.includes(position as typeof TOURNAMENT_UTILITY_POSITIONS[number]);
}

function lineupIds(entry: CompetitionEntry) {
  const raw = (entry as any).lineupCardIds ?? (entry as any).lineup_card_ids;
  return Array.isArray(raw) ? raw.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
}

function competitionId(entry: CompetitionEntry) {
  return Number((entry as any).competitionId ?? (entry as any).competition_id ?? 0);
}

function deadline(value: unknown) {
  if (!value) return "Entry window open";
  const date = new Date(value as any);
  if (!Number.isFinite(date.getTime())) return "Entry window open";
  return date.toLocaleString("en-NA", {
    timeZone: "Africa/Windhoek",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function NativePlayPage() {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("cups");
  const [rarity, setRarity] = React.useState<TournamentRarity>("common");
  const [selected, setSelected] = React.useState<Tournament | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Array<number | null>>([null, null, null, null, null]);
  const [activeSlot, setActiveSlot] = React.useState(0);
  const [captainId, setCaptainId] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [pinOpen, setPinOpen] = React.useState(false);
  const [pin, setPin] = React.useState("");

  const { data: competitions = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/competitions"],
    queryFn: async () => {
      const response = await fetch("/api/competitions", { credentials: "include" });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : data.competitions || [];
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
  });

  const { data: cards = [] } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const response = await fetch("/api/user/cards", { credentials: "include" });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : data.cards || [];
    },
    staleTime: 30_000,
  });

  const { data: entries = [] } = useQuery<CompetitionEntry[]>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const response = await fetch("/api/competitions/my-entries", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const publicCompetitions = React.useMemo(
    () => competitions.filter((item) => String(item.visibility || "public").toLowerCase() !== "private"),
    [competitions],
  );

  const currentGameweek = React.useMemo(() => {
    const active = publicCompetitions
      .filter((item) => ["open", "active"].includes(String(item.status || "").toLowerCase()))
      .map((item) => Number(item.gameWeek ?? item.game_week ?? 0))
      .filter(Boolean)
      .sort((a, b) => a - b);
    if (active.length) return active[0];
    const upcoming = publicCompetitions
      .filter((item) => String(item.status || "").toLowerCase() === "upcoming")
      .map((item) => Number(item.gameWeek ?? item.game_week ?? 0))
      .filter(Boolean)
      .sort((a, b) => a - b);
    return upcoming[0] || 1;
  }, [publicCompetitions]);

  const shown = React.useMemo(() => publicCompetitions
    .filter((item) => Number(item.gameWeek ?? item.game_week ?? 0) === currentGameweek)
    .filter((item) => normalizeTournamentRarity(item.tier) === rarity)
    .filter((item) => !["completed", "closed", "cancelled"].includes(String(item.status || "").toLowerCase()))
    .sort((a, b) => {
      const aOpen = String(a.status || "") === "open" ? 1 : 0;
      const bOpen = String(b.status || "") === "open" ? 1 : 0;
      return bOpen - aOpen || Number(a.entryFee || 0) - Number(b.entryFee || 0);
    }), [currentGameweek, publicCompetitions, rarity]);

  const competitionById = React.useMemo(
    () => new Map(competitions.map((item) => [Number(item.id), item])),
    [competitions],
  );

  const myEntryRows = React.useMemo(() => entries
    .map((entry) => ({ entry, competition: competitionById.get(competitionId(entry)) }))
    .filter((row) => row.competition)
    .sort((a, b) => Number(b.competition?.gameWeek || 0) - Number(a.competition?.gameWeek || 0)),
    [competitionById, entries],
  );

  const cardById = React.useMemo(() => new Map(cards.map((card) => [Number(card.id), card])), [cards]);
  const selectedCards = selectedIds.map((id) => id ? cardById.get(Number(id)) || null : null);
  const selectedTournamentId = Number(selected?.id || 0);
  const selectedTier = normalizeTournamentRarity(selected?.tier);
  const usedInTournament = React.useMemo(() => {
    const used = new Set<number>();
    if (!selectedTournamentId) return used;
    for (const entry of entries) {
      if (competitionId(entry) !== selectedTournamentId) continue;
      for (const id of lineupIds(entry)) used.add(id);
    }
    return used;
  }, [entries, selectedTournamentId]);

  const currentSlot = slots[activeSlot] || slots[0];
  const candidateCards = React.useMemo(() => {
    if (!selected) return [];
    const selectedPlayerIds = new Set(selectedCards.filter(Boolean).map((card) => Number(card!.playerId)));
    const currentId = selectedIds[activeSlot];
    const currentCard = currentId ? cardById.get(Number(currentId)) : null;
    const currentPlayerId = currentCard ? Number(currentCard.playerId) : null;
    const needle = search.trim().toLowerCase();
    return cards.filter((card) => {
      const id = Number(card.id);
      const position = cardPosition(card);
      const positionOk = activeSlot === 4 ? utilityPosition(position) : position === currentSlot.position;
      if (!positionOk || card.forSale || !isPremierLeague(card) || usedInTournament.has(id)) return false;
      if (!isCardRarityAllowedInTournament(card.rarity, selectedTier)) return false;
      if (selectedIds.includes(id) && id !== currentId) return false;
      const playerId = Number(card.playerId);
      if (selectedPlayerIds.has(playerId) && playerId !== currentPlayerId) return false;
      if (!needle) return true;
      const haystack = `${card.player?.name || ""} ${card.player?.team || ""} ${card.rarity || ""}`.toLowerCase();
      return haystack.includes(needle);
    }).sort((a, b) => Number((b as any).currentGameweekPoints || 0) - Number((a as any).currentGameweekPoints || 0));
  }, [activeSlot, cardById, cards, currentSlot.position, search, selected, selectedCards, selectedIds, selectedTier, usedInTournament]);

  const openTournament = React.useCallback((tournament: Tournament) => {
    if (String(tournament.status || "").toLowerCase() !== "open" || tournament.entryOpen === false) {
      toast({ title: "Entries are closed", description: "This cup is no longer accepting teams." });
      return;
    }
    setSelected(tournament);
    setSelectedIds([null, null, null, null, null]);
    setActiveSlot(0);
    setCaptainId(null);
    setSearch("");
  }, [toast]);

  const chooseCard = (card: PlayerCardWithPlayer) => {
    const next = [...selectedIds];
    const previous = next[activeSlot];
    next[activeSlot] = Number(card.id);
    setSelectedIds(next);
    if (previous && Number(previous) === captainId && Number(previous) !== Number(card.id)) setCaptainId(null);
    const nextEmpty = next.findIndex((id) => !id);
    setActiveSlot(nextEmpty === -1 ? 0 : nextEmpty);
    setSearch("");
  };

  const complete = selectedIds.every(Boolean) && selectedCards.every(Boolean);

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !complete || !captainId) throw new Error("Choose five cards and a captain first.");
      return (await apiRequest("POST", "/api/competitions/join", {
        competitionId: selected.id,
        cardIds: selectedIds.map(Number),
        captainId,
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions/my-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      setSelected(null);
      setTab("entries");
      toast({ title: "Team entered", description: "Your five-card team is locked for this tournament." });
    },
    onError: (error: any) => toast({ title: "Could not enter", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  const pinMutation = useMutation({
    mutationFn: async () => {
      const normalized = pin.trim().toUpperCase();
      if (!normalized) throw new Error("Enter the private cup PIN.");
      const response = await fetch(`/api/user-tournaments/pin/${encodeURIComponent(normalized)}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Tournament not found.");
      return body?.tournament;
    },
    onSuccess: (tournament) => {
      if (!tournament) return;
      setPin("");
      setPinOpen(false);
      openTournament(tournament);
    },
    onError: (error: any) => toast({ title: "PIN not found", description: error?.message || "Check the PIN and try again.", variant: "destructive" }),
  });

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-play>
      <section className="overflow-hidden rounded-[1.55rem] border border-white/[.08] bg-gradient-to-br from-violet-400/[.11] via-[#0a0e1c] to-cyan-300/[.06] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-200/70">Gameweek {currentGameweek}</p>
            <h2 className="mt-1 text-2xl font-black">Choose. Enter. Compete.</h2>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">Pick a cup, build five eligible Premier League cards, choose your captain and you are in.</p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-300/10 text-violet-200"><Trophy className="h-5 w-5" /></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1">
          <button onClick={() => setTab("cups")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${tab === "cups" ? "bg-white/10 text-white" : "text-slate-500"}`}>Open Cups</button>
          <button onClick={() => setTab("entries")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${tab === "entries" ? "bg-white/10 text-white" : "text-slate-500"}`}>My Entries · {myEntryRows.length}</button>
        </div>
      </section>

      {tab === "cups" ? (
        <>
          <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
            {rarities.map((item) => (
              <button key={item} onClick={() => setRarity(item)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] ${rarity === item ? "border-cyan-300/50 bg-cyan-300/12 text-cyan-100" : "border-white/8 bg-white/[.035] text-slate-500"}`}>{item}</button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">{getTournamentRarityRequirement(rarity).shortLabel}</p><p className="text-sm font-black">GW{currentGameweek} {rarity} cups</p></div>
            <button onClick={() => setPinOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300/15 bg-violet-300/[.06] px-3 py-2 text-[10px] font-black text-violet-200"><KeyRound className="h-3.5 w-3.5" />Private PIN</button>
          </div>

          {pinOpen ? (
            <div className="mt-2 flex gap-2 rounded-2xl border border-violet-300/15 bg-violet-300/[.05] p-2">
              <input value={pin} onChange={(event) => setPin(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") pinMutation.mutate(); }} placeholder="ENTER PIN" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-xs font-bold uppercase text-white outline-none" />
              <button onClick={() => pinMutation.mutate()} disabled={pinMutation.isPending} className="rounded-xl bg-violet-400 px-3 py-2.5 text-xs font-black text-white">{pinMutation.isPending ? "..." : "Find"}</button>
            </div>
          ) : null}

          <div className="mt-3 space-y-2.5">
            {isLoading ? <NativeEmpty title="Loading cups…" /> : shown.length ? shown.map((tournament) => (
              <TournamentRow key={tournament.id} tournament={tournament} onEnter={() => openTournament(tournament)} />
            )) : <NativeEmpty title={`No ${rarity} cup is open for GW${currentGameweek}.`} />}
          </div>

          <Link href="/competitions?nativeFull=1" className="mt-3 flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.025] px-3.5 py-3 text-xs font-bold text-slate-400">
            <span>Private cup creation, completed cups & full tournament tools</span><ChevronRight className="h-4 w-4" />
          </Link>
        </>
      ) : (
        <div className="mt-3 space-y-2.5">
          {myEntryRows.length ? myEntryRows.slice(0, 12).map(({ entry, competition }) => (
            <div key={(entry as any).id} className="rounded-2xl border border-white/[.08] bg-white/[.035] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-sm font-black">{competition?.name || "Tournament"}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">GW{competition?.gameWeek || competition?.game_week || "-"} · {String(competition?.tier || "common").toUpperCase()}</p></div>
                <span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-[10px] font-black text-emerald-200">ENTERED</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/[.06] pt-2.5 text-xs"><span className="text-slate-500">5 cards locked for this entry</span><Link href="/live-lineup" className="font-black text-cyan-200">View squad</Link></div>
            </div>
          )) : <NativeEmpty title="You have no tournament entries yet." />}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-[140] flex flex-col bg-[#050713] text-white" role="dialog" aria-modal="true" aria-label={`Enter ${selected.name}`}>
          <header className="flex shrink-0 items-center gap-3 border-b border-white/[.08] bg-[#080b19] px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
            <button onClick={() => setSelected(null)} className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5"><ArrowLeft className="h-5 w-5" /></button>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{selected.name}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{String(selected.tier || "common").toUpperCase()} · 5 cards · choose captain</p></div>
            <button onClick={() => setSelected(null)} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[.04]"><X className="h-5 w-5" /></button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-32 pt-3">
            <div className="grid grid-cols-5 gap-1.5">
              {slots.map((slot, index) => {
                const card = selectedCards[index];
                return <button key={slot.label} onClick={() => setActiveSlot(index)} className={`min-w-0 rounded-2xl border p-1.5 text-center ${activeSlot === index ? "border-cyan-300/45 bg-cyan-300/[.08]" : "border-white/[.07] bg-white/[.025]"}`}>
                  <div className="relative mx-auto h-10 w-10 overflow-hidden rounded-xl bg-white/5">{card ? <CardPlayerImage card={card} alt={card.player?.name || slot.label} className="h-full w-full object-cover object-top" /> : <span className="grid h-full w-full place-items-center text-[10px] font-black text-slate-600">{slot.label}</span>}</div>
                  <p className={`mt-1 truncate text-[9px] font-black ${card ? "text-white" : "text-slate-600"}`}>{card ? card.player?.name?.split(" ").slice(-1)[0] : slot.label}</p>
                </button>;
              })}
            </div>

            {complete ? (
              <section className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.05] p-3">
                <div className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-300" /><p className="text-xs font-black">Choose your captain</p></div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {selectedCards.filter(Boolean).map((card) => <button key={card!.id} onClick={() => setCaptainId(Number(card!.id))} className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black ${captainId === Number(card!.id) ? "border-amber-300/50 bg-amber-300/15 text-amber-100" : "border-white/8 bg-white/[.035] text-slate-400"}`}>{card!.player?.name?.split(" ").slice(-1)[0]}{captainId === Number(card!.id) ? " · C" : ""}</button>)}
                </div>
              </section>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-200/65">Choose {currentSlot.label}</p><p className="text-xs text-slate-500">{candidateCards.length} eligible cards</p></div>
              <div className="relative w-40"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="h-9 w-full rounded-xl border border-white/8 bg-white/[.035] pl-8 pr-2 text-xs outline-none" /></div>
            </div>

            <div className="mt-2 space-y-2">
              {candidateCards.length ? candidateCards.map((card) => (
                <button key={card.id} onClick={() => chooseCard(card)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] p-2.5 text-left active:scale-[.995]">
                  <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-900"><CardPlayerImage card={card} alt={card.player?.name || "Player"} className="h-full w-full object-cover object-top" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{card.player?.name || "Player"}</p><p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">{cardPosition(card)} · {card.player?.team || "Premier League"}</p><div className="mt-1 flex items-center gap-1.5"><span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[9px] font-black uppercase text-slate-300">{card.rarity}</span><span className="text-[9px] font-bold text-cyan-200">{Number((card as any).currentGameweekPoints || 0).toFixed(2)} PTS</span></div></div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                </button>
              )) : <NativeEmpty title={`No eligible ${currentSlot.label} card found.`} compact />}
            </div>
          </div>

          <footer className="absolute inset-x-0 bottom-0 border-t border-white/[.08] bg-[#080b19]/95 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)] pt-2.5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="truncate text-xs font-black">{selectedIds.filter(Boolean).length}/5 selected</p><p className="text-[10px] text-slate-500">{captainId ? "Captain chosen · ready to submit" : complete ? "Choose a captain" : "Complete all five positions"}</p></div>
              <button onClick={() => joinMutation.mutate()} disabled={!complete || !captainId || joinMutation.isPending} className="rounded-2xl bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-35">{joinMutation.isPending ? "Submitting…" : Number(selected.entryFee || 0) > 0 ? `Enter · ${money(selected.entryFee)}` : "Enter FREE"}</button>
            </div>
          </footer>
        </div>
      ) : null}
    </div>
  );
}

function TournamentRow({ tournament, onEnter }: { tournament: Tournament; onEnter: () => void }) {
  const open = String(tournament.status || "").toLowerCase() === "open" && tournament.entryOpen !== false;
  const fee = Number(tournament.entryFee || 0);
  const entryCount = Number(tournament.entryCount ?? tournament.entry_count ?? 0);
  return <div className="rounded-[1.35rem] border border-white/[.08] bg-gradient-to-r from-white/[.045] to-white/[.02] p-3.5">
    <div className="flex items-start gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/[.08] text-cyan-200"><Trophy className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-black">{tournament.name}</p>{fee <= 0 ? <span className="shrink-0 rounded-full bg-emerald-300/12 px-2 py-0.5 text-[9px] font-black text-emerald-200">FREE</span> : null}</div><p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">{entryCount} entries · {deadline(tournament.submissionClosesAt || tournament.startsAt)}</p></div>
    </div>
    <div className="mt-3 flex items-center justify-between border-t border-white/[.06] pt-2.5"><div className="flex items-center gap-2 text-[10px] text-slate-500"><UsersRound className="h-3.5 w-3.5" /><span>5-card team</span><ShieldCheck className="ml-1 h-3.5 w-3.5" /><span>Premier League</span></div><button onClick={onEnter} disabled={!open} className="rounded-xl bg-cyan-300 px-3.5 py-2 text-[10px] font-black text-slate-950 disabled:bg-white/5 disabled:text-slate-600">{open ? fee > 0 ? money(fee) : "Enter" : "Closed"}</button></div>
  </div>;
}

function NativeEmpty({ title, compact = false }: { title: string; compact?: boolean }) {
  return <div className={`rounded-2xl border border-dashed border-white/[.08] bg-white/[.02] text-center text-xs text-slate-500 ${compact ? "p-4" : "p-7"}`}><Sparkles className="mx-auto mb-2 h-4 w-4 text-slate-700" />{title}</div>;
}

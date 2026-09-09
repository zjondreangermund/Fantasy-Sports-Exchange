import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crown,
  Eye,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import { normalizeTournamentRarity, type TournamentRarity } from "../../../../shared/game-rules";

type Tournament = any;

type TournamentLeaderboardEntry = {
  entryId: number;
  userId?: string;
  teamName: string;
  totalScore: number;
  rank: number;
  captainId?: number | null;
  isViewer?: boolean;
  behindLeader?: number;
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
  breakdown: {
    decisive: number;
    performance: number;
    penalties: number;
    bonus: number;
  };
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

type Props = {
  tournament: Tournament;
  onClose: () => void;
};

type LeaderboardTone = {
  accent: string;
  border: string;
  soft: string;
  text: string;
  glow: string;
};

const toneByRarity: Record<TournamentRarity, LeaderboardTone> = {
  common: {
    accent: "#cffafe",
    border: "border-cyan-100/55",
    soft: "bg-cyan-100/[.08]",
    text: "text-cyan-100",
    glow: "shadow-[0_0_28px_rgba(207,250,254,.16)]",
  },
  rare: {
    accent: "#60a5fa",
    border: "border-blue-400/55",
    soft: "bg-blue-500/[.10]",
    text: "text-blue-100",
    glow: "shadow-[0_0_30px_rgba(59,130,246,.20)]",
  },
  unique: {
    accent: "#d946ef",
    border: "border-fuchsia-400/55",
    soft: "bg-fuchsia-500/[.10]",
    text: "text-fuchsia-100",
    glow: "shadow-[0_0_30px_rgba(217,70,239,.22)]",
  },
  epic: {
    accent: "#fb7185",
    border: "border-rose-400/55",
    soft: "bg-rose-500/[.10]",
    text: "text-rose-100",
    glow: "shadow-[0_0_30px_rgba(244,63,94,.22)]",
  },
  legendary: {
    accent: "#fbbf24",
    border: "border-amber-300/60",
    soft: "bg-amber-300/[.10]",
    text: "text-amber-100",
    glow: "shadow-[0_0_30px_rgba(251,191,36,.22)]",
  },
};

function scoreLabel(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function updatedLabel(value: unknown) {
  if (!value) return "Awaiting match update";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "Awaiting match update";
  return date.toLocaleString("en-NA", {
    timeZone: "Africa/Windhoek",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function playerInitials(name: string) {
  return String(name || "Player")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function NativeTournamentLeaderboard({ tournament, onClose }: Props) {
  const [page, setPage] = React.useState(1);
  const [selectedEntry, setSelectedEntry] = React.useState<TournamentLeaderboardEntry | null>(null);
  const [expandedCardId, setExpandedCardId] = React.useState<number | null>(null);
  const competitionId = Number(tournament?.id || 0);
  const rarity = normalizeTournamentRarity(tournament?.tier);
  const tone = toneByRarity[rarity];
  const gameweek = Number(tournament?.gameWeek ?? tournament?.game_week ?? 0);

  const leaderboardQuery = useQuery<TournamentLeaderboardPayload>({
    queryKey: ["/api/competitions/native-leaderboard", competitionId, page],
    queryFn: async () => {
      const response = await fetch(
        `/api/competitions/${competitionId}/leaderboard?page=${page}&pageSize=25`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to load the tournament leaderboard");
      return response.json();
    },
    enabled: competitionId > 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const teamQuery = useQuery<TournamentTeamDetails>({
    queryKey: ["/api/competitions/native-entry-score", competitionId, selectedEntry?.entryId || 0],
    queryFn: async () => {
      const response = await fetch(
        `/api/competitions/${competitionId}/entries/${selectedEntry?.entryId}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to load the submitted team");
      return response.json();
    },
    enabled: competitionId > 0 && Number(selectedEntry?.entryId || 0) > 0,
    refetchInterval: selectedEntry ? 15_000 : false,
    refetchOnWindowFocus: true,
  });

  const leaderboard = leaderboardQuery.data;
  const rows = Array.isArray(leaderboard?.leaderboard) ? leaderboard!.leaderboard : [];
  const totalEntries = Number(leaderboard?.totalEntries ?? tournament?.entryCount ?? tournament?.entry_count ?? 0);
  const totalPages = Math.max(1, Number(leaderboard?.totalPages || 1));
  const viewer = leaderboard?.viewerEntry || null;
  const viewerShown = viewer ? rows.some((row) => Number(row.entryId) === Number(viewer.entryId)) : false;
  const team = teamQuery.data;
  const expandedPlayer = team?.players?.find((player) => Number(player.cardId) === Number(expandedCardId || 0)) || null;

  const openEntry = (entry: TournamentLeaderboardEntry) => {
    setSelectedEntry(entry);
    setExpandedCardId(null);
  };

  const back = () => {
    if (selectedEntry) {
      setSelectedEntry(null);
      setExpandedCardId(null);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-[#050713] text-white" role="dialog" aria-modal="true" aria-label={`${tournament?.name || "Tournament"} leaderboard`} data-native-tournament-leaderboard>
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[.08] bg-[#080b19] px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <button type="button" onClick={back} className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5" aria-label={selectedEntry ? "Back to leaderboard" : "Close leaderboard"}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{selectedEntry ? selectedEntry.teamName : tournament?.name || "Tournament"}</p>
          <p className={`mt-0.5 text-[10px] font-black uppercase tracking-[.13em] ${tone.text}`}>
            {selectedEntry ? `GW${gameweek || "-"} · team scoring` : `GW${gameweek || "-"} · ${String(rarity).toUpperCase()} leaderboard`}
          </p>
        </div>
        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[.04]" aria-label="Close leaderboard">
          <X className="h-5 w-5" />
        </button>
      </header>

      {!selectedEntry ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3">
          <section className={`rounded-2xl border p-3.5 ${tone.border} ${tone.soft} ${tone.glow}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${tone.border} ${tone.soft} ${tone.text}`}><Trophy className="h-5 w-5" /></div>
                <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">Live standings</p><p className="mt-0.5 truncate text-sm font-black">{totalEntries} entered teams</p></div>
              </div>
              <div className="shrink-0 text-right"><div className="inline-flex items-center gap-1 rounded-full bg-emerald-300/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-200"><Activity className="h-3 w-3" />Live</div><p className="mt-1 text-[9px] font-bold text-white/35">refresh 15s</p></div>
            </div>
          </section>

          <div className="mt-3 grid grid-cols-[42px_minmax(0,1fr)_72px] gap-2 px-2 text-[9px] font-black uppercase tracking-[.13em] text-white/35">
            <span>Rank</span><span>Entered team</span><span className="text-right">Points</span>
          </div>

          <div className="mt-2 space-y-1.5">
            {leaderboardQuery.isLoading ? (
              <LeaderboardNotice text="Loading leaderboard…" />
            ) : leaderboardQuery.isError ? (
              <LeaderboardNotice text="Could not load this leaderboard." error />
            ) : rows.length ? rows.map((entry) => (
              <button
                key={entry.entryId}
                type="button"
                onClick={() => openEntry(entry)}
                className={`grid w-full grid-cols-[42px_minmax(0,1fr)_72px] items-center gap-2 rounded-xl border px-2.5 py-3 text-left transition active:scale-[.995] ${entry.isViewer ? `${tone.border} ${tone.soft}` : "border-white/[.07] bg-white/[.035]"}`}
              >
                <span className="text-xs font-black" style={{ color: Number(entry.rank) <= 3 ? tone.accent : "rgba(255,255,255,.62)" }}>#{entry.rank}</span>
                <span className="min-w-0"><span className="block truncate text-xs font-black text-white">{entry.teamName || "Manager"}</span>{entry.isViewer ? <span className={`mt-0.5 block text-[8px] font-black uppercase tracking-[.12em] ${tone.text}`}>Your team</span> : null}</span>
                <span className="text-right text-xs font-black text-emerald-200">{scoreLabel(entry.totalScore)}</span>
              </button>
            )) : (
              <LeaderboardNotice text="No teams have entered this tournament yet." />
            )}
          </div>

          {viewer && !viewerShown ? (
            <button type="button" onClick={() => openEntry(viewer)} className={`mt-3 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${tone.border} ${tone.soft}`}>
              <div className="min-w-0"><p className={`text-[9px] font-black uppercase tracking-[.14em] ${tone.text}`}>Your position</p><p className="mt-0.5 truncate text-xs font-black">#{viewer.rank} · {viewer.teamName || "Your team"}</p></div>
              <div className="shrink-0 text-right"><p className="text-sm font-black text-emerald-200">{scoreLabel(viewer.totalScore)} pts</p>{Number(viewer.behindLeader || 0) > 0 ? <p className="text-[9px] text-white/35">-{scoreLabel(viewer.behindLeader)} from lead</p> : null}</div>
            </button>
          ) : null}

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] p-2">
            <div>{page > 1 ? <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] font-black"><ChevronLeft className="h-3.5 w-3.5" />Prev</button> : null}</div>
            <div className="text-center"><p className="text-[10px] font-black text-white/70">Page {page} / {totalPages}</p><p className="mt-0.5 text-[8px] font-bold uppercase tracking-[.11em] text-white/30">25 teams per page</p></div>
            <div className="text-right">{page < totalPages ? <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] font-black">Next<ChevronRight className="h-3.5 w-3.5" /></button> : null}</div>
          </div>

          <p className="mt-3 px-1 text-[9px] font-semibold leading-4 text-white/30">Tap a team to open all five cards, captain contribution and the exact Fantasy Arena scoring actions.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3">
          {teamQuery.isLoading ? (
            <LeaderboardNotice text="Loading submitted team…" />
          ) : teamQuery.isError ? (
            <LeaderboardNotice text="Could not load this team’s scoring details." error />
          ) : team ? (
            <>
              <section className={`rounded-2xl border p-3.5 ${tone.border} ${tone.soft} ${tone.glow}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className={`text-[9px] font-black uppercase tracking-[.15em] ${tone.text}`}>Submitted lineup</p><h3 className="mt-1 truncate text-lg font-black">{team.teamName}</h3></div>
                  <div className="shrink-0 rounded-full bg-emerald-300/10 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-200">{team.finalized ? "Final" : "Live"}</div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/[.07] pt-3">
                  <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">Total points</p><p className="mt-1 text-3xl font-black text-emerald-200">{scoreLabel(team.totalScore)}</p></div>
                  <div className="text-right text-[9px] font-semibold leading-4 text-white/35">{updatedLabel(team.updatedAt)}{Number(team.captainBonus || 0) !== 0 ? <span className="mt-1 block text-amber-200"><Crown className="mr-1 inline h-3 w-3" />Captain +{scoreLabel(team.captainBonus)}</span> : null}</div>
                </div>
              </section>

              <div className="mt-3 space-y-2">
                {(Array.isArray(team.players) ? team.players : []).map((player) => {
                  const expanded = Number(expandedCardId || 0) === Number(player.cardId);
                  return (
                    <div key={player.cardId} className={`overflow-hidden rounded-2xl border ${expanded ? `${tone.border} ${tone.soft}` : "border-white/[.08] bg-white/[.03]"}`}>
                      <button type="button" onClick={() => setExpandedCardId(expanded ? null : Number(player.cardId))} className="flex w-full items-center gap-3 p-3 text-left">
                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 text-xs font-black text-white/45">
                          {player.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : playerInitials(player.name)}
                        </div>
                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</p><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[.09em] text-white/35">{player.position} · {player.team} · {player.minutes || 0} min</p></div>
                        <div className="shrink-0 text-right"><p className="text-sm font-black text-emerald-200">{scoreLabel(player.contribution)} pts</p><p className="text-[8px] font-black uppercase tracking-[.09em] text-white/30">team pts</p></div>
                        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-white/35" /> : <ChevronDown className="h-4 w-4 shrink-0 text-white/35" />}
                      </button>

                      {player.identityStatus && player.identityStatus !== "verified" ? <div className="border-t border-amber-300/15 bg-amber-500/[.08] px-3 py-2 text-[10px] leading-4 text-amber-100">{player.identityMessage || "This player is awaiting an official scoring link."}</div> : null}

                      {expanded ? (
                        <div className="border-t border-white/[.07] px-3 pb-3 pt-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <ScoreCell label="Decisive" value={player.breakdown?.decisive} />
                            <ScoreCell label="Performance" value={player.breakdown?.performance} />
                            <ScoreCell label="Penalties" value={player.breakdown?.penalties} />
                            <ScoreCell label="Bonus" value={player.breakdown?.bonus} />
                          </div>

                          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[.07] bg-black/20 px-3 py-2 text-[10px]"><span className="text-white/45">Player score</span><span className="font-black text-emerald-200">{scoreLabel(player.points)} pts</span></div>
                          {player.captain ? <div className="mt-1.5 flex items-center justify-between rounded-xl border border-amber-300/15 bg-amber-500/[.07] px-3 py-2 text-[10px]"><span className="text-amber-100/70">Captain bonus</span><span className="font-black text-amber-200">+{scoreLabel(player.captainBonus)} pts</span></div> : null}

                          <p className="mt-3 text-[9px] font-black uppercase tracking-[.13em] text-white/35">How points were earned</p>
                          {Array.isArray(player.reasons) && player.reasons.length ? (
                            <div className="mt-1.5 space-y-1.5">
                              {player.reasons.map((reason, index) => (
                                <div key={`${reason.label}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/[.06] bg-white/[.025] px-2.5 py-2 text-[10px]"><span className="min-w-0 flex-1 text-white/65">{reason.label}</span><span className={`shrink-0 font-black ${Number(reason.points) < 0 ? "text-rose-300" : "text-emerald-200"}`}>{Number(reason.points) > 0 ? "+" : ""}{scoreLabel(reason.points)}</span></div>
                              ))}
                            </div>
                          ) : <p className="mt-1.5 rounded-lg border border-dashed border-white/[.07] px-2.5 py-3 text-[10px] text-white/35">No scoring actions recorded yet.</p>}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={() => { setSelectedEntry(null); setExpandedCardId(null); }} className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black ${tone.border} ${tone.soft} ${tone.text}`}><Eye className="h-4 w-4" />Back to all teams</button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ScoreCell({ label, value }: { label: string; value: unknown }) {
  const amount = Number(value || 0);
  return <div className="rounded-xl border border-white/[.07] bg-black/20 p-2.5"><p className="text-[8px] font-black uppercase tracking-[.11em] text-white/30">{label}</p><p className={`mt-1 text-xs font-black ${amount < 0 ? "text-rose-300" : "text-emerald-200"}`}>{amount > 0 ? "+" : ""}{scoreLabel(amount)}</p></div>;
}

function LeaderboardNotice({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={`rounded-xl border p-5 text-center text-xs ${error ? "border-rose-300/20 bg-rose-500/[.08] text-rose-100" : "border-white/[.07] bg-white/[.025] text-white/45"}`}><UsersRound className="mx-auto mb-2 h-4 w-4 opacity-60" />{text}</div>;
}

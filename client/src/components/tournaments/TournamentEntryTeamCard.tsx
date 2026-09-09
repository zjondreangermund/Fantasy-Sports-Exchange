import { useQuery } from "@tanstack/react-query";
import { Activity, Crown, ShieldCheck, Trophy } from "lucide-react";
import { Link } from "wouter";

type RarityKey = "common" | "rare" | "unique" | "epic" | "legendary";

type TournamentPlayer = {
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
  identityStatus?: string;
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
  players: TournamentPlayer[];
};

const tone: Record<RarityKey, { accent: string; border: string; soft: string; glow: string }> = {
  common: { accent: "#e2e8f0", border: "rgba(226,232,240,.24)", soft: "rgba(226,232,240,.055)", glow: "rgba(226,232,240,.10)" },
  rare: { accent: "#38bdf8", border: "rgba(56,189,248,.34)", soft: "rgba(56,189,248,.07)", glow: "rgba(56,189,248,.16)" },
  unique: { accent: "#c084fc", border: "rgba(192,132,252,.35)", soft: "rgba(168,85,247,.08)", glow: "rgba(168,85,247,.18)" },
  epic: { accent: "#fb7185", border: "rgba(251,113,133,.38)", soft: "rgba(244,63,94,.08)", glow: "rgba(244,63,94,.18)" },
  legendary: { accent: "#fbbf24", border: "rgba(251,191,36,.40)", soft: "rgba(251,191,36,.08)", glow: "rgba(251,191,36,.18)" },
};

function rarityOf(value: unknown): RarityKey {
  const key = String(value || "common").toLowerCase() as RarityKey;
  return tone[key] ? key : "common";
}

function score(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function entryCompetitionId(entry: any) {
  return Number(entry?.competitionId ?? entry?.competition_id ?? 0);
}

export default function TournamentEntryTeamCard({ entry, competition, compact = false }: { entry: any; competition: any; compact?: boolean }) {
  const entryId = Number(entry?.id || 0);
  const competitionId = entryCompetitionId(entry) || Number(competition?.id || 0);
  const rarity = rarityOf(competition?.tier);
  const theme = tone[rarity];
  const status = String(competition?.status || "open").toLowerCase();
  const isLive = ["open", "active", "closed"].includes(status);

  const { data: team, isLoading, isError } = useQuery<TournamentTeamDetails>({
    queryKey: ["/api/competitions/entry-score", competitionId, entryId],
    queryFn: async () => {
      const response = await fetch(`/api/competitions/${competitionId}/entries/${entryId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load submitted tournament team");
      return response.json();
    },
    enabled: competitionId > 0 && entryId > 0,
    refetchInterval: isLive ? 15_000 : false,
    refetchOnWindowFocus: true,
  });

  const totalScore = team?.totalScore ?? entry?.totalScore ?? entry?.total_score ?? 0;
  const teamName = team?.teamName || entry?.teamName || entry?.team_name || `Entry #${entryId}`;
  const players = team?.players || [];

  return (
    <article
      className="relative overflow-hidden rounded-[1.35rem] border bg-black/25 p-3.5"
      style={{ borderColor: theme.border, background: `linear-gradient(135deg, ${theme.soft}, rgba(2,6,23,.72))`, boxShadow: `0 0 28px ${theme.glow}` }}
      data-tournament-entry-team={entryId}
    >
      <span className="absolute inset-y-4 left-0 w-0.5 rounded-full" style={{ background: theme.accent }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em]" style={{ color: theme.accent }}>
            <Trophy className="h-3.5 w-3.5" /> GW{competition?.gameWeek || competition?.game_week || team?.gameWeek || "-"} · {rarity}
          </div>
          <h3 className="mt-1 truncate text-sm font-black text-white">{competition?.name || team?.competitionName || "Tournament"}</h3>
          <p className="mt-0.5 truncate text-[11px] font-bold text-slate-400">{teamName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-black text-emerald-200">{score(totalScore)}</p>
          <p className="text-[8px] font-black uppercase tracking-[.13em] text-slate-500">team pts</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase tracking-[.09em]">
        <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.border, color: theme.accent, background: theme.soft }}>{rarity}</span>
        <span className={`rounded-full px-2 py-1 ${team?.finalized || ["completed", "cancelled"].includes(status) ? "bg-slate-500/10 text-slate-300" : "bg-emerald-300/10 text-emerald-200"}`}>{team?.finalized ? "FINAL" : status === "active" ? "LIVE" : status.toUpperCase()}</span>
        {Number(team?.captainBonus || 0) !== 0 ? <span className="rounded-full bg-amber-300/10 px-2 py-1 text-amber-200"><Crown className="mr-1 inline h-3 w-3" />+{score(team?.captainBonus)} captain</span> : null}
      </div>

      <div className={`mt-3 ${compact ? "space-y-1.5" : "grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5"}`}>
        {isLoading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-white/[.035]" />)
          : isError ? <div className="col-span-full rounded-xl border border-amber-300/15 bg-amber-400/[.06] p-3 text-xs text-amber-100">This submitted lineup could not be loaded right now.</div>
            : players.length ? players.map((player) => <div key={player.cardId} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[.07] bg-black/25 p-2">
              <div className="grid h-11 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 text-[9px] font-black text-slate-500">
                {player.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : player.position}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1"><p className="truncate text-[11px] font-black text-white">{player.name}</p>{player.captain ? <Crown className="h-3 w-3 shrink-0 text-amber-300" /> : null}</div>
                <p className="truncate text-[8px] font-bold uppercase tracking-[.09em] text-slate-500">{player.position} · {player.team}</p>
              </div>
              <div className="shrink-0 text-right"><p className="text-[11px] font-black text-cyan-100">{score(player.contribution)}</p><p className="text-[7px] font-black uppercase text-slate-600">pts</p></div>
            </div>) : <div className="col-span-full rounded-xl border border-dashed border-white/[.08] p-3 text-center text-xs text-slate-500">No submitted cards are available for this entry yet.</div>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[.06] pt-2.5 text-[10px]">
        <span className="flex items-center gap-1.5 text-slate-500"><ShieldCheck className="h-3.5 w-3.5" />Submitted tournament team · locked to this entry</span>
        <Link href="/competitions" className="flex shrink-0 items-center gap-1 font-black" style={{ color: theme.accent }}><Activity className="h-3.5 w-3.5" />Play</Link>
      </div>
    </article>
  );
}

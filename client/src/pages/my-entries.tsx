import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Award, CalendarDays, CheckCircle2, Clock3, Crown, Gift, Lock, ShieldCheck, Trophy, Users } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import type { CompetitionEntry, PlayerCardWithPlayer } from "../../../shared/schema";

type Tournament = any;
type Entry = CompetitionEntry & Record<string, any>;

type ScoringSnapshot = {
  gameWeek?: number;
  final?: boolean;
  complete?: boolean;
  captainBonus?: number;
  captainBasePoints?: number;
  totalScore?: number;
  updatedAt?: string;
};

type PrizeAward = {
  key?: string;
  title?: string;
  value?: number;
  category?: string;
};

const rarityAccent: Record<string, string> = {
  common: "#60a5fa",
  rare: "#22d3ee",
  unique: "#c084fc",
  epic: "#fb3b4a",
  legendary: "#f59e0b",
};

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function entryCompetitionId(entry: Entry) {
  return numberValue(entry.competitionId ?? entry.competition_id);
}

function entryCardIds(entry: Entry) {
  const raw = entry.lineupCardIds ?? entry.lineup_card_ids;
  return Array.isArray(raw) ? raw.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
}

function dateTime(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not available";
}

function money(value: unknown) {
  return `N$${numberValue(value).toFixed(2)}`;
}

function statusLabel(status: string) {
  if (status === "completed") return "Settled";
  if (status === "closed") return "Awaiting settlement";
  if (status === "active") return "Live & locked";
  if (status === "cancelled") return "Cancelled";
  return "Submitted & locked";
}

export default function MyEntriesPage() {
  const { data: entries = [], isLoading: entriesLoading } = useQuery<Entry[]>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const response = await fetch("/api/competitions/my-entries", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load submitted teams");
      const body = await response.json();
      return Array.isArray(body) ? body : [];
    },
    refetchInterval: 30000,
  });

  const { data: competitions = [] } = useQuery<Tournament[]>({
    queryKey: ["/api/competitions"],
    queryFn: async () => {
      const response = await fetch("/api/competitions", { credentials: "include" });
      if (!response.ok) return [];
      const body = await response.json();
      return Array.isArray(body) ? body : body?.competitions || [];
    },
    refetchInterval: 30000,
  });

  const { data: cards = [] } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const response = await fetch("/api/user/cards", { credentials: "include" });
      if (!response.ok) return [];
      const body = await response.json();
      return Array.isArray(body) ? body : body?.cards || [];
    },
  });

  const competitionById = useMemo(() => new Map(competitions.map((competition) => [numberValue(competition.id), competition])), [competitions]);
  const cardById = useMemo(() => new Map(cards.map((card) => [numberValue(card.id), card])), [cards]);
  const sortedEntries = useMemo(() => [...entries].sort((a, b) => new Date(String(b.joinedAt ?? b.joined_at ?? 0)).getTime() - new Date(String(a.joinedAt ?? a.joined_at ?? 0)).getTime()), [entries]);
  const settledCount = sortedEntries.filter((entry) => String(competitionById.get(entryCompetitionId(entry))?.status || "") === "completed").length;
  const liveCount = sortedEntries.filter((entry) => ["open", "active", "closed"].includes(String(competitionById.get(entryCompetitionId(entry))?.status || ""))).length;
  const prizeClaims = sortedEntries.filter((entry) => Boolean(asObject(asObject(entry.tiebreakMeta ?? entry.tiebreak_meta).settlement).prizeAward)).length;

  return (
    <main className="relative flex-1 overflow-y-auto bg-[#02040c] px-3 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,.2),transparent_35%),linear-gradient(145deg,#0b1020,#050711)] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-200/70">Competition records</div>
              <h1 className="mt-2 text-4xl font-black sm:text-6xl">My Teams & Prizes</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">Every submitted team is shown separately. Lineups and captains are final after submission, and live results update from the correct Premier League gameweek.</p>
            </div>
            <Link href="/competitions"><Button className="bg-cyan-500 font-black text-black hover:bg-cyan-400"><Trophy className="mr-2 h-4 w-4" />Enter tournament</Button></Link>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <SummaryStat icon={Users} label="Teams" value={String(sortedEntries.length)} />
            <SummaryStat icon={Clock3} label="Live / locked" value={String(liveCount)} />
            <SummaryStat icon={Award} label="Prize claims" value={String(prizeClaims)} />
          </div>
        </section>

        {entriesLoading ? (
          <Card className="border-white/10 bg-white/[.04] p-8 text-center text-white/50">Loading your submitted teams…</Card>
        ) : sortedEntries.length === 0 ? (
          <Card className="border-white/10 bg-white/[.04] p-8 text-center">
            <Trophy className="mx-auto h-10 w-10 text-cyan-300" />
            <h2 className="mt-3 text-xl font-black">No tournament teams submitted yet</h2>
            <p className="mt-2 text-sm text-white/50">Choose a rarity tournament and build your first five-card Premier League team.</p>
            <Link href="/competitions"><Button className="mt-5">Open tournaments</Button></Link>
          </Card>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {sortedEntries.map((entry) => {
              const competition = competitionById.get(entryCompetitionId(entry));
              const status = String(competition?.status || "open").toLowerCase();
              const rarity = String(competition?.tier || "common").toLowerCase();
              const accent = rarityAccent[rarity] || rarityAccent.common;
              const lineup = entryCardIds(entry).map((cardId) => cardById.get(cardId)).filter(Boolean) as PlayerCardWithPlayer[];
              const captainId = numberValue(entry.captainId ?? entry.captain_id);
              const meta = asObject(entry.tiebreakMeta ?? entry.tiebreak_meta);
              const scoring = asObject(meta.scoring) as ScoringSnapshot;
              const settlement = asObject(meta.settlement);
              const prizeAward = asObject(settlement.prizeAward) as PrizeAward;
              const rank = numberValue(entry.rank);
              const score = numberValue(entry.totalScore ?? entry.total_score, numberValue(scoring.totalScore));
              const prizeAmount = numberValue(entry.prizeAmount ?? entry.prize_amount);

              return (
                <Card key={numberValue(entry.id)} className="overflow-hidden rounded-[2rem] border bg-gradient-to-br from-slate-950 via-slate-950 to-black p-0 text-white" style={{ borderColor: `${accent}55`, boxShadow: `0 18px 55px rgba(0,0,0,.45),0 0 28px ${accent}18` }}>
                  <div className="border-b border-white/10 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color: accent }}>{rarity} • GW{numberValue(competition?.gameWeek ?? competition?.game_week ?? scoring.gameWeek)}</div>
                        <h2 className="mt-2 text-2xl font-black">{competition?.name || `Tournament #${entryCompetitionId(entry)}`}</h2>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/50"><span><CalendarDays className="mr-1 inline h-3.5 w-3.5" />Submitted {dateTime(entry.joinedAt ?? entry.joined_at)}</span><span>Entry #{numberValue(entry.id)}</span></div>
                      </div>
                      <Badge className="capitalize" style={{ background: `${accent}22`, color: accent }}>{statusLabel(status)}</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <EntryMetric label="Score" value={scoring.complete || status === "completed" ? String(score) : `${score} live`} />
                      <EntryMetric label="Rank" value={rank > 0 ? `#${rank}` : "Pending"} />
                      <EntryMetric label="Captain bonus" value={scoring.captainBonus !== undefined ? `+${numberValue(scoring.captainBonus).toFixed(1)}` : "Pending"} />
                      <EntryMetric label="Cash payout" value={prizeAmount > 0 ? money(prizeAmount) : "—"} />
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3"><h3 className="font-black">Submitted lineup</h3><span className="inline-flex items-center gap-1 text-xs text-white/40"><Lock className="h-3.5 w-3.5" />Final</span></div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
                      {lineup.map((card) => {
                        const captain = numberValue(card.id) === captainId;
                        return (
                          <div key={card.id} className="relative min-w-0 rounded-2xl border border-white/10 bg-white/[.04] p-3 text-center">
                            <div className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 text-xs font-black text-white/40">
                              {card.player?.imageUrl ? <img src={card.player.imageUrl} alt={card.player.name} className="h-full w-full object-cover object-top" /> : String(card.player?.name || "FA").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="mt-2 truncate text-[11px] font-black">{card.player?.name || `Card ${card.id}`}</div>
                            <div className="mt-1 truncate text-[9px] uppercase tracking-[.12em] text-white/35">{card.player?.position} • {card.player?.team}</div>
                            {captain ? <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-2 py-1 text-[9px] font-black text-black"><Crown className="h-3 w-3" />Captain</div> : null}
                          </div>
                        );
                      })}
                    </div>
                    {lineup.length !== 5 ? <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-xs text-amber-100">Some historical card details could not be loaded, but the submitted card IDs and locked score record remain preserved.</div> : null}

                    {prizeAward.title ? (
                      <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4">
                        <div className="flex gap-3"><Gift className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-200/70">Prize claim pending</div><div className="mt-1 font-black text-emerald-50">{prizeAward.title}</div><div className="mt-1 text-sm text-emerald-100/65">Reference: competition {entryCompetitionId(entry)}, entry {numberValue(entry.id)}. Contact support to complete any required identity and delivery checks.</div><a href={`mailto:support@fantasyarena.com?subject=${encodeURIComponent(`Prize claim competition ${entryCompetitionId(entry)} entry ${numberValue(entry.id)}`)}`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-emerald-950"><CheckCircle2 className="h-4 w-4" />Start prize claim</a></div></div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-white/40">
                      <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />{scoring.final ? "Final scoring snapshot stored" : "Live score remains provisional"}</span>
                      {scoring.updatedAt ? <span>Updated {dateTime(scoring.updatedAt)}</span> : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
        )}

        {settledCount > 0 ? <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-white/45">Settled teams remain here as permanent competition records. Cards are released after settlement or cancellation.</div> : null}
      </div>
    </main>
  );
}

function SummaryStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/40"><Icon className="h-3.5 w-3.5 text-cyan-300" />{label}</div><div className="mt-2 text-xl font-black">{value}</div></div>;
}

function EntryMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase tracking-[.13em] text-white/35">{label}</div><div className="mt-1 truncate text-sm font-black">{value}</div></div>;
}

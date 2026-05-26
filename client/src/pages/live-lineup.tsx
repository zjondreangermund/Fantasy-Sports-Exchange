import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDown, ArrowUp, CircleDot, Swords, Trophy, Zap } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import PlayerTile from "../components/PlayerTile";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";
import { Link } from "wouter";

type LivePointEvent = {
  id: string;
  gameId: number;
  team: string;
  delta: number;
  reason: string;
  createdAt: string;
};

type LineupSlot = "GK" | "DEF" | "MID" | "FWD" | "UTIL";

function normalizePosition(value: unknown): LineupSlot {
  const text = String(value || "").toUpperCase();
  if (text.includes("GK") || text.includes("GOAL")) return "GK";
  if (text.includes("DEF") || text.includes("CB") || text.includes("LB") || text.includes("RB")) return "DEF";
  if (text.includes("MID") || text.includes("CM") || text.includes("DM") || text.includes("AM")) return "MID";
  if (text.includes("FWD") || text.includes("ST") || text.includes("FW") || text.includes("ATT")) return "FWD";
  return "UTIL";
}

function getScores(card: PlayerCardWithPlayer) {
  const scores = Array.isArray(card.last5Scores) ? card.last5Scores.map((v: any) => Number(v || 0)) : [];
  while (scores.length < 5) scores.push(0);
  return scores.slice(0, 5);
}

function getCardPoints(card: PlayerCardWithPlayer) {
  const scores = getScores(card);
  const total = scores.reduce((sum, value) => sum + value, 0);
  const last = scores.filter(Boolean).slice(-1)[0] || Number(card.decisiveScore || card.player?.overall || 0);
  return { total: Math.round(total * 10) / 10, last: Math.round(last * 10) / 10 };
}

function shortTeam(value: unknown) {
  return String(value || "FA").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "FA";
}

function eventMatchesCard(event: LivePointEvent, card: PlayerCardWithPlayer) {
  const team = String(card.player?.team || "").toLowerCase();
  const eventTeam = String(event.team || "").toLowerCase();
  return Boolean(team && eventTeam && (team.includes(eventTeam) || eventTeam.includes(team) || shortTeam(team).toLowerCase() === shortTeam(eventTeam).toLowerCase()));
}

function buildSlots(cards: PlayerCardWithPlayer[]) {
  const empty: Record<LineupSlot, PlayerCardWithPlayer | null> = { GK: null, DEF: null, MID: null, FWD: null, UTIL: null };
  for (const card of cards) {
    const slot = normalizePosition(card.player?.position);
    if (slot !== "UTIL" && !empty[slot]) empty[slot] = card;
    else if (!empty.UTIL) empty.UTIL = card;
  }
  return empty;
}

function SlotCard({ label, card, events }: { label: LineupSlot; card: PlayerCardWithPlayer | null; events: LivePointEvent[] }) {
  const liveDelta = card ? events.filter((event) => eventMatchesCard(event, card)).reduce((sum, event) => sum + Number(event.delta || 0), 0) : 0;
  const cardPoints = card ? getCardPoints(card) : { total: 0, last: 0 };
  return (
    <div className="relative flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/18 p-3 backdrop-blur-sm">
      <div className="absolute left-3 top-3 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1 text-[10px] font-black uppercase tracking-[.18em] text-slate-400">{label}</div>
      {card ? (
        <>
          <PlayerTile player={toFantasyCardData(card, { imageWidth: 640 })} className="!h-[235px] !w-[172px]" />
          <div className="mt-3 grid w-full grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Team</p>
              <p className="text-sm font-black text-white">{shortTeam(card.player?.team)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Last</p>
              <p className="text-sm font-black text-white">{cardPoints.last}</p>
            </div>
            <div className={liveDelta >= 0 ? "rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-2 py-2" : "rounded-xl border border-red-400/25 bg-red-400/10 px-2 py-2"}>
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Live</p>
              <p className={liveDelta >= 0 ? "text-sm font-black text-emerald-300" : "text-sm font-black text-red-300"}>{liveDelta >= 0 ? `+${liveDelta}` : liveDelta}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <CircleDot className="mb-3 h-9 w-9 text-slate-700" />
          <p className="font-black text-slate-400">Empty {label}</p>
          <p className="mt-1 text-xs text-slate-600">Set this slot in Collection</p>
        </div>
      )}
    </div>
  );
}

export default function LiveLineupPage() {
  const { data: lineupData, isLoading } = useQuery<{ lineup: Lineup; cards: PlayerCardWithPlayer[] }>({
    queryKey: ["/api/lineup"],
    queryFn: async () => {
      const res = await fetch("/api/lineup", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lineup");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: livePointEvents } = useQuery<LivePointEvent[]>({
    queryKey: ["/api/live/point-feed?limit=40"],
    queryFn: async () => {
      const res = await fetch("/api/live/point-feed?limit=40", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5000,
  });

  const lineupCards = lineupData?.cards || [];
  const events = livePointEvents || [];
  const slots = useMemo(() => buildSlots(lineupCards), [lineupCards]);
  const liveDelta = useMemo(() => lineupCards.reduce((sum, card) => sum + events.filter((event) => eventMatchesCard(event, card)).reduce((eventSum, event) => eventSum + Number(event.delta || 0), 0), 0), [events, lineupCards]);
  const lineupPoints = useMemo(() => lineupCards.reduce((sum, card) => sum + getCardPoints(card).total, 0), [lineupCards]);
  const selectedTeams = useMemo(() => Array.from(new Set(lineupCards.map((card) => String(card.player?.team || "").trim()).filter(Boolean))), [lineupCards]);
  const relevantEvents = useMemo(() => events.filter((event) => lineupCards.some((card) => eventMatchesCard(event, card))).slice(0, 12), [events, lineupCards]);

  return (
    <div className="relative min-h-full flex-1 overflow-auto bg-[#07111f] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_10%,rgba(34,197,94,.14),transparent_30%),radial-gradient(circle_at_78%_8%,rgba(37,99,235,.16),transparent_30%),linear-gradient(180deg,#07111f_0%,#050812_100%)]" />
      <div className="relative mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.24em] text-emerald-300/70">SO5 Matchday Control</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Live Lineup</h1>
            <p className="mt-1 text-sm text-slate-400">Only your selected 5 matter here. Track their teams, live gains, losses and recent points.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Card className="rounded-2xl border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Lineup</p>
              <p className="text-lg font-black text-white">{lineupCards.length}/5</p>
            </Card>
            <Card className="rounded-2xl border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Total Points</p>
              <p className="text-lg font-black text-white">{Math.round(lineupPoints)}</p>
            </Card>
            <Card className="rounded-2xl border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Live Delta</p>
              <p className={liveDelta >= 0 ? "text-lg font-black text-emerald-300" : "text-lg font-black text-red-300"}>{liveDelta >= 0 ? `+${liveDelta}` : liveDelta}</p>
            </Card>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <Card className="relative overflow-hidden rounded-[2rem] border-emerald-400/15 bg-emerald-950/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:46px_46px] opacity-25" />
            <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
            <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
            <div className="relative grid gap-4 lg:grid-cols-5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-[360px] rounded-3xl bg-slate-800" />)
              ) : (
                <>
                  <SlotCard label="GK" card={slots.GK} events={events} />
                  <SlotCard label="DEF" card={slots.DEF} events={events} />
                  <SlotCard label="MID" card={slots.MID} events={events} />
                  <SlotCard label="FWD" card={slots.FWD} events={events} />
                  <SlotCard label="UTIL" card={slots.UTIL} events={events} />
                </>
              )}
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-3xl border-slate-800 bg-slate-950/65 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-white">Selected Teams</h2>
                  <p className="text-xs text-slate-500">Your 5 players linked to club context.</p>
                </div>
                <Swords className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTeams.length ? selectedTeams.map((team) => (
                  <div key={team} className="rounded-2xl border border-slate-800 bg-black/30 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Team</p>
                    <p className="text-sm font-black text-white">{team}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No selected teams yet.</p>}
              </div>
              <Link href="/collection">
                <Button className="mt-4 w-full rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-500">Edit Lineup</Button>
              </Link>
            </Card>

            <Card className="rounded-3xl border-slate-800 bg-slate-950/65 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-white">Live Gain / Loss Feed</h2>
                  <p className="text-xs text-slate-500">Only events linked to your selected players' teams.</p>
                </div>
                <Zap className="h-5 w-5 text-yellow-300" />
              </div>
              <div className="max-h-[430px] space-y-2 overflow-auto pr-1">
                {relevantEvents.length ? relevantEvents.map((event) => {
                  const positive = Number(event.delta || 0) >= 0;
                  return (
                    <div key={event.id} className="rounded-2xl border border-slate-800 bg-black/28 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className={positive ? "flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300" : "flex h-8 w-8 items-center justify-center rounded-xl bg-red-400/10 text-red-300"}>
                            {positive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-white">{event.team}</p>
                            <p className="text-xs text-slate-500">{event.reason}</p>
                          </div>
                        </div>
                        <p className={positive ? "text-lg font-black text-emerald-300" : "text-lg font-black text-red-300"}>{positive ? `+${event.delta}` : event.delta}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-slate-800 bg-black/25 p-8 text-center">
                    <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                    <p className="text-sm text-slate-500">No live point events for your selected teams yet.</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

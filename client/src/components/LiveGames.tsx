import { useQuery } from "@tanstack/react-query";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Activity, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LiveGame {
  id: number;
  kickoffTime: string;
  started: boolean;
  finished: boolean;
  minutes: number;
  homeTeam: { id: number; name: string; shortName: string; score: number };
  awayTeam: { id: number; name: string; shortName: string; score: number };
  stats: any[];
  statsSummary?: {
    assists?: { home: number | null; away: number | null };
    saves?: { home: number | null; away: number | null };
    cards?: { home: number | null; away: number | null };
    bonus?: { home: number | null; away: number | null };
    bps?: { home: number | null; away: number | null };
  };
  playerStats: any[];
}

function normalizeLiveGames(payload: any): LiveGame[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.liveGames)) return payload.liveGames;
  if (Array.isArray(payload?.games)) return payload.games;
  if (Array.isArray(payload?.response)) return payload.response;
  return [];
}

export default function LiveGames({ endpoint = "/api/epl/live-games" }: { endpoint?: string }) {
  const previousSnapshot = useRef<Record<number, { hs: number; as: number; ha: number; aa: number }>>({});
  const [burstState, setBurstState] = useState<Record<number, "goal" | "assist" | null>>({});

  const { data: liveGames = [], isLoading, refetch } = useQuery<LiveGame[]>({
    queryKey: [endpoint],
    queryFn: async () => {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch live games");
      return normalizeLiveGames(await res.json());
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!Array.isArray(liveGames) || !liveGames.length) return;
    const nextBurst: Record<number, "goal" | "assist" | null> = {};
    for (const game of liveGames) {
      const homeAssists = Number(game.statsSummary?.assists?.home ?? 0);
      const awayAssists = Number(game.statsSummary?.assists?.away ?? 0);
      const prev = previousSnapshot.current[game.id];
      if (prev) {
        const goalIncreased = Number(game.homeTeam?.score || 0) > prev.hs || Number(game.awayTeam?.score || 0) > prev.as;
        const assistIncreased = homeAssists > prev.ha || awayAssists > prev.aa;
        if (goalIncreased) nextBurst[game.id] = "goal";
        else if (assistIncreased) nextBurst[game.id] = "assist";
      }
      previousSnapshot.current[game.id] = { hs: Number(game.homeTeam?.score || 0), as: Number(game.awayTeam?.score || 0), ha: homeAssists, aa: awayAssists };
    }
    if (Object.keys(nextBurst).length) {
      setBurstState((prev) => ({ ...prev, ...nextBurst }));
      const timer = window.setTimeout(() => setBurstState((prev) => {
        const copy = { ...prev };
        for (const key of Object.keys(nextBurst)) delete copy[Number(key)];
        return copy;
      }), 4200);
      return () => window.clearTimeout(timer);
    }
  }, [liveGames]);

  const getMinutesDisplay = (minutes: number) => {
    if (minutes === 0) return "Kick Off";
    if (minutes <= 45) return `${minutes}'`;
    if (minutes === 45) return "HT";
    if (minutes > 45 && minutes <= 90) return `${minutes}'`;
    if (minutes > 90) return `${minutes}' +${minutes - 90}'`;
    return `${minutes}'`;
  };

  const getStatValue = (game: LiveGame, keys: string[], side: "h" | "a") => {
    const stats = Array.isArray(game?.stats) ? game.stats : [];
    for (const item of stats) {
      const rawName = String(item?.identifier || item?.name || item?.stat || "").toLowerCase();
      if (!keys.some((key) => rawName.includes(key))) continue;
      const rawValue = item?.[side]?.[0]?.value ?? item?.[side]?.value ?? null;
      if (rawValue === null || rawValue === undefined || rawValue === "") return null;
      const parsed = typeof rawValue === "string" ? Number(String(rawValue).replace(/%/g, "").trim()) : Number(rawValue);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  if (isLoading) return <div className="space-y-4">{[1, 2, 3].map((i) => <Card key={i} className="p-6 bg-card/50 backdrop-blur-sm border-border/50"><Skeleton className="h-24 w-full" /></Card>)}</div>;

  if (!Array.isArray(liveGames) || liveGames.length === 0) {
    return <Card className="p-12 bg-card/50 backdrop-blur-sm border-border/50 text-center"><div className="flex flex-col items-center gap-4"><div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center"><Clock className="w-8 h-8 text-muted-foreground" /></div><div><h3 className="text-lg font-semibold text-foreground mb-1">No Live Games</h3><p className="text-sm text-muted-foreground">Check back during matchdays to see live scores and stats</p></div></div></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><span className="text-sm font-medium text-foreground">{liveGames.length} {liveGames.length === 1 ? "Game" : "Games"} Live</span></div><Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-500"><Activity className="w-3 h-3 mr-1" />Auto-updating every 30s</Badge></div>
      {liveGames.map((game) => {
        const homeAssists = game.statsSummary?.assists?.home ?? getStatValue(game, ["assists"], "h") ?? 0;
        const awayAssists = game.statsSummary?.assists?.away ?? getStatValue(game, ["assists"], "a") ?? 0;
        const homeSaves = game.statsSummary?.saves?.home ?? getStatValue(game, ["saves"], "h") ?? 0;
        const awaySaves = game.statsSummary?.saves?.away ?? getStatValue(game, ["saves"], "a") ?? 0;
        const homeCards = game.statsSummary?.cards?.home ?? getStatValue(game, ["yellow_cards", "red_cards", "cards"], "h") ?? 0;
        const awayCards = game.statsSummary?.cards?.away ?? getStatValue(game, ["yellow_cards", "red_cards", "cards"], "a") ?? 0;
        const homeBonus = game.statsSummary?.bonus?.home ?? getStatValue(game, ["bonus"], "h") ?? 0;
        const awayBonus = game.statsSummary?.bonus?.away ?? getStatValue(game, ["bonus"], "a") ?? 0;
        const homeBps = game.statsSummary?.bps?.home ?? getStatValue(game, ["bps"], "h") ?? 0;
        const awayBps = game.statsSummary?.bps?.away ?? getStatValue(game, ["bps"], "a") ?? 0;
        return <Card key={game.id} className={`p-6 bg-gradient-to-br from-card/80 to-card/50 backdrop-blur-sm border-border/50 hover:border-purple-500/30 transition-all relative overflow-hidden ${burstState[game.id] ? "ring-2 ring-emerald-400/70" : ""}`}>{burstState[game.id] && <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.28),transparent_60%)] animate-pulse" />}<div className="flex flex-col gap-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Badge variant="destructive" className="animate-pulse"><Activity className="w-3 h-3 mr-1" />LIVE</Badge><span className="text-sm font-mono font-bold text-red-500">{getMinutesDisplay(Number(game.minutes || 0))}</span></div><span className="text-xs text-muted-foreground">{new Date(game.kickoffTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></div>{burstState[game.id] === "goal" && <Badge className="w-fit bg-emerald-600 text-white animate-pulse">GOAL! Card glow activated ✨</Badge>}{burstState[game.id] === "assist" && <Badge className="w-fit bg-cyan-600 text-white animate-pulse">ASSIST! Confetti moment 🎉</Badge>}<div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center"><div className="flex flex-col items-end"><span className="font-bold text-lg text-foreground">{game.homeTeam?.name || "Home"}</span><span className="text-xs text-muted-foreground">{game.homeTeam?.shortName}</span></div><div className="px-6 py-3 bg-background/80 rounded-lg border border-border/50"><span className="text-3xl font-black">{game.homeTeam?.score ?? 0} - {game.awayTeam?.score ?? 0}</span></div><div className="flex flex-col"><span className="font-bold text-lg text-foreground">{game.awayTeam?.name || "Away"}</span><span className="text-xs text-muted-foreground">{game.awayTeam?.shortName}</span></div></div><div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-border/50"><StatPill label="Assists" home={homeAssists} away={awayAssists} /><StatPill label="Saves" home={homeSaves} away={awaySaves} /><StatPill label="Cards" home={homeCards} away={awayCards} /><StatPill label="Bonus" home={homeBonus} away={awayBonus} /><StatPill label="BPS" home={homeBps} away={awayBps} /></div></div></Card>;
      })}
    </div>
  );
}

function StatPill({ label, home, away }: { label: string; home: number; away: number }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center"><div className="text-[10px] uppercase tracking-[.16em] text-muted-foreground">{label}</div><div className="mt-1 text-sm font-bold text-foreground">{home} - {away}</div></div>;
}

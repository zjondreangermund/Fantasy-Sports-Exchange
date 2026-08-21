import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CalendarDays, Shield, Users } from "lucide-react";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

async function getJson(url: string) {
  const response = await fetch(url, { credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Player intelligence unavailable");
  return payload;
}

function formatDate(value: any) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function warningClass(level: string) {
  if (level === "danger") return "border-red-500/30 bg-red-500/10 text-red-100";
  if (level === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
}

export default function PlayerIntelligencePanel({ playerId, compact = false }: { playerId?: number | null; compact?: boolean }) {
  const id = Number(playerId || 0);
  const query = useQuery<any>({
    queryKey: ["api-football-card-intelligence", id],
    queryFn: () => getJson(`/api/football/player-intelligence/premier-league/${id}`),
    enabled: id > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!id) return null;
  if (query.isLoading) return <Skeleton className={compact ? "h-32 w-full" : "h-52 w-full"} />;
  if (!query.data) return null;

  const data = query.data;
  const next = data.nextFixture;
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  const form = Array.isArray(data.form?.matches) ? data.form.matches.slice(0, compact ? 3 : 5) : [];
  const lineupLabel = data.lineup?.status === "confirmed_starter" ? "Confirmed starter" : data.lineup?.status === "confirmed_bench" ? "Confirmed bench" : data.lineup?.status === "not_in_announced_squad" ? "Not in announced squad" : "Lineup not announced";

  return (
    <Card className="space-y-3 border-cyan-400/15 bg-cyan-400/[.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="flex items-center gap-2 font-black"><Activity className="h-4 w-4 text-cyan-300" /> Player Intelligence</div><p className="text-xs text-muted-foreground">API-Football Pro availability and match context.</p></div>
        <Badge variant="outline">{data.source || "API-Football Pro"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Mini icon={<Users className="h-3.5 w-3.5" />} label="Current squad" value={data.currentSquad === false ? "No" : data.currentSquad === true ? "Yes" : "Unknown"} />
        <Mini icon={<Shield className="h-3.5 w-3.5" />} label="Lineup" value={lineupLabel} />
        <Mini icon={<Shield className="h-3.5 w-3.5" />} label="League rank" value={data.standing?.rank ? `#${data.standing.rank}` : "—"} />
        <Mini icon={<CalendarDays className="h-3.5 w-3.5" />} label="Next match" value={next ? `${next.homeTeam?.name} vs ${next.awayTeam?.name}` : "TBD"} />
      </div>

      {next ? <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground"><span className="font-bold text-white">Next fixture:</span> {next.homeTeam?.name} vs {next.awayTeam?.name} · {formatDate(next.kickoffTime)}</div> : null}

      {warnings.length ? <div className="space-y-2">{warnings.map((warning: any, index: number) => <div key={`${warning.code}-${index}`} className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${warningClass(String(warning.level || "info"))}`}><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{warning.message}</span></div>)}</div> : <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-200">No API-Football availability warning is currently attached to this player.</div>}

      {!compact && form.length ? <div><div className="mb-2 text-xs font-black uppercase tracking-wide text-white/50">Recent form</div><div className="grid gap-2 sm:grid-cols-2">{form.map((row: any, index: number) => <div key={`${row.fixtureId || row?.fixture?.id || index}`} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"><div className="font-semibold">{row?.fixture ? `${row.fixture.homeTeam?.name} vs ${row.fixture.awayTeam?.name}` : `${row.homeTeam || ""} vs ${row.awayTeam || ""}`}</div><div className="mt-1 text-muted-foreground">{row.fantasyScore != null ? `Arena ${Number(row.fantasyScore).toFixed(1)}` : row.rating != null ? `Rating ${Number(row.rating).toFixed(1)}` : "No rating"} · {row.minutes || 0} min</div></div>)}</div></div> : null}
    </Card>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-2"><div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div><div className="mt-1 text-xs font-black">{value ?? "—"}</div></div>;
}

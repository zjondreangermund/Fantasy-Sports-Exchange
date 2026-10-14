import { useQuery } from "@tanstack/react-query";
import type { CardProfileData } from "./CardProfileModal";

export default function RecentPlayerPerformance({ cardId }: { cardId: number }) {
  const { data, isLoading, isError } = useQuery<CardProfileData>({
    queryKey: ["/api/cards/profile", cardId],
    queryFn: async () => { const response = await fetch(`/api/cards/${cardId}/profile`, { credentials: "include" }); if (!response.ok) throw new Error("Performance unavailable"); return response.json(); },
    enabled: cardId > 0, staleTime: 60000,
  });
  const matches = data?.source !== "card-fallback" ? data?.last10 || [] : [];
  const weeks = new Map<number, number>();
  for (const match of matches) weeks.set(match.gameweek, (weeks.get(match.gameweek) || 0) + Number(match.points || 0));
  const recent = [...weeks].sort((a, b) => b[0] - a[0]).slice(0, 5);
  return <section className="mt-4 rounded-2xl border border-cyan-300/15 bg-white/[.035] p-3">
    <h3 className="font-black text-cyan-100">Recent performance</h3>
    {isLoading ? <p className="mt-2 text-xs text-slate-400">Loading player stats…</p> : !matches.length ? <p className="mt-2 text-xs text-slate-400">{isError ? "Stats unavailable. Try again shortly." : "No verified recent performances available."}</p> : <>
      <div className="mt-3 flex gap-2 overflow-x-auto">{recent.map(([gw, points]) => <div key={gw} className="min-w-16 rounded-xl bg-cyan-300/10 p-2 text-center"><p className="text-[10px] text-slate-400">GW {gw}</p><p className="font-black text-cyan-100">{Number(points.toFixed(4))}</p><p className="text-[9px] text-slate-400">points</p></div>)}</div>
      <h4 className="mt-3 text-xs font-bold text-slate-300">Season totals</h4>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">{[["Minutes", data?.stats.minutes], ["Goals", data?.stats.goals], ["Assists", data?.stats.assists], ["Clean sheets", data?.stats.cleanSheets], ["Yellow cards", data?.stats.yellowCards], ["Red cards", data?.stats.redCards]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-black/20 p-2"><p className="text-slate-400">{label}</p><p className="font-bold">{value ?? "—"}</p></div>)}</div>
      <div className="mt-3 space-y-2">{[...matches].sort((a,b) => b.gameweek-a.gameweek).slice(0, 5).map((match, index) => <div key={`${match.gameweek}-${index}`} className="border-t border-white/10 pt-2 text-xs"><div className="flex justify-between gap-2"><span>GW {match.gameweek} · {match.opponent}</span><strong className="text-cyan-100">{match.points} pts</strong></div><p className="mt-1 text-slate-400">{match.minutes} min · {match.goals} goals · {match.assists} assists · {match.yellowCards || 0} yellow · {match.redCards || 0} red</p></div>)}</div>
    </>}
  </section>;
}

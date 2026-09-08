import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BellRing, ChevronRight, Gem, Goal, ShoppingBag, Sparkles, Trophy, UsersRound, WalletCards } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import type { Competition, CompetitionEntry, PlayerCardWithPlayer, Wallet } from "../../../../shared/schema";

type CompetitionRow = Competition & { gameWeek?: number | null; submissionClosesAt?: string | Date | null };

function money(value: unknown) {
  const amount = Number(value || 0);
  return `N$${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function deadline(value: unknown) {
  if (!value) return "Entries open";
  const date = new Date(value as any);
  if (!Number.isFinite(date.getTime())) return "Entries open";
  return date.toLocaleString("en-NA", { timeZone: "Africa/Windhoek", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function NativeHomePage() {
  const { user } = useAuth();
  const { data: wallet } = useQuery<Wallet>({ queryKey: ["/api/wallet"], staleTime: 30_000, refetchInterval: 60_000 });
  const { data: cardsRaw } = useQuery<any>({ queryKey: ["/api/user/cards"], staleTime: 30_000, refetchInterval: 60_000 });
  const { data: lineup } = useQuery<any>({ queryKey: ["/api/lineup"], staleTime: 30_000, refetchInterval: 60_000 });
  const { data: competitionsRaw } = useQuery<any>({ queryKey: ["/api/competitions"], staleTime: 30_000, refetchInterval: 60_000 });
  const { data: entries = [] } = useQuery<CompetitionEntry[]>({ queryKey: ["/api/competitions/my-entries"], staleTime: 20_000, refetchInterval: 60_000 });
  const { data: notifications } = useQuery<any>({ queryKey: ["/api/notifications"], staleTime: 30_000, refetchInterval: 60_000 });

  const cards: PlayerCardWithPlayer[] = Array.isArray(cardsRaw) ? cardsRaw : Array.isArray(cardsRaw?.cards) ? cardsRaw.cards : [];
  const lineupCards: PlayerCardWithPlayer[] = Array.isArray(lineup?.cards) ? lineup.cards : [];
  const competitions: CompetitionRow[] = Array.isArray(competitionsRaw) ? competitionsRaw : Array.isArray(competitionsRaw?.competitions) ? competitionsRaw.competitions : [];
  const activeEntries = Array.isArray(entries) ? entries.filter((entry: any) => !["completed", "cancelled"].includes(String(entry.status || "").toLowerCase())) : [];
  const openCups = competitions.filter((row: any) => String(row.status || "").toLowerCase() === "open" && row.entryOpen !== false);
  const featured = [...openCups].sort((a: any, b: any) => {
    const freeA = Number(a.entryFee || 0) <= 0 ? 1 : 0;
    const freeB = Number(b.entryFee || 0) <= 0 ? 1 : 0;
    return freeB - freeA || Number(b.gameWeek || 0) - Number(a.gameWeek || 0);
  })[0];
  const latest = notifications?.notifications?.find((row: any) => !row.read) || notifications?.notifications?.[0];
  const lineupScore = lineupCards.reduce((sum, card: any) => sum + Number(card.currentGameweekPoints ?? card.player?.currentGameweekPoints ?? 0), 0);

  const next = cards.length < 5
    ? { title: "Build your first five", body: "You need five eligible cards before you can enter a cup.", href: "/collection", cta: "My cards" }
    : activeEntries.length === 0
      ? { title: "Enter a tournament", body: "Choose a cup and lock in GK, DEF, MID, FWD and Utility.", href: "/competitions", cta: "Play" }
      : lineupCards.length < 5
        ? { title: "Review your squad", body: "Make sure your five-card matchday squad is complete.", href: "/live-lineup", cta: "Squad" }
        : { title: "You are matchday ready", body: "Follow your active entry and real Premier League scoring.", href: "/live-lineup", cta: "Live squad" };

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-home-v2>
      <section className="overflow-hidden rounded-[1.6rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_90%_0%,rgba(139,92,246,.2),transparent_34%),radial-gradient(circle_at_0%_100%,rgba(34,211,238,.11),transparent_38%),linear-gradient(145deg,#0d1427,#080a17)] p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Matchday HQ</p><h2 className="mt-1 truncate text-2xl font-black">{(user as any)?.managerTeamName || "My Fantasy Arena"}</h2><p className="mt-1 text-xs leading-5 text-slate-400">One screen for the things that matter before kickoff.</p></div><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/8 bg-white/[.045] text-cyan-200"><Goal className="h-6 w-6" /></div></div>
        <Link href={next.href}><button className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-violet-300/15 bg-violet-300/[.07] p-3 text-left"><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.15em] text-violet-200/65">Your next move</p><p className="mt-1 text-base font-black">{next.title}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{next.body}</p></div><span className="shrink-0 rounded-xl bg-white px-3 py-2 text-[10px] font-black text-slate-950">{next.cta}</span></button></Link>
      </section>

      <section className="mt-3 grid grid-cols-3 gap-2">
        <Link href="/wallet"><div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><WalletCards className="h-4 w-4 text-emerald-200" /><p className="mt-2 text-[9px] font-black uppercase text-slate-600">Wallet</p><p className="mt-1 truncate text-sm font-black">{money((wallet as any)?.balance)}</p></div></Link>
        <Link href="/collection"><div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><Gem className="h-4 w-4 text-violet-200" /><p className="mt-2 text-[9px] font-black uppercase text-slate-600">Cards</p><p className="mt-1 text-sm font-black">{cards.length}</p></div></Link>
        <Link href="/live-lineup"><div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><UsersRound className="h-4 w-4 text-cyan-200" /><p className="mt-2 text-[9px] font-black uppercase text-slate-600">Squad</p><p className="mt-1 text-sm font-black">{lineupCards.length}/5</p></div></Link>
      </section>

      <section className="mt-3 grid grid-cols-3 gap-2">
        <Link href="/competitions"><div className="flex min-h-20 flex-col justify-between rounded-2xl border border-cyan-300/10 bg-cyan-300/[.04] p-3"><Trophy className="h-5 w-5 text-cyan-200" /><div><p className="text-xs font-black">Play</p><p className="mt-0.5 text-[9px] text-slate-600">{openCups.length} open cups</p></div></div></Link>
        <Link href="/marketplace"><div className="flex min-h-20 flex-col justify-between rounded-2xl border border-emerald-300/10 bg-emerald-300/[.035] p-3"><ShoppingBag className="h-5 w-5 text-emerald-200" /><div><p className="text-xs font-black">Market</p><p className="mt-0.5 text-[9px] text-slate-600">Buy a card</p></div></div></Link>
        <Link href="/prize-vault"><div className="flex min-h-20 flex-col justify-between rounded-2xl border border-violet-300/10 bg-violet-300/[.04] p-3"><Sparkles className="h-5 w-5 text-violet-200" /><div><p className="text-xs font-black">Vault</p><p className="mt-0.5 text-[9px] text-slate-600">Prize chase</p></div></div></Link>
      </section>

      {featured ? <section className="mt-3 rounded-[1.45rem] border border-emerald-300/12 bg-emerald-300/[.04] p-4"><div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-emerald-200/65">Featured cup</p><h3 className="mt-1 truncate text-base font-black">{featured.name || "Fantasy Arena tournament"}</h3></div><span className="rounded-full border border-white/8 px-2.5 py-1 text-[9px] font-black">GW{Number(featured.gameWeek || (featured as any).game_week || 0)}</span></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-[10px] text-slate-600">Entry</p><p className="mt-0.5 text-sm font-black text-emerald-200">{Number(featured.entryFee || 0) <= 0 ? "FREE" : money(featured.entryFee)}</p></div><div className="text-right"><p className="text-[10px] text-slate-600">Closes</p><p className="mt-0.5 text-[11px] font-black">{deadline(featured.submissionClosesAt || (featured as any).submission_closes_at)}</p></div></div><Link href="/competitions"><button className="mt-3 flex w-full items-center justify-between rounded-xl bg-white/[.07] px-3 py-2.5 text-xs font-black"><span>View this cup</span><ChevronRight className="h-4 w-4 text-emerald-200" /></button></Link></section> : null}

      <section className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><p className="text-[9px] font-black uppercase text-slate-600">Active entries</p><p className="mt-1 text-xl font-black">{activeEntries.length}</p><p className="mt-1 text-[10px] text-slate-600">Tournament teams locked</p></div><div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><p className="text-[9px] font-black uppercase text-slate-600">Squad score</p><p className="mt-1 text-xl font-black text-cyan-200">{lineupScore.toFixed(2)}</p><p className="mt-1 text-[10px] text-slate-600">Current Arena points</p></div></section>

      {latest ? <Link href="/account?tab=inbox"><div className="mt-3 flex items-center gap-3 rounded-2xl border border-sky-300/10 bg-sky-300/[.035] p-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-300/10 text-sky-200"><BellRing className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{latest.title || "Fantasy Arena update"}</p><p className="mt-0.5 line-clamp-1 text-[10px] text-slate-600">{latest.message || "Open your inbox for the latest update."}</p></div><ChevronRight className="h-4 w-4 text-slate-600" /></div></Link> : null}

      <section className="mt-3 rounded-2xl border border-white/[.06] bg-black/20 p-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">The game in 10 seconds</p><div className="mt-2 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[.035] p-2"><p className="text-sm font-black text-violet-200">1</p><p className="mt-1 text-[9px] leading-3 text-slate-500">Own cards</p></div><div className="rounded-xl bg-white/[.035] p-2"><p className="text-sm font-black text-cyan-200">2</p><p className="mt-1 text-[9px] leading-3 text-slate-500">Enter five</p></div><div className="rounded-xl bg-white/[.035] p-2"><p className="text-sm font-black text-emerald-200">3</p><p className="mt-1 text-[9px] leading-3 text-slate-500">Real EPL scores</p></div></div></section>
    </div>
  );
}

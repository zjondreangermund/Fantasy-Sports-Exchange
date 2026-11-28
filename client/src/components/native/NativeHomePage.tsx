import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BellRing, ChevronRight, Crown, Gem, ShoppingBag, Sparkles, Trophy, UsersRound, WalletCards } from "lucide-react";
import HomeMatchdayLive from "../dashboard/HomeMatchdayLive";
import { readHomeJson } from "../../lib/queryClient";
import { useAuth } from "../../hooks/use-auth";
import { currentArenaOpenCups } from "../../lib/arena-current-gameweek";
import type { Competition, PlayerCardWithPlayer, Wallet } from "../../../../shared/schema";

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
  const { data: wallet } = useQuery<Wallet>({ queryKey: ["/api/wallet"], queryFn:({signal})=>readHomeJson("/api/wallet",signal), staleTime: 30_000, refetchInterval: 60_000 });
  const {data:summary}=useQuery<{cardCount:number;activeEntryCount:number}>({queryKey:["/api/home/summary",user?.id||"anonymous"],enabled:Boolean(user?.id),queryFn:({signal})=>readHomeJson("/api/home/summary",signal),staleTime:15_000,refetchInterval:30_000,refetchOnWindowFocus:true});
  const { data: lineup } = useQuery<any>({ queryKey: ["/api/lineup"], queryFn:({signal})=>readHomeJson("/api/lineup",signal), staleTime: 30_000, refetchInterval: 60_000 });
  const { data: competitionsRaw } = useQuery<any>({ queryKey: ["/api/competitions"], queryFn:({signal})=>readHomeJson("/api/competitions",signal), staleTime: 30_000, refetchInterval: 60_000 });
  const { data: notifications } = useQuery<any>({ queryKey: ["/api/notifications"], queryFn:({signal})=>readHomeJson("/api/notifications",signal), staleTime: 30_000, refetchInterval: 60_000 });

  const cardCount=summary?.cardCount;
  const lineupCards: PlayerCardWithPlayer[] = Array.isArray(lineup?.cards) ? lineup.cards : [];
  const competitions: CompetitionRow[] = Array.isArray(competitionsRaw) ? competitionsRaw : Array.isArray(competitionsRaw?.competitions) ? competitionsRaw.competitions : [];
  const activeEntryCount=summary?.activeEntryCount;
  // Only this official entry week (or a manually opened following week) can be featured.
  // Legacy GW27-GW30 cups cannot override the current Premier League calendar.
  const openCups = currentArenaOpenCups(competitions);
  const featured = openCups[0];
  const inbox = Array.isArray(notifications?.notifications) ? notifications.notifications.filter(Boolean) : [];
  const latest = inbox.find((row: any) => !row.read) || inbox[0];
  const lineupScore = lineupCards.reduce((sum, card: any) => sum + Number(card.currentGameweekPoints ?? card.player?.currentGameweekPoints ?? 0), 0);
  const readiness=cardCount==null||activeEntryCount==null||!lineup?null:Math.round(([cardCount>=5,lineupCards.length===5,activeEntryCount>0].filter(Boolean).length/3)*100);

  const next = cardCount==null||activeEntryCount==null||!lineup
    ? {title:"Review your club",body:"Club data is refreshing. Open your squad or collection for details.",href:"/collection",cta:"My cards"}
    : cardCount < 5
    ? { title: "Build your first five", body: "You need five eligible cards before you can enter a cup.", href: "/collection", cta: "My cards" }
    : activeEntryCount === 0
      ? { title: "Enter a tournament", body: "Choose a cup and lock in GK, DEF, MID, FWD and Utility.", href: "/competitions", cta: "Play now" }
      : lineupCards.length < 5
        ? { title: "Review your squad", body: "Make sure your five-card matchday squad is complete.", href: "/live-lineup", cta: "Squad" }
        : { title: "You are matchday ready", body: "Follow your active entry and real Premier League scoring.", href: "/live-lineup", cta: "Live squad" };

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-home-v2>
      <HomeMatchdayLive />
      <section className="relative overflow-hidden rounded-[1.7rem] border p-4">
        <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 bottom-[-4rem] h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.15rem] border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-400/15 via-violet-500/10 to-cyan-300/10 shadow-[0_0_26px_rgba(157,74,255,.16)]">
            <Crown className="h-7 w-7 text-fuchsia-100 drop-shadow-[0_0_8px_rgba(192,76,255,.45)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[.23em] text-fuchsia-200/70">Arena command deck</p>
            <h2 className="mt-1 truncate text-[22px] font-black tracking-tight">{(user as any)?.managerTeamName || "My Fantasy Arena"}</h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.055] px-2 py-1 text-[8px] font-black text-cyan-100">{readiness==null?"Checking club":readiness+"% READY"}</span>
              <span className="text-[9px] font-bold text-slate-500">{competitionsRaw==null?"—":openCups.length} cups open</span>
            </div>
          </div>
        </div>

        <Link href={next.href}>
          <button className="relative mt-4 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-fuchsia-300/20 bg-gradient-to-r from-fuchsia-500/[.14] via-violet-500/[.11] to-cyan-400/[.1] p-3 text-left shadow-[inset_0_0_24px_rgba(139,92,246,.05)]">
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-black uppercase tracking-[.18em] text-cyan-200/60">Next move</p>
              <p className="mt-1 text-[15px] font-black text-white">{next.title}</p>
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{next.body}</p>
            </div>
            <span className="shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-400 to-cyan-300 px-3 py-2 text-[9px] font-black text-slate-950 shadow-[0_0_18px_rgba(75,198,255,.18)]">{next.cta}</span>
          </button>
        </Link>
      </section>

      <section className="mt-3 grid grid-cols-3 gap-2">
        <Link href="/wallet"><div className="rounded-2xl border border-emerald-300/10 bg-gradient-to-br from-emerald-300/[.07] to-transparent p-3"><WalletCards className="h-4 w-4 text-emerald-200" /><p className="mt-2 text-[8px] font-black uppercase tracking-[.12em] text-slate-600">Wallet</p><p className="mt-1 truncate text-[13px] font-black">{wallet==null?"—":money((wallet as any)?.balance)}</p></div></Link>
        <Link href="/collection"><div className="rounded-2xl border border-fuchsia-300/10 bg-gradient-to-br from-fuchsia-300/[.07] to-transparent p-3"><Gem className="h-4 w-4 text-fuchsia-200" /><p className="mt-2 text-[8px] font-black uppercase tracking-[.12em] text-slate-600">Cards</p><p className="mt-1 text-[13px] font-black">{cardCount??"—"}</p></div></Link>
        <Link href="/live-lineup"><div className="rounded-2xl border border-cyan-300/10 bg-gradient-to-br from-cyan-300/[.07] to-transparent p-3"><UsersRound className="h-4 w-4 text-cyan-200" /><p className="mt-2 text-[8px] font-black uppercase tracking-[.12em] text-slate-600">Squad</p><p className="mt-1 text-[13px] font-black">{lineup==null?"—":lineupCards.length+"/5"}</p></div></Link>
      </section>

      <section className="mt-3 grid grid-cols-3 gap-2">
        <Link href="/competitions"><div className="flex min-h-[78px] flex-col justify-between rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[.12] via-blue-500/[.06] to-transparent p-3 shadow-[inset_0_0_18px_rgba(34,211,238,.035)]"><Trophy className="h-[18px] w-[18px] text-cyan-100" /><div><p className="text-[11px] font-black">ENTER ARENA</p><p className="mt-0.5 text-[8px] text-cyan-100/45">{competitionsRaw==null?"—":openCups.length} cups</p></div></div></Link>
        <Link href="/marketplace"><div className="flex min-h-[78px] flex-col justify-between rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-400/[.11] via-cyan-500/[.04] to-transparent p-3"><ShoppingBag className="h-[18px] w-[18px] text-emerald-100" /><div><p className="text-[11px] font-black">MARKET</p><p className="mt-0.5 text-[8px] text-emerald-100/45">Find cards</p></div></div></Link>
        <Link href="/prize-vault"><div className="flex min-h-[78px] flex-col justify-between rounded-2xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-400/[.13] via-violet-500/[.07] to-transparent p-3"><Sparkles className="h-[18px] w-[18px] text-fuchsia-100" /><div><p className="text-[11px] font-black">VAULT</p><p className="mt-0.5 text-[8px] text-fuchsia-100/45">Prize chase</p></div></div></Link>
      </section>

      {featured ? <section className="mt-3 rounded-[1.45rem] border p-3.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.17em] text-emerald-200/60">Featured cup</p><h3 className="mt-1 truncate text-[15px] font-black">{featured.name || "Fantasy Arena tournament"}</h3></div><span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[8px] font-black">GW{Number(featured.gameWeek || (featured as any).game_week || 0)}</span></div><div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2"><div><p className="text-[8px] text-slate-600">ENTRY</p><p className="mt-0.5 text-[12px] font-black text-emerald-200">{Number(featured.entryFee || 0) <= 0 ? "FREE" : money(featured.entryFee)}</p></div><div><p className="text-[8px] text-slate-600">CLOSES</p><p className="mt-0.5 text-[10px] font-black">{deadline(featured.submissionClosesAt || (featured as any).submission_closes_at)}</p></div><Link href="/competitions"><button className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.08]"><ChevronRight className="h-4 w-4 text-cyan-100" /></button></Link></div></section> : null}

      <section className="mt-3 grid grid-cols-2 gap-2"><Link href="/live-lineup"><div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><p className="text-[8px] font-black uppercase tracking-[.12em] text-slate-600">Active entries</p><div className="mt-1 flex items-end justify-between"><p className="text-xl font-black">{activeEntryCount??"—"}</p><span className="text-[8px] text-slate-600">View squad</span></div></div></Link><Link href="/live-lineup"><div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[.035] p-3"><p className="text-[8px] font-black uppercase tracking-[.12em] text-slate-600">Collection lineup points</p><div className="mt-1 flex items-end justify-between"><p className="text-xl font-black text-cyan-100">{lineup==null?"—":lineupScore.toFixed(2)}</p><span className="text-[8px] text-cyan-100/40">Not tournament total</span></div></div></Link></section>

      {latest ? <Link href="/account?tab=inbox"><div className="mt-3 flex items-center gap-3 rounded-2xl border border-violet-300/10 bg-gradient-to-r from-violet-300/[.055] to-cyan-300/[.025] p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400/15 to-cyan-300/10 text-cyan-100"><BellRing className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black">{latest.title || "Fantasy Arena update"}</p><p className="mt-0.5 line-clamp-1 text-[9px] text-slate-600">{latest.message || "Open your inbox for the latest update."}</p></div><ChevronRight className="h-4 w-4 text-slate-700" /></div></Link> : null}
    </div>
  );
}

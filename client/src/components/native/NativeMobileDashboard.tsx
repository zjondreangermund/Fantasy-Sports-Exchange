import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  ChevronRight,
  CircleDollarSign,
  Gem,
  Goal,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
  WalletCards,
} from "lucide-react";
import DailyLoginRewardPanel from "../dashboard/DailyLoginRewardPanel";
import { useAuth } from "../../hooks/use-auth";
import type { Competition, CompetitionEntry, PlayerCardWithPlayer, Wallet } from "../../../../shared/schema";

type CompetitionWithEntries = Competition & {
  entryCount?: number;
  submissionClosesAt?: string | Date | null;
  gameWeek?: number | null;
  isFreeCardCup?: boolean | null;
};

type NotificationResponse = {
  unreadCount: number;
  notifications: Array<{ id: number; title: string; message: string; read: boolean }>;
};

type RetentionSummary = {
  nextBestAction?: { title: string; ctaPath: string };
};

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `N$${amount.toFixed(2)}` : "N$0.00";
}

function deadlineLabel(value: unknown) {
  if (!value) return "Entry window open";
  const date = new Date(value as any);
  if (!Number.isFinite(date.getTime())) return "Entry window open";
  return date.toLocaleString("en-NA", {
    timeZone: "Africa/Windhoek",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function NativeMobileDashboard() {
  const { user } = useAuth();
  const { data: wallet } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: cards } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: lineup } = useQuery<{ cards: PlayerCardWithPlayer[] }>({
    queryKey: ["/api/lineup"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: competitions } = useQuery<CompetitionWithEntries[]>({
    queryKey: ["/api/competitions"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: myEntries } = useQuery<CompetitionEntry[]>({
    queryKey: ["/api/competitions/my-entries", user?.id || "anonymous"],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: notifications } = useQuery<NotificationResponse>({
    queryKey: ["/api/notifications"],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: retentionSummary } = useQuery<RetentionSummary>({
    queryKey: ["/api/retention/summary"],
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const lineupCards = lineup?.cards || [];
  const cardCount = cards?.length || 0;
  const openCompetitions = (competitions || []).filter((competition) => competition.status === "open");
  const activeIds = new Set((myEntries || []).map((entry) => entry.competitionId));
  const activeEntries = (competitions || []).filter((competition) => activeIds.has(competition.id) && (competition.status === "open" || competition.status === "active"));
  const lineupScore = lineupCards.reduce((total, card) => total + Number((card as any).currentGameweekPoints || 0), 0);

  const featuredTournament = useMemo(() => {
    const open = [...openCompetitions];
    const freeCommon = open
      .filter((competition) => Number(competition.entryFee || 0) <= 0 && String(competition.tier || "").toLowerCase() === "common")
      .sort((a, b) => Number(b.gameWeek || 0) - Number(a.gameWeek || 0));
    return freeCommon[0] || open.sort((a, b) => Number(b.gameWeek || 0) - Number(a.gameWeek || 0))[0] || null;
  }, [openCompetitions]);

  const readinessParts = [cardCount >= 5, lineupCards.length === 5, activeEntries.length > 0];
  const readiness = Math.round((readinessParts.filter(Boolean).length / readinessParts.length) * 100);

  const nextAction = useMemo(() => {
    if (cardCount < 5) return { title: "Complete your Starter 5", body: "You need five eligible cards before entering your first cup.", href: "/onboarding", cta: "Get Cards" };
    if (activeEntries.length === 0) return { title: "Enter your next tournament", body: "Choose a cup that matches your card rarity and submit your five-card team.", href: "/competitions", cta: "Find a Cup" };
    if (lineupCards.length !== 5) return { title: "Finish your five-card squad", body: "Your tournament team is not complete yet. Review it before the deadline.", href: "/live-lineup", cta: "Build Squad" };
    return {
      title: retentionSummary?.nextBestAction?.title || "Your squad is matchday ready",
      body: "Follow your entries and real Premier League scoring from My Squad.",
      href: retentionSummary?.nextBestAction?.ctaPath || "/my-entries",
      cta: "View Entry",
    };
  }, [activeEntries.length, cardCount, lineupCards.length, retentionSummary?.nextBestAction]);

  const latestNotification = notifications?.notifications?.find((note) => !note.read) || notifications?.notifications?.[0];
  const teamName = (user as any)?.managerTeamName || "My Club";

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-4" data-native-home>
      <section className="relative overflow-hidden rounded-[1.8rem] border border-cyan-300/15 bg-gradient-to-br from-[#101b31] via-[#0b1021] to-[#140b27] p-5 shadow-[0_20px_55px_rgba(0,0,0,.35)]">
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Club command</p>
              <h2 className="mt-1 truncate text-2xl font-black tracking-tight">{teamName}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-400">Everything you need for your next Fantasy Arena move.</p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[.055]">
              <Goal className="h-7 w-7 text-cyan-300" />
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold text-slate-500">MATCHDAY READINESS</p>
              <p className="mt-0.5 text-3xl font-black text-white">{readiness}%</p>
            </div>
            <div className="flex gap-1.5">
              {readinessParts.map((done, index) => <span key={index} className={`h-2.5 w-9 rounded-full ${done ? "bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.45)]" : "bg-white/10"}`} />)}
            </div>
          </div>
        </div>
      </section>

      <Link href={nextAction.href} className="block rounded-[1.55rem] border border-violet-300/15 bg-violet-400/[.07] p-4 active:scale-[.99]">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-400/15 text-violet-200"><ArrowRight className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300/75">Your next move</p>
            <h3 className="mt-1 text-lg font-black">{nextAction.title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">{nextAction.body}</p>
          </div>
          <span className="mt-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-[10px] font-black text-white">{nextAction.cta}</span>
        </div>
      </Link>

      <section className="grid grid-cols-3 gap-2">
        <MiniStat icon={<WalletCards className="h-4 w-4" />} label="Wallet" value={money(wallet?.balance)} href="/wallet" />
        <MiniStat icon={<Gem className="h-4 w-4" />} label="Cards" value={String(cardCount)} href="/collection" />
        <MiniStat icon={<Trophy className="h-4 w-4" />} label="Entries" value={String(activeEntries.length)} href="/my-entries" />
      </section>

      {featuredTournament ? (
        <section className="overflow-hidden rounded-[1.65rem] border border-emerald-300/15 bg-gradient-to-br from-emerald-400/[.09] to-cyan-400/[.035] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-300/15 text-emerald-200"><Trophy className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[.19em] text-emerald-200/75">Open now</p><p className="text-sm font-black">{Number(featuredTournament.entryFee || 0) <= 0 ? "FREE ENTRY" : money(featuredTournament.entryFee)}</p></div></div>
            {featuredTournament.gameWeek ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black">GW{featuredTournament.gameWeek}</span> : null}
          </div>
          <h3 className="mt-4 text-xl font-black leading-tight">{featuredTournament.name}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">Use five eligible {String(featuredTournament.tier || "common")} cards. Your players score from real Premier League performances.</p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[.07] pt-3">
            <div><p className="text-[10px] text-slate-500">ENTRY DEADLINE</p><p className="mt-0.5 text-xs font-bold text-slate-200">{deadlineLabel(featuredTournament.submissionClosesAt)}</p></div>
            <Link href="/competitions" className="rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950">Enter Cup</Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.65rem] border border-white/[.08] bg-white/[.035] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-cyan-300" /><h3 className="font-black">My Squad</h3></div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${lineupCards.length === 5 ? "bg-emerald-300/15 text-emerald-200" : "bg-amber-300/15 text-amber-200"}`}>{lineupCards.length}/5</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-[10px] font-bold text-slate-500">LINEUP SCORE</p><p className="mt-1 text-xl font-black">{lineupScore.toFixed(4)}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-[10px] font-bold text-slate-500">STATUS</p><p className="mt-1 text-sm font-black">{lineupCards.length === 5 ? "Ready" : "Needs attention"}</p></div>
        </div>
        <Link href="/live-lineup" className="mt-3 flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.03] px-3.5 py-3 text-sm font-bold"><span>Review my five cards</span><ChevronRight className="h-4 w-4 text-cyan-300" /></Link>
      </section>

      {latestNotification ? (
        <Link href="/account?tab=inbox" className="flex items-start gap-3 rounded-[1.55rem] border border-sky-300/10 bg-sky-300/[.045] p-4 active:scale-[.99]">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-300/10 text-sky-200"><BellRing className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[.18em] text-sky-200/70">Latest alert</p>{notifications?.unreadCount ? <span className="rounded-full bg-sky-300 px-1.5 py-0.5 text-[9px] font-black text-slate-950">{notifications.unreadCount}</span> : null}</div><h3 className="mt-1 truncate text-sm font-black">{latestNotification.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{latestNotification.message}</p></div>
          <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-600" />
        </Link>
      ) : null}

      <section className="rounded-[1.7rem] border border-white/[.08] bg-[#0b0f1d] p-4">
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-300" /><h3 className="font-black">How to win</h3></div>
        <p className="mt-1 text-xs leading-5 text-slate-500">Fantasy Arena is simple when you know the three steps.</p>
        <div className="mt-4 space-y-3">
          <HowStep number="1" title="Build five cards" body="Choose an eligible GK, DEF, MID, FWD and Wildcard/Utility card." />
          <HowStep number="2" title="Enter the right cup" body="Your card rarity determines which tournaments you can enter." />
          <HowStep number="3" title="Real football decides it" body="Goals, assists, minutes, saves, tackles and other verified actions create your Arena score." />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/legal/scoring" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.04] py-3 text-xs font-black"><BookOpenCheck className="h-4 w-4 text-cyan-300" />Scoring</Link>
          <Link href="/prize-vault" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.04] py-3 text-xs font-black"><Sparkles className="h-4 w-4 text-violet-300" />Prize Vault</Link>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black">Club shortcuts</h3><span className="text-[10px] font-bold text-slate-600">Everything else is in More</span></div>
        <div className="grid grid-cols-2 gap-2">
          <Shortcut icon={<CircleDollarSign className="h-5 w-5" />} title="Marketplace" body="Buy & sell cards" href="/marketplace" />
          <Shortcut icon={<Sparkles className="h-5 w-5" />} title="Prize Vault" body="See what you can win" href="/prize-vault" />
        </div>
      </section>

      <div className="[&_.fa-premium-panel]:!rounded-[1.5rem] [&_.fa-premium-panel]:!border-white/[.08] [&_.fa-premium-panel]:!bg-white/[.035] [&_.fa-premium-panel]:!p-4">
        <DailyLoginRewardPanel />
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return <Link href={href} className="rounded-[1.35rem] border border-white/[.07] bg-white/[.035] p-3 active:scale-[.98]"><div className="text-cyan-300">{icon}</div><p className="mt-3 text-[9px] font-bold uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-0.5 truncate text-sm font-black">{value}</p></Link>;
}

function HowStep({ number, title, body }: { number: string; title: string; body: string }) {
  return <div className="flex gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.07] text-xs font-black text-cyan-200">{number}</div><div><p className="text-sm font-bold text-white">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{body}</p></div></div>;
}

function Shortcut({ icon, title, body, href }: { icon: React.ReactNode; title: string; body: string; href: string }) {
  return <Link href={href} className="rounded-[1.45rem] border border-white/[.07] bg-white/[.035] p-4 active:scale-[.99]"><div className="text-violet-300">{icon}</div><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-[11px] text-slate-500">{body}</p></Link>;
}

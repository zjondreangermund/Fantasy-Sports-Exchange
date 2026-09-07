import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock3, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const BRAND_LOGO = "/brand/fantasy-arena-logo.jpg?v=lion-jpg-2026-08";

type Tournament = {
  id: number;
  name?: string | null;
  status?: string | null;
  tier?: string | null;
  gameWeek?: number | null;
  entryFee?: number | string | null;
  entryCount?: number | null;
  submissionClosesAt?: string | null;
  entryOpen?: boolean;
  isFreeCardCup?: boolean;
  prizeCardRarity?: string | null;
  prizeDescription?: string | null;
};

function isFreeCardCup(comp: Tournament) {
  const name = String(comp.name || "").toLowerCase();
  return Number(comp.entryFee || 0) <= 0
    && (Boolean(comp.isFreeCardCup) || Boolean(comp.prizeCardRarity) || name.includes("free card cup"));
}

function countdownLabel(raw?: string | null) {
  if (!raw) return "Open now";
  const target = new Date(raw).getTime();
  if (!Number.isFinite(target)) return "Open now";
  const diff = target - Date.now();
  if (diff <= 0) return "Entries locked";
  const totalMinutes = Math.ceil(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function lockTimeLabel(raw?: string | null) {
  if (!raw) return "At the first Premier League kickoff";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return "At the first Premier League kickoff";
  return new Intl.DateTimeFormat("en-NA", {
    timeZone: "Africa/Windhoek",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date) + " CAT";
}

export default function FreeGameweekLandingPage() {
  const [clockTick, setClockTick] = useState(0);
  const refCode = typeof window !== "undefined" ? String(new URLSearchParams(window.location.search).get("ref") || "").trim() : "";
  const loginHref = refCode ? `/api/login?ref=${encodeURIComponent(refCode)}` : "/api/login";

  const { data: competitions, isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/competitions", "public-free-campaign"],
    queryFn: async () => {
      const res = await fetch("/api/competitions", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : Array.isArray(data?.competitions) ? data.competitions : [];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const id = window.setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const freeCommon = useMemo(() => {
    const rows = Array.isArray(competitions) ? competitions : [];
    return rows
      .filter((comp) => comp.status === "open" && comp.entryOpen !== false && isFreeCardCup(comp))
      .filter((comp) => String(comp.tier || "common").toLowerCase() === "common")
      .sort((a, b) => Number(b.gameWeek || 0) - Number(a.gameWeek || 0))[0];
  }, [competitions]);

  const gameWeek = Number(freeCommon?.gameWeek || 0);
  const entrants = Number(freeCommon?.entryCount || 0);
  const countdown = countdownLabel(freeCommon?.submissionClosesAt);
  const lockTime = lockTimeLabel(freeCommon?.submissionClosesAt);
  void clockTick;

  useEffect(() => {
    const previousTitle = document.title;
    const nextTitle = gameWeek > 0 ? `GW${gameWeek} FREE Tournament | Fantasy Arena` : "FREE Tournament | Fantasy Arena";
    document.title = nextTitle;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const previousDescription = meta?.content || "";
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = gameWeek > 0
      ? `Join Fantasy Arena Gameweek ${gameWeek} FREE. Get 5 free Premier League starter cards, enter the Common Card Cup and score from real match performances.`
      : "Start Fantasy Arena free with 5 Premier League starter cards and enter FREE Card Cups.";
    return () => {
      document.title = previousTitle;
      if (meta) meta.content = previousDescription;
    };
  }, [gameWeek]);

  return (
    <div className="min-h-screen bg-[#02040d] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#02040d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/" className="flex min-w-0 items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-fuchsia-300/25 bg-black">
              <img src={BRAND_LOGO} alt="Fantasy Arena" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0"><div className="truncate text-base font-black">Fantasy Arena</div><div className="text-[9px] font-bold uppercase tracking-[.22em] text-emerald-300">Play free this gameweek</div></div>
          </a>
          <a href={loginHref}><Button size="sm">Start FREE</Button></a>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.2),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,.16),transparent_32%),linear-gradient(180deg,#02040d_0%,#050916_100%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-24">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge className="border-emerald-200/30 bg-emerald-300/15 text-emerald-50">100% FREE ENTRY</Badge>
                {gameWeek > 0 && <Badge variant="outline" className="border-white/15 text-white">GAMEWEEK {gameWeek}</Badge>}
                <Badge variant="outline" className="border-white/15 text-white">PREMIER LEAGUE</Badge>
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[1.03] sm:text-5xl lg:text-6xl">
                Think you know Premier League football?
                <span className="mt-2 block bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">Prove it for FREE.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Create your Fantasy Arena club, choose 5 FREE Premier League starter cards and enter the open Common Card Cup. Your team scores from real match performances.
              </p>

              <div className="mt-7 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-white/10 bg-white/[.05] px-3 py-2"><CheckCircle2 className="mr-1.5 inline h-4 w-4 text-emerald-300" />5 free starter cards</span>
                <span className="rounded-full border border-white/10 bg-white/[.05] px-3 py-2"><ShieldCheck className="mr-1.5 inline h-4 w-4 text-cyan-300" />No deposit required</span>
                <span className="rounded-full border border-white/10 bg-white/[.05] px-3 py-2"><Trophy className="mr-1.5 inline h-4 w-4 text-amber-300" />Compete for card rewards</span>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href={loginHref}><Button size="lg" className="w-full font-black sm:w-auto">Create My FREE Team <ArrowRight className="ml-2 h-5 w-5" /></Button></a>
                <span className="text-xs text-slate-400">Signup → choose 5 cards → enter the FREE Cup.</span>
              </div>
            </div>

            <Card className="overflow-hidden border-emerald-300/20 bg-black/45 p-0 text-white shadow-[0_25px_80px_rgba(0,0,0,.45)] backdrop-blur-xl">
              <div className="border-b border-white/10 bg-emerald-300/[.08] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[11px] font-black uppercase tracking-[.18em] text-emerald-300">Live tournament</p><h2 className="mt-1 text-2xl font-black">{gameWeek > 0 ? `GW${gameWeek} FREE Common Cup` : "FREE Common Cup"}</h2></div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/10"><Trophy className="h-6 w-6 text-emerald-200" /></div>
                </div>
              </div>
              <div className="space-y-4 p-5">
                {isLoading ? (
                  <p className="text-sm text-slate-400">Loading live tournament...</p>
                ) : freeCommon ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><Users className="h-5 w-5 text-cyan-300" /><p className="mt-3 text-3xl font-black">{entrants}</p><p className="text-xs text-slate-400">manager{entrants === 1 ? "" : "s"} entered</p></div>
                      <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><Clock3 className="h-5 w-5 text-amber-300" /><p className="mt-3 text-xl font-black">{countdown}</p><p className="text-xs text-slate-400">until entries lock</p></div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs uppercase tracking-[.15em] text-slate-500">Entry deadline</p><p className="mt-1 font-bold">{lockTime}</p></div>
                    <a href={loginHref} className="block"><Button size="lg" className="w-full font-black">Enter FREE GW{gameWeek || ""}</Button></a>
                    <p className="text-center text-[11px] leading-5 text-slate-500">N$0 tournament entry fee. Premier League gameweek scoring rules apply.</p>
                  </>
                ) : (
                  <><p className="text-sm leading-6 text-slate-300">The next FREE Common Card Cup is being prepared. Create your free club now so your Starter 5 is ready when entries open.</p><a href={loginHref} className="block"><Button size="lg" className="w-full font-black">Get My 5 FREE Cards</Button></a></>
                )}
              </div>
            </Card>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[.025]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="text-center"><p className="text-xs font-black uppercase tracking-[.22em] text-cyan-300">Three simple steps</p><h2 className="mt-3 text-3xl font-black">From signup to the pitch</h2></div>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {[
                ["1", "Create your club", "Sign in and choose your unique Fantasy Arena manager team name."],
                ["2", "Choose 5 FREE cards", "Draft a goalkeeper, defender, midfielder, forward and wildcard from your free starter choices."],
                ["3", "Enter the FREE Cup", "Pick your lineup and captain. Real Premier League performances decide your score."],
              ].map(([step, title, text]) => <Card key={step} className="border-white/10 bg-black/30 p-5 text-white"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/10 text-lg font-black text-cyan-200">{step}</div><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></Card>)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
          <Sparkles className="mx-auto h-8 w-8 text-emerald-300" />
          <h2 className="mt-4 text-3xl font-black sm:text-4xl">Your football knowledge is the entry ticket.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">Start with Common cards for free, compete each gameweek and grow your Fantasy Arena Collection from the cards you earn and win.</p>
          <a href={loginHref} className="mt-7 inline-flex"><Button size="lg" className="font-black">Start Playing FREE <ArrowRight className="ml-2 h-5 w-5" /></Button></a>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#02040d]/95 p-3 backdrop-blur-lg sm:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3"><div><p className="text-xs font-black">{gameWeek > 0 ? `GW${gameWeek} FREE Cup` : "FREE Card Cup"}</p><p className="text-[10px] text-slate-400">{freeCommon ? `${entrants} entered • ${countdown}` : "Get your Starter 5"}</p></div><a href={loginHref}><Button size="sm" className="font-black">Join FREE</Button></a></div>
      </div>
      <div className="h-16 sm:hidden" />
    </div>
  );
}

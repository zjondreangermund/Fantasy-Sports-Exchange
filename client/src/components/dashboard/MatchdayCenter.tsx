import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, CalendarDays, Newspaper, Radio, Shield, Trophy, Users } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

type MatchdayTeam = {
  name: string;
  badge?: string;
  score?: number | null;
};

type MatchdayFixture = {
  id: string | number;
  date: string;
  status?: string;
  venue?: string;
  homeTeam: MatchdayTeam;
  awayTeam: MatchdayTeam;
};

type MatchdayNews = {
  title: string;
  url?: string;
  source?: string;
  publishedAt?: string;
};

type MatchdayResponse = {
  updatedAt: string;
  source: string;
  liveGames: MatchdayFixture[];
  nextFixtures: MatchdayFixture[];
  news: MatchdayNews[];
};

function formatKickoff(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBC";
  return date.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function teamShort(name: string) {
  return String(name || "TBD").replace("Manchester", "Man").replace("Tottenham Hotspur", "Spurs");
}

function statusLabel(status?: string) {
  const value = String(status || "NS").toUpperCase();
  if (value === "LIVE" || value.includes("H")) return "Live";
  if (value === "FT") return "FT";
  if (value === "NS") return "Upcoming";
  return value;
}

export default function MatchdayCenter() {
  const { data, isLoading } = useQuery<MatchdayResponse>({
    queryKey: ["/api/matchday/epl"],
    queryFn: async () => {
      const res = await fetch("/api/matchday/epl", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch Matchday Center");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const heroFixture = useMemo(() => data?.liveGames?.[0] || data?.nextFixtures?.[0], [data]);
  const fixtures = data?.nextFixtures?.slice(0, 6) || [];
  const news = data?.news?.slice(0, 4) || [];

  if (isLoading) {
    return <Skeleton className="h-[420px] rounded-[32px] bg-white/10" />;
  }

  return (
    <section className="space-y-4">
      <Card className="relative overflow-hidden border-cyan-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,.22),transparent_36%),linear-gradient(135deg,rgba(2,6,23,.96),rgba(8,47,73,.78),rgba(2,6,23,.94))] p-5 text-white shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,.08)_45%,transparent_70%)] opacity-40" />
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className="bg-cyan-300 text-slate-950"><Radio className="mr-1 h-3 w-3" /> Matchday Center</Badge>
              <Badge variant="outline" className="border-white/20 text-white">Premier League</Badge>
              <Badge variant="outline" className="border-white/20 text-white">{data?.source || "Live API"}</Badge>
            </div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Your Premier League command room</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/62 sm:text-base">Live context for your fantasy squad: next gameweek fixtures, matchday news, and a direct path to select your 5-card lineup.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/collection?lineup=edit"><Button className="bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200">Select Squad <Users className="ml-2 h-4 w-4" /></Button></Link>
              <Link href="/premier-league"><Button variant="outline" className="border-white/20 text-white hover:bg-white/10">Live Games <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
            {heroFixture ? (
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge className={statusLabel(heroFixture.status) === "Live" ? "bg-red-500 text-white" : "bg-white/10 text-white"}>{statusLabel(heroFixture.status)}</Badge>
                  <span className="text-xs font-semibold text-white/45">{formatKickoff(heroFixture.date)}</span>
                </div>
                <FixtureTeam team={heroFixture.homeTeam} />
                <div className="my-3 h-px bg-white/10" />
                <FixtureTeam team={heroFixture.awayTeam} />
                {heroFixture.venue ? <p className="mt-4 text-xs text-white/45">{heroFixture.venue}</p> : null}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-white/55">No upcoming Premier League fixture found.</div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="border-white/10 bg-slate-950/70 p-5 text-white backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-cyan-300" /><h2 className="font-black">Next Gameweek Fixtures</h2></div>
            <Link href="/premier-league"><Button size="sm" variant="outline">Full Live Games</Button></Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {fixtures.length ? fixtures.map((fixture) => <FixtureCard key={fixture.id} fixture={fixture} />) : <p className="text-sm text-white/50">Fixtures will appear here when the free API returns the next gameweek.</p>}
          </div>
        </Card>

        <Card className="border-white/10 bg-white/[0.06] p-5 text-white backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2"><Newspaper className="h-5 w-5 text-cyan-300" /><h2 className="font-black">Premier League News</h2></div>
          <div className="space-y-3">
            {news.length ? news.map((item, index) => <NewsItem key={`${item.title}-${index}`} item={item} />) : <p className="text-sm text-white/50">News feed unavailable. The dashboard will keep working with fixtures and squad tools.</p>}
          </div>
        </Card>
      </div>
    </section>
  );
}

function FixtureTeam({ team }: { team: MatchdayTeam }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {team.badge ? <img src={team.badge} alt="" className="h-9 w-9 rounded-full object-contain" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-300/10"><Shield className="h-4 w-4 text-cyan-300" /></div>}
        <span className="truncate font-black">{teamShort(team.name)}</span>
      </div>
      {team.score !== null && team.score !== undefined ? <span className="text-2xl font-black">{team.score}</span> : null}
    </div>
  );
}

function FixtureCard({ fixture }: { fixture: MatchdayFixture }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/45"><span>{formatKickoff(fixture.date)}</span><Badge variant="outline" className="border-white/15 text-white/70">{statusLabel(fixture.status)}</Badge></div>
      <div className="space-y-2 text-sm"><FixtureTeam team={fixture.homeTeam} /><FixtureTeam team={fixture.awayTeam} /></div>
    </div>
  );
}

function NewsItem({ item }: { item: MatchdayNews }) {
  const content = <div className="rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-cyan-300/35 hover:bg-cyan-300/10"><p className="line-clamp-2 text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-white/45">{item.source || "Football news"}</p></div>;
  if (!item.url) return content;
  return <a href={item.url} target="_blank" rel="noreferrer">{content}</a>;
}

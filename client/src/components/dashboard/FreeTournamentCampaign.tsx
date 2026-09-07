import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Clock3, Copy, Share2, Sparkles, Trophy, Users } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useToast } from "../../hooks/use-toast";

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
};

type ReferralResponse = {
  code?: string;
  url?: string;
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

export default function FreeTournamentCampaign() {
  const { toast } = useToast();
  const [clockTick, setClockTick] = useState(0);

  const { data: competitions } = useQuery<Tournament[]>({
    queryKey: ["/api/competitions"],
    queryFn: async () => {
      const res = await fetch("/api/competitions", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : Array.isArray(data?.competitions) ? data.competitions : [];
    },
    refetchInterval: 60_000,
  });

  const { data: referral } = useQuery<ReferralResponse>({
    queryKey: ["/api/referrals/me"],
    queryFn: async () => {
      const res = await fetch("/api/referrals/me", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
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

  if (!freeCommon) return null;

  const gameWeek = Number(freeCommon.gameWeek || 0);
  const entrants = Number(freeCommon.entryCount || 0);
  const countdown = countdownLabel(freeCommon.submissionClosesAt);
  void clockTick;

  const shareTournament = async () => {
    const referralUrl = String(referral?.url || "").trim();
    const fallbackUrl = typeof window !== "undefined" ? `${window.location.origin}/competitions` : "/competitions";
    const url = referralUrl || fallbackUrl;
    const text = `Gameweek ${gameWeek || ""} is open on Fantasy Arena. Join the FREE Common Card Cup and challenge me.`.trim();

    try {
      if (navigator.share) {
        await navigator.share({ title: "Fantasy Arena FREE tournament", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Invite link copied", description: "Send it to a friend. Successful referrals earn you a Common card." });
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      toast({ title: "Share link ready", description: url });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-emerald-300/25 bg-gradient-to-br from-emerald-300/[0.16] via-cyan-300/[0.08] to-transparent p-4 shadow-[0_0_50px_rgba(52,211,153,0.08)] sm:p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-200/30 bg-emerald-300/15 text-emerald-50">FREE ENTRY</Badge>
            <Badge variant="outline" className="border-white/15 text-white/80">GW{gameWeek || "Open"}</Badge>
            <Badge variant="outline" className="border-white/15 text-white/80">Common cards</Badge>
          </div>
          <div>
            <div className="flex items-center gap-2 text-emerald-100">
              <Trophy className="h-5 w-5" />
              <h3 className="text-xl font-black text-white sm:text-2xl">Gameweek {gameWeek || ""} FREE Tournament is open</h3>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">Use 5 Common cards, score from real Premier League performances, and compete this gameweek without paying an entry fee.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-200 sm:text-sm">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-3 py-1.5"><Users className="h-3.5 w-3.5 text-cyan-200" />{entrants} manager{entrants === 1 ? "" : "s"} entered</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-3 py-1.5"><Clock3 className="h-3.5 w-3.5 text-amber-200" />{countdown}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-3 py-1.5"><Sparkles className="h-3.5 w-3.5 text-violet-200" />Invite a friend → earn a Common card</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/competitions">
            <Button className="font-bold">Enter FREE GW{gameWeek || ""}</Button>
          </Link>
          <Button type="button" variant="outline" onClick={shareTournament} className="border-white/20 bg-black/20 text-white hover:bg-white/10">
            {typeof navigator !== "undefined" && navigator.share ? <Share2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            Invite a friend
          </Button>
        </div>
      </div>
    </div>
  );
}

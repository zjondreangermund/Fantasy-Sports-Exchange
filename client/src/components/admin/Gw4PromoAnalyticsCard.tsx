import { useQuery } from "@tanstack/react-query";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Download, LogIn, MousePointerClick, Smartphone, Trophy, UserPlus, Users } from "lucide-react";

type PromoAttempt = {
  visitorId: string;
  source: string;
  content: string;
  startedAt: string;
  outcome: "started_only" | "new_signup" | "returning_login";
  email?: string | null;
  clubName?: string | null;
};

type PromoSignup = {
  userId: string;
  email?: string | null;
  name?: string | null;
  clubName?: string | null;
  source: string;
  content: string;
  signedUpAt: string;
  starter5Completed: boolean;
  installedApp: boolean;
};

type PromoAnalytics = {
  campaign: string;
  hours: number;
  metrics: {
    adLandingClicks: number;
    signupButtonClicks: number;
    authStarted: number;
    newAccounts: number;
    returningLogins: number;
    starter5Completed: number;
    tournamentOpenedAfterSignup: number;
    appDownloadClicks: number;
    campaignLinkedInstalls: number;
    globalNativeFirstOpens: number;
  };
  bySource: Array<{ source: string; clicks: number; signups: number }>;
  attempts: PromoAttempt[];
  signups: PromoSignup[];
};

function when(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("en-NA", { timeZone: "Africa/Windhoek", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
}

export default function Gw4PromoAnalyticsCard() {
  const { data, isLoading } = useQuery<PromoAnalytics>({
    queryKey: ["/api/admin/gw4-promo?hours=168"],
    refetchInterval: 30_000,
  });

  const metrics = data?.metrics;
  const tiles = [
    { label: "Ad landing clicks", value: metrics?.adLandingClicks || 0, icon: MousePointerClick },
    { label: "Tried sign up", value: metrics?.authStarted || 0, icon: LogIn },
    { label: "New accounts", value: metrics?.newAccounts || 0, icon: UserPlus },
    { label: "Starter 5 done", value: metrics?.starter5Completed || 0, icon: Users },
    { label: "Opened GW4 tab", value: metrics?.tournamentOpenedAfterSignup || 0, icon: Trophy },
    { label: "APK downloads", value: metrics?.appDownloadClicks || 0, icon: Download },
    { label: "Campaign installs", value: metrics?.campaignLinkedInstalls || 0, icon: Smartphone },
  ];

  return (
    <Card className="border-fuchsia-300/15 bg-[linear-gradient(135deg,rgba(168,85,247,.11),rgba(8,15,30,.92),rgba(34,211,238,.07))] p-4 text-white sm:p-5" data-gw4-promo-analytics>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-200/70">GW4 Free Common promotion · last 7 days</div><h2 className="mt-1 text-xl font-black">Paid-ad funnel only</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">Tracks visits to the dedicated GW4 ad link, signup attempts and attributed installs. Normal tournament entries by already logged-in users are not counted as ad signups.</p></div>
        <Badge className="w-fit bg-cyan-300/10 text-cyan-100">{data?.campaign || "gw4_free_common_2026"}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/[.08] bg-black/20 p-3"><Icon className="h-4 w-4 text-cyan-200" /><div className="mt-2 text-2xl font-black">{isLoading ? "…" : value}</div><div className="mt-1 text-[9px] font-black uppercase leading-4 tracking-[.09em] text-slate-500">{label}</div></div>)}
      </div>

      {(data?.bySource || []).length ? <div className="mt-4 flex flex-wrap gap-2">{data!.bySource.map((row) => <span key={row.source} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[10px] font-bold text-slate-300"><strong className="text-white">{row.source}</strong> · {row.clicks} clicks · {row.signups} signups</span>)}</div> : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/[.07] bg-black/20">
          <div className="border-b border-white/[.07] px-3 py-2 text-[10px] font-black uppercase tracking-[.15em] text-slate-400">Who tried to sign up</div>
          <div className="max-h-64 overflow-auto">
            {(data?.attempts || []).length ? data!.attempts.slice(0, 30).map((row) => <div key={`${row.visitorId}-${row.startedAt}`} className="grid grid-cols-[1fr_auto] gap-2 border-b border-white/[.05] px-3 py-2.5 last:border-0"><div className="min-w-0"><div className="truncate text-xs font-black">{row.clubName || row.email || `Visitor ${row.visitorId.slice(0, 8)}`}</div><div className="mt-0.5 text-[10px] text-slate-500">{row.source}{row.content ? ` · ${row.content}` : ""} · {when(row.startedAt)}</div></div><Badge variant="outline" className="h-fit border-white/10 text-[9px] text-slate-300">{row.outcome === "new_signup" ? "New signup" : row.outcome === "returning_login" ? "Existing login" : "Started only"}</Badge></div>) : <div className="p-5 text-center text-xs text-slate-500">No signup attempts from this promotion yet.</div>}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[.07] bg-black/20">
          <div className="border-b border-white/[.07] px-3 py-2 text-[10px] font-black uppercase tracking-[.15em] text-slate-400">New users from this promotion</div>
          <div className="max-h-64 overflow-auto">
            {(data?.signups || []).length ? data!.signups.slice(0, 30).map((row) => <div key={row.userId} className="grid grid-cols-[1fr_auto] gap-2 border-b border-white/[.05] px-3 py-2.5 last:border-0"><div className="min-w-0"><div className="truncate text-xs font-black">{row.clubName || row.name || row.email || row.userId}</div><div className="mt-0.5 truncate text-[10px] text-slate-500">{row.email || "No email shown"} · {row.source} · {when(row.signedUpAt)}</div></div><div className="flex items-center gap-1"><Badge className={row.starter5Completed ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-100"}>{row.starter5Completed ? "Starter 5 ✓" : "Onboarding"}</Badge>{row.installedApp ? <Badge className="bg-cyan-300/10 text-cyan-100">App ✓</Badge> : null}</div></div>) : <div className="p-5 text-center text-xs text-slate-500">No new accounts attributed to this promotion yet.</div>}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-4 text-slate-500">“Campaign installs” means the installed Android app was actually opened and later linked to an account attributed to this campaign. A raw APK file installation cannot report anything until the app is opened.</p>
    </Card>
  );
}

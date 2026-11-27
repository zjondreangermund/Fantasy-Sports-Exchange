import { Activity, ShieldCheck } from "lucide-react";
import FootballDataCentre from "../FootballDataCentre";

export default function NativePremierLeaguePage() {
  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-premier-league data-premier-hub-full-intelligence>
      <section className="overflow-hidden rounded-[1.55rem] border border-indigo-300/15 bg-[radial-gradient(circle_at_90%_0%,rgba(99,102,241,.2),transparent_34%),linear-gradient(145deg,#0a0e20,#070916)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-indigo-200/70">Premier League Hub</p>
            <h2 className="mt-1 text-2xl font-black">Real football. Live fantasy intelligence.</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">The same Premier League intelligence as desktop: live matches and results, table, player availability, leaders, clubs, squads, transfers, coaches, stadiums and player profiles.</p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-indigo-300/15 bg-indigo-300/[.08] text-indigo-100"><Activity className="h-5 w-5" /></div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.045] px-3 py-2.5 text-[10px] font-bold leading-4 text-emerald-100">
          <ShieldCheck className="h-4 w-4 shrink-0" />Fantasy Arena card and tournament points are calculated from real Premier League in-game performance.
        </div>
      </section>
      <div className="mt-3 min-w-0 overflow-hidden" data-premier-desktop-intelligence-in-apk>
        <FootballDataCentre />
      </div>
    </div>
  );
}

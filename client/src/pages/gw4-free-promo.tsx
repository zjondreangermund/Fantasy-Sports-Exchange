import * as React from "react";
import { ArrowRight, BarChart3, CheckCircle2, Gift, ShieldCheck, Trophy, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { GW4_PROMO_CAMPAIGN, gw4PromoLoginHref, rememberGw4Promo, sendGw4PromoEvent } from "../lib/gw4-promo";

const LOGO = "/brand/fantasy-arena-logo.jpg?v=lion-jpg-2026-08";

export default function Gw4FreePromoPage() {
  const [loginHref, setLoginHref] = React.useState("/api/login");

  React.useEffect(() => {
    rememberGw4Promo();
    setLoginHref(gw4PromoLoginHref());
    const key = `fantasy_arena_promo_click:${GW4_PROMO_CAMPAIGN}:${window.location.search}`;
    if (!window.sessionStorage.getItem(key)) {
      window.sessionStorage.setItem(key, "1");
      void sendGw4PromoEvent("promo_click");
    }
  }, []);

  const start = () => {
    rememberGw4Promo();
    void sendGw4PromoEvent("promo_signup_click");
  };

  return (
    <main className="min-h-screen bg-[#030611] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(168,85,247,.17),transparent_30%),radial-gradient(circle_at_85%_16%,rgba(34,211,238,.14),transparent_34%),linear-gradient(180deg,#050914,#02040c)]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Fantasy Arena" className="h-12 w-12 rounded-xl border border-fuchsia-300/25 object-cover shadow-[0_0_24px_rgba(168,85,247,.2)]" />
            <div><div className="text-base font-black tracking-wide">FANTASY ARENA</div><div className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-200/55">Real football · real points</div></div>
          </div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-200">Free entry</span>
        </header>

        <section className="grid gap-8 pb-10 pt-10 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:pt-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-100"><Trophy className="h-3.5 w-3.5" />Gameweek 4 · Common</div>
            <h1 className="mt-5 text-4xl font-black leading-[.98] tracking-tight sm:text-6xl">GW4 FREE<br /><span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">Common Card Cup</span></h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">Choose 5 eligible Premier League cards, pick your captain and compete. Your Fantasy Arena points come from those players’ real in-game Premier League performances.</p>

            <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-300/[.07] p-4">
              <div className="flex items-start gap-3"><Gift className="mt-0.5 h-6 w-6 shrink-0 text-fuchsia-200" /><div><div className="text-xs font-black uppercase tracking-[.15em] text-fuchsia-200/70">Winner prize</div><div className="mt-1 text-xl font-black">1 random Rare Premier League player card</div><p className="mt-1 text-sm leading-6 text-slate-400">Keep it, use it in eligible Rare tournaments, sell it or list it for loan when trading is open.</p></div></div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2">N$0 entry</span>
              <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2">5 Common cards</span>
              <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2">Real match scoring</span>
              <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2">Closes Sat 16:00</span>
            </div>

            <a href={loginHref} onClick={start} className="mt-7 inline-flex w-full sm:w-auto">
              <Button size="lg" className="h-14 w-full rounded-2xl bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300 px-7 text-base font-black text-slate-950 shadow-[0_0_36px_rgba(34,211,238,.16)] sm:w-auto">Enter GW4 Free <ArrowRight className="ml-2 h-5 w-5" /></Button>
            </a>
            <p className="mt-3 text-xs text-slate-500">New manager? Sign in, create your club and choose your 5 free Starter cards. We’ll take you straight to the tournament tab afterwards.</p>
          </div>

          <Card className="overflow-hidden border-white/10 bg-[#080d1b]/90 text-white shadow-2xl">
            <div className="border-b border-white/10 bg-[linear-gradient(120deg,rgba(168,85,247,.13),rgba(34,211,238,.08))] p-5">
              <div className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-200/65">How to enter</div>
              <h2 className="mt-1 text-2xl font-black">Three simple steps</h2>
            </div>
            <div className="space-y-1 p-3">
              {[
                { icon: Users, title: "Create your club", text: "Sign in and choose your Fantasy Arena club name." },
                { icon: ShieldCheck, title: "Choose your Starter 5", text: "Pick one free Common card from each Starter Draft group." },
                { icon: BarChart3, title: "Enter the GW4 Common Cup", text: "Submit your five cards and captain. Real Premier League performances decide the leaderboard." },
              ].map(({ icon: Icon, title, text }, index) => (
                <div key={title} className="flex gap-3 rounded-2xl p-3 hover:bg-white/[.03]"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-cyan-200"><Icon className="h-4 w-4" /></div><div><div className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Step {index + 1}</div><div className="font-black">{title}</div><p className="mt-1 text-sm leading-5 text-slate-400">{text}</p></div></div>
              ))}
            </div>
            <div className="border-t border-white/10 p-5 text-center"><CheckCircle2 className="mx-auto h-5 w-5 text-emerald-300" /><p className="mt-2 text-sm font-bold">No deposit required to start.</p><p className="mt-1 text-xs text-slate-500">playfantasyarena.com</p></div>
          </Card>
        </section>
      </div>
    </main>
  );
}

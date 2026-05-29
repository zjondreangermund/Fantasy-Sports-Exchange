import { Link } from "wouter";
import { ArrowRight, Shield, Sparkles, Trophy, Wallet } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import PremiumGlassPanel from "../PremiumGlassPanel";

type DashboardCommandHeroProps = {
  managerName?: string | null;
  balance?: number | null;
  cardCount?: number | null;
  totalScore?: number | null;
  rewardAvailable?: boolean;
};

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DashboardCommandHero({
  managerName,
  balance = 0,
  cardCount = 0,
  totalScore = 0,
  rewardAvailable = false,
}: DashboardCommandHeroProps) {
  return (
    <PremiumGlassPanel className="mb-6" eyebrow="Manager HQ" title={`Welcome back, ${managerName || "Manager"}`} description="Control your squad, wallet, marketplace moves and tournament rewards from one premium command room.">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100">Live economy</Badge>
            <Badge className="border-violet-300/25 bg-violet-300/10 text-violet-100">SO5 ready</Badge>
            {rewardAvailable && <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100">Reward waiting</Badge>}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
                <Wallet className="h-5 w-5" />
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Wallet</p>
              <p className="mt-1 text-2xl font-black text-white">N${money.format(Number(balance || 0))}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                <Shield className="h-5 w-5" />
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cards</p>
              <p className="mt-1 text-2xl font-black text-white">{Number(cardCount || 0)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200">
                <Trophy className="h-5 w-5" />
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last score</p>
              <p className="mt-1 text-2xl font-black text-white">{Number(totalScore || 0)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-4">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-black text-white">Next move</h3>
          <p className="mt-2 text-sm text-slate-400">Open the market, set your lineup, or claim a tournament prize before the next match window.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/marketplace"><Button size="sm">Marketplace <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Link href="/collection"><Button size="sm" variant="outline">Lineup</Button></Link>
            <Link href="/competitions"><Button size="sm" variant="outline">Tournaments</Button></Link>
          </div>
        </div>
      </div>
    </PremiumGlassPanel>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Gift, Trophy, Zap, Lock, CheckCircle2, Flame } from "lucide-react";
import { Link } from "wouter";

type VaultItem = {
  id: string;
  season: string;
  rarity: string;
  gameWeek: number;
  tierIndex: number;
  title: string;
  category: string;
  value: number;
  targetEntries: number;
  currentEntries: number;
  unlocked: boolean;
  active: boolean;
  sponsor?: string | null;
};

type VaultPayload = {
  season: string;
  items: VaultItem[];
  summary: Record<string, { unlocked: number; total: number; currentEntries: number; targetEntries: number }>;
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`;
}

function pct(item: VaultItem) {
  if (!item.targetEntries) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(item.currentEntries || 0) / Number(item.targetEntries || 1)) * 100)));
}

const rarityOrder = ["common", "rare", "epic", "unique", "legendary"];

export default function PrizeVaultPage() {
  const { data, isLoading } = useQuery<VaultPayload>({
    queryKey: ["/api/prize-vault"],
    queryFn: async () => {
      const res = await fetch("/api/prize-vault", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load Prize Vault");
      return res.json();
    },
  });

  const items = Array.isArray(data?.items) ? data!.items : [];
  const featured = useMemo(() => items.find((item) => item.active && !item.unlocked) || items.find((item) => !item.unlocked) || items[0], [items]);

  return (
    <main className="premium-page min-h-full overflow-x-hidden px-3 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-yellow-300/20 bg-slate-950/85 p-5 shadow-[0_30px_120px_rgba(250,204,21,.12)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(250,204,21,.28),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(168,85,247,.24),transparent_34%),linear-gradient(180deg,rgba(255,255,255,.08),transparent_45%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300/25 bg-yellow-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.24em] text-yellow-100">
                <Gift className="h-3.5 w-3.5" /> 2026/27 Prize Vault
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Unlock prizes together.</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/60 sm:text-base">Each gameweek has prize targets per rarity. More entries unlock bigger prizes. If a target is not reached, progress keeps building toward the next unlock.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/competitions"><Button className="rounded-xl bg-yellow-300 font-black text-slate-950 hover:bg-yellow-200"><Trophy className="mr-2 h-4 w-4" />Enter tournaments</Button></Link>
                <Link href="/marketplace"><Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white">Upgrade cards</Button></Link>
              </div>
            </div>
            {featured ? <FeaturedVaultCard item={featured} /> : <Card className="border-white/10 bg-black/30 p-5 text-white">{isLoading ? "Loading vault…" : "No vault prizes loaded yet."}</Card>}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          {rarityOrder.map((rarity) => {
            const row = data?.summary?.[rarity];
            return (
              <Card key={rarity} className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-[.2em] text-white/40">{rarity}</span><Badge>{row?.unlocked || 0}/{row?.total || 38}</Badge></div>
                <div className="mt-3 text-2xl font-black">{row?.currentEntries || 0}</div>
                <div className="mt-1 text-xs text-white/45">entries toward active unlock</div>
              </Card>
            );
          })}
        </section>

        <section className="space-y-5">
          {rarityOrder.map((rarity) => {
            const rarityItems = items.filter((item) => item.rarity === rarity);
            if (!rarityItems.length) return null;
            return (
              <div key={rarity} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black capitalize">{rarity} Vault</h2>
                  <Badge className="bg-white/10 text-white">38 gameweek prizes</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {rarityItems.slice(0, 38).map((item) => <VaultTile key={item.id} item={item} />)}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function FeaturedVaultCard({ item }: { item: VaultItem }) {
  const progress = pct(item);
  return (
    <Card className="relative overflow-hidden border-yellow-300/25 bg-black/45 p-5 text-white shadow-2xl shadow-yellow-500/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(250,204,21,.22),transparent_38%),linear-gradient(135deg,rgba(255,255,255,.08),transparent)]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3"><Badge className="capitalize bg-yellow-300 text-slate-950">GW {item.gameWeek} • {item.rarity}</Badge>{item.unlocked ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Lock className="h-5 w-5 text-yellow-200" />}</div>
        <div className="mt-5 text-3xl font-black">{item.title}</div>
        <div className="mt-1 text-sm text-white/50">{item.category} • approx {money(item.value)}</div>
        <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-yellow-300" style={{ width: `${progress}%` }} /></div>
        <div className="mt-3 flex items-center justify-between text-sm"><span className="font-black">{item.currentEntries} / {item.targetEntries} entries</span><span className="text-yellow-100">{progress}% unlocked</span></div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-xs text-white/55"><Flame className="mr-1 inline h-3.5 w-3.5 text-orange-300" />Next target unlocks automatically when the entry target is reached.</div>
      </div>
    </Card>
  );
}

function VaultTile({ item }: { item: VaultItem }) {
  const progress = pct(item);
  return (
    <Card className={`border p-4 text-white ${item.unlocked ? "border-emerald-300/25 bg-emerald-400/10" : item.active ? "border-yellow-300/25 bg-yellow-300/10" : "border-white/10 bg-white/[0.05]"}`}>
      <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-white/40">GW {item.gameWeek}</div><div className="mt-1 font-black">{item.title}</div></div>{item.unlocked ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" /> : item.active ? <Zap className="h-5 w-5 shrink-0 text-yellow-200" /> : <Lock className="h-5 w-5 shrink-0 text-white/25" />}</div>
      <div className="mt-3 text-xs text-white/50">{money(item.value)} • target {item.targetEntries}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${item.unlocked ? "bg-emerald-300" : "bg-yellow-300"}`} style={{ width: `${progress}%` }} /></div>
      <div className="mt-2 flex justify-between text-[11px] text-white/45"><span>{item.currentEntries}/{item.targetEntries}</span><span>{item.unlocked ? "Unlocked" : item.active ? "Active" : "Queued"}</span></div>
    </Card>
  );
}

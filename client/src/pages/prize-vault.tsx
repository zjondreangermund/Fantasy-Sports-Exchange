import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Flame,
  Gift,
  Lock,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "wouter";

type VaultItem = {
  id: string;
  season: string;
  rarity: string;
  tierIndex: number;
  title: string;
  category: string;
  value: number;
  targetEntries: number;
  requiredEntrants?: number;
  unlockTarget?: number;
  entryFee?: number;
  marginMultiplier?: number;
  currentEntries: number;
  unlocked: boolean;
  active: boolean;
  replaced?: boolean;
  currentPrize?: boolean;
  nextPrize?: boolean;
  sponsor?: string | null;
};

type VaultPayload = {
  season: string;
  items: VaultItem[];
  ladders?: Record<string, { items: VaultItem[]; currentEntries: number; entryFee: number; marginMultiplier: number; activePrize?: any; nextPrize?: any; entrantsToNext?: number; currentGameWeek?: number }>;
  summary: Record<string, { unlocked: number; total: number; currentEntries: number; targetEntries: number; activePrize?: any; nextPrize?: any; entrantsToNext?: number; entryFee?: number; marginMultiplier?: number; currentGameWeek?: number }>;
};

const rarityOrder = ["common", "rare", "unique", "epic", "legendary"];

const rarityTheme: Record<string, { accent: string; glow: string; text: string; gradient: string; frame: string }> = {
  common: {
    accent: "#cbd5e1",
    glow: "rgba(203,213,225,.34)",
    text: "text-slate-100",
    gradient: "from-slate-200 via-slate-500 to-slate-950",
    frame: "border-slate-300/40",
  },
  rare: {
    accent: "#38bdf8",
    glow: "rgba(56,189,248,.4)",
    text: "text-sky-100",
    gradient: "from-cyan-200 via-sky-500 to-slate-950",
    frame: "border-sky-300/45",
  },
  unique: {
    accent: "#c084fc",
    glow: "rgba(192,132,252,.48)",
    text: "text-purple-100",
    gradient: "from-fuchsia-200 via-purple-600 to-slate-950",
    frame: "border-purple-300/50",
  },
  epic: {
    accent: "#fb7185",
    glow: "rgba(251,113,133,.48)",
    text: "text-rose-100",
    gradient: "from-orange-200 via-rose-600 to-slate-950",
    frame: "border-rose-300/50",
  },
  legendary: {
    accent: "#facc15",
    glow: "rgba(250,204,21,.52)",
    text: "text-yellow-100",
    gradient: "from-yellow-100 via-amber-500 to-slate-950",
    frame: "border-yellow-300/55",
  },
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`;
}

function pct(item: VaultItem) {
  const target = Number(item.targetEntries || item.requiredEntrants || 0);
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(item.currentEntries || 0) / target) * 100)));
}

function prizeGlyph(item: VaultItem) {
  const label = `${item.title} ${item.category}`.toLowerCase();
  if (label.includes("airtime") || label.includes("phone")) return "📱";
  if (label.includes("headset")) return "🎧";
  if (label.includes("voucher")) return "🎟️";
  if (label.includes("playstation") || label.includes("xbox") || label.includes("console")) return "🎮";
  if (label.includes("pc") || label.includes("monitor") || label.includes("macbook") || label.includes("laptop")) return "🖥️";
  if (label.includes("hilux") || label.includes("ranger") || label.includes("amarok") || label.includes("fortuner") || label.includes("car")) return "🚙";
  if (label.includes("motorcycle")) return "🏍️";
  if (label.includes("boat")) return "🚤";
  if (label.includes("house") || label.includes("home") || label.includes("apartment")) return "🏠";
  if (label.includes("holiday") || label.includes("travel") || label.includes("trip") || label.includes("safari")) return "✈️";
  if (label.includes("watch")) return "⌚";
  if (label.includes("drone")) return "🚁";
  return "🎁";
}

export default function PrizeVaultPage() {
  const [activeRarity, setActiveRarity] = useState("rare");
  const [selectedPrizeId, setSelectedPrizeId] = useState<string>("");
  const { data, isLoading } = useQuery<VaultPayload>({
    queryKey: ["/api/prize-vault"],
    queryFn: async () => {
      const res = await fetch("/api/prize-vault", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load Prize Vault");
      return res.json();
    },
  });

  const items = Array.isArray(data?.items) ? data!.items : [];
  const activeItems = data?.ladders?.[activeRarity]?.items || items.filter((item) => item.rarity === activeRarity);
  const selectedPrize = useMemo(() => activeItems.find((item) => item.id === selectedPrizeId) || activeItems.find((item) => item.currentPrize) || activeItems.find((item) => item.active) || activeItems[0], [activeItems, selectedPrizeId]);
  const totalEntries = rarityOrder.reduce((sum, rarity) => sum + Number(data?.summary?.[rarity]?.currentEntries || 0), 0);
  const unlockedCount = items.filter((item) => item.currentPrize || item.unlocked).length;
  const totalPrizeValue = items.reduce((sum, item) => sum + Number(item.currentPrize ? item.value : 0), 0);
  const row = data?.summary?.[activeRarity];

  return (
    <main className="premium-page min-h-full overflow-x-hidden px-3 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-3 text-white sm:px-5 lg:px-7">
      <div className="relative mx-auto max-w-[1500px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#030816]/95 shadow-[0_35px_140px_rgba(0,0,0,.75)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_0%,rgba(124,58,237,.34),transparent_30%),radial-gradient(circle_at_15%_22%,rgba(37,99,235,.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,.035),transparent_28%)]" />
        <div className="pointer-events-none absolute right-[8%] top-5 h-60 w-60 rounded-full border-[18px] border-purple-400/20 shadow-[0_0_100px_rgba(139,92,246,.45),inset_0_0_55px_rgba(139,92,246,.34)] sm:h-80 sm:w-80" />

        <header className="relative border-b border-white/10 px-4 py-5 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-purple-300/30 bg-purple-400/10 p-3 shadow-[0_0_30px_rgba(168,85,247,.22)]"><Gift className="h-6 w-6 text-purple-200" /></div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/65">2026/27 season</div>
                  <h1 className="bg-gradient-to-b from-white via-slate-100 to-slate-500 bg-clip-text text-4xl font-black tracking-[.04em] text-transparent sm:text-6xl">PRIZE VAULT</h1>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-sm text-white/55">Bigger prizes. More entries. Every gameweek. Each tournament is linked to one rarity ladder and the highest unlocked prize becomes that week’s reward.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <TopStat icon={Users} label="Total entries" value={totalEntries.toLocaleString()} />
              <TopStat icon={Trophy} label="Unlocked" value={String(unlockedCount)} />
              <TopStat icon={Gift} label="Live prize value" value={money(totalPrizeValue)} />
              <TopStat icon={Clock3} label="Season" value="26/27" />
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {rarityOrder.map((rarity) => {
              const theme = rarityTheme[rarity];
              const summary = data?.summary?.[rarity];
              return (
                <button
                  key={rarity}
                  onClick={() => { setActiveRarity(rarity); setSelectedPrizeId(""); }}
                  className={`min-w-[145px] rounded-2xl border px-4 py-3 text-left transition ${activeRarity === rarity ? `${theme.frame} bg-white/10 shadow-[0_0_28px_var(--vault-glow)]` : "border-white/10 bg-black/20 hover:bg-white/[0.07]"}`}
                  style={{ "--vault-glow": theme.glow } as React.CSSProperties}
                >
                  <div className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: theme.accent }}>{rarity}</div>
                  <div className="mt-1 font-black">Entry {money(summary?.entryFee)}</div>
                  <div className="mt-1 text-[10px] text-white/40">{Number(summary?.marginMultiplier || 0).toFixed(1)}x funding</div>
                </button>
              );
            })}
          </div>
        </header>

        <section className="relative px-4 py-5 sm:px-7">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[.2em]" style={{ color: rarityTheme[activeRarity].accent }}>{activeRarity} prize ladder</div>
              <h2 className="mt-1 text-2xl font-black">One chain of prizes. One winner prize.</h2>
              <p className="mt-1 text-xs text-white/45">Current gameweek entries: {row?.currentEntries || 0}. When a higher target is reached, the lower prize falls away.</p>
            </div>
            <Link href="/competitions"><Button className="rounded-xl bg-purple-500 font-black text-white hover:bg-purple-400"><Trophy className="mr-2 h-4 w-4" />Enter tournament</Button></Link>
          </div>

          <div className="relative">
            <button className="absolute left-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/70 p-3 text-white/70 backdrop-blur md:block"><ArrowLeft className="h-5 w-5" /></button>
            <div className="flex gap-4 overflow-x-auto px-0 pb-5 pt-2 md:px-12">
              {activeItems.map((item) => (
                <MetalPrizeSlab key={item.id} item={item} selected={selectedPrize?.id === item.id} onClick={() => setSelectedPrizeId(item.id)} />
              ))}
              {!activeItems.length && <Card className="w-full border-white/10 bg-white/[0.04] p-8 text-center text-white/45">{isLoading ? "Loading vault…" : "No prizes loaded for this ladder."}</Card>}
            </div>
            <button className="absolute right-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/70 p-3 text-white/70 backdrop-blur md:block"><ArrowRight className="h-5 w-5" /></button>
          </div>
        </section>

        {selectedPrize && <PrizeSpotlight item={selectedPrize} />}

        <footer className="relative grid gap-3 border-t border-white/10 bg-black/25 px-4 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
          <InfoPill icon={Sparkles} title="Every gameweek" text="Fresh entry progress on the same ladder." />
          <InfoPill icon={ShieldCheck} title="Fair and transparent" text="Prize unlocks only when funding target is met." />
          <InfoPill icon={Gift} title="Real rewards" text="Physical prize or approved equivalent value." />
          <InfoPill icon={Flame} title="Highest prize wins" text="Smaller unlocked prizes fall away automatically." />
        </footer>
      </div>
    </main>
  );
}

function TopStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="min-w-[132px] rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" />{label}</div>
      <div className="mt-2 truncate text-lg font-black text-white">{value}</div>
    </div>
  );
}

function MetalPrizeSlab({ item, selected, onClick }: { item: VaultItem; selected: boolean; onClick: () => void }) {
  const progress = pct(item);
  const theme = rarityTheme[item.rarity] || rarityTheme.common;
  const unlocked = Boolean(item.currentPrize || item.unlocked);
  const locked = !unlocked;

  return (
    <button onClick={onClick} className={`group relative min-w-[245px] max-w-[245px] text-left transition duration-300 hover:-translate-y-2 ${selected ? "-translate-y-2 scale-[1.02]" : ""}`}>
      <div
        className={`relative h-[390px] overflow-hidden rounded-[1.8rem] border-2 bg-gradient-to-br ${theme.gradient} p-[2px] shadow-2xl`}
        style={{ boxShadow: selected ? `0 0 55px ${theme.glow}, 0 30px 65px rgba(0,0,0,.65)` : `0 0 28px ${theme.glow}, 0 24px 52px rgba(0,0,0,.6)` }}
      >
        <div className="relative h-full overflow-hidden rounded-[1.65rem] border border-white/20 bg-[#07101f] p-3">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,.18)_17%,transparent_32%,transparent_68%,rgba(255,255,255,.08)_82%,transparent_100%)] opacity-70 transition-transform duration-700 group-hover:translate-x-6" />
          <div className="pointer-events-none absolute inset-2 rounded-[1.35rem] border border-white/10" />
          <div className="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l-2 border-t-2" style={{ borderColor: theme.accent }} />
          <div className="pointer-events-none absolute right-3 top-3 h-3 w-3 border-r-2 border-t-2" style={{ borderColor: theme.accent }} />
          <div className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-b-2 border-l-2" style={{ borderColor: theme.accent }} />
          <div className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-b-2 border-r-2" style={{ borderColor: theme.accent }} />

          <div className="relative z-10 flex items-center justify-between">
            <Badge className="border border-white/10 bg-black/45 text-[10px] font-black uppercase tracking-[.15em] text-white">#{item.tierIndex}</Badge>
            <span className="text-[9px] font-black uppercase tracking-[.18em]" style={{ color: theme.accent }}>{item.rarity}</span>
          </div>

          <div className="relative z-10 mt-6 flex h-150 h-[150px] items-center justify-center rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,.13),transparent_58%)]">
            <div className={`text-7xl transition duration-500 ${locked ? "grayscale opacity-55 blur-[1px]" : "drop-shadow-[0_0_20px_rgba(255,255,255,.45)]"}`}>{prizeGlyph(item)}</div>
          </div>

          <div className="relative z-10 mt-4 text-center">
            <div className="line-clamp-2 min-h-[48px] text-lg font-black leading-tight text-white">{item.title}</div>
            <div className="mt-1 text-xs text-white/45">Approx. value {money(item.value)}</div>
          </div>

          <div className="relative z-10 mt-4">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.12em] text-white/45"><span>Target</span><span>{item.targetEntries} entries</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: unlocked ? "#34d399" : theme.accent, boxShadow: `0 0 16px ${theme.glow}` }} /></div>
            <div className="mt-2 flex items-center justify-between text-xs"><span className="font-black text-white">{item.currentEntries} / {item.targetEntries}</span><span style={{ color: unlocked ? "#6ee7b7" : theme.accent }}>{unlocked ? "UNLOCKED" : `${progress}%`}</span></div>
          </div>

          {locked && (
            <>
              <div className="pointer-events-none absolute left-[-12%] top-[42%] z-20 h-4 w-[124%] rotate-[18deg] rounded-full border border-amber-200/40 bg-[repeating-linear-gradient(90deg,#3f2d19_0_12px,#b88a47_12px_20px,#3f2d19_20px_32px)] shadow-[0_4px_10px_rgba(0,0,0,.8)]" />
              <div className="pointer-events-none absolute left-[-12%] top-[43%] z-20 h-4 w-[124%] -rotate-[18deg] rounded-full border border-amber-200/40 bg-[repeating-linear-gradient(90deg,#3f2d19_0_12px,#b88a47_12px_20px,#3f2d19_20px_32px)] shadow-[0_4px_10px_rgba(0,0,0,.8)]" />
              <div className="pointer-events-none absolute left-1/2 top-[44%] z-30 -translate-x-1/2 rounded-xl border-2 border-amber-200/50 bg-gradient-to-b from-amber-300 via-amber-600 to-amber-950 p-3 shadow-[0_0_28px_rgba(245,158,11,.45)]"><Lock className="h-7 w-7 text-amber-950" /></div>
            </>
          )}

          {unlocked && <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/15 py-2 text-xs font-black text-emerald-200"><CheckCircle2 className="h-4 w-4" />UNLOCKED FOR THIS GAMEWEEK</div>}
        </div>
      </div>
    </button>
  );
}

function PrizeSpotlight({ item }: { item: VaultItem }) {
  const theme = rarityTheme[item.rarity] || rarityTheme.common;
  const progress = pct(item);
  const remaining = Math.max(0, Number(item.targetEntries || 0) - Number(item.currentEntries || 0));
  return (
    <section className="relative border-t border-white/10 bg-black/25 px-4 py-6 sm:px-7">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 sm:p-7">
          <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 70% 40%, ${theme.glow}, transparent 35%)` }} />
          <div className="relative grid gap-6 md:grid-cols-[1fr_.9fr] md:items-center">
            <div>
              <Badge className="border border-white/10 bg-white/10 capitalize text-white">{item.rarity} prize</Badge>
              <h3 className="mt-4 text-3xl font-black sm:text-5xl">{item.title}</h3>
              <p className="mt-3 text-sm text-white/55">This is the prize currently selected from the {item.rarity} ladder. It unlocks only after the funding target is reached during the current gameweek.</p>
              <div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Value" value={money(item.value)} /><Mini label="Type" value={item.category || "Physical"} /><Mini label="Status" value={item.currentPrize ? "Current" : item.unlocked ? "Unlocked" : "Locked"} /></div>
            </div>
            <div className="flex min-h-[260px] items-center justify-center rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.16),transparent_55%)] text-[9rem] drop-shadow-[0_0_45px_rgba(255,255,255,.18)]">{prizeGlyph(item)}</div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-sm font-black"><Trophy className="h-5 w-5" style={{ color: theme.accent }} />Vault progress</div>
          <div className="mt-5 text-3xl font-black">{item.currentEntries} / {item.targetEntries} entries</div>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: theme.accent, boxShadow: `0 0 22px ${theme.glow}` }} /></div>
          <div className="mt-3 text-sm text-white/55">{remaining > 0 ? `Need ${remaining} more entries to unlock this prize.` : "Prize target reached for this gameweek."}</div>
          <div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Progress" value={`${progress}%`} /><Mini label="Entries" value={String(item.currentEntries)} /><Mini label="Target" value={String(item.targetEntries)} /></div>
          <Link href="/competitions"><Button className="mt-5 w-full rounded-xl bg-purple-500 font-black text-white hover:bg-purple-400"><Zap className="mr-2 h-4 w-4" />Enter tournament</Button></Link>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-white/45"><Flame className="mr-1 inline h-3.5 w-3.5 text-orange-300" />Next gameweek resets the progress, but keeps the same prize ladder.</div>
        </div>
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-1 truncate text-sm font-black text-white">{value}</div></div>;
}

function InfoPill({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="rounded-xl bg-purple-400/10 p-2 text-purple-200"><Icon className="h-5 w-5" /></div><div><div className="font-black">{title}</div><div className="mt-1 text-xs text-white/42">{text}</div></div></div>;
}

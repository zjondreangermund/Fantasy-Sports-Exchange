import { useMemo, useRef, useState } from "react";
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
const rarityTheme: Record<string, { accent: string; glow: string; gradient: string; metal: string; deep: string; ring: string }> = {
  common: { accent: "#e2e8f0", glow: "rgba(226,232,240,.38)", gradient: "from-slate-50 via-slate-400 to-slate-950", metal: "#94a3b8", deep: "#0f172a", ring: "border-slate-200/70" },
  rare: { accent: "#67e8f9", glow: "rgba(34,211,238,.48)", gradient: "from-cyan-50 via-cyan-400 to-slate-950", metal: "#22d3ee", deep: "#061523", ring: "border-cyan-200/80" },
  unique: { accent: "#d8b4fe", glow: "rgba(168,85,247,.55)", gradient: "from-fuchsia-100 via-purple-500 to-slate-950", metal: "#a855f7", deep: "#140721", ring: "border-purple-200/80" },
  epic: { accent: "#fda4af", glow: "rgba(244,63,94,.55)", gradient: "from-orange-100 via-rose-500 to-slate-950", metal: "#f43f5e", deep: "#21070c", ring: "border-rose-200/80" },
  legendary: { accent: "#fde68a", glow: "rgba(250,204,21,.6)", gradient: "from-yellow-50 via-amber-400 to-slate-950", metal: "#f59e0b", deep: "#1d1302", ring: "border-yellow-200/90" },
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`;
}

function pct(item: VaultItem) {
  const target = Number(item.targetEntries || item.requiredEntrants || 0);
  return target ? Math.max(0, Math.min(100, Math.round((Number(item.currentEntries || 0) / target) * 100))) : 0;
}

function prizeGlyph(item: VaultItem) {
  const label = `${item.title} ${item.category}`.toLowerCase();
  if (label.includes("airtime") || label.includes("phone")) return "📱";
  if (label.includes("headset")) return "🎧";
  if (label.includes("voucher")) return "🎟️";
  if (label.includes("playstation") || label.includes("xbox") || label.includes("console")) return "🎮";
  if (label.includes("pc") || label.includes("monitor")) return "🖥️";
  if (label.includes("macbook") || label.includes("laptop")) return "💻";
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
  const [selectedPrizeId, setSelectedPrizeId] = useState("");
  const railRef = useRef<HTMLDivElement>(null);
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
  const selectedPrize = useMemo(
    () => activeItems.find((item) => item.id === selectedPrizeId) || activeItems.find((item) => item.currentPrize) || activeItems.find((item) => item.active) || activeItems[0],
    [activeItems, selectedPrizeId],
  );
  const row = data?.summary?.[activeRarity];
  const totalEntries = rarityOrder.reduce((sum, rarity) => sum + Number(data?.summary?.[rarity]?.currentEntries || 0), 0);
  const unlockedCount = items.filter((item) => item.currentPrize || item.unlocked).length;
  const totalPrizeValue = items.reduce((sum, item) => sum + Number(item.currentPrize ? item.value : 0), 0);
  const scrollRail = (direction: number) => railRef.current?.scrollBy({ left: direction * Math.max(320, railRef.current.clientWidth * 0.75), behavior: "smooth" });

  return (
    <main className="premium-page min-h-full overflow-x-hidden px-2 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-2 text-white sm:px-5 lg:px-7">
      <div className="relative mx-auto max-w-[1560px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#02050d]/95 shadow-[0_40px_160px_rgba(0,0,0,.85)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_-5%,rgba(124,58,237,.34),transparent_28%),radial-gradient(circle_at_12%_24%,rgba(14,165,233,.18),transparent_30%),linear-gradient(180deg,rgba(255,255,255,.045),transparent_34%)]" />
        <VaultDoor />

        <header className="relative border-b border-white/10 px-4 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-purple-300/30 bg-purple-400/10 p-3 shadow-[0_0_35px_rgba(168,85,247,.3)]"><Gift className="h-6 w-6 text-purple-200" /></div>
                <div><div className="text-[10px] font-black uppercase tracking-[.3em] text-purple-200/65">2026/27 season</div><h1 className="bg-gradient-to-b from-white via-slate-100 to-slate-500 bg-clip-text text-4xl font-black tracking-[.05em] text-transparent sm:text-6xl">PRIZE VAULT</h1></div>
              </div>
              <p className="mt-3 max-w-2xl text-sm text-white/55">One rarity ladder per tournament. More entries unlock bigger rewards. Only the highest unlocked prize is awarded when the gameweek closes.</p>
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
                <button key={rarity} onClick={() => { setActiveRarity(rarity); setSelectedPrizeId(""); }} className={`min-w-[150px] rounded-2xl border px-4 py-3 text-left transition ${activeRarity === rarity ? `${theme.ring} bg-white/10` : "border-white/10 bg-black/25 hover:bg-white/[0.07]"}`} style={{ boxShadow: activeRarity === rarity ? `0 0 32px ${theme.glow}` : undefined }}>
                  <div className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: theme.accent }}>{rarity}</div>
                  <div className="mt-1 font-black">Entry {money(summary?.entryFee)}</div>
                  <div className="mt-1 text-[10px] text-white/40">{Number(summary?.marginMultiplier || 0).toFixed(1)}x funding</div>
                </button>
              );
            })}
          </div>
        </header>

        <section className="relative px-4 py-6 sm:px-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="text-xs font-black uppercase tracking-[.22em]" style={{ color: rarityTheme[activeRarity].accent }}>{activeRarity} prize ladder</div><h2 className="mt-1 text-2xl font-black sm:text-3xl">Locked in steel. Released by entries.</h2><p className="mt-1 text-xs text-white/45">Current gameweek entries: {row?.currentEntries || 0}. A higher unlock replaces every lower reward.</p></div>
            <Link href="/competitions"><Button className="rounded-xl bg-purple-500 font-black text-white hover:bg-purple-400"><Trophy className="mr-2 h-4 w-4" />Enter tournament</Button></Link>
          </div>

          <div className="relative rounded-[2rem] border border-white/10 bg-black/30 p-2 sm:p-4">
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,255,255,.035),transparent_24%),radial-gradient(circle_at_50%_110%,rgba(59,130,246,.16),transparent_40%)]" />
            <button onClick={() => scrollRail(-1)} className="absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/75 p-3 text-white/75 backdrop-blur hover:bg-white/10 md:block"><ArrowLeft className="h-5 w-5" /></button>
            <div ref={railRef} className="relative flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-6 pt-3 [scrollbar-color:rgba(255,255,255,.35)_transparent] md:px-12">
              {activeItems.map((item) => <MetalPrizeSlab key={item.id} item={item} selected={selectedPrize?.id === item.id} onClick={() => setSelectedPrizeId(item.id)} />)}
              {!activeItems.length && <Card className="w-full border-white/10 bg-white/[0.04] p-8 text-center text-white/45">{isLoading ? "Loading vault…" : "No prizes loaded for this ladder."}</Card>}
            </div>
            <button onClick={() => scrollRail(1)} className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/75 p-3 text-white/75 backdrop-blur hover:bg-white/10 md:block"><ArrowRight className="h-5 w-5" /></button>
          </div>
        </section>

        {selectedPrize && <PrizeSpotlight item={selectedPrize} />}

        <footer className="relative grid gap-3 border-t border-white/10 bg-black/30 px-4 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
          <InfoPill icon={Sparkles} title="Every gameweek" text="The same ladder returns with fresh progress." />
          <InfoPill icon={ShieldCheck} title="Funded before unlock" text="A reward opens only when its funding target is met." />
          <InfoPill icon={Gift} title="Real rewards" text="Physical prize or approved equivalent value." />
          <InfoPill icon={Flame} title="Highest prize wins" text="Lower rewards automatically fall away." />
        </footer>
      </div>
    </main>
  );
}

function VaultDoor() {
  return <div className="pointer-events-none absolute right-[-90px] top-[-70px] h-[430px] w-[430px] opacity-45"><div className="absolute inset-0 rounded-full border-[20px] border-purple-400/15 shadow-[0_0_130px_rgba(139,92,246,.45),inset_0_0_85px_rgba(139,92,246,.3)]" /><div className="absolute inset-[52px] rounded-full border-[6px] border-purple-200/15" /><div className="absolute inset-[98px] rounded-full border-[18px] border-purple-500/10" /><div className="absolute left-1/2 top-1/2 h-7 w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-300/10 shadow-[0_0_35px_rgba(192,132,252,.4)]" /><div className="absolute left-1/2 top-1/2 h-[250px] w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-300/10" /></div>;
}

function TopStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="min-w-[132px] rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" />{label}</div><div className="mt-2 truncate text-lg font-black text-white">{value}</div></div>;
}

function MetalPrizeSlab({ item, selected, onClick }: { item: VaultItem; selected: boolean; onClick: () => void }) {
  const progress = pct(item);
  const theme = rarityTheme[item.rarity] || rarityTheme.common;
  const unlocked = Boolean(item.currentPrize || item.unlocked);
  const passed = Boolean(item.replaced);
  const stateLabel = item.currentPrize ? "CURRENT WINNING PRIZE" : passed ? "PASSED" : unlocked ? "UNLOCKED" : item.active ? "NEXT UNLOCK" : "LOCKED";

  return (
    <button onClick={onClick} className={`group relative min-w-[270px] max-w-[270px] snap-center text-left transition duration-500 hover:-translate-y-3 ${selected ? "-translate-y-3 scale-[1.025]" : passed ? "opacity-55" : ""}`}>
      <div className={`relative h-[448px] overflow-hidden rounded-[2rem] bg-gradient-to-br ${theme.gradient} p-[3px]`} style={{ boxShadow: selected ? `0 0 70px ${theme.glow},0 35px 80px rgba(0,0,0,.8)` : `0 0 34px ${theme.glow},0 28px 60px rgba(0,0,0,.72)` }}>
        <div className="relative h-full overflow-hidden rounded-[1.82rem] border border-white/20 p-4" style={{ background: `linear-gradient(155deg,rgba(255,255,255,.08),transparent 24%),linear-gradient(180deg,${theme.deep},#02040a 72%)` }}>
          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(115deg,transparent_0%,rgba(255,255,255,.20)_16%,transparent_31%,transparent_68%,rgba(255,255,255,.08)_82%,transparent_100%)] transition-transform duration-700 group-hover:translate-x-8" />
          <div className="pointer-events-none absolute inset-2 rounded-[1.5rem] border border-white/10 shadow-[inset_0_0_28px_rgba(255,255,255,.04)]" />
          {["left-3 top-3","right-3 top-3","left-3 bottom-3","right-3 bottom-3"].map((pos) => <span key={pos} className={`pointer-events-none absolute ${pos} h-3 w-3 rounded-full border border-white/40 bg-black/80 shadow-[inset_0_0_4px_rgba(255,255,255,.5)]`} />)}

          <div className="relative z-10 flex items-center justify-between"><Badge className="border border-white/10 bg-black/55 text-[10px] font-black uppercase tracking-[.15em] text-white">#{item.tierIndex}</Badge><span className="text-[9px] font-black uppercase tracking-[.2em]" style={{ color: theme.accent }}>{item.rarity}</span></div>

          <div className="relative z-10 mt-5 flex h-[190px] items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 46%,${theme.glow},transparent 56%)` }} />
            <div className={`relative text-[7.2rem] transition duration-500 ${!unlocked ? "scale-90 grayscale opacity-35 blur-[1.4px]" : "drop-shadow-[0_0_26px_rgba(255,255,255,.5)]"}`}>{prizeGlyph(item)}</div>
            {!unlocked && <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.025),rgba(0,0,0,.48))]" />}
          </div>

          <div className="relative z-10 mt-4 text-center"><div className="line-clamp-2 min-h-[52px] text-xl font-black leading-tight text-white">{item.title}</div><div className="mt-1 text-xs text-white/45">Approx. value {money(item.value)}</div></div>

          <div className="relative z-10 mt-4"><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.13em] text-white/45"><span>Funding target</span><span>{item.targetEntries} entries</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: unlocked ? "#34d399" : theme.accent, boxShadow: `0 0 18px ${theme.glow}` }} /></div><div className="mt-2 flex items-center justify-between text-xs"><span className="font-black text-white">{item.currentEntries} / {item.targetEntries}</span><span className="font-black" style={{ color: unlocked ? "#6ee7b7" : theme.accent }}>{progress}%</span></div></div>

          <div className="absolute inset-x-4 bottom-4 z-20 rounded-xl border border-white/10 bg-black/55 py-2 text-center text-[10px] font-black tracking-[.12em]" style={{ color: unlocked ? "#6ee7b7" : theme.accent }}>{stateLabel}</div>

          {!unlocked && <ChainLock />}
          {unlocked && <div className="pointer-events-none absolute inset-0 z-10 rounded-[1.8rem] ring-1 ring-emerald-300/45 shadow-[inset_0_0_55px_rgba(16,185,129,.12)]" />}
        </div>
      </div>
      <div className="mx-auto mt-3 h-4 w-[80%] rounded-[100%] blur-md" style={{ background: theme.glow }} />
    </button>
  );
}

function ChainLock() {
  return <div className="pointer-events-none absolute inset-0 z-30">
    <svg viewBox="0 0 270 448" className="absolute inset-0 h-full w-full drop-shadow-[0_8px_8px_rgba(0,0,0,.85)]" aria-hidden="true">
      <defs><linearGradient id="chainMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f8e7a8"/><stop offset=".28" stopColor="#7c5721"/><stop offset=".55" stopColor="#e5b95d"/><stop offset="1" stopColor="#3c250d"/></linearGradient></defs>
      {Array.from({ length: 12 }).map((_, i) => <ellipse key={`a${i}`} cx={-15 + i * 28} cy={140 + i * 12} rx="18" ry="8" fill="none" stroke="url(#chainMetal)" strokeWidth="7" transform={`rotate(24 ${-15 + i * 28} ${140 + i * 12})`} />)}
      {Array.from({ length: 12 }).map((_, i) => <ellipse key={`b${i}`} cx={-15 + i * 28} cy={290 - i * 12} rx="18" ry="8" fill="none" stroke="url(#chainMetal)" strokeWidth="7" transform={`rotate(-24 ${-15 + i * 28} ${290 - i * 12})`} />)}
    </svg>
    <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-[1.2rem] border-2 border-amber-100/60 bg-gradient-to-b from-amber-200 via-amber-500 to-amber-950 p-4 shadow-[0_0_35px_rgba(245,158,11,.65),0_12px_25px_rgba(0,0,0,.7)]"><div className="absolute left-1/2 top-[-24px] h-9 w-11 -translate-x-1/2 rounded-t-full border-[7px] border-amber-300 border-b-0" /><Lock className="h-7 w-7 text-amber-950" /></div>
  </div>;
}

function PrizeSpotlight({ item }: { item: VaultItem }) {
  const theme = rarityTheme[item.rarity] || rarityTheme.common;
  const progress = pct(item);
  const remaining = Math.max(0, Number(item.targetEntries || 0) - Number(item.currentEntries || 0));
  return <section className="relative border-t border-white/10 bg-black/35 px-4 py-7 sm:px-7"><div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 sm:p-7"><div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 72% 42%,${theme.glow},transparent 34%)` }} /><div className="relative grid gap-6 md:grid-cols-[1fr_.9fr] md:items-center"><div><Badge className="border border-white/10 bg-white/10 capitalize text-white">{item.rarity} prize</Badge><h3 className="mt-4 text-3xl font-black sm:text-5xl">{item.title}</h3><p className="mt-3 text-sm text-white/55">This reward remains sealed until its live gameweek funding target is reached. Once a higher reward unlocks, this one falls away.</p><div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Value" value={money(item.value)} /><Mini label="Type" value={item.category || "Physical"} /><Mini label="Status" value={item.currentPrize ? "Current" : item.unlocked ? "Unlocked" : "Locked"} /></div></div><div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-black/30"><div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%,${theme.glow},transparent 58%)` }} /><div className="relative text-[10rem] drop-shadow-[0_0_50px_rgba(255,255,255,.22)]">{prizeGlyph(item)}</div></div></div></div>
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 sm:p-7"><div className="flex items-center gap-2 text-sm font-black"><Trophy className="h-5 w-5" style={{ color: theme.accent }} />Vault progress</div><div className="mt-5 text-3xl font-black">{item.currentEntries} / {item.targetEntries} entries</div><div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: theme.accent, boxShadow: `0 0 22px ${theme.glow}` }} /></div><div className="mt-3 text-sm text-white/55">{remaining > 0 ? `Need ${remaining} more entries to break the chains.` : "Funding target reached. Prize unlocked for this gameweek."}</div><div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Progress" value={`${progress}%`} /><Mini label="Entries" value={String(item.currentEntries)} /><Mini label="Target" value={String(item.targetEntries)} /></div><Link href="/competitions"><Button className="mt-5 w-full rounded-xl bg-purple-500 font-black text-white hover:bg-purple-400"><Zap className="mr-2 h-4 w-4" />Enter tournament</Button></Link><div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-white/45"><Flame className="mr-1 inline h-3.5 w-3.5 text-orange-300" />Next gameweek resets progress to zero while keeping the same ladder.</div></div>
  </div></section>;
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-1 truncate text-sm font-black text-white">{value}</div></div>; }
function InfoPill({ icon: Icon, title, text }: { icon: any; title: string; text: string }) { return <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="rounded-xl bg-purple-400/10 p-2 text-purple-200"><Icon className="h-5 w-5" /></div><div><div className="font-black">{title}</div><div className="mt-1 text-xs text-white/42">{text}</div></div></div>; }

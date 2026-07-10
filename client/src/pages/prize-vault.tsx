import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Flame, Gift, Lock, ShieldCheck, Sparkles, Trophy, Users, Zap } from "lucide-react";
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
  currentEntries: number;
  unlocked: boolean;
  active: boolean;
  currentPrize?: boolean;
  nextPrize?: boolean;
};

type VaultPayload = {
  season: string;
  items: VaultItem[];
  ladders?: Record<string, { items: VaultItem[] }>;
  summary: Record<string, { currentEntries: number; entryFee: number; marginMultiplier: number }>;
};

const rarityOrder = ["common", "rare", "unique", "epic", "legendary"];
const themes: Record<string, { accent: string; glow: string; edge: string; deep: string; top: string }> = {
  common: { accent: "#60a5fa", glow: "rgba(59,130,246,.55)", edge: "#93c5fd", deep: "#05101f", top: "COMMON" },
  rare: { accent: "#22d3ee", glow: "rgba(34,211,238,.6)", edge: "#a5f3fc", deep: "#03121c", top: "RARE" },
  unique: { accent: "#c084fc", glow: "rgba(168,85,247,.65)", edge: "#e9d5ff", deep: "#17051f", top: "UNIQUE" },
  epic: { accent: "#fb3b4a", glow: "rgba(251,59,74,.7)", edge: "#fecaca", deep: "#240507", top: "EPIC" },
  legendary: { accent: "#f59e0b", glow: "rgba(245,158,11,.7)", edge: "#fde68a", deep: "#211502", top: "LEGENDARY" },
};

const imageByType: Record<string, string> = {
  phone: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=90",
  headset: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=90",
  console: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=900&q=90",
  vehicle: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1000&q=90",
  laptop: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1000&q=90",
  pc: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1000&q=90",
  travel: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=90",
  home: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=90",
  watch: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=90",
  drone: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1000&q=90",
  boat: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=90",
  bike: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=90",
  voucher: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=90",
  gift: "https://images.unsplash.com/photo-1513883049090-d0b7439799bf?auto=format&fit=crop&w=900&q=90",
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`;
}

function percent(item: VaultItem) {
  const target = Number(item.targetEntries || item.requiredEntrants || 0);
  return target ? Math.max(0, Math.min(100, Math.round((Number(item.currentEntries || 0) / target) * 100))) : 0;
}

function imageType(item: VaultItem) {
  const text = `${item.title} ${item.category}`.toLowerCase();
  if (/hilux|ranger|amarok|fortuner|car|vehicle/.test(text)) return "vehicle";
  if (/house|home|apartment/.test(text)) return "home";
  if (/holiday|travel|trip|safari|maldives/.test(text)) return "travel";
  if (/boat/.test(text)) return "boat";
  if (/motorcycle|quad/.test(text)) return "bike";
  if (/macbook|laptop/.test(text)) return "laptop";
  if (/pc|monitor/.test(text)) return "pc";
  if (/playstation|xbox|console/.test(text)) return "console";
  if (/headset|speaker/.test(text)) return "headset";
  if (/phone|airtime/.test(text)) return "phone";
  if (/watch/.test(text)) return "watch";
  if (/drone/.test(text)) return "drone";
  if (/voucher/.test(text)) return "voucher";
  return "gift";
}

export default function PrizeVaultPage() {
  const [activeRarity, setActiveRarity] = useState("rare");
  const [selectedPrizeId, setSelectedPrizeId] = useState("");
  const railRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useQuery<VaultPayload>({
    queryKey: ["/api/prize-vault"],
    queryFn: async () => {
      const response = await fetch("/api/prize-vault", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load Prize Vault");
      return response.json();
    },
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  const activeItems = data?.ladders?.[activeRarity]?.items || items.filter((item) => item.rarity === activeRarity);
  const selected = useMemo(() => activeItems.find((item) => item.id === selectedPrizeId) || activeItems.find((item) => item.currentPrize) || activeItems.find((item) => item.active) || activeItems[0], [activeItems, selectedPrizeId]);
  const totalEntries = rarityOrder.reduce((sum, rarity) => sum + Number(data?.summary?.[rarity]?.currentEntries || 0), 0);
  const unlockedCount = items.filter((item) => item.currentPrize || item.unlocked).length;
  const summary = data?.summary?.[activeRarity];
  const scroll = (direction: number) => railRef.current?.scrollBy({ left: direction * 700, behavior: "smooth" });

  return (
    <main className="premium-page min-h-full overflow-x-hidden bg-[#02040c] px-0 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] text-white sm:px-4 sm:pt-3 lg:px-7">
      <div className="relative mx-auto max-w-[1580px] overflow-hidden border-y border-white/10 bg-[#030611] sm:rounded-[2rem] sm:border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(108,40,255,.32),transparent_32%),radial-gradient(circle_at_10%_40%,rgba(0,149,255,.19),transparent_25%),linear-gradient(180deg,#070b1d,#02040b)]" />
        <header className="relative border-b border-white/10 px-4 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div><div className="flex items-center gap-3"><div className="rounded-xl border border-purple-300/40 bg-purple-500/15 p-3 shadow-[0_0_30px_rgba(168,85,247,.35)]"><Gift className="h-6 w-6 text-purple-100" /></div><div><div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/70">2026/27 Season</div><h1 className="bg-gradient-to-r from-white via-cyan-300 to-fuchsia-400 bg-clip-text text-4xl font-black text-transparent sm:text-6xl">PRIZE VAULT</h1></div></div><p className="mt-3 max-w-2xl text-sm text-white/55">Same ladder every gameweek. Bigger prizes unlock as more managers join.</p></div>
            <div className="grid grid-cols-3 gap-2"><TopStat icon={Users} label="Entries" value={String(totalEntries)} /><TopStat icon={Gift} label="Unlocked" value={String(unlockedCount)} /><TopStat icon={Clock3} label="Season" value="26/27" /></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto">
            {rarityOrder.map((rarity) => {
              const theme = themes[rarity];
              const row = data?.summary?.[rarity];
              return <button key={rarity} onClick={() => { setActiveRarity(rarity); setSelectedPrizeId(""); }} className={`rounded-2xl border px-3 py-3 text-left transition sm:min-w-[150px] ${activeRarity === rarity ? "bg-white/10" : "border-white/10 bg-black/25"}`} style={{ borderColor: activeRarity === rarity ? theme.accent : undefined, boxShadow: activeRarity === rarity ? `0 0 28px ${theme.glow}` : undefined }}><div className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: theme.accent }}>{rarity}</div><div className="mt-1 text-sm font-black">Entry {money(row?.entryFee)}</div><div className="text-[10px] text-white/40">{Number(row?.marginMultiplier || 0).toFixed(1)}x funding</div></button>;
            })}
          </div>
        </header>

        <section className="relative px-3 py-5 sm:px-7 sm:py-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-black uppercase tracking-[.22em]" style={{ color: themes[activeRarity].accent }}>{activeRarity} prize ladder</div><h2 className="mt-1 text-2xl font-black sm:text-3xl">One chain of prizes. One winner prize.</h2><p className="mt-1 text-xs text-white/45">Current gameweek entries: {summary?.currentEntries || 0}. A higher unlock replaces the lower reward.</p></div><Link href="/competitions"><Button className="w-full rounded-xl bg-purple-500 font-black sm:w-auto"><Trophy className="mr-2 h-4 w-4" />Enter tournament</Button></Link></div>

          <div className="relative rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_50%_100%,rgba(83,29,255,.22),transparent_50%),rgba(0,0,0,.3)] p-3 sm:p-5">
            <button onClick={() => scroll(-1)} className="absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 xl:block"><ArrowLeft className="h-5 w-5" /></button>
            <div ref={railRef} className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:flex xl:snap-x xl:overflow-x-auto xl:px-12 xl:pb-10 xl:pt-8">
              {activeItems.map((item, index) => <PrizeSlab key={item.id} item={item} selected={selected?.id === item.id} index={index} onClick={() => setSelectedPrizeId(item.id)} />)}
              {!activeItems.length && <Card className="border-white/10 bg-white/[0.04] p-8 text-center text-white/45 sm:col-span-2">{isLoading ? "Loading vault…" : "No prizes loaded for this ladder."}</Card>}
            </div>
            <button onClick={() => scroll(1)} className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 xl:block"><ArrowRight className="h-5 w-5" /></button>
          </div>
        </section>

        {selected && <PrizeSpotlight item={selected} />}
        <footer className="relative grid gap-3 border-t border-white/10 bg-black/30 px-4 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4"><Info icon={Sparkles} title="Every Gameweek" text="The same ladder returns with fresh progress." /><Info icon={ShieldCheck} title="Fair & Transparent" text="Prizes unlock only when funding is met." /><Info icon={Gift} title="Real Prizes" text="Physical prize or approved equivalent value." /><Info icon={Flame} title="Highest Prize Wins" text="Lower unlocked prizes fall away." /></footer>
      </div>
    </main>
  );
}

function PrizeSlab({ item, selected, index, onClick }: { item: VaultItem; selected: boolean; index: number; onClick: () => void }) {
  const theme = themes[item.rarity] || themes.common;
  const pct = percent(item);
  const unlocked = Boolean(item.currentPrize || item.unlocked);
  const tilt = index % 2 === 0 ? "rotateY(7deg) rotateZ(-1deg)" : "rotateY(-7deg) rotateZ(1deg)";
  return (
    <button onClick={onClick} className="group relative mx-auto w-full max-w-[360px] text-left xl:min-w-[300px] xl:max-w-[300px] xl:snap-start [perspective:1200px]">
      <div className="relative transition duration-300 xl:group-hover:-translate-y-3" style={{ transform: selected ? "translateY(-10px) rotateY(0deg)" : undefined }}>
        <div className="pointer-events-none absolute bottom-[-18px] left-[10%] right-[-18px] top-[16px] hidden rounded-[2rem] opacity-90 xl:block" style={{ background: `linear-gradient(90deg,${theme.deep},#000)`, boxShadow: `18px 18px 35px rgba(0,0,0,.65)` }} />
        <div className="relative overflow-hidden rounded-[2rem] border-[3px] p-[4px] xl:[transform-style:preserve-3d]" style={{ borderColor: theme.edge, background: `linear-gradient(145deg,white 0%,${theme.accent} 22%,${theme.deep} 68%,#000 100%)`, boxShadow: `0 0 ${selected ? 60 : 35}px ${theme.glow},0 28px 55px rgba(0,0,0,.7)`, transform: `var(--slab-transform, none)` } as React.CSSProperties}>
          <style>{`@media (min-width:1280px){button:hover .vault-slab-inner{transform:rotateY(0deg) rotateZ(0deg)!important}}`}</style>
          <div className="vault-slab-inner relative min-h-[500px] overflow-hidden rounded-[1.72rem] border border-white/25 bg-black transition duration-500 xl:[transform-style:preserve-3d]" style={{ background: `linear-gradient(180deg,rgba(255,255,255,.08),transparent 20%),${theme.deep}`, transform: tilt }}>
            <div className="absolute inset-x-4 top-3 z-20 rounded-t-2xl border border-white/15 bg-black/45 py-2 text-center text-xs font-black tracking-[.16em]" style={{ color: theme.accent }}>{theme.top}</div>
            <div className="relative mx-3 mt-12 h-[285px] overflow-hidden rounded-[1.25rem] border border-white/10 bg-black"><img src={imageByType[imageType(item)]} alt={item.title} className={`h-full w-full object-cover transition duration-700 group-hover:scale-105 ${unlocked ? "" : "brightness-[.52] saturate-[.55]"}`} loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-white/10" /></div>
            <div className="relative z-20 px-4 pb-4 pt-3 text-center"><div className="line-clamp-2 min-h-[55px] text-xl font-black leading-tight">{item.title}</div><div className="text-xs text-white/50">Approx. value {money(item.value)}</div><div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: unlocked ? "#22c55e" : theme.accent, boxShadow: `0 0 18px ${theme.glow}` }} /></div><div className="mt-2 flex justify-between text-sm font-black"><span>{item.currentEntries} / {item.targetEntries}</span><span style={{ color: unlocked ? "#86efac" : theme.accent }}>{unlocked ? "UNLOCKED" : `${pct}%`}</span></div></div>
            {!unlocked && <ChainOverlay accent={theme.accent} />}
            {unlocked && <div className="absolute inset-x-5 bottom-5 z-30 flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/20 py-2 text-xs font-black text-emerald-100"><CheckCircle2 className="h-4 w-4" />UNLOCKED</div>}
          </div>
        </div>
      </div>
    </button>
  );
}

function ChainOverlay({ accent }: { accent: string }) {
  return <div className="pointer-events-none absolute inset-0 z-30"><div className="absolute left-[-12%] top-[47%] h-5 w-[125%] -rotate-[15deg] rounded-full bg-[repeating-linear-gradient(90deg,#d6b26b_0_10px,#513714_10px_16px,#f6d58a_16px_24px)] shadow-[0_2px_8px_rgba(0,0,0,.8)]"/><div className="absolute left-[-12%] top-[47%] h-5 w-[125%] rotate-[15deg] rounded-full bg-[repeating-linear-gradient(90deg,#d6b26b_0_10px,#513714_10px_16px,#f6d58a_16px_24px)] shadow-[0_2px_8px_rgba(0,0,0,.8)]"/><div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-amber-100/70 bg-gradient-to-b from-amber-200 via-amber-500 to-amber-950 p-4 shadow-[0_0_35px_rgba(245,158,11,.7)]"><Lock className="h-8 w-8 text-amber-950" /></div><div className="absolute inset-x-7 top-[61%] rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-center text-[9px] font-black uppercase tracking-[.15em]" style={{ color: accent }}>Locked until target reached</div></div>;
}

function PrizeSpotlight({ item }: { item: VaultItem }) {
  const theme = themes[item.rarity] || themes.common;
  const pct = percent(item);
  const remaining = Math.max(0, item.targetEntries - item.currentEntries);
  return <section className="relative border-t border-white/10 bg-black/25 px-3 py-6 sm:px-7"><div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]"><div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-7"><div className="grid gap-5 md:grid-cols-[.9fr_1.1fr] md:items-center"><div><Badge className="capitalize">{item.rarity} prize</Badge><h3 className="mt-4 text-3xl font-black sm:text-5xl">{item.title}</h3><p className="mt-3 text-sm text-white/55">The current gameweek funds this prize. When a higher target is reached, that bigger prize replaces it.</p><div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Value" value={money(item.value)} /><Mini label="Type" value={item.category || "Physical"} /><Mini label="Status" value={item.currentPrize ? "Current" : item.unlocked ? "Unlocked" : "Locked"} /></div></div><div className="relative min-h-[300px] overflow-hidden rounded-[1.6rem] border border-white/10"><img src={imageByType[imageType(item)]} alt={item.title} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/55" /></div></div></div><div className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-7"><div className="flex items-center gap-2 text-sm font-black"><Trophy className="h-5 w-5" style={{ color: theme.accent }} />Vault Progress</div><div className="mt-5 text-3xl font-black">{item.currentEntries} / {item.targetEntries} Entries</div><div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.accent, boxShadow: `0 0 22px ${theme.glow}` }} /></div><div className="mt-3 text-sm text-white/55">{remaining ? `Need ${remaining} more entries to unlock this prize.` : "Funding target reached."}</div><Link href="/competitions"><Button className="mt-5 w-full rounded-xl bg-purple-500 font-black"><Zap className="mr-2 h-4 w-4" />Enter Tournament</Button></Link></div></div></section>;
}

function TopStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/35 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" />{label}</div><div className="mt-2 truncate text-lg font-black">{value}</div></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-1 truncate text-sm font-black">{value}</div></div>; }
function Info({ icon: Icon, title, text }: { icon: any; title: string; text: string }) { return <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="rounded-xl bg-purple-400/10 p-2 text-purple-200"><Icon className="h-5 w-5" /></div><div><div className="font-black">{title}</div><div className="mt-1 text-xs text-white/42">{text}</div></div></div>; }

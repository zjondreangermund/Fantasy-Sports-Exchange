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
  ladders?: Record<string, { items: VaultItem[] }>;
  summary: Record<string, { currentEntries: number; entryFee: number; marginMultiplier: number; activePrize?: any; nextPrize?: any }>;
};

const rarityOrder = ["common", "rare", "unique", "epic", "legendary"];
const themes: Record<string, { accent: string; glow: string; frame: string; dark: string; label: string }> = {
  common: { accent: "#e2e8f0", glow: "rgba(226,232,240,.34)", frame: "from-white via-slate-400 to-slate-950", dark: "#0b1220", label: "Steel" },
  rare: { accent: "#67e8f9", glow: "rgba(34,211,238,.48)", frame: "from-cyan-50 via-cyan-400 to-slate-950", dark: "#061521", label: "Chrome" },
  unique: { accent: "#d8b4fe", glow: "rgba(168,85,247,.58)", frame: "from-fuchsia-100 via-purple-500 to-slate-950", dark: "#170721", label: "Purple Titanium" },
  epic: { accent: "#fda4af", glow: "rgba(244,63,94,.56)", frame: "from-orange-100 via-rose-500 to-slate-950", dark: "#21070d", label: "Crimson Alloy" },
  legendary: { accent: "#fde68a", glow: "rgba(250,204,21,.62)", frame: "from-yellow-50 via-amber-400 to-slate-950", dark: "#1d1302", label: "Black Gold" },
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`;
}

function progress(item: VaultItem) {
  const target = Number(item.targetEntries || item.requiredEntrants || 0);
  return target ? Math.max(0, Math.min(100, Math.round((Number(item.currentEntries || 0) / target) * 100))) : 0;
}

function artType(item: VaultItem) {
  const text = `${item.title} ${item.category}`.toLowerCase();
  if (text.includes("hilux") || text.includes("ranger") || text.includes("amarok") || text.includes("fortuner") || text.includes("car")) return "vehicle";
  if (text.includes("house") || text.includes("home") || text.includes("apartment")) return "home";
  if (text.includes("holiday") || text.includes("travel") || text.includes("trip") || text.includes("safari")) return "travel";
  if (text.includes("boat")) return "boat";
  if (text.includes("motorcycle") || text.includes("quad")) return "bike";
  if (text.includes("pc") || text.includes("monitor")) return "pc";
  if (text.includes("macbook") || text.includes("laptop")) return "laptop";
  if (text.includes("playstation") || text.includes("xbox") || text.includes("console")) return "console";
  if (text.includes("headset")) return "headset";
  if (text.includes("phone") || text.includes("airtime")) return "phone";
  if (text.includes("watch")) return "watch";
  if (text.includes("drone")) return "drone";
  if (text.includes("voucher")) return "voucher";
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
  const unlocked = items.filter((item) => item.currentPrize || item.unlocked).length;
  const liveValue = items.reduce((sum, item) => sum + (item.currentPrize ? Number(item.value || 0) : 0), 0);
  const summary = data?.summary?.[activeRarity];
  const scroll = (direction: number) => railRef.current?.scrollBy({ left: direction * 760, behavior: "smooth" });

  return (
    <main className="premium-page min-h-full overflow-x-hidden px-0 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-0 text-white sm:px-4 sm:pt-3 lg:px-7">
      <div className="relative mx-auto max-w-[1560px] overflow-hidden border-y border-white/10 bg-[#02050d]/95 shadow-[0_40px_160px_rgba(0,0,0,.85)] sm:rounded-[2rem] sm:border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_-8%,rgba(124,58,237,.38),transparent_27%),radial-gradient(circle_at_8%_22%,rgba(14,165,233,.20),transparent_28%),linear-gradient(180deg,rgba(255,255,255,.045),transparent_35%)]" />
        <VaultDoor />
        <header className="relative border-b border-white/10 px-4 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3"><div className="rounded-2xl border border-purple-300/30 bg-purple-400/10 p-3"><Gift className="h-6 w-6 text-purple-200" /></div><div><div className="text-[10px] font-black uppercase tracking-[.3em] text-purple-200/65">2026/27 season</div><h1 className="bg-gradient-to-b from-white via-slate-100 to-slate-500 bg-clip-text text-4xl font-black tracking-[.05em] text-transparent sm:text-6xl">PRIZE VAULT</h1></div></div>
              <p className="mt-3 text-sm text-white/58">Every rarity tournament has its own prize ladder. More entries release bigger rewards. Only the highest unlocked reward is awarded when the gameweek closes.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><TopStat icon={Users} label="Entries" value={String(totalEntries)} /><TopStat icon={Trophy} label="Unlocked" value={String(unlocked)} /><TopStat icon={Gift} label="Live value" value={money(liveValue)} /><TopStat icon={Clock3} label="Season" value="26/27" /></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto">
            {rarityOrder.map((rarity) => {
              const theme = themes[rarity];
              const row = data?.summary?.[rarity];
              return <button key={rarity} onClick={() => { setActiveRarity(rarity); setSelectedPrizeId(""); }} className={`min-w-0 rounded-2xl border px-3 py-3 text-left transition sm:min-w-[150px] ${activeRarity === rarity ? "bg-white/10" : "border-white/10 bg-black/25"}`} style={{ borderColor: activeRarity === rarity ? theme.accent : undefined, boxShadow: activeRarity === rarity ? `0 0 28px ${theme.glow}` : undefined }}><div className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: theme.accent }}>{rarity}</div><div className="mt-1 text-sm font-black">Entry {money(row?.entryFee)}</div><div className="mt-1 text-[10px] text-white/42">{Number(row?.marginMultiplier || 0).toFixed(1)}x funding</div></button>;
            })}
          </div>
        </header>
        <section className="relative px-3 py-5 sm:px-7 sm:py-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-black uppercase tracking-[.22em]" style={{ color: themes[activeRarity].accent }}>{activeRarity} vault</div><h2 className="mt-1 text-2xl font-black sm:text-3xl">Locked in metal. Released by entries.</h2><p className="mt-1 text-xs text-white/48">Current gameweek entries: {summary?.currentEntries || 0}. A higher unlock replaces every lower reward.</p></div><Link href="/competitions"><Button className="w-full rounded-xl bg-purple-500 font-black text-white sm:w-auto"><Trophy className="mr-2 h-4 w-4" />Enter tournament</Button></Link></div>
          <div className="relative rounded-[1.5rem] border border-white/10 bg-black/30 p-2 sm:rounded-[2rem] sm:p-4">
            <button onClick={() => scroll(-1)} className="absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 xl:block"><ArrowLeft className="h-5 w-5" /></button>
            <div ref={railRef} className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 xl:flex xl:snap-x xl:overflow-x-auto xl:px-12 xl:pb-5 xl:pt-3">
              {activeItems.map((item) => <MetalPrizeSlab key={item.id} item={item} selected={selected?.id === item.id} onClick={() => setSelectedPrizeId(item.id)} />)}
              {!activeItems.length && <Card className="border-white/10 bg-white/[0.04] p-8 text-center text-white/45 sm:col-span-2">{isLoading ? "Loading vault…" : "No prizes loaded for this ladder."}</Card>}
            </div>
            <button onClick={() => scroll(1)} className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 xl:block"><ArrowRight className="h-5 w-5" /></button>
          </div>
        </section>
        {selected && <PrizeSpotlight item={selected} />}
        <footer className="relative grid gap-3 border-t border-white/10 bg-black/30 px-4 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4"><Info icon={Sparkles} title="Every gameweek" text="Fresh progress on the same ladder." /><Info icon={ShieldCheck} title="Funded before unlock" text="A reward opens only after its target is met." /><Info icon={Gift} title="Real rewards" text="Physical prize or approved equivalent value." /><Info icon={Flame} title="Highest prize wins" text="Lower unlocked rewards fall away." /></footer>
      </div>
    </main>
  );
}

function MetalPrizeSlab({ item, selected, onClick }: { item: VaultItem; selected: boolean; onClick: () => void }) {
  const theme = themes[item.rarity] || themes.common;
  const value = progress(item);
  const isUnlocked = Boolean(item.currentPrize || item.unlocked);
  return <button onClick={onClick} className={`group relative mx-auto w-full max-w-[360px] text-left transition duration-300 xl:min-w-[300px] xl:max-w-[300px] xl:snap-start ${selected ? "-translate-y-1" : ""}`}><div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${theme.frame} p-[3px]`} style={{ boxShadow: `0 0 ${selected ? 58 : 30}px ${theme.glow},0 28px 65px rgba(0,0,0,.72)` }}><div className="relative min-h-[470px] overflow-hidden rounded-[1.82rem] border border-white/20 p-4" style={{ background: `linear-gradient(160deg,rgba(255,255,255,.08),transparent 28%),${theme.dark}` }}><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,transparent_0%,rgba(255,255,255,.20)_16%,transparent_31%,transparent_70%,rgba(255,255,255,.08)_82%,transparent_100%)] opacity-70 transition-transform duration-700 group-hover:translate-x-8" /><Bolts accent={theme.accent} /><div className="relative z-10 flex items-center justify-between"><Badge className="border border-white/15 bg-black/55 text-white">#{item.tierIndex}</Badge><span className="text-[9px] font-black uppercase tracking-[.18em]" style={{ color: theme.accent }}>{theme.label}</span></div><div className={`relative z-10 mt-4 h-[220px] overflow-hidden rounded-[1.4rem] border border-white/10 ${!isUnlocked ? "brightness-[.48] saturate-[.35]" : ""}`}><PrizeArtwork item={item} accent={theme.accent} glow={theme.glow} /></div><div className="relative z-10 mt-4 text-center"><div className="line-clamp-2 min-h-[54px] text-xl font-black leading-tight">{item.title}</div><div className="mt-1 text-xs text-white/50">Approx. value {money(item.value)}</div></div><div className="relative z-10 mt-4"><div className="flex justify-between text-[10px] font-black uppercase tracking-[.12em] text-white/45"><span>Funding target</span><span>{item.targetEntries} entries</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${value}%`, background: isUnlocked ? "#34d399" : theme.accent, boxShadow: `0 0 18px ${theme.glow}` }} /></div><div className="mt-2 flex justify-between text-xs"><b>{item.currentEntries}/{item.targetEntries}</b><span style={{ color: isUnlocked ? "#6ee7b7" : theme.accent }}>{isUnlocked ? "UNLOCKED" : `${value}%`}</span></div></div>{!isUnlocked && <ChainLock accent={theme.accent} />}{isUnlocked && <div className="absolute inset-x-5 bottom-5 z-30 flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/15 py-2 text-xs font-black text-emerald-200"><CheckCircle2 className="h-4 w-4" />UNLOCKED THIS GAMEWEEK</div>}</div></div></button>;
}

function PrizeArtwork({ item, accent, glow }: { item: VaultItem; accent: string; glow: string }) {
  const type = artType(item);
  const art: Record<string, React.ReactNode> = {
    vehicle: <><path d="M34 125h212l-20-48c-7-16-20-25-38-25H91c-17 0-31 9-39 25l-18 48Z" fill="url(#paint)"/><rect x="18" y="118" width="244" height="58" rx="22" fill="#111827" stroke="currentColor" strokeWidth="5"/><circle cx="72" cy="178" r="24" fill="#020617" stroke="currentColor" strokeWidth="6"/><circle cx="208" cy="178" r="24" fill="#020617" stroke="currentColor" strokeWidth="6"/><path d="M82 69h101l22 51H61l21-51Z" fill="#9bd7ff" opacity=".65"/></>,
    home: <><path d="M28 104 140 24l112 80v94H28v-94Z" fill="url(#paint)" stroke="currentColor" strokeWidth="5"/><rect x="108" y="120" width="64" height="78" rx="5" fill="#07101f"/><rect x="48" y="119" width="42" height="39" rx="5" fill="#9bd7ff"/><rect x="190" y="119" width="42" height="39" rx="5" fill="#9bd7ff"/></>,
    travel: <><circle cx="140" cy="108" r="74" fill="url(#paint)" opacity=".55"/><path d="m35 155 102-48 31-65 18 7-14 68 69 38-8 16-82-22-58 32-12-8 36-39-82 31Z" fill="currentColor"/><path d="M34 188h212" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/></>,
    pc: <><rect x="42" y="36" width="150" height="112" rx="12" fill="#070b13" stroke="currentColor" strokeWidth="6"/><rect x="55" y="49" width="124" height="82" rx="7" fill="url(#screen)"/><rect x="205" y="48" width="48" height="126" rx="10" fill="#0b1220" stroke="currentColor" strokeWidth="5"/><circle cx="229" cy="85" r="15" fill="none" stroke="currentColor" strokeWidth="5"/><circle cx="229" cy="132" r="15" fill="none" stroke="currentColor" strokeWidth="5"/><path d="M116 149v26m-38 5h77" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/></>,
    laptop: <><rect x="50" y="34" width="180" height="122" rx="12" fill="#080d18" stroke="currentColor" strokeWidth="6"/><rect x="62" y="46" width="156" height="96" rx="6" fill="url(#screen)"/><path d="M29 162h222l-18 32H47l-18-32Z" fill="url(#paint)" stroke="currentColor" strokeWidth="5"/></>,
    console: <><path d="M94 38h92l20 154H74L94 38Z" fill="url(#paint)" stroke="currentColor" strokeWidth="6"/><path d="M113 68h54m-47 27h40" stroke="#07101f" strokeWidth="8" strokeLinecap="round"/><path d="M26 149c0-32 23-50 51-40l26 10h74l26-10c28-10 51 8 51 40 0 28-21 48-46 35l-31-17H103l-31 17c-25 13-46-7-46-35Z" fill="#111827" stroke="currentColor" strokeWidth="5"/><circle cx="76" cy="145" r="10" fill="currentColor"/><path d="M195 134h24m-12-12v24" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/></>,
    headset: <><path d="M57 128V95c0-47 36-76 83-76s83 29 83 76v33" fill="none" stroke="currentColor" strokeWidth="18" strokeLinecap="round"/><rect x="38" y="108" width="54" height="82" rx="22" fill="url(#paint)" stroke="currentColor" strokeWidth="5"/><rect x="188" y="108" width="54" height="82" rx="22" fill="url(#paint)" stroke="currentColor" strokeWidth="5"/><path d="M216 184c0 24-17 34-45 34" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/></>,
    phone: <><rect x="88" y="24" width="104" height="188" rx="24" fill="#07101f" stroke="currentColor" strokeWidth="7"/><rect x="99" y="48" width="82" height="132" rx="12" fill="url(#screen)"/><circle cx="140" cy="196" r="7" fill="currentColor"/><rect x="123" y="34" width="34" height="5" rx="3" fill="currentColor"/></>,
    watch: <><path d="M111 20h58l12 50-12 150h-58L99 70l12-50Z" fill="url(#paint)" opacity=".75"/><rect x="79" y="62" width="122" height="122" rx="34" fill="#08101e" stroke="currentColor" strokeWidth="7"/><circle cx="140" cy="123" r="43" fill="url(#screen)"/><path d="M140 92v35l23 17" stroke="white" strokeWidth="7" strokeLinecap="round"/></>,
    drone: <><rect x="104" y="88" width="72" height="48" rx="14" fill="url(#paint)" stroke="currentColor" strokeWidth="5"/><path d="M105 96 55 64m120 32 50-32m-120 64-50 32m120-32 50 32" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/><ellipse cx="49" cy="58" rx="42" ry="10" fill="none" stroke="currentColor" strokeWidth="5"/><ellipse cx="231" cy="58" rx="42" ry="10" fill="none" stroke="currentColor" strokeWidth="5"/><ellipse cx="49" cy="166" rx="42" ry="10" fill="none" stroke="currentColor" strokeWidth="5"/><ellipse cx="231" cy="166" rx="42" ry="10" fill="none" stroke="currentColor" strokeWidth="5"/><circle cx="140" cy="137" r="15" fill="#07101f" stroke="currentColor" strokeWidth="5"/></>,
    voucher: <><path d="M33 58h214v42c-21 0-21 34 0 34v43H33v-43c21 0 21-34 0-34V58Z" fill="url(#paint)" stroke="currentColor" strokeWidth="6"/><path d="M107 58v119" stroke="#07101f" strokeWidth="5" strokeDasharray="9 9"/><circle cx="168" cy="103" r="26" fill="none" stroke="#07101f" strokeWidth="7"/><path d="m151 145 38-78" stroke="#07101f" strokeWidth="7"/></>,
    boat: <><path d="M30 139h220l-36 49H70l-40-49Z" fill="url(#paint)" stroke="currentColor" strokeWidth="6"/><path d="M96 139V57h66l34 82" fill="#0b1220" stroke="currentColor" strokeWidth="6"/><path d="M110 73h39v38h-39z" fill="#9bd7ff"/><path d="M35 204c30-19 49 17 79-2 29-18 49 17 78-1 29-18 48 15 71 2" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/></>,
    bike: <><circle cx="71" cy="169" r="38" fill="none" stroke="currentColor" strokeWidth="8"/><circle cx="211" cy="169" r="38" fill="none" stroke="currentColor" strokeWidth="8"/><path d="m71 169 50-70h54l36 70m-90-70 30 70H71l50-70Zm54 0 31-38" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/><path d="M190 60h33" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/></>,
    gift: <><rect x="44" y="92" width="192" height="118" rx="14" fill="url(#paint)" stroke="currentColor" strokeWidth="6"/><path d="M28 70h224v48H28z" fill="url(#paint)" stroke="currentColor" strokeWidth="6"/><path d="M126 70v140h28V70" fill="#07101f" opacity=".8"/><path d="M140 70c-32-45-80-54-75-15 4 30 48 24 75 15Zm0 0c32-45 80-54 75-15-4 30-48 24-75 15Z" fill="none" stroke="currentColor" strokeWidth="7"/></>,
  };
  return <div className="absolute inset-0 flex items-center justify-center"><div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%,${glow},transparent 56%)` }} /><svg viewBox="0 0 280 230" className="relative h-[88%] w-[88%] drop-shadow-[0_18px_20px_rgba(0,0,0,.65)]" style={{ color: accent }}><defs><linearGradient id="paint" x1="0" y1="0" x2="1" y2="1"><stop stopColor="white" stopOpacity=".95"/><stop offset=".42" stopColor={accent}/><stop offset="1" stopColor="#111827"/></linearGradient><linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#22d3ee"/><stop offset=".5" stopColor="#7c3aed"/><stop offset="1" stopColor="#020617"/></linearGradient></defs>{art[type] || art.gift}</svg></div>;
}

function ChainLock({ accent }: { accent: string }) { return <div className="pointer-events-none absolute inset-0 z-20"><svg viewBox="0 0 360 470" className="h-full w-full"><defs><pattern id="chain" width="22" height="14" patternUnits="userSpaceOnUse"><ellipse cx="11" cy="7" rx="8" ry="4" fill="none" stroke="#d7b16a" strokeWidth="3"/><ellipse cx="11" cy="7" rx="4" ry="2" fill="none" stroke="#3a2815" strokeWidth="2"/></pattern></defs><path d="M-35 150 395 315" stroke="url(#chain)" strokeWidth="22"/><path d="M395 150-35 315" stroke="url(#chain)" strokeWidth="22"/></svg><div className="absolute left-1/2 top-[49%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-amber-100/70 bg-gradient-to-b from-amber-200 via-amber-500 to-amber-950 p-4 shadow-[0_0_36px_rgba(245,158,11,.65)]"><Lock className="h-8 w-8 text-amber-950" /></div><div className="absolute inset-x-8 top-[64%] rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[.18em]" style={{ color: accent }}>Locked until target reached</div></div>; }

function PrizeSpotlight({ item }: { item: VaultItem }) {
  const theme = themes[item.rarity] || themes.common;
  const value = progress(item);
  const remaining = Math.max(0, Number(item.targetEntries || 0) - Number(item.currentEntries || 0));
  return <section className="relative border-t border-white/10 bg-black/25 px-3 py-6 sm:px-7"><div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:rounded-[2rem] sm:p-7"><div className="relative grid gap-5 md:grid-cols-[1fr_.9fr] md:items-center"><div><Badge className="capitalize">{item.rarity} prize</Badge><h3 className="mt-4 text-3xl font-black sm:text-5xl">{item.title}</h3><p className="mt-3 text-sm text-white/55">This prize opens only after its funding target is reached in the current gameweek. If a bigger prize unlocks, this prize falls away.</p><div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Value" value={money(item.value)} /><Mini label="Type" value={item.category || "Physical"} /><Mini label="Status" value={item.currentPrize ? "Current" : item.unlocked ? "Unlocked" : "Locked"} /></div></div><div className="relative min-h-[260px] overflow-hidden rounded-[1.6rem] border border-white/10"><PrizeArtwork item={item} accent={theme.accent} glow={theme.glow} /></div></div></div><div className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:rounded-[2rem] sm:p-7"><div className="flex items-center gap-2 text-sm font-black"><Trophy className="h-5 w-5" style={{ color: theme.accent }} />Vault progress</div><div className="mt-5 text-3xl font-black">{item.currentEntries} / {item.targetEntries} entries</div><div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${value}%`, background: theme.accent, boxShadow: `0 0 22px ${theme.glow}` }} /></div><div className="mt-3 text-sm text-white/55">{remaining ? `Need ${remaining} more entries to unlock this reward.` : "Funding target reached."}</div><div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Progress" value={`${value}%`} /><Mini label="Entries" value={String(item.currentEntries)} /><Mini label="Target" value={String(item.targetEntries)} /></div><Link href="/competitions"><Button className="mt-5 w-full rounded-xl bg-purple-500 font-black"><Zap className="mr-2 h-4 w-4" />Enter tournament</Button></Link><div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-white/45"><Flame className="mr-1 inline h-3.5 w-3.5 text-orange-300" />Next gameweek resets progress but keeps the same ladder.</div></div></div></section>;
}

function VaultDoor() { return <div className="pointer-events-none absolute right-[-120px] top-[-90px] h-[430px] w-[430px] opacity-45"><div className="absolute inset-0 rounded-full border-[22px] border-purple-400/15 shadow-[0_0_130px_rgba(139,92,246,.45),inset_0_0_85px_rgba(139,92,246,.3)]"/><div className="absolute inset-[60px] rounded-full border-[7px] border-purple-200/15"/><div className="absolute inset-[115px] rounded-full border-[20px] border-purple-500/10"/><div className="absolute left-1/2 top-1/2 h-7 w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-300/10"/><div className="absolute left-1/2 top-1/2 h-[260px] w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-300/10"/></div>; }
function Bolts({ accent }: { accent: string }) { return <>{["left-3 top-3","right-3 top-3","bottom-3 left-3","bottom-3 right-3"].map((position) => <span key={position} className={`absolute ${position} z-10 h-3 w-3 rounded-full border border-black/70 bg-gradient-to-br from-white to-slate-700 shadow-inner`} style={{ boxShadow: `0 0 8px ${accent}` }} />)}</>; }
function TopStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/35 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" />{label}</div><div className="mt-2 truncate text-lg font-black">{value}</div></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-1 truncate text-sm font-black">{value}</div></div>; }
function Info({ icon: Icon, title, text }: { icon: any; title: string; text: string }) { return <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="rounded-xl bg-purple-400/10 p-2 text-purple-200"><Icon className="h-5 w-5" /></div><div><div className="font-black">{title}</div><div className="mt-1 text-xs text-white/42">{text}</div></div></div>; }

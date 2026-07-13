import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Flame, Gift, Lock, ShieldCheck, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { PremiumPrizeArtwork } from "../components/prize-vault/PremiumPrizeArtwork";

type VaultItem = {
  id: string;
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
};

type VaultSummary = {
  currentEntries: number;
  entryFee: number;
  marginMultiplier: number;
  unlocked?: number;
  total?: number;
  targetEntries?: number;
};

type VaultPayload = {
  items: VaultItem[];
  ladders?: Record<string, { items: VaultItem[] }>;
  summary: Record<string, VaultSummary>;
};

const rarities = ["common", "rare", "unique", "epic", "legendary"];
const theme: Record<string, { accent: string; glow: string; panel: string; edge: string; button: string }> = {
  common: { accent: "#60a5fa", glow: "rgba(96,165,250,.55)", panel: "#071321", edge: "#bfdbfe", button: "#2563eb" },
  rare: { accent: "#168cff", glow: "rgba(22,140,255,.62)", panel: "#031327", edge: "#bfdbfe", button: "#168cff" },
  unique: { accent: "#a855f7", glow: "rgba(168,85,247,.65)", panel: "#190724", edge: "#ead5ff", button: "#9333ea" },
  epic: { accent: "#ef233c", glow: "rgba(239,35,60,.68)", panel: "#240609", edge: "#fecaca", button: "#dc2626" },
  legendary: { accent: "#f59e0b", glow: "rgba(245,158,11,.68)", panel: "#211402", edge: "#fde68a", button: "#d97706" },
};

const floorPrices: Record<string, number> = { common: 10, rare: 50, unique: 100, epic: 250, legendary: 500 };

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`;
}

function pct(item: VaultItem) {
  const target = Number(item.targetEntries || item.requiredEntrants || 0);
  return target ? Math.max(0, Math.min(100, Math.round((Number(item.currentEntries || 0) / target) * 100))) : 0;
}

export default function PrizeVaultPage() {
  const [rarity, setRarity] = useState(() => {
    if (typeof window === "undefined") return "rare";
    const requested = new URLSearchParams(window.location.search).get("rarity")?.toLowerCase() || "rare";
    return rarities.includes(requested) ? requested : "rare";
  });
  const [selectedId, setSelectedId] = useState("");
  const rail = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useQuery<VaultPayload>({
    queryKey: ["/api/prize-vault"],
    queryFn: async () => {
      const response = await fetch("/api/prize-vault", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load Prize Vault");
      return response.json();
    },
  });

  const all = Array.isArray(data?.items) ? data.items : [];
  const cards = data?.ladders?.[rarity]?.items || all.filter((item) => item.rarity === rarity);
  const selected = useMemo(() => cards.find((item) => item.id === selectedId) || cards.find((item) => item.currentPrize) || cards[0], [cards, selectedId]);
  const activeSummary = data?.summary?.[rarity];
  const entries = Number(activeSummary?.currentEntries ?? cards[0]?.currentEntries ?? 0);
  const unlocked = Number(activeSummary?.unlocked ?? cards.filter((item) => item.currentPrize || item.unlocked).length);
  const activePrize = cards.filter((item) => item.currentPrize || item.unlocked).sort((a, b) => b.tierIndex - a.tierIndex)[0];
  const activeValue = Number(activePrize?.value || 0);
  const scroll = (dir: number) => rail.current?.scrollBy({ left: dir * 900, behavior: "smooth" });
  const selectRarity = (key: string) => {
    setRarity(key);
    setSelectedId("");
    if (typeof window !== "undefined") window.history.replaceState({}, "", `/prize-vault?rarity=${key}`);
  };

  return (
    <main className="min-h-full overflow-x-hidden bg-[#02040d] pb-[calc(10rem+env(safe-area-inset-bottom,0px))] text-white">
      <div className="mx-auto max-w-[1600px] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(109,40,217,.32),transparent_34%),linear-gradient(180deg,#080b20,#02040d)] sm:rounded-[2rem] sm:border sm:border-white/10">
        <header className="border-b border-white/10 px-4 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/70">Fantasy Arena 2026/27</div>
              <h1 className="mt-1 bg-gradient-to-r from-white via-cyan-300 to-fuchsia-400 bg-clip-text text-4xl font-black text-transparent sm:text-6xl">PRIZE VAULT</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/55">Premium real-world rewards with clean, high-resolution artwork. Every rarity has its own fully linked ladder, tournament and floor price.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TopStat icon={Users} label={`${rarity} entries`} value={String(entries)} />
              <TopStat icon={Gift} label={`${rarity} unlocked`} value={String(unlocked)} />
              <TopStat icon={Trophy} label="Current value" value={money(activeValue)} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto">
            {rarities.map((key) => {
              const t = theme[key];
              const row = data?.summary?.[key];
              const floor = Number(row?.entryFee || floorPrices[key]);
              const active = rarity === key;
              return <button key={key} onClick={() => selectRarity(key)} className="relative overflow-hidden rounded-2xl border px-3 py-3 text-left transition sm:min-w-[168px]" style={{ borderColor: active ? t.accent : "rgba(255,255,255,.1)", background: active ? `linear-gradient(135deg,${t.accent}2f,rgba(0,0,0,.72))` : "rgba(0,0,0,.3)", boxShadow: active ? `0 0 28px ${t.glow}` : undefined }}><div className="absolute inset-x-0 bottom-0 h-1" style={{ background: t.accent }} /><div className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: t.accent }}>{key}</div><div className="mt-1 text-sm font-black">Floor {money(floor)}</div><div className="text-[10px] text-white/40">{Number(row?.marginMultiplier || 0).toFixed(1)}x funding</div></button>;
            })}
          </div>
        </header>

        <section className="px-3 py-5 sm:px-7 sm:py-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="text-xs font-black uppercase tracking-[.22em]" style={{ color: theme[rarity].accent }}>{rarity} prize ladder</div><h2 className="mt-1 text-2xl font-black sm:text-3xl">One chain of prizes. One winner prize.</h2><p className="mt-1 text-xs text-white/45">Showing only the {rarity} ladder: {entries} current-gameweek entries, floor price {money(activeSummary?.entryFee || floorPrices[rarity])}, and {unlocked} unlocked reward{unlocked === 1 ? "" : "s"}.</p></div>
            <Link href={`/competitions?rarity=${rarity}`}><Button className="w-full rounded-xl font-black text-white sm:w-auto" style={{ background: theme[rarity].button, boxShadow: `0 0 24px ${theme[rarity].glow}` }}><Trophy className="mr-2 h-4 w-4" />Enter {rarity} tournament</Button></Link>
          </div>
          <div className="relative rounded-[1.8rem] border border-white/10 p-3 sm:p-5" style={{ background: `radial-gradient(circle at 50% 100%,${theme[rarity].glow},transparent 55%),rgba(0,0,0,.28)` }}>
            <button onClick={() => scroll(-1)} className="absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 xl:block"><ArrowLeft className="h-5 w-5" /></button>
            <div ref={rail} className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:flex xl:snap-x xl:overflow-x-auto xl:px-14 xl:pb-12 xl:pt-10">
              {cards.map((item, index) => <PrizeSlab key={item.id} item={item} index={index} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />)}
              {!cards.length && <Card className="border-white/10 bg-white/[.04] p-8 text-center text-white/45 sm:col-span-2">{isLoading ? "Loading vault…" : "No prizes available."}</Card>}
            </div>
            <button onClick={() => scroll(1)} className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 xl:block"><ArrowRight className="h-5 w-5" /></button>
          </div>
        </section>

        {selected && <Spotlight item={selected} />}

        <footer className="grid gap-3 border-t border-white/10 bg-black/25 px-4 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
          <Info icon={Sparkles} title="Every Gameweek" text="Progress resets; the full ladder remains." />
          <Info icon={ShieldCheck} title="Funded First" text="A reward unlocks only after funding is met." />
          <Info icon={Gift} title="Real Rewards" text="Physical prize or approved equivalent value." />
          <Info icon={Flame} title="Highest Prize Wins" text="Lower unlocked prizes fall away." />
        </footer>
      </div>
    </main>
  );
}

function PrizeSlab({ item, index, selected, onSelect }: { item: VaultItem; index: number; selected: boolean; onSelect: () => void }) {
  const t = theme[item.rarity] || theme.common;
  const progress = pct(item);
  const open = Boolean(item.currentPrize || item.unlocked);
  const desktopTilt = index % 2 ? "rotateY(-5deg) rotateZ(.35deg)" : "rotateY(5deg) rotateZ(-.35deg)";
  return (
    <button onClick={onSelect} className="group relative mx-auto w-full max-w-[370px] text-left [perspective:1400px] xl:min-w-[320px] xl:max-w-[320px] xl:snap-start">
      <div className="relative transition duration-500 xl:group-hover:-translate-y-4" style={{ transform: selected ? "translateY(-12px) rotateY(0deg)" : undefined }}>
        <div className="absolute bottom-[-20px] left-[16px] right-[-22px] top-[18px] hidden rounded-[2.3rem] xl:block" style={{ background: `linear-gradient(90deg,${t.panel},#000)`, boxShadow: "25px 28px 48px rgba(0,0,0,.72)" }} />
        <div className="relative rounded-[2.25rem] p-[4px]" style={{ transform: selected ? "none" : desktopTilt, background: `linear-gradient(135deg,white 0%,${t.edge} 12%,${t.accent} 48%,#05070d 82%)`, boxShadow: `0 0 48px ${t.glow},0 35px 60px rgba(0,0,0,.68)` }}>
          <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] border border-white/15 p-4" style={{ background: `linear-gradient(160deg,rgba(255,255,255,.12),transparent 28%),${t.panel}` }}>
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/10 to-transparent" />
            <div className="relative z-10 flex items-center justify-between"><span className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[10px] font-black">#{item.tierIndex}</span><span className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color: t.accent }}>{item.rarity}</span></div>
            <div className={`relative z-10 mt-4 h-[260px] overflow-hidden rounded-[1.5rem] border border-white/10 ${open ? "" : "brightness-[.62] saturate-[.72]"}`}><PrizeArt item={item} /></div>
            <div className="relative z-10 mt-4 text-center"><h3 className="line-clamp-2 min-h-[58px] text-xl font-black leading-tight">{item.title}</h3><p className="mt-1 text-xs text-white/50">Approx. value {money(item.value)}</p></div>
            <div className="relative z-10 mt-5"><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: open ? "#34d399" : t.accent, boxShadow: `0 0 18px ${t.glow}` }} /></div><div className="mt-2 flex justify-between text-xs font-black"><span>{item.currentEntries}/{item.targetEntries}</span><span style={{ color: open ? "#6ee7b7" : t.accent }}>{open ? "UNLOCKED" : `${progress}%`}</span></div></div>
            {!open && <Chain />}
            {open && <div className="absolute inset-x-5 bottom-5 z-30 flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/15 py-2 text-xs font-black text-emerald-100"><CheckCircle2 className="h-4 w-4" />UNLOCKED</div>}
          </div>
        </div>
      </div>
    </button>
  );
}

function PrizeArt({ item }: { item: VaultItem }) {
  return <PremiumPrizeArtwork title={item.title} rarity={item.rarity} category={item.category} />;
}

function Chain() {
  return <div className="pointer-events-none absolute inset-0 z-20"><svg viewBox="0 0 360 520" className="h-full w-full"><defs><pattern id="links" width="24" height="16" patternUnits="userSpaceOnUse"><ellipse cx="12" cy="8" rx="9" ry="4.5" fill="none" stroke="#f6d47a" strokeWidth="3"/><ellipse cx="12" cy="8" rx="4" ry="2" fill="none" stroke="#5d3c12" strokeWidth="2"/></pattern></defs><path d="M-45 170 405 340" stroke="url(#links)" strokeWidth="24"/><path d="M405 170-45 340" stroke="url(#links)" strokeWidth="24"/></svg><div className="absolute left-1/2 top-[49%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-amber-100/70 bg-gradient-to-b from-amber-100 via-amber-500 to-amber-950 p-4 shadow-[0_0_42px_rgba(245,158,11,.8)]"><Lock className="h-8 w-8 text-amber-950" /></div><div className="absolute inset-x-8 top-[63%] rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[.16em] text-cyan-200">Locked until target reached</div></div>;
}

function Spotlight({ item }: { item: VaultItem }) {
  const t = theme[item.rarity] || theme.common;
  const progress = pct(item);
  const remaining = Math.max(0, Number(item.targetEntries || 0) - Number(item.currentEntries || 0));
  return <section className="border-t border-white/10 bg-black/25 px-3 py-6 sm:px-7"><div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><div className="grid gap-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.04] p-4 sm:p-7 md:grid-cols-[1fr_.9fr] md:items-center"><div><div className="text-xs font-black uppercase tracking-[.18em]" style={{ color: t.accent }}>{item.rarity} prize</div><h3 className="mt-3 text-3xl font-black sm:text-5xl">{item.title}</h3><p className="mt-3 text-sm text-white/55">The prize is purchased only after the gameweek closes and its target has been fully funded.</p><div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Value" value={money(item.value)} /><Mini label="Type" value={item.category || "Physical"} /><Mini label="Status" value={item.currentPrize || item.unlocked ? "Unlocked" : "Locked"} /></div></div><div className="relative min-h-[280px] overflow-hidden rounded-[1.5rem] border border-white/10"><PrizeArt item={item} /></div></div><div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-4 sm:p-7"><div className="flex items-center gap-2 text-sm font-black"><Trophy className="h-5 w-5" style={{ color: t.accent }} />{item.rarity} vault progress</div><div className="mt-5 text-3xl font-black">{item.currentEntries} / {item.targetEntries} entries</div><div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: t.accent, boxShadow: `0 0 22px ${t.glow}` }} /></div><p className="mt-3 text-sm text-white/55">{remaining ? `Need ${remaining} more ${item.rarity} entries to unlock this reward.` : "Funding target reached."}</p><Link href={`/competitions?rarity=${item.rarity}`}><Button className="mt-5 w-full rounded-xl font-black text-white" style={{ background: t.button, boxShadow: `0 0 22px ${t.glow}` }}><Zap className="mr-2 h-4 w-4" />Enter {item.rarity} tournament</Button></Link></div></div></section>;
}

function TopStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.12em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" /><span className="truncate">{label}</span></div><div className="mt-2 truncate text-lg font-black">{value}</div></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-1 truncate text-sm font-black">{value}</div></div>; }
function Info({ icon: Icon, title, text }: { icon: any; title: string; text: string }) { return <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="rounded-xl bg-purple-400/10 p-2 text-purple-200"><Icon className="h-5 w-5" /></div><div><div className="font-black">{title}</div><div className="mt-1 text-xs text-white/42">{text}</div></div></div>; }

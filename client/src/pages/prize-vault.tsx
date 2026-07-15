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
  const activePrize = cards.filter((item) => item.currentPrize || item.unlocked).sort((a, b) => b.tierIndex - a.tierIndex)[0] || cards[0];
  const activeValue = Number(activePrize?.value || 0);
  const scroll = (dir: number) => rail.current?.scrollBy({ left: dir * 760, behavior: "smooth" });
  const selectRarity = (key: string) => {
    setRarity(key);
    setSelectedId("");
    if (typeof window !== "undefined") window.history.replaceState({}, "", `/prize-vault?rarity=${key}`);
  };

  return (
    <main className="min-h-full overflow-x-hidden bg-[#02040d] pb-[calc(10rem+env(safe-area-inset-bottom,0px))] text-white">
      <div className="mx-auto max-w-[1600px] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(109,40,217,.24),transparent_34%),linear-gradient(180deg,#080b20,#02040d)] sm:rounded-[2rem] sm:border sm:border-white/10">
        <header className="border-b border-white/10 px-4 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/70">Fantasy Arena 2026/27</div>
              <h1 className="mt-1 bg-gradient-to-r from-white via-cyan-300 to-fuchsia-400 bg-clip-text text-4xl font-black text-transparent sm:text-6xl">PRIZE VAULT</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/55">One linked prize ladder per rarity. Every entry, unlock target and prize value comes from the live Prize Vault data.</p>
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

        {activePrize && <FeaturedPrize item={activePrize} entryFee={Number(activeSummary?.entryFee || floorPrices[rarity])} />}

        <section className="px-3 py-5 sm:px-7 sm:py-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[.22em]" style={{ color: theme[rarity].accent }}>{rarity} prize ladder</div>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">Browse every unlock level</h2>
              <p className="mt-1 text-xs text-white/45">{entries} current-gameweek entries • floor {money(activeSummary?.entryFee || floorPrices[rarity])} • {unlocked} unlocked reward{unlocked === 1 ? "" : "s"}.</p>
            </div>
            <Link href={`/competitions?rarity=${rarity}`}><Button className="w-full rounded-xl font-black text-white sm:w-auto" style={{ background: theme[rarity].button, boxShadow: `0 0 24px ${theme[rarity].glow}` }}><Trophy className="mr-2 h-4 w-4" />Enter {rarity} tournament</Button></Link>
          </div>

          <div className="relative rounded-[1.8rem] border border-white/10 p-3 sm:p-5" style={{ background: `radial-gradient(circle at 50% 100%,${theme[rarity].glow},transparent 58%),rgba(0,0,0,.28)` }}>
            <button onClick={() => scroll(-1)} className="absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/80 p-3 xl:block"><ArrowLeft className="h-5 w-5" /></button>
            <div ref={rail} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:flex xl:snap-x xl:overflow-x-auto xl:px-14 xl:pb-8 xl:pt-7">
              {cards.map((item, index) => <PrizeSlab key={item.id} item={item} index={index} total={cards.length} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />)}
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

function FeaturedPrize({ item, entryFee }: { item: VaultItem; entryFee: number }) {
  const t = theme[item.rarity] || theme.common;
  const progress = pct(item);
  const remaining = Math.max(0, Number(item.targetEntries || 0) - Number(item.currentEntries || 0));
  return <section className="border-b border-white/10 px-3 py-5 sm:px-7 sm:py-7">
    <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 lg:grid-cols-[1.15fr_.85fr]" style={{ boxShadow: `0 0 55px ${t.glow}` }}>
      <div className="relative min-h-[300px] overflow-hidden border-b border-white/10 lg:border-b-0 lg:border-r">
        <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 50% 60%,${t.glow},transparent 58%)` }} />
        <PrizeArt item={item} />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_18%,rgba(255,255,255,.16)_42%,transparent_58%)]" />
      </div>
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2"><BadgePill text={`${item.rarity} current prize`} color={t.accent} /><BadgePill text={`Tier ${item.tierIndex}`} color="#ffffff" /></div>
        <h2 className="mt-4 text-3xl font-black sm:text-5xl">{item.title}</h2>
        <p className="mt-2 text-sm text-white/50">Approximate retail value {money(item.value)}. The highest unlocked prize becomes the current winner reward.</p>
        <div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Entry fee" value={money(entryFee)} /><Mini label="Entries" value={`${item.currentEntries}/${item.targetEntries}`} /><Mini label="Remaining" value={String(remaining)} /></div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: t.accent, boxShadow: `0 0 22px ${t.glow}` }} /></div>
        <div className="mt-2 flex justify-between text-xs font-bold text-white/45"><span>Funding progress</span><span style={{ color: t.accent }}>{progress}%</span></div>
        <Link href={`/competitions?rarity=${item.rarity}`}><Button className="mt-5 w-full rounded-xl font-black text-white" style={{ background: t.button, boxShadow: `0 0 22px ${t.glow}` }}><Zap className="mr-2 h-4 w-4" />Enter {item.rarity} tournament</Button></Link>
      </div>
    </div>
  </section>;
}

function PrizeSlab({ item, index, total, selected, onSelect }: { item: VaultItem; index: number; total: number; selected: boolean; onSelect: () => void }) {
  const t = theme[item.rarity] || theme.common;
  const progress = pct(item);
  const open = Boolean(item.currentPrize || item.unlocked);
  const desktopTilt = index % 2 ? "rotateY(-2deg)" : "rotateY(2deg)";
  return (
    <button onClick={onSelect} className="group relative mx-auto w-full max-w-[340px] text-left [perspective:1500px] xl:min-w-[286px] xl:max-w-[286px] xl:snap-start">
      <div className="relative transition duration-500 xl:group-hover:-translate-y-3" style={{ transform: selected ? "translateY(-10px) rotateY(0deg)" : undefined }}>
        <div className="relative rounded-[1.75rem] p-[2px]" style={{ transform: selected ? "none" : desktopTilt, background: `linear-gradient(135deg,rgba(255,255,255,.96),${t.edge} 18%,${t.accent} 52%,rgba(255,255,255,.55) 72%,#05070d 100%)`, boxShadow: `0 0 28px ${t.glow},0 26px 50px rgba(0,0,0,.68)` }}>
          <div className="relative min-h-[438px] overflow-hidden rounded-[1.62rem] border border-white/25 bg-white/[.055] p-3 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-[5px] rounded-[1.4rem] border border-white/15" />
            <div className="pointer-events-none absolute inset-x-6 top-0 h-20 rounded-b-[50%] bg-gradient-to-b from-white/30 via-white/5 to-transparent blur-[2px]" />
            <div className="pointer-events-none absolute -left-16 top-8 h-56 w-28 rotate-[18deg] bg-gradient-to-r from-transparent via-white/22 to-transparent blur-xl transition duration-700 group-hover:left-[78%]" />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/45 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[.15em]" style={{ color: t.accent }}><Sparkles className="h-3 w-3" />{item.rarity} prize</span>
              <span className="rounded-xl border border-white/15 bg-black/45 px-2.5 py-1.5 text-[9px] font-black">#{String(item.tierIndex).padStart(2, "0")} OF {String(total).padStart(2, "0")}</span>
            </div>

            <div className="relative z-10 mt-3 overflow-hidden rounded-[1.3rem] border border-white/15 bg-black/30 p-2.5">
              <div className={`relative h-[245px] overflow-hidden rounded-[1.05rem] ${open ? "" : "brightness-[.66] saturate-[.78]"}`}><PrizeArt item={item} /></div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.24),transparent_24%,transparent_64%,rgba(255,255,255,.1))]" />
            </div>

            <div className="relative z-10 -mt-1 flex justify-center">
              <div className="h-3 w-[78%] rounded-[50%] blur-md" style={{ background: t.glow }} />
            </div>
            <div className="relative z-10 mx-auto -mt-2 h-7 w-[78%] rounded-[50%] border border-white/10 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,.16),rgba(0,0,0,.82)_64%)] shadow-[0_12px_22px_rgba(0,0,0,.75)]" />

            <div className="relative z-10 mt-2 rounded-[1.15rem] border border-white/12 bg-black/45 px-3 py-3 text-center backdrop-blur-md">
              <div className="text-[9px] font-black uppercase tracking-[.18em]" style={{ color: t.accent }}>{item.rarity} prize</div>
              <h3 className="mt-1 line-clamp-2 min-h-[42px] text-[15px] font-black leading-tight">{item.title}</h3>
              <div className="mt-1 text-[10px] text-white/45">Approx. value {money(item.value)}</div>
            </div>

            <div className="relative z-10 mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: open ? "#34d399" : t.accent, boxShadow: `0 0 16px ${open ? "rgba(52,211,153,.55)" : t.glow}` }} /></div>
              <div className="mt-2 flex justify-between text-[10px] font-black"><span>{item.currentEntries}/{item.targetEntries} entries</span><span style={{ color: open ? "#6ee7b7" : t.accent }}>{open ? "UNLOCKED" : `${progress}%`}</span></div>
            </div>

            {!open && <CompactLock />}
            {open && <div className="absolute inset-x-4 bottom-4 z-30 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300/30 bg-emerald-400/15 py-1.5 text-[10px] font-black text-emerald-100"><CheckCircle2 className="h-3.5 w-3.5" />UNLOCKED</div>}
          </div>
        </div>
      </div>
    </button>
  );
}

function PrizeArt({ item }: { item: VaultItem }) {
  return <PremiumPrizeArtwork title={item.title} rarity={item.rarity} category={item.category} />;
}

function CompactLock() {
  return <div className="pointer-events-none absolute inset-0 z-20"><div className="absolute inset-x-8 top-[46%] h-[2px] rotate-[24deg] bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_16px_rgba(245,158,11,.75)]" /><div className="absolute inset-x-8 top-[46%] h-[2px] -rotate-[24deg] bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_16px_rgba(245,158,11,.75)]" /><div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-100/60 bg-gradient-to-b from-amber-100 via-amber-500 to-amber-950 p-3 shadow-[0_0_30px_rgba(245,158,11,.65)]"><Lock className="h-6 w-6 text-amber-950" /></div></div>;
}

function Spotlight({ item }: { item: VaultItem }) {
  const t = theme[item.rarity] || theme.common;
  const progress = pct(item);
  const remaining = Math.max(0, Number(item.targetEntries || 0) - Number(item.currentEntries || 0));
  return <section className="border-t border-white/10 bg-black/25 px-3 py-6 sm:px-7"><div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><div className="grid gap-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.04] p-4 sm:p-7 md:grid-cols-[1fr_.9fr] md:items-center"><div><div className="text-xs font-black uppercase tracking-[.18em]" style={{ color: t.accent }}>{item.rarity} prize</div><h3 className="mt-3 text-3xl font-black sm:text-5xl">{item.title}</h3><p className="mt-3 text-sm text-white/55">The prize is purchased only after the gameweek closes and its target has been fully funded.</p><div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Value" value={money(item.value)} /><Mini label="Type" value={item.category || "Physical"} /><Mini label="Status" value={item.currentPrize || item.unlocked ? "Unlocked" : "Locked"} /></div></div><div className="relative min-h-[280px] overflow-hidden rounded-[1.5rem] border border-white/10"><PrizeArt item={item} /></div></div><div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-4 sm:p-7"><div className="flex items-center gap-2 text-sm font-black"><Trophy className="h-5 w-5" style={{ color: t.accent }} />{item.rarity} vault progress</div><div className="mt-5 text-3xl font-black">{item.currentEntries} / {item.targetEntries} entries</div><div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: t.accent, boxShadow: `0 0 22px ${t.glow}` }} /></div><p className="mt-3 text-sm text-white/55">{remaining ? `Need ${remaining} more ${item.rarity} entries to unlock this reward.` : "Funding target reached."}</p><Link href={`/competitions?rarity=${item.rarity}`}><Button className="mt-5 w-full rounded-xl font-black text-white" style={{ background: t.button, boxShadow: `0 0 22px ${t.glow}` }}><Zap className="mr-2 h-4 w-4" />Enter {item.rarity} tournament</Button></Link></div></div></section>;
}

function BadgePill({ text, color }: { text: string; color: string }) { return <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[.14em]" style={{ color, borderColor: `${color}55`, background: `${color}14` }}>{text}</span>; }
function TopStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.12em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" /><span className="truncate">{label}</span></div><div className="mt-2 truncate text-lg font-black">{value}</div></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-1 truncate text-sm font-black">{value}</div></div>; }
function Info({ icon: Icon, title, text }: { icon: any; title: string; text: string }) { return <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="rounded-xl bg-purple-400/10 p-2 text-purple-200"><Icon className="h-5 w-5" /></div><div><div className="font-black">{title}</div><div className="mt-1 text-xs text-white/42">{text}</div></div></div>; }

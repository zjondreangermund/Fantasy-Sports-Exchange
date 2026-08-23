import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, Flame, Gift, Lock, ShieldCheck, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
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
const theme: Record<string, { accent: string; glow: string; button: string }> = {
  common: { accent: "#60a5fa", glow: "rgba(96,165,250,.55)", button: "#2563eb" },
  rare: { accent: "#168cff", glow: "rgba(22,140,255,.62)", button: "#168cff" },
  unique: { accent: "#a855f7", glow: "rgba(168,85,247,.65)", button: "#9333ea" },
  epic: { accent: "#ef233c", glow: "rgba(239,35,60,.68)", button: "#dc2626" },
  legendary: { accent: "#f59e0b", glow: "rgba(245,158,11,.68)", button: "#d97706" },
};

const floorPrices: Record<string, number> = { common: 10, rare: 50, unique: 100, epic: 250, legendary: 500 };
const money = (value: unknown) => {
  const amount = Number(value || 0);
  return `N$${Number.isFinite(amount) ? amount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`;
};
const pct = (item: VaultItem) => {
  const target = Number(item.targetEntries || item.requiredEntrants || 0);
  return target ? Math.max(0, Math.min(100, Math.round((Number(item.currentEntries || 0) / target) * 100))) : 0;
};

export default function PrizeVaultPage() {
  const [rarity, setRarity] = useState(() => {
    if (typeof window === "undefined") return "rare";
    const requested = new URLSearchParams(window.location.search).get("rarity")?.toLowerCase() || "rare";
    return rarities.includes(requested) ? requested : "rare";
  });
  const [selectedId, setSelectedId] = useState("");

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
  const selected = useMemo(
    () => cards.find((item) => item.id === selectedId) || cards.find((item) => item.currentPrize) || cards[0],
    [cards, selectedId],
  );
  const activeSummary = data?.summary?.[rarity];
  const entries = Number(activeSummary?.currentEntries ?? cards[0]?.currentEntries ?? 0);
  const unlocked = Number(activeSummary?.unlocked ?? cards.filter((item) => item.currentPrize || item.unlocked).length);
  const activePrize = cards.filter((item) => item.currentPrize || item.unlocked).sort((a, b) => b.tierIndex - a.tierIndex)[0] || cards[0];
  const activeValue = Number(activePrize?.value || 0);

  const selectRarity = (key: string) => {
    setRarity(key);
    setSelectedId("");
    if (typeof window !== "undefined") window.history.replaceState({}, "", `/prize-vault?rarity=${key}`);
  };

  return (
    <main className="min-h-full overflow-x-hidden bg-[#02040d] pb-[calc(10rem+env(safe-area-inset-bottom,0px))] text-white">
      <div className="mx-auto max-w-[1680px] bg-[radial-gradient(circle_at_50%_0%,rgba(109,40,217,.24),transparent_34%),linear-gradient(180deg,#080b20,#02040d)] sm:rounded-[2rem] sm:border sm:border-white/10">
        <header className="border-b border-white/10 px-4 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/70">Fantasy Arena 2026/27</div>
              <h1 className="mt-1 bg-gradient-to-r from-white via-cyan-300 to-fuchsia-400 bg-clip-text text-4xl font-black text-transparent sm:text-6xl">PRIZE VAULT</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/55">One linked prize ladder per rarity. Every entry, unlock target and stated value comes from the live Prize Vault data.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TopStat icon={Users} label={`${rarity} entries`} value={String(entries)} />
              <TopStat icon={Gift} label={`${rarity} unlocked`} value={String(unlocked)} />
              <TopStat icon={Trophy} label="Current value" value={money(activeValue)} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto sm:pb-1">
            {rarities.map((key) => {
              const currentTheme = theme[key];
              const row = data?.summary?.[key];
              const floor = Number(row?.entryFee || floorPrices[key]);
              const active = rarity === key;
              return (
                <button
                  key={key}
                  onClick={() => selectRarity(key)}
                  className="relative overflow-hidden rounded-2xl border px-3 py-3 text-left transition sm:min-w-[168px]"
                  style={{
                    borderColor: active ? currentTheme.accent : "rgba(255,255,255,.1)",
                    background: active ? `linear-gradient(135deg,${currentTheme.accent}2f,rgba(0,0,0,.72))` : "rgba(0,0,0,.3)",
                    boxShadow: active ? `0 0 28px ${currentTheme.glow}` : undefined,
                  }}
                >
                  <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: currentTheme.accent }} />
                  <div className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: currentTheme.accent }}>{key}</div>
                  <div className="mt-1 text-sm font-black">Floor {money(floor)}</div>
                  <div className="text-[10px] text-white/40">{Number(row?.marginMultiplier || 0).toFixed(1)}x funding</div>
                </button>
              );
            })}
          </div>
        </header>

        {activePrize ? <FeaturedPrize item={activePrize} entryFee={Number(activeSummary?.entryFee || floorPrices[rarity])} /> : null}

        <section className="px-3 py-5 sm:px-7 sm:py-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[.22em]" style={{ color: theme[rarity].accent }}>{rarity} prize ladder</div>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">Browse every unlock level</h2>
              <p className="mt-1 text-xs text-white/45">{entries} current-gameweek entries • floor {money(activeSummary?.entryFee || floorPrices[rarity])} • {unlocked} unlocked reward{unlocked === 1 ? "" : "s"}.</p>
            </div>
            <Link href={`/competitions?rarity=${rarity}`}>
              <Button className="w-full rounded-xl font-black text-white sm:w-auto" style={{ background: theme[rarity].button, boxShadow: `0 0 24px ${theme[rarity].glow}` }}>
                <Trophy className="mr-2 h-4 w-4" />Enter {rarity} tournament
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {cards.map((item, index) => (
              <PrizeSlab
                key={item.id}
                item={item}
                index={index}
                total={cards.length}
                selected={selected?.id === item.id}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
            {!cards.length ? <Card className="border-white/10 bg-white/[.04] p-8 text-center text-white/45 sm:col-span-2">{isLoading ? "Loading vault…" : "No prizes available."}</Card> : null}
          </div>
        </section>

        <footer className="grid gap-3 border-t border-white/10 bg-black/25 px-4 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
          <Info icon={Sparkles} title="Every Gameweek" text="Progress resets; the full ladder remains." />
          <Info icon={ShieldCheck} title="Funded First" text="A reward unlocks only after funding is met." />
          <Info icon={Gift} title="Real Rewards" text="Physical prize or approved equivalent value, subject to availability." />
          <Info icon={Flame} title="Highest Prize Wins" text="Lower unlocked prizes fall away." />
        </footer>
      </div>
      <Dialog open={Boolean(selectedId && selected)} onOpenChange={(open) => { if (!open) setSelectedId(""); }}>
        <DialogContent className="max-h-[92dvh] w-[min(96vw,1180px)] max-w-6xl gap-0 overflow-hidden border-white/10 bg-[#080d1f] p-0 text-white">
          <DialogHeader className="border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="text-[10px] font-black uppercase tracking-[.2em] text-purple-200">Prize details</div>
            <DialogTitle className="mt-1 text-xl">{selected?.title || "Prize Vault"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(92dvh-90px)] overflow-y-auto overscroll-contain">
            {selected ? <Spotlight item={selected} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FeaturedPrize({ item, entryFee }: { item: VaultItem; entryFee: number }) {
  const currentTheme = theme[item.rarity] || theme.common;
  const progress = pct(item);
  const remaining = Math.max(0, Number(item.targetEntries || 0) - Number(item.currentEntries || 0));

  return (
    <section className="border-b border-white/10 px-3 py-5 sm:px-7 sm:py-7">
      <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 lg:grid-cols-[1.08fr_.92fr]" style={{ boxShadow: `0 0 55px ${currentTheme.glow}` }}>
        <div className="relative aspect-[4/3] min-h-[320px] overflow-hidden border-b border-white/10 sm:min-h-[390px] lg:aspect-auto lg:min-h-[460px] lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 50% 60%,${currentTheme.glow},transparent 58%)` }} />
          <PrizeArt item={item} mode="hero" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_18%,rgba(255,255,255,.10)_42%,transparent_58%)]" />
        </div>
        <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <BadgePill text={`${item.rarity} current prize`} color={currentTheme.accent} />
            <BadgePill text={`Tier ${item.tierIndex}`} color="#ffffff" />
          </div>
          <h2 className="mt-4 text-3xl font-black sm:text-5xl">{item.title}</h2>
          <p className="mt-2 text-sm text-white/50">Valued at {money(item.value)}. The highest unlocked prize becomes the current winner reward.</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Mini label="Entry fee" value={money(entryFee)} />
            <Mini label="Entries" value={`${item.currentEntries}/${item.targetEntries}`} />
            <Mini label="Remaining" value={String(remaining)} />
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: currentTheme.accent, boxShadow: `0 0 22px ${currentTheme.glow}` }} /></div>
          <div className="mt-2 flex justify-between text-xs font-bold text-white/45"><span>Funding progress</span><span style={{ color: currentTheme.accent }}>{progress}%</span></div>
          <Link href={`/competitions?rarity=${item.rarity}`}>
            <Button className="mt-5 w-full rounded-xl font-black text-white" style={{ background: currentTheme.button, boxShadow: `0 0 22px ${currentTheme.glow}` }}><Zap className="mr-2 h-4 w-4" />Enter {item.rarity} tournament</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function PrizeSlab({ item, index, total, selected, onSelect }: { item: VaultItem; index: number; total: number; selected: boolean; onSelect: () => void }) {
  const currentTheme = theme[item.rarity] || theme.common;
  const progress = pct(item);
  const open = Boolean(item.currentPrize || item.unlocked);
  const remaining = Math.max(0, Number(item.targetEntries || item.requiredEntrants || 0) - Number(item.currentEntries || 0));

  return (
    <button
      type="button"
      onClick={onSelect}
      data-vault-image-card
      aria-label={`View ${item.title} unlock details`}
      className="group relative mx-auto aspect-[4/5] w-full max-w-[360px] overflow-hidden rounded-[1.6rem] text-left transition duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-2"
      style={{
        boxShadow: selected ? `0 0 0 2px ${currentTheme.accent},0 0 38px ${currentTheme.glow},0 24px 44px rgba(0,0,0,.58)` : `0 18px 38px rgba(0,0,0,.52),0 0 24px ${currentTheme.glow}`,
        transitionDelay: `${Math.min(index, 8) * 25}ms`,
      }}
    >
      <div className={`absolute inset-0 transition duration-300 ${open ? "" : "brightness-[.68] saturate-[.78]"}`}><PrizeArt item={item} mode="card" /></div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/95" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/20" />
      <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/20 bg-black/65 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] backdrop-blur-md" style={{ color: currentTheme.accent }}>{item.rarity} prize</span>
        <span className="rounded-full border border-white/20 bg-black/65 px-2.5 py-1 text-[9px] font-black backdrop-blur-md">#{String(item.tierIndex).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 pt-20">
        <h3 className="line-clamp-2 text-xl font-black leading-tight text-white drop-shadow-lg">{item.title}</h3>
        <div className="mt-1 text-xs font-bold text-white/70">Valued at {money(item.value)}</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <VaultImageStat label="Entries" value={`${item.currentEntries}/${item.targetEntries}`} />
          <VaultImageStat label="Remaining" value={String(remaining)} />
          <VaultImageStat label="Status" value={open ? "Unlocked" : `${progress}%`} />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress}%`, background: open ? "#34d399" : currentTheme.accent, boxShadow: `0 0 16px ${open ? "rgba(52,211,153,.62)" : currentTheme.glow}` }} /></div>
        <div className="mt-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[.08em]"><span className="text-white/60">Unlock progress</span><span className="inline-flex items-center gap-1" style={{ color: open ? "#6ee7b7" : currentTheme.accent }}>{open ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}{open ? "Unlocked" : `Need ${remaining}`}</span></div>
      </div>
    </button>
  );
}

function VaultImageStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-black/55 px-2 py-2 backdrop-blur-md"><div className="text-[8px] font-black uppercase tracking-[.11em] text-white/45">{label}</div><div className="mt-0.5 truncate text-[11px] font-black text-white">{value}</div></div>;
}

function PrizeArt({ item, mode }: { item: VaultItem; mode: "card" | "hero" | "spotlight" }) {
  return <PremiumPrizeArtwork title={item.title} rarity={item.rarity} category={item.category} mode={mode} />;
}

function Spotlight({ item }: { item: VaultItem }) {
  const currentTheme = theme[item.rarity] || theme.common;
  const progress = pct(item);
  const remaining = Math.max(0, Number(item.targetEntries || 0) - Number(item.currentEntries || 0));

  return (
    <section className="border-t border-white/10 bg-black/25 px-3 py-6 sm:px-7">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="grid gap-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.04] p-4 sm:p-7 md:grid-cols-[1fr_.9fr] md:items-center">
          <div>
            <div className="text-xs font-black uppercase tracking-[.18em]" style={{ color: currentTheme.accent }}>{item.rarity} prize</div>
            <h3 className="mt-3 text-3xl font-black sm:text-5xl">{item.title}</h3>
            <p className="mt-3 text-sm text-white/55">Valued at {money(item.value)}. The prize is purchased only after the gameweek closes and its target has been fully funded. Fulfilment is subject to availability; an equivalent prize or approved equivalent value may be offered.</p>
            <div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Valued at" value={money(item.value)} /><Mini label="Type" value={item.category || "Physical"} /><Mini label="Status" value={item.currentPrize || item.unlocked ? "Unlocked" : "Locked"} /></div>
          </div>
          <div className="relative aspect-[4/3] min-h-[280px] overflow-hidden rounded-[1.5rem] border border-white/10 sm:min-h-[340px]"><PrizeArt item={item} mode="spotlight" /></div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-4 sm:p-7">
          <div className="flex items-center gap-2 text-sm font-black"><Trophy className="h-5 w-5" style={{ color: currentTheme.accent }} />{item.rarity} vault progress</div>
          <div className="mt-5 text-3xl font-black">{item.currentEntries} / {item.targetEntries} entries</div>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: currentTheme.accent, boxShadow: `0 0 22px ${currentTheme.glow}` }} /></div>
          <p className="mt-3 text-sm text-white/55">{remaining ? `Need ${remaining} more ${item.rarity} entries to unlock this reward.` : "Funding target reached."}</p>
          <Link href={`/competitions?rarity=${item.rarity}`}><Button className="mt-5 w-full rounded-xl font-black text-white" style={{ background: currentTheme.button, boxShadow: `0 0 22px ${currentTheme.glow}` }}><Zap className="mr-2 h-4 w-4" />Enter {item.rarity} tournament</Button></Link>
        </div>
      </div>
    </section>
  );
}

function BadgePill({ text, color }: { text: string; color: string }) {
  return <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[.14em]" style={{ color, borderColor: `${color}55`, background: `${color}14` }}>{text}</span>;
}

function TopStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.12em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" /><span className="truncate">{label}</span></div><div className="mt-2 truncate text-lg font-black">{value}</div></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-1 truncate text-sm font-black">{value}</div></div>;
}

function Info({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="rounded-xl bg-purple-400/10 p-2 text-purple-200"><Icon className="h-5 w-5" /></div><div><div className="font-black">{title}</div><div className="mt-1 text-xs text-white/42">{text}</div></div></div>;
}

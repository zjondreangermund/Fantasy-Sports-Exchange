import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, Gift, LockKeyhole, Sparkles, Trophy } from "lucide-react";
import { Button } from "../ui/button";
import { PremiumPrizeArtwork } from "../prize-vault/PremiumPrizeArtwork";

const rarities = ["common", "rare", "unique", "epic", "legendary"] as const;
type Rarity = (typeof rarities)[number];
type VaultItem = any;

type RarityTheme = {
  accent: string;
  glow: string;
  glowSoft: string;
  surface: string;
  surfaceDeep: string;
};

const rarityTheme: Record<Rarity, RarityTheme> = {
  common: { accent: "#60a5fa", glow: "rgba(96,165,250,.58)", glowSoft: "rgba(96,165,250,.18)", surface: "#071525", surfaceDeep: "#020711" },
  rare: { accent: "#168cff", glow: "rgba(22,140,255,.72)", glowSoft: "rgba(22,140,255,.22)", surface: "#031327", surfaceDeep: "#010611" },
  unique: { accent: "#a855f7", glow: "rgba(168,85,247,.72)", glowSoft: "rgba(168,85,247,.22)", surface: "#180622", surfaceDeep: "#08020d" },
  epic: { accent: "#ef233c", glow: "rgba(239,35,60,.74)", glowSoft: "rgba(239,35,60,.22)", surface: "#250609", surfaceDeep: "#0d0103" },
  legendary: { accent: "#f59e0b", glow: "rgba(245,158,11,.76)", glowSoft: "rgba(245,158,11,.22)", surface: "#241703", surfaceDeep: "#0c0701" },
};

function money(value: unknown) {
  const amount = Number(value || 0);
  return `N$${Number.isFinite(amount) ? amount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`;
}

function progress(item: VaultItem) {
  const target = Number(item?.targetEntries || item?.requiredEntrants || 0);
  const current = Number(item?.currentEntries || 0);
  return target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
}

export default function NativeVaultPage() {
  const [rarity, setRarity] = React.useState<Rarity>(() => {
    if (typeof window === "undefined") return "rare";
    const requested = new URLSearchParams(window.location.search).get("rarity")?.toLowerCase() as Rarity | undefined;
    return requested && rarities.includes(requested) ? requested : "rare";
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/prize-vault"],
    queryFn: async () => {
      const response = await fetch("/api/prize-vault", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load Prize Vault");
      return response.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const items: VaultItem[] = React.useMemo(() => {
    const ladder = data?.ladders?.[rarity]?.items;
    if (Array.isArray(ladder)) return ladder;
    const all = Array.isArray(data?.items) ? data.items : [];
    return all.filter((item: any) => String(item?.rarity || "").toLowerCase() === rarity);
  }, [data, rarity]);
  const summary = data?.summary?.[rarity] || {};
  const active = [...items].filter((item) => item.currentPrize || item.unlocked).sort((a, b) => Number(b.tierIndex || 0) - Number(a.tierIndex || 0))[0] || items[0];
  const entries = Number(summary.currentEntries ?? active?.currentEntries ?? 0);
  const floor = Number(summary.entryFee || 0);
  const unlocked = Number(summary.unlocked ?? items.filter((item) => item.unlocked || item.currentPrize).length);
  const theme = rarityTheme[rarity];

  const chooseRarity = (value: Rarity) => {
    setRarity(value);
    if (typeof window !== "undefined") window.history.replaceState({}, "", `/prize-vault?rarity=${value}`);
  };

  return (
    <div
      className="mx-auto w-full max-w-xl px-3 pb-4 pt-3"
      data-native-vault
      style={{ background: `radial-gradient(circle at 50% 0%,${theme.glowSoft},transparent 34%)` }}
    >
      <section
        className="overflow-hidden rounded-[1.55rem] border p-4"
        style={{
          borderColor: `${theme.accent}55`,
          background: `linear-gradient(145deg,${theme.surface},#0b0e1c 54%,${theme.surfaceDeep})`,
          boxShadow: `0 0 34px ${theme.glowSoft}`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.22em]" style={{ color: theme.accent }}>{rarity} ladder</p>
            <h2 className="mt-1 text-2xl font-black">Your prize chase.</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Every reward now uses the same Prize Vault artwork and rarity identity as the full vault.</p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border bg-black/25" style={{ borderColor: `${theme.accent}44`, boxShadow: `0 0 20px ${theme.glowSoft}` }}><Gift className="h-5 w-5" style={{ color: theme.accent }} /></div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-black/25 p-2.5 text-center"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Entries</p><p className="mt-1 text-base font-black">{entries}</p></div>
          <div className="rounded-2xl bg-black/25 p-2.5 text-center"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Unlocked</p><p className="mt-1 text-base font-black">{unlocked}</p></div>
          <div className="rounded-2xl bg-black/25 p-2.5 text-center"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Floor</p><p className="mt-1 text-base font-black">{money(floor)}</p></div>
        </div>
      </section>

      <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-2 pt-1 [scrollbar-width:none]">
        {rarities.map((item) => {
          const itemTheme = rarityTheme[item];
          const selected = rarity === item;
          return (
            <button
              key={item}
              onClick={() => chooseRarity(item)}
              className="shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.11em] transition"
              style={{
                color: selected ? itemTheme.accent : "#64748b",
                borderColor: selected ? itemTheme.accent : "rgba(255,255,255,.08)",
                background: selected ? `linear-gradient(135deg,${itemTheme.glowSoft},rgba(0,0,0,.68))` : "rgba(255,255,255,.03)",
                boxShadow: selected ? `0 0 20px ${itemTheme.glow}` : undefined,
              }}
            >
              {item}
            </button>
          );
        })}
      </div>

      {isLoading ? <div className="mt-3 h-72 animate-pulse rounded-[1.55rem] border border-white/6 bg-white/[.025]" /> : active ? (
        <section
          className="mt-3 overflow-hidden rounded-[1.55rem] border"
          style={{
            borderColor: `${theme.accent}66`,
            background: `linear-gradient(145deg,${theme.surfaceDeep},#060812)`,
            boxShadow: `0 0 34px ${theme.glowSoft},0 18px 40px rgba(0,0,0,.44)`,
          }}
        >
          <div className="relative aspect-[16/10] overflow-hidden border-b border-white/10">
            <PremiumPrizeArtwork title={active.title || "Prize Vault reward"} rarity={rarity} category={active.category} mode="hero" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(0,0,0,.72)_100%)]" />
            <div className="absolute bottom-3 left-3 rounded-full border bg-black/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] backdrop-blur-md" style={{ borderColor: `${theme.accent}66`, color: theme.accent }}>Current reachable prize</div>
          </div>

          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1"><h3 className="text-xl font-black leading-tight">{active.title || "Prize Vault reward"}</h3><p className="mt-1 text-lg font-black" style={{ color: theme.accent, textShadow: `0 0 14px ${theme.glow}` }}>{money(active.value)}</p></div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border bg-black/30" style={{ borderColor: `${theme.accent}44` }}><Trophy className="h-5 w-5" style={{ color: theme.accent }} /></div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">Unlock progress</p><p className="mt-1 text-xs font-bold text-slate-300">{Number(active.currentEntries || entries)} / {Number(active.targetEntries || active.requiredEntrants || 0)} entries</p></div><p className="text-sm font-black" style={{ color: theme.accent }}>{progress(active)}%</p></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full transition-all" style={{ width: `${progress(active)}%`, background: theme.accent, boxShadow: `0 0 16px ${theme.glow}` }} /></div>
            <Link href={`/competitions?rarity=${rarity}`}><Button className="mt-4 h-11 w-full rounded-2xl font-black text-white" style={{ background: theme.accent, boxShadow: `0 0 24px ${theme.glow}` }}><Trophy className="mr-2 h-4 w-4" />Enter {rarity} tournament</Button></Link>
          </div>
        </section>
      ) : <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No {rarity} rewards are available yet.</div>}

      <div className="mt-4 flex items-center justify-between gap-3 px-1"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-600">Prize ladder</p><p className="text-sm font-black">Swipe through unlock levels</p></div><span className="text-[10px] font-bold text-slate-600">{items.length} rewards</span></div>
      <div className="-mx-3 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 pt-1 [scrollbar-width:none]">
        {items.map((item: any, index: number) => {
          const isUnlocked = Boolean(item.unlocked || item.currentPrize);
          return (
            <div
              key={item.id || index}
              className="w-[72vw] max-w-[270px] shrink-0 snap-start overflow-hidden rounded-2xl border"
              style={{
                borderColor: isUnlocked ? `${theme.accent}77` : `${theme.accent}30`,
                background: `linear-gradient(145deg,${theme.glowSoft},rgba(3,6,18,.94) 42%,rgba(1,3,10,.98))`,
                boxShadow: isUnlocked ? `0 0 24px ${theme.glowSoft},0 16px 30px rgba(0,0,0,.38)` : "0 14px 28px rgba(0,0,0,.34)",
              }}
            >
              <div className="relative h-36 overflow-hidden border-b border-white/[.07]">
                <PremiumPrizeArtwork title={item.title || "Vault reward"} rarity={rarity} category={item.category} mode="card" />
                <div className="absolute left-2 top-2 rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-[9px] font-black text-white/70 backdrop-blur-md">LEVEL {Number(item.tierIndex ?? index) + 1}</div>
                <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border bg-black/60 backdrop-blur-md" style={{ borderColor: `${theme.accent}44` }}>{isUnlocked ? <Sparkles className="h-3.5 w-3.5" style={{ color: theme.accent }} /> : <LockKeyhole className="h-3.5 w-3.5 text-slate-500" />}</div>
              </div>
              <div className="p-3">
                <p className="min-h-10 text-sm font-black leading-5">{item.title || "Vault reward"}</p>
                <p className="mt-1 text-sm font-black" style={{ color: theme.accent, textShadow: isUnlocked ? `0 0 12px ${theme.glow}` : undefined }}>{money(item.value)}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full" style={{ width: `${progress(item)}%`, background: theme.accent, boxShadow: `0 0 12px ${theme.glow}` }} /></div>
                <p className="mt-2 text-[10px] text-slate-600">{Number(item.currentEntries || entries)} / {Number(item.targetEntries || item.requiredEntrants || 0)} entries</p>
              </div>
            </div>
          );
        })}
      </div>

      <Link href={`/prize-vault?rarity=${rarity}&nativeFull=1`}><button className="mt-1 flex w-full items-center justify-between rounded-2xl border bg-white/[.03] p-3 text-left" style={{ borderColor: `${theme.accent}33` }}><div><p className="text-xs font-black">Full Prize Vault details</p><p className="mt-0.5 text-[10px] text-slate-500">Rules, artwork and every ladder detail.</p></div><ChevronRight className="h-4 w-4" style={{ color: theme.accent }} /></button></Link>
    </div>
  );
}

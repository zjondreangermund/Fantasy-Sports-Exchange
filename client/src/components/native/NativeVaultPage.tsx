import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, Gift, LockKeyhole, Sparkles, Trophy } from "lucide-react";
import { Button } from "../ui/button";

const rarities = ["common", "rare", "unique", "epic", "legendary"] as const;
type Rarity = (typeof rarities)[number];
type VaultItem = any;

const rarityTone: Record<Rarity, { text: string; ring: string; fill: string }> = {
  common: { text: "text-slate-200", ring: "border-slate-300/25", fill: "from-slate-300/12" },
  rare: { text: "text-blue-200", ring: "border-blue-300/25", fill: "from-blue-400/14" },
  unique: { text: "text-violet-200", ring: "border-violet-300/25", fill: "from-violet-400/14" },
  epic: { text: "text-red-200", ring: "border-red-300/25", fill: "from-red-400/14" },
  legendary: { text: "text-amber-200", ring: "border-amber-300/25", fill: "from-amber-400/14" },
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
  const tone = rarityTone[rarity];

  const chooseRarity = (value: Rarity) => {
    setRarity(value);
    if (typeof window !== "undefined") window.history.replaceState({}, "", `/prize-vault?rarity=${value}`);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-vault>
      <section className={`overflow-hidden rounded-[1.55rem] border ${tone.ring} bg-gradient-to-br ${tone.fill} via-[#0b0e1c] to-[#070916] p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-[.22em] ${tone.text}`}>{rarity} ladder</p>
            <h2 className="mt-1 text-2xl font-black">Your prize chase.</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">See the reward that matters now, then jump straight into the right tournament.</p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/8 bg-white/[.045]"><Gift className={`h-5 w-5 ${tone.text}`} /></div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-black/20 p-2.5 text-center"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Entries</p><p className="mt-1 text-base font-black">{entries}</p></div>
          <div className="rounded-2xl bg-black/20 p-2.5 text-center"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Unlocked</p><p className="mt-1 text-base font-black">{unlocked}</p></div>
          <div className="rounded-2xl bg-black/20 p-2.5 text-center"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Floor</p><p className="mt-1 text-base font-black">{money(floor)}</p></div>
        </div>
      </section>

      <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {rarities.map((item) => <button key={item} onClick={() => chooseRarity(item)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.11em] ${rarity === item ? `${rarityTone[item].ring} bg-white/[.08] ${rarityTone[item].text}` : "border-white/8 bg-white/[.03] text-slate-500"}`}>{item}</button>)}
      </div>

      {isLoading ? <div className="mt-3 h-44 animate-pulse rounded-[1.55rem] border border-white/6 bg-white/[.025]" /> : active ? (
        <section className={`mt-3 rounded-[1.55rem] border ${tone.ring} bg-[radial-gradient(circle_at_95%_5%,rgba(255,255,255,.08),transparent_32%),linear-gradient(145deg,#0a0d1a,#060812)] p-4`}>
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[.045]"><Trophy className={`h-7 w-7 ${tone.text}`} /></div>
            <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-600">Current reachable prize</p><h3 className="mt-1 text-lg font-black leading-tight">{active.title || "Prize Vault reward"}</h3><p className={`mt-1 text-base font-black ${tone.text}`}>{money(active.value)}</p></div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">Unlock progress</p><p className="mt-1 text-xs font-bold text-slate-300">{Number(active.currentEntries || entries)} / {Number(active.targetEntries || active.requiredEntrants || 0)} entries</p></div><p className={`text-sm font-black ${tone.text}`}>{progress(active)}%</p></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-400 transition-all" style={{ width: `${progress(active)}%` }} /></div>
          <Link href={`/competitions?rarity=${rarity}`}><Button className="mt-4 h-11 w-full rounded-2xl bg-white text-slate-950 font-black hover:bg-slate-100"><Trophy className="mr-2 h-4 w-4" />Enter {rarity} tournament</Button></Link>
        </section>
      ) : <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No {rarity} rewards are available yet.</div>}

      <div className="mt-4 flex items-center justify-between gap-3 px-1"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-600">Prize ladder</p><p className="text-sm font-black">Swipe through unlock levels</p></div><span className="text-[10px] font-bold text-slate-600">{items.length} rewards</span></div>
      <div className="-mx-3 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
        {items.map((item: any, index: number) => {
          const isUnlocked = Boolean(item.unlocked || item.currentPrize);
          return <div key={item.id || index} className={`w-[68vw] max-w-[250px] shrink-0 snap-start rounded-2xl border p-3 ${isUnlocked ? `${tone.ring} bg-white/[.055]` : "border-white/[.07] bg-white/[.025]"}`}>
            <div className="flex items-center justify-between gap-2"><span className="rounded-lg bg-black/25 px-2 py-1 text-[9px] font-black text-slate-500">LEVEL {Number(item.tierIndex ?? index) + 1}</span>{isUnlocked ? <Sparkles className={`h-4 w-4 ${tone.text}`} /> : <LockKeyhole className="h-4 w-4 text-slate-700" />}</div>
            <p className="mt-3 min-h-10 text-sm font-black leading-5">{item.title || "Vault reward"}</p>
            <p className={`mt-1 text-sm font-black ${tone.text}`}>{money(item.value)}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-white/35" style={{ width: `${progress(item)}%` }} /></div>
            <p className="mt-2 text-[10px] text-slate-600">{Number(item.currentEntries || entries)} / {Number(item.targetEntries || item.requiredEntrants || 0)} entries</p>
          </div>;
        })}
      </div>

      <Link href={`/prize-vault?rarity=${rarity}&nativeFull=1`}><button className="mt-2 flex w-full items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.03] p-3 text-left"><div><p className="text-xs font-black">Full Prize Vault details</p><p className="mt-0.5 text-[10px] text-slate-500">Rules, artwork and every ladder detail.</p></div><ChevronRight className="h-4 w-4 text-slate-600" /></button></Link>
    </div>
  );
}

import { MARKETPLACE_FLOOR_BY_RARITY } from "../../../shared/card-economy";

const FLOORS = [
  { rarity: "Rare", value: MARKETPLACE_FLOOR_BY_RARITY.rare, className: "border-blue-300/25 bg-blue-400/10 text-blue-100" },
  { rarity: "Unique", value: MARKETPLACE_FLOOR_BY_RARITY.unique, className: "border-purple-300/25 bg-purple-400/10 text-purple-100" },
  { rarity: "Epic", value: MARKETPLACE_FLOOR_BY_RARITY.epic, className: "border-red-300/25 bg-red-400/10 text-red-100" },
  { rarity: "Legendary", value: MARKETPLACE_FLOOR_BY_RARITY.legendary, className: "border-amber-300/25 bg-amber-400/10 text-amber-100" },
] as const;

function money(value: number) {
  return `N$${Number(value || 0).toFixed(0)}`;
}

export default function MarketplaceFloorNotice() {
  return (
    <aside className="relative z-40 shrink-0 border-b border-white/10 bg-[#050816]/95 px-3 py-2 text-white shadow-[0_10px_30px_rgba(0,0,0,.28)] backdrop-blur-xl sm:px-5" aria-label="Marketplace floor prices">
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto pb-0.5">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-[.18em] text-white/55">Marketplace floors</span>
        <span className="shrink-0 rounded-xl border border-slate-300/20 bg-slate-400/10 px-2.5 py-1 text-[11px] font-bold text-slate-200">Common: tournament only</span>
        {FLOORS.map((floor) => (
          <span key={floor.rarity} className={`shrink-0 rounded-xl border px-2.5 py-1 text-[11px] font-black ${floor.className}`}>
            {floor.rarity}: {money(floor.value)} minimum
          </span>
        ))}
      </div>
    </aside>
  );
}

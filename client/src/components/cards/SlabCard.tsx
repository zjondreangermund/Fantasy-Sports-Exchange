import { useMemo } from "react";

export type SlabRarity = "common" | "rare" | "unique" | "legendary";

type SlabCardProps = {
  name: string;
  rarity: SlabRarity;
  avgScore: number;
  serialNumber: string;
  className?: string;
  imageSrc?: string;
  season?: string;
  teamCode?: string;
  shirtNumber?: string | number;
  age?: number;
  countryCode?: string;
  last5?: number[];
  value?: string;
  status?: "active" | "legacy" | "uncovered_league";
  competitionEligible?: boolean;
  provenanceMarker?: string;
};

const rarityStyles: Record<
  SlabRarity,
  {
    frame: string;
    shell: string;
    ring: string;
    glow: string;
    label: string;
    banner: string;
    aura: string;
    miniBar: string;
  }
> = {
  common: {
    frame: "from-[#f2f5fb] via-[#9aa4b8] to-[#465165]",
    shell: "from-[#121826] via-[#0d1320] to-[#090e19]",
    ring: "shadow-[0_0_0_1px_rgba(255,255,255,0.48),0_10px_24px_rgba(8,15,32,0.62)]",
    glow: "shadow-[0_26px_56px_rgba(192,201,218,0.36)]",
    label: "COMMON",
    banner: "from-[#b9c2d3]/78 via-[#9ea8ba]/72 to-[#7d8799]/80 border-white/45 text-white",
    aura: "bg-slate-100/18",
    miniBar: "bg-slate-200",
  },
  rare: {
    frame: "from-[#fecaca] via-[#ef4444] to-[#7f1d1d]",
    shell: "from-[#1b0b12] via-[#14080e] to-[#0d0408]",
    ring: "shadow-[0_0_0_1px_rgba(252,165,165,0.52),0_10px_26px_rgba(36,7,7,0.76)]",
    glow: "shadow-[0_26px_56px_rgba(239,68,68,0.42)]",
    label: "RARE",
    banner: "from-[#f97373]/76 via-[#ef4444]/70 to-[#dc2626]/76 border-red-100/40 text-white",
    aura: "bg-rose-300/20",
    miniBar: "bg-rose-300",
  },
  unique: {
    frame: "from-[#d8b4fe] via-[#9333ea] to-[#581c87]",
    shell: "from-[#15142b] via-[#101125] to-[#090b18]",
    ring: "shadow-[0_0_0_1px_rgba(216,180,254,0.56),0_10px_26px_rgba(32,13,56,0.84)]",
    glow: "shadow-[0_28px_62px_rgba(147,51,234,0.48)]",
    label: "UNIQUE",
    banner: "from-[#c084fc]/76 via-[#a855f7]/68 to-[#7e22ce]/76 border-fuchsia-100/42 text-white",
    aura: "bg-fuchsia-300/18",
    miniBar: "bg-fuchsia-400",
  },
  legendary: {
    frame: "from-[#fde68a] via-[#f59e0b] to-[#a16207]",
    shell: "from-[#20160a] via-[#14100b] to-[#0d0a08]",
    ring: "shadow-[0_0_0_1px_rgba(252,211,77,0.56),0_10px_28px_rgba(56,33,5,0.84)]",
    glow: "shadow-[0_30px_64px_rgba(245,158,11,0.54)]",
    label: "LEGENDARY",
    banner: "from-[#fcd34d]/76 via-[#f59e0b]/68 to-[#b45309]/78 border-amber-100/44 text-white",
    aura: "bg-amber-300/20",
    miniBar: "bg-amber-300",
  },
};

function scoreDots(values: number[]) {
  return values.map((value, i) => {
    const tone = value >= 70 ? "bg-emerald-400" : value >= 45 ? "bg-fuchsia-500" : "bg-rose-500";
    return <span key={`dot-${i}`} className={`h-2.5 w-2.5 rounded-full ${tone}`} />;
  });
}

export default function SlabCard({
  name,
  rarity,
  avgScore,
  serialNumber,
  className = "",
  imageSrc,
  season = "2024-25",
  teamCode = "LIV",
  shirtNumber = "10",
  age = 25,
  countryCode = "🇦🇷",
  last5 = [62, 74, 55, 81, 68],
  provenanceMarker = "Verified Holder",
}: SlabCardProps) {
  const style = rarityStyles[rarity];
  const normalizedLast5 = useMemo(() => {
    const values = Array.isArray(last5) ? last5.slice(0, 5).map((v) => Number(v || 0)) : [];
    while (values.length < 5) values.push(0);
    return values;
  }, [last5]);

  return (
    <article
      className={[
        "group relative w-[178px] max-w-full aspect-[0.705/1] rounded-[1.95rem] p-[3px]",
        "border border-white/25 bg-gradient-to-b",
        `bg-gradient-to-b ${style.frame} ${style.ring} ${style.glow}`,
        "transition-transform duration-300 hover:-translate-y-1",
        className,
      ].join(" ")}
    >
      <div className={`relative h-full overflow-hidden rounded-[1.7rem] border border-white/20 bg-gradient-to-b ${style.shell}`}>
        <div className="absolute inset-[4px] rounded-[1.45rem] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-18px_36px_rgba(0,0,0,0.46)]" />
        <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.14),transparent_40%),repeating-radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.04)_0_1px,transparent_1px_6px)]" />

        <div className="relative z-20 flex items-center justify-between px-4 pt-3 text-[12px] font-extrabold tracking-[0.08em] text-white/92">
          <span>{season}</span>
          <span>{teamCode} #{shirtNumber}</span>
        </div>

        <div className="absolute inset-x-4 top-[12%] z-20 h-[35%] overflow-hidden rounded-[0.85rem] border border-white/18 bg-black/25 shadow-[inset_0_8px_20px_rgba(255,255,255,0.08)]">
          <div className={`absolute left-1/2 top-[66%] h-[50%] w-[68%] -translate-x-1/2 rounded-full blur-2xl ${style.aura}`} />
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <div className="h-full w-full bg-white/10" />
          )}
        </div>

        <div
          className={`absolute inset-x-4 top-[50%] z-30 rounded-full border bg-gradient-to-r px-3 py-1 text-center text-[12px] font-black tracking-[0.2em] ${style.banner}`}
        >
          {style.label}
        </div>

        <section className="absolute inset-x-4 bottom-[58px] z-30 rounded-[0.95rem] border border-white/18 bg-black/52 px-2.5 py-1.5 backdrop-blur-sm">
          <div className="mb-1.5 flex items-center justify-between text-[8.5px] font-bold uppercase tracking-[0.1em] text-white/78">
            <span>LAST 5 GAMES</span>
            <span>AVERAGE SCORE</span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-center gap-1.5">{scoreDots(normalizedLast5)}</div>
            <div className="rounded-[0.6rem] border border-white/28 bg-black/56 px-2 py-[3px] text-right">
              <div className="text-[7px] font-bold uppercase tracking-[0.1em] text-white/70">AVG</div>
              <div className="text-[27px] leading-none font-black text-white">{Math.round(avgScore)}</div>
            </div>
          </div>
          <div className="mt-1 h-[2px] rounded-full bg-white/10">
            <span
              className={`block h-[2px] rounded-full ${style.miniBar}`}
              style={{ width: `${Math.min(100, Math.max(10, Math.round((Math.round(avgScore) / 100) * 100)))}%` }}
            />
          </div>
        </section>

        <footer className="absolute inset-x-4 bottom-3 z-30 flex items-end justify-between text-white">
          <div>
            <div className="truncate text-[12px] font-black uppercase leading-tight">{name}</div>
            <div className="text-[11px] font-semibold text-white/85">Age {age}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase text-white/90">{serialNumber}</div>
            <div className="text-[10px] font-semibold text-white/82">{countryCode}</div>
            <div className="text-[8px] font-semibold text-white/72">{provenanceMarker}</div>
          </div>
        </footer>

        <div className="pointer-events-none absolute left-[-120%] top-0 h-full w-[65%] rotate-[18deg] bg-gradient-to-r from-transparent via-white/24 to-transparent opacity-0 transition-all duration-700 group-hover:left-[140%] group-hover:opacity-100" />
      </div>

      <div className="pointer-events-none absolute -bottom-10 left-1/2 h-16 w-[84%] -translate-x-1/2 rounded-full bg-black/55 blur-2xl" />
    </article>
  );
}

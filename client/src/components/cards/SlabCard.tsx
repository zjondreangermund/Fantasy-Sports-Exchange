import { useMemo, useState } from "react";

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
};

const rarityStyles: Record<SlabRarity, { frame: string; slabSide: string; banner: string; glow: string; label: string }> = {
  common: {
    frame: "from-slate-100 via-slate-300 to-slate-500",
    slabSide: "border-l-slate-500 border-b-slate-600",
    banner: "bg-slate-300/25 border-slate-100/45",
    glow: "shadow-[0_20px_42px_rgba(148,163,184,0.3)]",
    label: "COMMON",
  },
  rare: {
    frame: "from-red-200 via-red-500 to-red-800",
    slabSide: "border-l-red-700 border-b-red-900",
    banner: "bg-red-400/22 border-red-100/50",
    glow: "shadow-[0_22px_46px_rgba(239,68,68,0.42)]",
    label: "RARE",
  },
  unique: {
    frame: "from-violet-300 via-fuchsia-600 to-violet-950",
    slabSide: "border-l-violet-700 border-b-violet-950",
    banner: "bg-fuchsia-400/24 border-fuchsia-100/50",
    glow: "shadow-[0_24px_50px_rgba(168,85,247,0.46)]",
    label: "UNIQUE",
  },
  legendary: {
    frame: "from-amber-200 via-amber-500 to-yellow-700",
    slabSide: "border-l-amber-700 border-b-yellow-900",
    banner: "bg-amber-400/22 border-amber-50/55",
    glow: "shadow-[0_24px_52px_rgba(245,158,11,0.5)]",
    label: "LEGENDARY",
  },
};

function barTone(value: number) {
  if (value >= 70) return "bg-emerald-400";
  if (value >= 45) return "bg-amber-400";
  return "bg-rose-500";
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
}: SlabCardProps) {
  const style = rarityStyles[rarity];
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const normalizedLast5 = useMemo(() => {
    const values = Array.isArray(last5) ? last5.slice(0, 5).map((v) => Number(v || 0)) : [];
    while (values.length < 5) values.push(0);
    return values;
  }, [last5]);

  const onMove: React.MouseEventHandler<article> = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    setTilt({ x: (0.5 - py) * 7, y: (px - 0.5) * 8 });
  };

  return (
    <article
      className={[
        "group relative w-[170px] max-w-full aspect-[0.71/1] rounded-[28px] p-[3px]",
        `bg-gradient-to-br ${style.frame} ${style.glow}`,
        "border-l-[5px] border-b-[5px]",
        style.slabSide,
        "transition-[transform,box-shadow] duration-500 ease-out hover:scale-[1.03] hover:shadow-[0_30px_58px_rgba(0,0,0,0.62)]",
        className,
      ].join(" ")}
      style={{ transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div className="absolute inset-[2px] rounded-[24px] border border-white/20" />
      <div className="relative h-full overflow-hidden rounded-[24px] border border-white/20 bg-gradient-to-b from-slate-950 via-slate-900 to-black shadow-[inset_2px_2px_0_rgba(255,255,255,0.24),inset_-4px_-5px_14px_rgba(0,0,0,0.62)]">
        <div className="absolute inset-[6px] rounded-[18px] border-2 border-white/20 shadow-[inset_0_0_18px_rgba(255,255,255,0.12)]" />

        <div className="absolute inset-x-0 top-0 h-[52%] bg-slab-crystal bg-[length:24px_24px,24px_24px,100%_100%,100%_100%] opacity-20" />

        <div className="relative z-20 flex items-center justify-between px-4 pt-3 text-[10px] font-extrabold tracking-[0.14em] text-white/90">
          <span>{season}</span>
          <span>{teamCode} #{shirtNumber}</span>
        </div>

        <div className="absolute inset-x-[8%] top-[13%] z-20 flex h-[52%] items-end justify-center overflow-visible [mask-image:radial-gradient(100%_96%_at_50%_34%,black_68%,transparent_98%)]">
          <div className="absolute left-1/2 top-[48%] h-[46%] w-[64%] -translate-x-1/2 rounded-full bg-white/20 blur-3xl" />
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={name}
              loading="lazy"
              decoding="async"
              className="h-[120%] w-auto max-w-none object-contain object-top drop-shadow-[0_30px_24px_rgba(0,0,0,0.7)]"
            />
          ) : (
            <div className="h-[120%] w-[78%] rounded-3xl bg-white/10" />
          )}
        </div>

        <div className={`absolute inset-x-4 top-[48%] z-30 rounded-full border px-3 py-1 text-center text-[10px] font-black tracking-[0.18em] text-white backdrop-blur ${style.banner}`}>
          {style.label}
        </div>

        <div className="absolute inset-x-4 bottom-[56px] z-30 rounded-xl border border-white/15 bg-black/35 px-2 py-1.5 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.12em] text-white/70">
            <span>Last 5 Games</span>
            <span>Average Score</span>
          </div>
          <div className="flex items-end justify-between gap-1.5">
            <div className="flex h-8 items-end gap-1">
              {normalizedLast5.map((value, i) => (
                <div key={`${name}-bar-${i}`} className="flex flex-col items-center gap-0.5">
                  <span className="text-[7px] text-white/80">{value}</span>
                  <span className={`w-2.5 rounded-sm ${barTone(value)}`} style={{ height: `${Math.max(8, Math.min(28, (value / 100) * 28))}px` }} />
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/20 bg-white/8 px-2 py-1 text-right">
              <div className="text-[7px] uppercase tracking-[0.1em] text-white/70">AVG</div>
              <div className="text-sm font-black text-white">{Math.round(avgScore)}</div>
            </div>
          </div>
        </div>

        <footer className="absolute inset-x-4 bottom-3 z-30 flex items-end justify-between">
          <div>
            <div className="truncate text-[12px] font-black uppercase tracking-[0.02em] text-white">{name}</div>
            <div className="mt-0.5 text-[9px] font-semibold tracking-[0.12em] text-white/75">Age {age}</div>
          </div>
          <div className="text-right">
            <div className="rounded-full border border-white/30 bg-black/35 px-2 py-[2px] text-[8px] font-bold text-white/90">{serialNumber}</div>
            <div className="mt-1 text-xs">{countryCode}</div>
          </div>
        </footer>

        <div className="pointer-events-none absolute -left-[120%] top-0 h-full w-[70%] rotate-[18deg] bg-slab-shine opacity-0 transition-all duration-700 group-hover:left-[140%] group-hover:opacity-100" />
      </div>
    </article>
  );
}

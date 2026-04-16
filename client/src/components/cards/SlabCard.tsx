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
  { frame: string; slabSide: string; banner: string; glow: string; label: string; texture: string; aura: string }
> = {
  common: {
    frame: "from-slate-50 via-slate-300 to-slate-600",
    slabSide: "border-l-slate-500 border-b-slate-700",
    banner: "bg-slate-300/22 border-slate-100/45",
    glow: "shadow-[0_28px_54px_rgba(148,163,184,0.3)]",
    label: "COMMON",
    texture:
      "bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.12),transparent_44%),repeating-radial-gradient(circle_at_30%_30%,rgba(148,163,184,0.08)_0_1px,transparent_1px_4px),linear-gradient(145deg,rgba(148,163,184,0.1),transparent_42%)]",
    aura: "bg-emerald-200/22",
  },
  rare: {
    frame: "from-sky-100 via-blue-400 to-blue-800",
    slabSide: "border-l-blue-700 border-b-blue-950",
    banner: "bg-blue-400/24 border-blue-100/55",
    glow: "shadow-[0_30px_58px_rgba(59,130,246,0.42)]",
    label: "RARE",
    texture:
      "bg-[radial-gradient(circle_at_80%_16%,rgba(125,211,252,0.28),transparent_44%),repeating-linear-gradient(56deg,rgba(125,211,252,0.08)_0_2px,transparent_2px_10px),linear-gradient(125deg,rgba(59,130,246,0.16),transparent_56%)]",
    aura: "bg-sky-200/26",
  },
  unique: {
    frame: "from-fuchsia-200 via-violet-500 to-violet-950",
    slabSide: "border-l-violet-700 border-b-violet-950",
    banner: "bg-fuchsia-400/22 border-fuchsia-100/50",
    glow: "shadow-[0_32px_60px_rgba(168,85,247,0.48)]",
    label: "UNIQUE",
    texture:
      "bg-[radial-gradient(circle_at_82%_14%,rgba(244,114,182,0.3),transparent_42%),radial-gradient(circle_at_18%_78%,rgba(168,85,247,0.24),transparent_52%),repeating-radial-gradient(circle_at_40%_30%,rgba(233,213,255,0.06)_0_2px,transparent_2px_10px)]",
    aura: "bg-fuchsia-200/28",
  },
  legendary: {
    frame: "from-amber-100 via-amber-500 to-yellow-700",
    slabSide: "border-l-amber-700 border-b-yellow-900",
    banner: "bg-amber-400/24 border-amber-100/56",
    glow: "shadow-[0_34px_64px_rgba(245,158,11,0.5)]",
    label: "LEGENDARY",
    texture:
      "bg-[radial-gradient(circle_at_76%_12%,rgba(253,224,71,0.32),transparent_40%),repeating-linear-gradient(0deg,rgba(251,191,36,0.09)_0_1px,transparent_1px_14px),repeating-linear-gradient(90deg,rgba(251,191,36,0.06)_0_1px,transparent_1px_14px)]",
    aura: "bg-amber-200/30",
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
  value,
  status = "active",
  competitionEligible = true,
  provenanceMarker = "Recorded",
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
        "group relative w-[170px] max-w-full aspect-[0.71/1] rounded-[30px] p-[3px]",
        "transform-gpu [transform:perspective(1100px)_rotateX(0deg)_rotateY(0deg)_translateZ(0)]",
        "transition-[transform,box-shadow,filter] duration-500 ease-out",
        "hover:[transform:perspective(1100px)_rotateX(5deg)_rotateY(-6deg)_translateY(-3px)_scale(1.03)]",
        `bg-gradient-to-br ${style.frame} ${style.glow}`,
        "border-l-[6px] border-b-[6px]",
        style.slabSide,
        "before:pointer-events-none before:absolute before:inset-[2px] before:rounded-[26px] before:border before:border-white/35",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[30px] after:shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
        className,
      ].join(" ")}
    >
      <div className="relative h-full overflow-hidden rounded-[26px] border border-white/20 bg-gradient-to-b from-slate-950 via-slate-900 to-black shadow-[inset_2px_2px_0_rgba(255,255,255,0.24),inset_-5px_-6px_16px_rgba(0,0,0,0.62),0_22px_36px_rgba(0,0,0,0.52)]">
        <div className="absolute inset-[6px] rounded-[20px] border-2 border-white/22 shadow-[inset_0_0_22px_rgba(255,255,255,0.14)]" />
        <div className={`absolute inset-0 opacity-40 ${style.texture}`} />

        <div className="pointer-events-none absolute inset-x-[-22%] top-[-40%] z-10 h-[46%] rotate-[15deg] bg-gradient-to-b from-white/42 via-white/14 to-transparent blur-[2px] transition-opacity duration-500 group-hover:opacity-90" />
        <div className="pointer-events-none absolute inset-x-[8%] top-[8%] z-10 h-[28%] rounded-full bg-white/8 blur-2xl" />

        <div className="relative z-20 flex items-center justify-between px-4 pt-3 text-[10px] font-extrabold tracking-[0.14em] text-white/90">
          <span>{season}</span>
          <span>
            {teamCode} #{shirtNumber}
          </span>
        </div>

        <div className="absolute inset-x-[6%] top-[12%] z-20 flex h-[54%] items-end justify-center overflow-visible [mask-image:radial-gradient(98%_96%_at_50%_34%,black_70%,transparent_98%)]">
          <div className={`absolute left-1/2 top-[48%] h-[50%] w-[66%] -translate-x-1/2 rounded-full blur-3xl ${style.aura}`} />
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={name}
              loading="lazy"
              decoding="async"
              className="h-[122%] w-auto max-w-none object-contain object-top drop-shadow-[0_34px_26px_rgba(0,0,0,0.72)] transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="h-[120%] w-[78%] rounded-3xl bg-white/10" />
          )}
        </div>

        <div className={`absolute inset-x-4 top-[48%] z-30 rounded-full border px-3 py-1 text-center text-[10px] font-black tracking-[0.18em] text-white backdrop-blur ${style.banner}`}>
          {style.label}
        </div>
        {value ? (
          <div className="absolute left-4 top-[56%] z-30 rounded-full border border-emerald-100/45 bg-emerald-500/22 px-2 py-[2px] text-[9px] font-bold text-emerald-50">
            Value {value}
          </div>
        ) : null}
        <div className="absolute right-4 top-[56%] z-30 flex gap-1">
          <span
            className={`rounded-full border px-2 py-[2px] text-[8px] font-bold uppercase ${
              status === "active"
                ? "border-sky-200/45 bg-sky-500/20 text-sky-50"
                : status === "legacy"
                  ? "border-amber-200/45 bg-amber-500/20 text-amber-50"
                  : "border-zinc-200/35 bg-zinc-600/25 text-zinc-50"
            }`}
          >
            {status.replace("_", " ")}
          </span>
          <span
            className={`rounded-full border px-2 py-[2px] text-[8px] font-bold ${
              competitionEligible ? "border-emerald-200/45 bg-emerald-500/20 text-emerald-50" : "border-rose-200/35 bg-rose-500/20 text-rose-50"
            }`}
          >
            {competitionEligible ? "Eligible" : "Limited"}
          </span>
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
            <div className="mt-1 text-[8px] font-semibold text-white/75">{provenanceMarker}</div>
          </div>
        </footer>

        <div className="pointer-events-none absolute -left-[120%] top-0 h-full w-[74%] rotate-[18deg] bg-slab-shine opacity-0 transition-all duration-700 group-hover:left-[140%] group-hover:opacity-100" />
      </div>
    </article>
  );
}

import { useMemo } from "react";
import { Shield, Star } from "lucide-react";

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

const rarityThemes: Record<
  SlabRarity,
  {
    frame: string;
    border: string;
    glow: string;
    badge: string;
    bg: string;
    label: string;
    octagon: string;
  }
> = {
  common: {
    frame: "from-zinc-100 via-white to-zinc-200",
    border: "border-zinc-300",
    glow: "shadow-[0_10px_30px_rgba(255,255,255,0.18)]",
    badge: "bg-zinc-100 text-zinc-700 border-zinc-300",
    bg: "from-zinc-50 via-white to-zinc-200",
    label: "COMMON",
    octagon: "from-zinc-200 via-zinc-50 to-zinc-300",
  },
  rare: {
    frame: "from-red-700 via-red-600 to-red-800",
    border: "border-red-400/60",
    glow: "shadow-[0_18px_40px_rgba(220,38,38,0.35)]",
    badge: "bg-white/10 text-white border-white/25",
    bg: "from-red-950 via-red-700 to-red-900",
    label: "RARE",
    octagon: "from-red-900 via-red-500 to-rose-700",
  },
  unique: {
    frame: "from-violet-950 via-indigo-900 to-purple-950",
    border: "border-fuchsia-300/30",
    glow: "shadow-[0_18px_40px_rgba(139,92,246,0.38)]",
    badge: "bg-white/10 text-white border-white/20",
    bg: "from-violet-950 via-indigo-900 to-fuchsia-900",
    label: "UNIQUE",
    octagon: "from-fuchsia-500 via-violet-700 to-amber-200",
  },
  legendary: {
    frame: "from-yellow-200 via-amber-400 to-yellow-700",
    border: "border-yellow-200/60",
    glow: "shadow-[0_18px_40px_rgba(245,158,11,0.35)]",
    badge: "bg-black/10 text-black border-black/15",
    bg: "from-yellow-300 via-amber-400 to-yellow-700",
    label: "LEGENDARY",
    octagon: "from-yellow-900 via-yellow-500 to-amber-200",
  },
};

function splitName(name: string) {
  const parts = String(name || "PLAYER NAME")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "PLAYER", lastName: "NAME" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1).join(" ") };
}

function StatBars({ form }: { form: number[] }) {
  return (
    <div className="flex items-end gap-1">
      {form.map((value, index) => (
        <div
          key={`bar-${index}`}
          className="w-1.5 rounded-sm bg-white/85"
          style={{ height: `${Math.max(8, Math.min(26, value * 0.24))}px` }}
        />
      ))}
    </div>
  );
}

function OctagonBackdrop({ rarity }: { rarity: SlabRarity }) {
  const theme = rarityThemes[rarity];
  return (
    <div className="absolute inset-x-2.5 top-[16%] h-[40%]">
      <div
        className={`absolute inset-0 rounded-[1.1rem] bg-gradient-to-br ${theme.octagon} opacity-95`}
        style={{ clipPath: "polygon(18% 0%,82% 0%,100% 16%,100% 84%,82% 100%,18% 100%,0% 84%,0% 16%)" }}
      />
      <div
        className="absolute inset-[6px] opacity-35"
        style={{
          clipPath: "polygon(18% 0%,82% 0%,100% 16%,100% 84%,82% 100%,18% 100%,0% 84%,0% 16%)",
          backgroundImage:
            "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.85) 0 2px, transparent 3px), linear-gradient(135deg, rgba(255,255,255,0.25) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,0.15) 25%, transparent 25%)",
          backgroundSize: "28px 28px, 28px 28px, 28px 28px",
          backgroundPosition: "0 0, 0 0, 14px 14px",
        }}
      />
      <div
        className="absolute inset-[12px] border border-white/30"
        style={{ clipPath: "polygon(18% 0%,82% 0%,100% 16%,100% 84%,82% 100%,18% 100%,0% 84%,0% 16%)" }}
      />
    </div>
  );
}

export default function SlabCard({
  name,
  rarity,
  avgScore,
  serialNumber,
  className = "",
  imageSrc,
  season = "2026-27",
  teamCode = "LIV",
  shirtNumber = "10",
  age = 24,
  countryCode = "ARG",
  last5 = [65, 78, 72, 85, 80],
  provenanceMarker = "",
}: SlabCardProps) {
  const theme = rarityThemes[rarity] ?? rarityThemes.common;
  const bars = useMemo(() => {
    const values = Array.isArray(last5) ? last5.slice(0, 5).map((v) => Number(v || 0)) : [];
    while (values.length < 5) values.push(50);
    return values;
  }, [last5]);

  const { firstName, lastName } = splitName(name);
  const textTone = rarity === "common" ? "text-zinc-900" : rarity === "legendary" ? "text-black" : "text-white";
  const mutedTone = rarity === "common" ? "text-zinc-600" : rarity === "legendary" ? "text-black/70" : "text-white/75";
  const divider = rarity === "common" ? "border-zinc-400/70" : rarity === "legendary" ? "border-black/20" : "border-white/20";
  const topTone = rarity === "common" ? "text-zinc-800" : rarity === "legendary" ? "text-black/80" : "text-white/90";

  return (
    <article
      className={[
        "relative w-[176px] max-w-full aspect-[0.57/1] overflow-hidden rounded-[1.35rem] border bg-gradient-to-b",
        theme.frame,
        theme.border,
        theme.glow,
        className,
      ].join(" ")}
    >
      <div className={`absolute inset-[4px] rounded-[1.15rem] bg-gradient-to-b ${theme.bg}`} />

      <div className={`absolute inset-x-2.5 top-2 z-20 flex items-center justify-between text-[8px] font-black tracking-wide ${topTone}`}>
        <div>{season}</div>
        <div className="flex items-center gap-1">
          <span>{teamCode}</span>
          {!!shirtNumber && <span>#{shirtNumber}</span>}
        </div>
      </div>

      <div className="absolute left-2.5 top-6 z-20 opacity-90">
        <Shield className={`h-3 w-3 ${topTone}`} />
      </div>

      <OctagonBackdrop rarity={rarity} />

      <div className="absolute inset-x-2 top-[20%] z-20 flex justify-center">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={name}
            className="h-[43%] w-[80%] object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.35)]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="h-24 w-20 rounded-xl bg-white/20" />
        )}
      </div>

      <div className={`absolute inset-x-3 top-[60%] z-20 flex items-end justify-between ${textTone}`}>
        <div>
          <div className={`mb-1 text-[6px] font-bold tracking-[0.16em] ${mutedTone}`}>LAST 5 GAMES</div>
          <StatBars form={bars} />
        </div>
        <div className="text-right">
          <div className={`text-[6px] font-semibold ${mutedTone}`}>AVERAGE</div>
          <div className="text-[17px] font-black leading-none tracking-tight">{Number(avgScore || 0).toFixed(0)}</div>
        </div>
      </div>

      <div className={`absolute inset-x-3 bottom-[24%] z-20 border-t ${divider}`} />

      <div className={`absolute inset-x-3 bottom-[11%] z-20 ${textTone}`}>
        <div className="text-center leading-[0.92]">
          <div className="truncate text-[10px] font-black tracking-wide">{firstName}</div>
          <div className="mt-0.5 truncate text-[11px] font-black tracking-wide">{lastName}</div>
          <div className={`mt-1 text-[7px] font-bold tracking-[0.2em] ${mutedTone}`}>{season}</div>
        </div>
      </div>

      <div className={`absolute bottom-2.5 left-3 z-20 text-[7px] font-bold ${mutedTone}`}>AGE {age}</div>
      <div className={`absolute bottom-2.5 right-3 z-20 text-[7px] font-bold ${mutedTone}`}>{String(countryCode).slice(0, 3).toUpperCase()}</div>

      <div className="absolute left-3 top-[79%] z-20 flex items-center gap-2">
        <div className={`rounded-full border px-1.5 py-0.5 text-[6px] font-black tracking-wide ${theme.badge}`}>{theme.label}</div>
      </div>

      <div className={`absolute right-3 top-[79%] z-20 flex items-center gap-1 text-[7px] font-black ${textTone}`}>
        <Star className="h-2.5 w-2.5" />
        <span>{serialNumber}</span>
      </div>

      {provenanceMarker ? <div className="absolute right-3 top-[84%] z-20 text-[6px] text-white/70">{provenanceMarker}</div> : null}
    </article>
  );
}

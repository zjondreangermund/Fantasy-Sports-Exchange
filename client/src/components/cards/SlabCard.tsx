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
    glowColor: string;
    badge: string;
    bg: string;
    label: string;
    text: string;
    muted: string;
    topTone: string;
    divider: string;
  }
> = {
  common: {
    frame: "from-zinc-100 via-white to-zinc-200",
    border: "border-zinc-300",
    glow: "shadow-[0_10px_30px_rgba(255,255,255,0.18)]",
    glowColor: "rgba(255,255,255,0.28)",
    badge: "bg-zinc-100 text-zinc-700 border-zinc-300",
    bg: "from-zinc-50 via-white to-zinc-200",
    label: "COMMON",
    text: "text-zinc-900",
    muted: "text-zinc-600",
    topTone: "text-zinc-800",
    divider: "border-zinc-400/70",
  },
  rare: {
    frame: "from-red-700 via-red-600 to-red-800",
    border: "border-red-400/60",
    glow: "shadow-[0_18px_40px_rgba(220,38,38,0.35)]",
    glowColor: "rgba(239,68,68,0.32)",
    badge: "bg-white/10 text-white border-white/25",
    bg: "from-red-950 via-red-700 to-red-900",
    label: "RARE",
    text: "text-white",
    muted: "text-white/75",
    topTone: "text-white/90",
    divider: "border-white/20",
  },
  unique: {
    frame: "from-violet-950 via-indigo-900 to-purple-950",
    border: "border-fuchsia-300/30",
    glow: "shadow-[0_18px_40px_rgba(139,92,246,0.38)]",
    glowColor: "rgba(168,85,247,0.34)",
    badge: "bg-white/10 text-white border-white/20",
    bg: "from-violet-950 via-indigo-900 to-fuchsia-900",
    label: "UNIQUE",
    text: "text-white",
    muted: "text-white/75",
    topTone: "text-white/90",
    divider: "border-white/20",
  },
  legendary: {
    frame: "from-yellow-200 via-amber-400 to-yellow-700",
    border: "border-yellow-200/60",
    glow: "shadow-[0_18px_40px_rgba(245,158,11,0.35)]",
    glowColor: "rgba(245,158,11,0.34)",
    badge: "bg-black/10 text-black border-black/15",
    bg: "from-yellow-300 via-amber-400 to-yellow-700",
    label: "LEGENDARY",
    text: "text-black",
    muted: "text-black/70",
    topTone: "text-black/80",
    divider: "border-black/20",
  },
};

function splitName(name: string) {
  const parts = String(name || "PLAYER NAME")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length <= 1) {
    return { firstName: parts[0] || "PLAYER", lastName: "NAME" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
}

function StatBars({ form, rarity }: { form: number[]; rarity: SlabRarity }) {
  const barClass =
    rarity === "legendary"
      ? "bg-black/75"
      : rarity === "common"
        ? "bg-zinc-700/85"
        : "bg-white/90";

  return (
    <div className="flex items-end gap-1">
      {form.map((value, index) => (
        <div
          key={`bar-${index}`}
          className={`w-1.5 rounded-sm ${barClass}`}
          style={{ height: `${Math.max(8, Math.min(24, value * 0.22))}px` }}
        />
      ))}
    </div>
  );
}

function FoilOverlay({ rarity }: { rarity: SlabRarity }) {
  const foilClass =
    rarity === "legendary"
      ? "from-white/30 via-yellow-100/10 to-transparent"
      : rarity === "unique"
        ? "from-fuchsia-200/20 via-cyan-100/10 to-transparent"
        : rarity === "rare"
          ? "from-white/20 via-red-100/10 to-transparent"
          : "from-white/20 via-white/8 to-transparent";

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[1.15rem]">
        <div
          className={`absolute inset-y-0 -left-[35%] w-[55%] rotate-[18deg] bg-gradient-to-r ${foilClass} blur-md animate-[slabShine_5s_linear_infinite]`}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-[4px] z-10 rounded-[1.15rem] opacity-30 mix-blend-screen"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.02) 18%, rgba(255,255,255,0.00) 32%, rgba(255,255,255,0.12) 46%, rgba(255,255,255,0.00) 58%, rgba(255,255,255,0.14) 74%, rgba(255,255,255,0.00) 100%)",
          backgroundSize: "220% 220%",
          animation: "slabFoilMove 7s ease-in-out infinite",
        }}
      />
    </>
  );
}

function RarityGlow({ color }: { color: string }) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-[-10px] z-0 rounded-[1.7rem] blur-xl animate-[slabPulse_3.6s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 68%)` }}
      />
      <div
        className="pointer-events-none absolute inset-[-2px] z-0 rounded-[1.5rem] blur-md opacity-80 animate-[slabPulse_2.8s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 72%)` }}
      />
    </>
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
    const values = Array.isArray(last5)
      ? last5.slice(0, 5).map((v) => Number(v || 0))
      : [];
    while (values.length < 5) values.push(50);
    return values;
  }, [last5]);

  const { firstName, lastName } = splitName(name);

  return (
    <>
      <style>{`
        @keyframes slabPulse {
          0%, 100% { transform: scale(0.98); opacity: 0.65; }
          50% { transform: scale(1.02); opacity: 1; }
        }

        @keyframes slabShine {
          0% { transform: translateX(-140%) rotate(18deg); opacity: 0; }
          12% { opacity: 0.85; }
          35% { opacity: 0.55; }
          100% { transform: translateX(340%) rotate(18deg); opacity: 0; }
        }

        @keyframes slabFoilMove {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>

      <article
        className={[
          "relative w-[176px] max-w-full aspect-[0.57/1] overflow-visible",
          className,
        ].join(" ")}
      >
        <RarityGlow color={theme.glowColor} />

        <div
          className={[
            "relative h-full w-full overflow-hidden rounded-[1.35rem] border bg-gradient-to-b",
            theme.frame,
            theme.border,
            theme.glow,
          ].join(" ")}
        >
          <div className={`absolute inset-[4px] rounded-[1.15rem] bg-gradient-to-b ${theme.bg}`} />

          <FoilOverlay rarity={rarity} />

          <div
            className={`absolute inset-x-2.5 top-2 z-20 flex items-center justify-between text-[8px] font-black tracking-wide ${theme.topTone}`}
          >
            <div>{season}</div>
            <div className="flex items-center gap-1">
              <span>{teamCode}</span>
              {!!shirtNumber && <span>#{shirtNumber}</span>}
            </div>
          </div>

          <div className="absolute left-2.5 top-6 z-20 opacity-90">
            <Shield className={`h-3 w-3 ${theme.topTone}`} />
          </div>

          {/* image area */}
          <div className="absolute inset-x-3 top-[14%] z-20 h-[95px] overflow-hidden rounded-xl border border-white/10 bg-black/10">
            <img
              src={`/rarity/${rarity}-bg.png`}
              alt={`${rarity} background`}
              className="absolute inset-0 h-full w-full object-cover opacity-30"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_68%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/8" />

            {imageSrc ? (
              <img
                src={imageSrc}
                alt={name}
                className="absolute bottom-0 left-1/2 z-10 h-[110px] -translate-x-1/2 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.src = "/images/player-placeholder.png";
                }}
              />
            ) : (
              <img
                src="/images/player-placeholder.png"
                alt="Player placeholder"
                className="absolute bottom-0 left-1/2 z-10 h-[92px] -translate-x-1/2 object-contain opacity-90"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>

          <div className="absolute inset-x-3 top-[47%] z-20">
            <div
              className={`mx-auto inline-flex items-center rounded-full border px-1.5 py-0.5 text-[6px] font-black tracking-wide ${theme.badge}`}
            >
              {theme.label}
            </div>
          </div>

          <div className={`absolute inset-x-3 top-[55%] z-20 flex items-end justify-between ${theme.text}`}>
            <div>
              <div className={`mb-1 text-[6px] font-bold tracking-[0.16em] ${theme.muted}`}>
                LAST 5 GAMES
              </div>
              <StatBars form={bars} rarity={rarity} />
            </div>

            <div className="text-right">
              <div className={`text-[6px] font-semibold ${theme.muted}`}>AVERAGE</div>
              <div className="text-[17px] font-black leading-none tracking-tight">
                {Number(avgScore || 0).toFixed(0)}
              </div>
            </div>
          </div>

          <div className={`absolute inset-x-3 bottom-[26%] z-20 border-t ${theme.divider}`} />

          <div className={`absolute inset-x-3 bottom-[13%] z-20 ${theme.text}`}>
            <div className="text-center leading-[0.92]">
              <div className="truncate text-[10px] font-black tracking-wide">
                {firstName}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-black tracking-wide">
                {lastName}
              </div>
              <div className={`mt-1 text-[7px] font-bold tracking-[0.2em] ${theme.muted}`}>
                {season}
              </div>
            </div>
          </div>

          <div className={`absolute left-3 bottom-2.5 z-20 text-[7px] font-bold ${theme.muted}`}>
            AGE {age}
          </div>

          <div className={`absolute right-3 bottom-2.5 z-20 text-[7px] font-bold ${theme.muted}`}>
            {String(countryCode).slice(0, 3).toUpperCase()}
          </div>

          <div className={`absolute right-3 top-[78.5%] z-20 flex items-center gap-1 text-[7px] font-black ${theme.text}`}>
            <Star className="h-2.5 w-2.5" />
            <span>{serialNumber}</span>
          </div>

          {provenanceMarker ? (
            <div className="absolute right-3 top-[84%] z-20 text-[6px] text-white/70">
              {provenanceMarker}
            </div>
          ) : null}
        </div>
      </article>
    </>
  );
}

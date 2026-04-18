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
  provenanceMarker?: string;
  onImageError?: () => void;
};

const rarityThemes: Record<
  SlabRarity,
  {
    shell: string;
    inner: string;
    border: string;
    glow: string;
    text: string;
    muted: string;
    topTone: string;
    badge: string;
    statsPanel: string;
    divider: string;
    frameRing: string;
  }
> = {
  common: {
    shell: "from-zinc-200 via-white to-zinc-300",
    inner: "from-white via-zinc-100 to-zinc-200",
    border: "border-zinc-300",
    glow: "shadow-[0_14px_34px_rgba(255,255,255,0.18)]",
    text: "text-zinc-900",
    muted: "text-zinc-600",
    topTone: "text-zinc-800",
    badge: "bg-white/80 text-zinc-700 border-zinc-300",
    statsPanel: "bg-white/55 border-zinc-300/60",
    divider: "border-zinc-400/70",
    frameRing: "ring-zinc-200/60",
  },
  rare: {
    shell: "from-red-700 via-red-600 to-red-900",
    inner: "from-red-700 via-red-600 to-red-950",
    border: "border-red-400/70",
    glow: "shadow-[0_18px_44px_rgba(239,68,68,0.42)]",
    text: "text-white",
    muted: "text-white/75",
    topTone: "text-white/90",
    badge: "bg-white/12 text-white border-white/20",
    statsPanel: "bg-black/22 border-white/10",
    divider: "border-white/20",
    frameRing: "ring-red-300/20",
  },
  unique: {
    shell: "from-violet-900 via-purple-800 to-indigo-950",
    inner: "from-violet-900 via-fuchsia-800 to-indigo-950",
    border: "border-fuchsia-300/40",
    glow: "shadow-[0_18px_46px_rgba(168,85,247,0.48)]",
    text: "text-white",
    muted: "text-white/75",
    topTone: "text-white/90",
    badge: "bg-white/12 text-white border-white/20",
    statsPanel: "bg-black/24 border-white/10",
    divider: "border-white/20",
    frameRing: "ring-fuchsia-300/20",
  },
  legendary: {
    shell: "from-amber-300 via-yellow-400 to-amber-700",
    inner: "from-yellow-300 via-amber-400 to-yellow-700",
    border: "border-yellow-200/70",
    glow: "shadow-[0_18px_48px_rgba(245,158,11,0.48)]",
    text: "text-black",
    muted: "text-black/70",
    topTone: "text-black/80",
    badge: "bg-black/10 text-black border-black/15",
    statsPanel: "bg-black/10 border-black/10",
    divider: "border-black/20",
    frameRing: "ring-yellow-100/30",
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

function StatBars({
  form,
  rarity,
}: {
  form: number[];
  rarity: SlabRarity;
}) {
  const barClass =
    rarity === "legendary"
      ? "bg-black/75"
      : rarity === "common"
        ? "bg-zinc-800/80"
        : "bg-white/90";

  return (
    <div className="flex items-end gap-1">
      {form.map((value, index) => (
        <div
          key={index}
          className={`w-[6px] rounded-full ${barClass}`}
          style={{ height: `${Math.max(7, Math.min(24, value * 0.22))}px` }}
        />
      ))}
    </div>
  );
}

function Foil({ rarity }: { rarity: SlabRarity }) {
  const tone =
    rarity === "legendary"
      ? "from-white/35 via-yellow-100/10 to-transparent"
      : rarity === "unique"
        ? "from-fuchsia-200/22 via-cyan-100/10 to-transparent"
        : rarity === "rare"
          ? "from-white/25 via-red-100/10 to-transparent"
          : "from-white/18 via-white/8 to-transparent";

  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
        <div
          className={`absolute inset-y-0 -left-[40%] w-[55%] rotate-[18deg] bg-gradient-to-r ${tone} blur-md animate-[cardShine_5.6s_linear_infinite]`}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-[4px] rounded-[20px] opacity-30 mix-blend-screen"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.02) 18%, rgba(255,255,255,0.00) 32%, rgba(255,255,255,0.12) 46%, rgba(255,255,255,0.00) 58%, rgba(255,255,255,0.14) 74%, rgba(255,255,255,0.00) 100%)",
          backgroundSize: "220% 220%",
          animation: "cardFoilMove 7s ease-in-out infinite",
        }}
      />
    </>
  );
}

function Glow({ rarity }: { rarity: SlabRarity }) {
  const color =
    rarity === "legendary"
      ? "rgba(245,158,11,0.34)"
      : rarity === "unique"
        ? "rgba(168,85,247,0.36)"
        : rarity === "rare"
          ? "rgba(239,68,68,0.34)"
          : "rgba(255,255,255,0.18)";

  return (
    <>
      <div
        className="pointer-events-none absolute inset-[-8px] rounded-[28px] blur-xl animate-[cardPulse_3.4s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 68%)` }}
      />
      <div
        className="pointer-events-none absolute inset-[-2px] rounded-[24px] blur-md opacity-70 animate-[cardPulse_2.8s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 74%)` }}
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
  onImageError,
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
        @keyframes cardPulse {
          0%, 100% { transform: scale(0.985); opacity: 0.65; }
          50% { transform: scale(1.02); opacity: 1; }
        }

        @keyframes cardShine {
          0% { transform: translateX(-140%) rotate(18deg); opacity: 0; }
          12% { opacity: 0.9; }
          35% { opacity: 0.55; }
          100% { transform: translateX(340%) rotate(18deg); opacity: 0; }
        }

        @keyframes cardFoilMove {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>

      <article
        className={[
          "relative w-[176px] h-[312px] max-w-full overflow-visible",
          className,
        ].join(" ")}
      >
        <Glow rarity={rarity} />

        <div
          className={[
            "relative h-full w-full overflow-hidden rounded-[24px] border bg-gradient-to-b ring-1",
            theme.shell,
            theme.border,
            theme.glow,
            theme.frameRing,
          ].join(" ")}
        >
          <div
            className={`absolute inset-[4px] rounded-[20px] bg-gradient-to-b ${theme.inner}`}
          />

          <Foil rarity={rarity} />

          <div
            className={`absolute inset-x-3 top-3 z-20 flex items-center justify-between text-[9px] font-black tracking-wide ${theme.topTone}`}
          >
            <span>{season}</span>
            <span className="flex items-center gap-1">
              <span>{teamCode}</span>
              <span>#{shirtNumber}</span>
            </span>
          </div>

          <div className="absolute left-3 top-7 z-20 opacity-90">
            <Shield className={`h-3.5 w-3.5 ${theme.topTone}`} />
          </div>

          <div className="absolute inset-x-0 top-[18%] z-20 flex justify-center">
            <div className="relative h-[136px] w-[86%]">
              <img
                src={`/rarity/${rarity}-bg.png`}
                alt={`${rarity} background`}
                className="absolute inset-0 h-full w-full object-contain opacity-34"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />

              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_68%)]" />

              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={name}
                  className="absolute bottom-0 left-1/2 z-10 h-[136px] -translate-x-1/2 object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.72)]"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = "/images/player-placeholder.png";
                    onImageError?.();
                  }}
                />
              ) : (
                <img
                  src="/images/player-placeholder.png"
                  alt="Player placeholder"
                  className="absolute bottom-0 left-1/2 z-10 h-[118px] -translate-x-1/2 object-contain opacity-92"
                  loading="lazy"
                  decoding="async"
                />
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 top-[56%] z-20 flex justify-center">
            <div
              className={`rounded-full border px-2 py-1 text-[7px] font-black tracking-[0.18em] ${theme.badge}`}
            >
              {rarity.toUpperCase()}
            </div>
          </div>

          <div
            className={`absolute inset-x-3 top-[63%] z-20 flex items-end justify-between rounded-[12px] border px-2.5 py-2 ${theme.statsPanel} ${theme.text}`}
          >
            <div>
              <div className={`mb-1 text-[6px] font-bold tracking-[0.18em] ${theme.muted}`}>
                LAST 5 GAMES
              </div>
              <StatBars form={bars} rarity={rarity} />
            </div>

            <div className="text-right">
              <div className={`text-[6px] font-semibold ${theme.muted}`}>AVERAGE</div>
              <div className="text-[18px] font-black leading-none tracking-tight">
                {Number(avgScore || 0).toFixed(0)}
              </div>
            </div>
          </div>

          <div className={`absolute inset-x-3 bottom-[18%] z-20 border-t ${theme.divider}`} />

          <div className={`absolute inset-x-3 bottom-[9.5%] z-20 ${theme.text}`}>
            <div className="text-center leading-[0.92]">
              <div className="truncate text-[10px] font-black tracking-wide">
                {firstName}
              </div>
              <div className="mt-0.5 truncate text-[12px] font-black tracking-wide">
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

          <div className={`absolute right-3 top-[85%] z-20 flex items-center gap-1 text-[7px] font-black ${theme.text}`}>
            <Star className="h-2.5 w-2.5" />
            <span>{serialNumber}</span>
          </div>

          {provenanceMarker ? (
            <div className="absolute right-3 top-[89%] z-20 text-[6px] text-white/70">
              {provenanceMarker}
            </div>
          ) : null}
        </div>
      </article>
    </>
  );
}

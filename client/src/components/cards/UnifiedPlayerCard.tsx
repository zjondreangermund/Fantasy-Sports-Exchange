import * as React from "react";
import { CARD_IMAGE_FALLBACK } from "../../lib/card-image";
import { normalizeVisualRarity } from "./cardVisualTokens";
import { type PlayerCardData } from "./types";

type UnifiedPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "compact" | "showcase" | string;
  selected?: boolean;
  interactive?: boolean;
};

type Tilt = { rx: number; ry: number; mx: number; my: number };

const RARITY_STYLE = {
  common: {
    edge: "from-slate-200 via-slate-500 to-slate-950",
    glow: "shadow-[0_18px_48px_rgba(148,163,184,0.24)]",
    badge: "bg-slate-200/18 text-slate-100 border-slate-200/30",
    light: "rgba(226,232,240,.95)",
    wash: "from-slate-900 via-slate-950 to-black",
  },
  rare: {
    edge: "from-sky-300 via-blue-600 to-blue-950",
    glow: "shadow-[0_18px_52px_rgba(37,99,235,0.34)]",
    badge: "bg-blue-400/18 text-blue-100 border-blue-300/35",
    light: "rgba(96,165,250,.95)",
    wash: "from-blue-950 via-slate-950 to-black",
  },
  unique: {
    edge: "from-fuchsia-300 via-purple-700 to-indigo-950",
    glow: "shadow-[0_18px_56px_rgba(168,85,247,0.40)]",
    badge: "bg-fuchsia-400/18 text-fuchsia-100 border-fuchsia-300/35",
    light: "rgba(217,70,239,.95)",
    wash: "from-purple-950 via-slate-950 to-black",
  },
  legendary: {
    edge: "from-yellow-200 via-amber-500 to-stone-950",
    glow: "shadow-[0_18px_58px_rgba(245,158,11,0.40)]",
    badge: "bg-amber-300/18 text-amber-100 border-amber-300/35",
    light: "rgba(251,191,36,.95)",
    wash: "from-amber-950 via-stone-950 to-black",
  },
};

function safeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getLast5(player: PlayerCardData): number[] {
  const values = Array.isArray(player.last5Scores) ? player.last5Scores.map((v) => Number(v || 0)).slice(0, 5) : [];
  while (values.length < 5) values.push(0);
  return values;
}

function getAvg(values: number[], fallback: number): number {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return Math.round(Number(fallback || 0));
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function getTotal(values: number[], fallback?: number): number {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return total > 0 ? total : Math.round(Number(fallback || 0));
}

function getRating(player: PlayerCardData, avg: number): number {
  const rating = Number(player.rating || player.form || avg || 0);
  return Math.max(0, Math.round(rating));
}

function getImageCandidates(player: PlayerCardData): string[] {
  return Array.from(new Set([
    safeText(player.image),
    safeText(player.imageUrl),
    safeText(player.photo),
    ...(Array.isArray(player.imageCandidates) ? player.imageCandidates : []),
    CARD_IMAGE_FALLBACK,
  ].filter(Boolean) as string[]));
}

function isFallback(src: string): boolean {
  const value = src.toLowerCase();
  return value === CARD_IMAGE_FALLBACK.toLowerCase() || value.includes("fallback") || value.includes("/images/player-1");
}

function firstImageIndex(candidates: string[]): number {
  const real = candidates.findIndex((src) => src && !isFallback(src));
  return real >= 0 ? real : 0;
}

function rarityLabel(rarity: string): string {
  return rarity === "legendary" ? "Legendary" : rarity === "unique" ? "Unique" : rarity === "rare" ? "Rare" : "Common";
}

function widthForSize(size: UnifiedPlayerCardProps["size"], variant?: string) {
  if (size === "sm" || variant === "compact") return "w-[170px] h-[242px] rounded-[24px]";
  if (size === "lg" || variant === "showcase") return "w-[250px] h-[356px] rounded-[32px]";
  return "w-[210px] h-[300px] rounded-[28px]";
}

export default function UnifiedPlayerCard({ player, className = "", size = "md", variant = "default", selected = false, interactive = true }: UnifiedPlayerCardProps) {
  const rarity = normalizeVisualRarity(player.rarity);
  const style = RARITY_STYLE[rarity] || RARITY_STYLE.common;
  const [tilt, setTilt] = React.useState<Tilt>({ rx: 0, ry: 0, mx: 50, my: 20 });

  const last5 = React.useMemo(() => getLast5(player), [player.last5Scores, player.rating]);
  const avg = getAvg(last5, Number(player.rating || 0));
  const total = getTotal(last5, player.totalPoints);
  const rating = getRating(player, avg);
  const maxScore = Math.max(1, ...last5, avg);

  const imageKey = React.useMemo(
    () => [player.id, player.image, player.imageUrl, player.photo, ...(Array.isArray(player.imageCandidates) ? player.imageCandidates : [])].join("|"),
    [player.id, player.image, player.imageUrl, player.photo, player.imageCandidates],
  );
  const candidates = React.useMemo(() => getImageCandidates(player), [imageKey]);
  const [imgIndex, setImgIndex] = React.useState(() => firstImageIndex(candidates));

  React.useEffect(() => setImgIndex(firstImageIndex(candidates)), [imageKey, candidates]);

  const img = candidates[imgIndex] || CARD_IMAGE_FALLBACK;
  const name = safeText(player.name, "Unknown Player");
  const club = safeText(player.club || player.team, "Fantasy FC");
  const position = safeText(player.position, "POS").toUpperCase();
  const league = safeText(player.league, "Premier League");
  const compact = size === "sm" || variant === "compact";

  const onMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!interactive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setTilt({ rx: (0.5 - y) * 6, ry: (x - 0.5) * 8, mx: Math.round(x * 100), my: Math.round(y * 100) });
  };

  const resetTilt = () => setTilt({ rx: 0, ry: 0, mx: 50, my: 20 });

  return (
    <div className={`relative inline-flex [perspective:1200px] ${className}`}>
      <style>{`
        @keyframes fantasyOldGlow { 0%,100% { opacity:.68; transform:scale(.96); } 50% { opacity:1; transform:scale(1.04); } }
        @keyframes fantasyOldSweep { 0% { transform: translateX(-140%) rotate(16deg); opacity:0; } 35% { opacity:.28; } 100% { transform: translateX(140%) rotate(16deg); opacity:0; } }
      `}</style>

      <article
        onPointerMove={onMove}
        onPointerLeave={resetTilt}
        className={`relative overflow-hidden bg-gradient-to-br ${style.edge} p-[2px] ${style.glow} ${widthForSize(size, variant)} transition-transform duration-200 ease-out ${selected ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-black" : ""}`}
        style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transformStyle: "preserve-3d" }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-black">
          <div className={`absolute inset-0 bg-gradient-to-b ${style.wash}`} />
          <img
            src={img}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              event.currentTarget.onerror = null;
              setImgIndex((current) => (current + 1 < candidates.length ? current + 1 : current));
            }}
            className="absolute inset-0 h-full w-full object-cover object-top opacity-[0.42] saturate-[0.95] contrast-[1.05]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,.16),transparent_30%),linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.72))]" />
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 1px, transparent 1px, transparent 12px)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 mix-blend-screen">
            <div className="absolute -left-1/2 top-[-20%] h-[130%] w-[35%] bg-gradient-to-r from-transparent via-white/24 to-transparent" style={{ animation: "fantasyOldSweep 4.5s ease-in-out infinite" }} />
          </div>

          <div className="absolute left-[24%] top-[22%] flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.95)]"
                style={{ animation: `fantasyOldGlow ${1.8 + i * 0.2}s ease-in-out infinite` }}
              />
            ))}
          </div>

          <div className="relative z-10 flex h-full flex-col p-3 text-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className={`${compact ? "text-[24px]" : "text-[34px]"} font-black leading-none tracking-tight text-white`}>{rating}</div>
                <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/75">{position}</div>
              </div>
              <div className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] ${style.badge}`}>
                {rarityLabel(rarity)}
              </div>
            </div>

            <div className="mt-auto">
              <div className="grid grid-cols-3 gap-2 text-center text-[8px] font-bold uppercase tracking-[0.14em] text-white/42">
                <span>LV</span><span>AVG</span><span>XP</span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-center text-[10px] font-black text-white/82">
                <span>{Number(player.level || 1)}</span><span>{avg}</span><span>{total}</span>
              </div>

              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {last5.map((score, index) => {
                  const height = Math.max(4, Math.min(18, (Number(score || 0) / maxScore) * 18));
                  return (
                    <div key={`${player.id}-${index}`} className="flex flex-col items-center gap-1">
                      <div className="flex h-[18px] w-full items-end justify-center rounded bg-white/8 px-0.5">
                        <div className="w-full rounded-sm bg-white/62" style={{ height }} />
                      </div>
                      <span className="text-[7px] font-bold text-white/50">{score}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 text-center">
                <div className="truncate text-[12px] font-black uppercase leading-none tracking-[0.04em] text-white drop-shadow">{name}</div>
                <div className="mt-1 truncate text-[8px] font-black uppercase tracking-[0.18em] text-white/58">{club}</div>
                {!compact ? <div className="mt-0.5 truncate text-[8px] font-semibold text-white/42">{league}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

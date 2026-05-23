import * as React from "react";
import { CARD_IMAGE_FALLBACK } from "../../lib/card-image";
import { normalizeVisualRarity } from "./cardVisualTokens";
import { type PlayerCardData } from "./types";

type UnifiedPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
};

type Tilt = { rx: number; ry: number; mx: number; my: number };

const RARITY_STYLE = {
  common: {
    frame: "from-slate-100 via-slate-500 to-slate-950",
    face: "from-slate-800 via-slate-950 to-black",
    accent: "bg-slate-200 text-slate-950",
    glow: "shadow-[0_18px_46px_rgba(148,163,184,0.26)]",
    line: "border-slate-300/45",
  },
  rare: {
    frame: "from-sky-200 via-blue-500 to-blue-950",
    face: "from-sky-950 via-blue-950 to-black",
    accent: "bg-sky-300 text-sky-950",
    glow: "shadow-[0_18px_52px_rgba(59,130,246,0.34)]",
    line: "border-sky-300/55",
  },
  unique: {
    frame: "from-fuchsia-200 via-purple-600 to-indigo-950",
    face: "from-fuchsia-950 via-purple-950 to-black",
    accent: "bg-fuchsia-300 text-fuchsia-950",
    glow: "shadow-[0_18px_56px_rgba(168,85,247,0.40)]",
    line: "border-fuchsia-300/55",
  },
  legendary: {
    frame: "from-yellow-200 via-amber-500 to-stone-950",
    face: "from-amber-950 via-stone-950 to-black",
    accent: "bg-amber-300 text-amber-950",
    glow: "shadow-[0_18px_60px_rgba(245,158,11,0.42)]",
    line: "border-amber-300/60",
  },
};

function safeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function teamCode(player: PlayerCardData): string {
  return safeText(player.team || player.club, "FFC").slice(0, 3).toUpperCase();
}

function getLast5(player: PlayerCardData): number[] {
  const values = Array.isArray(player.last5Scores)
    ? player.last5Scores.map((value) => Number(value || 0)).slice(0, 5)
    : [];
  while (values.length < 5) values.push(0);
  return values;
}

function avgScore(values: number[], fallback: number): number {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return Math.max(0, Math.round(Number(fallback || 0)));
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function totalPoints(values: number[], fallback?: number): number {
  const sum = values.reduce((acc, value) => acc + Number(value || 0), 0);
  return sum > 0 ? sum : Math.max(0, Math.round(Number(fallback || 0)));
}

function imageCandidates(player: PlayerCardData): string[] {
  const candidates = [
    safeText(player.image),
    safeText(player.imageUrl),
    safeText(player.photo),
    ...(Array.isArray(player.imageCandidates) ? player.imageCandidates : []),
    CARD_IMAGE_FALLBACK,
  ].filter(Boolean) as string[];
  return Array.from(new Set(candidates));
}

function isFallback(src: string): boolean {
  const value = src.toLowerCase();
  return value === CARD_IMAGE_FALLBACK.toLowerCase() || value.includes("fallback") || value.includes("/images/player-1");
}

function firstImageIndex(candidates: string[]): number {
  const real = candidates.findIndex((candidate) => candidate && !isFallback(candidate));
  return real >= 0 ? real : 0;
}

function rarityLabel(rarity: string): string {
  return rarity === "legendary" ? "Legendary" : rarity === "unique" ? "Unique" : rarity === "rare" ? "Rare" : "Common";
}

export default function UnifiedPlayerCard({ player, className = "" }: UnifiedPlayerCardProps) {
  const rarity = normalizeVisualRarity(player.rarity);
  const style = RARITY_STYLE[rarity] || RARITY_STYLE.common;
  const [tilt, setTilt] = React.useState<Tilt>({ rx: 0, ry: 0, mx: 50, my: 20 });

  const last5 = React.useMemo(() => getLast5(player), [player.last5Scores, player.rating]);
  const average = avgScore(last5, Number(player.rating || 0));
  const total = totalPoints(last5, player.totalPoints);
  const maxBar = Math.max(1, ...last5, average);

  const key = React.useMemo(
    () => [player.id, player.image, player.imageUrl, player.photo, ...(Array.isArray(player.imageCandidates) ? player.imageCandidates : [])].join("|"),
    [player.id, player.image, player.imageUrl, player.photo, player.imageCandidates],
  );
  const candidates = React.useMemo(() => imageCandidates(player), [key]);
  const [imgIndex, setImgIndex] = React.useState(() => firstImageIndex(candidates));

  React.useEffect(() => {
    setImgIndex(firstImageIndex(candidates));
  }, [key, candidates]);

  const img = candidates[imgIndex] || CARD_IMAGE_FALLBACK;
  const name = safeText(player.name, "Unknown Player");
  const club = safeText(player.club || player.team, "Fantasy FC");
  const league = safeText(player.league, "Premier League");
  const position = safeText(player.position, "POS").toUpperCase();
  const season = safeText(player.season, "2026-27");
  const serial = `${Number(player.serial || 1)}/${Number(player.maxSupply || 100)}`;
  const status = player.competitionEligible ? "Eligible" : "Training";

  const onMove = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setTilt({
      ry: (x - 0.5) * 10,
      rx: (0.5 - y) * 8,
      mx: Math.round(x * 100),
      my: Math.round(y * 100),
    });
  };

  const resetTilt = () => setTilt({ rx: 0, ry: 0, mx: 50, my: 20 });

  return (
    <div className={`relative inline-flex [perspective:1200px] ${className}`}>
      <style>{`
        @keyframes fantasyContainedFoil { 0% { transform: translateX(-130%) rotate(14deg); opacity: 0; } 28% { opacity: .38; } 100% { transform: translateX(130%) rotate(14deg); opacity: 0; } }
        @keyframes fantasyContainedReveal { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <article
        onPointerMove={onMove}
        onPointerLeave={resetTilt}
        className={`relative h-[360px] w-[252px] overflow-hidden rounded-[30px] bg-gradient-to-br ${style.frame} p-[3px] ${style.glow} transition-transform duration-200 ease-out`}
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
          animation: "fantasyContainedReveal .35s ease-out both",
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[27px] bg-black">
          <div className={`absolute inset-0 bg-gradient-to-b ${style.face}`} />
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 1px, transparent 1px, transparent 10px), radial-gradient(circle at 50% 16%, rgba(255,255,255,.18), transparent 38%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{ background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,.28), transparent 24%)` }}
          />
          <div className="pointer-events-none absolute inset-0 mix-blend-screen">
            <div className="absolute -left-1/2 top-[-12%] h-[125%] w-[38%] bg-gradient-to-r from-transparent via-white/26 to-transparent" style={{ animation: "fantasyContainedFoil 4s ease-in-out infinite" }} />
          </div>

          <div className="relative z-10 flex h-full flex-col p-3 text-white">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
              <span>{season}</span>
              <span>{teamCode(player)}</span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${style.accent}`}>
                {rarityLabel(rarity)}
              </span>
              <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[9px] font-bold text-white/80">
                {serial}
              </span>
            </div>

            <div className={`relative mt-3 h-[150px] overflow-hidden rounded-[20px] border ${style.line} bg-black/35`}>
              <img
                src={img}
                alt={name}
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  setImgIndex((current) => (current + 1 < candidates.length ? current + 1 : current));
                }}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/55 to-transparent px-3 pb-2 pt-9">
                <div className="truncate text-[18px] font-black uppercase leading-none tracking-tight text-white drop-shadow">
                  {name}
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-[1fr_54px] gap-2">
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/34 px-3 py-2">
                <div className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-white/45">{club}</div>
                <div className="truncate text-[10px] font-semibold text-white/75">{league}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-2 py-2 text-center">
                <div className="text-[8px] font-black uppercase text-white/45">Pos</div>
                <div className="text-[15px] font-black leading-none">{position}</div>
              </div>
            </div>

            <div className="mt-2 rounded-2xl border border-white/10 bg-black/42 p-2">
              <div className="grid grid-cols-5 gap-1.5">
                {last5.map((score, index) => {
                  const height = Math.max(8, Math.min(28, (Number(score || 0) / maxBar) * 28));
                  return (
                    <div key={`${player.id}-${index}`} className="flex flex-col items-center gap-1">
                      <div className="flex h-7 w-full items-end justify-center rounded-md bg-white/8 px-1">
                        <div className="w-full rounded-sm bg-white/55" style={{ height }} />
                      </div>
                      <span className="text-[8px] font-bold text-white/70">{score}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-lg bg-white/8 px-1.5 py-1"><div className="text-[8px] uppercase text-white/45">Avg</div><div className="text-[14px] font-black leading-none">{average}</div></div>
                <div className="rounded-lg bg-white/8 px-1.5 py-1"><div className="text-[8px] uppercase text-white/45">Total</div><div className="text-[14px] font-black leading-none">{total}</div></div>
                <div className="rounded-lg bg-white/8 px-1.5 py-1"><div className="text-[8px] uppercase text-white/45">Use</div><div className="truncate text-[10px] font-black leading-none">{status}</div></div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

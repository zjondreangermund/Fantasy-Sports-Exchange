import { type PlayerCardData } from "./Metal3DCard";
import { useMemo, useState } from "react";
import { CARD_IMAGE_FALLBACK } from "../lib/card-image";

type SimpleCardProps = {
  player: PlayerCardData;
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildStats(player: PlayerCardData) {
  const rating = clamp(Number(player.rating) || 70, 45, 99);
  const pos = String(player.position || "").toUpperCase();
  const atkBias = pos.includes("ST") || pos.includes("FW") ? 8 : pos.includes("MID") ? 4 : -2;
  const defBias = pos.includes("GK") || pos.includes("DEF") ? 9 : pos.includes("MID") ? 3 : -4;

  return [
    ["ATK", Math.max(40, Math.min(99, rating + atkBias))],
    ["VIS", Math.max(38, Math.min(99, Math.round(rating * 0.9)))],
    ["CTL", Math.max(38, Math.min(99, Math.round(rating * 0.94 + 2)))],
    ["DEF", Math.max(35, Math.min(99, rating + defBias))],
    ["ENG", Math.max(40, Math.min(99, Math.round(rating * 0.82 + 12)))],
    ["FRM", Math.max(40, Math.min(99, Math.round(rating * 0.78 + 10)))],
  ] as const;
}

const rarityStyles: Record<PlayerCardData["rarity"], string> = {
  common: "from-zinc-700 to-zinc-900 border-zinc-500/60",
  rare: "from-sky-700 to-slate-900 border-sky-400/70",
  unique: "from-fuchsia-700 to-slate-900 border-fuchsia-400/70",
  epic: "from-violet-700 to-slate-900 border-violet-400/70",
  legendary: "from-amber-600 to-slate-900 border-amber-300/80",
};

export default function SimpleCard({ player, className = "" }: SimpleCardProps) {
  const stats = useMemo(() => buildStats(player), [player]);
  const candidates = useMemo(() => {
    const list = [player.image, ...(player.imageCandidates || []), CARD_IMAGE_FALLBACK]
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(list));
  }, [player.image, player.imageCandidates]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))] || CARD_IMAGE_FALLBACK;

  return (
    <article
      className={`relative w-[220px] max-w-full aspect-[260/364] overflow-hidden rounded-2xl border bg-gradient-to-b ${rarityStyles[player.rarity]} shadow-xl ${className}`}
    >
      {candidates.length > 0 ? (
        <img
          src={src}
          alt={player.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-top"
          onLoad={() => {
            console.info("[SimpleCard] image loaded", {
              id: player.id,
              name: player.name,
              src,
            });
          }}
          onError={() => {
            console.error("[SimpleCard] image failed", {
              id: player.id,
              name: player.name,
              failedSrc: src,
              candidateIndex,
              candidates,
            });
            if (candidateIndex < candidates.length - 1) {
              setCandidateIndex((prev) => prev + 1);
            }
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-700 to-zinc-900" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

      <div className="absolute left-4 top-4 rounded-md bg-black/55 px-2 py-1 text-lg font-black text-white">
        {player.rating}
      </div>
      <div className="absolute right-4 top-4 rounded-md bg-black/55 px-2 py-1 text-sm font-semibold text-zinc-100">
        {player.position}
      </div>

      <div className="absolute bottom-0 w-full p-4 text-white">
        <p className="truncate text-lg font-bold uppercase tracking-wide">{player.name}</p>
        <p className="truncate text-xs text-zinc-300">{player.club || "FantasyFC"}</p>
        <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[10px]">
          {stats.map(([label, value]) => (
            <span key={label} className="text-center">
              <b className="mr-1 text-[9px] text-zinc-300">{label}</b>
              <strong className="font-bold text-white">{value}</strong>
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-300">
          #{String(player.serial || 1).padStart(3, "0")} / {player.maxSupply || 500}
        </p>
      </div>
    </article>
  );
}

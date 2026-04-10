import { useMemo, useState } from "react";
import { type PlayerCardData } from "./Metal3DCard";
import { CARD_IMAGE_FALLBACK } from "../lib/card-image";

type PlainImageCardProps = {
  player: PlayerCardData;
  className?: string;
};

export default function PlainImageCard({ player, className = "" }: PlainImageCardProps) {
  const candidates = useMemo(() => {
    const list = [player.image, ...(player.imageCandidates || []), CARD_IMAGE_FALLBACK]
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(list));
  }, [player.image, player.imageCandidates]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))] || CARD_IMAGE_FALLBACK;

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-xl border border-white/20 bg-zinc-900 ${className}`}>
      <img
        src={src}
        alt={player.name}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        onLoad={() => {
          console.info("[PlainImageCard] image loaded", {
            id: player.id,
            name: player.name,
            src,
          });
        }}
        onError={() => {
          console.error("[PlainImageCard] image failed", {
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
      <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-xs text-white">
        <div className="font-semibold truncate">{player.name}</div>
        <div className="text-zinc-300">{player.position} • {player.rating}</div>
      </div>
    </div>
  );
}

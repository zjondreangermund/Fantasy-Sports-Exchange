import React from "react";
import type { PlayerCardData, Rarity } from "./Metal3DCard";

type CollectionPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
};

const rarityBadgeStyles: Record<Rarity, { label: string; background: string; border: string }> = {
  common: {
    label: "COMMON",
    background: "rgba(205, 213, 225, 0.16)",
    border: "rgba(226, 232, 240, 0.24)",
  },
  rare: {
    label: "RARE",
    background: "rgba(96, 165, 250, 0.22)",
    border: "rgba(147, 197, 253, 0.34)",
  },
  unique: {
    label: "UNIQUE",
    background: "rgba(45, 212, 191, 0.24)",
    border: "rgba(94, 234, 212, 0.34)",
  },
  epic: {
    label: "EPIC",
    background: "rgba(168, 85, 247, 0.22)",
    border: "rgba(196, 181, 253, 0.34)",
  },
  legendary: {
    label: "LEGENDARY",
    background: "rgba(250, 204, 21, 0.22)",
    border: "rgba(253, 224, 71, 0.34)",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeTinyStats(player: PlayerCardData) {
  const rating = clamp(Number(player.rating) || 70, 45, 99);
  const level = clamp(Number(player.level) || Math.round((rating - 40) * 0.8), 1, 99);
  const position = String(player.position || "").toUpperCase();
  const defensive = clamp(
    Math.round(rating + (position.includes("DEF") || position.includes("GK") ? 5 : -2)),
    30,
    99,
  );
  const speed = clamp(Math.round(rating * 3.9 + 15), 120, 420);

  return {
    level,
    defensive,
    speed,
  };
}

function useResolvedImage(player: PlayerCardData) {
  const candidates = React.useMemo(() => {
    const merged = [player.image, ...(player.imageCandidates || [])].filter(
      (entry): entry is string => Boolean(String(entry || "").trim()),
    );
    return Array.from(new Set(merged));
  }, [player.image, player.imageCandidates]);

  const [imageIndex, setImageIndex] = React.useState(0);

  React.useEffect(() => {
    setImageIndex(0);
  }, [player.id, candidates.join("|")]);

  const src = candidates[imageIndex] || "/images/player-1.png";
  const onImageError = () => {
    setImageIndex((prev) => (prev >= candidates.length - 1 ? prev : prev + 1));
  };

  return { src, onImageError };
}

export default function CollectionPlayerCard({ player, className = "" }: CollectionPlayerCardProps) {
  const rarity = rarityBadgeStyles[player.rarity];
  const stats = computeTinyStats(player);
  const { src, onImageError } = useResolvedImage(player);

  return (
    <article
      className={[
        "player-card relative w-[145px] aspect-[0.7/1] overflow-hidden rounded-[22px] select-none",
        className,
      ].join(" ")}
      style={{
        background:
          "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.10), transparent 18%), radial-gradient(circle at 70% 30%, rgba(90,140,255,0.12), transparent 30%), linear-gradient(180deg, #0a1020 0%, #05070d 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -16px 40px rgba(0,0,0,0.45), 0 14px 32px rgba(0,0,0,0.45)",
      }}
    >
      <div className="card-reflection reflection-1" />
      <div className="card-reflection reflection-2" />
      <div className="card-reflection reflection-3" />

      <div className="card-top absolute top-3 left-3 right-3 z-[3] flex items-start justify-between">
        <div className="rating-block">
          <div className="rating text-[30px] leading-none font-extrabold text-white">{player.rating}</div>
          <div className="position mt-0.5 text-[11px] font-bold tracking-[0.08em] text-white/85">{player.position}</div>
        </div>
        <div
          className="rarity-badge rounded-full px-2 py-1 text-[9px] font-extrabold tracking-[0.1em] text-white"
          style={{
            background: rarity.background,
            border: `1px solid ${rarity.border}`,
          }}
        >
          {rarity.label}
        </div>
      </div>

      <div className="player-image-wrap absolute left-[12%] right-[12%] top-[22%] bottom-[24%] z-[2] flex items-center justify-center pointer-events-none">
        <img
          className="player-image max-h-full max-w-full object-contain"
          src={src}
          alt={player.name}
          loading="lazy"
          decoding="async"
          onError={onImageError}
          style={{
            filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.45)) saturate(1.05) contrast(1.03)",
            opacity: 0.96,
          }}
        />
      </div>

      <div className="absolute inset-0 z-[3] bg-[linear-gradient(170deg,rgba(255,255,255,0.12)_2%,transparent_24%,transparent_70%,rgba(255,255,255,0.05)_100%)] mix-blend-screen pointer-events-none" />

      <div className="card-stats absolute left-3 right-3 bottom-[34px] z-[3] flex justify-center gap-2 text-[8px] font-bold text-white/75">
        <span>LV {stats.level}</span>
        <span>DF {stats.defensive}</span>
        <span>SPD {stats.speed}</span>
      </div>

      <div className="card-bottom absolute left-3 right-3 bottom-3 z-[3] text-center">
        <div className="player-name truncate text-[12px] leading-[1.05] font-extrabold uppercase text-white">{player.name}</div>
        <div className="club-name mt-0.5 truncate text-[8px] uppercase tracking-[0.08em] text-white/60">{player.club || player.team || "Fantasy FC"}</div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-14px_22px_rgba(0,0,0,0.26)]" />

      <style>{`
        .player-card .card-reflection {
          position: absolute;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.18) 32%, transparent 70%);
          filter: blur(1px);
          pointer-events: none;
          z-index: 4;
        }

        .player-card .reflection-1 {
          width: 16px;
          height: 16px;
          top: 16px;
          left: 62%;
        }

        .player-card .reflection-2 {
          width: 24px;
          height: 24px;
          top: 92px;
          left: 46%;
        }

        .player-card .reflection-3 {
          width: 18px;
          height: 18px;
          top: 122px;
          left: 48%;
        }
      `}</style>
    </article>
  );
}
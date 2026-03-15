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
    const normalizedName = String(player.name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const playerId = Number(player.id || 0);
    const fallbackIndex = playerId > 0 ? ((playerId - 1) % 6) + 1 : 1;

    const additional = [
      normalizedName ? `/Players/${normalizedName}.png` : "",
      normalizedName ? `/Players/${normalizedName}.webp` : "",
      `/images/player-${fallbackIndex}.png`,
      "/players/fallback.png",
    ].filter(Boolean);

    return Array.from(new Set([...merged, ...additional]));
  }, [player.id, player.image, player.imageCandidates, player.name]);

  const [imageIndex, setImageIndex] = React.useState(0);

  React.useEffect(() => {
    setImageIndex(0);
  }, [player.id, candidates.join("|")]);

  const src = candidates[imageIndex] || "/players/fallback.png";
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
        "player-card relative w-[150px] aspect-[0.7/1] overflow-hidden rounded-[24px] select-none",
        className,
      ].join(" ")}
      style={{
        background:
          "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.10), transparent 28%), radial-gradient(circle at 20% 15%, rgba(75,120,255,0.10), transparent 24%), linear-gradient(180deg, #08111f 0%, #03060c 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -18px 30px rgba(0,0,0,0.45), 0 16px 28px rgba(0,0,0,0.35), 0 0 0 1px rgba(114,164,255,0.10)",
      }}
    >
      <div className="card-gloss" />
      <div className="shine shine-1" />
      <div className="shine shine-2" />
      <div className="shine shine-3" />

      <div className="card-header absolute top-3 left-3 right-3 z-[4] flex items-start justify-between">
        <div>
          <div className="rating text-[30px] font-black leading-none tracking-[-0.03em] text-white">{player.rating}</div>
          <div className="position mt-[3px] text-[11px] font-bold tracking-[0.08em] text-white/90">{player.position}</div>
        </div>
        <div
          className="rarity-badge rounded-full px-[10px] py-[5px] text-[9px] font-extrabold tracking-[0.12em] text-white"
          style={{
            background: rarity.background,
            border: `1px solid ${rarity.border}`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
            backdropFilter: "blur(8px)",
          }}
        >
          {rarity.label}
        </div>
      </div>

      <div className="player-art-wrap absolute left-[16%] right-[16%] top-[24%] h-[36%] z-[2] flex items-center justify-center pointer-events-none">
        <img
          className="player-art max-h-full max-w-full object-contain"
          src={src}
          alt={player.name}
          loading="lazy"
          decoding="async"
          onError={onImageError}
          style={{
            filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.45)) saturate(1.06) contrast(1.04)",
            opacity: 0.96,
          }}
        />
      </div>

      <div className="card-meta absolute left-[10px] right-[10px] bottom-3 z-[4] text-center">
        <div className="stats-row flex justify-center gap-[10px] whitespace-nowrap text-[9px] leading-none text-white/80">
          <span>
            <b className="mr-0.5 font-extrabold text-white/55">LV</b>
            <span className="font-bold text-white/90">{stats.level}</span>
          </span>
          <span>
            <b className="mr-0.5 font-extrabold text-white/55">DE</b>
            <span className="font-bold text-white/90">{stats.defensive}</span>
          </span>
          <span>
            <b className="mr-0.5 font-extrabold text-white/55">SPD</b>
            <span className="font-bold text-white/90">{stats.speed}</span>
          </span>
        </div>

        <div className="player-name mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-black uppercase text-white" title={player.name}>
          {player.name}
        </div>
        <div className="club-name mt-[3px] truncate text-[8px] uppercase tracking-[0.10em] text-white/60">{player.club || player.team || "Fantasy FC"}</div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-[24px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-16px_24px_rgba(0,0,0,0.34)]" />

      <style>{`
        .player-card::before {
          content: "";
          position: absolute;
          inset: 1px;
          border-radius: inherit;
          background: linear-gradient(
            125deg,
            rgba(255,255,255,0.10) 0%,
            rgba(255,255,255,0.02) 18%,
            rgba(255,255,255,0.00) 42%
          );
          pointer-events: none;
          z-index: 3;
        }

        .player-card .card-gloss {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(115deg, rgba(255,255,255,0.08) 8%, rgba(255,255,255,0.03) 18%, transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,0.04), transparent 30%);
          pointer-events: none;
          z-index: 3;
        }

        .player-card .shine {
          position: absolute;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.20) 35%, transparent 72%);
          pointer-events: none;
          z-index: 2;
        }

        .player-card .shine-1 {
          width: 14px;
          height: 14px;
          top: 20px;
          left: 68%;
        }

        .player-card .shine-2 {
          width: 24px;
          height: 24px;
          top: 92px;
          left: 42%;
        }

        .player-card .shine-3 {
          width: 18px;
          height: 18px;
          top: 122px;
          left: 48%;
        }
      `}</style>
    </article>
  );
}
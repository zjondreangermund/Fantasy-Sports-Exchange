import { memo } from "react";
import { Shield } from "lucide-react";
import Metal3DCard from "./Metal3DCard";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

type CardThumbnailProps = {
  card: PlayerCardWithPlayer;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
};

const raritySelectedRing: Record<string, string> = {
  common: "ring-white/25",
  rare: "ring-[#45a2ff]/45",
  unique: "ring-[#b154ff]/45",
  epic: "ring-[#ffc246]/45",
  legendary: "ring-[#ff9123]/50",
};

function CardThumbnailBase({
  card,
  size = "md",
  selected = false,
  selectable = false,
  onClick,
  showPrice = false,
}: CardThumbnailProps) {
  const rarity = String(card.rarity || "common").toLowerCase();
  const selectedRing = raritySelectedRing[rarity] || raritySelectedRing.common;
  const player = card.player || ({} as any);
  const fantasyCard = toFantasyCardData(card);

  const frame =
    size === "sm"
      ? "!w-[168px]"
      : size === "lg"
        ? "!w-[240px]"
        : "!w-[208px]";

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        className={`relative ${selectable ? "cursor-pointer" : "cursor-default"} ${selected ? `ring-2 rounded-[24px] ${selectedRing}` : ""}`}
        data-testid={`card-thumbnail-${card.id}`}
      >
        <Metal3DCard player={fantasyCard} className={frame} />
        {selected && (
          <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Shield className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {showPrice && Number(card.price || 0) > 0 ? (
        <p className="mt-2 text-center text-[11px] font-bold text-emerald-300">N${Number(card.price || 0).toFixed(2)}</p>
      ) : null}
      <p className="mt-1 max-w-[220px] truncate text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
        {String(player?.position || "N/A").toUpperCase()}
        {player?.team ? ` • ${String(player.team).toUpperCase()}` : ""}
      </p>
    </div>
  );
}

const CardThumbnail = memo(CardThumbnailBase);

export default CardThumbnail;

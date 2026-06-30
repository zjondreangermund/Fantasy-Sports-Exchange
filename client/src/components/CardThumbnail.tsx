import { memo } from "react";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { PremiumFootballCard } from "./cards";

type CardThumbnailProps = {
  card: PlayerCardWithPlayer;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
};

function CardThumbnailBase({
  card,
  size = "md",
  selected = false,
  selectable = false,
  onClick,
  showPrice = false,
}: CardThumbnailProps) {
  const player = card.player || ({} as any);
  const fantasyCard = toFantasyCardData(card, { imageWidth: size === "lg" ? 640 : 420 });

  return (
    <div className="relative inline-flex flex-col items-center">
      <PremiumFootballCard
        player={fantasyCard}
        size={size}
        selected={selected}
        onClick={onClick}
        interactive={selectable || Boolean(onClick)}
        showPrice={showPrice}
      />

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

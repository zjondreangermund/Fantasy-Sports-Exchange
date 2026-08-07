import { memo } from "react";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { PremiumFootballCard } from "./cards";

type CardThumbnailProps = {
  card: PlayerCardWithPlayer;
  size?: "xs" | "sm" | "md" | "lg";
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
  const fantasyCard = toFantasyCardData(card, { imageWidth: size === "lg" ? 640 : size === "xs" ? 280 : 420 });

  return (
    <div className="relative inline-flex max-w-full flex-col items-center">
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
      <p className={`${size === "xs" ? "max-w-[96px] text-[8px] tracking-[0.1em]" : "max-w-[220px] text-[10px] tracking-[0.18em]"} mt-1 truncate text-center font-semibold uppercase text-white/60`}>
        {String(player?.position || "N/A").toUpperCase()}
        {player?.team ? ` • ${String(player.team).toUpperCase()}` : ""}
      </p>
    </div>
  );
}

const CardThumbnail = memo(CardThumbnailBase);

export default CardThumbnail;

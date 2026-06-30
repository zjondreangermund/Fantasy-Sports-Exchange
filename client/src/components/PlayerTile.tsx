import { memo } from "react";
import { PremiumFootballCard } from "./cards";
import { type PlayerCardData } from "./cards/types";

type PlayerTileProps = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

function PlayerTileBase({ player, selected = false, onClick, showPrice = false, className = "", size = "sm" }: PlayerTileProps) {
  return (
    <PremiumFootballCard
      player={player}
      selected={selected}
      onClick={onClick}
      showPrice={showPrice}
      className={className}
      size={size}
    />
  );
}

const PlayerTile = memo(PlayerTileBase);
export default PlayerTile;

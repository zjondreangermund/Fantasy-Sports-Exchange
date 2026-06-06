import UnifiedPlayerCard from "./cards/UnifiedPlayerCard";
import { type PlayerCardData } from "./cards/types";

type CollectionPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  size?: "sm" | "md" | "lg";
};

const EMPTY_PLAYER: PlayerCardData = {
  id: "empty-player-card",
  name: "Unknown Player",
  position: "N/A",
  rating: 0,
  rarity: "common",
  serial: 0,
  maxSupply: 0,
};

export default function CollectionPlayerCard({
  player,
  className = "",
  selected = false,
  onClick,
  size = "md",
}: CollectionPlayerCardProps) {
  const card = player || EMPTY_PLAYER;

  return (
    <button
      type="button"
      onClick={onClick}
      className={onClick ? "cursor-pointer" : "cursor-default"}
      data-testid={`collection-v3-card-${card.id}`}
    >
      <UnifiedPlayerCard
        player={card}
        size={size}
        variant={size === "lg" ? "showcase" : "default"}
        selected={selected}
        interactive={Boolean(onClick)}
        className={className}
      />
    </button>
  );
}

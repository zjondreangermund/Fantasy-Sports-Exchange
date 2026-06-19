import PremiumFootballCard from "./PremiumFootballCard";
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
  showPrice = false,
  size = "md",
}: CollectionPlayerCardProps) {
  const card = player || EMPTY_PLAYER;

  return (
    <PremiumFootballCard
      player={card}
      selected={selected}
      onClick={onClick}
      showPrice={showPrice}
      size={size}
      className={className}
    />
  );
}

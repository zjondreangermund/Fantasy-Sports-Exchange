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
  const isShowcase = size === "lg";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`premium-card-button group relative ${onClick ? "cursor-pointer" : "cursor-default"}`}
      data-testid={`collection-v3-card-${card.id}`}
      aria-label={`${card.name || "Player"} card`}
    >
      {isShowcase ? (
        <div className="relative flex flex-col items-center">
          <div className="absolute -top-6 h-24 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-10 h-10 w-48 rounded-full bg-black/50 blur-2xl" />
          <UnifiedPlayerCard
            player={card}
            size={size}
            variant="showcase"
            selected={selected}
            interactive={Boolean(onClick)}
            className={`premium-card-stage relative z-10 transition-transform duration-500 group-hover:-translate-y-2 ${className}`.trim()}
          />
          <div className="-mt-4 h-12 w-36 rounded-full bg-white/10 blur-md opacity-70" />
        </div>
      ) : (
        <UnifiedPlayerCard
          player={card}
          size={size}
          variant="default"
          selected={selected}
          interactive={Boolean(onClick)}
          className={`premium-card-stage ${className}`.trim()}
        />
      )}
    </button>
  );
}

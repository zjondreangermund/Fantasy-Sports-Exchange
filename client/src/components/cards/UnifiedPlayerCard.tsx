import PremiumFootballCard from "../PremiumFootballCard";
import { type PlayerCardData } from "./types";

type Props = {
  player: PlayerCardData;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: string;
  selected?: boolean;
  interactive?: boolean;
};

function resolveSize(size: Props["size"], variant?: string): "sm" | "md" | "lg" {
  if (variant === "compact") return "sm";
  if (variant === "showcase") return "lg";
  return size || "md";
}

export default function UnifiedPlayerCard({
  player,
  className = "",
  size = "md",
  variant = "default",
  selected = false,
  interactive = false,
}: Props) {
  const showPrice = Boolean(
    player.forSale ||
      player.listed ||
      Number(player.price || player.listedPrice || 0) > 0,
  );

  return (
    <div className={className} data-card-engine="premium-football-card">
      <PremiumFootballCard
        player={player}
        size={resolveSize(size, variant)}
        selected={selected}
        showPrice={showPrice}
        className={interactive ? "cursor-pointer" : ""}
      />
    </div>
  );
}

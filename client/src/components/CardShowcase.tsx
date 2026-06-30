import { memo } from "react";
import { PremiumFootballCard } from "./cards";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

type CardShowcaseProps = {
  card: PlayerCardWithPlayer;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  sorareImageUrl?: string | null;
  withSpotlight?: boolean;
};

function CardShowcaseBase({
  withSpotlight = true,
  card,
  onClick,
  size = "md",
  selected = false,
  showPrice = false,
}: CardShowcaseProps) {
  const player = toFantasyCardData(card, { imageWidth: 640 });

  return (
    <div className="relative inline-flex flex-col items-center justify-center px-2 pb-6 pt-4">
      {withSpotlight ? (
        <div className="pointer-events-none absolute left-1/2 top-[42%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300/14 blur-2xl" />
      ) : null}

      <PremiumFootballCard
        player={player}
        selected={selected}
        onClick={onClick}
        showPrice={showPrice}
        size={size}
      />

      <div className="pointer-events-none absolute bottom-0 h-7 w-[80%] rounded-full bg-black/45 blur-xl" />
    </div>
  );
}

const CardShowcase = memo(CardShowcaseBase);
export default CardShowcase;

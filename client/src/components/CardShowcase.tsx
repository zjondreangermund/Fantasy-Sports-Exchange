import { memo } from "react";
import PlayerTile from "./PlayerTile";
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

function getSizeClass(size: CardShowcaseProps["size"]) {
  if (size === "sm") return "!h-[218px] !w-[156px]";
  if (size === "lg") return "!h-[252px] !w-[186px]";
  return "";
}

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
        <div className="pointer-events-none absolute left-1/2 top-[42%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/12 blur-2xl" />
      ) : null}

      <PlayerTile
        player={player}
        selected={selected}
        onClick={onClick}
        showPrice={showPrice}
        className={getSizeClass(size)}
      />

      <div className="pointer-events-none absolute bottom-0 h-7 w-[80%] rounded-full bg-black/45 blur-xl" />
    </div>
  );
}

const CardShowcase = memo(CardShowcaseBase);
export default CardShowcase;

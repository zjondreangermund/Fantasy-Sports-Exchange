import { memo } from "react";
import UnifiedPlayerCard from "./cards/UnifiedPlayerCard";
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
  if (size === "sm") return "scale-[0.9]";
  if (size === "lg") return "scale-[1.08]";
  return "scale-100";
}

function CardShowcaseBase({
  withSpotlight = true,
  card,
  onClick,
  size = "md",
}: CardShowcaseProps) {
  const mainCard = toFantasyCardData(card, { imageWidth: 512 });

  return (
    <div className="relative inline-flex flex-col items-center justify-center px-2 pb-8 pt-6">
      {withSpotlight ? (
        <>
          <div className="showcase-spotlight absolute left-1/2 top-[42%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/14 blur-2xl" />
          <div className="showcase-spotlight absolute left-1/2 top-[44%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200/10 blur-2xl" />
        </>
      ) : null}

      <button type="button" onClick={onClick} className={`text-left ${getSizeClass(size)}`}>
        <UnifiedPlayerCard player={mainCard} />
      </button>

      <div className="pointer-events-none absolute bottom-0 h-8 w-[80%] rounded-full bg-black/45 blur-xl" />
    </div>
  );
}

const CardShowcase = memo(CardShowcaseBase);

export default CardShowcase;
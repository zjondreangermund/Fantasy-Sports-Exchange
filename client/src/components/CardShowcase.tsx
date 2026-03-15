import { memo } from "react";
import CollectionPlayerCard from "./CollectionPlayerCard";
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

function CardShowcaseBase({ withSpotlight = true, card, onClick }: CardShowcaseProps) {
  const player = card.player;
  const mainCard = toFantasyCardData(card, { imageWidth: 320 });

  return (
    <div className="relative inline-flex flex-col items-center justify-center px-2 pb-8 pt-6" onClick={onClick}>
      {withSpotlight && (
        <>
          <div className="showcase-spotlight absolute left-1/2 top-[42%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/14 blur-2xl" />
          <div className="showcase-spotlight absolute left-1/2 top-[44%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200/10 blur-2xl" />
        </>
      )}

      <button type="button" onClick={onClick} className="text-left">
        <CollectionPlayerCard player={mainCard} className="!w-[150px]" />
      </button>

      <div className="relative z-10 mt-2 rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-center backdrop-blur-sm">
        <p className="text-xs font-bold tracking-[0.12em] text-white/80">{String(card.rarity || "common").toUpperCase()}</p>
        <p className="max-w-[200px] truncate text-sm font-extrabold text-white">{player?.name || "Unknown Player"}</p>
      </div>
      <div className="pointer-events-none absolute bottom-0 h-8 w-[80%] rounded-full bg-black/45 blur-xl" />
    </div>
  );
}

const CardShowcase = memo(CardShowcaseBase);

export default CardShowcase;

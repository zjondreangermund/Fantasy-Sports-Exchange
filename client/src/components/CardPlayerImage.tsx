import { memo, useMemo, useState } from "react";
import { buildCardImageCandidates, CARD_IMAGE_FALLBACK } from "../lib/card-image";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

type CardPlayerImageProps = {
  card: PlayerCardWithPlayer;
  alt: string;
  className?: string;
  thumb?: boolean;
};

function CardPlayerImageBase({ card, alt, className, thumb = true }: CardPlayerImageProps) {
  const candidates = useMemo(
    () => buildCardImageCandidates(card, { thumb, width: thumb ? 256 : 720, format: "webp" }),
    [card, thumb],
  );
  const [index, setIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const src = candidates[index] || CARD_IMAGE_FALLBACK;

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-900/80">
      {!isLoaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-slate-700/30 to-slate-950/75" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        className={className || "h-full w-full object-cover"}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (index < candidates.length - 1) {
            setIndex((prev) => prev + 1);
            return;
          }
          setIsLoaded(true);
        }}
      />
    </div>
  );
}

const CardPlayerImage = memo(CardPlayerImageBase);

export default CardPlayerImage;

import { useMemo, useState } from "react";
import Metal3DCard, { type PlayerCardData } from "./Metal3DCard";

type FantasyCardFanProps = {
  cards: PlayerCardData[];
  className?: string;
  maxCards?: number;
};

function fanTransform(index: number, count: number) {
  const center = (count - 1) / 2;
  const distance = index - center;
  const absDistance = Math.abs(distance);

  const translateX = distance * 68;
  const translateY = absDistance * 12;
  const rotateZ = distance * 8;
  const rotateX = -4 - absDistance * 0.8;
  const depth = 40 - absDistance * 8;

  return {
    translateX,
    translateY,
    rotateZ,
    rotateX,
    depth,
    layer: Math.round(100 - absDistance * 10),
  };
}

export default function FantasyCardFan({ cards, className, maxCards = 4 }: FantasyCardFanProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const visibleCards = useMemo(() => cards.slice(0, Math.max(1, maxCards)), [cards, maxCards]);

  return (
    <section className={["fantasy-card-fan", className || ""].join(" ")} aria-label="Featured card stack">
      <ul className="fantasy-card-fan__list" role="list">
        {visibleCards.map((card, index) => {
          const { translateX, translateY, rotateZ, rotateX, depth, layer } = fanTransform(index, visibleCards.length);
          const isHovered = hoveredIndex === index;

          return (
            <li
              key={`${card.id}-${index}`}
              className="fantasy-card-fan__item"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                transform: `translate3d(${translateX}px, ${translateY}px, ${depth}px) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg)`,
                zIndex: isHovered ? 300 : layer,
              }}
            >
              <Metal3DCard player={card} className="!w-[200px] sm:!w-[220px]" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

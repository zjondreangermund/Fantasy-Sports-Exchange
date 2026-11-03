import { memo, useMemo } from "react";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";
import { toFantasyCardData } from "../../lib/fantasy-card-adapter";
import CollectionStableCard from "./CollectionStableCard";

type Props = {
  card: PlayerCardWithPlayer;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
};

/**
 * The collection endpoint already returns verified API-Football identities,
 * portraits, rarity and current scores for every owned card in one response.
 *
 * Rendering ten cards should NOT create ten additional /api/cards/:id/profile
 * requests. The full profile remains available on demand in CardProfileModal.
 * This uses the exact same stable card visual as before, with the globally
 * approved cutout -> original official photo fallback in CollectionStableCard.
 */
function CollectionProfileCard({
  card,
  selected = false,
  onClick,
  showPrice = false,
}: Props) {
  const fantasyCard = useMemo(() => toFantasyCardData(card, { imageWidth: 900 }), [card]);

  return (
    <CollectionStableCard
      player={fantasyCard}
      selected={selected}
      onClick={onClick}
      showPrice={showPrice}
      size="sm"
    />
  );
}

export default memo(CollectionProfileCard);

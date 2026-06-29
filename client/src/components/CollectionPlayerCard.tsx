import { type PlayerCardWithPlayer } from "../../../shared/schema";
import Card3D from "./Card3D";
import PremiumFootballCard from "./PremiumFootballCard";
import { normalizeRarity, RARITY_THEME, type CardSize } from "./premium-card-theme";

export interface CollectionPlayerCardProps {
  card: PlayerCardWithPlayer;
  size?: CardSize;
  selected?: boolean;
  selectable?: boolean;
  showActions?: boolean;
  showBuy?: boolean;
  imageUrl?: string | null;
  sorareImageUrl?: string | null;
  onClick?: () => void;
  onBuy?: (card: PlayerCardWithPlayer) => void;
  onSell?: (card: PlayerCardWithPlayer) => void;
  onLoan?: (card: PlayerCardWithPlayer) => void;
  className?: string;
}

export default function CollectionPlayerCard({
  card,
  size = "md",
  selected = false,
  selectable = false,
  showActions = true,
  showBuy = false,
  imageUrl,
  sorareImageUrl,
  onClick,
  onBuy,
  onSell,
  onLoan,
  className = "",
}: CollectionPlayerCardProps) {
  const rarity = normalizeRarity((card as { rarity?: string }).rarity);
  const theme = RARITY_THEME[rarity];
  const img = sorareImageUrl ?? imageUrl;

  const handleCardClick = selectable || onClick ? onClick : undefined;

  const stopProp = (e: React.MouseEvent, fn?: () => void) => {
    e.stopPropagation();
    fn?.();
  };

  return (
    <div
      className={`collection-player-card flex flex-col items-center gap-2 w-full max-w-[200px] mx-auto ${className}`}
      data-selected={selected || undefined}
      data-selectable={selectable || undefined}
    >
      <div
        className={`collection-player-card__card-wrap relative ${
          selected ? "collection-player-card__card-wrap--selected" : ""
        } ${selectable ? "cursor-pointer" : ""}`}
      >
        {selected && (
          <div className="collection-player-card__selected-ring" aria-hidden />
        )}

        <Card3D onClick={handleCardClick} disabled={!handleCardClick && !showActions}>
          <PremiumFootballCard card={card} size={size} imageUrl={img} />
        </Card3D>
      </div>

      {showActions && (
        <div
          className={`collection-player-card__actions grid gap-1.5 w-full px-0.5 ${
            showBuy ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          {showBuy && (
            <button
              type="button"
              className="collection-player-card__action"
              style={{ borderColor: theme.actionBorder, color: theme.actionText }}
              onClick={(e) => stopProp(e, () => onBuy?.(card))}
              data-testid={`button-buy-${card.id}`}
            >
              BUY
            </button>
          )}
          <button
            type="button"
            className="collection-player-card__action"
            style={{ borderColor: theme.actionBorder, color: theme.actionText }}
            onClick={(e) => stopProp(e, () => onSell?.(card))}
            data-testid={`button-sell-${card.id}`}
          >
            SELL
          </button>
          <button
            type="button"
            className="collection-player-card__action"
            style={{ borderColor: theme.actionBorder, color: theme.actionText }}
            onClick={(e) => stopProp(e, () => onLoan?.(card))}
            data-testid={`button-loan-${card.id}`}
          >
            LOAN
          </button>
        </div>
      )}
    </div>
  );
}

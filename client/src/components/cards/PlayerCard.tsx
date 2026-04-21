import UnifiedPlayerCard from "./UnifiedPlayerCard";
import { toFantasyCardData } from "../../lib/fantasy-card-adapter";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";

export type MarketplaceCardData = ReturnType<typeof mapMarketplaceListingToCard>;

export function mapMarketplaceListingToCard(card: PlayerCardWithPlayer) {
  const mapped = toFantasyCardData(card, { imageWidth: 512 });

  return {
    ...mapped,
    seller: card.ownerUsername || card.ownerName || "FantasyFC",
    rawCard: card,
  };
}

type MarketplaceCardProps = {
  player: MarketplaceCardData;
  onCardClick?: () => void;
  onDetails?: () => void;
  onToggleWatchlist?: () => void;
  isWatched?: boolean;
};

export function MarketplaceCard({
  player,
  onCardClick,
  onDetails,
  onToggleWatchlist,
  isWatched = false,
}: MarketplaceCardProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button type="button" onClick={onCardClick} className="text-left">
        <UnifiedPlayerCard player={player} />
      </button>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDetails}
          className="text-sm font-semibold text-white/80 hover:text-white"
        >
          Details
        </button>
        <button
          type="button"
          onClick={onToggleWatchlist}
          className="text-sm font-semibold text-white/70 hover:text-white"
          aria-label="Toggle watchlist"
        >
          {isWatched ? "★ Saved" : "☆ Save"}
        </button>
      </div>

      <div className="text-center text-sm text-white/45">
        Seller: {player.seller}
      </div>
      <div className="text-center text-[18px] font-black text-emerald-400">
        N${Number(player.price || 0).toFixed(2)}
      </div>
    </div>
  );
}

type MarketplaceCardGridProps = {
  players: MarketplaceCardData[];
  onCardClick?: (player: MarketplaceCardData) => void;
  onDetails?: (player: MarketplaceCardData) => void;
  onToggleWatchlist?: (player: MarketplaceCardData) => void;
  watchedIds?: number[];
};

export function MarketplaceCardGrid({
  players,
  onCardClick,
  onDetails,
  onToggleWatchlist,
  watchedIds = [],
}: MarketplaceCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {players.map((player) => (
        <MarketplaceCard
          key={player.id}
          player={player}
          onCardClick={onCardClick ? () => onCardClick(player) : undefined}
          onDetails={onDetails ? () => onDetails(player) : undefined}
          onToggleWatchlist={onToggleWatchlist ? () => onToggleWatchlist(player) : undefined}
          isWatched={watchedIds.includes(Number(player.id))}
        />
      ))}
    </div>
  );
}
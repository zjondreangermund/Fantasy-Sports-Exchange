import UnifiedPlayerCard from "./UnifiedPlayerCard";
import { toFantasyCardData } from "../../lib/fantasy-card-adapter";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";

export type MarketplaceCardData = ReturnType<typeof mapMarketplaceListingToCard>;

export function mapMarketplaceListingToCard(card: PlayerCardWithPlayer) {
  const mapped = toFantasyCardData(card, { imageWidth: 512 });

  return {
    ...mapped,
    // Important: marketplace.tsx compares this id to the DB card id.
    // Keep it numeric here so buy/details/cancel actions keep the original card route.
    id: Number(card.id) as any,
    price: Number(card.price || mapped.price || 0),
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
  const price = Number(player.price || 0);

  return (
    <div className="group flex flex-col items-center gap-3 rounded-[28px] border border-white/10 bg-black/20 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:border-emerald-300/35 hover:bg-black/30">
      <button type="button" onClick={onCardClick} className="text-left transition group-hover:scale-[1.015]">
        <UnifiedPlayerCard player={player} />
      </button>

      <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.03] p-3 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Listed Price</div>
        <div className="mt-1 text-[22px] font-black leading-none text-emerald-300 drop-shadow-[0_0_16px_rgba(52,211,153,0.35)]">
          N${price.toFixed(2)}
        </div>
        <div className="mt-1 truncate text-xs text-white/45">Seller: {player.seller}</div>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={onCardClick}
            className="rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500 px-4 py-2 text-sm font-black text-black shadow-[0_10px_24px_rgba(16,185,129,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(16,185,129,0.38)] active:translate-y-0"
          >
            Buy Now
          </button>
          <button
            type="button"
            onClick={onToggleWatchlist}
            className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-sm font-bold text-white/80 transition hover:bg-white/14 hover:text-white"
            aria-label="Toggle watchlist"
          >
            {isWatched ? "★" : "☆"}
          </button>
        </div>

        <button
          type="button"
          onClick={onDetails}
          className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/50 transition hover:text-white"
        >
          View Details
        </button>
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
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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

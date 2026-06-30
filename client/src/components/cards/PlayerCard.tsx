import { PremiumFootballCard } from ".";
import { toFantasyCardData } from "../../lib/fantasy-card-adapter";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";

export type MarketplaceCardData = ReturnType<typeof mapMarketplaceListingToCard>;

export function mapMarketplaceListingToCard(card: PlayerCardWithPlayer) {
  const mapped = toFantasyCardData(card, { imageWidth: 512 });
  const cardId = Number(card.id);

  return {
    ...mapped,
    id: cardId as any,
    cardId,
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

export function MarketplaceCard({ player, onCardClick, onDetails, onToggleWatchlist, isWatched = false }: MarketplaceCardProps) {
  const price = Number(player.price || 0);

  return (
    <div className="group flex flex-col items-center gap-2 rounded-[24px] border border-white/10 bg-black/20 p-2.5 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-sm transition hover:border-emerald-300/35 hover:bg-black/30">
      <button type="button" onClick={onCardClick} className="text-left transition group-hover:scale-[1.012]">
        <PremiumFootballCard player={player} showPrice />
      </button>

      <div className="-mt-1 w-full rounded-[18px] border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.03] px-3 py-2 text-center">
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="min-w-0 text-left">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">Price</div>
            <div className="text-[18px] font-black leading-none text-emerald-300">N${price.toFixed(2)}</div>
            <div className="mt-0.5 truncate text-[10px] text-white/45">{player.seller}</div>
          </div>
          <button type="button" onClick={onToggleWatchlist} className="h-9 rounded-xl border border-white/15 bg-white/8 px-2 text-[10px] font-black text-white/80 transition hover:bg-white/14 hover:text-white">
            {isWatched ? "Saved" : "Save"}
          </button>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <button type="button" onClick={onCardClick} className="rounded-xl bg-gradient-to-r from-emerald-400 via-green-400 to-lime-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_8px_20px_rgba(16,185,129,0.25)] transition hover:-translate-y-0.5 active:translate-y-0">
            Buy
          </button>
          <button type="button" onClick={onDetails} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/60 transition hover:bg-white/8 hover:text-white">
            Info
          </button>
        </div>
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

export function MarketplaceCardGrid({ players, onCardClick, onDetails, onToggleWatchlist, watchedIds = [] }: MarketplaceCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {players.map((player) => (
        <MarketplaceCard
          key={player.cardId || player.id}
          player={player}
          onCardClick={onCardClick ? () => onCardClick(player) : undefined}
          onDetails={onDetails ? () => onDetails(player) : undefined}
          onToggleWatchlist={onToggleWatchlist ? () => onToggleWatchlist(player) : undefined}
          isWatched={watchedIds.includes(Number(player.cardId || player.id))}
        />
      ))}
    </div>
  );
}

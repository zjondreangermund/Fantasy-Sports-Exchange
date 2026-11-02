import {buildFplPlayerIndex} from './fplPlayerIdentity.js';
import {tournamentPlayerPosition} from '../../shared/tournament-position.js';
export function createTournamentPositionResolver(bootstrap: any) {
  const index = buildFplPlayerIndex(bootstrap || {});
  return (player: any, providerPosition?: unknown) => {
    const element = index.resolve(player);
    return tournamentPlayerPosition(element ? index.canonical(element).position : undefined, player?.position, providerPosition);
  };
}
/** Normalize only collectible/card roles, preserving auction prices, bids and IDs. */
export function alignAuctionPositions(payload: any, bootstrap: any): any {
  const positionFor = createTournamentPositionResolver(bootstrap);
  const visit = (item: any): any => {
    if (Array.isArray(item)) return item.map(visit);
    if (!item || typeof item !== 'object') return item;
    const result = {...item};
    if (item.player) result.player = {...item.player, position: positionFor(item.player)};
    if (item.card) result.card = visit(item.card);
    if (item.cards) result.cards = visit(item.cards);
    if (result.card?.player && 'position' in item) result.position = result.card.player.position;
    return result;
  };
  return visit(payload);
}

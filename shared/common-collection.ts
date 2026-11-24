export const COMMON_COLLECTION_CAP = 10;
export type CommonSquadCard = { id: number; position: string; playerId?: number; eligible?: boolean };

// Two disjoint five-card squads: GK/DEF/MID/FWD plus an outfield Utility each.
export function supportsTwoCommonTeams(cards: CommonSquadCard[]): boolean {
  const eligible = cards.filter(card => card.eligible !== false);
  const counts = Object.fromEntries(['GK','DEF','MID','FWD'].map(position =>
    [position, eligible.filter(card => card.position === position).length]));
  return Object.values(counts).every(count => count >= 2)
    && counts.DEF + counts.MID + counts.FWD >= 8;
}

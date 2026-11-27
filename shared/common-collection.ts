import { TOURNAMENT_LINEUP_SLOTS, TOURNAMENT_UTILITY_POSITIONS } from "./game-rules.js";
export const COMMON_COLLECTION_CAP = 10;
export type CommonSquadCard = { id: number; position: string; playerId?: number; name?: string; eligible?: boolean; blocked?: boolean };

// Two disjoint five-card squads: GK/DEF/MID/FWD plus an outfield Utility each.
export function supportsTwoCommonTeams(cards: CommonSquadCard[]): boolean {
  const eligible = cards.filter(card => card.eligible !== false);
  const counts = Object.fromEntries(['GK','DEF','MID','FWD'].map(position =>
    [position, eligible.filter(card => card.position === position).length]));
  return Object.values(counts).every(count => count >= 2)
    && counts.DEF + counts.MID + counts.FWD >= 8;
}

// A fallback is allowed only if the entire verified collection cannot form
// two teams while retaining every protected card. No eligibility bypass for play.
export function canKeepTwoCommonTeams(cards: CommonSquadCard[]): boolean {
  const protectedCards=cards.filter(card=>card.blocked);
  if(protectedCards.length>COMMON_COLLECTION_CAP || protectedCards.some(card=>card.eligible===false))return false;
  const positions=['GK','DEF','MID','FWD'];
  if(protectedCards.some(card=>!positions.includes(card.position)))return false;
  const eligible=cards.filter(card=>card.eligible===true);
  if(!supportsTwoCommonTeams(eligible))return false;
  const protectedCount=(position:string)=>protectedCards.filter(card=>card.position===position).length;
  if(protectedCount('GK')>2)return false;
  return 2+['DEF','MID','FWD'].reduce((sum,position)=>sum+Math.max(2,protectedCount(position)),0)<=COMMON_COLLECTION_CAP;
}

// Same ordered slots used by the tournament lineup builder.
export const COMMON_KEEP_SLOTS = TOURNAMENT_LINEUP_SLOTS;
export function commonKeepSlotAccepts(slot: string, position: string): boolean {
  return slot === 'UTILITY' ? TOURNAMENT_UTILITY_POSITIONS.includes(position as typeof TOURNAMENT_UTILITY_POSITIONS[number]) : slot === position;
}
export function validateCommonKeepTeams(cards: CommonSquadCard[], teams: unknown): string | null {
  if (!Array.isArray(teams) || teams.length !== 2 || teams.some(team => !Array.isArray(team) || team.length !== 5))
    return 'Build two teams of five: GK, DEF, MID, FWD and an outfield Utility.';
  const ids = teams.flat();
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) return `Choose ${ids.filter(id=>Number.isInteger(id)&&id>0).length}/10 cards: fill every empty team slot.`;
  if (new Set(ids).size !== 10)
    return 'Choose ten different cards. A card cannot be reused between teams.';
  for (let team = 0; team < 2; team++) {
    for (let slot = 0; slot < 5; slot++) {
      const card = cards.find(card => Number(card.id) === teams[team][slot]);
      if (!card) return `Team ${team + 1}, ${COMMON_KEEP_SLOTS[slot]}: card #${teams[team][slot]} is no longer in your collection.`;
      if (card.eligible === false) return `Team ${team + 1}, ${COMMON_KEEP_SLOTS[slot]}: ${card.name || `card #${card.id}`} is not eligible for Premier League tournaments. Choose another player.`;
      if (!commonKeepSlotAccepts(COMMON_KEEP_SLOTS[slot], card.position))
        return `Team ${team + 1} needs ${COMMON_KEEP_SLOTS[slot]} in slot ${slot + 1}.`;
    }
  }
  return null;
}

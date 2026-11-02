export type TournamentPosition = 'GK' | 'DEF' | 'MID' | 'FWD';
const valid = new Set<TournamentPosition>(['GK', 'DEF', 'MID', 'FWD']);
/** Fantasy roster position is distinct from a provider's role in a particular match.
 * Keep the official fantasy position, then the stored tournament role; provider
 * position is only a last resort. Never infer a player's role from a lineup slot.
 */
export function tournamentPlayerPosition(official: unknown, stored: unknown, provider?: unknown): TournamentPosition | '' {
  for (const value of [official, stored, provider]) {
    const position = String(value ?? '').trim().toUpperCase() as TournamentPosition;
    if (valid.has(position)) return position;
  }
  return '';
}

export const PRIZE_NOTIFICATION_START_GAMEWEEK = 8;
export function shouldPromptPrizeMint(award: {gameWeek?: number; status?: string; cardId?: number | null}) {
  return Number(award.gameWeek || 0) >= PRIZE_NOTIFICATION_START_GAMEWEEK
    && award.status === "ready_to_mint" && !award.cardId;
}

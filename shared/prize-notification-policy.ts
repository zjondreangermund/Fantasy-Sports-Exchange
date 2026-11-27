// Legacy push-notification retirement cutoff remains unchanged.
export const PRIZE_NOTIFICATION_START_GAMEWEEK = 8;
export function shouldPromptPrizeMint(award: {gameWeek?: number; status?: string; cardId?: number | null; recordedAward?:boolean}) {
  return (award.recordedAward===true || Number(award.gameWeek || 0) >= PRIZE_NOTIFICATION_START_GAMEWEEK)
    && award.status === "ready_to_mint" && !award.cardId;
}
export function shouldPromptLadderCash(award:{kind?:string;prizeLadder?:boolean;status?:string;value?:number;popupAcknowledged?:boolean}) {
  return award.kind==="cash" && award.prizeLadder===true && !award.popupAcknowledged
    && award.status==="credited" && Number.isFinite(award.value) && Number(award.value)>0;
}

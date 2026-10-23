/** An issued prize is permanently bound to one card, including historical awards. */
export function awardedPrizeCardId(entry: any): number {
  const ids = [entry.prizeCardId, entry.settlementAward?.cardId, entry.awardMetadata?.cardId]
    .filter((value) => value != null && value !== "" && Number(value) !== 0)
    .map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("The original prize card reference needs review; no new card was minted");
  }
  if (new Set(ids).size > 1) {
    throw new Error("Prize card references disagree; no new card was minted");
  }
  if (ids.length) return ids[0];
  if (entry.awardStatus === "claimed" || entry.settlementAward?.claimed === true) {
    throw new Error("This prize was already issued; its original card needs review, not another mint");
  }
  return 0;
}

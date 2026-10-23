import { storage } from "../storage.js";

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export async function getCompetitionRewardIntegrity(competitionId: number) {
  if (!Number.isFinite(competitionId) || competitionId <= 0) {
    throw new Error("Invalid competition id");
  }

  const competition = await storage.getCompetition(competitionId);
  if (!competition) {
    throw new Error("Tournament not found");
  }

  const entries = await storage.getCompetitionEntries(competitionId);
  const rows = await Promise.all(
    entries.map(async (entry) => {
      const prizeCardId = Number(entry.prizeCardId || 0);
      const expectedCard = prizeCardId > 0;
      const card = expectedCard ? await storage.getPlayerCard(prizeCardId) : undefined;
      const exists = Boolean(card);
      const ownerMatches = exists && String(card?.ownerId || "") === String(entry.userId || "");
      return {
        entryId: entry.id,
        userId: String(entry.userId || ""),
        rank: Number(entry.rank || 0),
        prizeAmount: toMoney(entry.prizeAmount || 0),
        prizeCardId: expectedCard ? prizeCardId : null,
        expectedCard,
        exists,
        ownerMatches,
        status: !expectedCard ? "no_card_expected" : !exists ? "missing_card" : !ownerMatches ? "owner_mismatch" : "ok",
      };
    }),
  );

  const summary = {
    totalEntries: rows.length,
    expectedCards: rows.filter((row) => row.expectedCard).length,
    missingCards: rows.filter((row) => row.status === "missing_card").length,
    ownerMismatches: rows.filter((row) => row.status === "owner_mismatch").length,
    okCards: rows.filter((row) => row.status === "ok").length,
  };

  return { competitionId, competitionName: competition.name, summary, rows };
}

// PRIZE_REPAIR_NEVER_MINTS_V1: historical rewards are never rerolled by admin repair.
export async function repairCompetitionRewards(competitionId: number) {
  if (!Number.isFinite(competitionId) || competitionId <= 0) {
    throw new Error("Invalid competition id");
  }

  const competition = await storage.getCompetition(competitionId);
  if (!competition) {
    throw new Error("Tournament not found");
  }
  if (competition.status !== "completed") {
    throw new Error("Tournament must be completed before repairing rewards");
  }

  const entries = await storage.getCompetitionEntries(competitionId);
  const repaired: Array<{ entryId: number; userId: string; oldPrizeCardId: number | null; newPrizeCardId: number }> = [];
  const skipped: Array<{ entryId: number; userId: string; reason: string }> = [];

  for (const entry of entries) {
    const rank = Number(entry.rank || 0);
    const prizeCardId = Number(entry.prizeCardId || 0);
    if (rank !== 1 && prizeCardId <= 0) continue;

    const currentCard = prizeCardId > 0 ? await storage.getPlayerCard(prizeCardId) : undefined;
    const currentOwnerMatches = currentCard && String(currentCard.ownerId || "") === String(entry.userId || "");
    if (currentOwnerMatches) continue;
    // An issued card may have been traded or archived. Repair must never reroll
    // that award or create another card merely because its owner changed.
    const historicalCardId = Number(entry.tiebreakMeta?.settlement?.prizeAward?.cardId || 0);
    if (prizeCardId > 0 || historicalCardId > 0 || entry.tiebreakMeta?.settlement?.prizeAward?.claimed === true) {
      skipped.push({ entryId: entry.id, userId: String(entry.userId || ""), reason: "Prize already issued; preserve the original card" });
      continue;
    }

    // Unissued awards must use the normal transactional claim endpoint.
    // This admin repair path must never create a second reward card.
    skipped.push({ entryId: entry.id, userId: String(entry.userId || ""), reason: "No original prize card reference; use the normal prize claim flow" });
  }

  return { success: true, competitionId, repairedCount: repaired.length, skippedCount: skipped.length, repaired, skipped };
}

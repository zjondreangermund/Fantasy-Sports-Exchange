import { storage } from "../storage.js";

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
  const allPlayers = shuffle(await storage.getPlayers());
  const repaired: Array<{ entryId: number; userId: string; oldPrizeCardId: number | null; newPrizeCardId: number }> = [];
  const skipped: Array<{ entryId: number; userId: string; reason: string }> = [];

  const createRepairCard = async (targetUserId: string, rarity: string): Promise<number | null> => {
    for (const player of allPlayers) {
      try {
        const created = await storage.createPlayerCard({
          playerId: player.id,
          ownerId: targetUserId,
          rarity: rarity as any,
          level: 1,
          xp: 0,
          decisiveScore: 35,
          last5Scores: [0, 0, 0, 0, 0],
          forSale: false,
          price: 0,
        } as any);
        return created.id;
      } catch {
        continue;
      }
    }
    return null;
  };

  for (const entry of entries) {
    const rank = Number(entry.rank || 0);
    const prizeCardId = Number(entry.prizeCardId || 0);
    if (rank !== 1 && prizeCardId <= 0) continue;

    const currentCard = prizeCardId > 0 ? await storage.getPlayerCard(prizeCardId) : undefined;
    const currentOwnerMatches = currentCard && String(currentCard.ownerId || "") === String(entry.userId || "");
    if (currentOwnerMatches) continue;

    const rarity = String(
      currentCard?.rarity || competition.prizeCardRarity || (String(competition.tier || "") === "rare" ? "unique" : "rare"),
    ).toLowerCase();
    const newPrizeCardId = await createRepairCard(String(entry.userId || ""), rarity);
    if (!newPrizeCardId) {
      skipped.push({ entryId: entry.id, userId: String(entry.userId || ""), reason: "Unable to mint replacement prize card" });
      continue;
    }

    await storage.updateCompetitionEntry(entry.id, { prizeCardId: newPrizeCardId });
    repaired.push({
      entryId: entry.id,
      userId: String(entry.userId || ""),
      oldPrizeCardId: prizeCardId || null,
      newPrizeCardId,
    });
  }

  return { success: true, competitionId, repairedCount: repaired.length, skippedCount: skipped.length, repaired, skipped };
}

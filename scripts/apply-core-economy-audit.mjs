import fs from "node:fs";

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No changes applied to ${path}`);
  fs.writeFileSync(path, after);
}

patch("server/services/walletLedger.ts", (source) => {
  source = source.replace(
    'import { competitionEntries, transactions, users, wallets } from "../../shared/schema.js";',
    'import { competitionEntries, competitions, transactions, users, wallets } from "../../shared/schema.js";',
  );

  source = source.replace(
    '    const [freshExistingEntry] = await tx\n      .select({ id: competitionEntries.id })',
    `    const [lockedCompetition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .for("update")
      .limit(1);
    if (!lockedCompetition) throw new Error("Tournament not found");
    if (String(lockedCompetition.status) !== "open") throw new Error("Tournament is not open for entries");

    const [{ entryCount }] = await tx
      .select({ entryCount: sql<number>\`count(*)::int\` })
      .from(competitionEntries)
      .where(eq(competitionEntries.competitionId, competitionId));
    const maxEntries = Number(lockedCompetition.maxEntries || 0);
    if (maxEntries > 0 && Number(entryCount || 0) >= maxEntries) throw new Error("Tournament is full");

    const [freshExistingEntry] = await tx
      .select({ id: competitionEntries.id })`,
  );

  const anchor = 'export async function applyMarketplaceTradeLedger(tx: any, input: any) {';
  const settlementHelper = `export async function settleCompetitionPayouts(input: any) {
  const competitionId = Number(input?.competitionId || 0);
  const rankedEntries = Array.isArray(input?.rankedEntries) ? input.rankedEntries : [];
  const payoutPercentages = Array.isArray(input?.payoutPercentages) ? input.payoutPercentages.map(Number) : [0.6, 0.3, 0.1];
  if (!Number.isInteger(competitionId) || competitionId <= 0) throw new Error("Valid tournament required");
  if (!rankedEntries.length) throw new Error("Cannot settle a tournament without entries");

  return db.transaction(async (tx) => {
    const [competition] = await tx.select().from(competitions).where(eq(competitions.id, competitionId)).for("update").limit(1);
    if (!competition) throw new Error("Tournament not found");
    if (String(competition.status) === "completed") throw new Error("Tournament already settled");
    if (String(competition.status) !== "active") throw new Error("Tournament must be active before settlement");

    const entryFee = toMoney(competition.entryFee || 0);
    const grossPool = toMoney(rankedEntries.length * entryFee);
    const feeRate = Math.max(0, Math.min(1, Number((competition as any).platformFeeRate ?? 0.2)));
    const platformFee = toMoney(grossPool * feeRate);
    const prizePool = toMoney(grossPool - platformFee);

    for (let index = 0; index < rankedEntries.length; index += 1) {
      const entry = rankedEntries[index];
      const payout = toMoney(prizePool * (payoutPercentages[index] || 0));
      await tx.update(competitionEntries).set({ rank: index + 1, prizeAmount: payout, tiebreakMeta: entry?.tiebreak || {} } as any).where(eq(competitionEntries.id, Number(entry.id)));
      if (payout <= 0) continue;
      const userId = String(entry.userId || "");
      const [wallet] = await tx.update(wallets).set({ balance: sql\`${wallets.balance} + ${payout}\` } as any).where(eq(wallets.userId, userId)).returning();
      if (!wallet) throw new Error(\`Winner wallet not found for user ${userId}\`);
      await tx.insert(transactions).values({
        userId,
        type: "tournament_payout",
        amount: payout,
        grossAmount: payout,
        feeAmount: 0,
        netAmount: payout,
        sourceType: "tournament_settlement",
        status: "completed",
        description: \`Tournament payout competition:${competitionId} rank:${index + 1}\`,
      } as any);
    }

    await tx.execute(sql\`update app.competitions set status='completed', platform_fee_total=${platformFee}, prize_pool_total=${prizePool} where id=${competitionId}\`);
    return { grossPool, platformFee, prizePool, winnersCount: Math.min(payoutPercentages.length, rankedEntries.length) };
  });
}

`;
  source = source.replace(anchor, settlementHelper + anchor);
  return source;
});

patch("server/routes.ts", (source) => {
  source = source.replace(
    'import { PRIZE_CATALOG, RARITY_MARGIN_MULTIPLIERS, getActivePrizeForEntries, getEntryFeeForRarity } from "./services/prizeEngine.js";',
    'import { PRIZE_CATALOG, RARITY_MARGIN_MULTIPLIERS, getActivePrizeForEntries, getEntryFeeForRarity } from "./services/prizeEngine.js";\nimport { enterCompetitionWithFee, settleCompetitionPayouts } from "./services/walletLedger.js";',
  );
  source = source.replace(
    '      if (!competitionId || cardIds.length !== 5 || new Set(cardIds).size !== 5) return res.status(400).json({ message: "Tournament ID and exactly 5 different card IDs required" });',
    '      if (!competitionId || cardIds.length !== 5 || new Set(cardIds).size !== 5) return res.status(400).json({ message: "Tournament ID and exactly 5 different card IDs required" });\n      if (!cardIds.includes(captainId)) return res.status(400).json({ message: "Captain must be one of the five selected cards" });',
  );
  source = source.replace(
    '      if (await storage.getCompetitionEntry(competitionId, userId)) return res.status(400).json({ message: "Already entered this tournament" });',
    '      if (await storage.getCompetitionEntry(competitionId, userId)) return res.status(400).json({ message: "Already entered this tournament" });\n      const existingEntries = await storage.getCompetitionEntries(competitionId);\n      const maxEntries = Number(competition.maxEntries ?? competition.max_entries ?? 0);\n      if (maxEntries > 0 && existingEntries.length >= maxEntries) return res.status(400).json({ message: "Tournament is full" });',
  );
  source = source.replace(
    '      const wallet = await storage.getWallet(userId);\n      if (entryFee > 0 && (!wallet || Number(wallet.balance || 0) < entryFee)) return res.status(400).json({ message: "Insufficient balance for entry fee" });\n      if (entryFee > 0) { await storage.updateWalletBalance(userId, -entryFee); await storage.createTransaction({ userId, type: "entry_fee" as any, amount: -entryFee, description: `Entered tournament: ${competition.name}` } as any); }\n      const entry = await storage.createCompetitionEntry({ competitionId, userId, lineupCardIds: cardIds, captainId, totalScore: 0 } as any);',
    '      const entry = await enterCompetitionWithFee({ competitionId, userId, entryFee, competitionName: competition.name, lineupCardIds: cardIds, captainId });',
  );
  source = source.replace(
    '      if (competition.status === "completed") return res.status(400).json({ message: "Tournament already settled" });\n      const entries = await storage.getCompetitionEntries(competitionId);\n      const ranked = await rankCompetitionEntries(storage, entries);\n      const totalPrizePool = toMoney(entries.length * Number(competition.entryFee || 0));\n      const payoutPercentages = [0.6, 0.3, 0.1];\n      for (let i = 0; i < ranked.length; i += 1) await storage.updateCompetitionEntry(ranked[i].id, { rank: i + 1, prizeAmount: toMoney(totalPrizePool * (payoutPercentages[i] || 0)), tiebreakMeta: ranked[i].tiebreak || {} } as any);\n      await storage.updateCompetition(competitionId, { status: "completed" } as any);\n      return res.json({ success: true, message: "Tournament settled with Arena v2 tiebreak rules", winner: ranked[0] || null, winnersCount: Math.min(3, ranked.length) });',
    '      if (competition.status === "completed") return res.status(400).json({ message: "Tournament already settled" });\n      if (competition.status !== "active") return res.status(400).json({ message: "Tournament must be active before settlement" });\n      const entries = await storage.getCompetitionEntries(competitionId);\n      const ranked = await rankCompetitionEntries(storage, entries);\n      if (!ranked.length) return res.status(400).json({ message: "Cannot settle a tournament without entries" });\n      const settlement = await settleCompetitionPayouts({ competitionId, rankedEntries: ranked, payoutPercentages: [0.6, 0.3, 0.1] });\n      return res.json({ success: true, message: "Tournament settled with Arena v2 tiebreak rules", winner: ranked[0] || null, winnersCount: settlement.winnersCount, settlement });',
  );
  return source;
});

console.log("Applied atomic entry, capacity, captain, and settlement ledger corrections.");

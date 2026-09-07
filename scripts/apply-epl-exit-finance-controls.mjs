import fs from "node:fs";

function patchFile(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[epl-exit-finance] patched ${path}`);
  } else {
    console.log(`[epl-exit-finance] ${path} already patched`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[epl-exit-finance] anchor not found: ${label}`);
  return source.replace(from, () => to);
}

function replaceOneOf(source, variants, to, marker, label) {
  if (source.includes(marker)) return source;
  for (const from of variants) {
    if (source.includes(from)) return source.replace(from, () => to);
  }
  throw new Error(`[epl-exit-finance] anchor not found: ${label}`);
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[epl-exit-finance] anchor not found: ${label}`);
  return source.replace(anchor, () => `${anchor}${insertion}`);
}

function insertBefore(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[epl-exit-finance] anchor not found: ${label}`);
  return source.replace(anchor, () => `${insertion}${anchor}`);
}

// EPL departures: preserve both rarity and the football position of the departed card.
patchFile("server/services/playerTransferMonitoring.ts", (original) => {
  let source = original;
  if (!source.includes("EPL_REPLACEMENT_SAME_POSITION_V1")) {
    source = replaceRequired(
      source,
      '  const cards = rowsOf(await db.execute(sql`\n    select pc.id, pc.owner_id as "ownerId", pc.rarity::text as rarity\n    from app.player_cards pc\n    where pc.player_id=${input.playerId} and pc.owner_id is not null\n    order by pc.id asc\n  `));',
      '  // EPL_REPLACEMENT_SAME_POSITION_V1\n  const cards = rowsOf(await db.execute(sql`\n    select pc.id, pc.owner_id as "ownerId", pc.rarity::text as rarity, source.position::text as "sourcePosition"\n    from app.player_cards pc\n    join app.players source on source.id=pc.player_id\n    where pc.player_id=${input.playerId} and pc.owner_id is not null\n    order by pc.id asc\n  `));',
      "departure card position lookup",
    );
    source = replaceRequired(
      source,
      '    const rarity = String(card.rarity || "common").toLowerCase();\n    if (!sourceCardId || !userId || !SUPPLY_BY_RARITY[rarity]) continue;',
      '    const rarity = String(card.rarity || "common").toLowerCase();\n    const sourcePosition = String(card.sourcePosition || "").trim().toUpperCase();\n    if (!sourceCardId || !userId || !SUPPLY_BY_RARITY[rarity] || !["GK", "DEF", "MID", "FWD"].includes(sourcePosition)) continue;',
      "departure source position guard",
    );
    source = replaceRequired(
      source,
      '      message: `${input.playerName} is no longer in the Premier League. Your ${prettyRarity} card stays in your collection as a record, but it is no longer eligible for Premier League tournaments. Mint one free ${prettyRarity} replacement from the current Premier League player pool for future entries.`,',
      '      message: `${input.playerName} is no longer in the Premier League. Your ${prettyRarity} ${sourcePosition} card stays in your collection as a record, but it is no longer eligible for Premier League tournaments. Claim one free random current Premier League ${sourcePosition} card of the same ${prettyRarity} rarity. Fantasy Arena will keep reminding you until the replacement is claimed.`,',
      "departure notification same-position copy",
    );
    source = replaceRequired(
      source,
      '           pr.source_player_name as "sourcePlayerName",\n           pr.rarity,\n           pr.replacement_card_id as "replacementCardId",',
      '           pr.source_player_name as "sourcePlayerName",\n           source.position::text as "sourcePosition",\n           pr.rarity,\n           pr.replacement_card_id as "replacementCardId",',
      "replacement list position field",
    );
    source = replaceRequired(
      source,
      '    from app.player_replacement_claims pr\n    where pr.user_id=${userId}',
      '    from app.player_replacement_claims pr\n    join app.players source on source.id=pr.source_player_id\n    where pr.user_id=${userId}',
      "replacement list source player join",
    );
    source = replaceRequired(
      source,
      '             pr.source_player_id as "sourcePlayerId", pr.source_player_name as "sourcePlayerName",\n             pr.rarity, pr.replacement_card_id as "replacementCardId", pr.claimed_at as "claimedAt"\n      from app.player_replacement_claims pr\n      where pr.id=${claimId} and pr.user_id=${userId}',
      '             pr.source_player_id as "sourcePlayerId", pr.source_player_name as "sourcePlayerName",\n             source.position::text as "sourcePosition", pr.rarity, pr.replacement_card_id as "replacementCardId", pr.claimed_at as "claimedAt"\n      from app.player_replacement_claims pr\n      join app.players source on source.id=pr.source_player_id\n      where pr.id=${claimId} and pr.user_id=${userId}',
      "claim source position join",
    );
    source = replaceRequired(
      source,
      '               p.id as "playerId", p.name as "playerName", p.team',
      '               p.id as "playerId", p.name as "playerName", p.team, p.position::text as position',
      "existing replacement card position",
    );
    source = replaceRequired(
      source,
      '    const supplyLimit = SUPPLY_BY_RARITY[rarity];\n    if (!supplyLimit) throw new Error("Unsupported replacement rarity");\n\n    const candidates = rowsOf(await tx.execute(sql`\n      select p.id, p.name, p.team',
      '    const supplyLimit = SUPPLY_BY_RARITY[rarity];\n    if (!supplyLimit) throw new Error("Unsupported replacement rarity");\n    const sourcePosition = String(claim.sourcePosition || "").trim().toUpperCase();\n    if (!["GK", "DEF", "MID", "FWD"].includes(sourcePosition)) throw new Error("Replacement position could not be verified; your claim remains open.");\n\n    const candidates = rowsOf(await tx.execute(sql`\n      select p.id, p.name, p.team, p.position::text as position',
      "replacement candidate source position",
    );
    source = replaceRequired(
      source,
      "      where lower(p.league)='premier league'\n        and p.fpl_id is not null",
      "      where lower(p.league)='premier league'\n        and p.fpl_id is not null\n        and p.position::text=${sourcePosition}",
      "replacement candidate position restriction",
    );
    source = replaceRequired(
      source,
      '    if (!chosen?.id) throw new Error(`No ${rarity} replacement supply is currently available. Your claim remains open.`);',
      '    if (!chosen?.id) throw new Error(`No ${rarity} ${sourcePosition} replacement supply is currently available. Your claim remains open.`);',
      "replacement supply error position",
    );
    source = replaceRequired(
      source,
      '        team: String(chosen.team || "Premier League"),\n      },',
      '        team: String(chosen.team || "Premier League"),\n        position: String(chosen.position || sourcePosition),\n      },',
      "replacement response position",
    );
  }
  return source;
});

// Global claim dialog: authenticated users cannot dismiss an EPL departure replacement until it is claimed.
patchFile("client/src/App.tsx", (original) => {
  let source = original;
  if (!source.includes('MandatoryReplacementClaimDialog from "./components/MandatoryReplacementClaimDialog"')) {
    const installImport = 'import InstallAppButton from "./components/InstallAppButton";\n';
    const globalImport = 'import GlobalActionToasts from "./components/GlobalActionToasts";\n';
    const importAnchor = source.includes(installImport) ? installImport : globalImport;
    if (!source.includes(importAnchor)) throw new Error("[epl-exit-finance] anchor not found: mandatory replacement dialog import");
    source = source.replace(importAnchor, () => `${importAnchor}import MandatoryReplacementClaimDialog from "./components/MandatoryReplacementClaimDialog";\n`);
  }
  source = insertAfter(
    source,
    'import MandatoryReplacementClaimDialog from "./components/MandatoryReplacementClaimDialog";\n',
    'import PushNotificationControl from "./components/PushNotificationControl";\n',
    'PushNotificationControl from "./components/PushNotificationControl"',
    "installed-app push control import",
  );
  source = insertBefore(
    source,
    '<ThemeToggle />',
    '<PushNotificationControl />',
    '<PushNotificationControl />',
    "installed-app push control mount",
  );
  source = insertAfter(
    source,
    '          <FloatingSupportWidget />\n',
    '          <MandatoryReplacementClaimDialog />\n',
    '<MandatoryReplacementClaimDialog />',
    "mandatory replacement dialog mount",
  );
  return source;
});

// Official Prize Ladder settlement: if no ladder reward unlocks, #1 receives 80% of collected fees and Fantasy Arena retains 20%.
patchFile("server/routes/economyIntegrity.routes.ts", (original) => {
  let source = original;
  source = replaceOneOf(
    source,
    [
      '        const payoutPercentages = [0.6, 0.3, 0.1];',
      '        const payoutPercentages = creatorCashTournament',
    ],
    source.includes('const creatorCashTournament = cashPoolEnabled')
      ? '        let payoutPercentages = creatorCashTournament'
      : '        let payoutPercentages = [0.6, 0.3, 0.1];',
    'let payoutPercentages =',
    "mutable payout percentages",
  );

  source = insertBefore(
    source,
    '        const feeRate = Math.max(0, Math.min(1, Number(competition.platformFeeRate ?? (competition.createdByUserId ? 0.1 : 0))));',
    '        // PRIZE_LADDER_UNDER_MINIMUM_CASH_FALLBACK_V1\n        const underMinimumCashFallback = prizeVault && !prizeAward && grossPool > 0;\n        const cashPayoutEnabled = cashPoolEnabled || underMinimumCashFallback;\n        if (underMinimumCashFallback) payoutPercentages = [1];\n',
    'PRIZE_LADDER_UNDER_MINIMUM_CASH_FALLBACK_V1',
    "under-minimum ladder fallback",
  );
  source = replaceRequired(
    source,
    '        const cashPrizePool = cashPoolEnabled ? toMoney(grossPool - toMoney(grossPool * feeRate)) : 0;',
    '        const cashPrizePool = cashPoolEnabled\n          ? toMoney(grossPool - toMoney(grossPool * feeRate))\n          : underMinimumCashFallback\n            ? toMoney(grossPool * 0.8)\n            : 0;',
    "fallback cash prize pool",
  );
  source = replaceRequired(
    source,
    '        const platformFee = cashPoolEnabled ? toMoney(grossPool - cashPrizePool) : toMoney(Math.max(0, grossPool - prizeValue));\n        const prizePool = cashPoolEnabled ? cashPrizePool : prizeValue;',
    '        const platformFee = underMinimumCashFallback\n          ? toMoney(grossPool * 0.2)\n          : cashPoolEnabled\n            ? toMoney(grossPool - cashPrizePool)\n            : toMoney(Math.max(0, grossPool - prizeValue));\n        const prizePool = cashPayoutEnabled ? cashPrizePool : prizeValue;',
    "fallback platform fee and prize pool",
  );
  source = source.replaceAll('if (alreadyCompleted && cashPoolEnabled) {', 'if (alreadyCompleted && cashPayoutEnabled) {');
  source = source.replaceAll('const payout = cashPoolEnabled ? toMoney(cashPrizePool * (payoutPercentages[index] || 0)) : 0;', 'const payout = cashPayoutEnabled ? toMoney(cashPrizePool * (payoutPercentages[index] || 0)) : 0;');
  source = insertAfter(
    source,
    '            manualSettlement: forceManual,\n',
    '            underMinimumCashFallback,\n            platformFeeRateApplied: underMinimumCashFallback ? 0.2 : feeRate,\n',
    'platformFeeRateApplied: underMinimumCashFallback ? 0.2 : feeRate',
    "fallback settlement metadata",
  );
  source = replaceRequired(
    source,
    '            title: `Congratulations — #${index + 1} in ${competition.name}`,\n            message: `Congratulations from the Fantasy Arena Team! You finished #${index + 1} in ${competition.name} with ${toMoney(rankedEntry.totalScore).toFixed(1)} points. N$${payout.toFixed(2)} has been credited to your Fantasy Arena wallet.`,',
    '            title: underMinimumCashFallback && index === 0 ? `Prize Ladder cash fallback — you won ${competition.name}` : `Congratulations — #${index + 1} in ${competition.name}`,\n            message: underMinimumCashFallback && index === 0\n              ? `The Prize Ladder minimum entry threshold was not reached. You finished #1 in ${competition.name} with ${toMoney(rankedEntry.totalScore).toFixed(1)} points, so 80% of the collected entry fees (N$${payout.toFixed(2)}) has been credited to your Fantasy Arena wallet. Fantasy Arena retained the remaining 20% platform share.`\n              : `Congratulations from the Fantasy Arena Team! You finished #${index + 1} in ${competition.name} with ${toMoney(rankedEntry.totalScore).toFixed(1)} points. N$${payout.toFixed(2)} has been credited to your Fantasy Arena wallet.`,',
    "fallback winner notification",
  );
  source = replaceRequired(
    source,
    '          prizeVault,\n          sharedEntries,',
    '          prizeVault,\n          underMinimumCashFallback,\n          sharedEntries,',
    "fallback settlement return field",
  );
  source = replaceOneOf(
    source,
    [
      '          winnersCount: cashPoolEnabled ? Math.min(3, ranked.length) : awardRecord ? 1 : 0,',
      '          winnersCount: cashPoolEnabled ? Math.min(payoutPercentages.filter((value: number) => value > 0).length, ranked.length) : (freeCardCup || awardRecord) ? 1 : 0,',
    ],
    source.includes('(freeCardCup || awardRecord)')
      ? '          winnersCount: cashPayoutEnabled ? Math.min(payoutPercentages.filter((value: number) => value > 0).length, ranked.length) : (freeCardCup || awardRecord) ? 1 : 0,'
      : '          winnersCount: cashPayoutEnabled ? Math.min(payoutPercentages.filter((value: number) => value > 0).length, ranked.length) : awardRecord ? 1 : 0,',
    'winnersCount: cashPayoutEnabled',
    "fallback winner count",
  );
  source = replaceRequired(
    source,
    '        message: settlement.replayed\n          ? "Tournament settlement already completed and verified"\n          : settlement.prizeVault',
    '        message: settlement.replayed\n          ? "Tournament settlement already completed and verified"\n          : settlement.underMinimumCashFallback\n            ? "Tournament settled: Prize Ladder minimum was not reached, so 80% of collected entry fees went to the winner and 20% to Fantasy Arena"\n          : settlement.prizeVault',
    "fallback settlement response",
  );
  return source;
});

// Public tournament card: disclose the fallback before users pay an entry fee.
patchFile("client/src/pages/competitions-vault.tsx", (original) => {
  let source = original;
  if (source.includes('label="Settlement" value={shownSettlementLabel}') && !source.includes("const shownSettlementLabel = shownSettlementAt ? dateLabel(shownSettlementAt)")) {
    const playVisible = '  const visible = tournamentPool.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === activeRarity);\n';
    const legacyVisible = '  const visible = official.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === activeRarity);\n';
    const visibleAnchor = source.includes(playVisible) ? playVisible : legacyVisible;
    if (!source.includes(visibleAnchor)) throw new Error("[epl-exit-finance] anchor not found: shown gameweek settlement source");
    const settlementInsert = '  const shownSettlementTournament = visible[0] || official.find((c) => Number(c.gameWeek || c.game_week) === Number(shownGw));\n  const shownSettlementAt = shownSettlementTournament?.settlementAt || shownSettlementTournament?.settlement_at || shownSettlementTournament?.endDate || shownSettlementTournament?.end_date;\n  const shownSettlementLabel = shownSettlementAt ? dateLabel(shownSettlementAt) : "Fixture controlled";\n';
    source = source.replace(visibleAnchor, () => `${visibleAnchor}${settlementInsert}`);
  }
  if (!source.includes("PRIZE_LADDER_FALLBACK_DISCLOSURE_V1")) {
    const insertion = '  // PRIZE_LADDER_FALLBACK_DISCLOSURE_V1\n  const paidEntryFee = Number(comp.entryFee ?? comp.entry_fee ?? 0);\n  const underMinimumCashFallback = vaultTournament && paidEntryFee > 0 && tournamentEntries > 0 && target > 0 && sharedEntries < target && !vault?.activePrize;\n  const fallbackWinnerCash = Math.round((tournamentEntries * paidEntryFee * 0.8) * 100) / 100;\n';
    const generatedAnchor = '  const vaultProgress = vaultTournament ? percentage(sharedEntries, target) : 0;\n';
    const sourceAnchor = '  const p = percentage(sharedEntries, target);\n';
    if (source.includes(generatedAnchor)) source = source.replace(generatedAnchor, () => `${generatedAnchor}${insertion}`);
    else if (source.includes(sourceAnchor)) source = source.replace(sourceAnchor, () => `${sourceAnchor}${insertion.replace("vaultTournament && ", "")}`);
    else throw new Error("[epl-exit-finance] anchor not found: public fallback calculations");
  }
  source = replaceRequired(
    source,
    '  const prizeTitle = vault?.activePrize?.title || vault?.nextPrize?.title || comp.prizeDescription || comp.prize_description || "Prize ladder";',
    '  const prizeTitle = vault?.activePrize?.title || (underMinimumCashFallback ? `Cash fallback: ${money(fallbackWinnerCash)} to #1 if minimum stays unmet` : vault?.nextPrize?.title) || comp.prizeDescription || comp.prize_description || "Prize ladder";',
    "public fallback prize title",
  );
  source = replaceOneOf(
    source,
    [
      '<div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/10 p-3 text-[11px] leading-5 text-amber-100">Only Premier League points recorded for this gameweek before Tuesday settlement count. FA Cup matches and Premier League fixtures played after settlement are excluded.</div>',
      '<div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/10 p-3 text-[11px] leading-5 text-amber-100">Only Premier League points recorded for this gameweek before the settlement cutoff shown above count. FA Cup matches and Premier League fixtures played after that cutoff are excluded.</div>',
    ],
    '<div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/10 p-3 text-[11px] leading-5 text-amber-100">Only Premier League points recorded for this gameweek before the settlement cutoff shown above count. FA Cup matches and Premier League fixtures played after that cutoff are excluded.</div>{underMinimumCashFallback ? <div className="mt-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-[11px] font-semibold leading-5 text-emerald-50"><b>Minimum-entry protection:</b> if this Prize Ladder finishes below its first prize unlock, #1 receives 80% of this tournament&apos;s collected entry fees in cash and Fantasy Arena retains 20%. Current projected winner cash: {money(fallbackWinnerCash)}.</div> : null}',
    "Minimum-entry protection:",
    "public fallback disclosure",
  );
  return source;
});

// Admin finance: show real external cash, wallet liabilities, tournament reserves and projected under-minimum economics.
patchFile("server/routes/admin.routes.ts", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'import { registerAdminIntegrityRoutes } from "./adminIntegrity.routes.js";\n',
    'import { ensureDepositVerificationSchema } from "../services/depositVerificationSchema.js";\nimport { ensureWithdrawalPayoutSchema } from "../services/withdrawalPayoutSchema.js";\nimport { getActivePrizeForEntries } from "../services/prizeEngine.js";\n',
    'ensureDepositVerificationSchema',
    "finance reconciliation imports",
  );
  source = insertAfter(
    source,
    '  app.get("/api/admin/tournament-financials", requireAuth, isAdmin, async (req: any, res) => {\n    try {\n      res.setHeader("Cache-Control", "private, no-store, max-age=0");\n',
    '      // TOURNAMENT_BANK_RECONCILIATION_V1\n      await Promise.all([ensureDepositVerificationSchema(), ensureWithdrawalPayoutSchema()]);\n',
    'TOURNAMENT_BANK_RECONCILIATION_V1',
    "finance schema readiness",
  );
  source = insertBefore(
    source,
    '      const tournaments = rawRows.map((row) => {',
    '      const sharedLadderEntries = new Map<string, number>();\n      for (const row of rawRows) {\n        const prizeKey = String(row.prizeKey || "").toLowerCase();\n        const prizeType = String(row.prizeType || "goods").toLowerCase();\n        const officialLadder = !row.createdByUserId && Number(row.entryFee || 0) > 0 && prizeType !== "cash_pool" && (!prizeKey || prizeKey === "ladder");\n        if (!officialLadder) continue;\n        const key = `${Number(row.gameWeek || 0)}:${String(row.tier || "common").toLowerCase()}`;\n        sharedLadderEntries.set(key, (sharedLadderEntries.get(key) || 0) + Number(row.entryCount || 0));\n      }\n\n',
    'const sharedLadderEntries = new Map<string, number>();',
    "shared ladder finance entries",
  );
  source = insertAfter(
    source,
    '        const category = prizeKey === "user-cash" || String(row.prizeType || "").toLowerCase() === "cash_pool"\n          ? "user-cash"\n          : prizeKey.startsWith("free-") || entryFee === 0\n            ? "free-cup"\n            : "prize-vault";\n',
    '        const status = String(row.status || "").toLowerCase();\n        const ladderKey = `${Number(row.gameWeek || 0)}:${String(row.tier || "common").toLowerCase()}`;\n        const sharedEntryCount = category === "prize-vault" ? Number(sharedLadderEntries.get(ladderKey) || entryCount) : entryCount;\n        const ladderState = category === "prize-vault" ? getActivePrizeForEntries(row.tier, sharedEntryCount) : null;\n        const activeLadderPrize = ladderState?.activePrize || null;\n        const underMinimumCashFallback = category === "prize-vault" && sharedEntryCount > 0 && !activeLadderPrize;\n        const projectedWinnerCashFallback = underMinimumCashFallback ? toMoney((grossEntryAmount - refundTotal) * 0.8) : 0;\n        const projectedPlatformRevenue = status === "completed"\n          ? 0\n          : underMinimumCashFallback\n            ? toMoney((grossEntryAmount - refundTotal) * 0.2)\n            : category === "user-cash"\n              ? toMoney((grossEntryAmount - refundTotal) * Number(row.platformFeeRate || 0))\n              : category === "prize-vault" && activeLadderPrize\n                ? toMoney(Math.max(0, (grossEntryAmount - refundTotal) - Number(activeLadderPrize.value || 0)))\n                : 0;\n        const projectedPrizeReserve = status === "completed"\n          ? toMoney(Math.max(prizePool - cashPayouts, 0))\n          : underMinimumCashFallback\n            ? projectedWinnerCashFallback\n            : category === "user-cash"\n              ? toMoney((grossEntryAmount - refundTotal) * (1 - Number(row.platformFeeRate || 0)))\n              : category === "prize-vault" && activeLadderPrize\n                ? toMoney(activeLadderPrize.value || 0)\n                : 0;\n',
    'projectedWinnerCashFallback',
    "tournament finance projections",
  );
  source = insertAfter(
    source,
    '          awardedCards: Number(row.awardedCards || 0),\n',
    '          sharedEntryCount,\n          activePrizeTitle: activeLadderPrize?.title || null,\n          activePrizeValue: toMoney(activeLadderPrize?.value || 0),\n          underMinimumCashFallback,\n          projectedWinnerCashFallback,\n          projectedPlatformRevenue,\n          projectedPrizeReserve,\n',
    'projectedWinnerCashFallback,\n          projectedPlatformRevenue',
    "tournament finance projection fields",
  );
  source = replaceRequired(
    source,
    '        outstandingPrizePools: toMoney(totals.outstandingPrizePools + row.outstandingPrizePool),\n        reconciliationDifferences: totals.reconciliationDifferences + (row.entryAmountDifference !== 0 ? 1 : 0),',
    '        outstandingPrizePools: toMoney(totals.outstandingPrizePools + row.outstandingPrizePool),\n        projectedPrizeReserves: toMoney(totals.projectedPrizeReserves + row.projectedPrizeReserve),\n        projectedPlatformRevenue: toMoney(totals.projectedPlatformRevenue + row.projectedPlatformRevenue),\n        underMinimumFallbackTournaments: totals.underMinimumFallbackTournaments + (row.underMinimumCashFallback ? 1 : 0),\n        reconciliationDifferences: totals.reconciliationDifferences + (row.entryAmountDifference !== 0 ? 1 : 0),',
    "finance summary projections",
  );
  source = replaceRequired(
    source,
    '        outstandingPrizePools: 0, reconciliationDifferences: 0,\n      });',
    '        outstandingPrizePools: 0, projectedPrizeReserves: 0, projectedPlatformRevenue: 0, underMinimumFallbackTournaments: 0, reconciliationDifferences: 0,\n      });',
    "finance summary projection defaults",
  );
  source = insertBefore(
    source,
    '      return res.json({ updatedAt: new Date().toISOString(), summary, tournaments, source: "Fantasy Arena competition entries and wallet records" });',
    '      const bankRow = rowsOf(await db.execute(sql`\n        select\n          (select coalesce(sum(gross_amount), 0)::float from app.deposit_verifications where status = \'approved\') as "approvedDepositsGross",\n          (select coalesce(sum(fee_amount), 0)::float from app.deposit_verifications where status = \'approved\') as "depositFees",\n          (select coalesce(sum(net_amount), 0)::float from app.deposit_verifications where status = \'approved\') as "walletDepositCredits",\n          (select coalesce(sum(net_amount), 0)::float from app.withdrawal_requests where status::text = \'paid\') as "paidWithdrawalsNet",\n          (select coalesce(sum(amount), 0)::float from app.withdrawal_requests where status::text in (\'pending\', \'approved\', \'failed\')) as "pendingWithdrawalHolds",\n          (select coalesce(sum(balance), 0)::float from app.wallets) as "walletAvailableLiability",\n          (select coalesce(sum(locked_balance), 0)::float from app.wallets) as "walletLockedLiability",\n          (select coalesce(sum(case when status::text = \'completed\' and (source_type = \'marketplace_sale\' or type::text in (\'marketplace_sale\', \'sale\')) then greatest(coalesce(fee_amount, 0), 0) else 0 end), 0)::float from app.transactions) as "marketplaceFees"\n      `))[0] || {};\n      const approvedDepositsGross = toMoney(bankRow.approvedDepositsGross);\n      const paidWithdrawalsNet = toMoney(bankRow.paidWithdrawalsNet);\n      const expectedBankCash = toMoney(approvedDepositsGross - paidWithdrawalsNet);\n      const walletAvailableLiability = toMoney(bankRow.walletAvailableLiability);\n      const walletLockedLiability = toMoney(bankRow.walletLockedLiability);\n      const walletLiability = toMoney(walletAvailableLiability + walletLockedLiability);\n      const tournamentPrizeReserve = toMoney(summary.projectedPrizeReserves || 0);\n      const minimumRequiredBankReserve = toMoney(walletLiability + tournamentPrizeReserve);\n      const bankReconciliation = {\n        approvedDepositsGross,\n        walletDepositCredits: toMoney(bankRow.walletDepositCredits),\n        depositFees: toMoney(bankRow.depositFees),\n        paidWithdrawalsNet,\n        pendingWithdrawalHolds: toMoney(bankRow.pendingWithdrawalHolds),\n        expectedBankCash,\n        walletAvailableLiability,\n        walletLockedLiability,\n        walletLiability,\n        tournamentPrizeReserve,\n        minimumRequiredBankReserve,\n        reserveHeadroom: toMoney(expectedBankCash - minimumRequiredBankReserve),\n        recordedPlatformRevenue: toMoney(Number(bankRow.depositFees || 0) + Number(bankRow.marketplaceFees || 0) + Number(summary.platformFees || 0)),\n        projectedTournamentPlatformRevenue: toMoney(summary.projectedPlatformRevenue || 0),\n        marketplaceFees: toMoney(bankRow.marketplaceFees),\n        note: "Expected bank cash = approved external deposits minus withdrawals marked paid. It excludes bank charges, manual off-platform transfers and physical-prize purchases not recorded in Fantasy Arena.",\n      };\n\n',
    'const bankReconciliation = {',
    "bank reconciliation calculation",
  );
  source = replaceRequired(
    source,
    '      return res.json({ updatedAt: new Date().toISOString(), summary, tournaments, source: "Fantasy Arena competition entries and wallet records" });',
    '      return res.json({ updatedAt: new Date().toISOString(), summary, bankReconciliation, tournaments, source: "Fantasy Arena competition entries, verified external deposits, withdrawals and wallet records" });',
    "finance response bank reconciliation",
  );
  return source;
});

patchFile("client/src/components/admin/AdminTournamentManager.tsx", (original) => {
  let source = original;
  source = insertAfter(
    source,
    '  const financialSummary = financialPayload?.summary || {};\n',
    '  const bankReconciliation = financialPayload?.bankReconciliation || {};\n',
    'const bankReconciliation = financialPayload?.bankReconciliation',
    "admin bank reconciliation payload",
  );
  source = insertAfter(
    source,
    '        </div>\n        <div className="max-h-[24rem] overflow-auto border-t border-white/10">',
    '        <div className="border-t border-white/10 bg-cyan-400/[.035] p-4"><div className="mb-3"><div className="text-xs font-black uppercase tracking-[.14em] text-cyan-100">Bank &amp; reserve reconciliation</div><div className="mt-1 text-[11px] text-white/45">External bank cash is kept separate from internal wallet movements and tournament liabilities.</div></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8"><FinancialStat label="Expected bank cash" value={money(bankReconciliation.expectedBankCash)} helper="Approved deposits − paid withdrawals" warning={Number(bankReconciliation.expectedBankCash || 0) < 0} /><FinancialStat label="Wallet liability" value={money(bankReconciliation.walletLiability)} helper={`${money(bankReconciliation.walletAvailableLiability)} available · ${money(bankReconciliation.walletLockedLiability)} locked`} /><FinancialStat label="Prize reserves" value={money(bankReconciliation.tournamentPrizeReserve)} helper="Current tournament/prize obligation" /><FinancialStat label="Minimum reserve" value={money(bankReconciliation.minimumRequiredBankReserve)} helper="Wallets + prize reserves" /><FinancialStat label="Reserve headroom" value={money(bankReconciliation.reserveHeadroom)} helper="Cash above required reserves" warning={Number(bankReconciliation.reserveHeadroom || 0) < 0} /><FinancialStat label="Approved deposits" value={money(bankReconciliation.approvedDepositsGross)} helper={`Wallet credited ${money(bankReconciliation.walletDepositCredits)}`} /><FinancialStat label="Paid withdrawals" value={money(bankReconciliation.paidWithdrawalsNet)} helper={`Pending holds ${money(bankReconciliation.pendingWithdrawalHolds)}`} /><FinancialStat label="Recorded site revenue" value={money(bankReconciliation.recordedPlatformRevenue)} helper={`Projected tournament site share ${money(bankReconciliation.projectedTournamentPlatformRevenue)}`} /></div><div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[.06] px-3 py-2 text-[10px] leading-5 text-amber-100/75">{bankReconciliation.note || "Bank reconciliation is ledger-based and excludes off-platform costs that have not been recorded in Fantasy Arena."}</div></div>\n',
    'Bank &amp; reserve reconciliation',
    "admin bank reconciliation cards",
  );
  source = replaceRequired(
    source,
    '<td className="px-3 py-3">{money(row.platformFees)}<div className="text-[10px] text-white/45">{Number(row.platformFeeRate || 0) * 100}%</div></td><td className="px-3 py-3">{money(row.prizePool)}</td>',
    '<td className="px-3 py-3">{money(Number(row.platformFees || 0) > 0 ? row.platformFees : row.projectedPlatformRevenue)}<div className="text-[10px] text-white/45">{row.underMinimumCashFallback ? "20% under-minimum site share" : Number(row.platformFeeRate || 0) > 0 ? `${Number(row.platformFeeRate || 0) * 100}% configured` : Number(row.projectedPlatformRevenue || 0) > 0 ? "Projected site share" : "No recorded fee yet"}</div></td><td className="px-3 py-3">{money(Number(row.prizePool || 0) > 0 ? row.prizePool : row.projectedPrizeReserve)}<div className="text-[10px] text-white/45">{row.underMinimumCashFallback ? `80% winner fallback · ${money(row.projectedWinnerCashFallback)}` : row.activePrizeTitle ? row.activePrizeTitle : Number(row.projectedPrizeReserve || 0) > 0 ? "Projected reserve" : "No cash reserve"}</div></td>',
    "admin tournament projected site/prize columns",
  );
  source = replaceRequired(
    source,
    '<><b>Admin Prize Ladder:</b> {form.tier.toUpperCase()} ladder. First unlock: {nextPrize ? `${nextPrize.title} at ${nextPrize.requiredEntrants} entries` : "loading..."}. Margin: {marginByRarity[form.tier] || 1.8}x.</>',
    '<><b>Admin Prize Ladder:</b> {form.tier.toUpperCase()} ladder. First unlock: {nextPrize ? `${nextPrize.title} at ${nextPrize.requiredEntrants} entries` : "loading..."}. If the minimum is not reached, #1 receives 80% of collected entry fees in cash and Fantasy Arena retains 20%. Margin after an unlock: {marginByRarity[form.tier] || 1.8}x.</>',
    "admin Prize Ladder fallback copy",
  );
  return source;
});

console.log("[epl-exit-finance] Same-position EPL replacements, mandatory claims, under-minimum 80/20 Prize Ladder fallback and bank/reserve reconciliation are ready.");

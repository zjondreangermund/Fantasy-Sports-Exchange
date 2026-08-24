import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const write = (rel, source) => fs.writeFileSync(path.join(root, rel), source);

function lines(...items) { return items.join("\n"); }
function replaceOnce(source, from, to, label, marker = to) {
  if (source.includes(marker)) return source;
  if (!source.includes(from)) throw new Error(`Tournament creator server patch anchor not found: ${label}`);
  return source.replace(from, to);
}

// Public competition payload + admin builder backend.
{
  const rel = "server/routes.ts";
  let source = read(rel);

  source = replaceOnce(
    source,
    '  const isFreeCardCup = entryFee <= 0 && Boolean(prizeCardRarity);',
    lines(
      '  const normalizedPrizeType = String(row.prizeType ?? row.prize_type ?? "goods").toLowerCase();',
      '  const isCashTournament = normalizedPrizeType === "cash_pool";',
      '  const isFreeCardCup = entryFee <= 0 && Boolean(prizeCardRarity) && !isCashTournament;',
    ),
    "cash tournament detection",
    'const isCashTournament = normalizedPrizeType === "cash_pool";',
  );
  source = replaceOnce(
    source,
    '  const ladderState = isFreeCardCup ? { activePrize: null, nextPrize: null, entrantsToNext: 0 } : getActivePrizeForEntries(rarity, entryCount);',
    '  const ladderState = isFreeCardCup || isCashTournament ? { activePrize: null, nextPrize: null, entrantsToNext: 0 } : getActivePrizeForEntries(rarity, entryCount);',
    "cash tournaments bypass Prize Ladder",
  );
  source = replaceOnce(
    source,
    '  const freeCardTitle = prizeCardRarity ? `${prizeCardRarity.charAt(0).toUpperCase() + prizeCardRarity.slice(1)} Player Card` : "Player Card";',
    lines(
      '  const freeCardTitle = prizeCardRarity ? `${prizeCardRarity.charAt(0).toUpperCase() + prizeCardRarity.slice(1)} Player Card` : "Player Card";',
      '  const platformFeeRate = Math.max(0, Math.min(1, Number(row.platformFeeRate ?? row.platform_fee_rate ?? (isCashTournament ? 0.1 : 0))));',
      '  const currentEntrantRevenue = toMoney(row.currentEntrantRevenue ?? row.current_entrant_revenue ?? entryCount * entryFee);',
      '  const storedPrizePool = Number(row.prizePoolTotal ?? row.prize_pool_total ?? 0);',
      '  const calculatedCashPool = toMoney(currentEntrantRevenue * (1 - platformFeeRate));',
      '  const prizeDistribution = String(row.prizeDistribution ?? row.prize_distribution ?? "winner_takes_all");',
      '  const prizeDistributionRules = Array.isArray(row.prizeDistributionRules ?? row.prize_distribution_rules)',
      '    ? (row.prizeDistributionRules ?? row.prize_distribution_rules)',
      '    : prizeDistribution === "top3"',
      '      ? [{ rank: 1, percent: 60 }, { rank: 2, percent: 30 }, { rank: 3, percent: 10 }]',
      '      : [{ rank: 1, percent: 100 }];',
    ),
    "cash tournament economics variables",
    "const calculatedCashPool =",
  );
  source = replaceOnce(source, '    maxEntries: row.maxEntries ?? row.max_entries ?? null,', lines('    createdByUserId: row.createdByUserId ?? row.created_by_user_id ?? null,', '    maxEntries: row.maxEntries ?? row.max_entries ?? null,'), "creator id normalization", "createdByUserId: row.createdByUserId");
  source = replaceOnce(source, '    prizePoolTotal: Number(row.prizePoolTotal ?? row.prize_pool_total ?? 0),', '    prizePoolTotal: isCashTournament ? (storedPrizePool > 0 ? storedPrizePool : calculatedCashPool) : storedPrizePool,', "cash prize pool normalization");
  source = replaceOnce(source, '    platformFeeTotal: Number(row.platformFeeTotal ?? row.platform_fee_total ?? 0),', lines('    platformFeeRate,', '    platformFeeTotal: Number(row.platformFeeTotal ?? row.platform_fee_total ?? 0),'), "platform fee rate payload", "    platformFeeRate,");
  source = replaceOnce(source, '    prizeType: isFreeCardCup ? "card" : (row.prizeType ?? row.prize_type ?? "goods"),', '    prizeType: isFreeCardCup ? "card" : normalizedPrizeType,', "normalized prize type");
  source = replaceOnce(source, '    prizeDescription: isFreeCardCup ? freeCardTitle : (displayPrize?.title || row.prizeDescription || row.prize_description || "Prize Vault ladder"),', '    prizeDescription: isFreeCardCup ? freeCardTitle : isCashTournament ? (row.prizeDescription || row.prize_description || "Cash prize pool") : (displayPrize?.title || row.prizeDescription || row.prize_description || "Prize Vault ladder"),', "cash prize description");
  source = replaceOnce(source, '    prizeKey: isFreeCardCup ? `free-${prizeCardRarity || rarity}-card` : (displayPrize?.key || row.prizeKey || row.prize_key || null),', '    prizeKey: isFreeCardCup ? `free-${prizeCardRarity || rarity}-card` : isCashTournament ? (row.prizeKey || row.prize_key || "user-cash") : (displayPrize?.key || row.prizeKey || row.prize_key || null),', "cash prize key");
  source = replaceOnce(source, '    prizeValue: isFreeCardCup ? 0 : (displayPrize?.value || 0),', '    prizeValue: isFreeCardCup ? 0 : isCashTournament ? (storedPrizePool > 0 ? storedPrizePool : calculatedCashPool) : (displayPrize?.value || 0),', "cash prize value");
  source = replaceOnce(source, '    prizeUnlockTarget: isFreeCardCup ? 0 : (displayPrize?.unlockTarget || 0),', '    prizeUnlockTarget: isFreeCardCup || isCashTournament ? 0 : (displayPrize?.unlockTarget || 0),', "cash unlock target");
  source = replaceOnce(source, '    requiredEntrants: isFreeCardCup ? 0 : (displayPrize?.requiredEntrants || 0),', '    requiredEntrants: isFreeCardCup || isCashTournament ? 0 : (displayPrize?.requiredEntrants || 0),', "cash required entrants");
  source = replaceOnce(source, '    currentEntrantRevenue: toMoney(entryCount * entryFee),', '    currentEntrantRevenue,', "revenue normalization");
  source = replaceOnce(source, '    prizeUnlocked: isFreeCardCup ? true : Boolean(activePrize),', '    prizeUnlocked: isFreeCardCup || isCashTournament ? true : Boolean(activePrize),', "cash prize unlocked display");
  source = replaceOnce(source, '    activePrize: isFreeCardCup ? { key: `free-${prizeCardRarity || rarity}-card`, title: freeCardTitle, value: 0, category: "card", rarity: prizeCardRarity || rarity } : activePrize,', '    activePrize: isFreeCardCup ? { key: `free-${prizeCardRarity || rarity}-card`, title: freeCardTitle, value: 0, category: "card", rarity: prizeCardRarity || rarity } : isCashTournament ? null : activePrize,', "cash active prize");
  source = replaceOnce(source, '    nextPrize: isFreeCardCup ? null : nextPrize,', '    nextPrize: isFreeCardCup || isCashTournament ? null : nextPrize,', "cash next prize");
  source = replaceOnce(source, '    entrantsToNext: isFreeCardCup ? 0 : ladderState.entrantsToNext,', '    entrantsToNext: isFreeCardCup || isCashTournament ? 0 : ladderState.entrantsToNext,', "cash entrants to next");
  source = replaceOnce(source, '    marginMultiplier: isFreeCardCup ? 0 : (RARITY_MARGIN_MULTIPLIERS[rarity as keyof typeof RARITY_MARGIN_MULTIPLIERS] || 1.8),', '    marginMultiplier: isFreeCardCup || isCashTournament ? 0 : (RARITY_MARGIN_MULTIPLIERS[rarity as keyof typeof RARITY_MARGIN_MULTIPLIERS] || 1.8),', "cash margin multiplier");
  source = replaceOnce(source, '    isFreeCardCup,\n    ladderRarity: rarity,', lines('    isFreeCardCup,', '    prizeDistribution,', '    prizeDistributionRules,', '    ladderRarity: rarity,'), "distribution payload", "    prizeDistributionRules,");

  source = replaceOnce(source, '      c.created_by_user_id, c.join_pin, c.visibility, c.max_entries,', '      c.created_by_user_id as "createdByUserId", c.join_pin, c.visibility, c.max_entries,', "competition creator alias");
  source = replaceOnce(
    source,
    '      c.prize_description as "prizeDescription",\n      c.prize_key as "prizeKey"',
    lines(
      '      c.prize_description as "prizeDescription",',
      '      c.prize_key as "prizeKey",',
      '      coalesce(c.prize_distribution, \'winner_takes_all\') as "prizeDistribution",',
      '      coalesce(c.prize_distribution_rules, \'[{"rank":1,"percent":100}]\'::jsonb) as "prizeDistributionRules"',
    ),
    "competition payout payload",
    'as "prizeDistributionRules"',
  );
  source = replaceOnce(
    source,
    '      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_key text`);',
    lines(
      '      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_key text`);',
      '      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_distribution text DEFAULT \'winner_takes_all\'`);',
      '      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_distribution_rules jsonb DEFAULT \'[{"rank":1,"percent":100}]\'::jsonb`);',
    ),
    "runtime payout schema",
    "prize_distribution_rules jsonb DEFAULT",
  );

  const adminBase = lines(
    '      const tier = allowedTier(req.body?.tier);',
    '      const status = allowedStatus(requestedStatus);',
    '      const entryFee = toMoney(req.body?.entryFee || getEntryFeeForRarity(tier));',
    '      const maxEntries = Number(req.body?.maxEntries || 0) > 1 ? Number(req.body.maxEntries) : null;',
    '      const visibility = String(req.body?.visibility || "public") === "private" ? "private" : "public";',
    '      const prizeType = allowedPrizeType(req.body?.prizeType || "goods");',
    '      const prizeDescription = String(req.body?.prizeDescription || "Prize Vault ladder").trim();',
    '      const prizeKey = String(req.body?.prizeKey || "ladder").trim();',
  );
  const adminModes = lines(
    '      const tier = allowedTier(req.body?.tier);',
    '      const status = allowedStatus(requestedStatus);',
    '      const prizeMode = String(req.body?.prizeMode || "ladder").toLowerCase() === "card" ? "card" : "ladder";',
    '      const prizeCardRarity = allowedTier(req.body?.prizeCardRarity || (tier === "common" ? "rare" : tier));',
    '      const entryFee = prizeMode === "card" ? 0 : toMoney(req.body?.entryFee || getEntryFeeForRarity(tier));',
    '      const maxEntries = Number(req.body?.maxEntries || 0) > 1 ? Number(req.body.maxEntries) : null;',
    '      const visibility = String(req.body?.visibility || "public") === "private" ? "private" : "public";',
    '      const prizeType = "goods";',
    '      const prizeDescription = prizeMode === "card" ? `${prizeCardRarity.charAt(0).toUpperCase() + prizeCardRarity.slice(1)} Player Card` : `${tier.charAt(0).toUpperCase() + tier.slice(1)} Prize Vault ladder`;',
    '      const prizeKey = prizeMode === "card" ? `free-${prizeCardRarity}-card` : "ladder";',
    '      const prizeCardValue = prizeMode === "card" ? prizeCardRarity : null;',
    '      const platformFeeRate = prizeMode === "card" ? 0 : 0.2;',
  );
  // POST and PATCH contain the same configuration block, so replace both occurrences.
  if (!source.includes('const prizeMode = String(req.body?.prizeMode || "ladder")')) {
    const matches = source.split(adminBase).length - 1;
    if (matches < 2) throw new Error("Tournament creator server patch anchor not found: admin prize modes");
    source = source.split(adminBase).join(adminModes);
  }
  source = source.replaceAll('${tier === "common" ? "rare" : tier}', '${prizeCardValue}');
  source = source.replace(
    '${req.authUserId}, ${pin}, ${visibility}, ${maxEntries}, 0.2, 0, 0, ${prizeType}, ${prizeDescription}, ${prizeKey}) returning *`);',
    '${req.authUserId}, ${pin}, ${visibility}, ${maxEntries}, ${platformFeeRate}, 0, 0, ${prizeType}, ${prizeDescription}, ${prizeKey}) returning *`);',
  );
  source = source.replace(
    'max_entries=${maxEntries}, prize_type=${prizeType}, prize_description=${prizeDescription}, prize_key=${prizeKey} where id=${id} returning *`);',
    'max_entries=${maxEntries}, platform_fee_rate=${platformFeeRate}, prize_type=${prizeType}, prize_description=${prizeDescription}, prize_key=${prizeKey} where id=${id} returning *`);',
  );

  write(rel, source);
}

// Settlement: creator cash tournaments use their configured winner/top-3 split; admin Prize Ladder remains official.
{
  const rel = "server/routes/economyIntegrity.routes.ts";
  let source = read(rel);

  source = source.replace('    && !competition?.createdByUserId\n', '');
  source = source.replace('              and c.created_by_user_id is null\n', '');
  source = replaceOnce(
    source,
    '            prize_card_rarity::text as "prizeCardRarity", created_by_user_id as "createdByUserId"',
    lines(
      '            prize_card_rarity::text as "prizeCardRarity", created_by_user_id as "createdByUserId",',
      '            coalesce(prize_distribution, \'winner_takes_all\') as "prizeDistribution",',
      '            coalesce(prize_distribution_rules, \'[{"rank":1,"percent":100}]\'::jsonb) as "prizeDistributionRules"',
    ),
    "settlement distribution fields",
    'as "prizeDistributionRules"',
  );
  source = replaceOnce(
    source,
    '        const payoutPercentages = [0.6, 0.3, 0.1];',
    lines(
      '        const creatorCashTournament = cashPoolEnabled && String(competition.prizeKey || "").toLowerCase() === "user-cash";',
      '        const distributionMode = creatorCashTournament && String(competition.prizeDistribution || "winner_takes_all").toLowerCase() === "top3" ? "top3" : "winner_takes_all";',
      '        const configuredRules = Array.isArray(competition.prizeDistributionRules) ? competition.prizeDistributionRules : [];',
      '        const configuredTop3 = [1, 2, 3].map((rank) => {',
      '          const row = configuredRules.find((rule: any) => Number(rule?.rank) === rank);',
      '          return Math.max(0, Number(row?.percent || 0)) / 100;',
      '        });',
      '        const configuredTotal = configuredTop3.reduce((sum, value) => sum + value, 0);',
      '        const payoutPercentages = creatorCashTournament',
      '          ? distributionMode === "top3" && Math.abs(configuredTotal - 1) < 0.0001',
      '            ? configuredTop3',
      '            : [1]',
      '          : [0.6, 0.3, 0.1];',
    ),
    "creator payout split",
    "const creatorCashTournament = cashPoolEnabled",
  );
  source = replaceOnce(
    source,
    '            prizeVault,\n            sharedEntries,',
    lines(
      '            prizeVault,',
      '            prizeDistribution: creatorCashTournament ? distributionMode : null,',
      '            prizeDistributionRules: creatorCashTournament ? competition.prizeDistributionRules : null,',
      '            sharedEntries,',
    ),
    "settlement payout metadata",
    "prizeDistribution: creatorCashTournament ? distributionMode",
  );
  source = replaceOnce(
    source,
    '          winnersCount: cashPoolEnabled ? Math.min(3, ranked.length) : awardRecord ? 1 : 0,',
    '          winnersCount: cashPoolEnabled ? Math.min(payoutPercentages.filter((value: number) => value > 0).length, ranked.length) : (freeCardCup || awardRecord) ? 1 : 0,',
    "settlement winners count",
    "payoutPercentages.filter((value: number) => value > 0).length",
  );

  write(rel, source);
}

// Creator management: permanent share code and cash-only duplicates at 10% platform fee.
{
  const rel = "server/routes/tournamentCreator.routes.ts";
  let source = read(rel);

  source = replaceOnce(
    source,
    'import { adminAdjustmentPostingKey, postWalletAmountExactlyOnce } from "../services/walletPosting.js";',
    lines(
      'import { adminAdjustmentPostingKey, postWalletAmountExactlyOnce } from "../services/walletPosting.js";',
      'import { ensureTournamentSchema } from "./tournamentSchema.ensure.js";',
    ),
    "creator schema import",
    'import { ensureTournamentSchema } from "./tournamentSchema.ensure.js";',
  );
  source = replaceOnce(
    source,
    '    try {\n      const userId = String(req.authUserId || "");\n      const result = await db.execute(sql`\n        select\n          c.*,',
    '    try {\n      await ensureTournamentSchema();\n      const userId = String(req.authUserId || "");\n      const result = await db.execute(sql`\n        select\n          c.*,',
    "mine schema ensure",
    "await ensureTournamentSchema();\n      const userId = String(req.authUserId || \"\");\n      const result",
  );
  source = replaceOnce(
    source,
    '      return res.json({ tournaments: rowsOf(result) });',
    lines(
      '      const tournaments = rowsOf(result);',
      '      // CREATOR_PERMANENT_SHARE_CODE_V2',
      '      for (const tournament of tournaments) {',
      '        if (String(tournament.join_pin || "").trim()) continue;',
      '        const pin = await generateUniquePin();',
      '        await db.execute(sql`update app.competitions set join_pin = ${pin} where id = ${Number(tournament.id)} and created_by_user_id = ${userId}`);',
      '        tournament.join_pin = pin;',
      '      }',
      '      return res.json({ tournaments });',
    ),
    "persistent creator share code",
    "CREATOR_PERMANENT_SHARE_CODE_V2",
  );
  source = replaceOnce(
    source,
    '      const pin = String(source.visibility || "private") === "private" ? await generateUniquePin() : null;',
    '      const pin = await generateUniquePin();',
    "duplicate permanent code",
  );
  source = replaceOnce(
    source,
    '          created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total, prize_pool_total',
    '          created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total, prize_pool_total,\n          prize_type, prize_description, prize_key, prize_distribution, prize_distribution_rules',
    "duplicate cash columns",
    "prize_type, prize_description, prize_key, prize_distribution, prize_distribution_rules",
  );
  source = replaceOnce(
    source,
    '          ${`${source.name || "Tournament"} Copy`}, ${source.tier}, ${Number(source.entry_fee || source.entryFee || 0)}, \'open\', ${Number(source.game_week || source.gameWeek || 1)}, now(), now() + interval \'7 days\', ${source.prize_card_rarity || source.prizeCardRarity || source.tier},\n          ${userId}, ${pin}, ${source.visibility || "private"}, ${source.max_entries || source.maxEntries || null}, ${Number(source.platform_fee_rate || 0.1)}, 0, 0',
    '          ${`${source.name || "Tournament"} Copy`}, ${source.tier}, ${Math.max(0.01, Number(source.entry_fee || source.entryFee || 0))}, \'open\', ${Number(source.game_week || source.gameWeek || 1)}, now(), now() + interval \'7 days\', null,\n          ${userId}, ${pin}, ${source.visibility || "private"}, ${source.max_entries || source.maxEntries || null}, 0.1, 0, 0,\n          \'cash_pool\', \'Cash prize pool\', \'user-cash\', ${String(source.prize_distribution || "winner_takes_all") === "top3" ? "top3" : "winner_takes_all"}, ${JSON.stringify(Array.isArray(source.prize_distribution_rules) ? source.prize_distribution_rules : [{ rank: 1, percent: 100 }])}::jsonb',
    "duplicate cash values",
    "'user-cash', ${String(source.prize_distribution",
  );

  write(rel, source);
}

console.log("[tournaments] Applied admin card prizes, cash-only creator rules, 10% fees, payout splits and permanent share codes");

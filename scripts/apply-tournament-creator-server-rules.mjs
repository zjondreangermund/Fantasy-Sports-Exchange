import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function write(rel, source) { fs.writeFileSync(path.join(root, rel), source); }
function replaceRequired(source, from, to, label, marker = to) {
  if (source.includes(marker)) return source;
  if (!source.includes(from)) throw new Error(`Tournament creator server patch anchor not found: ${label}`);
  return source.replace(from, to);
}
function replaceSection(source, startToken, endToken, replacement, label, marker) {
  if (marker && source.includes(marker)) return source;
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Tournament creator server section start not found: ${label}`);
  const end = source.indexOf(endToken, start);
  if (end < 0) throw new Error(`Tournament creator server section end not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// Public competition normalization: user-created tournaments are cash-only and must never inherit Prize Ladder display data.
{
  const rel = "server/routes.ts";
  let source = read(rel);

  const normalizeReplacement = String.raw`function normalizeCompetitionRow(row: any) {
  if (!row) return row;
  // TOURNAMENT_CREATOR_RULES_V2
  const rarity = String(row.tier || row.rarity || "common").toLowerCase();
  const entryFee = Number(row.entryFee ?? row.entry_fee ?? getEntryFeeForRarity(rarity));
  const entryCount = Number(row.entryCount ?? row.entry_count ?? 0);
  const prizeCardRarity = String(row.prizeCardRarity ?? row.prize_card_rarity ?? "").toLowerCase();
  const normalizedPrizeType = String(row.prizeType ?? row.prize_type ?? "goods").toLowerCase();
  const isCashTournament = normalizedPrizeType === "cash_pool";
  const isFreeCardCup = entryFee <= 0 && Boolean(prizeCardRarity) && !isCashTournament;
  const ladderState = isFreeCardCup || isCashTournament
    ? { activePrize: null, nextPrize: null, entrantsToNext: 0 }
    : getActivePrizeForEntries(rarity, entryCount);
  const activePrize = ladderState.activePrize;
  const nextPrize = ladderState.nextPrize;
  const displayPrize = activePrize || nextPrize;
  const freeCardTitle = prizeCardRarity ? \`\${prizeCardRarity.charAt(0).toUpperCase() + prizeCardRarity.slice(1)} Player Card\` : "Player Card";
  const platformFeeRate = Math.max(0, Math.min(1, Number(row.platformFeeRate ?? row.platform_fee_rate ?? (isCashTournament ? 0.1 : 0.2))));
  const currentEntrantRevenue = toMoney(entryCount * entryFee);
  const calculatedCashPool = toMoney(currentEntrantRevenue * (1 - platformFeeRate));
  const storedPrizePool = Number(row.prizePoolTotal ?? row.prize_pool_total ?? 0);
  const prizeDistribution = String(row.prizeDistribution ?? row.prize_distribution ?? "winner_takes_all");
  const prizeDistributionRules = Array.isArray(row.prizeDistributionRules ?? row.prize_distribution_rules)
    ? (row.prizeDistributionRules ?? row.prize_distribution_rules)
    : prizeDistribution === "top3"
      ? [{ rank: 1, percent: 60 }, { rank: 2, percent: 30 }, { rank: 3, percent: 10 }]
      : [{ rank: 1, percent: 100 }];

  return {
    ...row,
    entryFee,
    entryCount,
    createdByUserId: row.createdByUserId ?? row.created_by_user_id ?? null,
    maxEntries: row.maxEntries ?? row.max_entries ?? null,
    joinPin: row.joinPin ?? row.join_pin ?? null,
    platformFeeRate,
    platformFeeTotal: Number(row.platformFeeTotal ?? row.platform_fee_total ?? 0),
    prizePoolTotal: isCashTournament ? (storedPrizePool > 0 ? storedPrizePool : calculatedCashPool) : storedPrizePool,
    prizeType: isFreeCardCup ? "card" : normalizedPrizeType,
    prizeDescription: isFreeCardCup
      ? freeCardTitle
      : isCashTournament
        ? (row.prizeDescription || row.prize_description || "Cash prize pool")
        : (displayPrize?.title || row.prizeDescription || row.prize_description || "Prize Vault ladder"),
    prizeKey: isFreeCardCup
      ? \`free-\${prizeCardRarity || rarity}-card\`
      : isCashTournament
        ? (row.prizeKey || row.prize_key || "user-cash")
        : (displayPrize?.key || row.prizeKey || row.prize_key || null),
    prizeValue: isFreeCardCup ? 0 : isCashTournament ? (storedPrizePool > 0 ? storedPrizePool : calculatedCashPool) : (displayPrize?.value || 0),
    prizeUnlockTarget: isFreeCardCup || isCashTournament ? 0 : (displayPrize?.unlockTarget || 0),
    requiredEntrants: isFreeCardCup || isCashTournament ? 0 : (displayPrize?.requiredEntrants || 0),
    currentEntrantRevenue,
    prizeUnlocked: isFreeCardCup || isCashTournament ? true : Boolean(activePrize),
    activePrize: isFreeCardCup ? { key: \`free-\${prizeCardRarity || rarity}-card\`, title: freeCardTitle, value: 0, category: "card", rarity: prizeCardRarity || rarity } : isCashTournament ? null : activePrize,
    nextPrize: isFreeCardCup || isCashTournament ? null : nextPrize,
    entrantsToNext: isFreeCardCup || isCashTournament ? 0 : ladderState.entrantsToNext,
    marginMultiplier: isFreeCardCup || isCashTournament ? 0 : (RARITY_MARGIN_MULTIPLIERS[rarity as keyof typeof RARITY_MARGIN_MULTIPLIERS] || 1.8),
    isFreeCardCup,
    prizeDistribution,
    prizeDistributionRules,
    ladderRarity: rarity,
    season: SEASON_KEY,
  };
}

`;
  source = replaceSection(source, "function normalizeCompetitionRow(row: any) {", "async function loadCompetitions", normalizeReplacement, "competition normalization", "TOURNAMENT_CREATOR_RULES_V2");

  source = replaceRequired(
    source,
    '      c.created_by_user_id, c.join_pin, c.visibility, c.max_entries,',
    '      c.created_by_user_id as "createdByUserId", c.join_pin, c.visibility, c.max_entries,',
    "competition creator alias",
  );
  source = replaceRequired(
    source,
    '      c.prize_description as "prizeDescription",\n      c.prize_key as "prizeKey"',
    '      c.prize_description as "prizeDescription",\n      c.prize_key as "prizeKey",\n      coalesce(c.prize_distribution, \'winner_takes_all\') as "prizeDistribution",\n      coalesce(c.prize_distribution_rules, \'[{"rank":1,"percent":100}]\'::jsonb) as "prizeDistributionRules"',
    "competition payout fields",
    'as "prizeDistributionRules"',
  );
  source = replaceRequired(
    source,
    '      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_key text`);',
    '      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_key text`);\n      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_distribution text DEFAULT \'winner_takes_all\'`);\n      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_distribution_rules jsonb DEFAULT \'[{"rank":1,"percent":100}]\'::jsonb`);',
    "runtime payout schema",
    "prize_distribution_rules jsonb",
  );

  const adminPost = String.raw`  app.post("/api/admin/competitions", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const name = String(req.body?.name || "").trim();
      const gameWeek = Math.max(1, Math.min(38, Number(req.body?.gameWeek || 1)));
      if (!name) return res.status(400).json({ message: "Tournament name required" });
      const requestedStatus = String(req.body?.status || "open").toLowerCase();
      if (requestedStatus === "completed") return res.status(400).json({ message: "Use the settlement action to complete a tournament" });
      const tier = allowedTier(req.body?.tier);
      const status = allowedStatus(requestedStatus);
      const requestedVisibility = String(req.body?.visibility || "public") === "private" ? "private" : "public";
      const prizeMode = String(req.body?.prizeMode || "ladder").toLowerCase() === "card" ? "card" : "ladder";
      const prizeCardRarity = allowedTier(req.body?.prizeCardRarity || (tier === "common" ? "rare" : tier));
      const entryFee = prizeMode === "card" ? 0 : toMoney(req.body?.entryFee || getEntryFeeForRarity(tier));
      const maxEntries = Number(req.body?.maxEntries || 0) > 1 ? Number(req.body.maxEntries) : null;
      const visibility = prizeMode === "ladder" ? "public" : requestedVisibility;
      const prizeType = "goods";
      const prizeDescription = prizeMode === "card" ? \`\${prizeCardRarity.charAt(0).toUpperCase() + prizeCardRarity.slice(1)} Player Card\` : \`\${tier.charAt(0).toUpperCase() + tier.slice(1)} Prize Vault ladder\`;
      const prizeKey = prizeMode === "card" ? \`free-\${prizeCardRarity}-card\` : "ladder";
      const prizeCardValue = prizeMode === "card" ? prizeCardRarity : null;
      const startDate = req.body?.startDate ? new Date(String(req.body.startDate)) : fallbackGameweekKickoff(gameWeek);
      const endDate = req.body?.endDate ? new Date(String(req.body.endDate)) : new Date(startDate.getTime() + 3 * 86400000);
      const pin = visibility === "private" ? normalizePin(Math.random().toString(36).slice(2, 8).toUpperCase()) : null;
      const platformFeeRate = prizeMode === "card" ? 0 : 0.2;
      const result = await db.execute(sql`
        insert into app.competitions (
          name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity,
          created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total,
          prize_pool_total, prize_type, prize_description, prize_key
        ) values (
          \${name}, \${tier}, \${entryFee}, \${status}, \${gameWeek}, \${startDate}, \${endDate}, \${prizeCardValue},
          \${req.authUserId}, \${pin}, \${visibility}, \${maxEntries}, \${platformFeeRate}, 0,
          0, \${prizeType}, \${prizeDescription}, \${prizeKey}
        ) returning *
      `);
      return res.json({ success: true, tournament: rowsOf(result)[0] || null, prizeMode, pin });
    } catch (error: any) { console.error("Failed to create admin tournament:", error); return res.status(500).json({ message: error?.message || "Failed to create tournament" }); }
  });

`;
  source = replaceSection(source, '  app.post("/api/admin/competitions"', '  app.patch("/api/admin/competitions/:id"', adminPost, "admin tournament create", "const prizeMode = String(req.body?.prizeMode");

  const adminPatch = String.raw`  app.patch("/api/admin/competitions/:id", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Valid tournament required" });
      const name = String(req.body?.name || "").trim();
      const gameWeek = Math.max(1, Math.min(38, Number(req.body?.gameWeek || 1)));
      if (!name) return res.status(400).json({ message: "Tournament name required" });
      const requestedStatus = String(req.body?.status || "open").toLowerCase();
      if (requestedStatus === "completed") return res.status(400).json({ message: "Use the settlement action to complete a tournament" });
      const tier = allowedTier(req.body?.tier);
      const status = allowedStatus(requestedStatus);
      const requestedVisibility = String(req.body?.visibility || "public") === "private" ? "private" : "public";
      const prizeMode = String(req.body?.prizeMode || "ladder").toLowerCase() === "card" ? "card" : "ladder";
      const prizeCardRarity = allowedTier(req.body?.prizeCardRarity || (tier === "common" ? "rare" : tier));
      const entryFee = prizeMode === "card" ? 0 : toMoney(req.body?.entryFee || getEntryFeeForRarity(tier));
      const maxEntries = Number(req.body?.maxEntries || 0) > 1 ? Number(req.body.maxEntries) : null;
      const visibility = prizeMode === "ladder" ? "public" : requestedVisibility;
      const prizeType = "goods";
      const prizeDescription = prizeMode === "card" ? \`\${prizeCardRarity.charAt(0).toUpperCase() + prizeCardRarity.slice(1)} Player Card\` : \`\${tier.charAt(0).toUpperCase() + tier.slice(1)} Prize Vault ladder\`;
      const prizeKey = prizeMode === "card" ? \`free-\${prizeCardRarity}-card\` : "ladder";
      const prizeCardValue = prizeMode === "card" ? prizeCardRarity : null;
      const startDate = req.body?.startDate ? new Date(String(req.body.startDate)) : fallbackGameweekKickoff(gameWeek);
      const endDate = req.body?.endDate ? new Date(String(req.body.endDate)) : new Date(startDate.getTime() + 3 * 86400000);
      const platformFeeRate = prizeMode === "card" ? 0 : 0.2;
      const result = await db.execute(sql`
        update app.competitions
        set name=\${name}, tier=\${tier}, entry_fee=\${entryFee}, status=\${status}, game_week=\${gameWeek},
            start_date=\${startDate}, end_date=\${endDate}, prize_card_rarity=\${prizeCardValue}, visibility=\${visibility},
            max_entries=\${maxEntries}, platform_fee_rate=\${platformFeeRate}, prize_type=\${prizeType},
            prize_description=\${prizeDescription}, prize_key=\${prizeKey}
        where id=\${id}
        returning *
      `);
      return res.json({ success: true, tournament: rowsOf(result)[0] || null, prizeMode });
    } catch (error: any) { console.error("Failed to update admin tournament:", error); return res.status(500).json({ message: error?.message || "Failed to update tournament" }); }
  });

`;
  source = replaceSection(source, '  app.patch("/api/admin/competitions/:id"', '  app.get("/api/user"', adminPatch, "admin tournament update", "const platformFeeRate = prizeMode === \"card\"");

  write(rel, source);
}

// Settlement: Prize Ladder is admin-only, creator cash tournaments use their configured payout split, and Free Card Cups keep card awards.
{
  const rel = "server/routes/economyIntegrity.routes.ts";
  let source = read(rel);

  const officialPrizeFn = String.raw`function isOfficialPrizeVaultCompetition(competition: any): boolean {
  return String(competition?.visibility || "public").toLowerCase() === "public"
    && String(competition?.prizeKey || "").toLowerCase() === "ladder"
    && String(competition?.prizeType || "goods").toLowerCase() === "goods";
}

`;
  source = replaceSection(source, "function isOfficialPrizeVaultCompetition", "async function resolveEntryDeadline", officialPrizeFn, "official Prize Ladder guard", "String(competition?.prizeKey || \"\").toLowerCase() === \"ladder\"");

  source = replaceRequired(
    source,
    '            prize_card_rarity::text as "prizeCardRarity", created_by_user_id as "createdByUserId"',
    '            prize_card_rarity::text as "prizeCardRarity", created_by_user_id as "createdByUserId",\n            coalesce(prize_distribution, \'winner_takes_all\') as "prizeDistribution",\n            coalesce(prize_distribution_rules, \'[{"rank":1,"percent":100}]\'::jsonb) as "prizeDistributionRules"',
    "settlement payout fields",
    'as "prizeDistributionRules"',
  );

  source = source.replace("\n              and c.created_by_user_id is null", "");

  source = replaceRequired(
    source,
    '        const payoutPercentages = [0.6, 0.3, 0.1];',
    String.raw`        const creatorCashTournament = cashPoolEnabled && String(competition.prizeKey || "").toLowerCase() === "user-cash";
        const distributionMode = creatorCashTournament && String(competition.prizeDistribution || "winner_takes_all").toLowerCase() === "top3" ? "top3" : "winner_takes_all";
        const configuredRules = Array.isArray(competition.prizeDistributionRules) ? competition.prizeDistributionRules : [];
        const configuredTop3 = [1, 2, 3].map((rank) => {
          const row = configuredRules.find((rule: any) => Number(rule?.rank) === rank);
          return Math.max(0, Number(row?.percent || 0)) / 100;
        });
        const configuredTotal = configuredTop3.reduce((sum, value) => sum + value, 0);
        const payoutPercentages = creatorCashTournament
          ? distributionMode === "top3" && Math.abs(configuredTotal - 1) < 0.0001
            ? configuredTop3
            : [1]
          : [0.6, 0.3, 0.1];`,
    "creator cash payout percentages",
    "const creatorCashTournament = cashPoolEnabled",
  );

  source = replaceRequired(
    source,
    '            prizeVault,\n            sharedEntries,',
    '            prizeVault,\n            prizeDistribution: creatorCashTournament ? distributionMode : null,\n            prizeDistributionRules: creatorCashTournament ? competition.prizeDistributionRules : null,\n            sharedEntries,',
    "settlement payout metadata",
    "prizeDistribution: creatorCashTournament ? distributionMode",
  );

  source = replaceRequired(
    source,
    '          winnersCount: cashPoolEnabled ? Math.min(3, ranked.length) : awardRecord ? 1 : 0,',
    '          winnersCount: cashPoolEnabled ? Math.min(payoutPercentages.filter((value: number) => value > 0).length, ranked.length) : (freeCardCup || awardRecord) ? 1 : 0,',
    "settlement winners count",
    "payoutPercentages.filter((value: number) => value > 0).length",
  );

  write(rel, source);
}

// Creator hub server: every user tournament always has a share code, and duplicates stay cash-only at 10% platform fee.
{
  const rel = "server/routes/tournamentCreator.routes.ts";
  let source = read(rel);

  source = replaceRequired(
    source,
    'import { adminAdjustmentPostingKey, postWalletAmountExactlyOnce } from "../services/walletPosting.js";',
    'import { adminAdjustmentPostingKey, postWalletAmountExactlyOnce } from "../services/walletPosting.js";\nimport { ensureTournamentSchema } from "./tournamentSchema.ensure.js";',
    "tournament schema import",
    'import { ensureTournamentSchema } from "./tournamentSchema.ensure.js";',
  );

  source = replaceRequired(
    source,
    '    try {\n      const userId = String(req.authUserId || "");\n      const result = await db.execute(sql`',
    '    try {\n      await ensureTournamentSchema();\n      const userId = String(req.authUserId || "");\n      const result = await db.execute(sql`',
    "mine schema ensure",
    "await ensureTournamentSchema();\n      const userId = String(req.authUserId || \"\");\n      const result",
  );

  source = replaceRequired(
    source,
    '      return res.json({ tournaments: rowsOf(result) });',
    String.raw`      const tournaments = rowsOf(result);
      // creatorCashTournamentShareCodeV2: legacy public tournaments also receive a permanent share code.
      for (const tournament of tournaments) {
        if (String(tournament.join_pin || "").trim()) continue;
        const pin = await generateUniquePin();
        await db.execute(sql\`update app.competitions set join_pin = \${pin} where id = \${Number(tournament.id)} and created_by_user_id = \${userId}\`);
        tournament.join_pin = pin;
      }
      return res.json({ tournaments });`,
    "persistent creator share codes",
    "creatorCashTournamentShareCodeV2",
  );

  const duplicateRoute = String.raw`  app.post("/api/user-tournaments/:id/duplicate", requireAuth, async (req: any, res) => {
    try {
      await ensureTournamentSchema();
      const userId = String(req.authUserId || "");
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament ID required" });
      const sourceTournament = await getOwnedTournament(userId, competitionId);
      if (!sourceTournament) return res.status(404).json({ message: "Tournament not found" });
      const pin = await generateUniquePin();
      const tier = String(sourceTournament.tier || "common").toLowerCase();
      const fallbackFee = ({ common: 10, rare: 50, unique: 100, epic: 250, legendary: 500 } as Record<string, number>)[tier] || 10;
      const entryFee = Number(sourceTournament.entry_fee || sourceTournament.entryFee || 0) > 0 ? Number(sourceTournament.entry_fee || sourceTournament.entryFee) : fallbackFee;
      const distribution = String(sourceTournament.prize_distribution || "winner_takes_all") === "top3" ? "top3" : "winner_takes_all";
      const rules = Array.isArray(sourceTournament.prize_distribution_rules)
        ? sourceTournament.prize_distribution_rules
        : distribution === "top3"
          ? [{ rank: 1, percent: 60 }, { rank: 2, percent: 30 }, { rank: 3, percent: 10 }]
          : [{ rank: 1, percent: 100 }];
      const result = await db.execute(sql`
        insert into app.competitions (
          name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity,
          created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total,
          prize_pool_total, prize_type, prize_description, prize_key, prize_distribution, prize_distribution_rules
        ) values (
          \${`\${sourceTournament.name || "Tournament"} Copy`}, \${sourceTournament.tier}, \${entryFee}, 'open', \${Number(sourceTournament.game_week || sourceTournament.gameWeek || 1)}, now(), now() + interval '7 days', null,
          \${userId}, \${pin}, \${sourceTournament.visibility || "private"}, \${sourceTournament.max_entries || sourceTournament.maxEntries || null}, .1, 0,
          0, 'cash_pool', 'Cash prize pool', 'user-cash', \${distribution}, \${JSON.stringify(rules)}::jsonb
        ) returning *
      `);
      return res.json({ success: true, tournament: rowsOf(result)[0] || null, pin, platformFeeRate: 0.1 });
    } catch (error: any) {
      console.error("Failed to duplicate tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to duplicate tournament" });
    }
  });

`;
  source = replaceSection(source, '  app.post("/api/user-tournaments/:id/duplicate"', '  app.delete("/api/user-tournaments/:id"', duplicateRoute, "cash-only tournament duplicate", "sourceTournament.prize_distribution");

  write(rel, source);
}

console.log("[tournaments] Applied admin card prizes, cash-only creator rules, 10% fees, payout splits and persistent share codes");

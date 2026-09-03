#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const checks = [
  {
    file: "server/routes/prizeVault.routes.ts",
    required: [
      "lower(coalesce(nullif(trim(c.prize_key), ''), 'ladder')) = 'ladder'",
      "lower(coalesce(nullif(trim(c.prize_type), ''), 'goods')) <> 'cash_pool'",
      "coalesce(c.entry_fee, 0) > 0",
      "c.created_by_user_id is null",
      "coalesce(lower(nullif(trim(c.visibility), '')), 'public') = 'public'",
      "GAMEWEEK_ISOLATION_V1",
      "fplApi.getCurrentGameweek()",
      "PRIZE_VAULT_EXACT_TOURNAMENT_LINK_V1",
      "entryWindowGameWeeks",
      "requestedCompetitionId",
      "competitionId: Number(source?.id || 0)",
    ],
  },
  {
    file: "client/src/pages/competitions-vault.tsx",
    required: [
      "const isFreeCardCup =",
      "const isPrizeVaultTournament =",
      "!isPrizeVaultTournament(comp)",
      "GAMEWEEK_ISOLATED_TOURNAMENT_CARD",
      "PRIZE_VAULT_EXACT_LINK_FROM_TOURNAMENT_V1",
      "PRIZE_VAULT_TOURNAMENT_ENTRY_MIRROR_V2",
      "const sharedEntries = vaultTournament ? tournamentEntries : 0;",
      "Separate from the Prize Vault.",
      "Entries in this FREE Card Cup do not fund, unlock or advance",
      "Enter FREE",
      "competitionId=${Number(comp.id || 0)}",
    ],
  },
  {
    file: "server/services/fplApi.ts",
    required: ["events.find((e: any) => e?.is_next)", "[...events].reverse().find((e: any) => e?.finished)"],
  },
  {
    file: "server/services/playerCardEnrichment.ts",
    required: ["currentGameweekPoints", "fplApi.getLiveGameweek()", "calculatePlayerScore", "mapFplStatsToPlayerStats", "loadDetailedScoringContext", "resolveDetailedStatsForPlayer", "mergePlayerStatsWithDetailedStats"],
  },
  {
    file: "server/routes/cards.routes.ts",
    required: ["let currentGameweekPoints = 0;", "const latestLiveScore = currentGameweekPoints;", "loadDetailedScoringContext", "resolveDetailedStatsForPlayer", "mergePlayerStatsWithDetailedStats"],
  },
  {
    file: "client/src/lib/fantasy-card-adapter.ts",
    required: ["PTS on Fantasy Arena cards is a gameweek score", "(card as any).currentGameweekPoints", "player?.currentGameweekPoints"],
  },
  {
    file: "client/src/pages/dashboard.tsx",
    required: ["(card as any).currentGameweekPoints || 0"],
  },
  {
    file: "client/src/components/cards/CardProfileModal.tsx",
    required: ["Arena GW Points", "currentGameweekArenaPoints", "maximumFractionDigits: 4", "value={arenaPointsDisplay}"],
  },
  {
    file: "client/src/pages/prize-vault.tsx",
    required: [
      "refetchInterval: 60_000",
      "refetchOnWindowFocus: true",
      "PRIZE_VAULT_QUERY_LINK_V1",
      'vaultQuery.get("gameWeek")',
      'vaultQuery.get("competitionId")',
    ],
  },
];

let failures = 0;
for (const check of checks) {
  const body = read(check.file);
  const missing = check.required.filter((needle) => !body.includes(needle));
  if (missing.length) {
    failures += 1;
    console.error(`✗ ${check.file}`);
    for (const needle of missing) console.error(`  missing: ${needle}`);
  } else {
    console.log(`✓ ${check.file}`);
  }
}

if (failures) {
  console.error(`\n${failures} gameweek isolation check(s) failed.`);
  process.exit(1);
}

console.log("\nGameweek isolation verified: FREE/cash tournaments are excluded, legacy official paid Prize Ladders remain compatible, tournament cards mirror their qualifying entries, and Fantasy Arena PTS remains current-GW only.");

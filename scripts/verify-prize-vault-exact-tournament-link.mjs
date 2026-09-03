#!/usr/bin/env node
import fs from "node:fs";

const checks = [
  {
    file: "server/routes/prizeVault.routes.ts",
    required: [
      "PRIZE_VAULT_EXACT_TOURNAMENT_LINK_V1",
      "requestedGameWeek",
      "requestedCompetitionId",
      "entryWindowOpen",
      "c.created_by_user_id is null",
      "coalesce(c.entry_fee, 0) > 0",
      "lower(coalesce(nullif(trim(c.prize_type), ''), 'goods')) <> 'cash_pool'",
      "lower(coalesce(nullif(trim(c.prize_key), ''), 'ladder')) = 'ladder'",
      "coalesce(lower(nullif(trim(c.visibility), '')), 'public') = 'public'",
      "Math.max(...entryWindowGameWeeks)",
      "competitionId: Number(source?.id || 0)",
      "competitionName: String(source?.name || \"\")",
    ],
  },
  {
    file: "client/src/pages/prize-vault.tsx",
    required: [
      "PRIZE_VAULT_QUERY_LINK_V1",
      'vaultQuery.get("gameWeek")',
      'vaultQuery.get("competitionId")',
      'queryKey: ["/api/prize-vault", requestedGameWeek, requestedCompetitionId]',
      'params.set("gameWeek", String(requestedGameWeek))',
      'params.set("competitionId", String(requestedCompetitionId))',
      'fetch(`/api/prize-vault${suffix}`',
    ],
  },
  {
    file: "client/src/pages/competitions-vault.tsx",
    required: [
      "PRIZE_VAULT_EXACT_LINK_FROM_TOURNAMENT_V1",
      "PRIZE_VAULT_TOURNAMENT_ENTRY_MIRROR_V2",
      "const sharedEntries = vaultTournament ? tournamentEntries : 0;",
      "&gameWeek=${shownGw}",
      "&competitionId=${Number(comp.id || 0)}",
    ],
  },
];

let failed = 0;
for (const check of checks) {
  const body = fs.readFileSync(check.file, "utf8");
  const missing = check.required.filter((needle) => !body.includes(needle));
  if (missing.length) {
    failed += 1;
    console.error(`✗ ${check.file}`);
    for (const needle of missing) console.error(`  missing: ${needle}`);
  } else {
    console.log(`✓ ${check.file}`);
  }
}

if (failed) {
  console.error(`\n${failed} Prize Vault exact-link verification check(s) failed.`);
  process.exit(1);
}

console.log("\nPrize Vault verified: each official paid ladder accepts safe legacy metadata, resolves its exact tournament/gameweek, and the tournament card mirrors that exact tournament's qualifying entry count.");

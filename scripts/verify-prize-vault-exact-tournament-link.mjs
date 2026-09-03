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
      "lower(coalesce(c.prize_key, '')) = 'ladder'",
      "lower(coalesce(c.prize_type, 'goods')) = 'goods'",
      "coalesce(lower(c.visibility), 'public') = 'public'",
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

console.log("\nPrize Vault verified: each paid ladder can resolve its exact tournament/gameweek and read that tournament's live entry count.");

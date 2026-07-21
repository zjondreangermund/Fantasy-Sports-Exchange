#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), "utf8");

const checks = [
  {
    name: "startup preserves db push diagnostics and runs compatibility preflight first",
    file: "start.sh",
    patterns: [
      "DB_PUSH_OUTPUT=$(npm run db:push 2>&1)",
      "printf '%s\\n' \"$DB_PUSH_OUTPUT\"",
      "node scripts/prepare-runtime-startup.mjs",
      "node scripts/sync-official-tournaments.mjs",
      "exec node dist/server/server/index.js",
    ],
  },
  {
    name: "startup preflight resolves legacy enum namespaces",
    file: "scripts/prepare-runtime-startup.mjs",
    patterns: [
      "JOIN pg_namespace n ON n.oid = t.typnamespace",
      "t.typtype = 'e'",
      "n.nspname = 'app'",
      "n.nspname = 'public'",
      'ensureEnumValues(client, "competition_tier"',
      'ensureEnumValues(client, "withdrawal_status"',
    ],
    forbiddenPatterns: [
      "ALTER TYPE app.competition_tier",
      "ALTER TYPE app.withdrawal_status",
    ],
  },
  {
    name: "serial repair is collision safe and installs the supply trigger",
    file: "scripts/prepare-runtime-startup.mjs",
    patterns: [
      "LOCK TABLE app.player_cards IN SHARE ROW EXCLUSIVE MODE",
      "CREATE TEMP TABLE player_card_serial_repair_plan ON COMMIT DROP",
      "concat('__serial_repair__', pc.id)",
      "player_cards_player_rarity_serial_unique",
      "CREATE OR REPLACE FUNCTION app.enforce_player_card_serial_supply()",
      "pg_advisory_xact_lock",
      "CREATE TRIGGER player_cards_serial_supply_guard",
    ],
  },
  {
    name: "official tournament sync discovers competition enum schemas",
    file: "scripts/sync-official-tournaments.mjs",
    patterns: [
      "SELECT n.nspname AS enum_schema",
      'resolveEnumSchema(client, "competition_tier")',
      'resolveEnumSchema(client, "competition_status")',
      "const qualifiedType",
      "ALTER TYPE ${qualifiedType}",
      "competitionStatusType",
    ],
    forbiddenPatterns: ["ALTER TYPE app.competition_tier", "public.competition_status"],
  },
  {
    name: "withdrawal runtime schema discovers withdrawal enum schema",
    file: "server/services/withdrawalPayoutSchema.ts",
    patterns: [
      "import { db, pool }",
      "ensureWithdrawalStatusValues",
      "t.typname = 'withdrawal_status'",
      "quoteIdentifier(enumSchema)",
      "ADD VALUE IF NOT EXISTS 'failed'",
    ],
    forbiddenPatterns: ["ALTER TYPE app.withdrawal_status"],
  },
  {
    name: "runtime serial integrity uses one transactional service",
    file: "server/runtime-schema.ts",
    patterns: [
      "ensurePlayerCardSerialIntegrity",
      "const serialResult = await ensurePlayerCardSerialIntegrity()",
      "Canonicalized ${serialResult.repairedCount}",
    ],
    forbiddenPatterns: [
      "WITH ranked AS (\n        SELECT pc.id, pc.player_id, pc.rarity",
      "CREATE OR REPLACE FUNCTION app.enforce_player_card_serial_supply()",
    ],
  },
  {
    name: "transactional serial service protects global and per-player uniqueness",
    file: "server/services/playerCardSerials.ts",
    patterns: [
      "db.transaction",
      "LOCK TABLE app.player_cards IN SHARE ROW EXCLUSIVE MODE",
      "player_card_serial_repair_plan",
      "serial_id = concat('__serial_repair__', pc.id)",
      "player_cards_player_rarity_serial_unique",
      "pg_advisory_xact_lock",
    ],
  },
];

let failures = 0;
for (const check of checks) {
  const body = read(check.file);
  const missing = check.patterns.filter((pattern) => !body.includes(pattern));
  const forbidden = (check.forbiddenPatterns || []).filter((pattern) => body.includes(pattern));
  if (missing.length || forbidden.length) {
    failures += 1;
    console.error(`✗ ${check.name}`);
    console.error(`  ${relative(root, resolve(root, check.file))}`);
    for (const pattern of missing) console.error(`  missing: ${pattern}`);
    for (const pattern of forbidden) console.error(`  forbidden: ${pattern}`);
  } else {
    console.log(`✓ ${check.name}`);
  }
}

const start = read("start.sh");
const preflightAt = start.indexOf("node scripts/prepare-runtime-startup.mjs");
const tournamentAt = start.indexOf("node scripts/sync-official-tournaments.mjs");
const serverAt = start.indexOf("exec node dist/server/server/index.js");
if (!(preflightAt >= 0 && tournamentAt > preflightAt && serverAt > tournamentAt)) {
  failures += 1;
  console.error("✗ startup compatibility preflight must run before tournament sync and server boot");
} else {
  console.log("✓ startup compatibility preflight runs before all data mutation paths");
}

const runtimeSchema = read("server/runtime-schema.ts");
const serialAt = runtimeSchema.indexOf("await ensurePlayerCardSerialIntegrity()");
const optionalAt = runtimeSchema.indexOf("try {");
if (!(serialAt >= 0 && optionalAt > serialAt)) {
  failures += 1;
  console.error("✗ canonical serial integrity must run before optional runtime checks");
} else {
  console.log("✓ canonical serial integrity is fail-closed before optional runtime checks");
}

if (failures) {
  console.error(`\n${failures} runtime boot recovery check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} runtime boot recovery checks passed.`);

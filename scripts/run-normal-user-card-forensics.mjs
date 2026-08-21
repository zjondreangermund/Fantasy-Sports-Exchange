#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";

function patch(path, replacements) {
  if (!fs.existsSync(path)) return;
  let source = fs.readFileSync(path, "utf8");
  let next = source;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next !== source) fs.writeFileSync(path, next);
}

// Repair the legacy audit's PostgreSQL reserved-word alias at runtime so older
// production images cannot fail before the read-only report is produced.
patch("scripts/audit-and-recover-normal-user-cards.mjs", [
  ["as references", "as evidence_count"],
  ["order by references desc", "order by evidence_count desc"],
]);

// Snapshot rows store the actual player_cards column names in snake_case.
// Normalize the v2 audit before executing it so snapshot comparisons are exact.
patch("scripts/audit-normal-user-cards-v2.mjs", [
  ["i.state->>'playerId'", "i.state->>'player_id'"],
  ["i.state->>'serialId'", "i.state->>'serial_id'"],
  ["i.state->>'serialNumber'", "i.state->>'serial_number'"],
]);

for (const script of [
  "scripts/audit-and-recover-normal-user-cards.mjs",
  "scripts/audit-normal-user-cards-v2.mjs",
]) {
  if (!fs.existsSync(script)) continue;
  const result = spawnSync(process.execPath, [script], { stdio: "inherit", env: process.env });
  if ((result.status ?? 1) !== 0) {
    console.error(`[card-forensics] ${script} exited with status ${result.status ?? "unknown"}; no ownership changes were attempted.`);
  }
}

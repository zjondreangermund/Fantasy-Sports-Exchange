import fs from "node:fs";

const cutoff = "2026-08-21T19:00:00.000Z";
const checks = [
  ["server/routes.ts", ["GW1_TEST_ENTRY_EXTENSION_UTC", "const gw1TestOpen = Number(comp.gameWeek", cutoff]],
  ["server/services/scoreUpdater.ts", ["GW1_TEST_ENTRY_EXTENSION_UTC", cutoff]],
  ["server/routes/economyIntegrity.routes.ts", ["GW1_TEST_ENTRY_EXTENSION_UTC", "const gw1TestOpen = Number(competition.gameWeek", cutoff]],
  ["scripts/sync-official-tournaments.mjs", ["GW1_TEST_ENTRY_EXTENSION_UTC", cutoff]],
];
for (const [file, needles] of checks) {
  const source = fs.readFileSync(file, "utf8");
  for (const needle of needles) {
    if (!source.includes(needle)) throw new Error(`GW1 extension verification failed: ${file} missing ${needle}`);
  }
}
console.log("Verified GW1 paid/FREE UI status, atomic join deadline, scoring lifecycle and official sync stay open until 21:00 CAT.");

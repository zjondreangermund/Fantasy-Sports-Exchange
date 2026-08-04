#!/usr/bin/env node
import fs from "node:fs";

const requiredFiles = [
  "server/services/readOnlyGuard.ts",
  "server/services/securityControl.ts",
  "server/routes/dailyLoginReward.routes.ts",
  "server/services/dailyLoginReward.ts",
  "client/src/lib/security-mode.ts",
  "client/src/components/SecurityModeBanner.tsx",
  "client/src/components/dashboard/DailyLoginRewardPanel.tsx",
  "client/src/pages/competitions-vault.tsx",
];

const missing = requiredFiles.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error("Preview launch integrity verification failed:");
  for (const file of missing) console.error(`- missing file: ${file}`);
  process.exit(1);
}

const tournamentPage = fs.readFileSync("client/src/pages/competitions-vault.tsx", "utf8");
if (tournamentPage.includes("Tue–Tue") || tournamentPage.includes("Tue-Tue")) {
  console.error("Preview launch integrity verification failed: obsolete Tue–Tue tournament wording remains.");
  process.exit(1);
}

console.log("Preview launch source files and tournament timing wording verified.");

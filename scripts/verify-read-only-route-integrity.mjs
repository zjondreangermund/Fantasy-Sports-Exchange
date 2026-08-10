#!/usr/bin/env node
import fs from "node:fs";

const requiredFiles = [
  "server/services/readOnlyGuard.ts",
  "server/services/securityControl.ts",
  "server/routes/securityAdmin.routes.ts",
  "server/routes/dailyLoginReward.routes.ts",
  "server/services/dailyLoginReward.ts",
  "client/src/lib/security-mode.ts",
  "client/src/components/SecurityModeBanner.tsx",
  "client/src/components/dashboard/DailyLoginRewardPanel.tsx",
  "client/src/pages/competitions-vault.tsx",
];

const failures = [];
const missing = requiredFiles.filter((file) => !fs.existsSync(file));
for (const file of missing) failures.push(`missing file: ${file}`);

if (!missing.length) {
  const tournamentPage = fs.readFileSync("client/src/pages/competitions-vault.tsx", "utf8");
  const strictGuard = fs.readFileSync("server/services/readOnlyGuard.ts", "utf8");
  const securityControl = fs.readFileSync("server/services/securityControl.ts", "utf8");
  const securityRoutes = fs.readFileSync("server/routes/securityAdmin.routes.ts", "utf8");
  const clientSecurity = fs.readFileSync("client/src/lib/security-mode.ts", "utf8");

  if (tournamentPage.includes("Tue–Tue") || tournamentPage.includes("Tue-Tue")) {
    failures.push("obsolete Tue–Tue tournament wording remains");
  }

  if (!securityControl.includes("ADMIN_READ_ONLY_BYPASS_V1") || !securityControl.includes("export function isPrivilegedAdminRequest")) {
    failures.push("global security middleware is missing authenticated Admin identity verification");
  }
  if (!securityControl.includes("ADMIN_READ_ONLY_EFFECTIVE_SETTINGS_V1") || !securityControl.includes("emergency: { ...settings.emergency, readOnly: false }")) {
    failures.push("global security middleware does not disable only the Read-only bit for Admin");
  }
  if (!securityControl.includes("const blockedBy = emergencyBlock(effectiveSettings, req)")) {
    failures.push("global security middleware is not enforcing dedicated pause switches after Admin Read-only bypass");
  }
  if (!strictGuard.includes("isPrivilegedAdminRequest") || !strictGuard.includes("emergency: { ...record.settings.emergency, readOnly: false }")) {
    failures.push("strict Read-only guard is missing the authenticated Admin-only bypass");
  }
  if (!securityRoutes.includes("adminBypass") || !securityRoutes.includes("readOnlyAppliesToYou")) {
    failures.push("security status does not tell the authenticated Admin client that Read-only is bypassed");
  }
  if (!clientSecurity.includes("adminBypass: boolean") || !clientSecurity.includes("currentStatus.adminBypass")) {
    failures.push("browser Read-only guard would still block authenticated Admin mutations");
  }
}

if (failures.length) {
  console.error("Preview launch integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Preview launch source files, Admin Read-only bypass, dedicated pause controls and tournament timing wording verified.");

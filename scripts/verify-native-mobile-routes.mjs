import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "client/src/App.tsx");
const shellPath = path.join(root, "client/src/components/native/NativeMobileShell.tsx");

const app = fs.readFileSync(appPath, "utf8");
const shell = fs.readFileSync(shellPath, "utf8");

const requiredWebsiteRoutes = [
  "/",
  "/competitions",
  "/live-lineup",
  "/collection",
  "/marketplace",
  "/prize-vault",
  "/wallet",
  "/premier-league",
  "/account",
  "/legal/scoring",
  "/help",
];

const requiredCompactMappings = [
  "NativeHomePage",
  "NativePlayPage",
  "NativeSquadPage",
  "NativeCardsPage",
  "NativeMarketPage",
  "NativeVaultPage",
  "NativeWalletPage",
  "NativePremierLeaguePage",
  "NativeClubPage",
];

const failures = [];

for (const route of requiredWebsiteRoutes) {
  if (!shell.includes(`href: \"${route}\"`) && !shell.includes(`href=\"${route}\"`) && !shell.includes(`href=\"${route}?`)) {
    failures.push(`APK shell no longer links to required route ${route}`);
  }
  if (route !== "/" && !app.includes(`\"${route}\"`)) {
    failures.push(`Website router no longer declares required route ${route}`);
  }
}

for (const component of requiredCompactMappings) {
  if (!shell.includes(component)) failures.push(`APK compact mapping missing ${component}`);
}

if (!shell.includes("nativeFull=1")) {
  failures.push("APK shell lost its live website/full-route escape hatch");
}

if (!shell.includes("NativeRouteBoundary")) {
  failures.push("APK shell lost its blank-route recovery boundary");
}

if (failures.length) {
  console.error("Native mobile route verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`Native mobile route verification passed (${requiredWebsiteRoutes.length} live routes, ${requiredCompactMappings.length} compact mappings).`);

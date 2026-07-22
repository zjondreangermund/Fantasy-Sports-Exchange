import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const sources = {
  main: read("server/routes.ts"),
  retention: read("server/routes/retention.routes.ts"),
  prizeVault: read("server/routes/prizeVault.routes.ts"),
  userTournaments: read("server/routes/userTournaments.routes.ts"),
  wallet: read("server/routes/wallet.routes.ts"),
};

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routeCount(method, routePath) {
  const matcher = new RegExp(`app\\.${method}\\(\\s*[\"']${escapeRegExp(routePath)}[\"']`, "g");
  return Object.values(sources).reduce((total, source) => total + (source.match(matcher)?.length || 0), 0);
}

check(routeCount("get", "/api/competitions") === 1, "GET /api/competitions must have one canonical owner");
check(routeCount("get", "/api/prize-vault") === 1, "GET /api/prize-vault must have one canonical owner");
check(routeCount("get", "/api/admin/prizes") === 1, "GET /api/admin/prizes must have one canonical owner");

check(sources.main.includes('app.get("/api/competitions"'), "server/routes.ts must own the competition listing route");
check(sources.main.includes("submissionClosesAt"), "competition listing must expose the official submission deadline");
check(sources.main.includes("entryOpen:"), "competition listing must expose server-calculated entry availability");
check(sources.main.includes("entries,"), "competition listing must include ranked entries");
check(sources.main.includes("winner:"), "competition listing must preserve completed winner details");

check(sources.prizeVault.includes('app.get("/api/prize-vault"'), "prizeVault.routes.ts must own the Prize Vault response");
check(sources.prizeVault.includes("getPrizeLadder"), "Prize Vault route must use the canonical prize engine");
check(sources.wallet.includes('app.get("/api/wallet"'), "wallet.routes.ts must own the primary wallet response");

check(!sources.retention.includes('app.get("/api/competitions"'), "retention routes must not shadow competition listing");
check(!sources.retention.includes('app.get("/api/admin/prizes"'), "retention routes must not bypass admin prize authorization");
check(!sources.retention.includes('app.get("/api/wallet"'), "retention routes must not shadow the wallet module");
check(!sources.userTournaments.includes('app.get("/api/prize-vault"'), "user tournament routes must not shadow the canonical Prize Vault");
check(!sources.userTournaments.includes("VAULT_PRIZES"), "obsolete gameweek Prize Vault catalog must stay removed");
check(!sources.userTournaments.includes("prizeFor("), "user tournament creation must not carry a second Prize Vault engine");

if (failures.length) {
  console.error("Route ownership integrity verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Route ownership integrity verification passed.");

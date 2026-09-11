import fs from "node:fs";

const FILE = "server/services/playerTransferMonitoring.ts";
let source = fs.readFileSync(FILE, "utf8");

if (!source.includes("CONFIRMED_EPL_DEPARTURE_EVIDENCE_V1")) {
  console.log("[confirmed-epl-departure] no confirmed-departure patch to normalize yet");
  process.exit(0);
}

// Preserve the exact idempotency anchors expected by apply-transfer-admin-pan-fix.mjs.
// The independent verification can run immediately after the established base lines
// without changing behavior, while allowing every npm pre-hook to safely re-run.
const processOrders = [
  "  await ensurePlayerTransferMonitoringSchema();\n  const falseDepartureRepair = await reconcileFalsePremierLeagueDepartures();\n  const suppressedHistoricalAliasEvents = await suppressHistoricalTeamAliasNoise();\n  const season = currentSeasonStartYear();",
  "  await ensurePlayerTransferMonitoringSchema();\n  const suppressedHistoricalAliasEvents = await suppressHistoricalTeamAliasNoise();\n  const falseDepartureRepair = await reconcileFalsePremierLeagueDepartures();\n  const season = currentSeasonStartYear();",
];
const stableProcessOrder = "  await ensurePlayerTransferMonitoringSchema();\n  const suppressedHistoricalAliasEvents = await suppressHistoricalTeamAliasNoise();\n  const season = currentSeasonStartYear();\n  const falseDepartureRepair = await reconcileFalsePremierLeagueDepartures();";
for (const candidate of processOrders) {
  if (source.includes(candidate)) source = source.replace(candidate, stableProcessOrder);
}
if (!source.includes(stableProcessOrder)) {
  throw new Error("[confirmed-epl-departure] process idempotency anchor missing");
}

const counterOrder = "  let movedWithinLeague = 0;\n  let leftLeague = 0;\n  let replacementClaims = 0;\n  let unconfirmedDepartures = 0;\n  let preventedFalseDepartures = Number(falseDepartureRepair?.repaired || 0);\n  const departureEvidence = await loadDepartureEvidence();\n  let suppressedTeamAliasChanges = suppressedHistoricalAliasEvents;";
const stableCounterOrder = "  let movedWithinLeague = 0;\n  let leftLeague = 0;\n  let replacementClaims = 0;\n  let suppressedTeamAliasChanges = suppressedHistoricalAliasEvents;\n  let unconfirmedDepartures = 0;\n  let preventedFalseDepartures = Number(falseDepartureRepair?.repaired || 0);\n  const departureEvidence = await loadDepartureEvidence();";
if (source.includes(counterOrder)) source = source.replace(counterOrder, stableCounterOrder);
if (!source.includes(stableCounterOrder)) {
  throw new Error("[confirmed-epl-departure] counter idempotency anchor missing");
}

const extendedReturn = "  return { movedWithinLeague, leftLeague, replacementClaims, suppressedTeamAliasChanges, unconfirmedDepartures, preventedFalseDepartures, departureEvidence: departureEvidence.reason };";
const stableReturn = "  return { movedWithinLeague, leftLeague, replacementClaims, suppressedTeamAliasChanges };";
if (source.includes(extendedReturn)) source = source.replace(extendedReturn, stableReturn);
if (!source.includes(stableReturn)) {
  throw new Error("[confirmed-epl-departure] return idempotency anchor missing");
}

fs.writeFileSync(FILE, source);
console.log("[confirmed-epl-departure] normalized transfer patch anchors for repeated prebuilds");

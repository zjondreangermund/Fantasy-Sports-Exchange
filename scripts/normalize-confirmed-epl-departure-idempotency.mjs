import fs from "node:fs";

const FILE = "server/services/playerTransferMonitoring.ts";
let source = fs.readFileSync(FILE, "utf8");

if (!source.includes("CONFIRMED_EPL_DEPARTURE_EVIDENCE_V1")) {
  console.log("[confirmed-epl-departure] no confirmed-departure patch to normalize yet");
  process.exit(0);
}

// Preserve the exact idempotency anchors expected by apply-transfer-admin-pan-fix.mjs.
// The confirmed-departure helper block must not sit between the alias-cleanup helper
// and processFplRosterChanges(), because the older generator treats that pair as one
// stable insertion anchor and would otherwise add a duplicate cleanup function.
const helperMarker = "// CONFIRMED_EPL_DEPARTURE_EVIDENCE_V1";
const cleanupMarker = "async function suppressHistoricalTeamAliasNoise() {";
const processMarker = "export async function processFplRosterChanges(existingRows: any[], currentFplIds: number[]) {";
let helperStart = source.indexOf(helperMarker);
let cleanupStart = source.indexOf(cleanupMarker);
let processStart = source.indexOf(processMarker);

if (cleanupStart >= 0 && helperStart > cleanupStart && processStart > helperStart) {
  const helperBlock = source.slice(helperStart, processStart).trim();
  source = source.slice(0, helperStart) + source.slice(processStart);
  cleanupStart = source.indexOf(cleanupMarker);
  source = source.slice(0, cleanupStart) + `${helperBlock}\n\n` + source.slice(cleanupStart);
}

helperStart = source.indexOf(helperMarker);
cleanupStart = source.indexOf(cleanupMarker);
processStart = source.indexOf(processMarker);
if (!(helperStart >= 0 && cleanupStart > helperStart && processStart > cleanupStart)) {
  throw new Error("[confirmed-epl-departure] helper placement is not transfer-generator safe");
}

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

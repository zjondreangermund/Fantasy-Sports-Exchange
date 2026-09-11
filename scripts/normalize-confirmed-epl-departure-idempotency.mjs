import fs from "node:fs";

const FILE = "server/services/playerTransferMonitoring.ts";
const source = fs.readFileSync(FILE, "utf8");
const incompatible = "  await ensurePlayerTransferMonitoringSchema();\n  const falseDepartureRepair = await reconcileFalsePremierLeagueDepartures();\n  const suppressedHistoricalAliasEvents = await suppressHistoricalTeamAliasNoise();";
const compatible = "  await ensurePlayerTransferMonitoringSchema();\n  const suppressedHistoricalAliasEvents = await suppressHistoricalTeamAliasNoise();\n  const falseDepartureRepair = await reconcileFalsePremierLeagueDepartures();";

if (source.includes(incompatible)) {
  fs.writeFileSync(FILE, source.replace(incompatible, compatible));
  console.log("[confirmed-epl-departure] normalized transfer patch ordering for repeated prebuilds");
} else if (!source.includes(compatible)) {
  throw new Error("[confirmed-epl-departure] idempotency ordering anchor missing");
}

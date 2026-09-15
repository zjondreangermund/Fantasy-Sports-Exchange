import fs from "node:fs";

const file = "client/src/pages/competitions-vault.tsx";
const marker = "CURRENT_TOURNAMENT_UI_GAMEWEEK_V1";
let source = fs.readFileSync(file, "utf8");

if (source.includes(marker)) {
  console.log("[current-tournament-ui] current-gameweek selector already applied");
  process.exit(0);
}

const playMarker = source.indexOf("PLAY_SETTLEMENT_CURRENT_GW_V1");
const currentStart = source.indexOf("  const currentGw = useMemo(() => {", Math.max(0, playMarker));
const latestCompletedStart = source.indexOf("  const latestCompletedGw = useMemo(() => {", currentStart);
if (playMarker < 0 || currentStart < 0 || latestCompletedStart <= currentStart) {
  throw new Error("[current-tournament-ui] Play current-gameweek block was not generated before final rollover policy");
}

const replacement = `  const currentGw = useMemo(() => {\n    // ${marker}: entering Tournaments always lands on the newest week accepting/live for play.\n    // Previous weeks may remain in history, but can never pin the default view backwards.\n    const live = official\n      .filter((c) => ["open", "active"].includes(String(c.status || "").toLowerCase()))\n      .map((c) => Number(c.gameWeek || c.game_week || 0))\n      .filter(Boolean)\n      .sort((a, b) => b - a);\n    if (live.length) return live[0];\n\n    const vaultGameWeek = Number(prizeVault?.currentGameWeek || 0);\n    if (vaultGameWeek > 0) return vaultGameWeek;\n\n    const vaultWeeks = (Object.values(prizeVault?.summary || {}) as VaultSummary[])\n      .map((summary) => Number(summary?.currentGameWeek || 0))\n      .filter((gw) => Number.isInteger(gw) && gw > 0);\n    if (vaultWeeks.length) return Math.max(...vaultWeeks);\n\n    const upcoming = official\n      .filter((c) => String(c.status || "").toLowerCase() === "upcoming")\n      .map((c) => Number(c.gameWeek || c.game_week || 0))\n      .filter(Boolean)\n      .sort((a, b) => a - b);\n    return upcoming[0] || 1;\n  }, [official, prizeVault]);\n\n`;

source = source.slice(0, currentStart) + replacement + source.slice(latestCompletedStart);
fs.writeFileSync(file, source);
console.log("[current-tournament-ui] Tournament Play now defaults to the newest open/active gameweek");

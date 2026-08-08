import fs from "node:fs";

const file = "server/routes/onboarding.routes.ts";
const source = fs.readFileSync(file, "utf8");

const required = [
  "FAIR_STARTER_DRAFT_V1",
  "const currentTeamIds = new Set<number>",
  "const currentPlayers = (Array.isArray(fplPlayers) ? fplPlayers : []).filter",
  "...shuffle(byPosition.GK).slice(0, 3)",
  "...shuffle(byPosition.DEF).slice(0, 3)",
  "...shuffle(byPosition.MID).slice(0, 3)",
  "...shuffle(byPosition.FWD).slice(0, 3)",
  "const wildcardPlayers = shuffle(currentPlayers.filter",
  "const candidates = [...requiredPlayers, ...wildcardPlayers]",
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Starter Draft randomization guard missing: ${marker}`);
}

const forbidden = [
  "todayCandidates",
  "todayTeamIds",
  "candidates.slice(0, 120)",
  "const sourcePool = todayCandidates",
  "const sb = Number(b.starts",
  "const mb = Number(b.minutes",
];

for (const marker of forbidden) {
  if (source.includes(marker)) throw new Error(`Biased Starter Draft logic returned: ${marker}`);
}

console.log("Starter Draft uses the full current Premier League player list with position-level random draws.");

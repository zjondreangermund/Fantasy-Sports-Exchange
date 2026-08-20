import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "client", "src", "pages", "competitions-vault.tsx");
let source = fs.readFileSync(file, "utf8");
let changed = false;

function replaceRequired(from, to, label, marker = to) {
  if (source.includes(marker)) return;
  if (!source.includes(from)) throw new Error(`Settlement-date patch anchor not found: ${label}`);
  source = source.replace(from, to);
  changed = true;
}

replaceRequired(
  '  const visible = official.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === activeRarity);\n  const selectedTier = tier(selected?.tier);',
  `  const visible = official.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === activeRarity);\n  const shownSettlementTournament = visible[0] || official.find((c) => Number(c.gameWeek || c.game_week) === Number(shownGw));\n  const shownSettlementAt = shownSettlementTournament?.settlementAt || shownSettlementTournament?.settlement_at || shownSettlementTournament?.endDate || shownSettlementTournament?.end_date;\n  const shownSettlementLabel = shownSettlementAt ? dateLabel(shownSettlementAt) : "Fixture controlled";\n  const selectedTier = tier(selected?.tier);`,
  "shown gameweek settlement source",
  "const shownSettlementLabel = shownSettlementAt ? dateLabel(shownSettlementAt)",
);

replaceRequired(
  'Every entry uses five Premier League cards. Entries lock at the first Premier League kickoff; scores freeze and results settle after the following Tuesday cutoff.',
  'Every entry uses five Premier League cards. Entries lock at the first Premier League kickoff; scores freeze and results settle at the gameweek settlement time shown below.',
  "hero settlement wording",
);

replaceRequired(
  '<Stat icon={Clock3} label="Settlement" value="Tuesday" />',
  '<Stat icon={Clock3} label="Settlement" value={shownSettlementLabel} />',
  "hero settlement value",
);

replaceRequired(
  'Only Premier League points recorded for this gameweek before Tuesday settlement count. FA Cup matches and Premier League fixtures played after settlement are excluded.',
  'Only Premier League points recorded for this gameweek before the settlement cutoff shown above count. FA Cup matches and Premier League fixtures played after that cutoff are excluded.',
  "tournament settlement explanation",
);

const required = [
  "const shownSettlementTournament = visible[0]",
  "const shownSettlementLabel = shownSettlementAt ? dateLabel(shownSettlementAt)",
  'label="Settlement" value={shownSettlementLabel}',
  "settle at the gameweek settlement time shown below",
  "before the settlement cutoff shown above count",
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Settlement-date patch verification failed: ${marker}`);
}
if (source.includes('label="Settlement" value="Tuesday"')) throw new Error("Static Tuesday settlement label is still present");
if (source.includes("after the following Tuesday cutoff")) throw new Error("Static Tuesday settlement copy is still present");

if (changed) fs.writeFileSync(file, source);
console.log(`[tournaments] ${changed ? "Linked" : "Verified"} gameweek settlement labels to tournament settlement dates`);

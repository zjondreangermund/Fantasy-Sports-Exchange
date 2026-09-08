import fs from "node:fs";

const competitionPath = "client/src/pages/competitions-vault.tsx";
const legalPath = "client/src/pages/legal-centre.tsx";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[common-open-entry] ${label} could not be located`);
  return source.replace(from, to);
}

let competitions = fs.readFileSync(competitionPath, "utf8");
competitions = replaceRequired(
  competitions,
  '<div className="mt-3 rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-xs text-purple-100"><b>{selectedTierCount}/{selectedRequirement.requiredTournamentRarityCards} required {selectedTier} cards selected.</b><div className="mt-1 text-purple-100/65">{selectedRequirement.shortLabel}</div></div>',
  '<div className="mt-3 rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-xs text-purple-100"><b>{selectedTier === "common" ? `${selectedIds.length}/5 eligible cards selected.` : `${selectedTierCount}/${selectedRequirement.requiredTournamentRarityCards} required ${selectedTier} cards selected.`}</b><div className="mt-1 text-purple-100/65">{selectedTier === "common" ? "Any rarity can enter this Common tournament." : selectedRequirement.shortLabel}</div></div>',
  "lineup requirement summary",
);
fs.writeFileSync(competitionPath, competitions);

let legal = fs.readFileSync(legalPath, "utf8");
legal = replaceRequired(
  legal,
  '  "Common: all five cards must be Common.",',
  '  "Common: any five eligible cards may be used, regardless of rarity.",',
  "published Common rarity rule",
);
fs.writeFileSync(legalPath, legal);

console.log("[common-open-entry] Common tournaments now show and publish any-rarity five-card entry.");

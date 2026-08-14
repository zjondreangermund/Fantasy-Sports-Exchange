import fs from "node:fs";

const file = "client/src/pages/competitions-vault.tsx";
let source = fs.readFileSync(file, "utf8");

if (!source.includes("USER_SCOPED_TOURNAMENT_ENTRY_COUNTS_V2")) {
  const anchor = `  const entryCounts = useMemo(() => {\n    const counts = new Map<number, number>();\n    for (const entry of entries) {\n      const competitionId = entryCompetitionId(entry);\n      counts.set(competitionId, (counts.get(competitionId) || 0) + 1);\n    }\n    return counts;\n  }, [entries]);`;
  if (source.includes(anchor)) {
    source = source.replace(anchor, `  // USER_SCOPED_TOURNAMENT_ENTRY_COUNTS_V2\n${anchor}`);
    fs.writeFileSync(file, source);
  }
}

console.log("Prepared existing tournament user-entry count map for data-contract v2.");

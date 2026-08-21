import fs from "node:fs";

const file = "server/routes.ts";
const source = fs.readFileSync(file, "utf8");
if (source.includes("GW1_EFFECTIVE_OPEN_STATUS_V1")) {
  console.log("GW1 effective-open competition API status already finalized.");
  process.exit(0);
}

const from = `        const submissionClosesAt = await getCompetitionSubmissionCloseAt(comp);\n        const settlementAt = catTuesdaySettlementAfterKickoff(new Date(submissionClosesAt));\n        const normalized = normalizeCompetitionRow({ ...comp, entryCount: entries.length });\n        return { ...normalized, submissionClosesAt, settlementAt, entryOpen: comp.status === \"open\" && Date.now() < new Date(submissionClosesAt).getTime(), entries, entryCount: entries.length, winner: comp.status === \"completed\" && entries[0] ? { userId: entries[0].userId, userName: entries[0].userName, totalScore: Number(entries[0].totalScore || 0), prizeAmount: Number(entries[0].prizeAmount || 0), prizeCardId: entries[0].prizeCardId || null, tiebreak: entries[0].tiebreak || null } : null };`;
const to = `        const submissionClosesAt = await getCompetitionSubmissionCloseAt(comp);\n        const settlementAt = catTuesdaySettlementAfterKickoff(new Date(submissionClosesAt));\n        const normalized = normalizeCompetitionRow({ ...comp, entryCount: entries.length });\n        // GW1_EFFECTIVE_OPEN_STATUS_V1\n        const gw1TestOpen = Number(comp.gameWeek || comp.game_week || 0) === 1\n          && Date.now() < GW1_TEST_ENTRY_EXTENSION_UTC\n          && ![\"completed\", \"cancelled\"].includes(String(comp.status || \"\").toLowerCase());\n        const effectiveStatus = gw1TestOpen ? \"open\" : String(comp.status || normalized.status || \"\");\n        return { ...normalized, status: effectiveStatus, submissionClosesAt, settlementAt, entryOpen: effectiveStatus === \"open\" && Date.now() < new Date(submissionClosesAt).getTime(), entries, entryCount: entries.length, winner: comp.status === \"completed\" && entries[0] ? { userId: entries[0].userId, userName: entries[0].userName, totalScore: Number(entries[0].totalScore || 0), prizeAmount: Number(entries[0].prizeAmount || 0), prizeCardId: entries[0].prizeCardId || null, tiebreak: entries[0].tiebreak || null } : null };`;

if (!source.includes(from)) throw new Error("GW1 finalizer could not locate post-audit competition response");
fs.writeFileSync(file, source.replace(from, to));
console.log("Finalized GW1 competition API effective-open status until 21:00 CAT.");

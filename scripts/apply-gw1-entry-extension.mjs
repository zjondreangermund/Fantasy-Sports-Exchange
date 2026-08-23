import fs from "node:fs";

const CUTOFF_ISO = "2026-08-23T21:59:59.000Z"; // 23:59:59 Namibia/CAT on 23 Aug 2026 (UTC+2)
const CUTOFF_COMMENT = "23:59:59 CAT on 23 Aug 2026";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const refreshedSource = source.replace(
    /const FREE_GW1_TEST_ENTRY_EXTENSION_UTC = Date\.parse\("[^"]+"\);[^\n]*/g,
    `const FREE_GW1_TEST_ENTRY_EXTENSION_UTC = Date.parse("${CUTOFF_ISO}"); // ${CUTOFF_COMMENT}`,
  );
  const next = transform(refreshedSource);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`Applied FREE GW1 test window to ${file}.`);
  }
}

patchFile("server/routes.ts", (original) => {
  let source = original;
  if (!source.includes("FREE_GW1_TEST_ENTRY_EXTENSION_UTC")) {
    const anchor = "const SEASON_END = Date.UTC(2027, 6, 1);\n";
    if (!source.includes(anchor)) throw new Error("Could not locate season constants in server/routes.ts");
    source = source.replace(
      anchor,
      `${anchor}const FREE_GW1_TEST_ENTRY_EXTENSION_UTC = Date.parse(\"${CUTOFF_ISO}\"); // ${CUTOFF_COMMENT}\n`,
    );
  }

  const oldDeadline = `async function getCompetitionSubmissionCloseAt(comp: CompetitionRow) {\n  const gw = Number(comp?.gameWeek ?? comp?.game_week ?? 1) || 1;\n  const fplKickoff = await firstFixtureKickoffForGameweek(gw);`;
  const newDeadline = `async function getCompetitionSubmissionCloseAt(comp: CompetitionRow) {\n  const gw = Number(comp?.gameWeek ?? comp?.game_week ?? 1) || 1;\n  const freeGw1Test = gw === 1\n    && Number(comp?.entryFee ?? comp?.entry_fee ?? Number.NaN) === 0\n    && String(comp?.name || \"\").startsWith(\"GW1 FREE \");\n  if (freeGw1Test) return new Date(FREE_GW1_TEST_ENTRY_EXTENSION_UTC);\n  const fplKickoff = await firstFixtureKickoffForGameweek(gw);`;
  if (!source.includes(newDeadline)) {
    if (!source.includes(oldDeadline)) throw new Error("Could not locate competition submission cutoff in server/routes.ts");
    source = source.replace(oldDeadline, newDeadline);
  }

  const oldPayload = `        const normalized = normalizeCompetitionRow({ ...comp, entryCount: entries.length });\n        return { ...normalized, submissionClosesAt, entryOpen: comp.status === \"open\" && Date.now() < new Date(submissionClosesAt).getTime(), entries, entryCount: entries.length, winner: comp.status === \"completed\" && entries[0] ? { userId: entries[0].userId, userName: entries[0].userName, totalScore: Number(entries[0].totalScore || 0), prizeAmount: Number(entries[0].prizeAmount || 0), prizeCardId: entries[0].prizeCardId || null, tiebreak: entries[0].tiebreak || null } : null };`;
  const newPayload = `        const normalized = normalizeCompetitionRow({ ...comp, entryCount: entries.length });\n        const freeGw1TestOpen = Number(comp.gameWeek || comp.game_week || 0) === 1\n          && Number(comp.entryFee ?? comp.entry_fee ?? Number.NaN) === 0\n          && String(comp.name || \"\").startsWith(\"GW1 FREE \")\n          && Date.now() < FREE_GW1_TEST_ENTRY_EXTENSION_UTC\n          && ![\"completed\", \"cancelled\"].includes(String(comp.status || \"\").toLowerCase());\n        const effectiveStatus = freeGw1TestOpen ? \"open\" : String(comp.status || normalized.status || \"\");\n        return { ...normalized, status: effectiveStatus, submissionClosesAt, entryOpen: effectiveStatus === \"open\" && Date.now() < new Date(submissionClosesAt).getTime(), entries, entryCount: entries.length, winner: comp.status === \"completed\" && entries[0] ? { userId: entries[0].userId, userName: entries[0].userName, totalScore: Number(entries[0].totalScore || 0), prizeAmount: Number(entries[0].prizeAmount || 0), prizeCardId: entries[0].prizeCardId || null, tiebreak: entries[0].tiebreak || null } : null };`;
  const oldFinalizedPayload = `        // GW1_EFFECTIVE_OPEN_STATUS_V1\n        const gw1TestOpen = Number(comp.gameWeek || comp.game_week || 0) === 1\n          && Date.now() < GW1_TEST_ENTRY_EXTENSION_UTC\n          && ![\"completed\", \"cancelled\"].includes(String(comp.status || \"\").toLowerCase());\n        const effectiveStatus = gw1TestOpen ? \"open\" : String(comp.status || normalized.status || \"\");`;
  const newFinalizedPayload = `        // GW1_EFFECTIVE_OPEN_STATUS_V1\n        const freeGw1TestOpen = Number(comp.gameWeek || comp.game_week || 0) === 1\n          && Number(comp.entryFee ?? comp.entry_fee ?? Number.NaN) === 0\n          && String(comp.name || \"\").startsWith(\"GW1 FREE \")\n          && Date.now() < FREE_GW1_TEST_ENTRY_EXTENSION_UTC\n          && ![\"completed\", \"cancelled\"].includes(String(comp.status || \"\").toLowerCase());\n        const effectiveStatus = freeGw1TestOpen ? \"open\" : String(comp.status || normalized.status || \"\");`;
  if (!source.includes("const freeGw1TestOpen = Number(comp.gameWeek")) {
    if (source.includes(oldFinalizedPayload)) source = source.replace(oldFinalizedPayload, newFinalizedPayload);
    else if (source.includes(oldPayload)) source = source.replace(oldPayload, newPayload);
    else throw new Error("Could not locate competition API entry-open payload in server/routes.ts");
  }
  return source;
});

patchFile("server/services/scoreUpdater.ts", (original) => {
  let source = original;
  if (!source.includes("FREE_GW1_TEST_ENTRY_EXTENSION_UTC")) {
    const anchor = "const RARITY_PRESTIGE: Record<string, number> = { common: 1, rare: 3, epic: 7, unique: 15, legendary: 30 };\n";
    if (!source.includes(anchor)) throw new Error("Could not locate score updater constants");
    source = source.replace(
      anchor,
      `${anchor}const FREE_GW1_TEST_ENTRY_EXTENSION_UTC = Date.parse(\"${CUTOFF_ISO}\"); // ${CUTOFF_COMMENT}\n`,
    );
  }

  const oldConstructor = `  constructor(storage: any) { this.storage = storage; }\n  isAutoUpdateEnabled() { return Boolean(this.updateInterval); }`;
  const newConstructor = `  constructor(storage: any) { this.storage = storage; }\n  isAutoUpdateEnabled() { return Boolean(this.updateInterval); }\n\n  private isFreeGw1Today(competition: any) {\n    return Number(competition?.gameWeek || competition?.game_week || 0) === 1\n      && Number(competition?.entryFee ?? competition?.entry_fee ?? Number.NaN) === 0\n      && String(competition?.name || \"\").startsWith(\"GW1 FREE \");\n  }`;
  if (!source.includes("private isFreeGw1Today")) {
    if (!source.includes(oldConstructor)) throw new Error("Could not locate ScoreUpdateService constructor");
    source = source.replace(oldConstructor, newConstructor);
  }

  const oldEntryDeadline = `  private entryDeadline(competition: any, event: any, fixtures: any[]) {\n    const eventDeadline = event?.deadline_time ? new Date(String(event.deadline_time)) : null;`;
  const newEntryDeadline = `  private entryDeadline(competition: any, event: any, fixtures: any[]) {\n    if (this.isFreeGw1Today(competition)) return new Date(FREE_GW1_TEST_ENTRY_EXTENSION_UTC);\n    const eventDeadline = event?.deadline_time ? new Date(String(event.deadline_time)) : null;`;
  if (!source.includes(newEntryDeadline)) {
    if (!source.includes(oldEntryDeadline)) throw new Error("Could not locate ScoreUpdateService.entryDeadline");
    source = source.replace(oldEntryDeadline, newEntryDeadline);
  }

  const oldActivate = `  private async activateCompetitionAtDeadline(competition: any): Promise<string> {\n    const updated = rowsOf(await db.execute(sql\``;
  const newActivate = `  private async activateCompetitionAtDeadline(competition: any): Promise<string> {\n    if (this.isFreeGw1Today(competition) && Date.now() < FREE_GW1_TEST_ENTRY_EXTENSION_UTC) {\n      await this.setCompetitionStatus(Number(competition.id), \"open\");\n      competition.status = \"open\";\n      return \"open\";\n    }\n    const updated = rowsOf(await db.execute(sql\``;
  if (!source.includes(newActivate)) {
    if (!source.includes(oldActivate)) throw new Error("Could not locate ScoreUpdateService activation method");
    source = source.replace(oldActivate, newActivate);
  }

  const oldAutoScore = `        if (status === \"active\" || (status === \"closed\" && final)) {\n          toScore.push({ competition: { ...competition, status }, final });\n        }`;
  const newAutoScore = `        const freeGw1LiveTest = this.isFreeGw1Today(competition)\n          && now < FREE_GW1_TEST_ENTRY_EXTENSION_UTC\n          && status === \"open\";\n        if (freeGw1LiveTest || status === \"active\" || (status === \"closed\" && final)) {\n          toScore.push({ competition: { ...competition, status }, final: freeGw1LiveTest ? false : final });\n        }`;
  if (!source.includes("const freeGw1LiveTest = this.isFreeGw1Today")) {
    if (!source.includes(oldAutoScore)) throw new Error("Could not locate automatic competition scoring filter");
    source = source.replace(oldAutoScore, newAutoScore);
  }

  const oldManualSkip = `    if ([\"open\", \"upcoming\"].includes(String(comp.status)) && Date.now() < deadline.getTime()) {`;
  const newManualSkip = `    if ([\"open\", \"upcoming\"].includes(String(comp.status)) && Date.now() < deadline.getTime() && !this.isFreeGw1Today(comp)) {`;
  if (!source.includes(newManualSkip)) {
    if (!source.includes(oldManualSkip)) throw new Error("Could not locate manual score-update entry-window guard");
    source = source.replace(oldManualSkip, newManualSkip);
  }

  const oldManualStatus = `    if (![\"active\", \"closed\"].includes(String(comp.status))) throw new Error(\`Competition \${competitionId} cannot be scored (status: \${comp.status})\`);`;
  const newManualStatus = `    const freeGw1LiveTest = this.isFreeGw1Today(comp) && String(comp.status) === \"open\" && Date.now() < FREE_GW1_TEST_ENTRY_EXTENSION_UTC;\n    if (![\"active\", \"closed\"].includes(String(comp.status)) && !freeGw1LiveTest) throw new Error(\`Competition \${competitionId} cannot be scored (status: \${comp.status})\`);`;
  if (!source.includes("const freeGw1LiveTest = this.isFreeGw1Today(comp)")) {
    if (!source.includes(oldManualStatus)) throw new Error("Could not locate manual score-update status guard");
    source = source.replace(oldManualStatus, newManualStatus);
  }
  return source;
});

patchFile("server/routes/economyIntegrity.routes.ts", (original) => {
  let source = original;
  if (!source.includes("FREE_GW1_TEST_ENTRY_EXTENSION_UTC")) {
    const anchor = `const PREMIER_LEAGUE_KEYS = new Set([\"premierleague\", \"englishpremierleague\", \"epl\"]);\n`;
    if (!source.includes(anchor)) throw new Error("Could not locate economy-integrity constants");
    source = source.replace(
      anchor,
      `${anchor}const FREE_GW1_TEST_ENTRY_EXTENSION_UTC = Date.parse(\"${CUTOFF_ISO}\"); // ${CUTOFF_COMMENT}\n`,
    );
  }

  const oldResolver = `async function resolveEntryDeadline(gameWeek: number, fallbackStart: unknown): Promise<Date> {\n  const [bootstrap, fixtures] = await Promise.all([fplApi.bootstrap(), fplApi.fixturesLive()]);`;
  const newResolver = `async function resolveEntryDeadline(gameWeek: number, fallbackStart: unknown, freeGw1Test = false): Promise<Date> {\n  if (Number(gameWeek) === 1 && freeGw1Test) return new Date(FREE_GW1_TEST_ENTRY_EXTENSION_UTC);\n  const [bootstrap, fixtures] = await Promise.all([fplApi.bootstrap(), fplApi.fixturesLive()]);`;
  if (!source.includes(newResolver)) {
    if (!source.includes(oldResolver)) throw new Error("Could not locate atomic join deadline resolver");
    source = source.replace(oldResolver, newResolver);
  }

  const oldPreview = `        select id, game_week as \"gameWeek\", start_date as \"startDate\"\n        from app.competitions`;
  const newPreview = `        select id, name, coalesce(entry_fee, 0)::float as \"entryFee\", game_week as \"gameWeek\", start_date as \"startDate\"\n        from app.competitions`;
  if (!source.includes(newPreview)) {
    if (!source.includes(oldPreview)) throw new Error("Could not locate atomic join competition preview");
    source = source.replace(oldPreview, newPreview);
  }

  const oldDeadlineCall = `      const entryDeadline = await resolveEntryDeadline(Number(preview.gameWeek || 0), preview.startDate);`;
  const newDeadlineCall = `      const previewIsFreeGw1 = Number(preview.gameWeek || 0) === 1\n        && Number(preview.entryFee ?? Number.NaN) === 0\n        && String(preview.name || \"\").startsWith(\"GW1 FREE \");\n      const entryDeadline = await resolveEntryDeadline(Number(preview.gameWeek || 0), preview.startDate, previewIsFreeGw1);`;
  if (!source.includes(newDeadlineCall)) {
    if (!source.includes(oldDeadlineCall)) throw new Error("Could not locate atomic join deadline call");
    source = source.replace(oldDeadlineCall, newDeadlineCall);
  }

  const oldCompetitionSelect = `          select id, name, tier::text as tier, status::text as status,\n            coalesce(entry_fee, 0)::float as \"entryFee\", max_entries as \"maxEntries\",`;
  if (!source.includes(oldCompetitionSelect)) throw new Error("Could not locate atomic join competition lock query");

  const oldStatusGuard = `        if (Number(competition.gameWeek || 0) !== Number(preview.gameWeek || 0)) throw new Error(\"Tournament schedule changed; reopen the entry window and try again\");\n        if (String(competition.status) !== \"open\") throw new Error(\"Tournament is not open for entries\");\n        if (Date.now() >= entryDeadline.getTime()) throw new Error(\"Gameweek entries are closed\");`;
  const newStatusGuard = `        if (Number(competition.gameWeek || 0) !== Number(preview.gameWeek || 0)) throw new Error(\"Tournament schedule changed; reopen the entry window and try again\");\n        const freeGw1TestOpen = Number(competition.gameWeek || 0) === 1\n          && Number(competition.entryFee ?? Number.NaN) === 0\n          && String(competition.name || \"\").startsWith(\"GW1 FREE \")\n          && Date.now() < FREE_GW1_TEST_ENTRY_EXTENSION_UTC\n          && ![\"completed\", \"cancelled\"].includes(String(competition.status || \"\").toLowerCase());\n        if (String(competition.status) !== \"open\" && !freeGw1TestOpen) throw new Error(\"Tournament is not open for entries\");\n        if (Date.now() >= entryDeadline.getTime()) throw new Error(\"Gameweek entries are closed\");\n        if (freeGw1TestOpen && String(competition.status) !== \"open\") {\n          await tx.execute(sql\`update app.competitions set status = 'open' where id = \${competitionId} and status::text not in ('completed','cancelled')\`);\n          competition.status = \"open\";\n        }`;
  if (!source.includes("const freeGw1TestOpen = Number(competition.gameWeek")) {
    if (!source.includes(oldStatusGuard)) throw new Error("Could not locate atomic join status guard");
    source = source.replace(oldStatusGuard, newStatusGuard);
  }
  return source;
});

patchFile("scripts/sync-free-card-tournaments.mjs", (original) => {
  let source = original;
  if (!source.includes("FREE_GW1_TEST_ENTRY_EXTENSION_UTC")) {
    const anchor = `const SEASON = \"2026-27\";\n`;
    if (!source.includes(anchor)) throw new Error("Could not locate FREE cup season constant");
    source = source.replace(
      anchor,
      `${anchor}const FREE_GW1_TEST_ENTRY_EXTENSION_UTC = Date.parse(\"${CUTOFF_ISO}\"); // ${CUTOFF_COMMENT}\n`,
    );
  }

  const oldExistingStatus = `          const nextStatus = [\"completed\", \"cancelled\"].includes(String(row.status || \"\"))\n            ? String(row.status)\n            : String(source.status || \"upcoming\");`;
  const newExistingStatus = `          const immutableStatus = [\"completed\", \"cancelled\"].includes(String(row.status || \"\"));\n          const freeGw1TestOpen = gw === 1 && Date.now() < FREE_GW1_TEST_ENTRY_EXTENSION_UTC;\n          const nextStatus = immutableStatus\n            ? String(row.status)\n            : freeGw1TestOpen ? \"open\" : String(source.status || \"upcoming\");`;
  if (!source.includes(newExistingStatus)) {
    if (!source.includes(oldExistingStatus)) throw new Error("Could not locate existing FREE cup status sync");
    source = source.replace(oldExistingStatus, newExistingStatus);
  }

  const oldInsertStatus = `              String(source.status || \"upcoming\"),\n              gw,`;
  const newInsertStatus = `              gw === 1 && Date.now() < FREE_GW1_TEST_ENTRY_EXTENSION_UTC ? \"open\" : String(source.status || \"upcoming\"),\n              gw,`;
  if (!source.includes(newInsertStatus)) {
    if (!source.includes(oldInsertStatus)) throw new Error("Could not locate new FREE cup status sync");
    source = source.replace(oldInsertStatus, newInsertStatus);
  }
  return source;
});

console.log("FREE GW1 cups prepared for entries and live score refreshes until 23:59:59 CAT on 23 Aug 2026. Paid tournaments, completed/cancelled cups and GW2+ keep their normal lifecycle.");

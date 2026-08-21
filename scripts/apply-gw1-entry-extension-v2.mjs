import fs from "node:fs";

const CUTOFF_ISO = "2026-08-21T19:00:00.000Z"; // 21:00 Namibia/CAT (UTC+2)

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`Applied GW1 test entry extension to ${file}.`);
  }
}

patchFile("server/routes.ts", (original) => {
  let source = original;
  // The client build can run the finalizer first, which adds references to the
  // GW1 constant before this v2 patch executes. Check for the declaration itself
  // rather than any reference so build:server always has a defined symbol.
  if (!source.includes("const GW1_TEST_ENTRY_EXTENSION_UTC =")) {
    const anchor = "const SEASON_END = Date.UTC(2027, 6, 1);\n";
    if (!source.includes(anchor)) throw new Error("Could not locate season constants in server/routes.ts");
    source = source.replace(anchor, `${anchor}const GW1_TEST_ENTRY_EXTENSION_UTC = Date.parse(\"${CUTOFF_ISO}\"); // 21:00 CAT on 21 Aug 2026\n`);
  }
  const oldDeadline = `async function getCompetitionSubmissionCloseAt(comp: CompetitionRow) {\n  const gw = Number(comp?.gameWeek ?? comp?.game_week ?? 1) || 1;\n  const fplKickoff = await firstFixtureKickoffForGameweek(gw);`;
  const newDeadline = `async function getCompetitionSubmissionCloseAt(comp: CompetitionRow) {\n  const gw = Number(comp?.gameWeek ?? comp?.game_week ?? 1) || 1;\n  if (gw === 1) return new Date(GW1_TEST_ENTRY_EXTENSION_UTC);\n  const fplKickoff = await firstFixtureKickoffForGameweek(gw);`;
  if (!source.includes(newDeadline)) {
    if (!source.includes(oldDeadline)) throw new Error("Could not locate competition submission cutoff in server/routes.ts");
    source = source.replace(oldDeadline, newDeadline);
  }
  return source;
});

patchFile("server/services/scoreUpdater.ts", (original) => {
  let source = original;
  if (!source.includes("const GW1_TEST_ENTRY_EXTENSION_UTC =")) {
    const anchor = "const RARITY_PRESTIGE: Record<string, number> = { common: 1, rare: 3, epic: 7, unique: 15, legendary: 30 };\n";
    if (!source.includes(anchor)) throw new Error("Could not locate score updater constants");
    source = source.replace(anchor, `${anchor}const GW1_TEST_ENTRY_EXTENSION_UTC = Date.parse(\"${CUTOFF_ISO}\"); // 21:00 CAT on 21 Aug 2026\n`);
  }
  const oldEntryDeadline = `  private entryDeadline(competition: any, event: any, fixtures: any[]) {\n    const eventDeadline = event?.deadline_time ? new Date(String(event.deadline_time)) : null;`;
  const newEntryDeadline = `  private entryDeadline(competition: any, event: any, fixtures: any[]) {\n    const gameWeek = Number(competition?.gameWeek || competition?.game_week || 0);\n    if (gameWeek === 1) return new Date(GW1_TEST_ENTRY_EXTENSION_UTC);\n    const eventDeadline = event?.deadline_time ? new Date(String(event.deadline_time)) : null;`;
  if (!source.includes(newEntryDeadline)) {
    if (!source.includes(oldEntryDeadline)) throw new Error("Could not locate ScoreUpdateService.entryDeadline");
    source = source.replace(oldEntryDeadline, newEntryDeadline);
  }
  const oldActivate = `  private async activateCompetitionAtDeadline(competition: any): Promise<string> {\n    const updated = rowsOf(await db.execute(sql\``;
  const newActivate = `  private async activateCompetitionAtDeadline(competition: any): Promise<string> {\n    const gameWeek = Number(competition?.gameWeek || competition?.game_week || 0);\n    if (gameWeek === 1 && Date.now() < GW1_TEST_ENTRY_EXTENSION_UTC) {\n      await this.setCompetitionStatus(Number(competition.id), \"open\");\n      competition.status = \"open\";\n      return \"open\";\n    }\n    const updated = rowsOf(await db.execute(sql\``;
  if (!source.includes(newActivate)) {
    if (!source.includes(oldActivate)) throw new Error("Could not locate ScoreUpdateService activation method");
    source = source.replace(oldActivate, newActivate);
  }
  return source;
});

patchFile("server/routes/economyIntegrity.routes.ts", (original) => {
  let source = original;
  if (!source.includes("const GW1_TEST_ENTRY_EXTENSION_UTC =")) {
    const anchor = `const PREMIER_LEAGUE_KEYS = new Set([\"premierleague\", \"englishpremierleague\", \"epl\"]);\n`;
    if (!source.includes(anchor)) throw new Error("Could not locate economy-integrity constants");
    source = source.replace(anchor, `${anchor}const GW1_TEST_ENTRY_EXTENSION_UTC = Date.parse(\"${CUTOFF_ISO}\"); // 21:00 CAT on 21 Aug 2026\n`);
  }
  const oldResolver = `async function resolveEntryDeadline(gameWeek: number, fallbackStart: unknown): Promise<Date> {\n  const [bootstrap, fixtures] = await Promise.all([fplApi.bootstrap(), fplApi.fixturesLive()]);`;
  const newResolver = `async function resolveEntryDeadline(gameWeek: number, fallbackStart: unknown): Promise<Date> {\n  if (Number(gameWeek) === 1) return new Date(GW1_TEST_ENTRY_EXTENSION_UTC);\n  const [bootstrap, fixtures] = await Promise.all([fplApi.bootstrap(), fplApi.fixturesLive()]);`;
  if (!source.includes(newResolver)) {
    if (!source.includes(oldResolver)) throw new Error("Could not locate atomic join deadline resolver");
    source = source.replace(oldResolver, newResolver);
  }
  const oldStatusGuard = `        if (Number(competition.gameWeek || 0) !== Number(preview.gameWeek || 0)) throw new Error(\"Tournament schedule changed; reopen the entry window and try again\");\n        if (String(competition.status) !== \"open\") throw new Error(\"Tournament is not open for entries\");\n        if (Date.now() >= entryDeadline.getTime()) throw new Error(\"Gameweek entries are closed\");`;
  const newStatusGuard = `        if (Number(competition.gameWeek || 0) !== Number(preview.gameWeek || 0)) throw new Error(\"Tournament schedule changed; reopen the entry window and try again\");\n        const gw1TestOpen = Number(competition.gameWeek || 0) === 1 && Date.now() < GW1_TEST_ENTRY_EXTENSION_UTC;\n        if (String(competition.status) !== \"open\" && !gw1TestOpen) throw new Error(\"Tournament is not open for entries\");\n        if (Date.now() >= entryDeadline.getTime()) throw new Error(\"Gameweek entries are closed\");\n        if (gw1TestOpen && String(competition.status) !== \"open\") {\n          await tx.execute(sql\`update app.competitions set status = 'open' where id = \${competitionId} and status::text not in ('completed','cancelled')\`);\n          competition.status = \"open\";\n        }`;
  if (!source.includes("const gw1TestOpen = Number(competition.gameWeek")) {
    if (!source.includes(oldStatusGuard)) throw new Error("Could not locate atomic join status guard");
    source = source.replace(oldStatusGuard, newStatusGuard);
  }
  return source;
});

patchFile("scripts/sync-official-tournaments.mjs", (original) => {
  let source = original;
  if (!source.includes("const GW1_TEST_ENTRY_EXTENSION_UTC =")) {
    const anchor = "const DAY_MS = 24 * 60 * 60 * 1000;\n";
    if (!source.includes(anchor)) throw new Error("Could not locate official tournament sync constants");
    source = source.replace(anchor, `${anchor}const GW1_TEST_ENTRY_EXTENSION_UTC = Date.parse(\"${CUTOFF_ISO}\"); // 21:00 CAT on 21 Aug 2026\n`);
  }
  const oldStatus = `function plannedStatus({ first, start, settlement, now }) {\n  if (now.getTime() >= settlement.getTime()) return \"closed\";\n  if (now.getTime() >= first.getTime()) return \"active\";\n  if (now.getTime() >= start.getTime()) return \"open\";\n  return \"upcoming\";\n}`;
  const newStatus = `function plannedStatus({ gw, first, start, settlement, now }) {\n  if (now.getTime() >= settlement.getTime()) return \"closed\";\n  const entryLock = Number(gw) === 1 ? new Date(GW1_TEST_ENTRY_EXTENSION_UTC) : first;\n  if (now.getTime() >= entryLock.getTime()) return \"active\";\n  if (now.getTime() >= start.getTime()) return \"open\";\n  return \"upcoming\";\n}`;
  if (!source.includes(newStatus)) {
    if (!source.includes(oldStatus)) throw new Error("Could not locate plannedStatus in official tournament sync");
    source = source.replace(oldStatus, newStatus);
  }
  const normalCopy = "Entries lock at the first Premier League kickoff.";
  const extendedCopy = "Entries normally lock at the first Premier League kickoff. For the one-time GW1 launch test, entries remain open until 21:00 CAT on 21 August 2026.";
  if (!source.includes(extendedCopy)) {
    if (!source.includes(normalCopy)) throw new Error("Could not locate official tournament entry-lock copy");
    source = source.replace(normalCopy, extendedCopy);
  }
  return source;
});

console.log("GW1 test extension v2 prepared: atomic join deadline and lifecycle remain open until 21:00 CAT; UI status is finalized after site-integrity transforms.");
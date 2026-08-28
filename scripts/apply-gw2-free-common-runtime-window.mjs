import fs from "node:fs";

const CUTOFF_ISO = "2026-08-28T19:00:00.000Z"; // 21:00 Namibia/CAT (UTC+2)
const CUTOFF_LABEL = "21:00 Namibia time on 28 Aug 2026";

function patchFile(path, transform, requiredMarkers = []) {
  if (!fs.existsSync(path)) throw new Error(`Runtime target missing: ${path}`);
  const source = fs.readFileSync(path, "utf8");
  const next = transform(source);
  for (const marker of requiredMarkers) {
    if (!next.includes(marker)) throw new Error(`Runtime patch verification failed for ${path}: missing ${marker}`);
  }
  if (next !== source) {
    fs.writeFileSync(path, next);
    console.log(`[gw2-free-common] patched ${path}`);
  } else {
    console.log(`[gw2-free-common] ${path} already patched`);
  }
}

patchFile("dist/server/server/routes.js", (original) => {
  let source = original;
  const constantMarker = "GW2_FREE_COMMON_ENTRY_CUTOFF_UTC";
  if (!source.includes(constantMarker)) {
    const anchor = "const SEASON_END = Date.UTC(2027, 6, 1);";
    if (!source.includes(anchor)) throw new Error("Could not locate season constants in compiled routes.js");
    source = source.replace(anchor, `${anchor}\nconst GW2_FREE_COMMON_ENTRY_CUTOFF_UTC = Date.parse(\"${CUTOFF_ISO}\"); // ${CUTOFF_LABEL}`);
  }
  if (!source.includes("function isGw2FreeCommonEntryWindow(comp)")) {
    const anchor = "function inSeason(date)";
    const index = source.indexOf(anchor);
    if (index < 0) throw new Error("Could not locate inSeason helper in compiled routes.js");
    const helper = `function isGw2FreeCommonEntryWindow(comp) {\n  return Number(comp?.gameWeek ?? comp?.game_week ?? 0) === 2\n    && String(comp?.tier || \"\").toLowerCase() === \"common\"\n    && Number(comp?.entryFee ?? comp?.entry_fee ?? Number.NaN) === 0\n    && String(comp?.name || \"\") === \"GW2 FREE Common Card Cup\"\n    && Date.now() < GW2_FREE_COMMON_ENTRY_CUTOFF_UTC;\n}\n`;
    source = source.slice(0, index) + helper + source.slice(index);
  }
  if (!source.includes("if (isGw2FreeCommonEntryWindow(comp)) return new Date(GW2_FREE_COMMON_ENTRY_CUTOFF_UTC);")) {
    const pattern = /(async function getCompetitionSubmissionCloseAt\(comp\) \{\s*const gw = [^;]+;)/;
    if (!pattern.test(source)) throw new Error("Could not locate compiled competition submission deadline resolver");
    source = source.replace(pattern, `$1\n  if (isGw2FreeCommonEntryWindow(comp)) return new Date(GW2_FREE_COMMON_ENTRY_CUTOFF_UTC);`);
  }
  return source;
}, [
  `Date.parse(\"${CUTOFF_ISO}\")`,
  "isGw2FreeCommonEntryWindow(comp)",
  "return new Date(GW2_FREE_COMMON_ENTRY_CUTOFF_UTC)",
]);

patchFile("dist/server/server/routes/economyIntegrity.routes.js", (original) => {
  let source = original;
  if (!source.includes("GW2_FREE_COMMON_ENTRY_CUTOFF_UTC")) {
    const anchor = "const PREMIER_LEAGUE_KEYS = new Set([\"premierleague\", \"englishpremierleague\", \"epl\"]);";
    if (!source.includes(anchor)) throw new Error("Could not locate Premier League constants in compiled economyIntegrity.routes.js");
    const addition = `${anchor}\nconst GW2_FREE_COMMON_ENTRY_CUTOFF_UTC = Date.parse(\"${CUTOFF_ISO}\"); // ${CUTOFF_LABEL}\nfunction isGw2FreeCommonEntryWindow(competition) {\n  return Number(competition?.gameWeek ?? competition?.game_week ?? 0) === 2\n    && String(competition?.tier || \"\").toLowerCase() === \"common\"\n    && Number(competition?.entryFee ?? competition?.entry_fee ?? Number.NaN) === 0\n    && String(competition?.name || \"\") === \"GW2 FREE Common Card Cup\"\n    && Date.now() < GW2_FREE_COMMON_ENTRY_CUTOFF_UTC;\n}`;
    source = source.replace(anchor, addition);
  }

  const oldPreview = `select id, game_week as \"gameWeek\", start_date as \"startDate\"\n        from app.competitions`;
  const newPreview = `select id, name, tier::text as tier, coalesce(entry_fee, 0)::float as \"entryFee\", game_week as \"gameWeek\", start_date as \"startDate\"\n        from app.competitions`;
  if (!source.includes(newPreview)) {
    if (!source.includes(oldPreview)) throw new Error("Could not locate compiled tournament preview query");
    source = source.replace(oldPreview, newPreview);
  }

  const oldDeadline = "const entryDeadline = await resolveEntryDeadline(Number(preview.gameWeek || 0), preview.startDate);";
  const newDeadline = "const entryDeadline = isGw2FreeCommonEntryWindow(preview) ? new Date(GW2_FREE_COMMON_ENTRY_CUTOFF_UTC) : await resolveEntryDeadline(Number(preview.gameWeek || 0), preview.startDate);";
  if (!source.includes(newDeadline)) {
    if (!source.includes(oldDeadline)) throw new Error("Could not locate compiled join deadline call");
    source = source.replace(oldDeadline, newDeadline);
  }

  const oldGuard = `if (String(competition.status) !== \"open\") throw new Error(\"Tournament is not open for entries\");\n        if (Date.now() >= entryDeadline.getTime()) throw new Error(\"Gameweek entries are closed\");`;
  const newGuard = [
    `const gw2FreeCommonEntryOpen = isGw2FreeCommonEntryWindow(competition);`,
    `        if (String(competition.status) !== \"open\" && !gw2FreeCommonEntryOpen) throw new Error(\"Tournament is not open for entries\");`,
    `        if (gw2FreeCommonEntryOpen && String(competition.status) !== \"open\") {`,
    `          await tx.execute(sql\`update app.competitions set status = 'open' where id = \${competitionId} and status::text not in ('completed','cancelled')\`);`,
    `          competition.status = \"open\";`,
    `        }`,
    `        if (Date.now() >= entryDeadline.getTime()) throw new Error(\"Gameweek entries are closed\");`,
  ].join("\n");
  if (!source.includes("const gw2FreeCommonEntryOpen = isGw2FreeCommonEntryWindow(competition);")) {
    if (!source.includes(oldGuard)) throw new Error("Could not locate compiled tournament join status guard");
    source = source.replace(oldGuard, newGuard);
  }
  return source;
}, [
  `Date.parse(\"${CUTOFF_ISO}\")`,
  "isGw2FreeCommonEntryWindow(preview)",
  "gw2FreeCommonEntryOpen",
]);

patchFile("dist/server/server/services/scoreUpdater.js", (original) => {
  let source = original;
  if (!source.includes("GW2_FREE_COMMON_ENTRY_CUTOFF_UTC")) {
    const anchor = "const RARITY_PRESTIGE = { common: 1, rare: 3, epic: 7, unique: 15, legendary: 30 };";
    if (!source.includes(anchor)) throw new Error("Could not locate scoring constants in compiled scoreUpdater.js");
    source = source.replace(anchor, `${anchor}\nconst GW2_FREE_COMMON_ENTRY_CUTOFF_UTC = Date.parse(\"${CUTOFF_ISO}\"); // ${CUTOFF_LABEL}`);
  }

  if (!source.includes("isGw2FreeCommonEntryWindow(competition)")) {
    const anchor = "isAutoUpdateEnabled() { return Boolean(this.updateInterval); }";
    if (!source.includes(anchor)) throw new Error("Could not locate ScoreUpdateService compiled constructor helpers");
    const helper = `${anchor}\n    isGw2FreeCommonEntryWindow(competition) {\n        return Number(competition?.gameWeek ?? competition?.game_week ?? 0) === 2\n            && String(competition?.tier || \"\").toLowerCase() === \"common\"\n            && Number(competition?.entryFee ?? competition?.entry_fee ?? Number.NaN) === 0\n            && String(competition?.name || \"\") === \"GW2 FREE Common Card Cup\"\n            && Date.now() < GW2_FREE_COMMON_ENTRY_CUTOFF_UTC;\n    }`;
    source = source.replace(anchor, helper);
  }

  if (!source.includes("if (this.isGw2FreeCommonEntryWindow(competition)) return new Date(GW2_FREE_COMMON_ENTRY_CUTOFF_UTC);")) {
    const pattern = /(entryDeadline\(competition, event, fixtures\) \{)/;
    if (!pattern.test(source)) throw new Error("Could not locate compiled score entryDeadline method");
    source = source.replace(pattern, `$1\n        if (this.isGw2FreeCommonEntryWindow(competition)) return new Date(GW2_FREE_COMMON_ENTRY_CUTOFF_UTC);`);
  }

  if (!source.includes("GW2 FREE Common stays open for entry testing until 21:00 Namibia time")) {
    const pattern = /(async activateCompetitionAtDeadline\(competition\) \{)/;
    if (!pattern.test(source)) throw new Error("Could not locate compiled activation method");
    source = source.replace(pattern, `$1\n        if (this.isGw2FreeCommonEntryWindow(competition)) {\n            // GW2 FREE Common stays open for entry testing until 21:00 Namibia time.\n            await this.setCompetitionStatus(Number(competition.id), \"open\");\n            competition.status = \"open\";\n            return \"open\";\n        }`);
  }

  const oldAutoScore = `if (status === \"active\" || (status === \"closed\" && final)) {\n                    toScore.push({ competition: { ...competition, status }, final });\n                }`;
  const newAutoScore = `const gw2FreeCommonLiveTest = this.isGw2FreeCommonEntryWindow(competition) && status === \"open\";\n                if (gw2FreeCommonLiveTest || status === \"active\" || (status === \"closed\" && final)) {\n                    toScore.push({ competition: { ...competition, status }, final: gw2FreeCommonLiveTest ? false : final });\n                }`;
  if (!source.includes("const gw2FreeCommonLiveTest = this.isGw2FreeCommonEntryWindow(competition)")) {
    if (!source.includes(oldAutoScore)) throw new Error("Could not locate compiled automatic scoring filter");
    source = source.replace(oldAutoScore, newAutoScore);
  }

  const oldManualGuard = `if (![\"active\", \"closed\"].includes(String(comp.status))) throw new Error(\`Competition \${competitionId} cannot be scored (status: \${comp.status})\`);`;
  const newManualGuard = `const gw2FreeCommonLiveTest = this.isGw2FreeCommonEntryWindow(comp) && String(comp.status) === \"open\";\n        if (![\"active\", \"closed\"].includes(String(comp.status)) && !gw2FreeCommonLiveTest) throw new Error(\`Competition \${competitionId} cannot be scored (status: \${comp.status})\`);`;
  if (!source.includes("const gw2FreeCommonLiveTest = this.isGw2FreeCommonEntryWindow(comp)")) {
    if (!source.includes(oldManualGuard)) throw new Error("Could not locate compiled manual scoring status guard");
    source = source.replace(oldManualGuard, newManualGuard);
  }
  return source;
}, [
  `Date.parse(\"${CUTOFF_ISO}\")`,
  "isGw2FreeCommonEntryWindow(competition)",
  "GW2 FREE Common stays open for entry testing until 21:00 Namibia time",
]);

console.log(`[gw2-free-common] runtime API, join validation and scoring lifecycle forced OPEN until ${CUTOFF_LABEL}.`);

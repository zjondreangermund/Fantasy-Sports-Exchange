import fs from "node:fs";

const CUTOFF_ISO = "2026-08-29T11:30:00.000Z"; // exactly 13:30 Namibia/CAT (UTC+2), today's first Premier League kickoff
const CUTOFF_LABEL = "13:30 Namibia time on 29 Aug 2026 (today's first Premier League kickoff)";

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
  if (!source.includes("GW2_FREE_COMMON_ENTRY_CUTOFF_UTC")) {
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
  "function isGw2FreeCommonEntryWindow(comp)",
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

  if (!source.includes('select id, name, tier::text as tier, coalesce(entry_fee, 0)::float as "entryFee", game_week as "gameWeek", start_date as "startDate"')) {
    const previewPattern = /select id, game_week as "gameWeek", start_date as "startDate"\s*from app\.competitions/;
    if (!previewPattern.test(source)) throw new Error("Could not locate compiled tournament preview query");
    source = source.replace(previewPattern, 'select id, name, tier::text as tier, coalesce(entry_fee, 0)::float as "entryFee", game_week as "gameWeek", start_date as "startDate"\n        from app.competitions');
  }

  const newDeadline = "const entryDeadline = isGw2FreeCommonEntryWindow(preview) ? new Date(GW2_FREE_COMMON_ENTRY_CUTOFF_UTC) : await resolveEntryDeadline(Number(preview.gameWeek || 0), preview.startDate);";
  if (!source.includes(newDeadline)) {
    const deadlinePattern = /const entryDeadline = await resolveEntryDeadline\(Number\(preview\.gameWeek \|\| 0\), preview\.startDate\);/;
    if (!deadlinePattern.test(source)) throw new Error("Could not locate compiled join deadline call");
    source = source.replace(deadlinePattern, newDeadline);
  }

  if (!source.includes("const gw2FreeCommonEntryOpen = isGw2FreeCommonEntryWindow(competition);")) {
    const statusGuardPattern = /if\s*\(String\(competition\.status\)\s*!==\s*"open"\)\s*throw new Error\("Tournament is not open for entries"\);/;
    if (!statusGuardPattern.test(source)) throw new Error("Could not locate compiled tournament status guard");
    const replacement = [
      `const gw2FreeCommonEntryOpen = isGw2FreeCommonEntryWindow(competition);`,
      `        if (String(competition.status) !== \"open\" && !gw2FreeCommonEntryOpen) throw new Error(\"Tournament is not open for entries\");`,
      `        if (gw2FreeCommonEntryOpen && String(competition.status) !== \"open\") {`,
      `          await tx.execute(sql\`update app.competitions set status = 'open' where id = \${competitionId} and status::text not in ('completed','cancelled')\`);`,
      `          competition.status = \"open\";`,
      `        }`,
    ].join("\n");
    source = source.replace(statusGuardPattern, replacement);
  }
  return source;
}, [
  `Date.parse(\"${CUTOFF_ISO}\")`,
  "isGw2FreeCommonEntryWindow(preview)",
  "const gw2FreeCommonEntryOpen = isGw2FreeCommonEntryWindow(competition);",
]);

patchFile("dist/server/server/services/scoreUpdater.js", (original) => {
  let source = original;
  if (!source.includes("GW2_FREE_COMMON_ENTRY_CUTOFF_UTC")) {
    const rarityPattern = /const RARITY_PRESTIGE\s*=\s*\{[^\n]+\};/;
    const match = source.match(rarityPattern);
    if (!match) throw new Error("Could not locate scoring constants in compiled scoreUpdater.js");
    source = source.replace(rarityPattern, `${match[0]}\nconst GW2_FREE_COMMON_ENTRY_CUTOFF_UTC = Date.parse(\"${CUTOFF_ISO}\"); // ${CUTOFF_LABEL}`);
  }

  if (!source.includes("isGw2FreeCommonEntryWindow(competition)")) {
    const helperAnchor = /isAutoUpdateEnabled\(\)\s*\{\s*return Boolean\(this\.updateInterval\);\s*\}/;
    const match = source.match(helperAnchor);
    if (!match) throw new Error("Could not locate ScoreUpdateService compiled helpers");
    const helper = `${match[0]}\n    isGw2FreeCommonEntryWindow(competition) {\n        return Number(competition?.gameWeek ?? competition?.game_week ?? 0) === 2\n            && String(competition?.tier || \"\").toLowerCase() === \"common\"\n            && Number(competition?.entryFee ?? competition?.entry_fee ?? Number.NaN) === 0\n            && String(competition?.name || \"\") === \"GW2 FREE Common Card Cup\"\n            && Date.now() < GW2_FREE_COMMON_ENTRY_CUTOFF_UTC;\n    }`;
    source = source.replace(helperAnchor, helper);
  }

  if (!source.includes("return new Date(GW2_FREE_COMMON_ENTRY_CUTOFF_UTC);")) {
    const deadlinePattern = /(entryDeadline\(competition, event, fixtures\)\s*\{)/;
    if (!deadlinePattern.test(source)) throw new Error("Could not locate compiled score entryDeadline method");
    source = source.replace(deadlinePattern, `$1\n        if (this.isGw2FreeCommonEntryWindow(competition)) return new Date(GW2_FREE_COMMON_ENTRY_CUTOFF_UTC);`);
  }

  if (!source.includes("GW2 FREE Common stays open until today's first Premier League kickoff")) {
    const activatePattern = /(async activateCompetitionAtDeadline\(competition\)\s*\{)/;
    if (!activatePattern.test(source)) throw new Error("Could not locate compiled activation method");
    source = source.replace(activatePattern, `$1\n        if (this.isGw2FreeCommonEntryWindow(competition)) {\n            // GW2 FREE Common stays open until today's first Premier League kickoff at 13:30 Namibia time.\n            await this.setCompetitionStatus(Number(competition.id), \"open\");\n            competition.status = \"open\";\n            return \"open\";\n        }`);
  }

  // Live scoring while the temporary entry window is open is useful for testing,
  // but entry access must never fail just because a nonessential compiled scoring
  // block was reformatted by TypeScript. Patch these opportunistically.
  if (!source.includes("const gw2FreeCommonLiveTest = this.isGw2FreeCommonEntryWindow(competition)")) {
    const autoPattern = /if\s*\(status === "active" \|\| \(status === "closed" && final\)\)\s*\{\s*toScore\.push\(\{ competition: \{ \.\.\.competition, status \}, final \}\);\s*\}/;
    if (autoPattern.test(source)) {
      source = source.replace(autoPattern, `const gw2FreeCommonLiveTest = this.isGw2FreeCommonEntryWindow(competition) && status === \"open\";\n                if (gw2FreeCommonLiveTest || status === \"active\" || (status === \"closed\" && final)) {\n                    toScore.push({ competition: { ...competition, status }, final: gw2FreeCommonLiveTest ? false : final });\n                }`);
    } else {
      console.warn("[gw2-free-common] live-score filter shape changed; entry window patch continues without that optional adjustment");
    }
  }
  return source;
}, [
  `Date.parse(\"${CUTOFF_ISO}\")`,
  "isGw2FreeCommonEntryWindow(competition)",
  "GW2 FREE Common stays open until today's first Premier League kickoff",
]);

console.log(`[gw2-free-common] runtime API, join validation and lifecycle forced OPEN until ${CUTOFF_LABEL}.`);

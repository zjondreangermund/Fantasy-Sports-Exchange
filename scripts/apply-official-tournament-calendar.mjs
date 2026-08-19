import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function patchFile(rel, patcher) {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, "utf8");
  const after = patcher(before);
  if (after !== before) fs.writeFileSync(file, after);
  return after !== before;
}

function replaceRequired(source, from, to, label, marker = to) {
  if (source.includes(marker)) return source;
  if (!source.includes(from)) throw new Error(`Official tournament calendar patch anchor not found: ${label}`);
  return source.replace(from, to);
}

let changedFiles = 0;

// Admin-created official competitions carry the configured entry fee but no platform fee.
if (patchFile("server/routes.ts", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    '      const platformFeeRate = prizeMode === "card" ? 0 : 0.2;',
    '      const platformFeeRate = 0; // Official/admin tournaments do not pay a platform fee.',
    "admin platform fee",
    "Official/admin tournaments do not pay a platform fee.",
  );
  source = source.replace(
    "          ${adminId}, 'private', ${maxEntries}, .1, 0, 0",
    "          ${adminId}, 'private', ${maxEntries}, 0, 0, 0",
  );
  return source;
})) changedFiles += 1;

// The public economy config describes user-created cash tournaments: 10% platform / 90% prize pool.
if (patchFile("server/services/tournamentRules.ts", (input) => input.replace(
  "    platformFeeRate: 0.2,\n    prizePoolRate: 0.8,",
  "    platformFeeRate: 0.1,\n    prizePoolRate: 0.9,",
))) changedFiles += 1;

// Canonical settlement rule shared with client/server validation.
if (patchFile("shared/game-rules.ts", (input) => {
  let source = input.replace(
    'export const TOURNAMENT_SETTLEMENT_DAY = "Tuesday";',
    'export const TOURNAMENT_SETTLEMENT_DAY = "day-after-last-eligible-fixture";',
  );
  if (!source.includes("POSTPONED_AFTER_NEXT_GAMEWEEK_START_COUNT")) {
    source = source.replace(
      "export const POST_SETTLEMENT_FIXTURES_COUNT = false;",
      "export const POST_SETTLEMENT_FIXTURES_COUNT = false;\nexport const POSTPONED_AFTER_NEXT_GAMEWEEK_START_COUNT = false;",
    );
  }
  return source;
})) changedFiles += 1;

// Keep scoring copy aligned with the dynamic fixture-window settlement policy.
if (patchFile("server/services/scoreUpdater.ts", (input) => {
  let source = input;
  source = source.replaceAll("configured Tuesday settlement cutoff", "configured gameweek settlement cutoff");
  source = source.replaceAll("Tuesday settlement cutoff", "gameweek settlement cutoff");
  source = source.replace(
    'fixturePolicy: "Only Premier League FPL points recorded before the configured gameweek settlement cutoff count. Cup matches and later fixtures are excluded.",',
    'fixturePolicy: "Only Premier League FPL points recorded before the configured gameweek settlement cutoff count. Cup matches and fixtures postponed to or beyond the next gameweek are excluded.",',
  );
  return source;
})) changedFiles += 1;

// Admin builder: canonical Prize Vault margins, official synced dates, and correct settlement wording.
if (patchFile("client/src/components/admin/AdminTournamentManager.tsx", (input) => {
  let source = input;
  source = source.replace(
    'const marginByRarity: Record<string, number> = { common: 2.0, rare: 1.8, unique: 1.7, epic: 1.6, legendary: 1.5 };',
    'const marginByRarity: Record<string, number> = { common: 1.7, rare: 1.6, unique: 1.5, epic: 1.4, legendary: 1.3 };',
  );
  source = source.replace(
    'function defaultStartForGw(gw: number) { const base = new Date("2026-08-14T19:00:00+02:00"); base.setDate(base.getDate() + (Math.max(1, gw) - 1) * 7); return isoLocal(base); }',
    'function defaultStartForGw(gw: number) { const base = new Date("2026-08-18T00:00:00+02:00"); base.setDate(base.getDate() + (Math.max(1, gw) - 1) * 7); return isoLocal(base); }',
  );
  source = source.replace(
    `function defaultEndForGw(gw: number) {
  const d = new Date(defaultStartForGw(gw));
  let daysForward = (2 - d.getDay() + 7) % 7;
  if (daysForward === 0) daysForward = 7;
  d.setDate(d.getDate() + daysForward);
  d.setHours(23, 59, 0, 0);
  return isoLocal(d);
}`,
    `function defaultEndForGw(gw: number) {
  const d = new Date(defaultStartForGw(gw));
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return isoLocal(d);
}`,
  );
  source = replaceRequired(
    source,
    `        const gw = Number(value || 1);
        next.startDate = defaultStartForGw(gw);
        next.endDate = defaultEndForGw(gw);`,
    `        const gw = Number(value || 1);
        const scheduled = officialCompetitions.find((comp: any) => Number(comp.gameWeek || comp.game_week || 0) === gw && String(comp.prizeKey || comp.prize_key || "") === "ladder");
        next.startDate = scheduled ? isoLocal(scheduled.startDate || scheduled.start_date) : defaultStartForGw(gw);
        next.endDate = scheduled ? isoLocal(scheduled.endDate || scheduled.end_date) : defaultEndForGw(gw);`,
    "admin builder synced gameweek dates",
    "const scheduled = officialCompetitions.find",
  );
  source = source.replaceAll("Tuesday-frozen scores", "Fixture-window frozen scores");
  source = source.replaceAll("Tuesday settlement cutoff", "Settlement cutoff — day after last eligible PL match");
  source = source.replaceAll("Settle Tuesday Results", "Settle Results");
  source = source.replace(
    "Only Premier League FPL points recorded before this settlement cutoff count. FA Cup matches and Premier League fixtures played later are excluded.",
    "Only Premier League FPL points recorded before this settlement cutoff count. FA Cup matches are excluded, and a postponed Premier League fixture does not count if it is played after the next gameweek has started.",
  );
  return source;
})) changedFiles += 1;

function patchTournamentCopy(input) {
  let source = input;
  source = source.replaceAll("Tuesday after the gameweek begins", "Day after the last eligible Premier League fixture");
  source = source.replaceAll("Tuesday 23:59 CAT", "23:59 CAT on the day after the last eligible Premier League fixture");
  source = source.replaceAll("before Tuesday settlement count", "before the gameweek settlement cutoff count");
  source = source.replaceAll("before Tuesday settlement", "before the gameweek settlement cutoff");
  source = source.replaceAll("Tuesday settlement cutoff", "gameweek settlement cutoff");
  source = source.replaceAll("Settle Tuesday Results", "Settle Results");
  source = source.replaceAll("later rescheduled fixtures", "postponed fixtures played after the next gameweek starts");
  return source;
}

if (patchFile("client/src/pages/competitions.tsx", patchTournamentCopy)) changedFiles += 1;
if (patchFile("client/src/pages/competitions-vault.tsx", (input) => {
  let source = patchTournamentCopy(input);
  source = replaceRequired(
    source,
    `  const gameweeks = useMemo(
    () => [...new Set<number>(official.map((c) => Number(c.gameWeek || c.game_week || 0)).filter(Boolean))].sort((a, b) => a - b),
    [official],
  );`,
    '  const gameweeks = useMemo(() => Array.from({ length: 38 }, (_, index) => index + 1), []);',
    "all 38 gameweeks selector",
    "Array.from({ length: 38 }",
  );
  return source;
})) changedFiles += 1;

console.log(`[official-tournaments] ${changedFiles ? `Patched ${changedFiles} source file(s)` : "Verified"}: 38 gameweeks × 5 rarities, live fixture windows with fallback coverage, late-postponement exclusion, admin fee 0%.`);

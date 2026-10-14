/**
 * The weekly competition schedule is the source of truth for the Home/Play tabs.
 * A tournament's status alone does not establish the current gameweek: an old
 * seeded or manually opened future GW must not advance the entire app to GW29.
 *
 * We use the official paid Prize Ladder calendar's start dates, falling back
 * to the synced FREE Card Cup calendar. Admin status overrides remain intact:
 * open cups from this week or the immediately following week may be featured.
 */
export type ArenaWeekCompetition = {
  name?: string | null;
  status?: string | null;
  gameWeek?: number | null;
  game_week?: number | null;
  startDate?: string | Date | null;
  start_date?: string | Date | null;
  entryOpen?: boolean | null;
  visibility?: string | null;
  entryFee?: number | null;
  entry_fee?: number | null;
};

const OFFICIAL_LADDER = /^GW\d+ (Common|Rare|Unique|Epic|Legendary) Prize Ladder$/i;
const OFFICIAL_FREE_CUP = /^GW\d+ FREE (Common|Rare|Unique|Epic|Legendary) Card Cup$/i;

export function arenaCompetitionWeek(row: ArenaWeekCompetition): number {
  const gw = Number(row.gameWeek ?? row.game_week ?? 0);
  return Number.isInteger(gw) && gw >= 1 && gw <= 38 ? gw : 0;
}

function startTime(row: ArenaWeekCompetition): number {
  const date = row.startDate ?? row.start_date;
  const timestamp = date == null ? NaN : new Date(date).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

export function arenaCalendarWeek<T extends ArenaWeekCompetition>(
  competitions: readonly T[],
  now: Date = new Date(),
): number | null {
  const eligible = competitions.filter((row) =>
    arenaCompetitionWeek(row) > 0 &&
    String(row.visibility || "public").toLowerCase() !== "private" &&
    Number.isFinite(startTime(row)),
  );
  // Never infer the current week from arbitrary tournaments, entry counts, or
  // old GW27-GW30 FREE Rare Card Cup rows.
  const paidCalendar = eligible.filter((row) => OFFICIAL_LADDER.test(String(row.name || "")));
  const freeCalendar = eligible.filter((row) => OFFICIAL_FREE_CUP.test(String(row.name || "")));
  const calendar = paidCalendar.length > 0 ? paidCalendar : freeCalendar;
  if (!calendar.length) return null;

  const timestamp = now.getTime();
  const started = calendar.filter((row) => startTime(row) <= timestamp);
  if (started.length) {
    started.sort((a, b) => startTime(b) - startTime(a) || arenaCompetitionWeek(b) - arenaCompetitionWeek(a));
    return arenaCompetitionWeek(started[0]);
  }
  // Before the first official opening, show only the first scheduled week.
  const upcoming = [...calendar].sort((a, b) => startTime(a) - startTime(b) || arenaCompetitionWeek(a) - arenaCompetitionWeek(b));
  return arenaCompetitionWeek(upcoming[0]);
}

export function currentArenaOpenCups<T extends ArenaWeekCompetition>(
  competitions: readonly T[],
  now: Date = new Date(),
): T[] {
  const calendarWeek = arenaCalendarWeek(competitions, now);
  if (!calendarWeek) return [];

  return competitions
    .filter((row) => {
      const week = arenaCompetitionWeek(row);
      return week >= calendarWeek &&
        week <= Math.min(38, calendarWeek + 1) &&
        String(row.status || "").toLowerCase() === "open" &&
        row.entryOpen !== false &&
        String(row.visibility || "public").toLowerCase() !== "private" &&
        !String(row.name || "").startsWith("[TEST]");
    })
    .sort((a, b) => {
      const weekDelta = arenaCompetitionWeek(a) - arenaCompetitionWeek(b);
      if (weekDelta) return weekDelta; // current entry week, then manually opened next week
      const freeA = Number(a.entryFee ?? a.entry_fee ?? 0) === 0 ? 1 : 0;
      const freeB = Number(b.entryFee ?? b.entry_fee ?? 0) === 0 ? 1 : 0;
      return freeB - freeA || String(a.name || "").localeCompare(String(b.name || ""));
    });
}

export function currentArenaDisplayWeek<T extends ArenaWeekCompetition>(
  competitions: readonly T[],
  now: Date = new Date(),
): number {
  const open = currentArenaOpenCups(competitions, now);
  if (open.length) return arenaCompetitionWeek(open[0]);
  return arenaCalendarWeek(competitions, now) || 0;
}

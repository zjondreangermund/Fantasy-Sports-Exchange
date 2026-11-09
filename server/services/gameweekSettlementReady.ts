/**
 * A Premier League match counts for its Fantasy Arena gameweek only within
 * that GW's seven-day fixture window. FPL sometimes leaves a postponed
 * fixture tagged to its original event even after it moves weeks later.
 * We do not delete the football fixture; we exclude it from this GW's
 * scoring/settlement. An unassigned fixture is pending until the GW expires.
 */
const DAY_MS = 86_400_000;
const POST_MATCH_MS = 3 * 60 * 60 * 1000;
export type GwFixtureWindow = {
  start: number;
  end: number;
  firstKickoff: number;
  lastEligibleKickoff: number;
};
export type GwReadinessOptions = {
  deadlineTime?: unknown;
  confirmedFinalFixtureIds?: ReadonlySet<number>;
  useFixtureCutoff?: boolean;
};
export type GameweekSettlementReadiness = {
  ready: boolean;
  code: string;
  message: string;
  eligibleMatches: number;
  unfinishedMatches: number;
  excludedLatePostponements: number;
  excludedFixtures: { id: number; kickoffTime: string | null }[];
  unfinishedFixtures: { id: number; kickoffTime: string | null; started: boolean; fplFinished: boolean }[];
  cutoffAt: string | null;
};

function parseTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function gameweekFixtureWindow(fixtures: any[], gameweek: number, deadlineTime?: unknown): GwFixtureWindow | null {
  const all = Array.isArray(fixtures) ? fixtures : [];
  const ownKickoffs = all.filter(f => Number(f?.event) === gameweek)
    .map(f => parseTime(f?.kickoff_time)).filter(Number.isFinite).sort((a,b)=>a-b);
  const startFromDeadline = parseTime(deadlineTime);
  const start = Number.isFinite(startFromDeadline) ? startFromDeadline
    : ownKickoffs[0];
  if (!Number.isFinite(start)) return null;
  const next = all.filter(f => Number(f?.event) === gameweek+1)
    .map(f => parseTime(f?.kickoff_time)).filter(Number.isFinite);
  const nextFirst = next.length ? Math.min(...next) : Infinity;
  const end = Math.min(start + 7 * DAY_MS, nextFirst);
  const allowedKickoffs = ownKickoffs.filter(t => t >= start - 3 * 60 * 60 * 1000 && t < end);
  return { start, end, firstKickoff: allowedKickoffs[0] ?? NaN, lastEligibleKickoff: allowedKickoffs.at(-1) ?? NaN };
}

export function gameweekSettlementReadiness(
  fixtures: any[],
  gameweek: number,
  settlementCutoff: unknown,
  now = Date.now(),
  options: GwReadinessOptions = {},
): GameweekSettlementReadiness {
  const answer = (ready: boolean, code: string, message: string,
    eligible: any[] = [], unfinished: any[] = [], excluded: any[] = [], cutoff = NaN): GameweekSettlementReadiness => ({
    ready, code, message, eligibleMatches: eligible.length, unfinishedMatches: unfinished.length,
    excludedLatePostponements: excluded.length,
    excludedFixtures: excluded.map(f => ({ id: Number(f?.id || 0), kickoffTime: f?.kickoff_time || null })),
    unfinishedFixtures: unfinished.map(f => ({
      id: Number(f?.id || 0), kickoffTime: f?.kickoff_time || null,
      started: f?.started === true, fplFinished: f?.finished === true,
    })),
    cutoffAt: Number.isFinite(cutoff) ? new Date(cutoff).toISOString() : null,
  });
  const configured = parseTime(settlementCutoff);
  if (!Number.isFinite(configured)) return answer(false, "MISSING_SETTLEMENT_CUTOFF", "The gameweek settlement cutoff could not be verified.");
  if (!Array.isArray(fixtures) || !fixtures.length) return answer(false, "FIXTURE_FEED_UNAVAILABLE", "Premier League fixtures are unavailable; cannot verify the last match.");
  const gwFixtures = fixtures.filter((f: any) => Number(f?.event) === gameweek);
  if (!gwFixtures.length) return answer(false, "GAMEWEEK_FIXTURES_UNAVAILABLE", "No Premier League fixtures are assigned to this gameweek.");

  const window = gameweekFixtureWindow(fixtures, gameweek, options.deadlineTime);
  if (!window) return answer(false, "GAMEWEEK_WINDOW_UNVERIFIED", "The start of this gameweek cannot be verified; do not skip fixtures.");
  const eligible: any[] = [];
  const excluded: any[] = [];
  for (const f of gwFixtures) {
    const kickoff = parseTime(f?.kickoff_time);
    // An unassigned postponed fixture cannot be counted as played. Only
    // exclude it after the original GW's seven-day window actually ends.
    if ((!Number.isFinite(kickoff) && now >= window.end) ||
      (Number.isFinite(kickoff) && kickoff >= window.end)) excluded.push(f);
    else eligible.push(f);
  }
  if (!eligible.length) return answer(false, "NO_ELIGIBLE_FIXTURES", "There are no eligible fixtures inside this gameweek.", eligible, [], excluded);

  const verified = options.confirmedFinalFixtureIds || new Set<number>();
  const unfinished = eligible.filter(f => {
    const kickoff = parseTime(f?.kickoff_time);
    if (!Number.isFinite(kickoff) || kickoff > now) return true;
    return f?.finished !== true && !verified.has(Number(f?.id || 0));
  });
  const computed = Number.isFinite(window.lastEligibleKickoff) ? window.lastEligibleKickoff + POST_MATCH_MS : configured;
  const effectiveCutoff = options.useFixtureCutoff ? computed : Math.max(configured, computed);
  if (!Number.isFinite(effectiveCutoff) || now < effectiveCutoff)
    return answer(false, "SETTLEMENT_CUTOFF_NOT_REACHED", "The final eligible Premier League match's post-match window has not yet passed.", eligible, unfinished, excluded, effectiveCutoff);
  if (unfinished.length) {
    const sample = unfinished.slice(0,3).map(f => Number(f?.id || 0)).filter(Boolean).join(", ");
    return answer(false, "GAMEWEEK_MATCHES_UNFINISHED",
      `${unfinished.length} eligible Premier League match(es) still lack verified final-time confirmation${sample ? ` (fixture IDs: ${sample}${unfinished.length > 3 ? ", …" : ""})` : ""}. ${excluded.length} fixture(s) moved outside GW${gameweek} were excluded; FPL and API-Football final-time evidence is checked.`,
      eligible, unfinished, excluded, effectiveCutoff);
  }
  return answer(true, "READY_FOR_FINAL_SCORING",
    `All ${eligible.length} eligible PL fixtures are finished. ${excluded.length} fixture(s) moved outside GW${gameweek} excluded. Final API-Football player statistics must still be verified before prizes.`,
    eligible, [], excluded, effectiveCutoff);
}

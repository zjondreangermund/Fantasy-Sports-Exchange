/**
 * GW final whistle guard: a scheduled time alone never authorizes settlement.
 * The last eligible Premier League fixture must be confirmed FT by the FPL
 * fixture feed; API-Football player statistics are independently verified later.
 * A fixture moved to or beyond the next GW's first kickoff is excluded.
 */
export type GameweekSettlementReadiness = {
  ready: boolean;
  code: string;
  message: string;
  eligibleMatches: number;
  unfinishedMatches: number;
  excludedLatePostponements: number;
};

export function gameweekSettlementReadiness(
  fixtures: any[],
  gameweek: number,
  settlementCutoff: unknown,
  now = Date.now(),
): GameweekSettlementReadiness {
  const result = (ready: boolean, code: string, message: string, eligibleMatches = 0, unfinishedMatches = 0, excludedLatePostponements = 0): GameweekSettlementReadiness =>
    ({ ready, code, message, eligibleMatches, unfinishedMatches, excludedLatePostponements });
  const cutoff = new Date(String(settlementCutoff || "")).getTime();
  if (!Number.isFinite(cutoff)) return result(false, "MISSING_SETTLEMENT_CUTOFF", "The gameweek settlement cutoff could not be verified.");
  if (now < cutoff) return result(false, "SETTLEMENT_CUTOFF_NOT_REACHED", "The final gameweek match settlement window has not yet passed.");
  if (!Array.isArray(fixtures) || !fixtures.length) return result(false, "FIXTURE_FEED_UNAVAILABLE", "Premier League fixtures are unavailable; cannot verify the last match.");
  const gwFixtures = fixtures.filter((f: any) => Number(f?.event) === gameweek);
  if (!gwFixtures.length) return result(false, "GAMEWEEK_FIXTURES_UNAVAILABLE", "No Premier League fixtures are assigned to this gameweek.");
  const nextKickoffs = fixtures.filter((f: any) => Number(f?.event) === gameweek + 1)
    .map((f: any) => Date.parse(String(f?.kickoff_time || ""))).filter(Number.isFinite);
  const nextFirst = nextKickoffs.length ? Math.min(...nextKickoffs) : Infinity;
  const eligible = gwFixtures.filter((f: any) => {
    const kickoff = Date.parse(String(f?.kickoff_time || ""));
    return !Number.isFinite(kickoff) || kickoff < nextFirst;
  });
  const excludedLatePostponements = gwFixtures.length - eligible.length;
  if (!eligible.length) return result(false, "NO_ELIGIBLE_FIXTURES", "No eligible Premier League fixtures can be verified.", 0, 0, excludedLatePostponements);
  const unfinished = eligible.filter((f: any) => {
    const kickoff = Date.parse(String(f?.kickoff_time || ""));
    // A missing scheduled kickoff is not evidence a postponed match ended.
    return !Number.isFinite(kickoff) || f?.finished !== true;
  });
  if (unfinished.length) {
    return result(false, "GAMEWEEK_MATCHES_UNFINISHED",
      `${unfinished.length} eligible Premier League match(es) are not confirmed finished. Postponed fixtures remain pending until rescheduled or excluded under the next-GW rule.`,
      eligible.length, unfinished.length, excludedLatePostponements);
  }
  return result(true, "READY_FOR_FINAL_SCORING",
    "All eligible Premier League fixtures are finished. Final API-Football player statistics must still be verified before prizes.",
    eligible.length, 0, excludedLatePostponements);
}

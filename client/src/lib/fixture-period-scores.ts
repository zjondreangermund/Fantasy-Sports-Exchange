type PeriodScore = { home?: unknown; away?: unknown } | null | undefined;
type FixtureScore = { halftime?: PeriodScore; fulltime?: PeriodScore } | null | undefined;

function confirmedScore(score: PeriodScore): string {
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
  return valid(score?.home) && valid(score?.away) ? `${score.home} : ${score.away}` : 'Awaiting data';
}

export function fixturePeriodScores(status: unknown, score: FixtureScore) {
  const phase = String(status || '').toUpperCase();
  const halfReached = ['HT', '2H', 'FT', 'ET', 'BT', 'P', 'AET', 'PEN'].includes(phase);
  const fullReached = ['FT', 'ET', 'BT', 'P', 'AET', 'PEN'].includes(phase);
  // Live goals and provisional provider period values are never final results.
  return {
    halftime: halfReached ? confirmedScore(score?.halftime) : 'Not confirmed',
    fulltime: fullReached ? confirmedScore(score?.fulltime) : 'Not confirmed',
  };
}

import { fplApi } from "./fplApi.js";

export type LiveFplPointFeedItem = {
  id: string;
  gameId: number;
  team: string;
  playerId: number;
  playerName: string;
  playerTeam: string;
  delta: number;
  totalPoints: number;
  reason: string;
  createdAt: string;
  source: "fpl-live";
};

function numberValue(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function describeStats(stats: any): string {
  const parts: string[] = [];
  const add = (value: unknown, singular: string, plural = `${singular}s`) => {
    const count = numberValue(value);
    if (count > 0) parts.push(`${count} ${count === 1 ? singular : plural}`);
  };

  add(stats?.goals_scored, "goal");
  add(stats?.assists, "assist");
  if (numberValue(stats?.clean_sheets) > 0) parts.push("clean sheet");
  add(stats?.penalties_saved, "penalty saved", "penalties saved");
  add(stats?.bonus, "bonus", "bonus");
  add(stats?.yellow_cards, "yellow card");
  add(stats?.red_cards, "red card");
  add(stats?.own_goals, "own goal");
  add(stats?.penalties_missed, "penalty missed", "penalties missed");

  return parts.length > 0 ? parts.join(" • ") : `${numberValue(stats?.minutes)} minutes`;
}

export async function buildRealFplPointFeed(limit = 20): Promise<LiveFplPointFeedItem[]> {
  const safeLimit = Math.max(1, Math.min(50, Number(limit || 20)));
  const [bootstrap, live, fixtures] = await Promise.all([
    fplApi.bootstrap(),
    fplApi.getLiveGameweek(),
    fplApi.fixturesLive(),
  ]);

  const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const liveElements = Array.isArray(live?.elements) ? live.elements : [];
  const fixtureRows = Array.isArray(fixtures) ? fixtures : [];
  const currentEvent = Number(bootstrap?.events?.find((event: any) => event?.is_current)?.id || live?.event || 0);

  const activeFixtureIds = new Set(
    fixtureRows
      .filter((fixture: any) => Number(fixture?.event || 0) === currentEvent && Boolean(fixture?.started) && !Boolean(fixture?.finished))
      .map((fixture: any) => Number(fixture?.id)),
  );

  if (currentEvent <= 0 || activeFixtureIds.size === 0) return [];

  const elementById = new Map<number, any>(elements.map((element: any) => [Number(element?.id), element]));
  const teamById = new Map<number, any>(teams.map((team: any) => [Number(team?.id), team]));
  const createdAt = new Date().toISOString();

  return liveElements
    .map((liveElement: any): LiveFplPointFeedItem | null => {
      const stats = liveElement?.stats || {};
      const totalPoints = numberValue(stats?.total_points);
      const minutes = numberValue(stats?.minutes);
      if (totalPoints === 0 && minutes === 0) return null;

      const element = elementById.get(Number(liveElement?.id));
      if (!element) return null;

      const explanations = Array.isArray(liveElement?.explain) ? liveElement.explain : [];
      const belongsToActiveFixture = explanations.length === 0 || explanations.some((explanation: any) =>
        Array.isArray(explanation?.fixtures)
          && explanation.fixtures.some((fixture: any) => activeFixtureIds.has(Number(fixture?.id))),
      );
      if (!belongsToActiveFixture) return null;

      const team = teamById.get(Number(element?.team));
      const playerName = `${String(element?.first_name || "").trim()} ${String(element?.second_name || "").trim()}`.trim()
        || String(element?.web_name || "Player");
      const playerTeam = String(team?.short_name || team?.name || "PL");

      return {
        id: `fpl-${currentEvent}-${Number(liveElement?.id)}`,
        gameId: currentEvent,
        team: playerTeam,
        playerId: Number(liveElement?.id),
        playerName,
        playerTeam,
        delta: totalPoints,
        totalPoints,
        reason: describeStats(stats),
        createdAt,
        source: "fpl-live",
      };
    })
    .filter((item): item is LiveFplPointFeedItem => Boolean(item))
    .sort((a, b) => Math.abs(b.totalPoints) - Math.abs(a.totalPoints) || a.playerName.localeCompare(b.playerName))
    .slice(0, safeLimit);
}

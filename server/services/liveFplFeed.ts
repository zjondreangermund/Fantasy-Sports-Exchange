import { fplApi } from "./fplApi.js";

type PointFeedItem = {
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

function n(value: unknown) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function statSummary(stats: any) {
  const parts: string[] = [];
  if (n(stats.goals_scored) > 0) parts.push(`${n(stats.goals_scored)} goal${n(stats.goals_scored) === 1 ? "" : "s"}`);
  if (n(stats.assists) > 0) parts.push(`${n(stats.assists)} assist${n(stats.assists) === 1 ? "" : "s"}`);
  if (n(stats.clean_sheets) > 0) parts.push("clean sheet");
  if (n(stats.penalties_saved) > 0) parts.push(`${n(stats.penalties_saved)} penalty saved`);
  if (n(stats.bonus) > 0) parts.push(`${n(stats.bonus)} bonus`);
  if (n(stats.yellow_cards) > 0) parts.push(`${n(stats.yellow_cards)} yellow card${n(stats.yellow_cards) === 1 ? "" : "s"}`);
  if (n(stats.red_cards) > 0) parts.push(`${n(stats.red_cards)} red card${n(stats.red_cards) === 1 ? "" : "s"}`);
  if (n(stats.own_goals) > 0) parts.push(`${n(stats.own_goals)} own goal${n(stats.own_goals) === 1 ? "" : "s"}`);
  if (n(stats.penalties_missed) > 0) parts.push(`${n(stats.penalties_missed)} penalty missed`);
  return parts.length ? parts.join(" • ") : `${n(stats.minutes)} minutes`;
}

export async function buildRealFplPointFeed(limit = 20): Promise<PointFeedItem[]> {
  const [bootstrap, live, fixtures] = await Promise.all([
    fplApi.bootstrap(),
    fplApi.getLiveGameweek(),
    fplApi.fixturesLive(),
  ]);

  const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const liveElements = Array.isArray(live?.elements) ? live.elements : [];
  const fixtureList = Array.isArray(fixtures) ? fixtures : [];

  const currentEvent = bootstrap?.events?.find((event: any) => event.is_current)?.id || live?.event || 0;
  const liveFixtureIds = new Set(
    fixtureList
      .filter((fixture: any) => Number(fixture.event || 0) === Number(currentEvent) && fixture.started && !fixture.finished)
      .map((fixture: any) => Number(fixture.id)),
  );

  if (liveFixtureIds.size === 0) return [];

  const elementById = new Map<number, any>();
  const teamById = new Map<number, any>();
  for (const element of elements) elementById.set(Number(element.id), element);
  for (const team of teams) teamById.set(Number(team.id), team);

  const feed = liveElements
    .map((liveElement: any) => {
      const stats = liveElement?.stats || {};
      const totalPoints = n(stats.total_points);
      const minutes = n(stats.minutes);
      if (totalPoints === 0 && minutes === 0) return null;

      const element = elementById.get(Number(liveElement.id));
      if (!element) return null;

      const hasLiveFixture = Array.isArray(liveElement?.explain)
        ? liveElement.explain.some((explain: any) => Array.isArray(explain?.fixtures) && explain.fixtures.some((fixture: any) => liveFixtureIds.has(Number(fixture.id))))
        : true;
      if (!hasLiveFixture) return null;

      const team = teamById.get(Number(element.team));
      const playerName = `${String(element.first_name || "").trim()} ${String(element.second_name || "").trim()}`.trim() || String(element.web_name || "Player");
      const playerTeam = String(team?.short_name || team?.name || "PL");
      return {
        id: `fpl-${currentEvent}-${liveElement.id}`,
        gameId: Number(currentEvent || 0),
        team: playerTeam,
        playerId: Number(liveElement.id),
        playerName,
        playerTeam,
        delta: totalPoints,
        totalPoints,
        reason: statSummary(stats),
        createdAt: new Date().toISOString(),
        source: "fpl-live" as const,
      };
    })
    .filter(Boolean) as PointFeedItem[];

  return feed
    .sort((a, b) => Math.abs(b.totalPoints) - Math.abs(a.totalPoints) || b.playerName.localeCompare(a.playerName))
    .slice(0, Math.max(1, Math.min(50, Number(limit || 20))));
}

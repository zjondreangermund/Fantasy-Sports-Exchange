import { sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  loadApiFootballPlayerDirectory,
  resolveApiFootballPlayer,
  type ApiFootballDirectoryPlayer,
} from "./apiFootballPlayerDirectory.js";
import {
  mapApiFootballStatisticsToDetailedStats,
  type PlayerStats,
} from "./scoring.js";

const LEAGUE_ID = Math.max(1, Number(process.env.API_FOOTBALL_LEAGUE_ID || 39));

const DETAILED_FIELDS = [
  "completed_passes",
  "total_passes",
  "pass_accuracy",
  "match_rating",
  "rating_samples",
  "key_passes",
  "tackles",
  "interceptions",
  "duels_won",
  "duels_total",
  "shots_on_target",
  "shots_total",
  "successful_dribbles",
  "dribbles_attempted",
  "blocks",
  "fouls_drawn",
  "fouls_committed",
  "penalties_won",
  "penalties_conceded",
  "penalties_scored",
  "offsides",
] as const;

export type DetailedScoringContext = {
  directory: ApiFootballDirectoryPlayer[];
  statsByApiPlayerId: Map<number, Partial<PlayerStats>>;
  fixtureCount: number;
  available: boolean;
  windowStart: string | null;
  windowEnd: string | null;
};

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function gameweekWindow(bootstrap: any, gameWeek: number) {
  const events = (Array.isArray(bootstrap?.events) ? bootstrap.events : [])
    .filter((event: any) => Number(event?.id || 0) > 0)
    .sort((a: any, b: any) => Number(a.id) - Number(b.id));
  const current = events.find((event: any) => Number(event.id) === Number(gameWeek));
  if (!current?.deadline_time) return null;

  const deadline = new Date(String(current.deadline_time));
  if (!Number.isFinite(deadline.getTime())) return null;
  const next = events.find((event: any) => Number(event.id) > Number(gameWeek) && event?.deadline_time);
  const nextDeadline = next?.deadline_time ? new Date(String(next.deadline_time)) : null;

  const start = new Date(deadline.getTime() - 2 * 60 * 60 * 1000);
  const end = nextDeadline && Number.isFinite(nextDeadline.getTime())
    ? nextDeadline
    : new Date(deadline.getTime() + 9 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function mergeDetailedStats(current: Partial<PlayerStats> | undefined, incoming: Partial<PlayerStats>) {
  const merged: Partial<PlayerStats> = {
    ...(current || {}),
    detailed_stats_available: true,
    provider: "api-football",
  };
  for (const field of DETAILED_FIELDS) {
    merged[field] = Number(current?.[field] || 0) + Number(incoming?.[field] || 0);
  }
  return merged;
}

export async function loadDetailedScoringContext(bootstrap: any, gameWeek: number): Promise<DetailedScoringContext> {
  const window = gameweekWindow(bootstrap, gameWeek);
  const empty: DetailedScoringContext = {
    directory: [],
    statsByApiPlayerId: new Map(),
    fixtureCount: 0,
    available: false,
    windowStart: window?.start.toISOString() || null,
    windowEnd: window?.end.toISOString() || null,
  };
  if (!window) return empty;

  try {
    const rows = rowsOf(await db.execute(sql`
      select s.api_player_id as "apiPlayerId", s.statistics,
             s.api_fixture_id as "fixtureId", f.kickoff_at as "kickoffAt"
      from app.api_football_player_match_stats s
      join app.api_football_fixtures f on f.api_fixture_id=s.api_fixture_id
      where f.league_id=${LEAGUE_ID}
        and f.kickoff_at >= ${window.start}
        and f.kickoff_at < ${window.end}
        and s.statistics <> '{}'::jsonb
      order by f.kickoff_at asc, s.api_fixture_id asc
    `));
    if (!rows.length) return empty;

    const statsByApiPlayerId = new Map<number, Partial<PlayerStats>>();
    const fixtureIds = new Set<number>();
    for (const row of rows) {
      const apiPlayerId = Number(row.apiPlayerId || 0);
      if (!apiPlayerId) continue;
      fixtureIds.add(Number(row.fixtureId || 0));
      const detailed = mapApiFootballStatisticsToDetailedStats(row.statistics || {});
      statsByApiPlayerId.set(apiPlayerId, mergeDetailedStats(statsByApiPlayerId.get(apiPlayerId), detailed));
    }

    const directory = await loadApiFootballPlayerDirectory();
    return {
      directory,
      statsByApiPlayerId,
      fixtureCount: fixtureIds.size,
      available: statsByApiPlayerId.size > 0,
      windowStart: window.start.toISOString(),
      windowEnd: window.end.toISOString(),
    };
  } catch (error) {
    console.warn(`Detailed API-Football scoring unavailable for GW${gameWeek}; using official FPL fallback:`, error);
    return empty;
  }
}

export function resolveDetailedStatsForPlayer(player: any, context: DetailedScoringContext) {
  if (!context.available || !context.directory.length) return null;
  const match = resolveApiFootballPlayer(player, context.directory);
  if (!match) return null;
  const stats = context.statsByApiPlayerId.get(match.apiPlayerId);
  return stats ? {
    ...stats,
    api_player_id: match.apiPlayerId,
    api_position: match.position,
    api_player_name: match.name,
    api_team: match.team,
  } : null;
}

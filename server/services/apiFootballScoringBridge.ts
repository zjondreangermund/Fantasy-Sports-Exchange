import { sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  loadApiFootballPlayerDirectory,
  resolveApiFootballPlayer,
  normalizeApiFootballPosition,
  type ApiFootballDirectoryPlayer,
} from "./apiFootballPlayerDirectory.js";
import {
  mapApiFootballStatisticsToDetailedStats,
  mapApiFootballStatsToPlayerStats,
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
      select s.api_player_id as "apiPlayerId", s.api_team_id as "apiTeamId",
             coalesce(s.player_name,'') as "playerName", coalesce(s.position,'') as position,
             coalesce(t.name,'') as "teamName", f.season, s.statistics,
             s.api_fixture_id as "fixtureId", f.kickoff_at as "kickoffAt"
      from app.api_football_player_match_stats s
      join app.api_football_fixtures f on f.api_fixture_id=s.api_fixture_id
      left join app.api_football_teams t on t.api_team_id=s.api_team_id
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
    // SCORE_DETAIL_MATCH_ROW_IDENTITY_V1
    // Match-stat rows are also authoritative provider identities. Add them as
    // fallback candidates when the periodic squad directory is partial/stale.
    const knownIds = new Set(directory.map((player) => Number(player.apiPlayerId || 0)));
    for (const row of rows) {
      const apiPlayerId = Number(row.apiPlayerId || 0);
      if (!apiPlayerId || knownIds.has(apiPlayerId) || !String(row.playerName || "").trim()) continue;
      directory.push({
        apiPlayerId,
        season: Number(row.season || 0),
        apiTeamId: Number(row.apiTeamId || 0),
        name: String(row.playerName || "").trim(),
        firstName: "",
        lastName: "",
        team: String(row.teamName || "").trim(),
        position: String(row.position || "").toUpperCase() === "G" ? "GK"
          : String(row.position || "").toUpperCase() === "D" ? "DEF"
          : String(row.position || "").toUpperCase() === "F" ? "FWD"
          : "MID",
        photo: "",
        nationality: "",
        age: null,
        squadNumber: null,
        active: true,
        updatedAt: row.kickoffAt ? new Date(row.kickoffAt).toISOString() : null,
      });
      knownIds.add(apiPlayerId);
    }
    return {
      directory,
      statsByApiPlayerId,
      fixtureCount: fixtureIds.size,
      available: statsByApiPlayerId.size > 0,
      windowStart: window.start.toISOString(),
      windowEnd: window.end.toISOString(),
    };
  } catch (error) {
    console.warn(`Detailed API-Football scoring unavailable for GW${gameWeek}; only verified core player stats will score until detailed actions are available:`, error);
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


// API_FOOTBALL_ONLY_SCORING_V1
export type ApiFootballFixtureState = {
  fixtureId: number;
  apiTeamId: number;
  opponentTeamId: number;
  kickoffAt: string | null;
  statusShort: string;
  statsReady: boolean;
};

export type ApiFootballGameweekScoringContext = {
  directory: ApiFootballDirectoryPlayer[];
  statsByApiPlayerId: Map<number, PlayerStats>;
  fixtureByTeamId: Map<number, ApiFootballFixtureState>;
  departedDirectory: ApiFootballDirectoryPlayer[];
  fixtureCount: number;
  statsReadyFixtureCount: number;
  available: boolean;
  season: number | null;
  gameWeek: number;
};

const PLAYER_STAT_SUM_FIELDS: Array<keyof PlayerStats> = [
  "minutes", "goals_scored", "assists", "clean_sheets", "goals_conceded",
  "own_goals", "penalties_saved", "penalties_missed", "yellow_cards", "red_cards",
  "saves", "completed_passes", "total_passes", "key_passes", "tackles",
  "interceptions", "duels_won", "duels_total", "shots_on_target", "shots_total",
  "successful_dribbles", "dribbles_attempted", "blocks", "fouls_drawn",
  "fouls_committed", "penalties_won", "penalties_conceded", "penalties_scored",
  "offsides",
];

function mergeApiFootballFullStats(current: PlayerStats | undefined, incoming: PlayerStats): PlayerStats {
  if (!current) {
    return {
      ...incoming,
      match_rating: 0,
      rating_samples: 0,
      bonus: 0,
      bps: 0,
      influence: "0",
      creativity: "0",
      threat: "0",
      ict_index: "0",
      provider: "api-football",
      detailed_stats_available: true,
    };
  }
  const merged: PlayerStats = { ...current };
  for (const field of PLAYER_STAT_SUM_FIELDS) {
    (merged as any)[field] = Number((current as any)[field] || 0) + Number((incoming as any)[field] || 0);
  }
  merged.pass_accuracy = merged.total_passes > 0
    ? Math.max(0, Math.min(100, (merged.completed_passes / merged.total_passes) * 100))
    : 0;
  merged.match_rating = 0;
  merged.rating_samples = 0;
  merged.bonus = 0;
  merged.bps = 0;
  merged.influence = "0";
  merged.creativity = "0";
  merged.threat = "0";
  merged.ict_index = "0";
  merged.provider = "api-football";
  merged.detailed_stats_available = true;
  return merged;
}

function inferredFixtureStats(row: any): PlayerStats {
  const mapped = mapApiFootballStatsToPlayerStats(row?.statistics || {});
  // Provider match rating is deliberately not part of Fantasy Arena scoring.
  mapped.match_rating = 0;
  mapped.rating_samples = 0;

  const minutes = Number(mapped.minutes || 0);
  const teamId = Number(row?.apiTeamId || 0);
  const homeTeamId = Number(row?.homeTeamId || 0);
  const awayTeamId = Number(row?.awayTeamId || 0);
  const homeScore = Number(row?.homeScore ?? 0);
  const awayScore = Number(row?.awayScore ?? 0);
  const opponentGoals = teamId === homeTeamId ? awayScore : teamId === awayTeamId ? homeScore : 0;

  if (minutes > 0 && opponentGoals === 0) mapped.clean_sheets = 1;
  // API-Football's player payload does not consistently populate goals.conceded
  // for outfield players. Use the verified fixture score for GK/DEF penalties.
  if (minutes > 0 && opponentGoals > Number(mapped.goals_conceded || 0)) {
    mapped.goals_conceded = opponentGoals;
  }
  return mapped;
}

export async function loadApiFootballGameweekScoringContext(gameWeek: number): Promise<ApiFootballGameweekScoringContext> {
  const gw = Math.max(1, Number(gameWeek || 0));
  const empty = (directory: ApiFootballDirectoryPlayer[] = []): ApiFootballGameweekScoringContext => ({
    directory,
    statsByApiPlayerId: new Map(),
    fixtureByTeamId: new Map(),
    departedDirectory: [],
    fixtureCount: 0,
    statsReadyFixtureCount: 0,
    available: false,
    season: null,
    gameWeek: gw,
  });

  try {
    const directory = await loadApiFootballPlayerDirectory();
    const seasonRow = rowsOf(await db.execute(sql`
      select max(season)::int as season
      from app.api_football_fixtures
      where league_id=${LEAGUE_ID}
    `))[0];
    const season = Number(seasonRow?.season || 0);
    if (!season) return empty(directory);

    const roundPattern = `(^|[^0-9])${gw}$`;
    const fixtureRows = rowsOf(await db.execute(sql`
      select api_fixture_id as "fixtureId", home_team_id as "homeTeamId",
             away_team_id as "awayTeamId", kickoff_at as "kickoffAt",
             coalesce(status_short,'NS') as "statusShort",
             stats_synced_at as "statsSyncedAt"
      from app.api_football_fixtures
      where league_id=${LEAGUE_ID}
        and season=${season}
        and coalesce(round,'') ~ ${roundPattern}
      order by kickoff_at asc, api_fixture_id asc
    `));
    if (!fixtureRows.length) return { ...empty(directory), season };

    const fixtureByTeamId = new Map<number, ApiFootballFixtureState>();
    let statsReadyFixtureCount = 0;
    for (const row of fixtureRows) {
      const fixtureId = Number(row.fixtureId || 0);
      const homeTeamId = Number(row.homeTeamId || 0);
      const awayTeamId = Number(row.awayTeamId || 0);
      const statsReady = Boolean(row.statsSyncedAt);
      if (statsReady) statsReadyFixtureCount += 1;
      const base = {
        fixtureId,
        kickoffAt: row.kickoffAt ? new Date(row.kickoffAt).toISOString() : null,
        statusShort: String(row.statusShort || "NS"),
        statsReady,
      };
      if (homeTeamId) fixtureByTeamId.set(homeTeamId, { ...base, apiTeamId: homeTeamId, opponentTeamId: awayTeamId });
      if (awayTeamId) fixtureByTeamId.set(awayTeamId, { ...base, apiTeamId: awayTeamId, opponentTeamId: homeTeamId });
    }

    const playerRows = rowsOf(await db.execute(sql`
      select s.api_player_id as "apiPlayerId", s.api_team_id as "apiTeamId",
             coalesce(s.player_name,'') as "playerName", coalesce(s.position,'') as position,
             coalesce(t.name,'') as "teamName", f.season, s.statistics,
             s.api_fixture_id as "fixtureId", f.kickoff_at as "kickoffAt",
             f.home_team_id as "homeTeamId", f.away_team_id as "awayTeamId",
             f.home_score as "homeScore", f.away_score as "awayScore"
      from app.api_football_player_match_stats s
      join app.api_football_fixtures f on f.api_fixture_id=s.api_fixture_id
      left join app.api_football_teams t on t.api_team_id=s.api_team_id
      where f.league_id=${LEAGUE_ID}
        and f.season=${season}
        and coalesce(f.round,'') ~ ${roundPattern}
        and s.statistics <> '{}'::jsonb
      order by f.kickoff_at asc, s.api_fixture_id asc
    `));

    // API_FOOTBALL_IDENTITY_COVERAGE_V2
    // A paid API-Football scoring path must not fail just because the periodic
    // squad directory missed one player. Build identity coverage from the same
    // provider's latest current-season match rows and the current GW lineups.
    const historicalIdentityRows = rowsOf(await db.execute(sql`
      select distinct on (s.api_player_id)
             s.api_player_id as "apiPlayerId", s.api_team_id as "apiTeamId",
             coalesce(s.player_name,'') as "playerName", coalesce(s.position,'') as position,
             coalesce(t.name,'') as "teamName", f.season, f.kickoff_at as "kickoffAt"
      from app.api_football_player_match_stats s
      join app.api_football_fixtures f on f.api_fixture_id=s.api_fixture_id
      left join app.api_football_teams t on t.api_team_id=s.api_team_id
      where f.league_id=${LEAGUE_ID}
        and f.season between ${season - 1} and ${season}
        and coalesce(s.player_name,'') <> ''
        and s.api_team_id in (
          select home_team_id from app.api_football_fixtures where league_id=${LEAGUE_ID} and season=${season}
          union
          select away_team_id from app.api_football_fixtures where league_id=${LEAGUE_ID} and season=${season}
        )
      order by s.api_player_id, f.kickoff_at desc nulls last, s.api_fixture_id desc
    `));

    const lineupRows = rowsOf(await db.execute(sql`
      select l.api_team_id as "apiTeamId", coalesce(t.name,'') as "teamName",
             l.start_xi as "startXi", l.substitutes, f.season, f.kickoff_at as "kickoffAt"
      from app.api_football_lineups l
      join app.api_football_fixtures f on f.api_fixture_id=l.api_fixture_id
      left join app.api_football_teams t on t.api_team_id=l.api_team_id
      where f.league_id=${LEAGUE_ID}
        and f.season=${season}
        and coalesce(f.round,'') ~ ${roundPattern}
    `));

    // Injured players can legitimately be absent from both the current squad
    // response and every lineup/player-stat payload. API-Football's injury feed
    // still gives us the provider player ID + current Premier League club.
    const injuryIdentityRows = rowsOf(await db.execute(sql`
      select distinct on (i.api_player_id)
             i.api_player_id as "apiPlayerId", i.api_team_id as "apiTeamId",
             coalesce(i.player_name,'') as "playerName", '' as position,
             coalesce(t.name,'') as "teamName", ${season}::int as season,
             i.fixture_date as "kickoffAt"
      from app.api_football_injuries i
      left join app.api_football_teams t on t.api_team_id=i.api_team_id
      where i.season=${season}
        and i.active=true
        and coalesce(i.player_name,'') <> ''
        and i.api_team_id in (
          select home_team_id from app.api_football_fixtures where league_id=${LEAGUE_ID} and season=${season}
          union
          select away_team_id from app.api_football_fixtures where league_id=${LEAGUE_ID} and season=${season}
        )
      order by i.api_player_id, i.fixture_date desc nulls last, i.updated_at desc
    `));

    // A late return from loan / transfer can also precede the next squad refresh.
    // Use only transfers INTO a current Premier League team and only as identity
    // evidence; scoring still requires the player's API-Football fixture stats.
    const transferIdentityRows = rowsOf(await db.execute(sql`
      select distinct on (tr.api_player_id)
             tr.api_player_id as "apiPlayerId", tr.to_team_id as "apiTeamId",
             coalesce(tr.player_name,'') as "playerName", '' as position,
             coalesce(t.name,'') as "teamName", ${season}::int as season,
             tr.transfer_date::timestamptz as "kickoffAt"
      from app.api_football_transfers tr
      left join app.api_football_teams t on t.api_team_id=tr.to_team_id
      where coalesce(tr.player_name,'') <> ''
        and tr.to_team_id in (
          select home_team_id from app.api_football_fixtures where league_id=${LEAGUE_ID} and season=${season}
          union
          select away_team_id from app.api_football_fixtures where league_id=${LEAGUE_ID} and season=${season}
        )
        and tr.transfer_date >= make_date(${season}, 6, 1)
      order by tr.api_player_id, tr.transfer_date desc
    `));

    const statsByApiPlayerId = new Map<number, PlayerStats>();
    const identityKey = (apiPlayerId: unknown, apiTeamId: unknown) => `${Number(apiPlayerId || 0)}:${Number(apiTeamId || 0)}`;
    const knownIdentityKeys = new Set(directory.map((player) => identityKey(player.apiPlayerId, player.apiTeamId)));

    const addIdentityCandidate = (row: any) => {
      const apiPlayerId = Number(row?.apiPlayerId || 0);
      const apiTeamId = Number(row?.apiTeamId || 0);
      const playerName = String(row?.playerName || "").trim();
      const key = identityKey(apiPlayerId, apiTeamId);
      if (!apiPlayerId || !apiTeamId || !playerName || knownIdentityKeys.has(key)) return;
      const rawPosition = String(row?.position || "").toUpperCase();
      directory.push({
        apiPlayerId,
        season: Number(row?.season || season),
        apiTeamId,
        name: playerName,
        firstName: "",
        lastName: "",
        team: String(row?.teamName || "").trim(),
        position: rawPosition === "G" || rawPosition === "GK" ? "GK"
          : rawPosition === "D" || rawPosition === "DEF" ? "DEF"
          : rawPosition === "F" || rawPosition === "FWD" ? "FWD"
          : "MID",
        photo: "",
        nationality: "",
        age: null,
        squadNumber: null,
        active: true,
        updatedAt: row?.kickoffAt ? new Date(row.kickoffAt).toISOString() : null,
      });
      knownIdentityKeys.add(key);
    };

    for (const row of historicalIdentityRows) addIdentityCandidate(row);
    for (const row of injuryIdentityRows) addIdentityCandidate(row);
    for (const row of transferIdentityRows) addIdentityCandidate(row);
    for (const lineup of lineupRows) {
      const rows = [
        ...(Array.isArray(lineup?.startXi) ? lineup.startXi : []),
        ...(Array.isArray(lineup?.substitutes) ? lineup.substitutes : []),
      ];
      for (const item of rows) {
        const player = item?.player || item || {};
        addIdentityCandidate({
          apiPlayerId: player?.id,
          apiTeamId: lineup?.apiTeamId,
          playerName: player?.name,
          position: player?.pos || player?.position,
          teamName: lineup?.teamName,
          season: lineup?.season,
          kickoffAt: lineup?.kickoffAt,
        });
      }
    }
    for (const row of playerRows) {
      const apiPlayerId = Number(row.apiPlayerId || 0);
      if (!apiPlayerId) continue;
      const mapped = inferredFixtureStats(row);
      statsByApiPlayerId.set(apiPlayerId, mergeApiFootballFullStats(statsByApiPlayerId.get(apiPlayerId), mapped));

      addIdentityCandidate(row);
    }

    // API_FOOTBALL_DEPARTURE_IDENTITY_V1
    // Confirm players who left a current Premier League club before/during this
    // season directly from API-Football transfers. They are valid zero-score
    // cases, not unresolved identities, when they have no eligible PL fixture.
    let departedDirectory: ApiFootballDirectoryPlayer[] = [];
    try {
      const departureRows = rowsOf(await db.execute(sql`
        with current_pl_teams as (
          select home_team_id as team_id
          from app.api_football_fixtures
          where league_id=${LEAGUE_ID} and season=${season}
          union
          select away_team_id as team_id
          from app.api_football_fixtures
          where league_id=${LEAGUE_ID} and season=${season}
        ),
        latest_transfer as (
          select distinct on (tr.api_player_id)
                 tr.api_player_id, tr.transfer_date, tr.from_team_id, tr.to_team_id,
                 tr.player_name, tr.updated_at
          from app.api_football_transfers tr
          where tr.transfer_date >= make_date(${season}, 6, 1)
          order by tr.api_player_id, tr.transfer_date desc, tr.updated_at desc
        )
        select lt.api_player_id as "apiPlayerId",
               coalesce(lt.player_name, p.name, '') as "playerName",
               lt.from_team_id as "apiTeamId",
               coalesce(ft.name, p.team_name, '') as "teamName",
               coalesce(p.position, 'MID') as position,
               coalesce(p.photo, '') as photo,
               coalesce(p.nationality, '') as nationality,
               p.age, p.squad_number as "squadNumber",
               lt.transfer_date as "transferDate"
        from latest_transfer lt
        join current_pl_teams current_from on current_from.team_id=lt.from_team_id
        left join current_pl_teams current_to on current_to.team_id=lt.to_team_id
        left join app.api_football_teams ft on ft.api_team_id=lt.from_team_id
        left join lateral (
          select ap.*
          from app.api_football_players ap
          where ap.api_player_id=lt.api_player_id
          order by ap.season desc, ap.updated_at desc
          limit 1
        ) p on true
        where current_to.team_id is null
          and coalesce(lt.player_name, p.name, '') <> ''
      `));
      departedDirectory = departureRows.map((row: any) => ({
        apiPlayerId: Number(row.apiPlayerId || 0),
        season,
        apiTeamId: Number(row.apiTeamId || 0),
        name: String(row.playerName || "").trim(),
        firstName: "",
        lastName: "",
        team: String(row.teamName || "").trim(),
        position: normalizeApiFootballPosition(row.position),
        photo: String(row.photo || ""),
        nationality: String(row.nationality || ""),
        age: row.age == null ? null : Number(row.age),
        squadNumber: row.squadNumber == null ? null : Number(row.squadNumber),
        active: false,
        updatedAt: row.transferDate ? new Date(row.transferDate).toISOString() : null,
      })).filter((player) => player.apiPlayerId > 0 && Boolean(player.name) && Boolean(player.team));
    } catch (error) {
      console.warn("API-Football departure identity lookup unavailable:", error);
    }

    return {
      directory,
      statsByApiPlayerId,
      fixtureByTeamId,
      departedDirectory,
      fixtureCount: fixtureRows.length,
      statsReadyFixtureCount,
      available: fixtureRows.length > 0,
      season,
      gameWeek: gw,
    };
  } catch (error) {
    console.warn(`API-Football-only scoring context unavailable for GW${gw}:`, error);
    return empty();
  }
}

export function resolveApiFootballGameweekPlayer(
  player: any,
  context: ApiFootballGameweekScoringContext,
) {
  const match = resolveApiFootballPlayer(player, context.directory);
  if (match) {
    return {
      player: match,
      stats: context.statsByApiPlayerId.get(match.apiPlayerId) || null,
      fixture: context.fixtureByTeamId.get(match.apiTeamId) || null,
      departed: false,
      departedPlayer: null,
    };
  }
  const departedPlayer = resolveApiFootballPlayer(player, context.departedDirectory || []);
  if (departedPlayer) {
    return {
      player: null,
      stats: null,
      fixture: null,
      departed: true,
      departedPlayer,
    };
  }
  return null;
}

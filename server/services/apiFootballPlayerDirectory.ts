import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { normalizePlayerText } from "./fplPlayerIdentity.js";

export type CanonicalPlayerPosition = "GK" | "DEF" | "MID" | "FWD";

// API_FOOTBALL_IMAGE_HEALTH_V1
const API_FOOTBALL_MEDIA_HOST = "media.api-sports.io";
const API_FOOTBALL_PLAYER_PHOTO_PATH = /^\/football\/players\/(\d+)\.png$/i;

export function apiFootballPhotoUrl(playerId: unknown, providedPhoto?: unknown): string {
  const id = Number(playerId || 0);
  if (!Number.isInteger(id) || id <= 0) return "";
  const canonical = `https://${API_FOOTBALL_MEDIA_HOST}/football/players/${id}.png`;
  const provided = String(providedPhoto || "").trim();
  if (!provided) return canonical;
  try {
    const url = new URL(provided);
    const match = url.pathname.match(API_FOOTBALL_PLAYER_PHOTO_PATH);
    if (url.protocol === "https:" && url.hostname === API_FOOTBALL_MEDIA_HOST && Number(match?.[1] || 0) === id) return url.toString();
  } catch {}
  return canonical;
}

export function isApiFootballPlayerPhotoUrl(value: unknown, expectedPlayerId?: unknown): boolean {
  try {
    const url = new URL(String(value || ""));
    const match = url.pathname.match(API_FOOTBALL_PLAYER_PHOTO_PATH);
    if (url.protocol !== "https:" || url.hostname !== API_FOOTBALL_MEDIA_HOST || !match) return false;
    const expected = Number(expectedPlayerId || 0);
    return !expected || Number(match[1]) === expected;
  } catch {
    return false;
  }
}

export type ApiFootballDirectoryPlayer = {
  apiPlayerId: number;
  season: number;
  apiTeamId: number;
  name: string;
  firstName: string;
  lastName: string;
  team: string;
  position: CanonicalPlayerPosition;
  photo: string;
  nationality: string;
  age: number | null;
  squadNumber: number | null;
  active: boolean;
  updatedAt?: string | null;
};

export type VerifiedPlayerProfileSnapshot = {
  source: "api-football";
  season: number;
  player: {
    name: string;
    team: string;
    position: CanonicalPlayerPosition;
    imageUrl: string;
    nationality?: string;
    apiFootballId: number;
  };
  last10: Array<{
    gameweek: number;
    opponent: string;
    points: number;
    minutes: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    yellowCards: number;
    redCards: number;
    bonus: number;
    rating?: number | null;
    saves?: number;
    kickoffTime?: string | null;
    wasHome?: boolean;
  }>;
  stats: {
    matchesPlayed: number;
    minutes: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    yellowCards: number;
    redCards: number;
    bonus: number;
    totalPoints: number;
    selectedBy: null;
    value: null;
    saves: number;
    averageRating: number | null;
  };
  providers: {
    identity: "API-Football current squads";
    stats: "API-Football fixture player statistics";
    fantasyPoints: "Fantasy Arena scoring";
  };
};

let schemaPromise: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

export function apiFootballSeasonNow() {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export function normalizeApiFootballPosition(value: unknown): CanonicalPlayerPosition {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "gk" || normalized === "g" || normalized.includes("goalkeeper") || normalized.includes("keeper")) return "GK";
  if (normalized === "def" || normalized === "d" || normalized.includes("defender") || normalized.includes("back")) return "DEF";
  if (normalized === "mid" || normalized === "m" || normalized.includes("midfielder") || normalized.includes("midfield")) return "MID";
  if (normalized === "fwd" || normalized === "f" || normalized.includes("attacker") || normalized.includes("forward") || normalized.includes("striker")) return "FWD";
  return "MID";
}

export function ensureApiFootballPlayerDirectorySchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute(sql`create schema if not exists app`);
      await db.execute(sql`
        create table if not exists app.api_football_players (
          api_player_id integer not null,
          season integer not null,
          api_team_id integer not null,
          name text not null,
          first_name text,
          last_name text,
          team_name text not null,
          position text,
          photo text,
          nationality text,
          age integer,
          squad_number integer,
          active boolean not null default true,
          raw jsonb not null default '{}'::jsonb,
          updated_at timestamptz not null default now(),
          primary key (api_player_id, season, api_team_id)
        )
      `);
      await db.execute(sql`create index if not exists api_football_players_active_idx on app.api_football_players (season, active)`);
      await db.execute(sql`create index if not exists api_football_players_team_idx on app.api_football_players (season, api_team_id)`);
      await db.execute(sql`create index if not exists api_football_players_name_idx on app.api_football_players (lower(name))`);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export async function replaceApiFootballSquad(season: number, team: any, players: any[]) {
  await ensureApiFootballPlayerDirectorySchema();
  const apiTeamId = Number(team?.id || 0);
  const teamName = String(team?.name || "Unknown").trim();
  if (!apiTeamId || !teamName) return 0;

  await db.execute(sql`
    update app.api_football_players
    set active=false, updated_at=now()
    where season=${season} and api_team_id=${apiTeamId}
  `);

  let records = 0;
  for (const rawPlayer of players) {
    const player = rawPlayer?.player || rawPlayer || {};
    const apiPlayerId = Number(player?.id || 0);
    const name = String(player?.name || `${player?.firstname || ""} ${player?.lastname || ""}`).trim();
    if (!apiPlayerId || !name) continue;
    const firstName = String(player?.firstname || "").trim();
    const lastName = String(player?.lastname || "").trim();
    const position = normalizeApiFootballPosition(player?.position || rawPlayer?.position);
    const photo = apiFootballPhotoUrl(apiPlayerId, player?.photo);
    const nationality = String(player?.nationality || "").trim();
    const ageNumber = Number(player?.age);
    const numberValue = Number(player?.number ?? rawPlayer?.number);

    await db.execute(sql`
      insert into app.api_football_players (
        api_player_id, season, api_team_id, name, first_name, last_name,
        team_name, position, photo, nationality, age, squad_number, active, raw, updated_at
      ) values (
        ${apiPlayerId}, ${season}, ${apiTeamId}, ${name}, ${firstName || null}, ${lastName || null},
        ${teamName}, ${position}, ${photo || null}, ${nationality || null},
        ${Number.isFinite(ageNumber) && ageNumber > 0 ? ageNumber : null},
        ${Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null},
        true, ${JSON.stringify(rawPlayer)}::jsonb, now()
      )
      on conflict (api_player_id, season, api_team_id) do update set
        name=excluded.name,
        first_name=excluded.first_name,
        last_name=excluded.last_name,
        team_name=excluded.team_name,
        position=excluded.position,
        photo=excluded.photo,
        nationality=excluded.nationality,
        age=excluded.age,
        squad_number=excluded.squad_number,
        active=true,
        raw=excluded.raw,
        updated_at=now()
    `);
    records += 1;
  }
  return records;
}

export async function loadApiFootballPlayerDirectory(season = apiFootballSeasonNow()): Promise<ApiFootballDirectoryPlayer[]> {
  await ensureApiFootballPlayerDirectorySchema();
  let rows = rowsOf(await db.execute(sql`
    select api_player_id as "apiPlayerId", season, api_team_id as "apiTeamId",
           name, coalesce(first_name,'') as "firstName", coalesce(last_name,'') as "lastName",
           team_name as team, coalesce(position,'MID') as position, coalesce(photo,'') as photo,
           coalesce(nationality,'') as nationality, age, squad_number as "squadNumber",
           active, updated_at as "updatedAt"
    from app.api_football_players
    where season=${season} and active=true
  `));

  if (!rows.length) {
    rows = rowsOf(await db.execute(sql`
      select api_player_id as "apiPlayerId", season, api_team_id as "apiTeamId",
             name, coalesce(first_name,'') as "firstName", coalesce(last_name,'') as "lastName",
             team_name as team, coalesce(position,'MID') as position, coalesce(photo,'') as photo,
             coalesce(nationality,'') as nationality, age, squad_number as "squadNumber",
             active, updated_at as "updatedAt"
      from app.api_football_players
      where season=(select max(season) from app.api_football_players where active=true)
        and active=true
    `));
  }

  return rows.map((row: any) => ({
    apiPlayerId: Number(row.apiPlayerId || 0),
    season: Number(row.season || season),
    apiTeamId: Number(row.apiTeamId || 0),
    name: String(row.name || "Unknown Player"),
    firstName: String(row.firstName || ""),
    lastName: String(row.lastName || ""),
    team: String(row.team || "Unknown"),
    position: normalizeApiFootballPosition(row.position),
    photo: String(row.photo || ""),
    nationality: String(row.nationality || ""),
    age: row.age == null ? null : Number(row.age),
    squadNumber: row.squadNumber == null ? null : Number(row.squadNumber),
    active: Boolean(row.active),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }));
}

function tokenSet(value: unknown) {
  return new Set(normalizePlayerText(value).split(" ").filter((token) => token.length > 1));
}

function aliasesOf(candidate: ApiFootballDirectoryPlayer) {
  return Array.from(new Set([
    normalizePlayerText(candidate.name),
    normalizePlayerText(`${candidate.firstName} ${candidate.lastName}`),
  ].filter(Boolean)));
}

function nameCompatibility(rawName: unknown, candidate: ApiFootballDirectoryPlayer) {
  const name = normalizePlayerText(rawName);
  if (!name) return 0;
  const aliases = aliasesOf(candidate);
  if (aliases.includes(name)) return 120;

  for (const alias of aliases) {
    const shorter = alias.length <= name.length ? alias : name;
    const longer = alias.length > name.length ? alias : name;
    if (shorter.split(" ").length >= 2 && longer.includes(shorter)) return 105;
  }

  const sourceTokens = tokenSet(name);
  const candidateTokens = tokenSet(candidate.name);
  const source = [...sourceTokens];
  const target = [...candidateTokens];
  if (!source.length || !target.length) return 0;
  const overlap = source.filter((token) => candidateTokens.has(token));
  const firstMatches = source[0] === target[0];
  const surnameOverlap = overlap.filter((token) => token !== source[0]).length;
  if (firstMatches && surnameOverlap >= 1) return 92 + Math.min(8, surnameOverlap * 4);
  if (surnameOverlap >= 2) return 82;
  return 0;
}

function teamCompatibility(rawTeam: unknown, candidateTeam: string) {
  const team = normalizePlayerText(rawTeam);
  const candidate = normalizePlayerText(candidateTeam);
  if (!team || !candidate) return 0;
  if (team === candidate) return 28;
  if (team.includes(candidate) || candidate.includes(team)) return 20;
  return 0;
}

export function resolveApiFootballPlayer(player: any, directory: ApiFootballDirectoryPlayer[]) {
  const rawNames = [player?.name, player?.webName, player?.web_name].filter(Boolean);
  const rawPosition = String(player?.position || "").toUpperCase();
  const scored = directory.map((candidate) => {
    const nameScore = Math.max(0, ...rawNames.map((name) => nameCompatibility(name, candidate)));
    const teamScore = teamCompatibility(player?.team, candidate.team);
    const positionScore = rawPosition && rawPosition === candidate.position ? 10 : 0;
    return { candidate, score: nameScore + teamScore + positionScore, nameScore, teamScore };
  }).filter((row) => row.nameScore >= 92 && (!rawPosition || rawPosition === row.candidate.position)).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.nameScore < 92) return null;
  const second = scored[1];
  if (second && best.nameScore < 120 && best.score - second.score < 12) return null;
  return best.candidate;
}

function numberOf(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function roundNumber(value: unknown, fallback: number) {
  const matches = String(value || "").match(/(\d+)(?!.*\d)/);
  return matches?.[1] ? Number(matches[1]) : fallback;
}

export async function getApiFootballPlayerProfileSnapshot(
  player: any,
  directory?: ApiFootballDirectoryPlayer[],
): Promise<VerifiedPlayerProfileSnapshot | null> {
  const sourceDirectory = directory || await loadApiFootballPlayerDirectory();
  const match = resolveApiFootballPlayer(player, sourceDirectory);
  if (!match) return null;

  const rows = rowsOf(await db.execute(sql`
    select s.api_fixture_id as "fixtureId", s.api_team_id as "apiTeamId",
           s.api_player_id as "apiPlayerId", s.position, s.minutes, s.rating,
           s.fantasy_score as "fantasyScore", s.statistics, s.raw,
           f.season, f.round, f.kickoff_at as "kickoffAt",
           f.home_team_id as "homeTeamId", f.away_team_id as "awayTeamId",
           f.home_score as "homeScore", f.away_score as "awayScore",
           coalesce(ht.name,'Home') as "homeTeamName", coalesce(at.name,'Away') as "awayTeamName"
    from app.api_football_player_match_stats s
    join app.api_football_fixtures f on f.api_fixture_id=s.api_fixture_id
    left join app.api_football_teams ht on ht.api_team_id=f.home_team_id
    left join app.api_football_teams at on at.api_team_id=f.away_team_id
    where s.api_player_id=${match.apiPlayerId}
      and f.league_id=39
    order by f.kickoff_at desc nulls last, s.api_fixture_id desc
    limit 40
  `));

  const latestStatsSeason = rows.length ? Math.max(...rows.map((row: any) => Number(row.season || 0))) : match.season;
  const seasonRows = rows.filter((row: any) => Number(row.season || latestStatsSeason) === latestStatsSeason).slice(0, 10);
  const chronological = [...seasonRows].reverse();

  let minutes = 0;
  let goals = 0;
  let assists = 0;
  let cleanSheets = 0;
  let yellowCards = 0;
  let redCards = 0;
  let saves = 0;
  let totalPoints = 0;
  const ratings: number[] = [];

  const last10 = chronological.map((row: any, index: number) => {
    const statistic = row.statistics || {};
    const games = statistic.games || {};
    const goalsData = statistic.goals || {};
    const cards = statistic.cards || {};
    const rowMinutes = numberOf(games.minutes ?? row.minutes);
    const rowGoals = numberOf(goalsData.total);
    const rowAssists = numberOf(goalsData.assists);
    const rowYellow = numberOf(cards.yellow);
    const rowRed = numberOf(cards.red);
    const rowSaves = numberOf(goalsData.saves);
    const rowPoints = numberOf(row.fantasyScore);
    const rating = Number(games.rating ?? row.rating);
    const wasHome = Number(row.homeTeamId) === Number(row.apiTeamId);
    const opponent = wasHome ? String(row.awayTeamName || "Away") : String(row.homeTeamName || "Home");
    const opponentScore = wasHome ? numberOf(row.awayScore) : numberOf(row.homeScore);
    const rowCleanSheet = rowMinutes > 0 && opponentScore === 0 ? 1 : 0;

    minutes += rowMinutes;
    goals += rowGoals;
    assists += rowAssists;
    cleanSheets += rowCleanSheet;
    yellowCards += rowYellow;
    redCards += rowRed;
    saves += rowSaves;
    totalPoints += rowPoints;
    if (Number.isFinite(rating) && rating > 0) ratings.push(rating);

    return {
      gameweek: roundNumber(row.round, index + 1),
      opponent,
      points: Math.round(rowPoints * 10_000) / 10_000,
      minutes: rowMinutes,
      goals: rowGoals,
      assists: rowAssists,
      cleanSheets: rowCleanSheet,
      yellowCards: rowYellow,
      redCards: rowRed,
      bonus: 0,
      rating: Number.isFinite(rating) && rating > 0 ? Math.round(rating * 10) / 10 : null,
      saves: rowSaves,
      kickoffTime: row.kickoffAt ? new Date(row.kickoffAt).toISOString() : null,
      wasHome,
    };
  });

  return {
    source: "api-football",
    season: latestStatsSeason || match.season,
    player: {
      name: match.name,
      team: match.team,
      position: match.position,
      imageUrl: match.photo,
      nationality: match.nationality || undefined,
      apiFootballId: match.apiPlayerId,
    },
    last10,
    stats: {
      matchesPlayed: chronological.filter((row: any) => numberOf(row.statistics?.games?.minutes ?? row.minutes) > 0).length,
      minutes,
      goals,
      assists,
      cleanSheets,
      yellowCards,
      redCards,
      bonus: 0,
      totalPoints: Math.round(totalPoints * 10_000) / 10_000,
      selectedBy: null,
      value: null,
      saves,
      averageRating: ratings.length ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10 : null,
    },
    providers: {
      identity: "API-Football current squads",
      stats: "API-Football fixture player statistics",
      fantasyPoints: "Fantasy Arena scoring",
    },
  };
}

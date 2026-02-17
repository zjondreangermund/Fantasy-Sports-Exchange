import { db } from "../db.js";
import { eplPlayers, eplFixtures, eplInjuries, eplStandings, eplSyncLog } from "../../shared/schema.js";
import { eq, sql, desc } from "drizzle-orm";

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";
const EPL_LEAGUE_ID = 39;
const CURRENT_SEASON = 2024;

const CACHE_TTL = {
  standings: 6 * 60 * 60 * 1000,
  fixtures: 4 * 60 * 60 * 1000,
  injuries: 6 * 60 * 60 * 1000,
  players: 12 * 60 * 60 * 1000,
};

async function apiRequest(endpoint: string, params: Record<string, string | number> = {}): Promise<any> {
  if (!API_KEY) {
    console.error("API_FOOTBALL_KEY not set");
    return null;
  }

  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": "v3.football.api-sports.io",
      },
    });

    if (!res.ok) {
      console.error(`API-Football error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error("API-Football errors:", data.errors);
      return null;
    }

    return data;
  } catch (err) {
    console.error("API-Football fetch error:", err);
    return null;
  }
}

async function getLastSync(endpoint: string): Promise<Date | null> {
  const [log] = await db.select().from(eplSyncLog)
    .where(eq(eplSyncLog.endpoint, endpoint))
    .orderBy(desc(eplSyncLog.syncedAt))
    .limit(1);
  return log?.syncedAt || null;
}

async function logSync(endpoint: string, count: number) {
 await db.insert(eplSyncLog).values({ endpoint, recordCount: count } as any);
}

function shouldSync(lastSync: Date | null, ttlMs: number): boolean {
  if (!lastSync) return true;
  return Date.now() - lastSync.getTime() > ttlMs;
}

export async function syncStandings(): Promise<boolean> {
  const lastSync = await getLastSync("standings");
  if (!shouldSync(lastSync, CACHE_TTL.standings)) return false;

  const data = await apiRequest("/standings", { league: EPL_LEAGUE_ID, season: CURRENT_SEASON });
  if (!data?.response?.[0]?.league?.standings?.[0]) return false;

  const standings = data.response[0].league.standings[0];

  for (const team of standings) {
    await db
      .insert(eplStandings)
      .values({
        teamId: team.team.id,
        teamName: team.team.name,
        teamLogo: team.team.logo,
        rank: team.rank,
        points: team.points,
        played: team.all.played,
        won: team.all.win,
        drawn: team.all.draw,
        lost: team.all.lose,
        goalsFor: team.all.goals.for,
        goalsAgainst: team.all.goals.against,
        goalDiff: team.goalsDiff,
        form: team.form,
        season: CURRENT_SEASON,
        lastUpdated: new Date(),
      } as any)
      .onConflictDoUpdate({
        target: eplStandings.teamId,
        set: {
          teamName: team.team.name,
          teamLogo: team.team.logo,
          rank: team.rank,
          points: team.points,
          played: team.all.played,
          won: team.all.win,
          drawn: team.all.draw,
          lost: team.all.lose,
          goalsFor: team.all.goals.for,
          goalsAgainst: team.all.goals.against,
          goalDiff: team.goalsDiff,
          form: team.form,
          lastUpdated: new Date(),
        } as any,
      });
  }

  await logSync("standings", standings.length);
  console.log(`Synced ${standings.length} EPL standings`);
  return true;
}

export async function syncFixtures(): Promise<boolean> {
  const lastSync = await getLastSync("fixtures");
  if (!shouldSync(lastSync, CACHE_TTL.fixtures)) return false;

  const data = await apiRequest("/fixtures", { league: EPL_LEAGUE_ID, season: CURRENT_SEASON });
  if (!data?.response) return false;

  const fixtures = data.response;
  let count = 0;

  for (const f of fixtures) {
    await db
      .insert(eplFixtures)
      .values({
        apiId: f.fixture.id,
        homeTeam: f.teams.home.name,
        homeTeamLogo: f.teams.home.logo,
        homeTeamId: f.teams.home.id,
        awayTeam: f.teams.away.name,
        awayTeamLogo: f.teams.away.logo,
        awayTeamId: f.teams.away.id,
        homeGoals: f.goals.home,
        awayGoals: f.goals.away,
        status: f.fixture.status.short,
        statusLong: f.fixture.status.long,
        elapsed: f.fixture.status.elapsed,
        venue: f.fixture.venue?.name,
        referee: f.fixture.referee,
        round: f.league.round,
        matchDate: new Date(f.fixture.date),
        season: CURRENT_SEASON,
        lastUpdated: new Date(),
      } as any)
      .onConflictDoUpdate({
        target: eplFixtures.apiId,
        set: {
          homeGoals: f.goals.home,
          awayGoals: f.goals.away,
          status: f.fixture.status.short,
          statusLong: f.fixture.status.long,
          elapsed: f.fixture.status.elapsed,
          referee: f.fixture.referee,
          lastUpdated: new Date(),
        } as any, // ✅ FIX: cast set to any
      });

    count++;
  }

  await logSync("fixtures", count);
  console.log(`Synced ${count} EPL fixtures`);
  return true;
}

export async function syncTopPlayers(page: number = 1): Promise<boolean> {
  const lastSync = await getLastSync(`players_page_${page}`);
  if (!shouldSync(lastSync, CACHE_TTL.players)) return false;

  const data = await apiRequest("/players", {
    league: EPL_LEAGUE_ID,
    season: CURRENT_SEASON,
    page,
  });
  if (!data?.response) return false;

  const players = data.response;
  let count = 0;
  for (const p of players) {
    const stats = p.statistics?.[0] || {};
    await db.insert(eplPlayers).values({
      apiId: p.player.id,
      name: p.player.name,
      firstname: p.player.firstname,
      lastname: p.player.lastname,
      age: p.player.age,
      nationality: p.player.nationality,
      photo: p.player.photo,
      team: stats.team?.name,
      teamLogo: stats.team?.logo,
      teamId: stats.team?.id,
      position: stats.games?.position,
      number: stats.games?.number,
      goals: stats.goals?.total || 0,
      assists: stats.goals?.assists || 0,
      yellowCards: stats.cards?.yellow || 0,
      redCards: stats.cards?.red || 0,
      appearances: stats.games?.appearences || 0,
      minutes: stats.games?.minutes || 0,
      rating: stats.games?.rating,
      injured: p.player.injured || false,
      season: CURRENT_SEASON,
      lastUpdated: new Date(),
    } as any).onConflictDoUpdate({
  target: eplPlayers.apiId,
  set: {
    name: p.player.name,
    team: stats.team?.name,
    teamLogo: stats.team?.logo,
    goals: stats.goals?.total || 0,
    assists: stats.goals?.assists || 0,
    yellowCards: stats.cards?.yellow || 0,
    redCards: stats.cards?.red || 0,
    appearances: stats.games?.appearences || 0,
    minutes: stats.games?.minutes || 0,
    rating: stats.games?.rating,
    injured: p.player.injured || false,
    lastUpdated: new Date(),
  } as any, // ✅ FIX
});

    count++;
  }

  await logSync(`players_page_${page}`, count);
  console.log(`Synced ${count} EPL players (page ${page})`);
  return true;
}

export async function syncInjuries(): Promise<boolean> {
  const lastSync = await getLastSync("injuries");
  if (!shouldSync(lastSync, CACHE_TTL.injuries)) return false;

  const data = await apiRequest("/injuries", { league: EPL_LEAGUE_ID, season: CURRENT_SEASON });
  if (!data?.response) return false;

  await db.delete(eplInjuries).where(eq(eplInjuries.season, CURRENT_SEASON));

  const injuries = data.response;
  let count = 0;
  for (const inj of injuries) {
    await db.insert(eplInjuries).values({
      playerApiId: inj.player.id,
      playerName: inj.player.name,
      playerPhoto: inj.player.photo,
      team: inj.team.name,
      teamLogo: inj.team.logo,
      type: inj.player.type,
      reason: inj.player.reason,
      fixtureApiId: inj.fixture?.id,
      fixtureDate: inj.fixture?.date ? new Date(inj.fixture.date) : null,
      season: CURRENT_SEASON,
      lastUpdated: new Date(),
    } as any);
    count++;
  }

  await logSync("injuries", count);
  console.log(`Synced ${count} EPL injuries`);
  return true;
}

export async function initialSync() {
  if (!API_KEY) {
    console.log("API_FOOTBALL_KEY not set, skipping EPL data sync");
    return;
  }

  console.log("Starting EPL data sync...");

  try {
    await syncStandings();
  } catch (e) {
    console.error("Failed to sync standings:", e);
  }

  try {
    await syncFixtures();
  } catch (e) {
    console.error("Failed to sync fixtures:", e);
  }

  try {
    await syncTopPlayers(1);
  } catch (e) {
    console.error("Failed to sync players page 1:", e);
  }

  try {
    await syncTopPlayers(2);
  } catch (e) {
    console.error("Failed to sync players page 2:", e);
  }

  try {
    await syncInjuries();
  } catch (e) {
    console.error("Failed to sync injuries:", e);
  }

  console.log("EPL data sync complete");
}

export async function getEplPlayers(page: number = 1, limit: number = 100, search?: string, position?: string) {
  const results = await db.select().from(eplPlayers)
    .where(
      search ? sql`LOWER(${eplPlayers.name}) LIKE ${'%' + search.toLowerCase() + '%'}` :
      position ? eq(eplPlayers.position, position) : undefined
    )
    .orderBy(desc(eplPlayers.goals))
    .limit(limit)
    .offset((page - 1) * limit);

  return results;
}

export async function getEplFixtures(filter?: string) {
  if (filter === "upcoming") {
    return db.select().from(eplFixtures)
      .where(sql`${eplFixtures.status} IN ('NS', 'TBD', 'PST')`)
      .orderBy(eplFixtures.matchDate)
      .limit(30);
  }
  if (filter === "live") {
    return db.select().from(eplFixtures)
      .where(sql`${eplFixtures.status} IN ('1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT')`)
      .orderBy(eplFixtures.matchDate);
  }
  if (filter === "finished") {
    return db.select().from(eplFixtures)
      .where(sql`${eplFixtures.status} IN ('FT', 'AET', 'PEN')`)
      .orderBy(desc(eplFixtures.matchDate))
      .limit(30);
  }
  return db.select().from(eplFixtures).orderBy(eplFixtures.matchDate);
}

export async function getEplInjuries() {
  return db.select().from(eplInjuries)
    .where(eq(eplInjuries.season, CURRENT_SEASON))
    .orderBy(eplInjuries.team);
}

export async function getEplStandings() {
  return db.select().from(eplStandings)
    .where(eq(eplStandings.season, CURRENT_SEASON))
    .orderBy(eplStandings.rank);
}

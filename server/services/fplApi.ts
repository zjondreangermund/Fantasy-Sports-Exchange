/**
 * FPL (Fantasy Premier League) API service
 * Replaces API-Football integration
 */

const FPL_BASE = "https://fantasy.premierleague.com/api";

const CACHE_TTL = {
  bootstrap: 12 * 60 * 60 * 1000, // 12 hours
  fixtures: 4 * 60 * 60 * 1000,   // 4 hours
};

type CacheEntry<T> = { ts: number; data: T };
const cache: Record<string, CacheEntry<any> | undefined> = {};

/**
 * Generic JSON fetch
 */
async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${FPL_BASE}${path}`, {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
  });

  if (!res.ok) {
    throw new Error(`FPL request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Cache helper
 */
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache[key];
  const now = Date.now();

  if (hit && now - hit.ts < ttl) {
    return hit.data as T;
  }

  const data = await fn();
  cache[key] = { ts: now, data };
  return data;
}

export const fplApi = {
  /**
   * Bootstrap data (players, teams, gameweeks)
   */
  async bootstrap() {
    return cached("bootstrap", CACHE_TTL.bootstrap, () =>
      fetchJson<any>("/bootstrap-static/")
    );
  },

  /**
   * Fixtures list
   */
  async fixtures() {
    return cached("fixtures", CACHE_TTL.fixtures, () =>
      fetchJson<any[]>("/fixtures/")
    );
  },

  /**
   * Player list
   */
  async getPlayers() {
    const b = await this.bootstrap();
    return b.elements;
  },

  /**
   * "Injuries" derived from player news/status
   */
  async getInjuries() {
    const players = await this.getPlayers();

    return players
      .filter(
        (p: any) =>
          (p.news && String(p.news).trim().length > 0) ||
          p.status !== "a" ||
          p.chance_of_playing_this_round !== null ||
          p.chance_of_playing_next_round !== null
      )
      .map((p: any) => ({
        playerId: p.id,
        name: `${p.first_name} ${p.second_name}`,
        team: p.team,
        status: p.status,
        news: p.news || "",
        chanceThisRound: p.chance_of_playing_this_round,
        chanceNextRound: p.chance_of_playing_next_round,
      }));
  },

  /**
   * Get current gameweek
   */
  async getCurrentGameweek() {
    const b = await this.bootstrap();
    const current = b.events?.find((e: any) => e.is_current);
    return current?.id || 1;
  },

  /**
   * Get live gameweek data with player stats
   * Cache for 1 minute during live games
   */
  async getLiveGameweek(eventId?: number) {
    const id = eventId || (await this.getCurrentGameweek());
    const cacheKey = `live_${id}`;
    
    // Short cache (1 minute) for live data
    return cached(cacheKey, 60 * 1000, () =>
      fetchJson<any>(`/event/${id}/live/`)
    );
  },

  /**
   * Get live games with detailed stats
   */
  async getLiveGames() {
    try {
      const [fixtures, liveData, bootstrap] = await Promise.all([
        this.fixtures(),
        this.getLiveGameweek(),
        this.bootstrap(),
      ]);

      // Find live fixtures (started but not finished)
      const liveFixtures = fixtures.filter((f: any) => f.started && !f.finished);

      const teams = bootstrap.teams || [];
      const teamMap = new Map(teams.map((t: any) => [t.id, t]));

      // Enhance fixtures with live player stats
      return liveFixtures.map((fixture: any) => {
        const homeTeam = teamMap.get(fixture.team_h) as any;
        const awayTeam = teamMap.get(fixture.team_a) as any;

        // Find players in this fixture
        const playerStats = liveData.elements
          ?.filter((el: any) => {
            const fixtureStats = el.explain?.find((ex: any) =>
              ex.fixtures?.some((f: any) => f.id === fixture.id)
            );
            return fixtureStats;
          })
          .map((el: any) => {
            const fixtureStats = el.explain?.find((ex: any) =>
              ex.fixtures?.some((f: any) => f.id === fixture.id)
            );
            return {
              id: el.id,
              stats: el.stats,
              fixtureStats: fixtureStats?.stats || [],
            };
          }) || [];

        return {
          id: fixture.id,
          kickoffTime: fixture.kickoff_time,
          started: fixture.started,
          finished: fixture.finished,
          minutes: fixture.minutes || 0,
          homeTeam: {
            id: fixture.team_h,
            name: homeTeam?.name || `Team ${fixture.team_h}`,
            shortName: homeTeam?.short_name || `T${fixture.team_h}`,
            score: fixture.team_h_score,
          },
          awayTeam: {
            id: fixture.team_a,
            name: awayTeam?.name || `Team ${fixture.team_a}`,
            shortName: awayTeam?.short_name || `T${fixture.team_a}`,
            score: fixture.team_a_score,
          },
          stats: fixture.stats || [],
          playerStats,
        };
      });
    } catch (error) {
      console.error("Error fetching live games:", error);
      return [];
    }
  },
};

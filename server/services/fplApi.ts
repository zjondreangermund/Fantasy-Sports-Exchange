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
};

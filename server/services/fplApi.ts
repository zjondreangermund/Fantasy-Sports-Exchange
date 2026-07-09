/**
 * FPL (Fantasy Premier League) API service
 * Replaces API-Football integration
 */

const FPL_BASE = "https://fantasy.premierleague.com/api";

const CACHE_TTL = {
  bootstrap: 12 * 60 * 60 * 1000,
  fixtures: 4 * 60 * 60 * 1000,
  fixturesLive: 60 * 1000,
  playerSummary: 15 * 60 * 1000,
};

type CacheEntry<T> = { ts: number; data: T };
const cache: Record<string, CacheEntry<any> | undefined> = {};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${FPL_BASE}${path}`, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`FPL request failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache[key];
  const now = Date.now();
  if (hit && now - hit.ts < ttl) return hit.data as T;
  const data = await fn();
  cache[key] = { ts: now, data };
  return data;
}

function normalizeStatusLabel(status: string, chanceThis?: number | null, chanceNext?: number | null) {
  const s = String(status || "").toLowerCase();
  if (s === "a" && chanceThis === null && chanceNext === null) return "Available";
  if (s === "d") return "Doubtful";
  if (s === "i") return "Injured";
  if (s === "s") return "Suspended";
  if (s === "u") return "Unavailable";
  if (chanceThis !== null && chanceThis !== undefined) return `${chanceThis}% chance`;
  if (chanceNext !== null && chanceNext !== undefined) return `${chanceNext}% next GW`;
  return s ? s.toUpperCase() : "Flagged";
}

export const fplApi = {
  playerPhotoUrl(player: any, size: 250 | 110 = 250) {
    const fromPhotoField = String(player?.photo || "").toLowerCase().replace(/\.jpg$/i, "").replace(/^p/i, "").replace(/[^0-9]/g, "");
    const fromCodeField = String(player?.code || "").replace(/[^0-9]/g, "");
    const id = fromPhotoField || fromCodeField;
    if (!id) return "/images/player-1.png";
    return `https://resources.premierleague.com/premierleague/photos/players/${size}x${size}/p${id}.png`;
  },

  async bootstrap() { return cached("bootstrap", CACHE_TTL.bootstrap, () => fetchJson<any>("/bootstrap-static/")); },
  async playerSummary(elementId: number) { const id = Number(elementId); if (!Number.isInteger(id) || id <= 0) throw new Error("Valid FPL element id required"); return cached(`player_summary_${id}`, CACHE_TTL.playerSummary, () => fetchJson<any>(`/element-summary/${id}/`)); },
  async fixtures() { return cached("fixtures", CACHE_TTL.fixtures, () => fetchJson<any[]>("/fixtures/")); },
  async fixturesLive() { return cached("fixtures_live", CACHE_TTL.fixturesLive, () => fetchJson<any[]>("/fixtures/")); },
  async getPlayers() { const b = await this.bootstrap(); return b.elements; },

  async getInjuries() {
    const bootstrap = await this.bootstrap();
    const players = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
    const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
    const teamById = new Map<number, any>(teams.map((team: any) => [Number(team.id), team]));
    return players
      .filter((p: any) => {
        const news = String(p.news || "").trim();
        const status = String(p.status || "a");
        return news.length > 0 || status !== "a" || p.chance_of_playing_this_round !== null || p.chance_of_playing_next_round !== null;
      })
      .map((p: any) => {
        const team = teamById.get(Number(p.team));
        const playerName = `${String(p.first_name || "").trim()} ${String(p.second_name || "").trim()}`.trim() || p.web_name || "Unknown Player";
        const chanceThis = p.chance_of_playing_this_round;
        const chanceNext = p.chance_of_playing_next_round;
        return {
          id: p.id,
          playerId: p.id,
          playerName,
          name: playerName,
          teamId: p.team,
          team: team?.name || team?.short_name || "Team",
          teamName: team?.name || team?.short_name || "Team",
          playerPhoto: this.playerPhotoUrl(p, 110),
          status: normalizeStatusLabel(p.status, chanceThis, chanceNext),
          rawStatus: p.status,
          reason: p.news || normalizeStatusLabel(p.status, chanceThis, chanceNext),
          expectedReturn: p.news || (chanceThis !== null && chanceThis !== undefined ? `${chanceThis}% chance this gameweek` : chanceNext !== null && chanceNext !== undefined ? `${chanceNext}% chance next gameweek` : "No return update"),
          chanceThisRound: chanceThis,
          chanceNextRound: chanceNext,
        };
      });
  },

  async getCurrentGameweek() { const b = await this.bootstrap(); const current = b.events?.find((e: any) => e.is_current); return current?.id || 1; },
  async getLiveGameweek(eventId?: number) { const id = eventId || (await this.getCurrentGameweek()); return cached(`live_${id}`, 60 * 1000, () => fetchJson<any>(`/event/${id}/live/`)); },

  async getLiveGames() {
    try {
      const [fixtures, liveData, bootstrap] = await Promise.all([this.fixturesLive(), this.getLiveGameweek(), this.bootstrap()]);
      const isLikelyFinished = (fixture: any) => { if (fixture?.finished) return true; const started = Boolean(fixture?.started); const minutes = Number(fixture?.minutes || 0); const kickoffTs = fixture?.kickoff_time ? new Date(String(fixture.kickoff_time)).getTime() : 0; const elapsedMs = kickoffTs > 0 ? Date.now() - kickoffTs : 0; if (!started) return false; return minutes >= 90 || elapsedMs >= 3 * 60 * 60 * 1000; };
      const extractStat = (fixture: any, keys: string[]) => { const stats = Array.isArray(fixture?.stats) ? fixture.stats : []; for (const item of stats) { const rawName = String(item?.identifier || item?.name || item?.stat || "").toLowerCase(); if (!keys.some((k) => rawName.includes(k))) continue; const homeRaw = item?.h?.[0]?.value ?? item?.h?.value ?? null; const awayRaw = item?.a?.[0]?.value ?? item?.a?.value ?? null; const parseVal = (value: any) => { if (value === null || value === undefined || value === "") return null; const n = typeof value === "string" ? Number(String(value).replace(/%/g, "").trim()) : Number(value); return Number.isFinite(n) ? n : null; }; return { home: parseVal(homeRaw), away: parseVal(awayRaw) }; } return { home: null, away: null }; };
      const liveFixtures = fixtures.filter((f: any) => f.started && !isLikelyFinished(f));
      const teamMap = new Map((bootstrap.teams || []).map((t: any) => [t.id, t]));
      return liveFixtures.map((fixture: any) => {
        const homeTeam = teamMap.get(fixture.team_h) as any;
        const awayTeam = teamMap.get(fixture.team_a) as any;
        const playerStats = liveData.elements?.filter((el: any) => el.explain?.find((ex: any) => ex.fixtures?.some((f: any) => f.id === fixture.id))).map((el: any) => ({ id: el.id, stats: el.stats, fixtureStats: el.explain?.find((ex: any) => ex.fixtures?.some((f: any) => f.id === fixture.id))?.stats || [] })) || [];
        return { id: fixture.id, kickoffTime: fixture.kickoff_time, started: fixture.started, finished: fixture.finished, minutes: fixture.minutes || 0, homeTeam: { id: fixture.team_h, name: homeTeam?.name || `Team ${fixture.team_h}`, shortName: homeTeam?.short_name || `T${fixture.team_h}`, score: fixture.team_h_score }, awayTeam: { id: fixture.team_a, name: awayTeam?.name || `Team ${fixture.team_a}`, shortName: awayTeam?.short_name || `T${fixture.team_a}`, score: fixture.team_a_score }, stats: fixture.stats || [], statsSummary: { assists: extractStat(fixture, ["assists"]), saves: extractStat(fixture, ["saves"]), cards: extractStat(fixture, ["yellow_cards", "red_cards", "cards"]), bonus: extractStat(fixture, ["bonus"]), bps: extractStat(fixture, ["bps"]) }, playerStats };
      });
    } catch (error) { console.error("Error fetching live games:", error); return []; }
  },

  async getUpcomingFixtures(gameweek?: number) {
    try {
      const [fixtures, bootstrap] = await Promise.all([this.fixtures(), this.bootstrap()]);
      const currentGameweek = gameweek || (await this.getCurrentGameweek());
      const teamMap = new Map((bootstrap.teams || []).map((t: any) => [t.id, t]));
      return fixtures.filter((f: any) => f.event === currentGameweek && !f.started).map((fixture: any) => { const homeTeam = teamMap.get(fixture.team_h) as any; const awayTeam = teamMap.get(fixture.team_a) as any; return { id: fixture.id, kickoffTime: fixture.kickoff_time, gameweek: fixture.event, homeTeam: { id: fixture.team_h, name: homeTeam?.name || `Team ${fixture.team_h}`, shortName: homeTeam?.short_name || `T${fixture.team_h}`, strength: homeTeam?.strength || 3 }, awayTeam: { id: fixture.team_a, name: awayTeam?.name || `T${fixture.team_a}`, strength: awayTeam?.strength || 3 }, difficulty: { home: fixture.team_h_difficulty, away: fixture.team_a_difficulty } }; }).sort((a: any, b: any) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());
    } catch (error) { console.error("Error fetching upcoming fixtures:", error); return []; }
  },
};

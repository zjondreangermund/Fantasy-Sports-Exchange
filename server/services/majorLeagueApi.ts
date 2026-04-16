const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

export type MajorLeagueKey = "premier-league" | "la-liga" | "bundesliga" | "serie-a" | "ligue-1";

export const MAJOR_LEAGUES: Record<MajorLeagueKey, { id: number; name: string; country: string }> = {
  "premier-league": { id: 39, name: "Premier League", country: "England" },
  "la-liga": { id: 140, name: "La Liga", country: "Spain" },
  "bundesliga": { id: 78, name: "Bundesliga", country: "Germany" },
  "serie-a": { id: 135, name: "Serie A", country: "Italy" },
  "ligue-1": { id: 61, name: "Ligue 1", country: "France" },
};

function currentSeasonYear() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function apiHeaders() {
  const apiKey = process.env.API_FOOTBALL_KEY || "";
  return {
    "x-apisports-key": apiKey,
    "x-rapidapi-host": "v3.football.api-sports.io",
  };
}

function ensureApiKey() {
  if (!process.env.API_FOOTBALL_KEY) {
    throw new Error("API_FOOTBALL_KEY is required for non-EPL leagues");
  }
}

async function fetchApi(path: string) {
  ensureApiKey();
  const response = await fetch(`${API_FOOTBALL_BASE}${path}`, { headers: apiHeaders() as any });
  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  return payload;
}

function normalizeStatus(raw: string) {
  const normalized = String(raw || "").toUpperCase();
  if (normalized.includes("LIVE")) return "LIVE";
  if (normalized === "FT") return "FT";
  if (normalized === "HT") return "HT";
  if (normalized === "NS") return "NS";
  return normalized || "NS";
}

export async function getMajorLeagueStandings(leagueKey: MajorLeagueKey) {
  const league = MAJOR_LEAGUES[leagueKey];
  const season = currentSeasonYear();
  const payload = await fetchApi(`/standings?league=${league.id}&season=${season}`);
  const rows = payload?.response?.[0]?.league?.standings?.[0] || [];
  return rows.map((row: any) => ({
    position: Number(row.rank || 0),
    rank: Number(row.rank || 0),
    teamId: Number(row.team?.id || 0),
    teamName: String(row.team?.name || "Unknown"),
    teamLogo: String(row.team?.logo || ""),
    logo: String(row.team?.logo || ""),
    played: Number(row.all?.played || 0),
    won: Number(row.all?.win || 0),
    drawn: Number(row.all?.draw || 0),
    lost: Number(row.all?.lose || 0),
    goalsFor: Number(row.all?.goals?.for || 0),
    goalsAgainst: Number(row.all?.goals?.against || 0),
    goalDifference: Number(row.goalsDiff || 0),
    goalDiff: Number(row.goalsDiff || 0),
    points: Number(row.points || 0),
    form: String(row.form || ""),
  }));
}

export async function getMajorLeagueFixtures(leagueKey: MajorLeagueKey, status?: string) {
  const league = MAJOR_LEAGUES[leagueKey];
  const season = currentSeasonYear();
  const statusFilter = String(status || "").toLowerCase();
  const payload = await fetchApi(`/fixtures?league=${league.id}&season=${season}&next=40`);
  let rows = Array.isArray(payload?.response) ? payload.response : [];

  if (statusFilter === "upcoming") {
    rows = rows.filter((row: any) => String(row?.fixture?.status?.short || "") === "NS");
  } else if (statusFilter === "live") {
    rows = rows.filter((row: any) => String(row?.fixture?.status?.short || "").includes("1H") || String(row?.fixture?.status?.short || "").includes("2H") || String(row?.fixture?.status?.short || "").includes("LIVE"));
  } else if (statusFilter === "finished") {
    rows = rows.filter((row: any) => String(row?.fixture?.status?.short || "") === "FT");
  }

  return rows.map((item: any) => ({
    id: Number(item?.fixture?.id || 0),
    matchId: Number(item?.fixture?.id || 0),
    date: item?.fixture?.date,
    kickoffTime: item?.fixture?.date,
    status: normalizeStatus(item?.fixture?.status?.short),
    homeTeam: {
      id: Number(item?.teams?.home?.id || 0),
      name: String(item?.teams?.home?.name || "Unknown"),
      logo: String(item?.teams?.home?.logo || ""),
      score: Number(item?.goals?.home ?? 0),
    },
    awayTeam: {
      id: Number(item?.teams?.away?.id || 0),
      name: String(item?.teams?.away?.name || "Unknown"),
      logo: String(item?.teams?.away?.logo || ""),
      score: Number(item?.goals?.away ?? 0),
    },
    venue: item?.fixture?.venue?.name || "",
  }));
}

export async function getMajorLeagueLiveGames(leagueKey: MajorLeagueKey) {
  const league = MAJOR_LEAGUES[leagueKey];
  const payload = await fetchApi(`/fixtures?live=${league.id}`);
  const rows = Array.isArray(payload?.response) ? payload.response : [];

  return rows.map((item: any) => ({
    id: Number(item?.fixture?.id || 0),
    kickoffTime: item?.fixture?.date,
    started: true,
    finished: false,
    minutes: Number(item?.fixture?.status?.elapsed || 0),
    homeTeam: {
      id: Number(item?.teams?.home?.id || 0),
      name: String(item?.teams?.home?.name || "Unknown"),
      shortName: String(item?.teams?.home?.name || "HOME"),
      score: Number(item?.goals?.home ?? 0),
    },
    awayTeam: {
      id: Number(item?.teams?.away?.id || 0),
      name: String(item?.teams?.away?.name || "Unknown"),
      shortName: String(item?.teams?.away?.name || "AWAY"),
      score: Number(item?.goals?.away ?? 0),
    },
    stats: [],
    playerStats: [],
    statsSummary: {
      assists: { home: null, away: null },
      saves: { home: null, away: null },
      cards: { home: null, away: null },
      bonus: { home: null, away: null },
      bps: { home: null, away: null },
    },
  }));
}

export async function getMajorLeaguePlayers(leagueKey: MajorLeagueKey, options: { page?: number; limit?: number; search?: string; position?: string } = {}) {
  const league = MAJOR_LEAGUES[leagueKey];
  const season = currentSeasonYear();
  const page = Math.max(1, Number(options.page || 1));
  const payload = await fetchApi(`/players?league=${league.id}&season=${season}&page=${page}`);
  const rows = Array.isArray(payload?.response) ? payload.response : [];
  const search = String(options.search || "").toLowerCase();
  const position = String(options.position || "").toUpperCase();
  let normalized = rows.map((row: any) => ({
    id: Number(row?.player?.id || 0),
    playerId: Number(row?.player?.id || 0),
    name: String(row?.player?.name || "Unknown"),
    firstName: String(row?.player?.firstname || ""),
    lastName: String(row?.player?.lastname || ""),
    age: Number(row?.player?.age || 0),
    nationality: String(row?.player?.nationality || ""),
    team: String(row?.statistics?.[0]?.team?.name || "Unknown"),
    position: String(row?.statistics?.[0]?.games?.position || "MID").replace("Attacker", "FWD").replace("Defender", "DEF").replace("Goalkeeper", "GK").replace("Midfielder", "MID"),
    photo: String(row?.player?.photo || ""),
    imageUrl: String(row?.player?.photo || ""),
    rating: Number(row?.statistics?.[0]?.games?.rating || 0),
    appearances: Number(row?.statistics?.[0]?.games?.appearences || 0),
    goals: Number(row?.statistics?.[0]?.goals?.total || 0),
    assists: Number(row?.statistics?.[0]?.goals?.assists || 0),
    cleanSheets: Number(row?.statistics?.[0]?.goals?.conceded === 0 ? 1 : 0),
    minutes: Number(row?.statistics?.[0]?.games?.minutes || 0),
    league: league.name,
  }));
  if (search) normalized = normalized.filter((player: any) => String(player.name || "").toLowerCase().includes(search));
  if (position) normalized = normalized.filter((player: any) => String(player.position || "").toUpperCase().includes(position));
  const limit = Math.max(1, Math.min(100, Number(options.limit || 20)));
  return normalized.slice(0, limit);
}

export async function getMajorLeagueInjuries(leagueKey: MajorLeagueKey) {
  const league = MAJOR_LEAGUES[leagueKey];
  const season = currentSeasonYear();
  try {
    const payload = await fetchApi(`/injuries?league=${league.id}&season=${season}`);
    const rows = Array.isArray(payload?.response) ? payload.response : [];
    return rows.slice(0, 80).map((row: any, index: number) => ({
      id: index + 1,
      playerId: Number(row?.player?.id || 0),
      playerName: String(row?.player?.name || "Unknown"),
      playerPhoto: String(row?.player?.photo || ""),
      status: String(row?.player?.type || "unknown"),
      expectedReturn: String(row?.player?.reason || "TBD"),
      team: String(row?.team?.name || "Unknown"),
      league: league.name,
    }));
  } catch {
    return [];
  }
}

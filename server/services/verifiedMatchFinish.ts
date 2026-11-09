/**
 * Conservative confirmation fallback when the FPL fixture API's `finished`
 * flag lags behind API-Football. Requires the same home and away clubs, round,
 * nearby kickoff AND an API-Football FT/AET/PEN status. Never guesses from time.
 */
import { sql } from "drizzle-orm";
import { db } from "../db.js";

const rowsOf = (r: any): any[] => Array.isArray(r?.rows) ? r.rows : [];
function teamKey(raw: unknown) {
  let name = String(raw || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]/g,"");
  name = name.replace(/^(afc)/,"").replace(/(footballclub|afc|fc)$/,"");
  const aliases: Record<string,string> = {
    mancity:"manchestercity", manunited:"manchesterunited", manchesterutd:"manchesterunited",
    nottmforest:"nottinghamforest", nottsforest:"nottinghamforest", brightonandhovealbion:"brighton",
    brightonhovealbion:"brighton", brighton:"brighton", tottenhamhotspur:"tottenham",
    spurs:"tottenham", wolves:"wolverhamptonwanderers", bournemouth:"bournemouth",
    nufc:"newcastleunited", newcastle:"newcastleunited", leeds:"leedsunited",
    coventry:"coventrycity", hull:"hullcity", ipswich:"ipswichtown",
    westham:"westhamunited", westhamutd:"westhamunited", leicester:"leicestercity",
    villa:"astonvilla", palace:"crystalpalace",
  };
  return aliases[name] || name;
}

export function matchVerifiedFinalFixtures(fixtures: any[], bootstrap: any, apiMatches: any[]): Set<number> {
  const fplTeams = new Map<number,string>();
  for (const team of Array.isArray(bootstrap?.teams) ? bootstrap.teams : []) {
    fplTeams.set(Number(team?.id), teamKey(team?.name));
  }
  const finalIds = new Set<number>();
  for (const fixture of Array.isArray(fixtures) ? fixtures : []) {
    const home = fplTeams.get(Number(fixture?.team_h));
    const away = fplTeams.get(Number(fixture?.team_a));
    const kickoff = Date.parse(String(fixture?.kickoff_time || ""));
    if (!home || !away || !Number.isFinite(kickoff)) continue;
    const matched = apiMatches.some(row => {
      if (!["FT","AET","PEN"].includes(String(row?.statusShort || "").toUpperCase())) return false;
      const providerTime = Date.parse(String(row?.kickoffAt || ""));
      return Number.isFinite(providerTime) && Math.abs(providerTime-kickoff) <= 36*60*60*1000
        && teamKey(row?.homeTeamName) === home && teamKey(row?.awayTeamName) === away;
    });
    if (matched) finalIds.add(Number(fixture.id));
  }
  return finalIds;
}

export async function loadVerifiedFinalFixtureIds(gameweek: number, fixtures: any[], bootstrap: any): Promise<Set<number>> {
  try {
    const roundPattern = `(^|[^0-9])${Number(gameweek)}$`;
    const season = Number(String((Array.isArray(bootstrap?.events) ? bootstrap.events : [])
      .find((e: any) => Number(e?.id) === Number(gameweek))?.deadline_time || "").slice(0,4)) || new Date().getUTCFullYear();
    const records = rowsOf(await db.execute(sql`
      select f.kickoff_at as "kickoffAt", coalesce(f.status_short,'NS') as "statusShort",
             h.name as "homeTeamName", a.name as "awayTeamName"
      from app.api_football_fixtures f
      join app.api_football_teams h on h.api_team_id=f.home_team_id
      join app.api_football_teams a on a.api_team_id=f.away_team_id
      where f.league_id=39 and f.season=${season}
        and coalesce(f.round,'') ~ ${roundPattern}
        and f.status_short in ('FT','AET','PEN')
    `));
    return matchVerifiedFinalFixtures(fixtures,bootstrap,records);
  } catch (error) {
    console.warn("[gw-final-whistle] API-Football final-match verification unavailable; retaining FPL-only safety guard:", error);
    return new Set<number>();
  }
}

/**
 * Settlement FT verification is deliberately separate from player scoring.
 * Accept an FPL finished fixture, or an API-Football FT result that matches
 * BOTH clubs, season, league and kickoff. Never infer FT from the clock.
 *
 * The provider's "round" label is display metadata, not a reliable join key:
 * some fixtures are stored as "Regular Season - 10", others as "Gameweek 10",
 * or retain their original round after schedule amendments.
 */
import { sql } from "drizzle-orm";
import { db } from "../db.js";

const rowsOf = (r: any): any[] => Array.isArray(r?.rows) ? r.rows : [];
const FT = new Set(["FT", "AET", "PEN"]);
const HOUR = 60 * 60 * 1000;

function teamKey(raw: unknown) {
  let name = String(raw || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g,"");
  name = name.replace(/^(afc)/,"").replace(/(footballclub|afc|fc)$/,"");
  const aliases: Record<string,string> = {
    mancity:"manchestercity", manunited:"manchesterunited",
    manutd:"manchesterunited", manchesterutd:"manchesterunited",
    manutdfc:"manchesterunited", nottmforest:"nottinghamforest",
    nottsforest:"nottinghamforest", forest:"nottinghamforest",
    brightonandhovealbion:"brighton", brightonhovealbion:"brighton",
    spurs:"tottenham", tottenhamhotspur:"tottenham",
    wolves:"wolverhamptonwanderers", bournemouth:"bournemouth",
    nufc:"newcastleunited", newcastle:"newcastleunited", leeds:"leedsunited",
    coventry:"coventrycity", hull:"hullcity", ipswich:"ipswichtown",
    westham:"westhamunited", westhamutd:"westhamunited", leicester:"leicestercity",
    villa:"astonvilla", palace:"crystalpalace",
  };
  return aliases[name] || name;
}

export type ProviderFixtureEvidence = {
  fplFixtureId: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | null;
  fplFinished: boolean;
  apiFootballMatched: boolean;
  apiFootballFinal: boolean;
  apiFootballFixtureId: number | null;
  apiFootballStatus: string | null;
  apiFootballRound: string | null;
  apiFootballHomeScore: number | null;
  apiFootballAwayScore: number | null;
  apiFootballUpdatedAt: string | null;
  apiFootballStatsReady: boolean;
  failureReason: "none" | "fpl-already-final" | "no-provider-fixture" | "provider-not-final";
};

function fplTeamsOf(bootstrap: any) {
  return new Map<number,string>((Array.isArray(bootstrap?.teams) ? bootstrap.teams : [])
    .map((t: any) => [Number(t?.id), String(t?.name || "")]));
}
function matchesFixture(fixture: any, names: Map<number,string>, row: any) {
  const kickoff = Date.parse(String(fixture?.kickoff_time || ""));
  const providerTime = Date.parse(String(row?.kickoffAt || ""));
  return Number.isFinite(kickoff) && Number.isFinite(providerTime)
    && Math.abs(providerTime - kickoff) <= 36 * HOUR
    && Boolean(teamKey(names.get(Number(fixture?.team_h))))
    && teamKey(names.get(Number(fixture?.team_h))) === teamKey(row?.homeTeamName)
    && teamKey(names.get(Number(fixture?.team_a))) === teamKey(row?.awayTeamName);
}
function matchingProviderRow(fixture: any, names: Map<number,string>, rows: any[]) {
  const matches = rows.filter(row => matchesFixture(fixture,names,row));
  // Deterministic: exact timestamp first; then newest verified final status.
  return matches.sort((a,b) => {
    const kickoff = Date.parse(String(fixture?.kickoff_time || ""));
    const aDiff = Math.abs(Date.parse(String(a.kickoffAt)) - kickoff);
    const bDiff = Math.abs(Date.parse(String(b.kickoffAt)) - kickoff);
    return aDiff - bDiff || Number(FT.has(String(b.statusShort || "").toUpperCase())) -
      Number(FT.has(String(a.statusShort || "").toUpperCase()));
  })[0] || null;
}

export function matchVerifiedFinalFixtures(fixtures: any[], bootstrap: any, apiMatches: any[]): Set<number> {
  const teams = fplTeamsOf(bootstrap);
  const finalIds = new Set<number>();
  for(const fixture of Array.isArray(fixtures) ? fixtures : []) {
    const matched = matchingProviderRow(fixture,teams,apiMatches || []);
    if(matched && FT.has(String(matched.statusShort || "").toUpperCase()))
      finalIds.add(Number(fixture?.id || 0));
  }
  return finalIds;
}

export function describeFinalFixtureEvidence(fixtures: any[], bootstrap: any, rows: any[]): {
  finalFixtureIds: Set<number>;
  fixtures: ProviderFixtureEvidence[];
} {
  const teams = fplTeamsOf(bootstrap);
  const finalFixtureIds = new Set<number>();
  const evidence = (Array.isArray(fixtures) ? fixtures : []).map(fixture => {
    const matched = matchingProviderRow(fixture,teams,rows || []);
    const fplFinished = fixture?.finished === true;
    const providerFinal = Boolean(matched && FT.has(String(matched.statusShort || "").toUpperCase()));
    if(providerFinal) finalFixtureIds.add(Number(fixture?.id || 0));
    return {
      fplFixtureId: Number(fixture?.id || 0),
      homeTeam: teams.get(Number(fixture?.team_h)) || "Unknown home team",
      awayTeam: teams.get(Number(fixture?.team_a)) || "Unknown away team",
      kickoffTime: fixture?.kickoff_time || null,
      fplFinished, apiFootballMatched: Boolean(matched), apiFootballFinal: providerFinal,
      apiFootballFixtureId: matched ? Number(matched?.fixtureId || 0) || null : null,
      apiFootballStatus: matched ? String(matched?.statusShort || "NS") : null,
      apiFootballRound: matched?.round ? String(matched.round) : null,
      apiFootballHomeScore: matched?.homeScore == null ? null : Number(matched.homeScore),
      apiFootballAwayScore: matched?.awayScore == null ? null : Number(matched.awayScore),
      apiFootballUpdatedAt: matched?.updatedAt ? new Date(matched.updatedAt).toISOString() : null,
      apiFootballStatsReady: Boolean(matched?.statsSyncedAt),
      failureReason: fplFinished ? "fpl-already-final" as const :
        !matched ? "no-provider-fixture" as const : !providerFinal ? "provider-not-final" as const : "none" as const,
    };
  });
  return { finalFixtureIds, fixtures: evidence };
}

export async function loadVerifiedFinalFixtureEvidence(gameweek: number, fixtures: any[], bootstrap: any) {
  const target = (Array.isArray(fixtures) ? fixtures : []).filter(f => Number(f?.event) === Number(gameweek));
  const deadline = Date.parse(String((Array.isArray(bootstrap?.events) ? bootstrap.events : [])
    .find((e: any) => Number(e?.id) === Number(gameweek))?.deadline_time || ""));
  const eventDate = Number.isFinite(deadline) ? new Date(deadline) : new Date();
  const season = eventDate.getUTCFullYear() - (eventDate.getUTCMonth() < 6 ? 1 : 0);
  const kickoffs = target.map(f => Date.parse(String(f?.kickoff_time || ""))).filter(Number.isFinite);
  if(!kickoffs.length) return describeFinalFixtureEvidence(target,bootstrap,[]);
  const rangeStart = new Date(Math.min(...kickoffs) - 36*HOUR);
  const rangeEnd = new Date(Math.max(...kickoffs) + 36*HOUR);
  try {
    const rows = rowsOf(await db.execute(sql`
      select f.api_fixture_id as "fixtureId", f.kickoff_at as "kickoffAt",
             coalesce(f.status_short,'NS') as "statusShort", f.round as "round",
             f.home_score as "homeScore", f.away_score as "awayScore",
             f.updated_at as "updatedAt", f.stats_synced_at as "statsSyncedAt",
             h.name as "homeTeamName", a.name as "awayTeamName"
      from app.api_football_fixtures f
      left join app.api_football_teams h on h.api_team_id=f.home_team_id
      left join app.api_football_teams a on a.api_team_id=f.away_team_id
      where f.league_id=39 and f.season=${season}
        and f.kickoff_at between ${rangeStart} and ${rangeEnd}
      order by f.kickoff_at asc
    `));
    // NOTE: fixture identity is decided by both club names + kickoff, not
    // by the round label. This also supports dated/renamed provider rounds.
    return describeFinalFixtureEvidence(target,bootstrap,rows);
  } catch (error) {
    console.warn("[gw-final-whistle] API-Football fixture evidence lookup failed; do not override live status:", error);
    return describeFinalFixtureEvidence(target,bootstrap,[]);
  }
}

export async function loadVerifiedFinalFixtureIds(gameweek: number, fixtures: any[], bootstrap: any): Promise<Set<number>> {
  return (await loadVerifiedFinalFixtureEvidence(gameweek,fixtures,bootstrap)).finalFixtureIds;
}

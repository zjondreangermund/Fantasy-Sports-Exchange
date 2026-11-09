/**
 * Public, read-only original-gameweek fixture eligibility for lineup guidance.
 * Never label a fixture postponed based only on a stale "finished" flag:
 * postpone means the actual kickoff was moved OUTSIDE that GW's time window.
 */
import { gameweekFixtureWindow } from "./gameweekSettlementReady.js";

export function clubMatchKey(name: unknown): string {
  const raw = String(name || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/&/g,"and").replace(/[^a-z0-9]/g,"")
    .replace(/^(afc)/,"").replace(/(footballclub|afc|fc)$/,"");
  const aliases: Record<string,string> = {
    mancity:"manchestercity",manunited:"manchesterunited",manutd:"manchesterunited",
    manchesterutd:"manchesterunited",nottmforest:"nottinghamforest",
    nottsforest:"nottinghamforest",forest:"nottinghamforest",ipswich:"ipswichtown",
    bournemouth:"bournemouth",spurs:"tottenhamhotspur",tottenham:"tottenhamhotspur",
    brighton:"brightonandhovealbion",brightonhovealbion:"brightonandhovealbion",
    newcastle:"newcastleunited",leeds:"leedsunited",coventry:"coventrycity",
    westham:"westhamunited",villa:"astonvilla",palace:"crystalpalace",
    wolves:"wolverhamptonwanderers",sunderland:"sunderland",
    hull:"hullcity",
  };
  return aliases[raw] || raw;
}

type FixtureStatus = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | null;
  fplFinished: boolean;
  started: boolean;
  excluded: boolean;
  reason: "in-week" | "moved-outside-gameweek" | "unassigned-after-week" | "awaiting-date";
};
type ClubStatus = {
  teamId: number;
  team: string;
  teamKey: string;
  eligibleFixtures: number;
  movedFixtures: number;
  noEligibleFixture: boolean;
  postponedOutsideGameweek: boolean;
  affectedFixtures: FixtureStatus[];
};

export function buildGameweekFixtureStatus(fixtures: any[], bootstrap: any, gw: number, now = Date.now()) {
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const events = Array.isArray(bootstrap?.events) ? bootstrap.events : [];
  const event = events.find((item: any) => Number(item?.id) === gw);
  const window = gameweekFixtureWindow(fixtures, gw, event?.deadline_time);
  if (!window) return { gameWeek: gw, available: false, clubs: [] as ClubStatus[], fixtures: [] as FixtureStatus[], windowEnd: null };
  const names = new Map<number,string>(teams.map((team: any) => [Number(team.id), String(team.name || "")]));
  const actualFixtures = (Array.isArray(fixtures) ? fixtures : []).filter(f => Number(f?.event) === gw);
  const classified: FixtureStatus[] = actualFixtures.map(f => {
    const kickoff = Date.parse(String(f?.kickoff_time || ""));
    const missingDate = !Number.isFinite(kickoff);
    const excluded = (missingDate && now >= window.end) || (!missingDate && kickoff >= window.end);
    return {
      id: Number(f?.id || 0), homeTeam: names.get(Number(f?.team_h)) || "Unknown home club",
      awayTeam: names.get(Number(f?.team_a)) || "Unknown away club",
      kickoffTime: f?.kickoff_time || null,
      fplFinished: f?.finished === true, started: f?.started === true,
      excluded,
      reason: missingDate ? (excluded ? "unassigned-after-week" as const : "awaiting-date" as const)
        : excluded ? "moved-outside-gameweek" as const : "in-week" as const,
    };
  });
  const clubs: ClubStatus[] = teams.map((team: any) => {
    const teamId = Number(team?.id || 0);
    const own = actualFixtures.map((f, index) =>
      Number(f?.team_h) === teamId || Number(f?.team_a) === teamId ? classified[index] : null
    ).filter((f): f is FixtureStatus => Boolean(f));
    const moved = own.filter(f => f.excluded);
    const eligible = own.filter(f => !f.excluded);
    return {
      teamId, team: String(team?.name || ""), teamKey: clubMatchKey(team?.name),
      eligibleFixtures: eligible.length, movedFixtures: moved.length,
      noEligibleFixture: eligible.length === 0,
      postponedOutsideGameweek: moved.length > 0 && eligible.length === 0,
      affectedFixtures: moved,
    };
  });
  return { gameWeek: gw, available: true, windowEnd: new Date(window.end).toISOString(), clubs, fixtures: classified };
}

import { useQuery } from "@tanstack/react-query";

export type PostponedFixtureNotice = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | null;
  excluded: boolean;
  reason: "in-week" | "moved-outside-gameweek" | "unassigned-after-week" | "awaiting-date";
};
export type GameweekClubStatus = {
  teamId: number;
  team: string;
  teamKey: string;
  eligibleFixtures: number;
  movedFixtures: number;
  noEligibleFixture: boolean;
  postponedOutsideGameweek: boolean;
  affectedFixtures: PostponedFixtureNotice[];
};
export type GameweekFixtureStatus = {
  gameWeek: number;
  available: boolean;
  clubs: GameweekClubStatus[];
  fixtures: PostponedFixtureNotice[];
  windowEnd: string | null;
};

const aliases: Record<string,string> = {
  mancity:"manchestercity",manunited:"manchesterunited",manutd:"manchesterunited",
  manchesterutd:"manchesterunited",nottmforest:"nottinghamforest",
  nottsforest:"nottinghamforest",forest:"nottinghamforest",ipswich:"ipswichtown",
  bournemouth:"bournemouth",spurs:"tottenhamhotspur",tottenham:"tottenhamhotspur",
  brighton:"brightonandhovealbion",brightonhovealbion:"brightonandhovealbion",
  newcastle:"newcastleunited",leeds:"leedsunited",coventry:"coventrycity",
  westham:"westhamunited",villa:"astonvilla",palace:"crystalpalace",
  wolves:"wolverhamptonwanderers",sunderland:"sunderland",hull:"hullcity",
};
export function clubMatchKey(name: unknown) {
  const raw = String(name || "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]/g,"")
    .replace(/^(afc)/,"").replace(/(footballclub|afc|fc)$/,"");
  return aliases[raw] || raw;
}
export function findClubNotice(status: GameweekFixtureStatus | undefined, player: any): GameweekClubStatus | null {
  if (!status?.available) return null;
  const src = player?.player || player;
  const id = Number(src?.fplTeamId || src?.fpl_team_id || 0);
  if (id) {
    const byId = status.clubs.find(c => c.teamId === id);
    if (byId) return byId;
  }
  const key = clubMatchKey(src?.team);
  return key ? status.clubs.find(c => c.teamKey === key) || null : null;
}
export function postponementWarning(club: GameweekClubStatus | null, gameWeek: number) {
  if (!club?.movedFixtures) return null;
  const fixture = club.affectedFixtures[0];
  const opponent = fixture ? fixture.homeTeam === club.team ? fixture.awayTeam : fixture.homeTeam : null;
  const where = opponent ? ` vs ${opponent}` : "";
  const date = fixture?.kickoffTime
    ? new Date(fixture.kickoffTime).toLocaleString("en-NA", {
      timeZone:"Africa/Windhoek", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"
    })
    : "date not yet confirmed";
  return club.postponedOutsideGameweek
    ? `Postponed/outside GW${gameWeek}: ${club.team}${where}. This player cannot score for GW${gameWeek}. New match date: ${date} (Namibia time).`
    : `One ${club.team} match${where} moved outside GW${gameWeek} (${date}). Only their remaining in-week fixture can count.`;
}
export function useGameweekFixtureNotices(gameWeek: number, enabled = true) {
  return useQuery<GameweekFixtureStatus>({
    queryKey:["/api/epl/gameweek-status",gameWeek],
    queryFn:async()=>{
      const res = await fetch(`/api/epl/gameweek-status/${gameWeek}`,{credentials:"include"});
      if(!res.ok) throw new Error("Fixture status temporarily unavailable");
      return res.json();
    },
    enabled:enabled && Number.isInteger(gameWeek) && gameWeek >=1 && gameWeek <=38,
    staleTime: 120_000, refetchInterval: false, refetchOnWindowFocus:true,
    retry:1,
  });
}

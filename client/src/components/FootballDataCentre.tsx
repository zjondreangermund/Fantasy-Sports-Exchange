import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Building2,
  CalendarDays,
  Clock,
  MapPin,
  Search,
  Shield,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

// API_FOOTBALL_DATA_CENTRE_V2_FULL_INTELLIGENCE
type LeagueKey =
  | "premier-league"
  | "la-liga"
  | "bundesliga"
  | "serie-a"
  | "ligue-1"
  | "champions-league"
  | "europa-league"
  | "conference-league"
  | "fa-cup"
  | "efl-cup"
  | "world-cup";

const COMPETITIONS: Array<{ key: LeagueKey; name: string; group: string }> = [
  { key: "premier-league", name: "Premier League", group: "Leagues" },
  { key: "la-liga", name: "La Liga", group: "Leagues" },
  { key: "bundesliga", name: "Bundesliga", group: "Leagues" },
  { key: "serie-a", name: "Serie A", group: "Leagues" },
  { key: "ligue-1", name: "Ligue 1", group: "Leagues" },
  { key: "champions-league", name: "Champions League", group: "Europe" },
  { key: "europa-league", name: "Europa League", group: "Europe" },
  { key: "conference-league", name: "Conference League", group: "Europe" },
  { key: "fa-cup", name: "FA Cup", group: "Cups" },
  { key: "efl-cup", name: "EFL Cup", group: "Cups" },
  { key: "world-cup", name: "World Cup", group: "International" },
];

async function getJson(url: string) {
  const response = await fetch(url, { credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Football data request failed");
  return payload;
}

function formatDate(value: any) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function asNumber(value: any) {
  const number = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(number) ? number : 0;
}

function playerName(row: any) {
  return String(row?.player?.name || row?.name || "Unknown player");
}

function playerPhoto(row: any) {
  return String(row?.player?.photo || row?.photo || "");
}

function statValue(block: any, type: string) {
  const list = Array.isArray(block?.statistics) ? block.statistics : [];
  const found = list.find((item: any) => String(item?.type || "").toLowerCase() === type.toLowerCase());
  return found?.value ?? null;
}

function formatEventMinute(event: any) {
  const elapsed = Number(event?.time?.elapsed || 0);
  const extra = Number(event?.time?.extra || 0);
  return extra > 0 ? `${elapsed}+${extra}'` : `${elapsed}'`;
}

function TinyPlayer({ row, onClick, suffix }: { row: any; onClick?: () => void; suffix?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:bg-white/5 disabled:cursor-default">
      {playerPhoto(row) ? <img src={playerPhoto(row)} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><UserRound className="h-5 w-5" /></div>}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{playerName(row)}</div>
        <div className="truncate text-xs text-muted-foreground">{row?.statistics?.[0]?.team?.name || row?.team?.name || row?.teamName || ""}</div>
      </div>
      {suffix ? <Badge variant="outline">{suffix}</Badge> : null}
    </button>
  );
}

function CoverageStrip({ data }: { data: any }) {
  const fixture = data?.coverage?.fixtures || {};
  const flags = [
    ["Events", fixture.events],
    ["Lineups", fixture.lineups],
    ["Match stats", fixture.statistics_fixtures],
    ["Player stats", fixture.statistics_players],
    ["Injuries", data?.coverage?.injuries],
    ["Predictions", data?.coverage?.predictions],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {flags.map(([label, enabled]) => (
        <Badge key={String(label)} variant="outline" className={enabled === false ? "opacity-40" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}>
          {String(label)} {enabled === false ? "unavailable" : "available"}
        </Badge>
      ))}
    </div>
  );
}

export default function FootballDataCentre() {
  const [leagueKey, setLeagueKey] = useState<LeagueKey>("premier-league");
  const [fixtureStatus, setFixtureStatus] = useState<"upcoming" | "live" | "finished">("upcoming");
  const [selectedRound, setSelectedRound] = useState("");
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");

  const selectedCompetition = COMPETITIONS.find((item) => item.key === leagueKey) || COMPETITIONS[0];

  const coverage = useQuery<any>({
    queryKey: ["api-football-coverage", leagueKey],
    queryFn: () => getJson(`/api/football/coverage/${leagueKey}`),
    staleTime: 60 * 60 * 1000,
  });

  const rounds = useQuery<any>({
    queryKey: ["api-football-rounds", leagueKey],
    queryFn: () => getJson(`/api/football/rounds/${leagueKey}`),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const fixtureUrl = selectedRound
    ? `/api/football/fixtures/${leagueKey}?round=${encodeURIComponent(selectedRound)}&limit=40`
    : `/api/football/fixtures/${leagueKey}?status=${fixtureStatus}&limit=20`;
  const fixtures = useQuery<any>({
    queryKey: ["api-football-fixtures", leagueKey, fixtureStatus, selectedRound],
    queryFn: () => getJson(fixtureUrl),
    refetchInterval: fixtureStatus === "live" && !selectedRound ? 30_000 : false,
  });

  const match = useQuery<any>({
    queryKey: ["api-football-match", leagueKey, selectedFixtureId],
    queryFn: () => getJson(`/api/football/match/${leagueKey}/${selectedFixtureId}`),
    enabled: Boolean(selectedFixtureId),
    refetchInterval: fixtureStatus === "live" && selectedFixtureId ? 30_000 : false,
  });

  const standings = useQuery<any>({
    queryKey: ["api-football-standings", leagueKey],
    queryFn: () => getJson(`/api/football/standings/${leagueKey}`),
    staleTime: 30 * 60 * 1000,
  });

  const availability = useQuery<any>({
    queryKey: ["api-football-injuries", leagueKey],
    queryFn: () => getJson(`/api/football/injuries/${leagueKey}`),
    enabled: coverage.data?.coverage?.injuries !== false,
    staleTime: 2 * 60 * 60 * 1000,
  });

  const leaders = useQuery<any>({
    queryKey: ["api-football-leaders", leagueKey],
    queryFn: () => getJson(`/api/football/leaders/${leagueKey}`),
    staleTime: 30 * 60 * 1000,
  });

  const teams = useQuery<any>({
    queryKey: ["api-football-teams", leagueKey],
    queryFn: () => getJson(`/api/football/teams/${leagueKey}`),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const teamProfile = useQuery<any>({
    queryKey: ["api-football-team", leagueKey, selectedTeamId],
    queryFn: () => getJson(`/api/football/team/${leagueKey}/${selectedTeamId}`),
    enabled: Boolean(selectedTeamId),
  });
  const squad = useQuery<any>({
    queryKey: ["api-football-squad", leagueKey, selectedTeamId],
    queryFn: () => getJson(`/api/football/squad/${leagueKey}/${selectedTeamId}`),
    enabled: Boolean(selectedTeamId),
    staleTime: 6 * 60 * 60 * 1000,
  });
  const teamTransfers = useQuery<any>({
    queryKey: ["api-football-team-transfers", leagueKey, selectedTeamId],
    queryFn: () => getJson(`/api/football/team-transfers/${leagueKey}/${selectedTeamId}`),
    enabled: Boolean(selectedTeamId),
    staleTime: 6 * 60 * 60 * 1000,
  });
  const venue = useQuery<any>({
    queryKey: ["api-football-venue", leagueKey, selectedTeamId],
    queryFn: () => getJson(`/api/football/venue/${leagueKey}/${selectedTeamId}`),
    enabled: Boolean(selectedTeamId),
    staleTime: 12 * 60 * 60 * 1000,
  });
  const coach = useQuery<any>({
    queryKey: ["api-football-coach", selectedCoachId],
    queryFn: () => getJson(`/api/football/coach/${selectedCoachId}`),
    enabled: Boolean(selectedCoachId),
    staleTime: 12 * 60 * 60 * 1000,
  });

  const searchQuery = playerSearch.trim();
  const playerResults = useQuery<any>({
    queryKey: ["api-football-player-search", leagueKey, searchQuery],
    queryFn: () => getJson(`/api/football/players/${leagueKey}?search=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 3,
    staleTime: 30 * 60 * 1000,
  });

  const playerProfile = useQuery<any>({
    queryKey: ["api-football-player", leagueKey, selectedPlayerId],
    queryFn: () => getJson(`/api/football/player/${leagueKey}/${selectedPlayerId}`),
    enabled: Boolean(selectedPlayerId),
  });

  const fixtureRows = Array.isArray(fixtures.data?.fixtures) ? fixtures.data.fixtures : [];
  const roundRows = Array.isArray(rounds.data?.rounds) ? rounds.data.rounds : [];
  const fixtureError = fixtures.error instanceof Error ? fixtures.error.message : "The live match provider could not be reached.";

  const selectLeague = (next: LeagueKey) => {
    setLeagueKey(next);
    setSelectedRound("");
    setSelectedFixtureId(null);
    setSelectedTeamId(null);
    setSelectedPlayerId(null);
    setSelectedCoachId(null);
    setPlayerSearch("");
  };

  return (
    <div className="space-y-5">
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-background/80 p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-black"><BarChart3 className="h-5 w-5 text-violet-400" /> API-Football Pro Intelligence Centre</div>
            <p className="mt-1 text-sm text-muted-foreground">Standings, rounds, live match intelligence, visual lineups, advanced player form, injuries, squads, transfers, coaches and stadium data. Fantasy scoring remains linked to Fantasy Arena/FPL rules.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {COMPETITIONS.map((competition) => <Button key={competition.key} size="sm" variant={competition.key === leagueKey ? "default" : "outline"} onClick={() => selectLeague(competition.key)}>{competition.name}</Button>)}
          </div>
        </div>
        <div className="mt-4">{coverage.isLoading ? <Skeleton className="h-7 w-full" /> : <CoverageStrip data={coverage.data} />}</div>
      </Card>

      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="matches" className="gap-1"><Activity className="h-4 w-4" /> Match Centre</TabsTrigger>
          <TabsTrigger value="table" className="gap-1"><BarChart3 className="h-4 w-4" /> Table</TabsTrigger>
          <TabsTrigger value="availability" className="gap-1"><AlertTriangle className="h-4 w-4" /> Availability</TabsTrigger>
          <TabsTrigger value="leaders" className="gap-1"><Trophy className="h-4 w-4" /> Leaders</TabsTrigger>
          <TabsTrigger value="clubs" className="gap-1"><Building2 className="h-4 w-4" /> Clubs</TabsTrigger>
          <TabsTrigger value="players" className="gap-1"><Users className="h-4 w-4" /> Players</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-black">{selectedCompetition.name} Match Centre</h3><p className="text-xs text-muted-foreground">Browse by live status or exact round/gameweek. Fixture ID links events, lineups, statistics, ratings, H2H, predictions and availability.</p></div>
            <div className="flex flex-wrap gap-2">
              {(["upcoming", "live", "finished"] as const).map((status) => <Button key={status} size="sm" variant={!selectedRound && fixtureStatus === status ? "default" : "outline"} onClick={() => { setSelectedRound(""); setFixtureStatus(status); setSelectedFixtureId(null); }}>{status === "finished" ? "Results" : status[0].toUpperCase() + status.slice(1)}</Button>)}
              <select className="rounded-md border border-white/10 bg-background px-3 py-1 text-sm" value={selectedRound} onChange={(event) => { setSelectedRound(event.target.value); setSelectedFixtureId(null); }}>
                <option value="">Round / gameweek</option>
                {roundRows.map((round: any, index: number) => {
                  const label = typeof round === "string" ? round : String(round?.round || round?.name || `Round ${index + 1}`);
                  return <option key={`${label}-${index}`} value={label}>{label}</option>;
                })}
              </select>
            </div>
          </div>

          {fixtures.data?.warning ? (
            <Card className="flex items-start gap-3 border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <div className="font-semibold">Official Premier League backup feed active</div>
                <div className="mt-1 text-amber-100/80">{fixtures.data.warning}</div>
              </div>
            </Card>
          ) : null}

          {fixtures.isError && fixtureRows.length > 0 ? (
            <Card className="flex items-center justify-between gap-3 border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <span>Live match updates are temporarily unavailable. Previously loaded matches are still shown.</span>
              <Button size="sm" variant="outline" onClick={() => fixtures.refetch()}>Retry</Button>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
            <div className="space-y-2">
              {fixtures.isLoading ? [1,2,3,4].map((item) => <Skeleton key={item} className="h-24 w-full" />) : fixtureRows.length ? fixtureRows.map((fixture: any) => (
                <button key={fixture.id} type="button" onClick={() => setSelectedFixtureId(Number(fixture.id))} className={`w-full rounded-xl border p-4 text-left transition ${Number(fixture.id) === selectedFixtureId ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-black/20 hover:bg-white/5"}`}>
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{fixture.round || selectedCompetition.name}</span><Badge variant="outline">{fixture.elapsed > 0 ? `${fixture.elapsed}'` : fixture.status}</Badge></div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-bold"><span className="truncate">{fixture.homeTeam?.name}</span><span className="rounded bg-black/30 px-2 py-1 text-center">{fixture.homeTeam?.score ?? "-"} : {fixture.awayTeam?.score ?? "-"}</span><span className="truncate text-right">{fixture.awayTeam?.name}</span></div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatDate(fixture.kickoffTime)}</div>
                </button>
              )) : fixtures.isError ? (
                <Card className="space-y-3 border-amber-500/30 bg-amber-500/10 p-5 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-amber-200"><AlertTriangle className="h-4 w-4" /> Live match feed unavailable</div>
                  <p className="text-muted-foreground">{fixtureError}</p>
                  <Button size="sm" variant="outline" onClick={() => fixtures.refetch()}>Retry live feed</Button>
                </Card>
              ) : <Card className="p-6 text-sm text-muted-foreground">{fixtureStatus === "live" && !selectedRound ? "No live Premier League matches are currently in progress." : "No fixtures returned for this selection."}</Card>}
            </div>
            {match.isError && !match.data ? (
              <Card className="flex min-h-[18rem] flex-col items-center justify-center gap-3 border-amber-500/30 p-8 text-center">
                <AlertTriangle className="h-6 w-6 text-amber-300" />
                <div className="font-semibold">Detailed match intelligence is temporarily unavailable.</div>
                <div className="text-sm text-muted-foreground">{match.error instanceof Error ? match.error.message : "The live provider could not return this fixture."}</div>
                <Button size="sm" variant="outline" onClick={() => match.refetch()}>Retry match details</Button>
              </Card>
            ) : <MatchIntelligence data={match.data} loading={match.isLoading} onPlayer={(id) => setSelectedPlayerId(id)} />}
          </div>
          {selectedPlayerId ? <PlayerProfile data={playerProfile.data} loading={playerProfile.isLoading} /> : null}
        </TabsContent>

        <TabsContent value="table">
          <StandingsTable data={standings.data} loading={standings.isLoading} />
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilityCentre data={availability.data} loading={availability.isLoading} disabled={coverage.data?.coverage?.injuries === false} />
        </TabsContent>

        <TabsContent value="leaders">
          <LeaderBoard data={leaders.data} loading={leaders.isLoading} onPlayer={(id) => setSelectedPlayerId(id)} />
          {selectedPlayerId ? <div className="mt-4"><PlayerProfile data={playerProfile.data} loading={playerProfile.isLoading} /></div> : null}
        </TabsContent>

        <TabsContent value="clubs" className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {(Array.isArray(teams.data?.teams) ? teams.data.teams : []).map((row: any) => {
              const team = row?.team || row;
              return <button type="button" key={team?.id} onClick={() => { setSelectedTeamId(Number(team?.id)); setSelectedCoachId(null); }} className={`rounded-xl border p-3 text-center transition ${Number(team?.id) === selectedTeamId ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-black/20 hover:bg-white/5"}`}>{team?.logo ? <img src={team.logo} alt="" className="mx-auto h-12 w-12 object-contain" /> : null}<div className="mt-2 truncate text-sm font-bold">{team?.name}</div></button>;
            })}
          </div>
          {teams.isLoading ? <Skeleton className="h-48 w-full" /> : null}
          {selectedTeamId ? <TeamProfile data={teamProfile.data} squad={squad.data} transfers={teamTransfers.data} venue={venue.data} loading={teamProfile.isLoading || squad.isLoading} onCoach={(id) => setSelectedCoachId(id)} /> : null}
          {selectedCoachId ? <CoachProfile data={coach.data} loading={coach.isLoading} /> : null}
        </TabsContent>

        <TabsContent value="players" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder={`Search ${selectedCompetition.name} player — at least 3 characters`} /></div>
          </Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(Array.isArray(playerResults.data?.players) ? playerResults.data.players : []).map((row: any) => <TinyPlayer key={row?.player?.id} row={row} onClick={() => setSelectedPlayerId(Number(row?.player?.id || 0))} suffix={row?.statistics?.[0]?.games?.position || ""} />)}
          </div>
          {playerResults.isFetching ? <Skeleton className="h-24 w-full" /> : null}
          {selectedPlayerId ? <PlayerProfile data={playerProfile.data} loading={playerProfile.isLoading} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchIntelligence({ data, loading, onPlayer }: { data: any; loading: boolean; onPlayer: (id: number) => void }) {
  if (loading) return <Skeleton className="min-h-[28rem] w-full" />;
  if (!data?.fixture) return <Card className="flex min-h-[18rem] items-center justify-center p-8 text-center text-muted-foreground">Select a fixture to open full API-Football match intelligence.</Card>;
  const fixture = data.fixture;
  const raw = data.rawFixture || {};
  const prediction = data.prediction?.predictions || data.prediction || null;
  const percent = prediction?.percent || {};
  const events = Array.isArray(data.events) ? data.events : [];
  const lineups = Array.isArray(data.lineups) ? data.lineups : [];
  const statistics = Array.isArray(data.statistics) ? data.statistics : [];
  const halfStatistics = Array.isArray(data.halfStatistics) ? data.halfStatistics : [];
  const playerGroups = Array.isArray(data.players) ? data.players : [];
  const injuries = Array.isArray(data.injuries) ? data.injuries : [];
  const h2h = Array.isArray(data.headToHead) ? data.headToHead : [];
  const ratedPlayers = playerGroups.flatMap((group: any) => (Array.isArray(group?.players) ? group.players.map((item: any) => ({ ...item, team: group.team })) : [])).filter((item: any) => item?.player?.id).sort((a: any, b: any) => asNumber(b?.statistics?.[0]?.games?.rating) - asNumber(a?.statistics?.[0]?.games?.rating)).slice(0, 12);
  const score = raw?.score || fixture?.score || {};

  return (
    <Card className="space-y-5 overflow-hidden p-4 sm:p-5">
      {data.warning ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>{data.warning}</span>
        </div>
      ) : null}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="text-center text-xs uppercase tracking-[.18em] text-muted-foreground">{fixture.round}</div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><div className="font-black">{fixture.homeTeam?.name}</div><div className="rounded-lg bg-black/30 px-4 py-2 text-2xl font-black">{fixture.homeTeam?.score ?? "-"} : {fixture.awayTeam?.score ?? "-"}</div><div className="font-black">{fixture.awayTeam?.name}</div></div>
        <div className="mt-2 text-center text-xs text-muted-foreground">{formatDate(fixture.kickoffTime)} · {fixture.venue?.name || "Venue TBD"} · {fixture.statusLong || fixture.status}</div>
      </div>

      <section>
        <h4 className="mb-2 font-black">Detailed match report</h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Referee" value={fixture.referee || "TBD"} />
          <Metric label="Half-time" value={`${score?.halftime?.home ?? "-"} : ${score?.halftime?.away ?? "-"}`} />
          <Metric label="Full-time" value={`${score?.fulltime?.home ?? fixture.homeTeam?.score ?? "-"} : ${score?.fulltime?.away ?? fixture.awayTeam?.score ?? "-"}`} />
          <Metric label="Extra / pens" value={score?.penalty?.home != null ? `${score.penalty.home} : ${score.penalty.away}` : score?.extratime?.home != null ? `${score.extratime.home} : ${score.extratime.away}` : "—"} />
        </div>
      </section>

      {prediction ? <section><h4 className="mb-2 font-black">Statistical prediction</h4><div className="grid grid-cols-3 gap-2 text-center"><Metric label="Home" value={percent.home || "-"} /><Metric label="Draw" value={percent.draw || "-"} /><Metric label="Away" value={percent.away || "-"} /></div><p className="mt-2 text-sm text-muted-foreground">{prediction.advice || prediction?.winner?.comment || "Prediction available"}</p></section> : null}

      <section><h4 className="mb-2 font-black">Full-match statistics</h4>{statistics.length ? <StatisticsBlocks rows={statistics} /> : <EmptyText text="Match statistics are not available yet for this fixture." />}</section>
      {halfStatistics.length ? <section><h4 className="mb-2 font-black">First-half / half-time statistics</h4><StatisticsBlocks rows={halfStatistics} /></section> : null}

      <section><h4 className="mb-2 font-black">Event timeline</h4>{events.length ? <div className="space-y-2">{events.map((event: any, index: number) => <div key={`${event?.time?.elapsed}-${event?.time?.extra}-${event?.player?.id}-${index}`} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-2 text-sm"><Badge variant="outline">{formatEventMinute(event)}</Badge><div className="min-w-0 flex-1"><span className="font-semibold">{event?.player?.name || event?.team?.name}</span> <span className="text-muted-foreground">{event?.detail || event?.type}</span>{event?.assist?.name ? <span className="text-muted-foreground"> · assist {event.assist.name}</span> : null}</div></div>)}</div> : <EmptyText text="No match events available yet." />}</section>

      <section><h4 className="mb-2 font-black">Confirmed formations & starting XI</h4>{lineups.length ? <div className="grid gap-4 lg:grid-cols-2">{lineups.map((lineup: any) => <FormationPitch key={lineup?.team?.id || lineup?.team?.name} lineup={lineup} onPlayer={onPlayer} />)}</div> : <EmptyText text="Lineups usually appear 20–60 minutes before kickoff." />}</section>

      <section><h4 className="mb-2 font-black">Player ratings</h4>{ratedPlayers.length ? <div className="grid gap-2 md:grid-cols-2">{ratedPlayers.map((row: any) => <TinyPlayer key={`${row.team?.id}-${row.player?.id}`} row={row} onClick={() => onPlayer(Number(row.player.id))} suffix={String(row?.statistics?.[0]?.games?.rating || "-")} />)}</div> : <EmptyText text="Player ratings will populate during or after the match." />}</section>

      <section className="grid gap-4 lg:grid-cols-2"><div><h4 className="mb-2 font-black">Match availability</h4>{injuries.length ? <div className="space-y-2">{injuries.slice(0, 20).map((row: any, index: number) => <div key={`${row?.player?.id}-${index}`} className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-400" /><span className="font-semibold">{row?.player?.name}</span><span className="text-muted-foreground">{row?.player?.type} · {row?.player?.reason}</span></div>)}</div> : <EmptyText text="No fixture-specific absences returned." />}</div><div><h4 className="mb-2 font-black">Recent head-to-head</h4>{h2h.length ? <div className="space-y-2">{h2h.map((row: any) => <div key={row.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"><span className="font-semibold">{row.homeTeam?.name} {row.homeTeam?.score ?? "-"} : {row.awayTeam?.score ?? "-"} {row.awayTeam?.name}</span><div className="text-muted-foreground">{formatDate(row.kickoffTime)}</div></div>)}</div> : <EmptyText text="No H2H history returned." />}</div></section>
    </Card>
  );
}

function StatisticsBlocks({ rows }: { rows: any[] }) {
  return <div className="grid gap-3 md:grid-cols-2">{rows.map((block: any, index: number) => <div key={`${block?.team?.id || block?.team?.name}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="mb-2 font-bold">{block?.team?.name || `Team ${index + 1}`}</div><div className="grid grid-cols-2 gap-2 text-xs"><Metric label="Possession" value={statValue(block, "Ball Possession") ?? "-"} /><Metric label="Shots" value={statValue(block, "Total Shots") ?? "-"} /><Metric label="On target" value={statValue(block, "Shots on Goal") ?? "-"} /><Metric label="Corners" value={statValue(block, "Corner Kicks") ?? "-"} /><Metric label="Passes" value={statValue(block, "Total passes") ?? "-"} /><Metric label="Pass %" value={statValue(block, "Passes %") ?? "-"} /><Metric label="Fouls" value={statValue(block, "Fouls") ?? "-"} /><Metric label="Offsides" value={statValue(block, "Offsides") ?? "-"} /></div></div>)}</div>;
}

function FormationPitch({ lineup, onPlayer }: { lineup: any; onPlayer: (id: number) => void }) {
  const starters = Array.isArray(lineup?.startXI) ? lineup.startXI : [];
  const bench = Array.isArray(lineup?.substitutes) ? lineup.substitutes : [];
  const rows = new Map<number, any[]>();
  for (const entry of starters) {
    const grid = String(entry?.player?.grid || "");
    const rowNumber = Number(grid.split(":")[0] || 0);
    const row = rowNumber > 0 ? rowNumber : 99;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(entry);
  }
  const ordered = [...rows.entries()].sort(([a], [b]) => a - b);
  return <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between"><div className="font-black">{lineup?.team?.name}</div><Badge variant="outline">{lineup?.formation || "Formation"}</Badge></div><div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-3"><div className="absolute inset-x-0 top-1/2 border-t border-white/10" /><div className="relative space-y-4">{ordered.map(([row, entries]) => <div key={row} className="flex justify-around gap-1">{entries.map((entry: any, index: number) => <button type="button" key={`${entry?.player?.id}-${index}`} onClick={() => onPlayer(Number(entry?.player?.id || 0))} className="max-w-[90px] rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-center text-[10px] hover:bg-white/10"><div className="font-bold">{entry?.player?.name}</div><div className="text-white/45">#{entry?.player?.number || "-"}</div></button>)}</div>)}</div></div><div><div className="mb-1 text-xs font-black uppercase tracking-wide text-white/50">Bench</div><div className="flex flex-wrap gap-1">{bench.map((entry: any) => <button type="button" key={entry?.player?.id} onClick={() => onPlayer(Number(entry?.player?.id || 0))} className="rounded-md border border-white/10 px-2 py-1 text-[10px] hover:bg-white/5">{entry?.player?.name}</button>)}</div></div></div>;
}

function StandingsTable({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-96 w-full" />;
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  if (!groups.length) return <Card className="p-8 text-center text-muted-foreground">No standings are available for this competition/season yet.</Card>;
  return <div className="space-y-4">{groups.map((rows: any[], groupIndex: number) => <Card key={groupIndex} className="overflow-hidden"><div className="border-b border-white/10 p-3 font-black">{rows?.[0]?.group || (groups.length > 1 ? `Group ${groupIndex + 1}` : "Standings")}</div><div className="overflow-x-auto"><table className="min-w-[720px] w-full text-sm"><thead className="bg-white/5 text-xs text-muted-foreground"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Club</th><th className="p-3">P</th><th className="p-3">W</th><th className="p-3">D</th><th className="p-3">L</th><th className="p-3">GF</th><th className="p-3">GA</th><th className="p-3">GD</th><th className="p-3">Pts</th><th className="p-3">Form</th></tr></thead><tbody className="divide-y divide-white/10">{rows.map((row: any) => <tr key={`${groupIndex}-${row?.rank}-${row?.team?.id}`}><td className="p-3 font-black">{row?.rank}</td><td className="p-3"><div className="flex items-center gap-2">{row?.team?.logo ? <img src={row.team.logo} alt="" className="h-6 w-6 object-contain" /> : null}<span className="font-bold">{row?.team?.name}</span></div></td><td className="p-3 text-center">{row?.all?.played ?? 0}</td><td className="p-3 text-center">{row?.all?.win ?? 0}</td><td className="p-3 text-center">{row?.all?.draw ?? 0}</td><td className="p-3 text-center">{row?.all?.lose ?? 0}</td><td className="p-3 text-center">{row?.all?.goals?.for ?? 0}</td><td className="p-3 text-center">{row?.all?.goals?.against ?? 0}</td><td className="p-3 text-center">{row?.goalsDiff ?? 0}</td><td className="p-3 text-center font-black">{row?.points ?? 0}</td><td className="p-3 text-center text-xs">{row?.form || "-"}</td></tr>)}</tbody></table></div></Card>)}</div>;
}

function AvailabilityCentre({ data, loading, disabled }: { data: any; loading: boolean; disabled: boolean }) {
  if (disabled) return <Card className="p-8 text-center text-muted-foreground">API-Football marks injury coverage as unavailable for this competition/season.</Card>;
  if (loading) return <Skeleton className="h-80 w-full" />;
  const rows = Array.isArray(data?.injuries) ? data.injuries : [];
  if (!rows.length) return <Card className="p-8 text-center text-muted-foreground">No current injuries or suspensions were returned.</Card>;
  const byTeam = new Map<string, any[]>();
  for (const row of rows) {
    const team = String(row?.team?.name || "Other");
    if (!byTeam.has(team)) byTeam.set(team, []);
    byTeam.get(team)!.push(row);
  }
  return <div className="space-y-4"><Card className="border-amber-500/20 bg-amber-500/5 p-4"><div className="flex items-center gap-2 font-black"><AlertTriangle className="h-5 w-5 text-amber-400" /> League-wide injuries & suspensions</div><p className="mt-1 text-sm text-muted-foreground">Use this before selecting a tournament team. Data is factual provider availability information, not a prediction of fantasy performance.</p></Card><div className="grid gap-4 lg:grid-cols-2">{[...byTeam.entries()].map(([team, teamRows]) => <Card key={team} className="p-4"><h3 className="mb-3 font-black">{team}</h3><div className="space-y-2">{teamRows.map((row: any, index: number) => <div key={`${row?.player?.id}-${index}`} className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3">{row?.player?.photo ? <img src={row.player.photo} alt="" className="h-10 w-10 rounded-full object-cover" /> : <AlertTriangle className="mt-1 h-4 w-4 text-amber-400" />}<div><div className="font-bold">{row?.player?.name}</div><div className="text-xs text-amber-200">{row?.player?.type || "Unavailable"}</div><div className="text-xs text-muted-foreground">{row?.player?.reason || "Reason not provided"}</div></div></div>)}</div></Card>)}</div></div>;
}

function LeaderBoard({ data, loading, onPlayer }: { data: any; loading: boolean; onPlayer: (id: number) => void }) {
  if (loading) return <Skeleton className="h-72 w-full" />;
  const groups = [
    ["Top scorers", data?.topScorers || [], (row: any) => `${row?.statistics?.[0]?.goals?.total ?? 0} goals`],
    ["Top assists", data?.topAssists || [], (row: any) => `${row?.statistics?.[0]?.goals?.assists ?? 0} assists`],
    ["Yellow cards", data?.topYellowCards || [], (row: any) => `${row?.statistics?.[0]?.cards?.yellow ?? 0} cards`],
    ["Red cards", data?.topRedCards || [], (row: any) => `${row?.statistics?.[0]?.cards?.red ?? 0} cards`],
  ] as const;
  return <div className="grid gap-4 lg:grid-cols-2">{groups.map(([title, rows, suffix]) => <Card key={title} className="p-4"><h3 className="mb-3 font-black">{title}</h3><div className="space-y-2">{(Array.isArray(rows) ? rows.slice(0, 10) : []).map((row: any) => <TinyPlayer key={row?.player?.id} row={row} onClick={() => onPlayer(Number(row?.player?.id || 0))} suffix={suffix(row)} />)}{!rows?.length ? <EmptyText text="No leaderboard data returned yet." /> : null}</div></Card>)}</div>;
}

function TeamProfile({ data, squad, transfers, venue, loading, onCoach }: { data: any; squad: any; transfers: any; venue: any; loading: boolean; onCoach: (id: number) => void }) {
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (!data?.team) return null;
  const team = data.team?.team || data.team;
  const baseVenue = venue?.venue || data.team?.venue || null;
  const stats = data.statistics || {};
  const fixtures = stats?.fixtures || {};
  const goals = stats?.goals || {};
  const clean = stats?.clean_sheet || {};
  const squadPlayers = Array.isArray(squad?.players) ? squad.players : [];
  const transferRows = Array.isArray(transfers?.transfers) ? transfers.transfers : [];
  return <Card className="space-y-5 p-4 sm:p-5"><div className="flex flex-wrap items-center gap-4">{team?.logo ? <img src={team.logo} alt="" className="h-16 w-16 object-contain" /> : null}<div><h3 className="text-xl font-black">{team?.name}</h3><p className="text-sm text-muted-foreground">{baseVenue?.name || "Venue TBD"}{baseVenue?.city ? ` · ${baseVenue.city}` : ""}</p></div></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="Played" value={fixtures?.played?.total ?? 0} /><Metric label="Wins" value={fixtures?.wins?.total ?? 0} /><Metric label="Goals" value={goals?.for?.total?.total ?? 0} /><Metric label="Clean sheets" value={clean?.total ?? 0} /></div>
    <section><h4 className="mb-2 flex items-center gap-2 font-black"><MapPin className="h-4 w-4" /> Stadium</h4><div className="grid gap-2 md:grid-cols-4"><Metric label="Venue" value={baseVenue?.name || "TBD"} /><Metric label="City" value={baseVenue?.city || "—"} /><Metric label="Capacity" value={baseVenue?.capacity?.toLocaleString?.() || baseVenue?.capacity || "—"} /><Metric label="Surface" value={baseVenue?.surface || "—"} /></div>{baseVenue?.image ? <img src={baseVenue.image} alt="" className="mt-3 max-h-56 w-full rounded-xl object-cover" /> : null}</section>
    <section><h4 className="mb-2 font-black">Coaches</h4><div className="flex flex-wrap gap-2">{(Array.isArray(data.coaches) ? data.coaches : []).slice(0, 5).map((coach: any) => <Button key={coach?.id} size="sm" variant="outline" onClick={() => onCoach(Number(coach?.id || 0))}>{coach?.name}</Button>)}{!data.coaches?.length ? <span className="text-sm text-muted-foreground">Coach data not returned.</span> : null}</div></section>
    <section><h4 className="mb-2 flex items-center gap-2 font-black"><Users className="h-4 w-4" /> Current squad</h4>{squadPlayers.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{squadPlayers.map((player: any) => <div key={player?.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2">{player?.photo ? <img src={player.photo} alt="" className="h-10 w-10 rounded-full object-cover" /> : null}<div className="min-w-0"><div className="truncate text-sm font-bold">{player?.name}</div><div className="text-xs text-muted-foreground">#{player?.number || "-"} · {player?.position || ""} · {player?.age || "?"}y</div></div></div>)}</div> : <EmptyText text="Current squad not returned." />}</section>
    <section><h4 className="mb-2 flex items-center gap-2 font-black"><ArrowRightLeft className="h-4 w-4" /> Club transfers</h4><TeamTransfers rows={transferRows} teamId={Number(team?.id || 0)} /></section>
    <FixtureMini title="Recent results" rows={data.recent} /><FixtureMini title="Next fixtures" rows={data.upcoming} />
  </Card>;
}

function TeamTransfers({ rows, teamId }: { rows: any[]; teamId: number }) {
  const items = rows.flatMap((row: any) => {
    const player = row?.player || {};
    return (Array.isArray(row?.transfers) ? row.transfers : []).map((transfer: any) => ({ player, transfer }));
  }).slice(0, 30);
  if (!items.length) return <EmptyText text="No transfer records returned." />;
  return <div className="grid gap-2 md:grid-cols-2">{items.map((item: any, index: number) => {
    const incoming = Number(item.transfer?.teams?.in?.id || 0) === teamId;
    return <div key={`${item.player?.id}-${item.transfer?.date}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm"><div className="font-bold">{item.player?.name || "Player"}</div><div className={incoming ? "text-emerald-300" : "text-amber-300"}>{incoming ? "IN" : "OUT"} · {item.transfer?.type || "Transfer"}</div><div className="text-xs text-muted-foreground">{item.transfer?.teams?.out?.name || "?"} → {item.transfer?.teams?.in?.name || "?"} · {item.transfer?.date || ""}</div></div>;
  })}</div>;
}

function CoachProfile({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-72 w-full" />;
  const profile = data?.profile;
  if (!profile) return null;
  const career = Array.isArray(profile?.career) ? profile.career : [];
  return <Card className="space-y-4 p-4"><div className="flex items-center gap-4">{profile?.photo ? <img src={profile.photo} alt="" className="h-20 w-20 rounded-full object-cover" /> : <UserRound className="h-12 w-12" />}<div><h3 className="text-xl font-black">{profile?.name}</h3><p className="text-sm text-muted-foreground">{profile?.nationality || ""} · age {profile?.age || "—"}</p></div></div><HistoryList title="Management career" rows={career} render={(row: any) => `${row?.team?.name || "Club"} · ${row?.start || ""} → ${row?.end || "present"}`} /><HistoryList title="Coach trophies" rows={data?.trophies} render={(row: any) => `${row?.league || row?.competition || "Competition"} · ${row?.season || ""} · ${row?.place || row?.result || ""}`} /><HistoryList title="Coach sidelined history" rows={data?.sidelined} render={(row: any) => `${row?.type || "Unavailable"} · ${row?.start || ""} → ${row?.end || "ongoing"}`} /></Card>;
}

function PlayerProfile({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (!data?.profile) return null;
  const player = data.profile?.player || {};
  const stat = data.leagueStatistics || data.profile?.statistics?.[0] || {};
  const games = stat?.games || {};
  const goals = stat?.goals || {};
  const shots = stat?.shots || {};
  const passes = stat?.passes || {};
  const tackles = stat?.tackles || {};
  const duels = stat?.duels || {};
  const dribbles = stat?.dribbles || {};
  const fouls = stat?.fouls || {};
  const cards = stat?.cards || {};
  const penalty = stat?.penalty || {};
  const formRows = Array.isArray(data?.form?.matches) ? data.form.matches : [];
  return <Card className="space-y-5 p-4 sm:p-5"><div className="flex items-center gap-4">{player?.photo ? <img src={player.photo} alt="" className="h-20 w-20 rounded-full object-cover" /> : null}<div><h3 className="text-xl font-black">{player?.name}</h3><p className="text-sm text-muted-foreground">{player?.nationality || ""} · {stat?.team?.name || ""} · {games?.position || ""}</p></div></div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6"><Metric label="Apps" value={games?.appearences ?? 0} /><Metric label="Starts" value={games?.lineups ?? 0} /><Metric label="Minutes" value={games?.minutes ?? 0} /><Metric label="Rating" value={games?.rating ?? "-"} /><Metric label="Goals" value={goals?.total ?? 0} /><Metric label="Assists" value={goals?.assists ?? 0} /></div>
    <section><h4 className="mb-2 font-black">Advanced season statistics</h4><div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6"><Metric label="Shots" value={shots?.total ?? 0} /><Metric label="On target" value={shots?.on ?? 0} /><Metric label="Passes" value={passes?.total ?? 0} /><Metric label="Key passes" value={passes?.key ?? 0} /><Metric label="Pass %" value={passes?.accuracy ?? "-"} /><Metric label="Tackles" value={tackles?.total ?? 0} /><Metric label="Interceptions" value={tackles?.interceptions ?? 0} /><Metric label="Duels won" value={duels?.won ?? 0} /><Metric label="Dribbles" value={dribbles?.success ?? 0} /><Metric label="Fouls drawn" value={fouls?.drawn ?? 0} /><Metric label="Fouls committed" value={fouls?.committed ?? 0} /><Metric label="Cards" value={asNumber(cards?.yellow) + asNumber(cards?.red)} /><Metric label="Pens scored" value={penalty?.scored ?? 0} /><Metric label="Pens missed" value={penalty?.missed ?? 0} /><Metric label="Pens saved" value={penalty?.saved ?? 0} /></div></section>
    <section><h4 className="mb-2 flex items-center gap-2 font-black"><Activity className="h-4 w-4" /> Recent rating / Fantasy Arena form</h4><FormTrend rows={formRows} source={data?.form?.source} /></section>
    <HistoryList title="Transfer history" rows={data.transfers} render={(row: any) => { const item = Array.isArray(row?.transfers) ? row.transfers[0] : row; return `${item?.date || ""} · ${item?.teams?.out?.name || "?"} → ${item?.teams?.in?.name || "?"} · ${item?.type || ""}`; }} /><HistoryList title="Trophy cabinet" rows={data.trophies} render={(row: any) => `${row?.league || row?.competition || "Competition"} · ${row?.season || ""} · ${row?.place || row?.result || ""}`} /><HistoryList title="Injury & suspension history" rows={data.sidelined} render={(row: any) => `${row?.type || "Unavailable"} · ${row?.start || ""} → ${row?.end || "ongoing"}`} /></Card>;
}

function FormTrend({ rows, source }: { rows: any[]; source?: string }) {
  if (!rows.length) return <EmptyText text="Recent per-match player ratings have not been captured yet." />;
  return <div className="space-y-2"><div className="text-xs text-muted-foreground">Source: {source || "API-Football"}. Fantasy Arena scores are shown only where the synchronized scoring record exists.</div>{rows.slice(0, 10).map((row: any, index: number) => {
    const rating = row?.rating == null ? null : asNumber(row.rating);
    const fantasy = row?.fantasyScore == null ? null : asNumber(row.fantasyScore);
    const width = Math.max(4, Math.min(100, fantasy != null ? fantasy : (rating || 0) * 10));
    const opponent = row?.fixture ? `${row.fixture.homeTeam?.name} vs ${row.fixture.awayTeam?.name}` : `${row?.homeTeam || ""} vs ${row?.awayTeam || ""}`;
    return <div key={`${row?.fixtureId || row?.fixture?.id || index}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-3"><div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="truncate font-semibold">{opponent || row?.round || `Match ${index + 1}`}</span><span>{fantasy != null ? `Arena ${fantasy.toFixed(1)}` : rating != null ? `Rating ${rating.toFixed(1)}` : "No rating"}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${width}%` }} /></div><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span>{row?.minutes ?? 0} min</span><span>{row?.goals ?? 0} goals</span><span>{row?.assists ?? 0} assists</span><span>{row?.shotsOn ?? 0} shots on</span><span>{row?.keyPasses ?? 0} key passes</span></div></div>;
  })}</div>;
}

function Metric({ label, value }: { label: string; value: any }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-center"><div className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</div><div className="mt-1 break-words font-black">{value ?? "-"}</div></div>;
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-muted-foreground">{text}</div>;
}

function FixtureMini({ title, rows }: { title: string; rows: any[] }) {
  return <div><h4 className="mb-2 font-black">{title}</h4><div className="grid gap-2 md:grid-cols-2">{(Array.isArray(rows) ? rows : []).map((row: any) => <div key={row.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"><div className="font-semibold">{row.homeTeam?.name} {row.homeTeam?.score ?? "-"} : {row.awayTeam?.score ?? "-"} {row.awayTeam?.name}</div><div className="text-muted-foreground">{formatDate(row.kickoffTime)}</div></div>)}</div></div>;
}

function HistoryList({ title, rows, render }: { title: string; rows: any[]; render: (row: any) => string }) {
  const list = Array.isArray(rows) ? rows : [];
  return <div><h4 className="mb-2 font-black">{title}</h4>{list.length ? <div className="space-y-2">{list.slice(0, 20).map((row: any, index: number) => <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-muted-foreground">{render(row)}</div>)}</div> : <EmptyText text={`No ${title.toLowerCase()} returned.`} />}</div>;
}

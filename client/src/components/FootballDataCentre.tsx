import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, BarChart3, Building2, Clock, Search, Trophy, UserRound, Users } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

// API_FOOTBALL_DATA_CENTRE_V1
type LeagueKey = "premier-league" | "la-liga" | "bundesliga" | "serie-a" | "ligue-1";

const LEAGUES: Array<{ key: LeagueKey; name: string }> = [
  { key: "premier-league", name: "Premier League" },
  { key: "la-liga", name: "La Liga" },
  { key: "bundesliga", name: "Bundesliga" },
  { key: "serie-a", name: "Serie A" },
  { key: "ligue-1", name: "Ligue 1" },
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

function teamName(row: any) {
  return String(row?.team?.name || row?.name || "Unknown club");
}

function statValue(block: any, type: string) {
  const list = Array.isArray(block?.statistics) ? block.statistics : [];
  const found = list.find((item: any) => String(item?.type || "").toLowerCase() === type.toLowerCase());
  return found?.value ?? null;
}

function TinyPlayer({ row, onClick, suffix }: { row: any; onClick?: () => void; suffix?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:bg-white/5 disabled:cursor-default">
      {playerPhoto(row) ? <img src={playerPhoto(row)} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><UserRound className="h-5 w-5" /></div>}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{playerName(row)}</div>
        <div className="truncate text-xs text-muted-foreground">{row?.statistics?.[0]?.team?.name || row?.team?.name || ""}</div>
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
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");

  const selectedLeague = LEAGUES.find((item) => item.key === leagueKey) || LEAGUES[0];

  const coverage = useQuery<any>({
    queryKey: ["api-football-coverage", leagueKey],
    queryFn: () => getJson(`/api/football/coverage/${leagueKey}`),
    staleTime: 60 * 60 * 1000,
  });

  const fixtures = useQuery<any>({
    queryKey: ["api-football-fixtures", leagueKey, fixtureStatus],
    queryFn: () => getJson(`/api/football/fixtures/${leagueKey}?status=${fixtureStatus}&limit=20`),
    refetchInterval: fixtureStatus === "live" ? 30_000 : false,
  });

  const match = useQuery<any>({
    queryKey: ["api-football-match", leagueKey, selectedFixtureId],
    queryFn: () => getJson(`/api/football/match/${leagueKey}/${selectedFixtureId}`),
    enabled: Boolean(selectedFixtureId),
    refetchInterval: fixtureStatus === "live" && selectedFixtureId ? 30_000 : false,
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

  const searchQuery = playerSearch.trim();
  const playerResults = useQuery<any>({
    queryKey: ["api-football-player-search", leagueKey, searchQuery],
    queryFn: () => getJson(`/api/football/players/${leagueKey}?search=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 4,
    staleTime: 30 * 60 * 1000,
  });

  const playerProfile = useQuery<any>({
    queryKey: ["api-football-player", leagueKey, selectedPlayerId],
    queryFn: () => getJson(`/api/football/player/${leagueKey}/${selectedPlayerId}`),
    enabled: Boolean(selectedPlayerId),
  });

  const fixtureRows = Array.isArray(fixtures.data?.fixtures) ? fixtures.data.fixtures : [];

  const selectLeague = (next: LeagueKey) => {
    setLeagueKey(next);
    setSelectedFixtureId(null);
    setSelectedTeamId(null);
    setSelectedPlayerId(null);
    setPlayerSearch("");
  };

  return (
    <div className="space-y-5">
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-background/80 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-black"><BarChart3 className="h-5 w-5 text-violet-400" /> API-Football Pro Data Centre</div>
            <p className="mt-1 text-sm text-muted-foreground">Official match intelligence, lineups, events, performance statistics, player histories and club data. Fantasy scoring remains linked to FPL.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {LEAGUES.map((league) => <Button key={league.key} size="sm" variant={league.key === leagueKey ? "default" : "outline"} onClick={() => selectLeague(league.key)}>{league.name}</Button>)}
          </div>
        </div>
        <div className="mt-4">{coverage.isLoading ? <Skeleton className="h-7 w-full" /> : <CoverageStrip data={coverage.data} />}</div>
      </Card>

      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="matches" className="gap-1"><Activity className="h-4 w-4" /> Match Centre</TabsTrigger>
          <TabsTrigger value="leaders" className="gap-1"><Trophy className="h-4 w-4" /> Leaders</TabsTrigger>
          <TabsTrigger value="clubs" className="gap-1"><Building2 className="h-4 w-4" /> Clubs</TabsTrigger>
          <TabsTrigger value="players" className="gap-1"><Users className="h-4 w-4" /> Players</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-black">{selectedLeague.name} Match Centre</h3><p className="text-xs text-muted-foreground">Fixture ID links every event, lineup, stat, rating, H2H, prediction and availability report.</p></div>
            <div className="flex gap-2">{(["upcoming", "live", "finished"] as const).map((status) => <Button key={status} size="sm" variant={fixtureStatus === status ? "default" : "outline"} onClick={() => { setFixtureStatus(status); setSelectedFixtureId(null); }}>{status === "finished" ? "Results" : status[0].toUpperCase() + status.slice(1)}</Button>)}</div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
            <div className="space-y-2">
              {fixtures.isLoading ? [1,2,3,4].map((item) => <Skeleton key={item} className="h-24 w-full" />) : fixtureRows.length ? fixtureRows.map((fixture: any) => (
                <button key={fixture.id} type="button" onClick={() => setSelectedFixtureId(Number(fixture.id))} className={`w-full rounded-xl border p-4 text-left transition ${Number(fixture.id) === selectedFixtureId ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-black/20 hover:bg-white/5"}`}>
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{fixture.round || selectedLeague.name}</span><Badge variant="outline">{fixture.status}</Badge></div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-bold"><span className="truncate">{fixture.homeTeam?.name}</span><span className="rounded bg-black/30 px-2 py-1 text-center">{fixture.homeTeam?.score ?? "-"} : {fixture.awayTeam?.score ?? "-"}</span><span className="truncate text-right">{fixture.awayTeam?.name}</span></div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatDate(fixture.kickoffTime)}</div>
                </button>
              )) : <Card className="p-6 text-sm text-muted-foreground">No {fixtureStatus} fixtures returned yet.</Card>}
            </div>
            <MatchIntelligence data={match.data} loading={match.isLoading} onPlayer={(id) => setSelectedPlayerId(id)} />
          </div>
        </TabsContent>

        <TabsContent value="leaders">
          <LeaderBoard data={leaders.data} loading={leaders.isLoading} onPlayer={(id) => setSelectedPlayerId(id)} />
          {selectedPlayerId ? <div className="mt-4"><PlayerProfile data={playerProfile.data} loading={playerProfile.isLoading} /></div> : null}
        </TabsContent>

        <TabsContent value="clubs" className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {(Array.isArray(teams.data?.teams) ? teams.data.teams : []).map((row: any) => {
              const team = row?.team || row;
              return <button type="button" key={team?.id} onClick={() => setSelectedTeamId(Number(team?.id))} className={`rounded-xl border p-3 text-center transition ${Number(team?.id) === selectedTeamId ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-black/20 hover:bg-white/5"}`}>{team?.logo ? <img src={team.logo} alt="" className="mx-auto h-12 w-12 object-contain" /> : null}<div className="mt-2 truncate text-sm font-bold">{team?.name}</div></button>;
            })}
          </div>
          {teams.isLoading ? <Skeleton className="h-48 w-full" /> : null}
          {selectedTeamId ? <TeamProfile data={teamProfile.data} loading={teamProfile.isLoading} /> : null}
        </TabsContent>

        <TabsContent value="players" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder={`Search ${selectedLeague.name} player — at least 4 characters`} /></div>
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
  const prediction = data.prediction?.predictions || data.prediction || null;
  const percent = prediction?.percent || {};
  const events = Array.isArray(data.events) ? data.events : [];
  const lineups = Array.isArray(data.lineups) ? data.lineups : [];
  const statistics = Array.isArray(data.statistics) ? data.statistics : [];
  const playerGroups = Array.isArray(data.players) ? data.players : [];
  const injuries = Array.isArray(data.injuries) ? data.injuries : [];
  const h2h = Array.isArray(data.headToHead) ? data.headToHead : [];
  const ratedPlayers = playerGroups.flatMap((group: any) => (Array.isArray(group?.players) ? group.players.map((item: any) => ({ ...item, team: group.team })) : [])).filter((item: any) => item?.player?.id).sort((a: any, b: any) => asNumber(b?.statistics?.[0]?.games?.rating) - asNumber(a?.statistics?.[0]?.games?.rating)).slice(0, 8);

  return (
    <Card className="space-y-5 overflow-hidden p-4 sm:p-5">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="text-center text-xs uppercase tracking-[.18em] text-muted-foreground">{fixture.round}</div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><div className="font-black">{fixture.homeTeam?.name}</div><div className="rounded-lg bg-black/30 px-4 py-2 text-2xl font-black">{fixture.homeTeam?.score ?? "-"} : {fixture.awayTeam?.score ?? "-"}</div><div className="font-black">{fixture.awayTeam?.name}</div></div>
        <div className="mt-2 text-center text-xs text-muted-foreground">{formatDate(fixture.kickoffTime)} · {fixture.venue?.name || "Venue TBD"} · {fixture.statusLong || fixture.status}</div>
      </div>

      {prediction ? <section><h4 className="mb-2 font-black">Statistical prediction</h4><div className="grid grid-cols-3 gap-2 text-center"><Metric label="Home" value={percent.home || "-"} /><Metric label="Draw" value={percent.draw || "-"} /><Metric label="Away" value={percent.away || "-"} /></div><p className="mt-2 text-sm text-muted-foreground">{prediction.advice || prediction?.winner?.comment || "Prediction available"}</p></section> : null}

      <section><h4 className="mb-2 font-black">Live / match statistics</h4>{statistics.length ? <div className="grid gap-3 md:grid-cols-2">{statistics.map((block: any) => <div key={block?.team?.id || block?.team?.name} className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="mb-2 font-bold">{block?.team?.name}</div><div className="grid grid-cols-2 gap-2 text-xs"><Metric label="Possession" value={statValue(block, "Ball Possession") ?? "-"} /><Metric label="Shots" value={statValue(block, "Total Shots") ?? "-"} /><Metric label="On target" value={statValue(block, "Shots on Goal") ?? "-"} /><Metric label="Corners" value={statValue(block, "Corner Kicks") ?? "-"} /><Metric label="Passes" value={statValue(block, "Total passes") ?? "-"} /><Metric label="Fouls" value={statValue(block, "Fouls") ?? "-"} /></div></div>)}</div> : <EmptyText text="Match statistics are not available yet for this fixture." />}</section>

      <section><h4 className="mb-2 font-black">Event timeline</h4>{events.length ? <div className="space-y-2">{events.map((event: any, index: number) => <div key={`${event?.time?.elapsed}-${event?.player?.id}-${index}`} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-2 text-sm"><Badge variant="outline">{event?.time?.elapsed ?? 0}'</Badge><div className="min-w-0 flex-1"><span className="font-semibold">{event?.player?.name || event?.team?.name}</span> <span className="text-muted-foreground">{event?.detail || event?.type}</span>{event?.assist?.name ? <span className="text-muted-foreground"> · assist {event.assist.name}</span> : null}</div></div>)}</div> : <EmptyText text="No match events available yet." />}</section>

      <section><h4 className="mb-2 font-black">Confirmed lineups</h4>{lineups.length ? <div className="grid gap-3 md:grid-cols-2">{lineups.map((lineup: any) => <div key={lineup?.team?.id} className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="font-bold">{lineup?.team?.name} · {lineup?.formation || "Formation TBD"}</div><div className="mt-2 text-xs text-muted-foreground">{(Array.isArray(lineup?.startXI) ? lineup.startXI : []).map((item: any) => item?.player?.name).filter(Boolean).join(" · ") || "Starting XI not published yet"}</div></div>)}</div> : <EmptyText text="Lineups usually appear close to kickoff." />}</section>

      <section><h4 className="mb-2 font-black">Player ratings</h4>{ratedPlayers.length ? <div className="grid gap-2 md:grid-cols-2">{ratedPlayers.map((row: any) => <TinyPlayer key={`${row.team?.id}-${row.player?.id}`} row={row} onClick={() => onPlayer(Number(row.player.id))} suffix={String(row?.statistics?.[0]?.games?.rating || "-")} />)}</div> : <EmptyText text="Player ratings will populate during or after the match." />}</section>

      <section className="grid gap-4 lg:grid-cols-2"><div><h4 className="mb-2 font-black">Match availability</h4>{injuries.length ? <div className="space-y-2">{injuries.slice(0, 12).map((row: any, index: number) => <div key={`${row?.player?.id}-${index}`} className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-400" /><span className="font-semibold">{row?.player?.name}</span><span className="text-muted-foreground">{row?.player?.type} · {row?.player?.reason}</span></div>)}</div> : <EmptyText text="No fixture-specific absences returned." />}</div><div><h4 className="mb-2 font-black">Recent head-to-head</h4>{h2h.length ? <div className="space-y-2">{h2h.map((row: any) => <div key={row.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"><span className="font-semibold">{row.homeTeam?.name} {row.homeTeam?.score ?? "-"} : {row.awayTeam?.score ?? "-"} {row.awayTeam?.name}</span><div className="text-muted-foreground">{formatDate(row.kickoffTime)}</div></div>)}</div> : <EmptyText text="No H2H history returned." />}</div></section>
    </Card>
  );
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

function TeamProfile({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-80 w-full" />;
  if (!data?.team) return null;
  const team = data.team?.team || data.team;
  const venue = data.team?.venue || null;
  const stats = data.statistics || {};
  const fixtures = stats?.fixtures || {};
  const goals = stats?.goals || {};
  const clean = stats?.clean_sheet || {};
  return <Card className="space-y-5 p-4 sm:p-5"><div className="flex items-center gap-4">{team?.logo ? <img src={team.logo} alt="" className="h-16 w-16 object-contain" /> : null}<div><h3 className="text-xl font-black">{team?.name}</h3><p className="text-sm text-muted-foreground">{venue?.name || "Venue TBD"}{venue?.city ? ` · ${venue.city}` : ""}</p></div></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="Played" value={fixtures?.played?.total ?? 0} /><Metric label="Wins" value={fixtures?.wins?.total ?? 0} /><Metric label="Goals" value={goals?.for?.total?.total ?? 0} /><Metric label="Clean sheets" value={clean?.total ?? 0} /></div><div><h4 className="mb-2 font-black">Coach</h4><div className="flex flex-wrap gap-2">{(Array.isArray(data.coaches) ? data.coaches : []).slice(0, 3).map((coach: any) => <Badge key={coach?.id} variant="outline">{coach?.name}</Badge>)}{!data.coaches?.length ? <span className="text-sm text-muted-foreground">Coach data not returned.</span> : null}</div></div><FixtureMini title="Recent results" rows={data.recent} /><FixtureMini title="Next fixtures" rows={data.upcoming} /></Card>;
}

function PlayerProfile({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Skeleton className="h-96 w-full" />;
  if (!data?.profile) return null;
  const player = data.profile?.player || {};
  const stat = data.leagueStatistics || data.profile?.statistics?.[0] || {};
  const games = stat?.games || {};
  const goals = stat?.goals || {};
  const cards = stat?.cards || {};
  return <Card className="space-y-5 p-4 sm:p-5"><div className="flex items-center gap-4">{player?.photo ? <img src={player.photo} alt="" className="h-20 w-20 rounded-full object-cover" /> : null}<div><h3 className="text-xl font-black">{player?.name}</h3><p className="text-sm text-muted-foreground">{player?.nationality || ""} · {stat?.team?.name || ""} · {games?.position || ""}</p></div></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6"><Metric label="Apps" value={games?.appearences ?? 0} /><Metric label="Minutes" value={games?.minutes ?? 0} /><Metric label="Rating" value={games?.rating ?? "-"} /><Metric label="Goals" value={goals?.total ?? 0} /><Metric label="Assists" value={goals?.assists ?? 0} /><Metric label="Cards" value={asNumber(cards?.yellow) + asNumber(cards?.red)} /></div><HistoryList title="Transfer history" rows={data.transfers} render={(row: any) => { const item = Array.isArray(row?.transfers) ? row.transfers[0] : row; return `${item?.date || ""} · ${item?.teams?.out?.name || "?"} → ${item?.teams?.in?.name || "?"} · ${item?.type || ""}`; }} /><HistoryList title="Trophy cabinet" rows={data.trophies} render={(row: any) => `${row?.league || row?.competition || "Competition"} · ${row?.season || ""} · ${row?.place || row?.result || ""}`} /><HistoryList title="Injury & suspension history" rows={data.sidelined} render={(row: any) => `${row?.type || "Unavailable"} · ${row?.start || ""} → ${row?.end || "ongoing"}`} /></Card>;
}

function Metric({ label, value }: { label: string; value: any }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-center"><div className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</div><div className="mt-1 font-black">{value ?? "-"}</div></div>;
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-muted-foreground">{text}</div>;
}

function FixtureMini({ title, rows }: { title: string; rows: any[] }) {
  return <div><h4 className="mb-2 font-black">{title}</h4><div className="grid gap-2 md:grid-cols-2">{(Array.isArray(rows) ? rows : []).map((row: any) => <div key={row.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"><div className="font-semibold">{row.homeTeam?.name} {row.homeTeam?.score ?? "-"} : {row.awayTeam?.score ?? "-"} {row.awayTeam?.name}</div><div className="text-muted-foreground">{formatDate(row.kickoffTime)}</div></div>)}</div></div>;
}

function HistoryList({ title, rows, render }: { title: string; rows: any[]; render: (row: any) => string }) {
  const list = Array.isArray(rows) ? rows : [];
  return <div><h4 className="mb-2 font-black">{title}</h4>{list.length ? <div className="space-y-2">{list.slice(0, 12).map((row: any, index: number) => <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm">{render(row)}</div>)}</div> : <EmptyText text={`No ${title.toLowerCase()} returned.`} />}</div>;
}

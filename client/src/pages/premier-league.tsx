import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { type EplPlayer, type EplFixture, type EplInjury, type EplStanding } from "../../../shared/schema";
import PlayerCard from "../components/PlayerCard";
import { eplPlayerToCard } from "../components/threeplayercards";
import {
  Trophy, Calendar, Users, AlertTriangle, Search, RefreshCw,
  Clock, CheckCircle, Activity,
} from "lucide-react";
import { useToast } from "../hooks/use-toast";

type CardRarity = "common" | "rare" | "unique" | "epic" | "legendary";

function assignRarity(player: EplPlayer): CardRarity {
  const rating = player.rating ? parseFloat(player.rating) : 0;
  const goals = player.goals ?? 0;
  const assists = player.assists ?? 0;
  const apps = player.appearances ?? 0;
  if (rating >= 7.5 || goals >= 15) return "legendary";
  if (rating >= 7.2 || goals >= 10 || (goals + assists) >= 15) return "epic";
  if (rating >= 7.0 || goals >= 5 || assists >= 8) return "unique";
  if (rating >= 6.8 || apps >= 15 || (goals + assists) >= 5) return "rare";
  return "common";
}

export default function PremierLeaguePage() {
  const { toast } = useToast();
  const [playerSearch, setPlayerSearch] = useState("");
  const [fixtureTab, setFixtureTab] = useState("upcoming");
  const [rarityFilter, setRarityFilter] = useState<CardRarity | "all">("all");

  const { data: standings, isLoading: standingsLoading } = useQuery<EplStanding[]>({
    queryKey: ["/api/epl/standings"],
  });

  const { data: fixtures, isLoading: fixturesLoading } = useQuery<EplFixture[]>({
    queryKey: ["/api/epl/fixtures", fixtureTab],
    queryFn: async () => {
      const res = await fetch(`/api/epl/fixtures?status=${fixtureTab}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch fixtures");
      return res.json();
    },
  });

  const { data: players, isLoading: playersLoading } = useQuery<EplPlayer[]>({
    queryKey: ["/api/epl/players", playerSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (playerSearch) params.set("search", playerSearch);
      const res = await fetch(`/api/epl/players?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch players");
      return res.json();
    },
  });

  const { data: injuries, isLoading: injuriesLoading } = useQuery<EplInjury[]>({
    queryKey: ["/api/epl/injuries"],
  });

  const filteredPlayers = useMemo(() => {
    if (!players) return [];
    if (rarityFilter === "all") return players;
    return players.filter(p => assignRarity(p) === rarityFilter);
  }, [players, rarityFilter]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/epl/sync", { type: "all" });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/epl/standings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/epl/fixtures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/epl/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/epl/injuries"] });
      toast({ title: data.message });
    },
    onError: (error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      NS: { label: "Upcoming", variant: "outline" },
      TBD: { label: "TBD", variant: "outline" },
      "1H": { label: "1st Half", variant: "destructive" },
      "2H": { label: "2nd Half", variant: "destructive" },
      HT: { label: "Half Time", variant: "secondary" },
      FT: { label: "Full Time", variant: "default" },
      AET: { label: "After ET", variant: "default" },
      PEN: { label: "Penalties", variant: "destructive" },
      PST: { label: "Postponed", variant: "secondary" },
      CANC: { label: "Cancelled", variant: "secondary" },
      LIVE: { label: "LIVE", variant: "destructive" },
    };
    const config = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const rarityButtons: { key: CardRarity | "all"; label: string; color: string }[] = [
    { key: "all", label: "All", color: "bg-white/10 hover:bg-white/20 text-white" },
    { key: "common", label: "Common", color: "bg-gradient-to-r from-zinc-500 to-zinc-400 hover:from-zinc-400 hover:to-zinc-300 text-white" },
    { key: "rare", label: "Rare", color: "bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 text-white" },
    { key: "unique", label: "Unique", color: "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white" },
    { key: "epic", label: "Epic", color: "bg-gradient-to-r from-gray-900 to-indigo-950 hover:from-gray-800 hover:to-indigo-900 text-white" },
    { key: "legendary", label: "Legendary", color: "bg-gradient-to-r from-amber-700 to-yellow-400 hover:from-amber-600 hover:to-yellow-300 text-black" },
  ];

  return (
    <div className="flex-1 overflow-auto relative">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-lg shadow-purple-900/30">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                Premier League
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Live stats, fixtures, injuries & player cards — 2024-25 Season
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-500/10"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing..." : "Refresh Data"}
            </Button>
          </div>

          <Tabs defaultValue="players" className="w-full">
            <TabsList className="mb-4 flex-wrap bg-background/50 backdrop-blur-sm border border-border/50">
              <TabsTrigger value="players" className="flex items-center gap-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                <Users className="w-4 h-4" /> Player Cards
              </TabsTrigger>
              <TabsTrigger value="standings" className="flex items-center gap-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                <Trophy className="w-4 h-4" /> Standings
              </TabsTrigger>
              <TabsTrigger value="fixtures" className="flex items-center gap-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                <Calendar className="w-4 h-4" /> Fixtures
              </TabsTrigger>
              <TabsTrigger value="injuries" className="flex items-center gap-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                <AlertTriangle className="w-4 h-4" /> Injuries
              </TabsTrigger>
            </TabsList>

            <TabsContent value="players">
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search players..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="pl-9 bg-background/50 backdrop-blur-sm border-border/50"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rarityButtons.map(({ key, label, color }) => (
                    <button
                      key={key}
                      onClick={() => setRarityFilter(key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${color} ${
                        rarityFilter === key ? "ring-2 ring-white/50 scale-105" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {playersLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-72 rounded-xl" />
                  ))}
                </div>
              ) : filteredPlayers.length > 0 ? (
                <div className="flex flex-wrap gap-8 justify-center sm:justify-start">
                  {filteredPlayers.map((player) => (
                    <PlayerCard
                      key={player.id}
                      card={eplPlayerToCard(player)}
                      size="md"
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center bg-background/50 backdrop-blur-sm border-border/50">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">
                    {playerSearch ? "No players match your search" : "No player data yet. Click \"Refresh Data\" to sync."}
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="standings">
              {standingsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
                </div>
              ) : standings && standings.length > 0 ? (
                <Card className="overflow-hidden bg-background/80 backdrop-blur-sm border-border/50">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-center">P</TableHead>
                          <TableHead className="text-center">W</TableHead>
                          <TableHead className="text-center">D</TableHead>
                          <TableHead className="text-center">L</TableHead>
                          <TableHead className="text-center">GF</TableHead>
                          <TableHead className="text-center">GA</TableHead>
                          <TableHead className="text-center">GD</TableHead>
                          <TableHead className="text-center font-bold">Pts</TableHead>
                          <TableHead className="hidden sm:table-cell">Form</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {standings.map((team) => (
                          <TableRow key={team.teamId} className={
                            team.rank <= 4 ? "border-l-2 border-l-blue-500" :
                            team.rank === 5 ? "border-l-2 border-l-orange-500" :
                            team.rank >= 18 ? "border-l-2 border-l-red-500" : ""
                          }>
                            <TableCell className="font-medium text-muted-foreground">{team.rank}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {team.teamLogo && (
                                  <img src={team.teamLogo} alt={team.teamName} className="w-6 h-6 object-contain" />
                                )}
                                <span className="font-medium text-sm">{team.teamName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">{team.played}</TableCell>
                            <TableCell className="text-center text-sm">{team.won}</TableCell>
                            <TableCell className="text-center text-sm">{team.drawn}</TableCell>
                            <TableCell className="text-center text-sm">{team.lost}</TableCell>
                            <TableCell className="text-center text-sm">{team.goalsFor}</TableCell>
                            <TableCell className="text-center text-sm">{team.goalsAgainst}</TableCell>
                            <TableCell className="text-center text-sm font-medium">
                              {team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}
                            </TableCell>
                            <TableCell className="text-center font-bold text-lg">{team.points}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="flex gap-0.5">
                                {team.form?.split("").map((f, i) => (
                                  <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                    f === "W" ? "bg-green-500" : f === "D" ? "bg-yellow-500" : "bg-red-500"
                                  }`}>
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-3 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-sm" /> Champions League</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded-sm" /> Europa League</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm" /> Relegation</div>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 text-center bg-background/50 backdrop-blur-sm">
                  <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No standings data yet. Click "Refresh Data" to sync.</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="fixtures">
              <div className="flex gap-2 mb-4">
                {[
                  { key: "upcoming", label: "Upcoming", icon: Clock },
                  { key: "live", label: "Live", icon: Activity },
                  { key: "finished", label: "Results", icon: CheckCircle },
                ].map(({ key, label, icon: Icon }) => (
                  <Button
                    key={key}
                    variant={fixtureTab === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFixtureTab(key)}
                    className={fixtureTab === key ? "bg-purple-600 hover:bg-purple-700" : ""}
                  >
                    <Icon className="w-4 h-4 mr-1" /> {label}
                  </Button>
                ))}
              </div>

              {fixturesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}
                </div>
              ) : fixtures && fixtures.length > 0 ? (
                <div className="space-y-2">
                  {fixtures.map((f) => (
                    <Card key={f.id} className="p-4 bg-background/80 backdrop-blur-sm border-border/50 hover:border-purple-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{f.round}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatDate(f.matchDate)}</span>
                          {getStatusBadge(f.status)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          {f.homeTeamLogo && <img src={f.homeTeamLogo} alt="" className="w-7 h-7 object-contain" />}
                          <span className="font-medium text-sm">{f.homeTeam}</span>
                        </div>
                        <div className="px-4 text-center min-w-[80px]">
                          {f.homeGoals !== null && f.awayGoals !== null ? (
                            <span className="text-xl font-bold">{f.homeGoals} - {f.awayGoals}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">vs</span>
                          )}
                          {f.elapsed && f.status !== "FT" && (
                            <p className="text-xs text-red-500 font-medium">{f.elapsed}'</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <span className="font-medium text-sm">{f.awayTeam}</span>
                          {f.awayTeamLogo && <img src={f.awayTeamLogo} alt="" className="w-7 h-7 object-contain" />}
                        </div>
                      </div>
                      {f.venue && (
                        <p className="text-xs text-muted-foreground mt-1 text-center">{f.venue}</p>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center bg-background/50 backdrop-blur-sm">
                  <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {fixtureTab === "live" ? "No live matches right now" : "No fixture data yet. Click \"Refresh Data\" to sync."}
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="injuries">
              {injuriesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}
                </div>
              ) : injuries && injuries.length > 0 ? (
                <Card className="overflow-hidden bg-background/80 backdrop-blur-sm border-border/50">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {injuries.map((inj) => (
                          <TableRow key={inj.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {inj.playerPhoto && (
                                  <img src={inj.playerPhoto} alt="" className="w-8 h-8 rounded-full object-cover" />
                                )}
                                <span className="font-medium text-sm">{inj.playerName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {inj.teamLogo && <img src={inj.teamLogo} alt="" className="w-5 h-5 object-contain" />}
                                <span className="text-sm">{inj.team}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-xs">{inj.type || "Unknown"}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{inj.reason || "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 text-center bg-background/50 backdrop-blur-sm">
                  <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No injury data yet. Click "Refresh Data" to sync.</p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

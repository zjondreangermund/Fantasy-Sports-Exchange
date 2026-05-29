import { useQuery } from "@tanstack/react-query";
import { Medal, Trophy, Users } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

type LeaderboardRow = {
  entryId: number;
  userId: string;
  teamName: string;
  totalScore: number;
  rank: number;
  behindLeader: number;
  isViewer?: boolean;
  prizePosition?: boolean;
};

type LeaderboardResponse = {
  competitionId: number;
  leaderboard: LeaderboardRow[];
  topThree: LeaderboardRow[];
  viewerEntry: LeaderboardRow | null;
  entryCount: number;
};

function points(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

export default function TournamentLeaderboardMini({ competitionId, compact = false }: { competitionId: number; compact?: boolean }) {
  const leaderboardQuery = useQuery<LeaderboardResponse>({
    queryKey: ["/api/competitions", competitionId, "leaderboard"],
    queryFn: async () => {
      const response = await fetch(`/api/competitions/${competitionId}/leaderboard`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      return response.json();
    },
    refetchInterval: 30000,
    enabled: Number.isInteger(competitionId) && competitionId > 0,
  });

  if (leaderboardQuery.isLoading) {
    return <Skeleton className={compact ? "h-20 rounded-xl" : "h-32 rounded-xl"} />;
  }

  if (leaderboardQuery.isError) {
    return <Card className="p-3 text-xs text-muted-foreground">Leaderboard unavailable.</Card>;
  }

  const data = leaderboardQuery.data;
  const topThree = Array.isArray(data?.topThree) ? data!.topThree : [];
  const viewer = data?.viewerEntry || null;

  if (!topThree.length) {
    return <Card className="p-3 text-xs text-muted-foreground">No entries yet. Be the first to enter.</Card>;
  }

  return (
    <Card className="space-y-3 border-yellow-500/20 bg-yellow-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <p className="text-sm font-bold">Leaderboard</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" />
          {Number(data?.entryCount || 0)} entries
        </Badge>
      </div>

      <div className="space-y-1.5">
        {topThree.map((row) => (
          <div key={row.entryId} className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-xs ${row.isViewer ? "border-primary bg-primary/10" : "border-border/60 bg-background/60"}`}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 font-black text-yellow-600">{row.rank}</span>
              <span className="truncate font-semibold">{row.teamName || "Manager"}</span>
              {row.rank === 1 && <Medal className="h-3.5 w-3.5 shrink-0 text-yellow-500" />}
            </div>
            <span className="font-black">{points(row.totalScore)} pts</span>
          </div>
        ))}
      </div>

      {viewer && !topThree.some((row) => row.entryId === viewer.entryId) && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold">Your rank: #{viewer.rank}</span>
            <span className="font-black">{points(viewer.totalScore)} pts</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Behind leader: {points(viewer.behindLeader)} pts</p>
        </div>
      )}
    </Card>
  );
}

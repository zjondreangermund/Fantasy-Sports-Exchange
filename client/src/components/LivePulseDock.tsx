import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Activity, Library, MessageCircle, ShoppingCart, Trophy } from "lucide-react";

type LiveHubPayload = {
  updatedAt: string;
  liveMatches: number;
  activeListings: number;
  liveCompetitions: number;
  pointFeed: Array<{ id: string; team: string; delta: number; reason: string }>;
  chatHighlights: Array<{ id: string; userName: string; text: string }>;
  recentSales: Array<{ id: number; amount: number; description: string }>;
};

export default function LivePulseDock() {
  const { data } = useQuery<LiveHubPayload>({
    queryKey: ["/api/live/hub"],
    refetchInterval: 15000,
  });

  const liveSummary = useMemo(() => {
    const feed = data?.pointFeed || [];
    const momentum = feed.reduce((sum, item) => sum + Number(item.delta || 0), 0);
    return {
      momentum,
      hasPositiveMomentum: momentum > 0,
      topReason: feed[feed.length - 1]?.reason || "No fresh match events yet",
    };
  }, [data?.pointFeed]);

  return (
    <div className="hidden border-b border-border/60 bg-background/70 px-3 py-2 backdrop-blur-xl md:block">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="gap-1">
          <Activity className="h-3 w-3 text-red-500" />
          {data?.liveMatches ?? 0} live matches
        </Badge>
        <Badge variant="outline" className="gap-1">
          <ShoppingCart className="h-3 w-3 text-emerald-500" />
          {data?.activeListings ?? 0} active listings
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Trophy className="h-3 w-3 text-violet-500" />
          {data?.liveCompetitions ?? 0} competitions open/live
        </Badge>
        <Badge className={liveSummary.hasPositiveMomentum ? "bg-emerald-600" : "bg-zinc-600"}>
          Momentum {liveSummary.hasPositiveMomentum ? "+" : ""}{liveSummary.momentum}
        </Badge>

        <div className="min-w-[220px] flex-1 truncate text-muted-foreground">
          {liveSummary.topReason}
          {data?.chatHighlights?.length ? ` • ${data.chatHighlights[data.chatHighlights.length - 1]?.userName}: ${data.chatHighlights[data.chatHighlights.length - 1]?.text}` : ""}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
          <Link href="/premier-league"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Live Leagues</Button></Link>
          <Link href="/competitions"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Tournaments</Button></Link>
          <Link href="/collection"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Library className="mr-1 h-3 w-3" />Collection</Button></Link>
          <Link href="/marketplace"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><ShoppingCart className="mr-1 h-3 w-3" />Marketplace</Button></Link>
        </div>

        <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <MessageCircle className="h-3 w-3" />
          Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "--"}
        </div>
      </div>
    </div>
  );
}

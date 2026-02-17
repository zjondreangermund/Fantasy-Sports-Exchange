import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
// Fixed: @/lib -> ../lib
import { apiRequest, queryClient } from "../lib/queryClient";
// Fixed: @/components -> ../components
import PlayerCard from "../components/PlayerCard";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
// Add this if you use the shared schema types:
// import { type PlayerCardWithPlayer } from "../../../shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { type PlayerCardWithPlayer, type Competition, type CompetitionEntry } from "../../../shared/schema";
import { Trophy, Users, Clock, DollarSign, Crown, Medal, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";
import RewardPopup from "../components/RewardPopup";

type EnrichedEntry = CompetitionEntry & { userName: string; userImage: string | null };
type CompetitionWithEntries = Competition & { entries: EnrichedEntry[]; entryCount: number };

export default function CompetitionsPage() {
  const { toast } = useToast();
  const [selectedComp, setSelectedComp] = useState<CompetitionWithEntries | null>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [showReward, setShowReward] = useState(false);

  const { data: competitions, isLoading } = useQuery<CompetitionWithEntries[]>({
    queryKey: ["/api/competitions"],
  });

  const { data: myCards } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/cards"],
  });

  const { data: rewards } = useQuery<any[]>({
    queryKey: ["/api/rewards"],
  });

  const joinMutation = useMutation({
    mutationFn: async (data: { competitionId: number; cardIds: number[]; captainId: number }) => {
      const res = await apiRequest("POST", "/api/competitions/join", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      setSelectedComp(null);
      setSelectedCards([]);
      setCaptainId(null);
      toast({ title: "Entered competition!" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleCard = (cardId: number) => {
    setSelectedCards(prev => {
      if (prev.includes(cardId)) {
        if (captainId === cardId) setCaptainId(null);
        return prev.filter(id => id !== cardId);
      }
      if (prev.length >= 5) return prev;
      return [...prev, cardId];
    });
  };

  const commonComps = competitions?.filter(c => c.tier === "common") || [];
  const rareComps = competitions?.filter(c => c.tier === "rare") || [];
  const availableCards = myCards?.filter(c => !c.forSale) || [];

  const unclaimedRewards = rewards?.filter(r => r.prizeAmount > 0 || r.prizeCard) || [];

  const selectedCardObjects = availableCards.filter(c => selectedCards.includes(c.id));
  const positionCounts: Record<string, number> = {};
  selectedCardObjects.forEach(c => {
    const pos = c.player?.position || "";
    positionCounts[pos] = (positionCounts[pos] || 0) + 1;
  });
  const hasGK = (positionCounts["GK"] || 0) >= 1;
  const hasDEF = (positionCounts["DEF"] || 0) >= 1;
  const hasMID = (positionCounts["MID"] || 0) >= 1;
  const hasFWD = (positionCounts["FWD"] || 0) >= 1;
  const lineupValid = selectedCards.length === 5 && hasGK && hasDEF && hasMID && hasFWD;
  const lineupError = selectedCards.length === 5 && !lineupValid
    ? "Lineup must have at least 1 GK, 1 DEF, 1 MID, and 1 FWD (5th card is utility)"
    : null;

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              Competitions
            </h1>
            <p className="text-muted-foreground text-sm">
              Enter weekly competitions and win prizes
            </p>
          </div>
          {unclaimedRewards.length > 0 && (
            <Button onClick={() => setShowReward(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black">
              <Medal className="w-4 h-4 mr-1" /> View Rewards ({unclaimedRewards.length})
            </Button>
          )}
        </div>

        <Tabs defaultValue="common" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="common">Common Tier (Free)</TabsTrigger>
            <TabsTrigger value="rare">Rare Tier (N$20)</TabsTrigger>
          </TabsList>

          <TabsContent value="common">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-md" />)}
              </div>
            ) : commonComps.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {commonComps.map(comp => (
                  <CompetitionCard key={comp.id} comp={comp} onJoin={() => { setSelectedComp(comp); setSelectedCards([]); setCaptainId(null); }} />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No common tier competitions available</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="rare">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-md" />)}
              </div>
            ) : rareComps.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rareComps.map(comp => (
                  <CompetitionCard key={comp.id} comp={comp} onJoin={() => { setSelectedComp(comp); setSelectedCards([]); setCaptainId(null); }} />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No rare tier competitions available</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedComp} onOpenChange={() => setSelectedComp(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Enter {selectedComp?.name}</DialogTitle>
          </DialogHeader>
          {selectedComp && (
            <div className="py-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedComp.entryFee > 0 && (
                  <Badge variant="outline" className="text-amber-500 border-amber-500">
                    Entry Fee: N${selectedComp.entryFee}
                  </Badge>
                )}
                <Badge variant="outline" className="text-green-500 border-green-500">
                  Prize: {selectedComp.prizeCardRarity?.charAt(0).toUpperCase()}{selectedComp.prizeCardRarity?.slice(1)} Card
                </Badge>
                {selectedComp.tier === "rare" && (
                  <Badge variant="outline" className="text-blue-400 border-blue-400">
                    + Prize Pool (60/30/10 split)
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-2">
                Select 5 cards for your lineup (1 GK, 1 DEF, 1 MID, 1 FWD + 1 Utility), then choose a captain for a 10% score bonus.
                {selectedCards.length}/5 selected.
              </p>
              {lineupError && (
                <p className="text-sm text-red-500 mb-2">{lineupError}</p>
              )}
              {selectedCards.length > 0 && selectedCards.length < 5 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {!hasGK && <Badge variant="outline" className="text-xs text-red-400 border-red-400">Need GK</Badge>}
                  {!hasDEF && <Badge variant="outline" className="text-xs text-red-400 border-red-400">Need DEF</Badge>}
                  {!hasMID && <Badge variant="outline" className="text-xs text-red-400 border-red-400">Need MID</Badge>}
                  {!hasFWD && <Badge variant="outline" className="text-xs text-red-400 border-red-400">Need FWD</Badge>}
                </div>
              )}

              <div className="flex flex-wrap gap-3 mb-4 max-h-80 overflow-auto">
                {availableCards.map(card => (
                  <div key={card.id} className="relative">
                    <PlayerCard
                      card={card}
                      size="sm"
                      selected={selectedCards.includes(card.id)}
                      selectable
                      onClick={() => toggleCard(card.id)}
                    />
                    {selectedCards.includes(card.id) && (
                      <button
                        className={`absolute -top-1 -left-1 z-30 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${captainId === card.id ? "bg-yellow-500 text-black" : "bg-muted text-muted-foreground hover:bg-yellow-500 hover:text-black"}`}
                        onClick={(e) => { e.stopPropagation(); setCaptainId(card.id); }}
                        title="Set as Captain"
                      >
                        C
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedComp(null)}>Cancel</Button>
            <Button
              onClick={() => selectedComp && captainId && joinMutation.mutate({
                competitionId: selectedComp.id,
                cardIds: selectedCards,
                captainId,
              })}
              disabled={!lineupValid || !captainId || joinMutation.isPending}
            >
              {joinMutation.isPending ? "Entering..." : selectedComp?.entryFee ? `Enter (N$${selectedComp.entryFee})` : "Enter Free"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showReward && unclaimedRewards.length > 0 && (
        <RewardPopup rewards={unclaimedRewards} onClose={() => setShowReward(false)} />
      )}
    </div>
  );
}

function Leaderboard({ entries }: { entries: EnrichedEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;

  const displayEntries = expanded ? entries : entries.slice(0, 5);
  const rankColors = ["text-yellow-500", "text-zinc-400", "text-amber-700"];

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors w-full"
      >
        <Trophy className="w-3 h-3" />
        Leaderboard ({entries.length})
        {entries.length > 5 && (
          expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />
        )}
      </button>
      <div className="space-y-1">
        {displayEntries.map((entry, idx) => (
          <div
            key={entry.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${
              idx === 0 ? "bg-yellow-500/10" : idx < 3 ? "bg-muted/50" : ""
            }`}
          >
            <span className={`font-bold w-5 text-center ${rankColors[idx] || "text-muted-foreground"}`}>
              {idx + 1}
            </span>
            {entry.userImage ? (
              <img
                src={entry.userImage}
                alt=""
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {entry.userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="flex-1 truncate font-medium text-foreground">
              {entry.userName}
            </span>
            <span className="font-mono font-bold text-foreground">
              {(entry.totalScore || 0).toFixed(1)}
            </span>
            {idx === 0 && <Crown className="w-3 h-3 text-yellow-500" />}
          </div>
        ))}
      </div>
      {!expanded && entries.length > 5 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-primary hover:underline mt-1 w-full text-center"
        >
          Show all {entries.length} entries
        </button>
      )}
    </div>
  );
}

function CompetitionCard({ comp, onJoin }: { comp: CompetitionWithEntries; onJoin: () => void }) {
  const endDate = new Date(comp.endDate);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <Card className="p-5 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg text-foreground">{comp.name}</h3>
          <p className="text-sm text-muted-foreground">Game Week {comp.gameWeek}</p>
        </div>
        <Badge variant={comp.status === "open" ? "default" : comp.status === "active" ? "secondary" : "outline"}>
          {comp.status === "open" ? "Open" : comp.status === "active" ? "Active" : "Completed"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="w-4 h-4 text-green-500" />
          <span className="text-muted-foreground">
            {comp.entryFee > 0 ? `N$${comp.entryFee} entry` : "Free entry"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-blue-500" />
          <span className="text-muted-foreground">{comp.entryCount} entries</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Crown className="w-4 h-4 text-yellow-500" />
          <span className="text-muted-foreground">
            Prize: {comp.prizeCardRarity?.charAt(0).toUpperCase()}{comp.prizeCardRarity?.slice(1)} Card
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-orange-500" />
          <span className="text-muted-foreground">{daysLeft} days left</span>
        </div>
      </div>

      {comp.tier === "rare" && comp.entryCount > 0 && (
        <div className="mb-4 p-2 bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground mb-1">Prize Pool: N${(comp.entryCount * comp.entryFee).toFixed(2)}</p>
          <div className="flex gap-2 text-xs">
            <span className="text-yellow-500">1st: 60%</span>
            <span className="text-zinc-400">2nd: 30%</span>
            <span className="text-amber-700">3rd: 10%</span>
          </div>
        </div>
      )}

      <Leaderboard entries={comp.entries} />

      <Button
        className="w-full mt-4"
        onClick={onJoin}
        disabled={comp.status !== "open"}
      >
        {comp.status === "open" ? (comp.entryFee > 0 ? `Enter (N$${comp.entryFee})` : "Enter Free") : "Closed"}
      </Button>
    </Card>
  );
}

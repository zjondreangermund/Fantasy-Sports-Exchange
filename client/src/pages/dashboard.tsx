import { useQuery } from "@tanstack/react-query";
// Fixed: @/hooks -> ../hooks
import { useAuth } from "../hooks/use-auth";
// Fixed: @/components -> ../components
import { AppSidebar } from "../components/app-sidebar"; 
import PlayerCard from "../components/threeplayercards";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
// Fixed: @shared -> ../../../shared
import { type PlayerCardWithPlayer, type Wallet, type Lineup } from "../../../shared/schema";
import { 
  Trophy, Wallet as WalletIcon, TrendingUp, Star, Package, 
  ArrowLeftRight, Swords, Shield, Zap, ChevronUp, Percent, DollarSign 
} from "lucide-react";
import { Link } from "wouter";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
  });

  const { data: lineup, isLoading: lineupLoading } = useQuery<{
    lineup: Lineup;
    cards: PlayerCardWithPlayer[];
  }>({
    queryKey: ["/api/lineup"],
  });

  const { data: cards, isLoading: cardsLoading } = useQuery<
    PlayerCardWithPlayer[]
  >({
    queryKey: ["/api/cards"],
  });

  const totalScore = lineup?.cards?.reduce((sum, c) => {
    const scores = c.last5Scores as number[];
    return sum + (scores?.[scores.length - 1] || 0);
  }, 0) || 0;

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-welcome">
              Welcome back, {user?.firstName || "Manager"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your squad and rise to the top
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-green-500/10 flex items-center justify-center">
                <WalletIcon className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                {walletLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p
                    className="text-xl font-bold text-foreground"
                    data-testid="text-balance"
                  >
                    ${wallet?.balance?.toFixed(2) || "0.00"}
                  </p>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cards Owned</p>
                {cardsLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <p
                    className="text-xl font-bold text-foreground"
                    data-testid="text-cards-count"
                  >
                    {cards?.length || 0}
                  </p>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-yellow-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Game Score</p>
                <p
                  className="text-xl font-bold text-foreground"
                  data-testid="text-score"
                >
                  {totalScore}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Your Lineup
            </h2>
            <Link href="/collection">
              <Button variant="outline" size="sm" data-testid="link-view-collection">
                View Collection
              </Button>
            </Link>
          </div>

          {lineupLoading ? (
            <div className="flex flex-wrap gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="w-48 h-72 rounded-md" />
              ))}
            </div>
          ) : lineup?.cards && lineup.cards.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {lineup.cards.map((card) => (
                <PlayerCard key={card.id} card={card} size="md" />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No lineup set yet. Visit your collection to set one up.
              </p>
            </Card>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/marketplace">
              <Card className="p-4 hover-elevate cursor-pointer">
                <h3 className="font-medium text-foreground mb-1">Marketplace</h3>
                <p className="text-sm text-muted-foreground">
                  Browse and buy rare cards from other managers
                </p>
              </Card>
            </Link>
            <Link href="/wallet">
              <Card className="p-4 hover-elevate cursor-pointer">
                <h3 className="font-medium text-foreground mb-1">Wallet</h3>
                <p className="text-sm text-muted-foreground">
                  Deposit funds and manage your balance
                </p>
              </Card>
            </Link>
            <Link href="/collection">
              <Card className="p-4 hover-elevate cursor-pointer">
                <h3 className="font-medium text-foreground mb-1">Collection</h3>
                <p className="text-sm text-muted-foreground">
                  View all your cards and manage your lineup
                </p>
              </Card>
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            How It Works
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Everything you need to know about collecting, competing, and climbing the ranks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">1. Open Starter Packs</h3>
              <p className="text-sm text-muted-foreground">
                Sign up and receive 5 position-based packs (GK, DEF, MID, FWD, Wildcards) with 15 common players total. Pick 1 from each pack to form your starting lineup of 5.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                <Swords className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">2. Build Your SO5 Lineup</h3>
              <p className="text-sm text-muted-foreground">
                Your lineup needs exactly 5 cards: 1 GK, 1 DEF, 1 MID, 1 FWD, and 1 Utility (any position). Choose a captain for a 10% score bonus.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                <Trophy className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">3. Compete Weekly</h3>
              <p className="text-sm text-muted-foreground">
                Enter Common tier competitions for free or Rare tier for N$20. Your players score based on real-world performance. Top 3 win prizes — 60/30/10 split of the prize pool plus bonus cards.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
                <ChevronUp className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">4. Level Up Cards</h3>
              <p className="text-sm text-muted-foreground">
                Cards earn XP from appearances, goals, assists, and minutes played. Every 1,000 XP levels up a card. Each level gives 5% more points than the previous — so a Level 3 card earns 10% bonus points.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mb-3">
                <ArrowLeftRight className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">5. Trade & Swap</h3>
              <p className="text-sm text-muted-foreground">
                Rare, Unique, Epic, and Legendary cards can be sold or swapped on the marketplace. You can also propose swap offers with optional cash top-ups. Common cards are free and untradable.
              </p>
            </Card>

            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-3">
                <Percent className="w-5 h-5 text-cyan-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">6. Card Rarities</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-zinc-400 mr-1 align-middle" /> Common (Silver) —
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500 mr-1 ml-2 align-middle" /> Rare (Red) —
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-purple-500 to-pink-500 mr-1 ml-2 align-middle" /> Unique (Rainbow) —
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-900 mr-1 ml-2 align-middle" /> Epic (Black) —
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 mr-1 ml-2 align-middle" /> Legendary (Gold). Higher rarity = higher base stats and more points per game.
              </p>
            </Card>
          </div>

          <Card className="p-4 mt-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm">8% Platform Fee</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  An 8% fee applies to all financial transactions including deposits, marketplace sales, and swap deals. This keeps the platform running and funds the prize pools.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

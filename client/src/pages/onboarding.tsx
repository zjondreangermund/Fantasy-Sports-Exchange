import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import PlayerCard from "../components/PlayerCard";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { Package, ChevronRight, ChevronLeft, Check, Sparkles, Shield, Swords, Target, Zap } from "lucide-react";
import confetti from "canvas-confetti";
import { Skeleton } from "../components/ui/skeleton";

type OnboardingStep = "packs" | "select" | "lineup";

const packIcons = [Shield, Shield, Swords, Target, Zap];
const packColors = [
  "from-green-600/30 to-green-900/50",
  "from-blue-600/30 to-blue-900/50",
  "from-purple-600/30 to-purple-900/50",
  "from-red-600/30 to-red-900/50",
  "from-amber-600/30 to-amber-900/50",
];
const defaultPackLabels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"];

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>("packs");
  const [currentPack, setCurrentPack] = useState(0);
  const [revealedPacks, setRevealedPacks] = useState<Set<number>>(new Set());
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [selectedFromPack, setSelectedFromPack] = useState<Map<number, number>>(new Map());
  const [dismissedPacks, setDismissedPacks] = useState<Set<number>>(new Set());

  const { data: onboardingData, isLoading } = useQuery<{
    packs: PlayerCardWithPlayer[][];
    packLabels?: string[];
    completed: boolean;
  }>({
    queryKey: ["/api/onboarding"],
  });

  const completeMutation = useMutation({
    mutationFn: async (cardIds: number[]) => {
      const res = await apiRequest("POST", "/api/onboarding/complete", { cardIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lineup"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
    },
  });

  const revealPack = (index: number) => {
    setRevealedPacks((prev) => new Set(prev).add(index));
    setCurrentPack(index);
  };

  const selectCardFromPack = (packIndex: number, cardId: number) => {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      const prevSelected = selectedFromPack.get(packIndex);
      if (prevSelected !== undefined) {
        next.delete(prevSelected);
      }
      next.add(cardId);
      return next;
    });
    setSelectedFromPack((prev) => {
      const next = new Map(prev);
      next.set(packIndex, cardId);
      return next;
    });

    setTimeout(() => {
      setDismissedPacks((prev) => new Set(prev).add(packIndex));
    }, 800);
  };

  const handleComplete = useCallback(() => {
    const ids = Array.from(selectedCards);
    completeMutation.mutate(ids, {
      onSuccess: () => {
        setStep("lineup");
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ["#8b5cf6", "#3b82f6", "#eab308", "#10b981"],
          });
          setTimeout(() => {
            confetti({
              particleCount: 100,
              spread: 120,
              origin: { y: 0.4, x: 0.3 },
              colors: ["#8b5cf6", "#3b82f6", "#eab308"],
            });
          }, 300);
          setTimeout(() => {
            confetti({
              particleCount: 100,
              spread: 120,
              origin: { y: 0.4, x: 0.7 },
              colors: ["#10b981", "#3b82f6", "#eab308"],
            });
          }, 600);
        }, 400);
      },
    });
  }, [selectedCards, completeMutation]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="w-64 h-8" />
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-36 h-52 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!onboardingData) return null;

  const packLabels = onboardingData.packLabels || defaultPackLabels;
  const allCards = onboardingData.packs.flat();

  if (step === "packs") {
    return (
      <div className="flex-1 flex flex-col items-center p-4 sm:p-8 overflow-y-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Welcome to FantasyFC
          </h1>
          <p className="text-muted-foreground">
            Open your 5 starter packs and pick 1 player from each
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  selectedFromPack.has(i)
                    ? "bg-primary scale-110"
                    : revealedPacks.has(i)
                    ? "bg-muted-foreground/50"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-6 w-full max-w-5xl">
          {onboardingData.packs.map((pack, i) => {
            const PackIcon = packIcons[i] || Zap;
            const isRevealed = revealedPacks.has(i);
            const isDismissed = dismissedPacks.has(i);
            const chosenCardId = selectedFromPack.get(i);
            const chosenCard = pack.find((c) => c.id === chosenCardId);

            if (isDismissed && chosenCard) {
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-500"
                >
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    {packLabels[i]}
                  </span>
                  <PlayerCard card={chosenCard} size="sm" selected />
                </div>
              );
            }

            if (isRevealed) {
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl bg-gradient-to-b ${packColors[i]} border border-white/10 transition-all duration-500 ${isDismissed ? "animate-out fade-out zoom-out" : "animate-in fade-in slide-in-from-bottom-4"}`}
                >
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                    <PackIcon className="w-3 h-3" />
                    {packLabels[i]}
                  </span>
                  <div className="flex gap-2">
                    {pack.map((card) => {
                      const isChosen = chosenCardId === card.id;
                      return (
                        <div
                          key={card.id}
                          className={`cursor-pointer transition-all duration-300 ${
                            chosenCardId !== undefined && !isChosen
                              ? "opacity-30 scale-90 pointer-events-none"
                              : "hover:scale-105"
                          } ${isChosen ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl" : ""}`}
                          onClick={() => !chosenCardId && selectCardFromPack(i, card.id)}
                        >
                          <PlayerCard card={card} size="sm" />
                        </div>
                      );
                    })}
                  </div>
                  {!chosenCardId && (
                    <p className="text-xs text-muted-foreground">Tap a card to pick it</p>
                  )}
                </div>
              );
            }

            return (
              <button
                key={i}
                onClick={() => revealPack(i)}
                className={`w-36 h-52 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-b ${packColors[i]} flex flex-col items-center justify-center gap-3 hover:scale-105 hover:border-primary/70 active:scale-95 transition-all duration-300`}
                data-testid={`button-open-pack-${i}`}
              >
                <Package className="w-10 h-10 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {packLabels[i]}
                </span>
                <span className="text-xs text-muted-foreground">3 Players</span>
              </button>
            );
          })}
        </div>

        {selectedFromPack.size === onboardingData.packs.length && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Button
              onClick={handleComplete}
              disabled={completeMutation.isPending}
              size="lg"
              className="text-lg px-8"
              data-testid="button-confirm-lineup"
            >
              {completeMutation.isPending ? (
                "Building your squad..."
              ) : (
                <>
                  Confirm Squad <Check className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="text-center mb-8">
        <Sparkles className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Your Squad is Ready!
        </h1>
        <p className="text-muted-foreground">
          Here's your starting lineup. Head to the marketplace to upgrade!
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {allCards
          .filter((c) => selectedCards.has(c.id))
          .map((card) => (
            <PlayerCard key={card.id} card={card} size="md" />
          ))}
      </div>

      <Button
        onClick={() => (window.location.href = "/")}
        size="lg"
        data-testid="button-go-to-dashboard"
      >
        Go to Dashboard <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

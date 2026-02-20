import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import PlayerCard from "../components/PlayerCard";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { Package, ChevronRight, Check, Sparkles, Shield, Swords, Zap } from "lucide-react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Skeleton } from "../components/ui/skeleton";

type OnboardingStep = "packs" | "select" | "done";

// ✅ 3 packs now
const packIcons = [Shield, Swords, Zap];
const packColors = [
  "from-green-600/30 to-green-900/50",
  "from-blue-600/30 to-blue-900/50",
  "from-purple-600/30 to-purple-900/50",
];
const defaultPackLabels = ["Pack 1", "Pack 2", "Pack 3"];

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>("packs");
  const [currentPack, setCurrentPack] = useState(0);
  const [revealedPacks, setRevealedPacks] = useState<Set<number>>(new Set());
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());

  // ✅ Ensure offer exists (safe even if dashboard already called it)
  useEffect(() => {
    apiRequest("POST", "/api/onboarding/create-offer", {}).catch(() => {});
  }, []);

  const { data: onboardingData, isLoading, refetch } = useQuery<{
    packCards: number[][];
    offeredPlayerIds: number[];
    players: any[]; // from /api/players/:id (your Player type)
    selectedCards: number[];
    completed: boolean;
  }>({
    queryKey: ["/api/onboarding/offers"],
  });

  // If query ran before create-offer finished, refetch once shortly after mount
  useEffect(() => {
    const t = setTimeout(() => refetch(), 400);
    return () => clearTimeout(t);
  }, [refetch]);

  // If onboarding already completed, move to done (avoid setState during render)
  useEffect(() => {
    if (onboardingData?.completed) setStep("done");
  }, [onboardingData?.completed]);

  // Turn players into "fake cards" so your existing <PlayerCard /> can render them
  const cardsByPlayerId = useMemo(() => {
    const map = new Map<number, PlayerCardWithPlayer>();
    const players = onboardingData?.players || [];

    for (const p of players) {
      map.set(
        p.id,
        ({
          id: p.id, // use playerId as temp id
          playerId: p.id,
          ownerId: null,
          rarity: "common",
          serialId: null,
          serialNumber: null,
          maxSupply: 0,
          level: 1,
          xp: 0,
          decisiveScore: 35,
          last5Scores: [0, 0, 0, 0, 0],
          forSale: false,
          price: 0,
          acquiredAt: new Date() as any,
          player: p,
        } as any) satisfies PlayerCardWithPlayer,
      );
    }

    return map;
  }, [onboardingData]);

  const packs: PlayerCardWithPlayer[][] = useMemo(() => {
    const packCards = onboardingData?.packCards || [];
    return packCards.map((pack) =>
      pack
        .map((playerId) => cardsByPlayerId.get(playerId))
        .filter(Boolean) as PlayerCardWithPlayer[],
    );
  }, [onboardingData, cardsByPlayerId]);

  const allOfferedCards: PlayerCardWithPlayer[] = useMemo(() => packs.flat(), [packs]);

  const chooseMutation = useMutation({
    mutationFn: async (playerIds: number[]) => {
      const res = await apiRequest("POST", "/api/onboarding/choose", {
        selectedPlayerIds: playerIds,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lineup"] });
    },
  });

  const revealPack = (index: number) => {
    setCurrentPack(index);

    setRevealedPacks((prev) => {
      const next = new Set(prev);
      next.add(index);

      // When all 3 packs revealed, move to selection step
      if (next.size >= 3) {
        setTimeout(() => setStep("select"), 500);
      }

      return next;
    });
  };

  const toggleSelect = (playerId: number) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
        return next;
      }
      if (next.size >= 5) return next; // max 5
      next.add(playerId);
      return next;
    });
  };

  const handleConfirm = useCallback(() => {
    const ids = Array.from(selectedPlayerIds);
    if (ids.length !== 5) return;

    chooseMutation.mutate(ids, {
      onSuccess: () => {
        setStep("done");
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
          });
        }, 300);
      },
    });
  }, [selectedPlayerIds, chooseMutation]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="w-64 h-8" />
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-36 h-52 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!onboardingData) return null;

  const packLabels = defaultPackLabels;

  if (step === "packs") {
    return (
      <div className="flex-1 flex flex-col items-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-5xl text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Welcome to FantasyFC
          </h1>
          <p className="text-muted-foreground">
            Open your 3 starter packs (9 players total), then choose your top 5.
          </p>

          <div className="flex items-center justify-center gap-2 mt-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  revealedPacks.has(i) ? "bg-primary scale-110" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-6 w-full max-w-5xl">
          {packs.map((pack, i) => {
            const PackIcon = packIcons[i] || Zap;
            const isRevealed = revealedPacks.has(i);

            if (isRevealed) {
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl bg-gradient-to-b ${packColors[i]} border border-white/10 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4`}
                >
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                    <PackIcon className="w-3 h-3" />
                    {packLabels[i]}
                  </span>
                  <div className="flex gap-2">
                    {pack.map((card) => (
                      <div key={card.id} className="transition-all duration-300">
                        <PlayerCard card={card} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <motion.button
                key={i}
                onClick={() => revealPack(i)}
                className={`w-36 h-52 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-b ${packColors[i]} flex flex-col items-center justify-center gap-3 hover:scale-105 hover:border-primary/70 active:scale-95 transition-all duration-300`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.06 }}
              >
                <Package className="w-10 h-10 text-primary" />
                <span className="text-sm font-bold text-foreground">{packLabels[i]}</span>
                <span className="text-xs text-muted-foreground">3 Players</span>
              </motion.button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">Open all packs to continue</p>
      </div>
    );
  }

  if (step === "select") {
    const selectedCount = selectedPlayerIds.size;

    return (
      <div className="flex-1 flex flex-col items-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-6xl text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Choose Your Top 5
          </h1>
          <p className="text-muted-foreground">Pick any 5 players from the 9 you opened.</p>
          <p className="text-sm mt-2">
            Selected: <span className="font-bold text-primary">{selectedCount}/5</span>
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-6 w-full max-w-6xl">
          {allOfferedCards.map((card) => {
            const isSelected = selectedPlayerIds.has(card.playerId);

            return (
              <div
                key={card.playerId}
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl scale-[1.02]"
                    : "hover:scale-[1.02]"
                }`}
                onClick={() => toggleSelect(card.playerId)}
              >
                <PlayerCard card={card} size="md" selected={isSelected as any} />
              </div>
            );
          })}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={selectedCount !== 5 || chooseMutation.isPending}
          size="lg"
          className="text-lg px-8"
        >
          {chooseMutation.isPending ? (
            "Building your squad..."
          ) : (
            <>
              Confirm Squad <Check className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    );
  }

  // done
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="text-center mb-8">
        <Sparkles className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Your Squad is Ready!
        </h1>
        <p className="text-muted-foreground">
          Your 5 starter cards have been added to your collection.
        </p>
      </div>

      <Button onClick={() => (window.location.href = "/")} size="lg">
        Go to Dashboard <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}
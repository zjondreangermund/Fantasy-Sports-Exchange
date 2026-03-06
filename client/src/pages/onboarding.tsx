import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import CardThumbnail from "../components/CardThumbnail";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { Package, ChevronRight, Check, Sparkles, Shield, Swords, Zap, Target, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "../components/ui/skeleton";
import { useLocation } from "wouter";

type OnboardingStep = "teamName" | "packs" | "select" | "done";

// ✅ 5 packs now
const packIcons = [Shield, Target, Swords, Zap, Flame];
const packColors = [
  "from-green-600/30 to-green-900/50",
  "from-blue-600/30 to-blue-900/50",
  "from-purple-600/30 to-purple-900/50",
  "from-yellow-600/30 to-yellow-900/50",
  "from-red-600/30 to-red-900/50",
];
const defaultPackLabels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"];

type OnboardingConfig = {
  signupPacksEnabled: boolean;
  requireTeamName: boolean;
  teamNameMinLength: number;
  onboardingEntryPath: string;
  starterChecklistLabel: string;
  packLabels: string[];
};

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<OnboardingStep>("teamName");
  const [teamName, setTeamName] = useState("");
  const [currentPack, setCurrentPack] = useState(0);
  const [revealedPacks, setRevealedPacks] = useState<Set<number>>(new Set());
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());

  const { data: onboardingConfig } = useQuery<OnboardingConfig>({
    queryKey: ["/api/onboarding/config"],
  });

  const resolvedTeamNameMinLength = Math.max(2, Number(onboardingConfig?.teamNameMinLength || 3));

  // ✅ Ensure offer exists (safe even if dashboard already called it)
  useEffect(() => {
    if (onboardingConfig?.signupPacksEnabled === false) return;
    apiRequest("POST", "/api/onboarding/create-offer", {}).catch(() => {});
  }, [onboardingConfig?.signupPacksEnabled]);

  const { data: onboardingData, isLoading, refetch } = useQuery<{
    packCards: number[][];
    offeredPlayerIds: number[];
    players: any[]; // from /api/players/:id (your Player type)
    selectedCards: number[];
    completed: boolean;
  }>({
    queryKey: ["/api/onboarding/offers"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/offers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch onboarding offers");
      return res.json();
    },
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

  useEffect(() => {
    if (onboardingConfig?.requireTeamName === false) {
      setStep((prev) => (prev === "teamName" ? "packs" : prev));
    }
  }, [onboardingConfig?.requireTeamName]);

  // Turn players into "fake cards" so CardThumbnail can render them
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

  const updateTeamNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("PATCH", "/api/user/profile", {
        managerTeamName: name,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  const createOfferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/create-offer", {});
      return res.json();
    },
  });

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

      // When all 5 packs revealed, move to selection step
      if (next.size >= 5) {
        setTimeout(() => setStep("select"), 500);
      }

      return next;
    });
  };

  const toggleSelect = (playerId: number, packIndex: number) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
        return next;
      }

      const selectedInPack = packs[packIndex]?.find((card) => next.has(card.playerId));
      if (selectedInPack) {
        next.delete(selectedInPack.playerId);
      }

      if (next.size >= packs.length) return next;
      next.add(playerId);
      return next;
    });
  };

  const handleConfirm = useCallback(() => {
    const ids = Array.from(selectedPlayerIds);
    if (ids.length !== 5) return;

    chooseMutation.mutate(ids, {
      onSuccess: () => {
        // Redirect to tunnel animation
        setLocation("/onboarding-tunnel");
      },
    });
  }, [selectedPlayerIds, chooseMutation, setLocation]);

  const handleContinueAfterTeamName = async () => {
    const trimmedName = teamName.trim();
    if (trimmedName.length < resolvedTeamNameMinLength) return;

    try {
      await updateTeamNameMutation.mutateAsync(trimmedName);
      await createOfferMutation.mutateAsync();
      await refetch();
      setStep("packs");
    } catch {
      // mutation-level toasts/errors already handled upstream
    }
  };

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

  if (onboardingConfig?.signupPacksEnabled === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="text-center max-w-md space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Starter packs are currently unavailable</h1>
          <p className="text-muted-foreground">An admin has temporarily disabled signup packs. You can continue to the dashboard.</p>
          <Button onClick={() => setLocation("/")}>Continue</Button>
        </div>
      </div>
    );
  }

  if (!onboardingData) return null;

  const packLabels =
    Array.isArray(onboardingConfig?.packLabels) && onboardingConfig.packLabels.length === 5
      ? onboardingConfig.packLabels
      : defaultPackLabels;

  if (step === "teamName") {
    if (onboardingConfig?.requireTeamName === false) {
      return null;
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center space-y-6"
        >
          <div className="space-y-2">
            <Sparkles className="w-12 h-12 text-primary mx-auto" />
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Welcome to FantasyFC!
            </h1>
            <p className="text-muted-foreground">
              Let's start by creating your manager team name
            </p>
          </div>

          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter your team name..."
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={30}
              className="text-center text-lg h-14"
              autoFocus
            />
            
            <Button
              onClick={handleContinueAfterTeamName}
              disabled={teamName.trim().length < resolvedTeamNameMinLength || updateTeamNameMutation.isPending || createOfferMutation.isPending}
              size="lg"
              className="w-full text-lg"
            >
              {updateTeamNameMutation.isPending || createOfferMutation.isPending ? (
                "Creating..."
              ) : (
                <>
                  Continue <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            
            {teamName.trim().length > 0 && teamName.trim().length < resolvedTeamNameMinLength && (
              <p className="text-sm text-destructive">
                Team name must be at least {resolvedTeamNameMinLength} characters
              </p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (step === "packs") {
    const packsReady = packs.length === 5 && packs.every((pack) => pack.length === 3);

    return (
      <div className="flex-1 flex flex-col items-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-5xl text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Welcome to FantasyFC
          </h1>
          <p className="text-muted-foreground">
            Open your 5 starter packs: 15 players total, then choose your top 5.
          </p>

          <div className="flex items-center justify-center gap-2 mt-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  revealedPacks.has(i) ? "bg-primary scale-110" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {!packsReady ? (
          <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-card/40 p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Preparing your position packs...</p>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await createOfferMutation.mutateAsync();
                } finally {
                  await refetch();
                }
              }}
              disabled={createOfferMutation.isPending}
            >
              {createOfferMutation.isPending ? "Loading..." : "Retry Load Packs"}
            </Button>
          </div>
        ) : (
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
                        <CardThumbnail card={card} size="sm" />
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
        )}

        <p className="text-xs text-muted-foreground">Open all packs to continue</p>
      </div>
    );
  }

  if (step === "select") {
    const selectedCount = selectedPlayerIds.size;
    const requiredSelections = packs.length;

    return (
      <div className="flex-1 flex flex-col items-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-6xl text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Choose Your Top 5
          </h1>
          <p className="text-muted-foreground">Pick 1 player from each row (3 options per position pack).</p>
          <p className="text-sm mt-2">
            Selected: <span className="font-bold text-primary">{selectedCount}/{requiredSelections}</span>
          </p>
        </div>

        <div className="flex flex-col gap-6 mb-6 w-full max-w-6xl">
          {packs.map((pack, packIndex) => {
            const PackIcon = packIcons[packIndex] || Zap;
            const hasSelectionInPack = pack.some((card) => selectedPlayerIds.has(card.playerId));

            return (
              <div key={packIndex} className="rounded-xl border border-white/10 bg-card/40 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PackIcon className="w-4 h-4 text-primary" />
                    <h3 className="text-sm sm:text-base font-semibold text-foreground">{packLabels[packIndex] || `Pack ${packIndex + 1}`}</h3>
                  </div>
                  <span className={`text-xs font-semibold ${hasSelectionInPack ? "text-primary" : "text-muted-foreground"}`}>
                    {hasSelectionInPack ? "1 selected" : "0 selected"}
                  </span>
                </div>

                <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                  {pack.map((card) => {
                    const isSelected = selectedPlayerIds.has(card.playerId);

                    return (
                      <div
                        key={card.playerId}
                        className={`cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl scale-[1.02]"
                            : "hover:scale-[1.02]"
                        }`}
                        onClick={() => toggleSelect(card.playerId, packIndex)}
                      >
                        <CardThumbnail card={card} size="md" selected={isSelected} selectable />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={selectedCount !== requiredSelections || chooseMutation.isPending}
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
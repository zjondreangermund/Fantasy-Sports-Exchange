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

const packIcons = [Shield, Target, Swords, Zap, Flame];
const packColors = [
  "from-green-600/30 to-green-900/50",
  "from-blue-600/30 to-blue-900/50",
  "from-purple-600/30 to-purple-900/50",
  "from-yellow-600/30 to-yellow-900/50",
  "from-red-600/30 to-red-900/50",
];
const defaultPackLabels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"];
const onboardingShell = "fixed inset-0 z-[200] flex min-h-[100dvh] w-full overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,.12),transparent_32%),linear-gradient(180deg,#050814,#02040d)] text-foreground backdrop-blur-2xl";

type OnboardingConfig = {
  signupPacksEnabled: boolean;
  requireTeamName: boolean;
  teamNameMinLength: number;
  onboardingEntryPath: string;
  starterChecklistLabel: string;
  packLabels: string[];
};

function readableTeamNameError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/TEAM_NAME_TAKEN|already registered|already in use/i.test(raw)) {
    return "That team name is already registered. Please choose another name.";
  }
  return "We could not save your team name. Please try again.";
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<OnboardingStep>("teamName");
  const [teamName, setTeamName] = useState("");
  const [teamNameError, setTeamNameError] = useState("");
  const [revealedPacks, setRevealedPacks] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]));
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());

  const { data: onboardingConfig } = useQuery<OnboardingConfig>({ queryKey: ["/api/onboarding/config"] });
  const resolvedTeamNameMinLength = Math.max(2, Number(onboardingConfig?.teamNameMinLength || 3));

  useEffect(() => {
    if (onboardingConfig?.signupPacksEnabled === false) return;
    apiRequest("POST", "/api/onboarding/create-offer", {}).catch(() => {});
  }, [onboardingConfig?.signupPacksEnabled]);

  const { data: onboardingData, isLoading, refetch } = useQuery<{
    packCards: number[][];
    offeredPlayerIds: number[];
    players: any[];
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

  useEffect(() => {
    const t = setTimeout(() => refetch(), 400);
    return () => clearTimeout(t);
  }, [refetch]);

  useEffect(() => {
    if (onboardingData?.completed) setStep("done");
  }, [onboardingData?.completed]);

  useEffect(() => {
    if (onboardingConfig?.requireTeamName === false) setStep((prev) => (prev === "teamName" ? "select" : prev));
  }, [onboardingConfig?.requireTeamName]);

  const cardsByPlayerId = useMemo(() => {
    const map = new Map<number, PlayerCardWithPlayer>();
    const players = onboardingData?.players || [];
    for (const p of players) {
      map.set(
        p.id,
        ({
          id: p.id,
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
    return packCards.map((pack) => pack.map((playerId) => cardsByPlayerId.get(playerId)).filter(Boolean) as PlayerCardWithPlayer[]);
  }, [onboardingData, cardsByPlayerId]);

  const updateTeamNameMutation = useMutation({
    mutationFn: async (name: string) => (await apiRequest("PATCH", "/api/user/profile", { managerTeamName: name })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
  });

  const createOfferMutation = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/onboarding/create-offer", {})).json() });

  const chooseMutation = useMutation({
    mutationFn: async (playerIds: number[]) => (await apiRequest("POST", "/api/onboarding/choose", { selectedPlayerIds: playerIds })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lineup"] });
    },
  });

  const revealPack = (index: number) => {
    setRevealedPacks((prev) => {
      const next = new Set(prev);
      next.add(index);
      if (next.size >= 5) setTimeout(() => setStep("select"), 250);
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
      if (selectedInPack) next.delete(selectedInPack.playerId);
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
        setStep("done");
        refetch();
      },
    });
  }, [selectedPlayerIds, chooseMutation, refetch]);

  const handleContinueAfterTeamName = async () => {
    const normalizedName = teamName.trim().replace(/\s+/g, " ");
    if (normalizedName.length < resolvedTeamNameMinLength) return;
    setTeamNameError("");
    try {
      await updateTeamNameMutation.mutateAsync(normalizedName);
      await createOfferMutation.mutateAsync();
      await refetch();
      setRevealedPacks(new Set([0, 1, 2, 3, 4]));
      setStep("select");
    } catch (error) {
      setTeamNameError(readableTeamNameError(error));
    }
  };

  if (isLoading) {
    return <div className={`${onboardingShell} items-center justify-center p-8`}><div className="flex flex-col items-center gap-4"><Skeleton className="h-8 w-64" /><div className="flex gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-52 w-36 rounded-md" />)}</div></div></div>;
  }

  if (onboardingConfig?.signupPacksEnabled === false) {
    return <div className={`${onboardingShell} flex-col items-center justify-center p-4 sm:p-8`}><div className="max-w-md space-y-3 text-center"><h1 className="text-2xl font-bold text-foreground sm:text-3xl">Starter packs are currently unavailable</h1><p className="text-muted-foreground">An admin has temporarily disabled signup packs. You can continue to the dashboard.</p><Button onClick={() => setLocation("/")}>Continue</Button></div></div>;
  }

  if (!onboardingData) return null;
  const packLabels = Array.isArray(onboardingConfig?.packLabels) && onboardingConfig.packLabels.length === 5 ? onboardingConfig.packLabels : defaultPackLabels;

  if (step === "teamName") {
    if (onboardingConfig?.requireTeamName === false) return null;
    return (
      <div className={`${onboardingShell} flex-col items-center justify-center p-4 sm:p-8`}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6 rounded-[2rem] border border-white/10 bg-black/45 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="space-y-2"><Sparkles className="mx-auto h-12 w-12 text-primary" /><h1 className="text-3xl font-bold text-foreground sm:text-4xl">Welcome to Fantasy Arena</h1><p className="text-muted-foreground">Create your unique manager team name, then choose 5 starter common cards.</p></div>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter your team name..."
              value={teamName}
              onChange={(event) => {
                setTeamName(event.target.value);
                if (teamNameError) setTeamNameError("");
              }}
              maxLength={30}
              className="h-14 text-center text-lg"
              aria-invalid={Boolean(teamNameError)}
              autoFocus
            />
            <Button onClick={handleContinueAfterTeamName} disabled={teamName.trim().length < resolvedTeamNameMinLength || Boolean(teamNameError) || updateTeamNameMutation.isPending || createOfferMutation.isPending} size="lg" className="w-full text-lg">{updateTeamNameMutation.isPending || createOfferMutation.isPending ? "Creating..." : <>Continue <ChevronRight className="ml-2 h-5 w-5" /></>}</Button>
            {teamNameError ? <p className="text-sm font-semibold text-destructive" role="alert">{teamNameError}</p> : null}
            {!teamNameError && teamName.trim().length > 0 && teamName.trim().length < resolvedTeamNameMinLength ? <p className="text-sm text-destructive">Team name must be at least {resolvedTeamNameMinLength} characters</p> : null}
            <p className="text-xs text-muted-foreground">Team names are unique and cannot be reused by another manager.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (step === "packs") {
    const packsReady = packs.length === 5 && packs.every((pack) => pack.length === 3);
    return (
      <div className={`${onboardingShell} flex-col items-center p-4 sm:p-8`}>
        <div className="mb-6 w-full max-w-5xl text-center"><h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">Starter Player Pool</h1><p className="text-muted-foreground">You can reveal packs or skip straight to choosing your 5 starter cards.</p></div>
        {!packsReady ? <div className="w-full max-w-2xl space-y-4 rounded-xl border border-white/10 bg-card/40 p-6 text-center"><p className="text-sm text-muted-foreground">Preparing your player choices...</p><Button variant="outline" onClick={async () => { try { await createOfferMutation.mutateAsync(); } finally { await refetch(); } }} disabled={createOfferMutation.isPending}>{createOfferMutation.isPending ? "Loading..." : "Retry Load Players"}</Button></div> : <><div className="mb-6 flex w-full max-w-5xl flex-wrap justify-center gap-4 sm:gap-6">{packs.map((pack, i) => { const PackIcon = packIcons[i] || Zap; const isRevealed = revealedPacks.has(i); return isRevealed ? <div key={i} className={`flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-b p-4 ${packColors[i]}`}><span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-foreground"><PackIcon className="h-3 w-3" />{packLabels[i]}</span><div className="flex gap-2">{pack.map((card) => <CardThumbnail key={card.id} card={card} size="sm" />)}</div></div> : <motion.button key={i} onClick={() => revealPack(i)} className={`flex h-52 w-36 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-b transition-all duration-300 hover:scale-105 hover:border-primary/70 active:scale-95 ${packColors[i]}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.06 }}><Package className="h-10 w-10 text-primary" /><span className="text-sm font-bold text-foreground">{packLabels[i]}</span><span className="text-xs text-muted-foreground">3 Players</span></motion.button>; })}</div><Button onClick={() => setStep("select")} size="lg">Choose Starter 5 <ChevronRight className="ml-2 h-5 w-5" /></Button></>}
      </div>
    );
  }

  if (step === "select") {
    const selectedCount = selectedPlayerIds.size;
    const requiredSelections = packs.length;
    return (
      <div className={`${onboardingShell} flex-col items-center p-4 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] sm:p-8`}>
        <div className="mb-6 w-full max-w-6xl text-center"><h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">Choose Your Starter 5</h1><p className="text-muted-foreground">Pick 1 player from each row. These 5 common cards are granted immediately after confirmation.</p><p className="mt-2 text-sm">Selected: <span className="font-bold text-primary">{selectedCount}/{requiredSelections}</span></p></div>
        <div className="mb-6 flex w-full max-w-6xl flex-col gap-6">{packs.map((pack, packIndex) => { const PackIcon = packIcons[packIndex] || Zap; const hasSelectionInPack = pack.some((card) => selectedPlayerIds.has(card.playerId)); return <div key={packIndex} className="rounded-xl border border-white/10 bg-card/40 p-4"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><PackIcon className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground sm:text-base">{packLabels[packIndex] || `Pack ${packIndex + 1}`}</h3></div><span className={`text-xs font-semibold ${hasSelectionInPack ? "text-primary" : "text-muted-foreground"}`}>{hasSelectionInPack ? "1 selected" : "0 selected"}</span></div><div className="flex flex-wrap justify-center gap-4 sm:justify-start">{pack.map((card) => { const isSelected = selectedPlayerIds.has(card.playerId); return <div key={card.playerId} className={`cursor-pointer transition-all duration-200 ${isSelected ? "scale-[1.02] rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-[1.02]"}`} onClick={() => toggleSelect(card.playerId, packIndex)}><CardThumbnail card={card} size="md" selected={isSelected} selectable /></div>; })}</div></div>; })}</div>
        <Button onClick={handleConfirm} disabled={selectedCount !== requiredSelections || chooseMutation.isPending} size="lg" className="mb-10 px-8 text-lg">{chooseMutation.isPending ? "Adding your 5 cards..." : <>Confirm Starter 5 <Check className="ml-2 h-5 w-5" /></>}</Button>
      </div>
    );
  }

  return <div className={`${onboardingShell} flex-col items-center justify-center p-4 sm:p-8`}><div className="mb-8 text-center"><Sparkles className="mx-auto mb-3 h-10 w-10 text-yellow-400" /><h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">Your Squad is Ready!</h1><p className="text-muted-foreground">Your 5 starter common cards have been added to your collection.</p></div><div className="flex flex-wrap items-center justify-center gap-3"><Button onClick={() => setLocation("/collection")} size="lg">View Collection <ChevronRight className="ml-1 h-4 w-4" /></Button><Button variant="outline" onClick={() => setLocation("/")} size="lg">Go to Dashboard</Button></div></div>;
}

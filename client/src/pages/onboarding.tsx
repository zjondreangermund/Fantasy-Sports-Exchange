import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import CardThumbnail from "../components/CardThumbnail";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { Package, ChevronRight, Check, Sparkles, Shield, Swords, Zap, Target, Flame, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "../components/ui/skeleton";
import { useLocation } from "wouter";
import { clearPostSignupTarget, getPostSignupTarget } from "../lib/gw4-promo";
import { useAuth } from "../hooks/use-auth";

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
// STARTER_DRAFT_MOBILE_RENDERING_V1: stable native-size cards and explicit incomplete-selection CTA on mobile.
// STARTER_DRAFT_PLAYER_DETAILS_V2: card artwork owns the player name; the label below shows current club and canonical position.
const onboardingShell = "fixed inset-0 z-[200] flex h-[100dvh] w-full overflow-y-auto overscroll-y-contain touch-pan-y bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,.12),transparent_32%),linear-gradient(180deg,#050814,#02040d)] text-foreground backdrop-blur-2xl [-webkit-overflow-scrolling:touch]";

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
  // NATIVE_LOGOUT_SIGNUP_POLISH_V1: conversion-critical signup stays branded, centered and recoverable on every phone.
  const [, setLocation] = useLocation();
  const { logout, isLoggingOut } = useAuth();
  const [step, setStep] = useState<OnboardingStep>("teamName");
  const [teamName, setTeamName] = useState("");
  const [teamNameError, setTeamNameError] = useState("");
  const [offerError, setOfferError] = useState("");
  const teamNameInputRef = useRef<HTMLInputElement>(null);
  const [revealedPacks, setRevealedPacks] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]));
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  // STARTER_CONFIRM_SINGLE_TAP_V1: lock the first valid tap immediately so slow mobile/network responses never encourage repeat taps.
  const [confirmStatus, setConfirmStatus] = useState<"idle" | "submitting" | "error">("idle");
  const confirmInFlightRef = useRef(false);

  const { data: onboardingConfig } = useQuery<OnboardingConfig>({ queryKey: ["/api/onboarding/config"] });
  const resolvedTeamNameMinLength = Math.max(2, Number(onboardingConfig?.teamNameMinLength || 3));

  const { data: onboardingData, isLoading, isError: offersFailed, refetch } = useQuery<{
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
    // SIGNUP_INPUT_RELIABILITY_V1: do not make a new manager wait on player-pack
    // network/database work before the team-name input can even render.
    enabled: onboardingConfig?.requireTeamName === false || step !== "teamName",
    retry: 1,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

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

  const packsReady = packs.length === 5 && packs.every((pack) => pack.length === 3);

  useEffect(() => {
    if (step === "packs" && packsReady) {
      setOfferError("");
      setStep("select");
    }
  }, [step, packsReady]);

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
    if (confirmInFlightRef.current || chooseMutation.isPending) return;
    const ids = Array.from(selectedPlayerIds);
    if (ids.length !== 5) return;

    confirmInFlightRef.current = true;
    setConfirmStatus("submitting");

    chooseMutation.mutate(ids, {
      onSuccess: () => {
        setStep("done");
        refetch();
        const target = getPostSignupTarget();
        if (target) {
          queryClient.setQueryData(["/api/onboarding/status"], { completed: true });
          window.setTimeout(() => {
            clearPostSignupTarget();
            setLocation(target);
          }, 250);
        }
      },
      onError: async (error) => {
        try {
          const refreshed = await refetch();
          if (refreshed.data?.completed) {
            setStep("done");
            return;
          }
        } catch {}
        console.error("Starter Draft confirmation failed:", error);
        confirmInFlightRef.current = false;
        setConfirmStatus("error");
      },
    });
  }, [selectedPlayerIds, chooseMutation, refetch, setLocation]);

  const handleContinueAfterTeamName = async () => {
    const normalizedName = teamName.trim().replace(/\s+/g, " ");
    if (normalizedName.length < resolvedTeamNameMinLength || updateTeamNameMutation.isPending) return;
    setTeamNameError("");
    setOfferError("");
    try {
      // Save the lightweight club-name step first, then move off the input
      // immediately. Starter packs load on the dedicated preparation screen.
      await updateTeamNameMutation.mutateAsync(normalizedName);
      setRevealedPacks(new Set([0, 1, 2, 3, 4]));
      setStep("packs");
    } catch (error) {
      setTeamNameError(readableTeamNameError(error));
      window.setTimeout(() => teamNameInputRef.current?.focus({ preventScroll: true }), 0);
    }
  };

  const retryStarterOffer = async () => {
    setOfferError("");
    try {
      await createOfferMutation.mutateAsync();
      const refreshed = await refetch();
      if (!refreshed.data?.packCards?.length) {
        setOfferError("We could not load your starter players yet. Please tap retry.");
      }
    } catch {
      setOfferError("We could not load your starter players yet. Please tap retry.");
    }
  };

  if (onboardingConfig?.signupPacksEnabled === false) {
    return <div className={`${onboardingShell} flex-col items-center justify-center p-4 sm:p-8`}><div className="max-w-md space-y-3 text-center"><h1 className="text-2xl font-bold text-foreground sm:text-3xl">Starter packs are currently unavailable</h1><p className="text-muted-foreground">An admin has temporarily disabled signup packs. You can continue to the dashboard.</p><Button onClick={() => setLocation("/")}>Continue</Button></div></div>;
  }

  const packLabels = Array.isArray(onboardingConfig?.packLabels) && onboardingConfig.packLabels.length === 5 ? onboardingConfig.packLabels : defaultPackLabels;

  if (step === "teamName") {
    if (onboardingConfig?.requireTeamName === false) return null;
    return (
      <div data-onboarding-team-name className={`${onboardingShell} flex-col items-center justify-start px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] sm:justify-center sm:p-8`}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="my-auto w-full max-w-md space-y-6 rounded-[2rem] border border-fuchsia-300/15 bg-[#070914]/88 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,.55),0_0_48px_rgba(168,85,247,.08)] backdrop-blur-xl sm:p-8">
          <div className="flex items-center justify-between gap-3 text-left">
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="/brand/fantasy-arena-logo.jpg" alt="Fantasy Arena" className="h-11 w-11 shrink-0 rounded-2xl border border-fuchsia-300/20 object-cover shadow-[0_0_20px_rgba(168,85,247,.16)]" />
              <div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-200/80">Fantasy Arena</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-cyan-200/50">Free starter setup · Step 1 of 2</p></div>
            </div>
            <button type="button" onClick={() => logout()} disabled={isLoggingOut} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.035] px-2.5 text-[10px] font-bold text-white/55" aria-label="Sign out"><LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sign out</span></button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[.055]"><div className="h-full w-1/2 rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300" /></div>
          <div className="space-y-2"><Sparkles className="mx-auto h-10 w-10 text-cyan-200" /><h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Create Your Club</h1><p className="text-sm leading-6 text-white/50">Choose your unique club name. Next, pick 5 <strong className="text-white/80">FREE Common starter cards</strong> — one from each position group.</p><div className="flex flex-wrap justify-center gap-1.5 pt-1"><span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.06] px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-emerald-200">No payment</span><span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.06] px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-cyan-100">5 free cards</span><span className="rounded-full border border-fuchsia-300/15 bg-fuchsia-300/[.06] px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-fuchsia-100">Premier League</span></div></div>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleContinueAfterTeamName();
            }}
          >
            <label htmlFor="manager-team-name" className="block text-xs font-black uppercase tracking-[0.14em] text-white/60">Club name</label>
            <Input
              ref={teamNameInputRef}
              id="manager-team-name"
              name="managerTeamName"
              type="text"
              inputMode="text"
              enterKeyHint="next"
              autoComplete="organization"
              autoCapitalize="words"
              spellCheck={false}
              placeholder="Tap here and enter your club name..."
              value={teamName}
              onChange={(event) => {
                setTeamName(event.target.value);
                if (teamNameError) setTeamNameError("");
              }}
              onPointerDown={(event) => {
                // Focus is triggered by the user's actual tap. This is much more
                // reliable for Android WebView/iOS keyboards than programmatic mount focus.
                if (document.activeElement !== event.currentTarget) {
                  event.currentTarget.focus({ preventScroll: true });
                }
              }}
              onFocus={(event) => {
                const input = event.currentTarget;
                window.setTimeout(() => {
                  if (input.isConnected) input.scrollIntoView({ block: "center", inline: "nearest" });
                }, 120);
              }}
              maxLength={30}
              className="h-14 touch-manipulation select-text text-center text-lg"
              aria-invalid={Boolean(teamNameError)}
              aria-describedby={teamNameError ? "manager-team-name-error" : undefined}
            />
            <Button type="submit" disabled={teamName.trim().length < resolvedTeamNameMinLength || Boolean(teamNameError) || updateTeamNameMutation.isPending} size="lg" className="w-full text-lg">{updateTeamNameMutation.isPending ? "Saving club..." : <>Continue <ChevronRight className="ml-2 h-5 w-5" /></>}</Button>
            {teamNameError ? <p id="manager-team-name-error" className="text-sm font-semibold text-destructive" role="alert">{teamNameError}</p> : null}
            {!teamNameError && teamName.trim().length > 0 && teamName.trim().length < resolvedTeamNameMinLength ? <p className="text-sm text-destructive">Team name must be at least {resolvedTeamNameMinLength} characters</p> : null}
            <p className="text-xs text-muted-foreground">Team names are unique and cannot be reused by another manager.</p>
          </form>
        </motion.div>
      </div>
    );
  }

  if (step === "packs") {
    return (
      <div className={`${onboardingShell} flex-col items-center justify-center p-4 sm:p-8`}>
        <div className="w-full max-w-md space-y-5 rounded-[2rem] border border-cyan-300/15 bg-[#070914]/90 p-6 text-center shadow-2xl backdrop-blur-xl">
          <Sparkles className="mx-auto h-10 w-10 text-cyan-300" />
          <div><h1 className="text-2xl font-black text-white">Preparing Your FREE Starter Cards</h1><p className="mt-2 text-sm leading-6 text-white/55">Your club name is saved. We are loading 15 current Premier League players for your Starter Draft.</p></div>
          {!offersFailed && !offerError && (isLoading || !onboardingData || packsReady) ? <div className="space-y-3"><Skeleton className="mx-auto h-3 w-3/4" /><Skeleton className="mx-auto h-3 w-1/2" /><p className="text-xs text-white/40">This should only take a moment.</p></div> : <div className="space-y-3"><p className="text-sm font-semibold text-amber-200">{offerError || "The player list did not load completely on the first try."}</p><Button type="button" onClick={() => void retryStarterOffer()} disabled={createOfferMutation.isPending} className="w-full">{createOfferMutation.isPending ? "Retrying..." : "Retry Starter Players"}</Button></div>}
        </div>
      </div>
    );
  }

  if (isLoading || !onboardingData) {
    return <div className={`${onboardingShell} items-center justify-center p-8`}><div className="flex flex-col items-center gap-4"><Skeleton className="h-8 w-64" /><div className="flex max-w-full flex-wrap justify-center gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-52 w-36 rounded-md" />)}</div></div></div>;
  }

  if (step === "select") {
    const selectedCount = selectedPlayerIds.size;
    const requiredSelections = packs.length;
    const remaining = Math.max(0, requiredSelections - selectedCount);

    return (
      <div className={`${onboardingShell} flex-col items-center`} data-onboarding-scroll-root>
        <header className="sticky top-0 z-40 w-full shrink-0 border-b border-white/10 bg-[#030611]/94 px-3 py-3 shadow-[0_10px_35px_rgba(0,0,0,.32)] backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/80"><Sparkles className="h-3 w-3" />Starter Draft · Step 2 of 2</div>
              <h1 className="mt-0.5 truncate text-lg font-black text-white sm:text-2xl">Choose Your Starter 5</h1>
              <p className="mt-0.5 text-[11px] text-white/45 sm:text-xs">Pick one card from each group.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-center">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/45">Selected</div>
                <div className="text-xl font-black leading-none text-cyan-200">{selectedCount}<span className="text-sm text-white/35">/{requiredSelections}</span></div>
              </div>
              <button type="button" onClick={() => logout()} disabled={isLoggingOut} className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[.035] text-white/50" aria-label="Sign out of signup"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </header>

        <main className="w-full max-w-5xl px-2.5 pb-5 pt-3 sm:px-5 sm:pt-5">
          <div className="space-y-3 sm:space-y-4">
            {packs.map((pack, packIndex) => {
              const PackIcon = packIcons[packIndex] || Zap;
              const hasSelectionInPack = pack.some((card) => selectedPlayerIds.has(card.playerId));

              return (
                <section key={packIndex} className={`overflow-hidden rounded-[1.25rem] border bg-white/[0.035] shadow-[0_14px_38px_rgba(0,0,0,.2)] ${hasSelectionInPack ? "border-cyan-300/35" : "border-white/10"}`}>
                  <div className="flex items-center justify-between gap-2 border-b border-white/8 bg-black/20 px-3 py-2.5 sm:px-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${hasSelectionInPack ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-white/60"}`}><PackIcon className="h-4 w-4" /></span>
                      <div className="min-w-0"><h2 className="truncate text-sm font-black text-white sm:text-base">{packLabels[packIndex] || `Pack ${packIndex + 1}`}</h2><p className="text-[10px] text-white/40">Choose 1 of these 3 cards</p></div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${hasSelectionInPack ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/35"}`}>{hasSelectionInPack ? "Picked" : "1 required"}</span>
                  </div>

                  <div className="mx-auto grid w-full max-w-[330px] grid-cols-2 min-[360px]:grid-cols-3 items-start justify-items-center gap-1 px-1 py-2 sm:max-w-[390px] sm:gap-3 sm:px-3 sm:py-3">
                    {pack.map((card, cardIndex) => {
                      const isSelected = selectedPlayerIds.has(card.playerId);
                      return (
                        <button
                          type="button"
                          key={card.playerId}
                          onClick={() => toggleSelect(card.playerId, packIndex)}
                          aria-pressed={isSelected}
                          aria-label={`Select ${card.player?.name || `card ${cardIndex + 1}`} for ${packLabels[packIndex] || `pack ${packIndex + 1}`}`}
                          className={`relative flex h-auto min-h-0 min-w-0 self-start flex-col items-center justify-start overflow-visible rounded-xl border px-0.5 pb-2 pt-1.5 text-center outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-cyan-300 ${isSelected ? "border-cyan-300/65 bg-cyan-300/[0.11] shadow-[0_0_18px_rgba(34,211,238,.14)]" : "border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"}`}
                        >
                          <span className="absolute left-1 top-1 z-20 grid h-5 w-5 place-items-center rounded-full border border-white/15 bg-slate-950/90 text-[9px] font-black text-white/65">{cardIndex + 1}</span>
                          {isSelected ? <span className="absolute right-1 top-1 z-20 grid h-6 w-6 place-items-center rounded-full bg-cyan-300 text-slate-950 shadow-lg"><Check className="h-3.5 w-3.5" /></span> : null}
                          <CardThumbnail card={card} size="xs" selected={isSelected} selectable showStats={false} showMeta={false} />
                          <div className="mt-1.5 flex min-h-[48px] w-full flex-col items-center justify-start px-1 text-center">
                            <span title={String(card.player?.team || "Premier League")} className="block max-h-[24px] w-full overflow-hidden text-center text-[9px] font-black uppercase leading-3 text-white/90 sm:text-[10px]">{card.player?.team || "Premier League"}</span>
                            <span className="mt-1 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-cyan-100 sm:text-[9px]">{String(card.player?.position || "N/A").toUpperCase()}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </main>

        <div className="relative z-30 w-full shrink-0 border-t border-white/10 bg-[#030611]/96 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom,0px))] pt-2.5 shadow-[0_-12px_36px_rgba(0,0,0,.30)] backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-white">{remaining === 0 ? "Starter 5 ready" : `${remaining} pick${remaining === 1 ? "" : "s"} left`}</div>
              <div className="hidden text-[10px] text-white/40 sm:block">Your permanent serials are assigned only after confirmation.</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button onClick={handleConfirm} disabled={selectedCount !== requiredSelections || chooseMutation.isPending || confirmStatus === "submitting"} aria-busy={confirmStatus === "submitting"} size="lg" className="h-11 min-w-[138px] shrink-0 touch-manipulation rounded-xl border border-cyan-200/30 bg-cyan-300 px-4 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-white/35 disabled:opacity-100 sm:min-w-[240px] sm:text-base">{confirmStatus === "submitting" || chooseMutation.isPending ? <><span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />Minting your 5...</> : selectedCount !== requiredSelections ? <>Select {remaining} more</> : <>Confirm & Mint <Check className="ml-1.5 h-4 w-4" /></>}</Button>
              {confirmStatus === "submitting" ? <span role="status" aria-live="polite" className="text-[10px] font-semibold text-cyan-100/80">Securing your cards — one tap is enough.</span> : null}
              {confirmStatus === "error" ? <span role="alert" className="max-w-[240px] text-right text-[10px] font-semibold text-rose-300">Couldn’t finish the mint. Tap Confirm & Mint once to retry.</span> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div className={`${onboardingShell} flex-col items-center justify-center p-4 sm:p-8`}><div className="mb-8 text-center"><Sparkles className="mx-auto mb-3 h-10 w-10 text-yellow-400" /><h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">Your Squad is Ready!</h1><p className="text-muted-foreground">Your 5 starter common cards have been added to your collection.</p></div><div className="flex flex-wrap items-center justify-center gap-3"><Button onClick={() => setLocation("/collection")} size="lg">View Collection <ChevronRight className="ml-1 h-4 w-4" /></Button><Button variant="outline" onClick={() => setLocation("/")} size="lg">Go to Dashboard</Button></div></div>;
}

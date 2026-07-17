import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, Flame, ShieldCheck, Coins } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { useToast } from "../hooks/use-toast";
import Metal3DCard from "../components/Metal3DCard";
import FantasyCardFan from "../components/FantasyCardFan";
import { fetchLocalPlayerRoster } from "../lib/local-player-roster";

type ForgeOption = {
  playerId: number;
  playerName: string;
  team: string;
  duplicatesOwned: number;
  required: number;
  fee: number;
  cardIds: number[];
  targetRarity: string;
  player?: any;
};

type ForgeResponse = {
  success: boolean;
  mintedRarity: string;
  fee: number;
  playerId: number;
  mintedCardId: number;
};

type ForgeOptionsResponse = {
  options: ForgeOption[];
  rules: {
    samePlayerRequired: boolean;
    burnCount: number;
    fee: number;
    fromRarity: string;
    toRarity: string;
  };
};

export default function CardLabPage() {
  const { toast } = useToast();
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);

  const { data: showcaseCards = [] } = useQuery({
    queryKey: ["local-roster-cards"],
    queryFn: () => fetchLocalPlayerRoster(),
  });

  const { data: forgeData, isLoading, error } = useQuery<ForgeOptionsResponse>({
    queryKey: ["/api/forge/options"],
    queryFn: async () => {
      const res = await fetch("/api/forge/options", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load forge options");
      return res.json();
    },
  });

  const forgeMutation = useMutation<ForgeResponse, Error, ForgeOption>({
    mutationFn: async (option) => {
      const res = await apiRequest("POST", "/api/forge/burn-same-player", { cardIds: option.cardIds });
      return res.json();
    },
    onSuccess: (data, option) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forge/options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/retention/summary"] });
      toast({
        title: "Forge complete",
        description: `${option.playerName} upgraded to ${String(data.mintedRarity || "rare").toUpperCase()} for N$${Number(data.fee || option.fee || 0).toFixed(2)}.`,
      });
      setActivePlayerId(Number(option.playerId));
    },
    onError: (error) => {
      toast({ title: "Forge failed", description: error.message, variant: "destructive" });
    },
  });

  const order = ["common", "rare", "unique", "epic", "legendary"];
  const groupedShowcase = useMemo(() => [...showcaseCards].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity)), [showcaseCards]);
  const fanCards = useMemo(() => {
    const rarityPriority = ["legendary", "epic", "unique", "rare", "common"];
    return [...groupedShowcase]
      .sort((a, b) => rarityPriority.indexOf(a.rarity) - rarityPriority.indexOf(b.rarity))
      .slice(0, 4);
  }, [groupedShowcase]);

  const forgeOptions = Array.isArray(forgeData?.options) ? forgeData!.options : [];
  const activeOption = forgeOptions.find((option) => option.playerId === activePlayerId) || forgeOptions[0] || null;

  return (
    <div className="flex-1 overflow-auto p-6 sm:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6">
          <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center"><Flame className="w-5 h-5 text-primary" /></div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Card Lab Forge</h1>
                <p className="mt-1 text-sm text-muted-foreground">Turn duplicate commons into a rare without touching the rest of your collection flow.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mt-5">
              <InfoPill label="Forge rule" value={`5 ${forgeData?.rules?.fromRarity || "common"}`} helper={`Same player only`} icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />} />
              <InfoPill label="Upgrade" value={String(forgeData?.rules?.toRarity || "rare").toUpperCase()} helper="Guaranteed target rarity" icon={<Sparkles className="w-4 h-4 text-yellow-500" />} />
              <InfoPill label="Fee" value={`N$${Number(forgeData?.rules?.fee || 10).toFixed(2)}`} helper="Burn sink keeps supply balanced" icon={<Coins className="w-4 h-4 text-orange-500" />} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Forge Preview</div>
            <p className="mt-2 text-sm text-muted-foreground">When a player reaches 5 common duplicates, you can burn them into a rare version of the same player. Marketplace listings are blocked from burn eligibility.</p>
            {fanCards.length > 1 ? (
              <div className="mt-6">
                <FantasyCardFan cards={fanCards} className="mt-3" />
              </div>
            ) : null}
          </Card>
        </div>

        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Forge-Ready Players</h2>
                <p className="text-sm text-muted-foreground">Only duplicate commons with the same player are shown here.</p>
              </div>
              <Badge variant="outline">{forgeOptions.length} ready</Badge>
            </div>

            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
            ) : error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">Could not load forge options.</div>
            ) : forgeOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No forge-ready duplicates yet. Keep collecting common cards from login rewards and competitions until one player reaches 5 copies.</div>
            ) : (
              <div className="space-y-3">
                {forgeOptions.map((option) => {
                  const active = option.playerId === activeOption?.playerId;
                  return (
                    <button
                      key={option.playerId}
                      onClick={() => setActivePlayerId(option.playerId)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-foreground">{option.playerName}</div>
                          <div className="text-xs text-muted-foreground">{option.team || "Club unknown"}</div>
                        </div>
                        <Badge variant="outline">{option.duplicatesOwned}/{option.required}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border px-2 py-1">COMMON x{option.required}</span>
                        <span className="rounded-full border px-2 py-1">Fee N${Number(option.fee || 0).toFixed(2)}</span>
                        <span className="rounded-full border px-2 py-1">→ {String(option.targetRarity || "rare").toUpperCase()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold">Active Forge</h2>
                <p className="text-sm text-muted-foreground">Minimal, safe upgrade flow using the live backend route you already have.</p>
              </div>
              {activeOption ? <Badge className="bg-primary/10 text-primary border-primary/20">Ready</Badge> : null}
            </div>

            {activeOption ? (
              <div className="space-y-5">
                <div className="grid md:grid-cols-[220px_1fr] gap-5 items-start">
                  <div className="mx-auto md:mx-0">
                    <Metal3DCard
                      player={{
                        id: String(activeOption.playerId),
                        name: activeOption.playerName,
                        team: activeOption.team,
                        rarity: "rare",
                        imageUrl: activeOption.player?.imageUrl || activeOption.player?.photo || "/images/player-1.png",
                        position: activeOption.player?.position || "MID",
                        rating: Number(activeOption.player?.overall || activeOption.player?.rating || 82),
                      }}
                      className="!w-[220px]"
                    />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xl font-black text-foreground">{activeOption.playerName}</div>
                      <div className="text-sm text-muted-foreground">Burn {activeOption.required} duplicate commons of the same player to mint one rare version.</div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3">
                      <SmallStat label="Duplicates used" value={`${activeOption.cardIds.length}`} />
                      <SmallStat label="Forge fee" value={`N$${Number(activeOption.fee || 0).toFixed(2)}`} />
                      <SmallStat label="Target" value={String(activeOption.targetRarity || "rare").toUpperCase()} />
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                      Card IDs to burn: <span className="font-medium text-foreground">{activeOption.cardIds.join(", ")}</span>
                    </div>

                    <Button
                      size="lg"
                      onClick={() => forgeMutation.mutate(activeOption)}
                      disabled={forgeMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      <Flame className="w-4 h-4 mr-2" />
                      {forgeMutation.isPending ? "Forging..." : `Burn 5 Commons → ${String(activeOption.targetRarity || "rare").toUpperCase()}`}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">Select a forge-ready player on the left when available.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value, helper, icon }: { label: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-background/70 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{helper}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold mt-1">{value}</div>
    </div>
  );
}

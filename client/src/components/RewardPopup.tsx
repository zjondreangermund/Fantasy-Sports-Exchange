import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import Metal3DCard from "./Metal3DCard";
import { toFantasyCardData } from "../lib/fantasy-card-adapter";
import { Trophy, Gift, DollarSign, Star, PackageCheck } from "lucide-react";
import { queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";

interface RewardPopupProps {
  rewards: any[];
  onClose: () => void;
}

type VaultItem = {
  id: string;
  rarity: string;
  title: string;
  value: number;
  tierIndex: number;
  currentPrize?: boolean;
  unlocked?: boolean;
};

type VaultPayload = { items?: VaultItem[] };

function resolvePrizeItem(reward: any, items: VaultItem[]) {
  const explicit = String(reward?.prizeTitle || reward?.prizeName || reward?.prizeDescription || "").trim();
  const rarity = String(reward?.rarity || reward?.competition?.tier || "").toLowerCase();
  const amount = Number(reward?.prizeAmount || 0);
  if (explicit) return { title: explicit, value: amount, rarity };

  const candidates = items.filter((item) => !rarity || item.rarity === rarity);
  const exact = amount > 0 ? candidates.find((item) => Number(item.value) === amount) : undefined;
  const current = candidates.find((item) => item.currentPrize);
  const unlocked = [...candidates].filter((item) => item.unlocked).sort((a, b) => b.tierIndex - a.tierIndex)[0];
  const linked = exact || current || unlocked;
  if (linked) return { title: linked.title, value: Number(linked.value || amount), rarity: linked.rarity };
  return amount > 0 ? { title: `N$${amount.toLocaleString()} Prize Vault reward`, value: amount, rarity } : null;
}

export default function RewardPopup({ rewards, onClose }: RewardPopupProps) {
  const { toast } = useToast();
  const { data: vault } = useQuery<VaultPayload>({
    queryKey: ["/api/prize-vault"],
    queryFn: async () => {
      const res = await fetch("/api/prize-vault", { credentials: "include" });
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 60000,
  });
  const vaultItems = Array.isArray(vault?.items) ? vault.items : [];

  const claimMutation = useMutation({
    mutationFn: async () => {
      const claimable = (Array.isArray(rewards) ? rewards : []).filter(
        (reward) => reward && !reward.claimed && (Number(reward.prizeAmount || 0) > 0 || reward.prizeCardId || reward.prizeCard),
      );

      let claimedCount = 0;
      let totalMoney = 0;
      for (const reward of claimable) {
        const entryId = Number(reward.id || 0);
        const res = await fetch("/api/rewards/tournament-claim", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entryId > 0 ? { entryId } : {}),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || "Failed to claim rewards");
        }

        const data = await res.json();
        claimedCount += 1;
        totalMoney += Number(data?.prizeAmount || 0);
      }

      return { claimedCount, totalMoney };
    },
    onSuccess: async ({ claimedCount, totalMoney }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/rewards"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/rewards/tournament-status"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] }),
      ]);

      toast({
        title: "Congratulations! Rewards claimed",
        description: claimedCount > 0
          ? `You claimed ${claimedCount} reward${claimedCount === 1 ? "" : "s"}${totalMoney > 0 ? ` and received N$${totalMoney.toFixed(2)}.` : "."}`
          : "No claimable rewards found.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Reward claim failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
            <Trophy className="h-8 w-8 text-yellow-500" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-foreground">Congratulations!</h2>
          <p className="mb-6 text-muted-foreground">You won the following item or card reward</p>

          <div className="max-h-96 space-y-4 overflow-auto">
            {rewards.map((reward, index) => {
              const prize = resolvePrizeItem(reward, vaultItems);
              const competitionName = reward.competition?.name || reward.competitionName || "Tournament";
              const rarity = String(prize?.rarity || reward?.rarity || reward?.competition?.tier || "").toLowerCase();
              return (
                <div key={reward.id || index} className="rounded-lg border border-border bg-muted/50 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="font-semibold text-foreground">{competitionName}</span>
                    {reward.rank && (
                      <Badge variant="outline" className={
                        reward.rank === 1 ? "border-yellow-500 text-yellow-500" :
                        reward.rank === 2 ? "border-zinc-400 text-zinc-400" :
                        "border-amber-700 text-amber-700"
                      }>
                        {reward.rank === 1 ? "1st Place" : reward.rank === 2 ? "2nd Place" : `${reward.rank}${reward.rank === 3 ? "rd" : "th"} Place`}
                      </Badge>
                    )}
                  </div>

                  {prize && (
                    <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-left">
                      <div className="flex items-start gap-3">
                        <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[.16em] text-yellow-600">{rarity ? `${rarity} Prize Vault item` : "Prize Vault item"}</div>
                          <div className="mt-1 text-lg font-black text-foreground">{prize.title}</div>
                          {prize.value > 0 && <div className="mt-1 text-sm text-muted-foreground">Approximate value: N${prize.value.toLocaleString()}</div>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {Number(reward.prizeAmount || 0) > 0 && (
                      <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        <span className="font-bold text-green-500">N${Number(reward.prizeAmount || 0).toFixed(2)}</span>
                      </div>
                    )}

                    {reward.prizeCard && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Gift className="h-4 w-4" /> Card Prize
                        </div>
                        <Metal3DCard player={toFantasyCardData(reward.prizeCard)} className="!w-[168px]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Button onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending} className="mt-6 w-full">
            {claimMutation.isPending ? "Claiming..." : "Claim Rewards"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

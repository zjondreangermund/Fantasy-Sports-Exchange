import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock3, ShieldAlert, Sparkles, Trophy } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

type ReplacementClaim = {
  id: number;
  sourceCardId: number;
  sourcePlayerId: number;
  sourcePlayerName: string;
  sourcePosition?: string | null;
  rarity: string;
  replacementCardId?: number | null;
  claimedAt?: string | null;
  ownerDecision?: "keep" | "replace" | null;
  decisionAt?: string | null;
  locked?: boolean;
  purchased?: boolean;
  createdAt?: string | null;
};

type ReplacementPayload = {
  claims?: ReplacementClaim[];
  openClaims?: number;
};

function cap(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Card";
}

export default function MandatoryReplacementClaimDialog() {
  const { toast } = useToast();
  const [dismissedPurchasedClaim, setDismissedPurchasedClaim] = React.useState<number | null>(null);
  const { data, isFetching } = useQuery<ReplacementPayload>({
    queryKey: ["/api/player-replacements"],
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const claims = Array.isArray(data?.claims) ? data.claims : [];
  const pending = claims.filter((claim) => !claim.replacementCardId && !claim.claimedAt && claim.ownerDecision !== "keep");
  // Common cards are handled automatically by lock-safe runtime maintenance.
  // No replacement prompt may interrupt a currently locked GW lineup.
  const actionable = pending.filter((claim) => String(claim.rarity || "").toLowerCase() !== "common" && !claim.locked);
  const claim = actionable.find((row) => !(row.purchased && dismissedPurchasedClaim === row.id)) || null;

  const claimMutation = useMutation({
    mutationFn: async (claimId: number) => {
      const response = await apiRequest("POST", `/api/player-replacements/${claimId}/claim`, {});
      return response.json();
    },
    onSuccess: async (result: any) => {
      const claimedId = Number(result?.claim?.id || claim?.id || 0);
      const replacementCardId = Number(result?.card?.id || result?.claim?.replacementCardId || 0);
      queryClient.setQueryData<ReplacementPayload>(["/api/player-replacements"], (current) => {
        const currentClaims = Array.isArray(current?.claims) ? current!.claims! : [];
        const nextClaims = currentClaims.map((row) => Number(row.id) === claimedId
          ? { ...row, ownerDecision: "replace" as const, replacementCardId: replacementCardId || row.replacementCardId || 1, claimedAt: result?.claim?.claimedAt || new Date().toISOString() }
          : row);
        return { ...(current || {}), claims: nextClaims, openClaims: nextClaims.filter((row) => !row.replacementCardId && !row.claimedAt && row.ownerDecision !== "keep").length };
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/player-replacements"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/competitions"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/competitions/my-entries"] }),
      ]);
      toast({
        title: result?.alreadyClaimed ? "Replacement already claimed" : "Replacement card claimed",
        description: result?.card?.playerName
          ? `${result.card.playerName} (${String(result.card.position || claim?.sourcePosition || "").toUpperCase()}) is now in your Collection.`
          : "Your replacement card is now in your Collection.",
      });
    },
    onError: (error: any) => toast({
      title: "Replacement not completed",
      description: error?.message || "The replacement could not be completed yet.",
      variant: "destructive",
    }),
  });

  const keepMutation = useMutation({
    mutationFn: async (claimId: number) => {
      const response = await apiRequest("POST", `/api/player-replacements/${claimId}/keep`, {});
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/player-replacements"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] }),
      ]);
      toast({
        title: "Original card kept",
        description: "The card remains yours as a collectible, but it cannot score or enter Premier League tournaments while the player is outside the league.",
      });
    },
    onError: (error: any) => toast({
      title: "Could not save your choice",
      description: error?.message || "Please try again.",
      variant: "destructive",
    }),
  });

  if (!claim) return null;

  const rarity = cap(claim.rarity);
  const position = String(claim.sourcePosition || "same position").toUpperCase();
  const purchased = Boolean(claim.purchased);
  const busy = claimMutation.isPending || keepMutation.isPending || isFetching;

  return (
    <Dialog
      open={Boolean(claim)}
      onOpenChange={(open) => {
        if (!open && purchased) setDismissedPurchasedClaim(Number(claim.id));
      }}
    >
      <DialogContent
        data-replacement-claim-dialog
        className="z-[120] max-w-xl border-amber-300/30 bg-[#080c18] text-white shadow-2xl [&>button.absolute]:hidden"
        onEscapeKeyDown={(event) => { if (!purchased) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (!purchased) event.preventDefault(); }}
        onInteractOutside={(event) => { if (!purchased) event.preventDefault(); }}
      >
        <DialogHeader>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border border-amber-300/30 bg-amber-300/15 text-amber-100">{purchased ? "Owner choice" : "Action required"}</Badge>
            <Badge className="border border-white/10 bg-white/[.06] text-white/70">{rarity} · {position}</Badge>
          </div>
          <DialogTitle className="flex items-start gap-3 text-2xl font-black">
            <ShieldAlert className="mt-0.5 h-7 w-7 shrink-0 text-amber-300" />
            {purchased ? "Choose what happens to your card" : "Claim your replacement card"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-white/60">
            {claim.sourcePlayerName} is outside the Premier League. Non-Premier-League matches do not score in Fantasy Arena and this card cannot be used in new Premier League tournament entries.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><div className="text-[10px] font-black uppercase tracking-[.14em] text-white/40">Original player</div><div className="mt-1 font-black">{claim.sourcePlayerName}</div></div>
            <div><div className="text-[10px] font-black uppercase tracking-[.14em] text-white/40">Rarity protected</div><div className="mt-1 font-black text-purple-200">{rarity}</div></div>
            <div><div className="text-[10px] font-black uppercase tracking-[.14em] text-white/40">Position protected</div><div className="mt-1 font-black text-cyan-200">{position}</div></div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">
          <div className="flex items-center gap-2 font-black"><Sparkles className="h-4 w-4" />Replacement option</div>
          <p className="mt-1 text-emerald-50/80">Receive one random current Premier League <b>{position}</b> card with the same <b>{rarity}</b> rarity. Your old card is then archived from the playable collection.</p>
        </div>

        {purchased ? (
          <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[.07] px-3 py-2 text-xs leading-5 text-cyan-50/80">
            <Trophy className="mr-1 inline h-3.5 w-3.5" />Because this card was bought in the Marketplace, you decide: keep the original collectible or take the protected replacement.
          </div>
        ) : (
          <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[.07] px-3 py-2 text-xs leading-5 text-cyan-50/80">
            <Trophy className="mr-1 inline h-3.5 w-3.5" />This protected reward card receives the normal same-rarity, same-position replacement.
          </div>
        )}

        <div className="grid gap-2">
          <Button type="button" onClick={() => claimMutation.mutate(Number(claim.id))} disabled={busy} className="h-12 w-full bg-amber-300 text-base font-black text-slate-950 hover:bg-amber-200">
            <Sparkles className="mr-2 h-5 w-5" />{claimMutation.isPending ? "Minting replacement…" : `Replace with ${rarity} ${position}`}
          </Button>
          {purchased ? (
            <>
              <Button type="button" variant="outline" onClick={() => keepMutation.mutate(Number(claim.id))} disabled={busy} className="h-11 w-full">
                Keep my original card
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDismissedPurchasedClaim(Number(claim.id))} disabled={busy} className="h-10 w-full text-white/55">
                <Clock3 className="mr-2 h-4 w-4" />Decide later
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

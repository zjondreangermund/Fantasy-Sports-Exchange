import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldAlert, Sparkles, Trophy } from "lucide-react";
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
  const { data, isFetching } = useQuery<ReplacementPayload>({
    queryKey: ["/api/player-replacements"],
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const claims = Array.isArray(data?.claims) ? data.claims : [];
  const openClaims = claims.filter((claim) => !claim.replacementCardId && !claim.claimedAt);
  const claim = openClaims[0] || null;

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
          ? { ...row, replacementCardId: replacementCardId || row.replacementCardId || 1, claimedAt: result?.claim?.claimedAt || new Date().toISOString() }
          : row);
        return { ...(current || {}), claims: nextClaims, openClaims: nextClaims.filter((row) => !row.replacementCardId && !row.claimedAt).length };
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
      title: "Replacement claim still required",
      description: error?.message || "The replacement could not be claimed yet. Your claim remains open.",
      variant: "destructive",
    }),
  });

  if (!claim) return null;

  const rarity = cap(claim.rarity);
  const position = String(claim.sourcePosition || "same position").toUpperCase();
  const claimNumber = Math.max(1, claims.filter((row) => !row.replacementCardId && !row.claimedAt).findIndex((row) => row.id === claim.id) + 1);

  return (
    <Dialog open={Boolean(claim)} onOpenChange={() => {}}>
      <DialogContent
        data-replacement-claim-dialog
        className="z-[120] max-w-xl border-amber-300/30 bg-[#080c18] text-white shadow-2xl [&>button.absolute]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border border-amber-300/30 bg-amber-300/15 text-amber-100">Action required</Badge>
            <Badge className="border border-white/10 bg-white/[.06] text-white/70">{openClaims.length} replacement{openClaims.length === 1 ? "" : "s"} pending</Badge>
          </div>
          <DialogTitle className="flex items-start gap-3 text-2xl font-black">
            <ShieldAlert className="mt-0.5 h-7 w-7 shrink-0 text-amber-300" />
            Claim your replacement card
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-white/60">
            {claim.sourcePlayerName} has left the Premier League. The original card stays in your Collection as a record, but it can no longer be used in Premier League tournaments.
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
          <div className="flex items-center gap-2 font-black"><Sparkles className="h-4 w-4" />What you receive</div>
          <p className="mt-1 text-emerald-50/80">One free random current Premier League <b>{position}</b> card with the same <b>{rarity}</b> rarity. The replacement is chosen from available supply and is added directly to your Collection.</p>
        </div>

        <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[.07] px-3 py-2 text-xs leading-5 text-cyan-50/80">
          <Trophy className="mr-1 inline h-3.5 w-3.5" />You must complete this claim before continuing normally in Fantasy Arena. If more than one player has left the EPL, the next replacement will appear immediately after this one.
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 rounded-2xl border border-amber-300/15 bg-[#080c18]/95 p-1.5 pb-[calc(.375rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_28px_rgba(8,12,24,.92)] backdrop-blur-xl">
          <Button
            type="button"
            onClick={() => claimMutation.mutate(Number(claim.id))}
            disabled={claimMutation.isPending || isFetching}
            className="h-12 w-full bg-amber-300 text-base font-black text-slate-950 hover:bg-amber-200"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            {claimMutation.isPending ? "Claiming random replacement…" : `Claim ${rarity} ${position} replacement`}
          </Button>
          <div className="mt-1.5 text-center text-[10px] font-bold uppercase tracking-[.13em] text-white/35">Required replacement claim {claimNumber} · no fee</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, Trophy, ShoppingCart, Repeat2 } from "lucide-react";
import { useAuth } from "../hooks/use-auth";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

type ArenaNotification = {
  id: number;
  title?: string;
  message?: string;
  read?: boolean;
  dedupeKey?: string | null;
};

type NotificationPayload = {
  notifications?: ArenaNotification[];
  unreadCount?: number;
};

export default function SignupWelcomeDialog() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: onboarding, isLoading: onboardingLoading } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/onboarding/status"],
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const notifications = useQuery<NotificationPayload>({
    queryKey: ["/api/notifications"],
    enabled: Boolean(user) && onboarding?.completed === true,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const welcome = (Array.isArray(notifications.data?.notifications) ? notifications.data!.notifications! : [])
    .find((item) => !item.read && String(item.dedupeKey || "").startsWith("welcome:new-user:")) || null;

  const readMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/notifications/${id}/read`, {});
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  if (authLoading || onboardingLoading || !user || onboarding?.completed !== true || !welcome) return null;

  return (
    <Dialog open={Boolean(welcome)} onOpenChange={() => {}}>
      <DialogContent
        data-signup-welcome-dialog
        className="z-[130] max-h-[92dvh] max-w-xl overflow-y-auto border-violet-300/25 bg-[#070b16] text-white shadow-2xl [&>button.absolute]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-2 text-xs font-black uppercase tracking-[.18em] text-violet-200">Fantasy Arena</div>
          <DialogTitle className="text-2xl font-black">🏟️ Welcome to Fantasy Arena!</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-white/60">
            Your player cards are more than collectibles — they are part of the game.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.06] p-3"><Sparkles className="mb-2 h-5 w-5 text-cyan-300" /><b>Build your collection</b><p className="mt-1 text-xs leading-5 text-white/55">Collect real Premier League player cards and earn points from real match performances.</p></div>
          <div className="rounded-xl border border-violet-300/15 bg-violet-300/[.06] p-3"><Trophy className="mb-2 h-5 w-5 text-violet-300" /><b>Enter tournaments</b><p className="mt-1 text-xs leading-5 text-white/55">Build eligible five-card lineups and compete against other managers.</p></div>
          <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.06] p-3"><ShoppingCart className="mb-2 h-5 w-5 text-emerald-300" /><b>Trade cards</b><p className="mt-1 text-xs leading-5 text-white/55">Buy and sell eligible cards in the Marketplace.</p></div>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.06] p-3"><Repeat2 className="mb-2 h-5 w-5 text-amber-300" /><b>Loan & improve</b><p className="mt-1 text-xs leading-5 text-white/55">Loan cards, earn rewards and keep improving your tournament collection.</p></div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm leading-6 text-white/70">
          <b className="text-white">PLAY. COLLECT. COMPETE. WIN.</b><br />
          Start building your squad and see where your cards can take you. ⚽🔥
        </div>

        <Button
          type="button"
          className="h-12 w-full bg-cyan-300 text-base font-black text-slate-950 hover:bg-cyan-200"
          disabled={readMutation.isPending}
          onClick={() => readMutation.mutate(Number(welcome.id))}
        >
          {readMutation.isPending ? "Opening Fantasy Arena…" : "Start exploring Fantasy Arena"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

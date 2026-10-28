import * as React from "react";
import { Monitor, Smartphone, Sparkles } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

const MOBILE_APP_GUIDANCE = "💻 The Fantasy Arena website is designed for desktop viewing. For a better experience on your phone, install the Fantasy Arena app using the Install App button.";

type InboxNotification = {
  id: number;
  title?: string | null;
  message?: string | null;
  read?: boolean;
  dedupeKey?: string | null;
};

type NotificationPayload = {
  notifications?: InboxNotification[];
};

export default function SignupWelcomePopup() {
  const { user } = useAuth();
  const [locallyClosed, setLocallyClosed] = React.useState(false);
  const { data } = useQuery<NotificationPayload>({
    queryKey: ["/api/notifications"],
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const welcome = (Array.isArray(data?.notifications) ? data.notifications : [])
    .find((note) => !note.read && String(note.dedupeKey || "").startsWith("welcome:new-user:")) || null;

  const readMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/notifications/${id}/read`, {});
      return response.json();
    },
    onSettled: async () => {
      setLocallyClosed(true);
      await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  if (!user || !welcome || locallyClosed) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !readMutation.isPending) readMutation.mutate(Number(welcome.id)); }}>
      <DialogContent
        data-signup-welcome-popup
        className="z-[125] max-h-[min(86dvh,760px)] max-w-xl overflow-y-auto border-violet-300/20 bg-[#080b18] text-white shadow-2xl"
      >
        <DialogHeader>
          <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-violet-100">
            <Sparkles className="h-3.5 w-3.5" /> New manager
          </div>
          <DialogTitle className="text-2xl font-black">{welcome.title || "🏟️ Welcome to Fantasy Arena!"}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-sm leading-6 text-white/65">
            {(welcome.message || "Welcome to Fantasy Arena.").replace(MOBILE_APP_GUIDANCE, "").trim()}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/[.07] px-4 py-3" data-welcome-mobile-install-guidance>
          <div className="flex items-center gap-2 text-sm font-black text-cyan-100"><Monitor className="h-4 w-4" /><Smartphone className="h-4 w-4" /> Desktop website · Mobile app</div>
          <p className="mt-1 text-sm leading-5 text-white/75">The Fantasy Arena website is designed for desktop viewing. For a better experience on your phone, <strong className="text-white">install the Fantasy Arena app</strong> using the <strong className="text-white">Install App</strong> option.</p>
        </div>
        <Button
          type="button"
          data-signup-welcome-start
          className="h-12 w-full bg-violet-300 font-black text-slate-950 hover:bg-violet-200"
          disabled={readMutation.isPending}
          onClick={() => readMutation.mutate(Number(welcome.id))}
        >
          {readMutation.isPending ? "Opening Fantasy Arena…" : "Start building my squad"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

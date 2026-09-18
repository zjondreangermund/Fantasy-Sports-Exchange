import * as React from "react";
import { Sparkles } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

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
            {welcome.message || "Welcome to Fantasy Arena."}
          </DialogDescription>
        </DialogHeader>
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

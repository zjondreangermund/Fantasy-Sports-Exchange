import { useAuth } from "../hooks/use-auth";
import { pendingToastEvents, type NotificationToastState } from "../lib/notification-toast-policy";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { ToastAction } from "./ui/toast";
import { openCommunityMention, notificationDestination } from "../lib/notifications";
import { useLocation } from "wouter";

type NotificationItem = {
  id: number;
  type: "win" | "runner_up" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
  communityMessageId?: number | null;
  notificationKind?: string | null;
  dedupeKey?: string | null;
  replacementClaimId?: number | null;
  replacementDepartureKind?: string | null;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export default function FloatingEventNotifications() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const fallbackState = React.useRef<Record<string, NotificationToastState>>({});

  const { data } = useQuery<NotificationResponse>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", { credentials: "include" });
      if (!response.ok) return { notifications: [], unreadCount: 0 };
      return response.json();
    },
    refetchInterval: 10000,
    enabled: Boolean(user?.id),
  });

  React.useEffect(() => {
    if (!user?.id) return;
    const key = `fantasy-arena:notification-popups:${user.id}`;
    let state = fallbackState.current[key] || { lastShownAt: 0, seenThroughId: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && Number.isFinite(saved.lastShownAt) && Number.isFinite(saved.seenThroughId)) state = saved;
    } catch { /* In-memory pacing still works when storage is unavailable. */ }
    // MINT_PUSH_FLOOD_GUARD_V1: already-present mint choices have a dedicated
    // reward/claim experience and Inbox entry. Do not also replay them as
    // auto-opening toast banners on every poll, tab switch or app restart.
    const toastEligible = (data?.notifications || []).filter((note) => {
      const key = String(note.dedupeKey || "");
      return !key.startsWith("card:weekly-ready:")
        && !key.startsWith("card:weekly-expiring:")
        && !key.startsWith("replacement-claim:")
        && !key.startsWith("replacement-reminder:");
    });
    const events = pendingToastEvents(toastEligible, state, Date.now());
    if (!events.length) return;
    const newest = events[0];
    const grouped = events.length > 1;
    const next = { lastShownAt: Date.now(), seenThroughId: Number(newest.id) };
    fallbackState.current[key] = next;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode */ }
    toast({
      title: grouped ? `${events.length} Fantasy Arena updates` : newest.title || "Fantasy Arena update",
      description: grouped ? events.slice(0, 3).map(item => item.title).join(" • ") : newest.message,
      ...(grouped ? {
        action: <ToastAction altText="Open all notifications" onClick={() => setLocation("/account?tab=inbox")}>Open Inbox</ToastAction>,
      } : newest.communityMessageId ? {
        action: (
          <ToastAction altText="Open the message mentioning you" onClick={() => {
            void openCommunityMention(newest);
          }}>
            View message
          </ToastAction>
        ),
      } : Number(newest.replacementClaimId || 0) > 0 || String(newest.dedupeKey || "").startsWith("replacement-") ? {
        action: (
          <ToastAction
            altText="Open your replacement card claim"
            onClick={() => setLocation(notificationDestination(newest))}
          >
            {String(newest.replacementDepartureKind || "") === "real_life_loan" ? "Choose card option" : "Mint replacement"}
          </ToastAction>
        ),
      } : {
        action: <ToastAction altText="Open notification" onClick={() => setLocation(notificationDestination(newest))}>View</ToastAction>,
      }),
    });
  }, [data, toast, setLocation, user?.id]);

  return null;
}

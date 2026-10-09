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
  loanDepartureId?: number | null;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export default function FloatingEventNotifications() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const seenIdsRef = React.useRef<Set<number>>(new Set());

  const { data } = useQuery<NotificationResponse>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", { credentials: "include" });
      if (!response.ok) return { notifications: [], unreadCount: 0 };
      return response.json();
    },
    refetchInterval: 10000,
  });

  React.useEffect(() => {
    const importantMessages = (Array.isArray(data?.notifications) ? data.notifications : [])
      .filter((item) => !item.read && (
        item.type === "win"
        || item.type === "runner_up"
        || Number(item.replacementClaimId || 0) > 0
        || String(item.dedupeKey || "").startsWith("replacement-claim:")
        || String(item.dedupeKey || "").startsWith("replacement-reminder:")
        || Number(item.loanDepartureId || 0) > 0
        || String(item.dedupeKey || "").startsWith("loan-departure-choice:")
        || (item.notificationKind === "community_mention" && Number(item.communityMessageId || 0) > 0)
      ))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const newest = importantMessages.find((item) => !seenIdsRef.current.has(item.id));
    if (!newest) return;

    seenIdsRef.current.add(newest.id);
    toast({
      title: newest.title || "Congratulations from the Fantasy Arena Team",
      description: newest.message || "You received a tournament reward.",
      ...(newest.communityMessageId ? {
        action: (
          <ToastAction altText="Open the message mentioning you" onClick={() => {
            void openCommunityMention(newest);
          }}>
            View message
          </ToastAction>
        ),
      } : Number(newest.loanDepartureId || 0) > 0 || String(newest.dedupeKey || "").startsWith("loan-departure-choice:") ? {
        action: (
          <ToastAction
            altText="Choose what happens to your loan card"
            onClick={() => setLocation(notificationDestination(newest))}
          >
            Choose loan option
          </ToastAction>
        ),
      } : Number(newest.replacementClaimId || 0) > 0 || String(newest.dedupeKey || "").startsWith("replacement-") ? {
        action: (
          <ToastAction
            altText="Open your replacement card claim"
            onClick={() => setLocation(notificationDestination(newest))}
          >
            Mint replacement
          </ToastAction>
        ),
      } : {}),
    });
  }, [data, toast, setLocation]);

  return null;
}

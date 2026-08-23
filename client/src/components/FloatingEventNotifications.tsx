import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { ToastAction } from "./ui/toast";
import { openCommunityMention } from "../lib/notifications";

type NotificationItem = {
  id: number;
  type: "win" | "runner_up" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
  communityMessageId?: number | null;
  notificationKind?: string | null;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export default function FloatingEventNotifications() {
  const { toast } = useToast();
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
      } : {}),
    });
  }, [data, toast]);

  return null;
}

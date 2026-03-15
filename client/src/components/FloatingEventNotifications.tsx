import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";

type NotificationItem = {
  id: number;
  type: "win" | "runner_up" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
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
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return { notifications: [], unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 7000,
  });

  React.useEffect(() => {
    const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
    const unread = notifications.filter((item) => !item.read);
    if (!unread.length) return;

    const newestFirst = [...unread].sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      return bt - at;
    });

    newestFirst.slice(0, 5).forEach((item) => {
      if (seenIdsRef.current.has(item.id)) return;
      seenIdsRef.current.add(item.id);
      toast({
        title: item.title || "New update",
        description: item.message || "You received a new notification.",
      });
    });
  }, [data, toast]);

  return null;
}

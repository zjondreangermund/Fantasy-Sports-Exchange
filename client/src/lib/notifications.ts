import { queryClient } from "./queryClient";

export type NotificationCache = {
  notifications?: Array<Record<string, any>>;
  unreadCount?: number;
};

function markCacheRead() {
  queryClient.setQueryData<NotificationCache>(["/api/notifications"], (current) => {
    if (!current) return current;
    return {
      ...current,
      unreadCount: 0,
      notifications: Array.isArray(current.notifications)
        ? current.notifications.map((notification) => ({ ...notification, read: true }))
        : current.notifications,
    };
  });
}

export async function markNotificationsSeen() {
  markCacheRead();
  try {
    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to clear notification badge");
  } catch {
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  }
}

import { queryClient } from "./queryClient";

export type NotificationCache = {
  notifications?: Array<Record<string, any>>;
  unreadCount?: number;
};

export const communityMentionOpenEvent = "fantasy-arena:open-community-message";

export async function openCommunityMention(notification: {
  id?: number;
  communityMessageId?: number | null;
}) {
  const messageId = Number(notification.communityMessageId || 0);
  if (!Number.isInteger(messageId) || messageId <= 0) return;

  window.dispatchEvent(new CustomEvent(communityMentionOpenEvent, {
    detail: { messageId, notificationId: Number(notification.id || 0) || null },
  }));

  const notificationId = Number(notification.id || 0);
  if (!Number.isInteger(notificationId) || notificationId <= 0) return;

  queryClient.setQueryData<NotificationCache>(["/api/notifications"], (current) => {
    if (!current) return current;
    const notifications = Array.isArray(current.notifications)
      ? current.notifications.map((item) => Number(item.id) === notificationId
        ? { ...item, read: true }
        : item)
      : current.notifications;
    return {
      ...current,
      notifications,
      unreadCount: Array.isArray(notifications)
        ? notifications.filter((item) => !item.read).length
        : Math.max(0, Number(current.unreadCount || 0) - 1),
    };
  });

  try {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to mark mention as read");
  } catch {
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  }
}

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

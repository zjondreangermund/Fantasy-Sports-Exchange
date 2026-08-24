import { queryClient } from "./queryClient";

export type NotificationCache = {
  notifications?: Array<Record<string, any>>;
  unreadCount?: number;
};

export type ArenaNotification = {
  id?: number;
  title?: string | null;
  message?: string | null;
  type?: string | null;
  notificationKind?: string | null;
  communityMessageId?: number | null;
  replacementClaimId?: number | null;
};

export const communityMentionOpenEvent = "fantasy-arena:open-community-message";

export async function markNotificationRead(id: number | null | undefined) {
  const notificationId = Number(id || 0);
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
    if (!response.ok) throw new Error("Failed to mark notification as read");
  } catch {
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  }
}

export async function openCommunityMention(notification: ArenaNotification) {
  const messageId = Number(notification.communityMessageId || 0);
  if (!Number.isInteger(messageId) || messageId <= 0) return;

  window.dispatchEvent(new CustomEvent(communityMentionOpenEvent, {
    detail: { messageId, notificationId: Number(notification.id || 0) || null },
  }));

  await markNotificationRead(notification.id);
}

export function notificationDestination(notification: ArenaNotification): string {
  if (notification.replacementClaimId) return "/account?tab=inbox";
  const subject = `${notification.notificationKind || ""} ${notification.type || ""} ${notification.title || ""} ${notification.message || ""}`.toLocaleLowerCase("en");
  if (/\b(prize|reward|winner|won|claim|settlement)\b/.test(subject)) return "/my-entries";
  if (/\b(tournament|competition|gameweek|lineup|leaderboard|cup)\b/.test(subject)) return "/competitions";
  if (/\b(marketplace|listing|listed|sale|sold)\b/.test(subject)) return "/marketplace";
  if (/\b(card|player|collection)\b/.test(subject)) return "/collection";
  return "/account?tab=inbox";
}

export async function openNotification(
  notification: ArenaNotification,
  navigate: (destination: string) => void,
) {
  if (Number(notification.communityMessageId || 0) > 0) {
    await openCommunityMention(notification);
    return;
  }

  await markNotificationRead(notification.id);
  navigate(notificationDestination(notification));
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

import { useQuery } from "@tanstack/react-query";

type NotificationSummary = { unreadCount?: number };

export default function UnreadNotificationDot({ showCount = false, className = "" }: { showCount?: boolean; className?: string }) {
  const { data } = useQuery<NotificationSummary>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", { credentials: "include" });
      if (!response.ok) return { unreadCount: 0 };
      return response.json();
    },
    refetchInterval: 10000,
  });

  const unreadCount = Math.max(0, Number(data?.unreadCount || 0));
  if (!unreadCount) return null;

  if (showCount) {
    return (
      <span className={`inline-flex min-w-5 items-center justify-center rounded-full bg-purple-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-[0_0_16px_rgba(168,85,247,.75)] ${className}`} aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}>
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    );
  }

  return (
    <span className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`} aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-70" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-purple-100/80 bg-purple-500 shadow-[0_0_14px_rgba(168,85,247,.95)]" />
    </span>
  );
}

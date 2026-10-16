export type NotificationToastState = { lastShownAt: number; seenThroughId: number };
export function pendingToastEvents<T extends { id: number; read: boolean; createdAt: string | null }>(rows: T[], state: NotificationToastState, now: number): T[] {
  if (now - state.lastShownAt < 5 * 60_000) return [];
  return rows.filter(item => !item.read && Number(item.id) > state.seenThroughId
    && new Date(item.createdAt || 0).getTime() >= now - 24 * 60 * 60_000)
    .sort((a, b) => Number(b.id) - Number(a.id));
}

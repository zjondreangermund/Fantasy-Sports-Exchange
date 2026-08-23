export type CommunityReplyPreview = {
  id: number;
  teamName: string;
  message: string;
  deleted: boolean;
};

export type CommunityChatMessage = {
  id: number;
  userId: string;
  teamName: string;
  avatarUrl?: string | null;
  message: string;
  replyToId?: number | null;
  replyTo?: CommunityReplyPreview | null;
  mentions?: string[];
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

const MAX_SAVED_MESSAGES = 250;
const MAX_SAVED_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CHAT_STORAGE_PREFIX = "fantasy_arena_community_messages_v3:";

function messageUpdatedAt(message: CommunityChatMessage) {
  return Math.max(
    Date.parse(String(message.deletedAt || "")) || 0,
    Date.parse(String(message.editedAt || "")) || 0,
    Date.parse(String(message.createdAt || "")) || 0,
  );
}

function validMessage(value: unknown): value is CommunityChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<CommunityChatMessage>;
  return Number.isInteger(Number(message.id))
    && Number(message.id) > 0
    && typeof message.userId === "string"
    && typeof message.message === "string";
}

// COMMUNITY_DURABLE_HISTORY_V1: a stale/empty snapshot must never erase confirmed messages.
export function mergeCommunityMessages(
  ...collections: Array<readonly CommunityChatMessage[] | null | undefined>
): CommunityChatMessage[] {
  const byId = new Map<number, CommunityChatMessage>();

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const candidate of collection) {
      if (!validMessage(candidate)) continue;
      const message = { ...candidate, id: Number(candidate.id) };
      const current = byId.get(message.id);
      if (!current) {
        byId.set(message.id, message);
        continue;
      }

      const currentDeleted = Boolean(current.deletedAt);
      const candidateDeleted = Boolean(message.deletedAt);
      if (currentDeleted !== candidateDeleted) {
        byId.set(message.id, candidateDeleted ? message : current);
        continue;
      }

      if (messageUpdatedAt(message) >= messageUpdatedAt(current)) {
        byId.set(message.id, { ...current, ...message });
      }
    }
  }

  return Array.from(byId.values())
    .sort((first, second) => first.id - second.id)
    .slice(-MAX_SAVED_MESSAGES);
}

export function readCommunityMessageHistory(userId: string): CommunityChatMessage[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(`${CHAT_STORAGE_PREFIX}${userId}`) || "[]");
    if (!Array.isArray(raw)) return [];
    const oldest = Date.now() - MAX_SAVED_AGE_MS;
    return mergeCommunityMessages(raw.filter((item) => {
      if (!validMessage(item)) return false;
      const createdAt = Date.parse(String(item.createdAt || ""));
      return !createdAt || createdAt >= oldest;
    }));
  } catch {
    return [];
  }
}

export function saveCommunityMessageHistory(userId: string, messages: CommunityChatMessage[]) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${CHAT_STORAGE_PREFIX}${userId}`,
      JSON.stringify(mergeCommunityMessages(messages)),
    );
  } catch {
    // A disabled/full browser storage must not prevent database-backed chat.
  }
}

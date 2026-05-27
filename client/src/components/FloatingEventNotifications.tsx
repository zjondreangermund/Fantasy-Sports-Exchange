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

type Competition = {
  id: number;
  name: string;
  status: "open" | "upcoming" | "active" | "completed";
  startDate?: string;
  endDate?: string;
  submissionClosesAt?: string;
  entryOpen?: boolean;
  tier?: string;
};

type CompetitionEntry = {
  id: number;
  competitionId: number;
  totalScore?: number;
  rank?: number | null;
};

type RewardItem = {
  id?: number | string;
  claimed?: boolean;
  prizeAmount?: number;
  prizeCard?: unknown;
  competitionName?: string;
  rarity?: string;
};

type RetentionSummary = {
  deadline?: null | { competitionId: number; competitionName: string; startsAt: string };
  watchlist?: { alerts?: Array<{ cardId: number; playerName: string; listedPrice: number; fairValue: number; status: string }> };
  reminders?: Array<{ id: string; title: string; remindAt: string; enabled: boolean }>;
};

type SyntheticNotification = {
  key: string;
  title: string;
  message: string;
  priority?: "normal" | "high";
};

const SEEN_KEY = "fantasy_arena_seen_activity_notifications";

function readSeenKeys() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.slice(-250).map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function writeSeenKeys(keys: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(keys).slice(-250)));
  } catch {
    // ignore storage quota / privacy mode errors
  }
}

function minutesUntil(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.round((time - Date.now()) / 60000);
}

function formatTimeLeft(minutes: number) {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function normalizeList<T>(value: unknown, fallbackKey?: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (fallbackKey && value && typeof value === "object" && Array.isArray((value as any)[fallbackKey])) return (value as any)[fallbackKey] as T[];
  return [];
}

function buildSyntheticNotifications({
  competitions,
  entries,
  rewards,
  retention,
}: {
  competitions: Competition[];
  entries: CompetitionEntry[];
  rewards: RewardItem[];
  retention?: RetentionSummary;
}): SyntheticNotification[] {
  const items: SyntheticNotification[] = [];
  const enteredIds = new Set(entries.map((entry) => Number(entry.competitionId)));

  competitions.forEach((competition) => {
    const startMinutes = minutesUntil(competition.startDate);
    const closeMinutes = minutesUntil(competition.submissionClosesAt || competition.startDate);
    const entered = enteredIds.has(Number(competition.id));

    if (competition.status === "open" && !entered) {
      items.push({
        key: `competition-open-${competition.id}`,
        title: "Tournament open",
        message: `${competition.name} is open. Enter your SO5 lineup before it locks.`,
      });
    }

    if (competition.status === "open" && entered) {
      items.push({
        key: `competition-entered-${competition.id}`,
        title: "Lineup entered",
        message: `Your lineup is entered for ${competition.name}. Track it in Live Lineup.`,
      });
    }

    if (competition.status === "active" && entered) {
      items.push({
        key: `competition-active-${competition.id}`,
        title: "Tournament live",
        message: `${competition.name} is active. Check your Live Lineup for point changes.`,
        priority: "high",
      });
    }

    if (typeof startMinutes === "number" && startMinutes > 0 && startMinutes <= 60 * 24) {
      items.push({
        key: `competition-starts-${competition.id}-${Math.floor(startMinutes / 60)}`,
        title: "Tournament starting soon",
        message: `${competition.name} starts in ${formatTimeLeft(startMinutes)}.`,
      });
    }

    if (competition.status === "open" && typeof closeMinutes === "number" && closeMinutes > 0 && closeMinutes <= 120) {
      items.push({
        key: `competition-locks-${competition.id}-${Math.floor(closeMinutes / 15)}`,
        title: "Lineup lock approaching",
        message: `${competition.name} locks in ${formatTimeLeft(closeMinutes)}. Check your captain and 5 players.`,
        priority: "high",
      });
    }
  });

  rewards
    .filter((reward) => !reward.claimed && (Number(reward.prizeAmount || 0) > 0 || reward.prizeCard))
    .forEach((reward, index) => {
      items.push({
        key: `reward-ready-${reward.id || reward.competitionName || index}`,
        title: "Reward ready",
        message: `${reward.competitionName || "Tournament"} reward is ready to claim.`,
        priority: "high",
      });
    });

  retention?.watchlist?.alerts?.slice(0, 5).forEach((alert) => {
    items.push({
      key: `watchlist-${alert.cardId}-${Math.round(Number(alert.listedPrice || 0))}`,
      title: "Watchlist market alert",
      message: `${alert.playerName} is listed at N$${Number(alert.listedPrice || 0).toFixed(2)}. Fair value: N$${Number(alert.fairValue || 0).toFixed(2)}.`,
    });
  });

  retention?.reminders?.filter((reminder) => reminder.enabled).forEach((reminder) => {
    const mins = minutesUntil(reminder.remindAt);
    if (typeof mins === "number" && mins >= 0 && mins <= 60) {
      items.push({
        key: `reminder-${reminder.id}-${Math.floor(mins / 10)}`,
        title: "Reminder",
        message: `${reminder.title} is due in ${formatTimeLeft(mins)}.`,
      });
    }
  });

  if (retention?.deadline) {
    const mins = minutesUntil(retention.deadline.startsAt);
    if (typeof mins === "number" && mins >= 0 && mins <= 180) {
      items.push({
        key: `deadline-${retention.deadline.competitionId}-${Math.floor(mins / 15)}`,
        title: "Competition deadline",
        message: `${retention.deadline.competitionName} starts in ${formatTimeLeft(mins)}.`,
        priority: "high",
      });
    }
  }

  return items;
}

export default function FloatingEventNotifications() {
  const { toast } = useToast();
  const seenIdsRef = React.useRef<Set<number>>(new Set());
  const seenSyntheticRef = React.useRef<Set<string> | null>(null);

  if (!seenSyntheticRef.current && typeof window !== "undefined") {
    seenSyntheticRef.current = readSeenKeys();
  }

  const { data } = useQuery<NotificationResponse>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return { notifications: [], unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 7000,
  });

  const { data: competitionsRaw } = useQuery<Competition[]>({
    queryKey: ["/api/competitions"],
    queryFn: async () => {
      const res = await fetch("/api/competitions", { credentials: "include" });
      if (!res.ok) return [];
      const payload = await res.json();
      return normalizeList<Competition>(payload, "competitions");
    },
    refetchInterval: 30000,
  });

  const { data: entriesRaw } = useQuery<CompetitionEntry[]>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const res = await fetch("/api/competitions/my-entries", { credentials: "include" });
      if (!res.ok) return [];
      const payload = await res.json();
      return normalizeList<CompetitionEntry>(payload, "entries");
    },
    refetchInterval: 30000,
  });

  const { data: rewardsRaw } = useQuery<RewardItem[]>({
    queryKey: ["/api/rewards"],
    queryFn: async () => {
      const res = await fetch("/api/rewards", { credentials: "include" });
      if (!res.ok) return [];
      const payload = await res.json();
      return normalizeList<RewardItem>(payload, "rewards");
    },
    refetchInterval: 30000,
  });

  const { data: retention } = useQuery<RetentionSummary>({
    queryKey: ["/api/retention/summary"],
    queryFn: async () => {
      const res = await fetch("/api/retention/summary", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: 30000,
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

  React.useEffect(() => {
    const seen = seenSyntheticRef.current || new Set<string>();
    const synthetic = buildSyntheticNotifications({
      competitions: competitionsRaw || [],
      entries: entriesRaw || [],
      rewards: rewardsRaw || [],
      retention,
    });

    synthetic.slice(0, 6).forEach((item) => {
      if (seen.has(item.key)) return;
      seen.add(item.key);
      toast({
        title: item.title,
        description: item.message,
      });
    });

    seenSyntheticRef.current = seen;
    writeSeenKeys(seen);
  }, [competitionsRaw, entriesRaw, rewardsRaw, retention, toast]);

  return null;
}

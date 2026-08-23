import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AtSign,
  Bot,
  HelpCircle,
  Mail,
  MessageCircle,
  Pencil,
  Reply,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { apiRequest, queryClient } from "../lib/queryClient";
import {
  communityMentionOpenEvent,
  openCommunityMention,
  type NotificationCache,
} from "../lib/notifications";

const quickHelp = [
  { label: "Fees", keywords: ["fee", "deposit", "withdraw"], answer: "Tournament fees are shown before entry. Marketplace sales charge 8%, deposits below N$200 charge 2%, and Fantasy Arena charges no withdrawal fee." },
  { label: "Join tournament", keywords: ["join", "pin", "tournament", "competition"], answer: "Open Play, choose a tournament, build a five-card team, select a captain and confirm the entry fee and rarity requirement." },
  { label: "Lineup rules", keywords: ["lineup", "gk", "def", "mid", "fwd", "captain"], answer: "Every tournament team needs five different players: GK, DEF, MID, FWD and one Utility card. Choose one captain before submitting." },
  { label: "Funding", keywords: ["funding", "2.0", "multiplier", "vault"], answer: "The funding multiplier is the entry revenue needed before a prize unlocks. At 2.0×, a N$1,000 prize needs N$2,000 of entry revenue." },
  { label: "Marketplace", keywords: ["sell", "buy", "market", "listing"], answer: "Eligible premium cards can be listed on the Marketplace. Common cards are tournament-only and cannot be sold." },
  { label: "Rewards", keywords: ["reward", "winner", "prize", "claim"], answer: "After settlement, winners receive a notification. Prize Vault winners complete their claim from My Teams & Prizes." },
];

type WidgetMode = "community" | "help";
type ReplyPreview = { id: number; teamName: string; message: string; deleted: boolean };
type ChatMessage = {
  id: number;
  userId: string;
  teamName: string;
  avatarUrl?: string | null;
  message: string;
  replyToId?: number | null;
  replyTo?: ReplyPreview | null;
  mentions?: string[];
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};
type CurrentUser = {
  id?: string;
  managerTeamName?: string | null;
  name?: string | null;
  email?: string | null;
};
type AdminCheck = { isAdmin: boolean };
type MarketplaceListing = {
  id?: number;
  cardId?: number;
  price?: number;
  rarity?: string;
  player?: { name?: string };
  ownerName?: string;
  ownerUsername?: string;
};

// COMMUNITY_MENTION_NOTIFICATION_V1: retain the canonical SSE-backed chat widget during production builds.
const chatQueryKey = ["/community-live/messages"] as const;
const lastSeenStorageKey = "fantasy_arena_community_chat_last_seen_v2";
const seenListingsStorageKey = "fantasy_arena_seen_listing_ids_v2";

function localArenaAnswer(message: string) {
  const text = message.toLowerCase();
  const match = quickHelp.find((item) => item.keywords.some((keyword) => text.includes(keyword)));
  return match?.answer || "Ask about fees, funding, tournament entry, lineup rules, marketplace trading or rewards.";
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "now";
}

function mergeMessage(messages: ChatMessage[] | undefined, incoming: ChatMessage) {
  const current = Array.isArray(messages) ? messages : [];
  return [...current.filter((message) => message.id !== incoming.id), incoming]
    .sort((a, b) => a.id - b.id)
    .slice(-100);
}

function mentionHandle(teamName: string) {
  return teamName.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30) || "ArenaManager";
}

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/COMMUNITY_LANGUAGE_BLOCKED|profanity|slurs/i.test(raw)) return "Please keep Community Live respectful. Profanity and slurs are blocked.";
  if (/429/.test(raw)) return "Please wait a moment before trying again.";
  return raw.replace(/^\d+:\s*/, "") || "The community action could not be completed.";
}

function MarketplaceListingActivity() {
  const [notice, setNotice] = useState<MarketplaceListing | null>(null);
  const { data = [] } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace", { credentials: "include" });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload) ? payload : payload.listings || payload.cards || [];
    },
    refetchInterval: 12_000,
    staleTime: 0,
  });

  useEffect(() => {
    if (!data.length) return;
    let seen: number[] = [];
    try {
      seen = JSON.parse(window.localStorage.getItem(seenListingsStorageKey) || "[]");
    } catch {
      seen = [];
    }
    const ids = data.map((listing) => Number(listing.id ?? listing.cardId ?? 0)).filter(Boolean);
    if (!seen.length) {
      window.localStorage.setItem(seenListingsStorageKey, JSON.stringify(ids.slice(0, 250)));
      return;
    }
    const fresh = data.find((listing) => !seen.includes(Number(listing.id ?? listing.cardId ?? 0)));
    window.localStorage.setItem(
      seenListingsStorageKey,
      JSON.stringify(Array.from(new Set([...ids, ...seen])).slice(0, 250)),
    );
    if (!fresh) return;
    setNotice(fresh);
    const timer = window.setTimeout(() => setNotice(null), 6500);
    return () => window.clearTimeout(timer);
  }, [data]);

  if (!notice) return null;
  return (
    <div className="fixed bottom-24 right-4 z-[96] w-[min(355px,calc(100vw-2rem))] rounded-2xl border border-emerald-200/20 bg-slate-950/84 p-4 text-white shadow-2xl backdrop-blur-2xl sm:bottom-5">
      <button onClick={() => setNotice(null)} className="absolute right-2 top-2 p-1 text-white/45" aria-label="Close listing alert">
        <X className="h-4 w-4" />
      </button>
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">New card listed</p>
      <p className="mt-1 font-bold">{notice.player?.name || "Player card"}</p>
      <p className="mt-1 text-xs text-white/55">
        {notice.ownerName || notice.ownerUsername || "Arena manager"} • N${Number(notice.price || 0).toFixed(2)}
      </p>
    </div>
  );
}

export default function FloatingSupportWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WidgetMode>("community");
  const [helpInput, setHelpInput] = useState("");
  const [answer, setAnswer] = useState("Choose a topic or ask how Fantasy Arena works.");
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [lastSeenId, setLastSeenId] = useState(() => Number(window.localStorage.getItem(lastSeenStorageKey) || 0) || 0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: user } = useQuery<CurrentUser>({ queryKey: ["/api/user"] });
  const { data: adminCheck } = useQuery<AdminCheck>({ queryKey: ["/api/admin/check"], retry: false });
  const { data: notificationInbox } = useQuery<NotificationCache>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", { credentials: "include" });
      if (!response.ok) return { notifications: [], unreadCount: 0 };
      return response.json();
    },
    refetchInterval: 10_000,
  });
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: chatQueryKey,
    queryFn: async () => {
      const response = await fetch("/community-live/messages", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load Community Live");
      const payload = await response.json();
      return Array.isArray(payload) ? payload : payload.messages || [];
    },
    staleTime: 0,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const stream = new EventSource("/community-live/stream");
    const onMessage = (event: Event) => {
      try {
        const raw = JSON.parse((event as MessageEvent).data) as ChatMessage;
        const incoming = {
          ...raw,
          isOwn: Boolean(user?.id && raw.userId === user.id),
          canEdit: Boolean(user?.id && raw.userId === user.id && !raw.deletedAt),
          canDelete: Boolean((adminCheck?.isAdmin || (user?.id && raw.userId === user.id)) && !raw.deletedAt),
        };
        queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => mergeMessage(current, incoming));
        const currentHandle = mentionHandle(
          user?.managerTeamName || user?.name || user?.email?.split("@")[0] || "",
        ).toLocaleLowerCase("en");
        if (incoming.userId !== user?.id && incoming.mentions?.some(
          (handle) => String(handle).toLocaleLowerCase("en") === currentHandle,
        )) {
          void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        }
      } catch { /* ignore malformed stream events */ }
    };
    stream.addEventListener("community-message", onMessage);
    return () => { stream.removeEventListener("community-message", onMessage); stream.close(); };
  }, [adminCheck?.isAdmin, user?.email, user?.id, user?.managerTeamName, user?.name]);

  const latestId = messages[messages.length - 1]?.id || 0;
  const unreadCount = useMemo(
    () => messages.filter((message) => message.id > lastSeenId && message.userId !== user?.id).length,
    [lastSeenId, messages, user?.id],
  );
  const latestPreview = messages[messages.length - 1];
  const unreadMentions = useMemo(
    () => (Array.isArray(notificationInbox?.notifications) ? notificationInbox.notifications : [])
      .filter((notification) => !notification.read
        && notification.notificationKind === "community_mention"
        && Number(notification.communityMessageId || 0) > 0),
    [notificationInbox?.notifications],
  );
  const latestMention = unreadMentions[0];

  useEffect(() => {
    const openMention = async (event: Event) => {
      const messageId = Number((event as CustomEvent<{ messageId?: number }>).detail?.messageId || 0);
      if (!Number.isInteger(messageId) || messageId <= 0) return;

      setMode("community");
      setHighlightedMessageId(messageId);
      setOpen(true);

      const existing = queryClient.getQueryData<ChatMessage[]>(chatQueryKey);
      if (Array.isArray(existing) && existing.some((message) => message.id === messageId)) return;

      try {
        const response = await fetch(`/community-live/messages/${messageId}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("The mentioned message is no longer available.");
        const payload = await response.json();
        if (payload?.message) {
          queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => mergeMessage(current, payload.message));
        }
      } catch (error) {
        setChatError(error instanceof Error ? error.message : "Unable to load your mention.");
      }
    };

    window.addEventListener(communityMentionOpenEvent, openMention);
    return () => window.removeEventListener(communityMentionOpenEvent, openMention);
  }, []);

  useEffect(() => {
    if (!open || mode !== "community" || latestId <= 0) return;
    setLastSeenId(latestId);
    window.localStorage.setItem(lastSeenStorageKey, String(latestId));
  }, [latestId, mode, open]);

  useEffect(() => {
    if (!open || mode !== "community") return;
    const timer = window.setTimeout(() => {
      if (highlightedMessageId) {
        const target = scrollRef.current?.querySelector<HTMLElement>(
          `[data-community-message-id="${highlightedMessageId}"]`,
        );
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [highlightedMessageId, messages, mode, open]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const timer = window.setTimeout(() => setHighlightedMessageId(null), 8000);
    return () => window.clearTimeout(timer);
  }, [highlightedMessageId]);

  const sendMutation = useMutation({
    mutationFn: async ({ message, replyToId }: { message: string; replyToId?: number | null }) =>
      (await apiRequest("POST", "/community-live/messages", { message, replyToId })).json(),
    onSuccess: (payload: any) => {
      const message = payload.message as ChatMessage;
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => mergeMessage(current, { ...message, isOwn: true, canEdit: true, canDelete: true }));
      setChatInput(""); setReplyingTo(null); setChatError("");
    },
    onError: (error) => setChatError(errorMessage(error)),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) =>
      (await apiRequest("PATCH", `/community-live/messages/${id}`, { message })).json(),
    onSuccess: (payload: any) => {
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => mergeMessage(current, { ...payload.message, isOwn: true, canEdit: true, canDelete: true }));
      setEditingId(null); setEditingText(""); setChatError("");
    },
    onError: (error) => setChatError(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (message: ChatMessage) => {
      const path = adminCheck?.isAdmin && message.userId !== user?.id
        ? `/community-live/admin/messages/${message.id}`
        : `/community-live/messages/${message.id}`;
      return (await apiRequest("DELETE", path, {})).json();
    },
    onSuccess: (payload: any) => {
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => mergeMessage(current, payload.message));
      setChatError("");
    },
    onError: (error) => setChatError(errorMessage(error)),
  });

  const submitChat = () => {
    const message = chatInput.trim();
    if (!message || sendMutation.isPending) return;
    setChatError("");
    sendMutation.mutate({ message, replyToId: replyingTo?.id || null });
  };

  const addMention = (message: ChatMessage) => {
    const token = `@${mentionHandle(message.teamName)} `;
    setChatInput((current) => current.includes(token.trim()) ? current : `${current}${current && !current.endsWith(" ") ? " " : ""}${token}`.slice(0, 280));
    setMode("community"); setOpen(true);
  };

  const ask = (question: string) => {
    if (!question.trim()) return;
    setAnswer(localArenaAnswer(question));
    setHelpInput("");
  };

  return (
    <>
      <MarketplaceListingActivity />
      <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-3 z-[90] sm:bottom-4 sm:right-4">
      {open ? (
        <Card className="mb-2 flex max-h-[min(76dvh,640px)] w-[min(calc(100vw-1.5rem),410px)] flex-col overflow-hidden border-white/15 bg-slate-950/82 text-white shadow-[0_24px_80px_rgba(0,0,0,.58)] backdrop-blur-2xl sm:mb-3">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[.035] px-3 py-2.5">
            <div className="min-w-0"><div className="flex items-center gap-2"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-55" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" /></span><p className="truncate text-sm font-black">{mode === "community" ? "Community Live" : "Arena Help"}</p>{adminCheck?.isAdmin && mode === "community" ? <span className="rounded-full bg-violet-300/15 px-2 py-0.5 text-[9px] font-black text-violet-200">ADMIN</span> : null}</div><p className="mt-0.5 truncate text-[11px] text-white/45">{mode === "community" ? "Public manager chat · respectful language only" : "Fantasy Arena guide"}</p></div>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-white/65 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} aria-label="Close floating panel"><X className="h-4 w-4" /></Button>
          </div>

          <div className="grid grid-cols-2 border-b border-white/10 bg-black/20 p-1.5">
            <button onClick={() => setMode("community")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${mode === "community" ? "bg-cyan-300/15 text-cyan-200" : "text-white/45 hover:bg-white/5"}`}><Users className="h-3.5 w-3.5" />Community</button>
            <button onClick={() => setMode("help")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${mode === "help" ? "bg-violet-300/15 text-violet-200" : "text-white/45 hover:bg-white/5"}`}><HelpCircle className="h-3.5 w-3.5" />Help</button>
          </div>

          {mode === "community" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={scrollRef} className="min-h-[260px] flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:min-h-[330px]">
                {isLoading ? <p className="py-10 text-center text-sm text-white/40">Connecting to the community…</p> : null}
                {!isLoading && !messages.length ? <div className="py-10 text-center"><MessageCircle className="mx-auto h-8 w-8 text-cyan-200/45" /><p className="mt-2 text-sm font-semibold text-white/70">Start the conversation</p></div> : null}
                {messages.map((message) => {
                  const own = Boolean(message.isOwn || message.userId === user?.id);
                  const canEdit = Boolean(!message.deletedAt && own);
                  const canDelete = Boolean(!message.deletedAt && (own || adminCheck?.isAdmin));
                  const editing = editingId === message.id;
                  return (
                    <div key={message.id} data-community-message-id={message.id} className={`group flex ${own ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[90%] rounded-2xl border px-3 py-2 ${highlightedMessageId === message.id ? "border-amber-200/80 bg-amber-300/15 ring-2 ring-amber-200/55" : own ? "border-cyan-200/20 bg-cyan-300/12" : "border-white/10 bg-white/[.055]"} ${message.deletedAt ? "opacity-55" : ""}`}>
                        {message.replyTo ? <div className="mb-2 rounded-xl border-l-2 border-cyan-300/45 bg-black/25 px-2 py-1.5 text-[10px] text-white/48"><span className="font-black text-cyan-200/70">{message.replyTo.teamName}</span><p className="mt-0.5 line-clamp-2">{message.replyTo.message}</p></div> : null}
                        <div className="mb-1 flex items-center gap-2 text-[10px]"><button type="button" onClick={() => addMention(message)} disabled={own || Boolean(message.deletedAt)} className={`max-w-[180px] truncate font-black ${own ? "text-cyan-200" : "text-white/65 hover:text-cyan-200"}`}>{own ? "You" : message.teamName || "Arena Manager"}</button><span className="text-white/30">{formatMessageTime(message.createdAt)}</span>{message.editedAt ? <span className="text-white/25">edited</span> : null}</div>
                        {editing ? <div className="space-y-2"><textarea value={editingText} onChange={(event) => setEditingText(event.target.value.slice(0, 280))} rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-2 text-sm text-white outline-none focus:border-cyan-300/40" /><div className="flex justify-end gap-2"><button onClick={() => { setEditingId(null); setEditingText(""); }} className="text-[10px] font-bold text-white/45">Cancel</button><button onClick={() => editMutation.mutate({ id: message.id, message: editingText.trim() })} disabled={!editingText.trim() || editMutation.isPending} className="rounded-lg bg-cyan-300 px-2 py-1 text-[10px] font-black text-slate-950">Save</button></div></div> : <p className={`whitespace-pre-wrap break-words text-sm leading-5 ${message.deletedAt ? "italic text-white/45" : "text-white/90"}`}>{message.message}</p>}
                        {!message.deletedAt && !editing ? <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/7 pt-1.5 text-[9px] font-black uppercase tracking-[.08em] text-white/35 sm:opacity-0 sm:transition sm:group-hover:opacity-100"><button onClick={() => { setReplyingTo(message); setChatError(""); }} className="flex items-center gap-1 hover:text-cyan-200"><Reply className="h-3 w-3" />Reply</button>{!own ? <button onClick={() => addMention(message)} className="flex items-center gap-1 hover:text-cyan-200"><AtSign className="h-3 w-3" />Mention</button> : null}{canEdit ? <button onClick={() => { setEditingId(message.id); setEditingText(message.message); }} className="flex items-center gap-1 hover:text-amber-200"><Pencil className="h-3 w-3" />Edit</button> : null}{canDelete ? <button onClick={() => window.confirm(adminCheck?.isAdmin && !own ? "Delete this community message as administrator?" : "Delete your message?") && deleteMutation.mutate(message)} className="flex items-center gap-1 hover:text-rose-200"><Trash2 className="h-3 w-3" />{adminCheck?.isAdmin && !own ? "Admin delete" : "Delete"}</button> : null}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-white/10 bg-black/25 p-2.5">
                {replyingTo ? <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-cyan-200/15 bg-cyan-300/[.06] px-3 py-2"><div className="min-w-0 text-[10px] text-white/48"><span className="font-black text-cyan-200">Replying to {replyingTo.teamName}</span><p className="mt-0.5 truncate">{replyingTo.message}</p></div><button onClick={() => setReplyingTo(null)} className="text-white/35 hover:text-white"><X className="h-3.5 w-3.5" /></button></div> : null}
                <div className="flex items-end gap-2"><textarea value={chatInput} onChange={(event) => { setChatInput(event.target.value.slice(0, 280)); setChatError(""); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitChat(); } }} rows={2} maxLength={280} placeholder={replyingTo ? `Reply to ${replyingTo.teamName}…` : "Message the community…"} className="min-h-[42px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[.055] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-200/35" /><Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-cyan-300 text-slate-950 hover:bg-cyan-200" onClick={submitChat} disabled={!chatInput.trim() || sendMutation.isPending} aria-label="Send community message"><Send className="h-4 w-4" /></Button></div>
                <div className="mt-1 flex items-center justify-between gap-2 px-1"><p className="truncate text-[10px] text-rose-200">{chatError || "Profanity and slurs are automatically blocked."}</p><p className="shrink-0 text-[10px] text-white/25">{chatInput.length}/280</p></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto p-3"><div className="max-h-48 min-h-28 overflow-auto rounded-xl border border-white/10 bg-white/[.045] p-3"><p className="mb-1 text-xs font-semibold text-white/45">Fantasy Arena guide</p><p className="whitespace-pre-wrap text-sm leading-6 text-white/85">{answer}</p></div><div className="grid grid-cols-2 gap-2">{quickHelp.map((item) => <Button key={item.label} size="sm" variant="outline" className="h-9 border-white/10 bg-white/[.035] text-xs text-white hover:bg-white/10" onClick={() => ask(item.label)}>{item.label}</Button>)}</div><div className="flex gap-2"><Input value={helpInput} onChange={(event) => setHelpInput(event.target.value)} placeholder="Ask about funding or fees" maxLength={180} onKeyDown={(event) => event.key === "Enter" && ask(helpInput)} className="border-white/10 bg-white/[.045] text-white" /><Button size="icon" onClick={() => ask(helpInput)} disabled={!helpInput.trim()}><Sparkles className="h-4 w-4" /></Button></div><Link href="/contact-us"><Button variant="outline" className="w-full border-white/10 bg-white/[.035] text-white"><Mail className="mr-2 h-4 w-4" />Contact Support</Button></Link></div>
          )}
        </Card>
      ) : null}

      {!open && latestMention ? <button type="button" onClick={() => { void openCommunityMention(latestMention); }} className="mb-2 block max-w-[310px] rounded-2xl border border-amber-200/35 bg-slate-950/88 px-3 py-2.5 text-left text-white shadow-xl backdrop-blur-xl transition hover:border-amber-200/60" data-help="Open the exact Community Live message that mentioned you."><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-amber-200"><AtSign className="h-3.5 w-3.5" />You were mentioned{unreadMentions.length > 1 ? <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] text-slate-950">{unreadMentions.length}</span> : null}</div><p className="mt-1 truncate text-xs text-white/70">{String(latestMention.message || "Open your message")}</p></button> : !open && latestPreview ? <button type="button" onClick={() => { setMode("community"); setOpen(true); }} className="mb-2 block max-w-[290px] rounded-2xl border border-white/12 bg-slate-950/58 px-3 py-2 text-left text-white shadow-xl backdrop-blur-xl transition hover:bg-slate-950/78" data-help="Open Community Live to read and reply to public manager messages."><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-cyan-200"><span className="h-2 w-2 rounded-full bg-emerald-400" />Community Live{unreadCount ? <span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[9px] text-slate-950">{unreadCount}</span> : null}</div><p className="mt-1 truncate text-xs text-white/55"><span className="font-bold text-white/72">{latestPreview.teamName}:</span> {latestPreview.message}</p></button> : null}

      <div className="flex justify-end gap-2"><Button size="icon" aria-label="Open Arena help" className="h-10 w-10 rounded-full border border-violet-200/20 bg-violet-500/75 shadow-xl backdrop-blur-xl hover:bg-violet-400 sm:h-11 sm:w-11" onClick={() => { setMode("help"); setOpen(true); }}><HelpCircle className="h-4 w-4" /></Button><Button size="icon" aria-label="Open Community Live" className="relative h-11 w-11 rounded-full border border-cyan-200/25 bg-cyan-400/80 text-slate-950 shadow-xl backdrop-blur-xl hover:bg-cyan-300 sm:h-12 sm:w-12" onClick={() => { if (latestMention && !open) { void openCommunityMention(latestMention); return; } setMode("community"); setOpen((value) => mode === "community" ? !value : true); }}>{open && mode === "community" ? <Bot className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}{(unreadMentions.length || unreadCount) && !(open && mode === "community") ? <span className={`absolute -right-1 -top-1 min-w-5 rounded-full px-1 text-[10px] font-black leading-5 text-white ${unreadMentions.length ? "bg-amber-500" : "bg-rose-500"}`}>{Math.min(99, unreadMentions.length || unreadCount)}</span> : null}</Button></div>
      </div>
    </>
  );
}

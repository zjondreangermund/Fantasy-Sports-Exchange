import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bot, HelpCircle, Mail, MessageCircle, Send, Sparkles, Users, X } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { apiRequest, queryClient } from "../lib/queryClient";

const quickHelp = [
  {
    label: "Fees",
    keywords: ["fee", "fees", "platform", "deposit", "withdraw", "marketplace"],
    answer:
      "Tournament entry fees use the prize and platform split shown before entry. Marketplace sales charge an 8% platform fee, so the seller receives 92%. The minimum withdrawal is N$20 and Fantasy Arena charges no withdrawal fee; a bank, eWallet or payment gateway may deduct its own external processing fee. Deposits below N$200 carry a 2% fee, while deposits of N$200 or more are fee-free.",
  },
  {
    label: "Join tournament",
    keywords: ["join", "pin", "tournament", "competition", "enter"],
    answer:
      "Open Play, choose a public tournament or enter a private tournament PIN, then build a five-card team with GK, DEF, MID, FWD and one Utility card. Select a captain and review the entry fee and rarity requirement before submitting. Submitted cards remain locked until that entry is settled or cancelled.",
  },
  {
    label: "Lineup rules",
    keywords: ["lineup", "team", "cards", "gk", "def", "mid", "fwd", "captain"],
    answer:
      "Every tournament entry needs exactly five different players: one Goalkeeper, one Defender, one Midfielder, one Forward and one Utility card of any position allowed by the tournament. One selected card must be captain. Cards listed for sale or locked in another unresolved entry cannot be selected.",
  },
  {
    label: "Rarity rules",
    keywords: ["rarity", "common", "rare", "unique", "epic", "legendary"],
    answer:
      "Common requires 5 Common cards. Rare requires at least 4 Rare cards, with the fifth Common or Rare. Unique requires at least 3 Unique cards, with the remaining two Common, Rare or Unique. Epic requires at least 2 Epic cards, with the remaining three Common, Rare, Unique or Epic. Legendary requires at least 1 Legendary card and any four additional eligible cards.",
  },
  {
    label: "Marketplace",
    keywords: ["sell", "buy", "card", "market", "marketplace", "listing", "loan"],
    answer:
      "Buy, sell and supported loan actions take place through the Marketplace. Buyers pay the confirmed amount, sellers receive the net amount after the displayed 8% marketplace fee, and rarity floor prices apply. Common cards are tournament-only and are not tradable.",
  },
  {
    label: "Rewards",
    keywords: ["reward", "winner", "prize", "won", "claim"],
    answer:
      "After settlement, winners receive a congratulations message from the Fantasy Arena Team. Cash rewards are credited according to the settlement record. Prize Vault winners should open My Teams & Prizes, start the prize claim, confirm contact and delivery details, complete any required verification and wait for fulfilment confirmation. Prize fulfilment is subject to availability; an equivalent prize or approved equivalent value may be offered.",
  },
];

type WidgetMode = "community" | "help";
type ChatMessage = {
  id: number;
  userId: string;
  teamName: string;
  avatarUrl?: string | null;
  message: string;
  createdAt: string;
  isOwn?: boolean;
};
type CurrentUser = { id?: string; managerTeamName?: string | null; name?: string | null };

const chatQueryKey = ["/api/community-chat/messages"] as const;
const lastSeenStorageKey = "fantasy_arena_community_chat_last_seen";

function localArenaAnswer(message: string) {
  const text = message.toLowerCase();
  const match = quickHelp.find((item) => item.keywords.some((keyword) => text.includes(keyword)));
  if (match) return match.answer;
  return "Ask about fees, deposits, withdrawals, tournament entry, lineup rules, rarity requirements, marketplace trading or winner rewards. For an account-specific matter, use Contact Us.";
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mergeMessage(messages: ChatMessage[] | undefined, incoming: ChatMessage) {
  const current = Array.isArray(messages) ? messages : [];
  const next = [...current.filter((message) => message.id !== incoming.id), incoming].sort((a, b) => a.id - b.id);
  return next.slice(-80);
}

export default function FloatingSupportWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WidgetMode>("community");
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState(
    "Choose a topic or ask about Fantasy Arena fees, tournament entries, card rarity, lineups, marketplace trading or rewards.",
  );
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [lastSeenId, setLastSeenId] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem(lastSeenStorageKey) || 0) || 0;
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: user } = useQuery<CurrentUser>({ queryKey: ["/api/user"] });
  const { data: messages = [], isLoading: chatLoading } = useQuery<ChatMessage[]>({
    queryKey: chatQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/community-chat/messages", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load community chat");
      const payload = await response.json();
      return Array.isArray(payload) ? payload : payload.messages || [];
    },
    staleTime: 0,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const stream = new EventSource("/api/community-chat/stream");
    const onMessage = (event: Event) => {
      try {
        const raw = JSON.parse((event as MessageEvent).data) as ChatMessage;
        const incoming = { ...raw, isOwn: Boolean(user?.id && raw.userId === user.id) };
        queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => mergeMessage(current, incoming));
      } catch {}
    };
    stream.addEventListener("community-message", onMessage);
    return () => {
      stream.removeEventListener("community-message", onMessage);
      stream.close();
    };
  }, [user?.id]);

  const latestId = messages[messages.length - 1]?.id || 0;
  const unreadCount = useMemo(
    () => messages.filter((message) => message.id > lastSeenId && !message.isOwn && message.userId !== user?.id).length,
    [lastSeenId, messages, user?.id],
  );
  const latestPreview = messages[messages.length - 1];

  useEffect(() => {
    if (!open || mode !== "community" || latestId <= 0) return;
    setLastSeenId(latestId);
    window.localStorage.setItem(lastSeenStorageKey, String(latestId));
  }, [latestId, mode, open]);

  useEffect(() => {
    if (!open || mode !== "community") return;
    const timer = window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [messages.length, mode, open]);

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/community-chat/messages", { message });
      const payload = await response.json();
      return payload.message as ChatMessage;
    },
    onSuccess: (message) => {
      setChatInput("");
      setChatError("");
      queryClient.setQueryData<ChatMessage[]>(chatQueryKey, (current) => mergeMessage(current, { ...message, isOwn: true }));
    },
    onError: (error) => {
      const raw = error instanceof Error ? error.message : String(error || "");
      setChatError(/429/.test(raw) ? "Please wait a moment before sending another message." : "Your message could not be sent. Please try again.");
    },
  });

  const ask = (question: string) => {
    const value = question.trim();
    if (!value) return;
    setAnswer(localArenaAnswer(value));
    setInput("");
  };

  const submitChat = () => {
    const message = chatInput.trim();
    if (!message || sendMessage.isPending) return;
    setChatError("");
    sendMessage.mutate(message);
  };

  const openCommunity = () => {
    setMode("community");
    setOpen(true);
  };

  return (
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-3 z-[90] sm:bottom-4 sm:right-4">
      {open ? (
        <Card className="mb-2 flex max-h-[min(72dvh,580px)] w-[min(calc(100vw-1.5rem),390px)] flex-col overflow-hidden border-white/15 bg-slate-950/80 text-white shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:mb-3">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[.035] px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-55" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <p className="truncate text-sm font-black">{mode === "community" ? "Community Live" : "Arena Help"}</p>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-white/45">{mode === "community" ? "Public manager chat" : "Current Fantasy Arena rules"}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-white/65 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} aria-label="Close floating panel">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 border-b border-white/10 bg-black/20 p-1.5">
            <button onClick={() => setMode("community")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${mode === "community" ? "bg-cyan-300/15 text-cyan-200" : "text-white/45 hover:bg-white/5 hover:text-white/70"}`}>
              <Users className="h-3.5 w-3.5" />Community
            </button>
            <button onClick={() => setMode("help")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${mode === "help" ? "bg-violet-300/15 text-violet-200" : "text-white/45 hover:bg-white/5 hover:text-white/70"}`}>
              <HelpCircle className="h-3.5 w-3.5" />Help
            </button>
          </div>

          {mode === "community" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={scrollRef} className="min-h-[240px] flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:min-h-[300px]">
                {chatLoading ? <p className="py-10 text-center text-sm text-white/40">Connecting to the community…</p> : null}
                {!chatLoading && !messages.length ? <div className="py-10 text-center"><MessageCircle className="mx-auto h-8 w-8 text-cyan-200/45" /><p className="mt-2 text-sm font-semibold text-white/70">Start the conversation</p><p className="mt-1 text-xs text-white/40">Chat about tournaments, cards and matchday.</p></div> : null}
                {messages.map((message) => {
                  const own = Boolean(message.isOwn || (user?.id && message.userId === user.id));
                  return (
                    <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[86%] rounded-2xl border px-3 py-2 ${own ? "border-cyan-200/20 bg-cyan-300/12" : "border-white/10 bg-white/[.055]"}`}>
                        <div className="mb-1 flex items-center gap-2 text-[10px]">
                          <span className={`max-w-[180px] truncate font-black ${own ? "text-cyan-200" : "text-white/65"}`}>{own ? "You" : message.teamName || "Arena Manager"}</span>
                          <span className="text-white/30">{formatMessageTime(message.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-5 text-white/90">{message.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-white/10 bg-black/25 p-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    value={chatInput}
                    onChange={(event) => {
                      setChatInput(event.target.value.slice(0, 280));
                      if (chatError) setChatError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submitChat();
                      }
                    }}
                    rows={2}
                    maxLength={280}
                    placeholder="Message the community…"
                    className="min-h-[42px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[.055] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-200/35"
                  />
                  <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-cyan-300 text-slate-950 hover:bg-cyan-200" onClick={submitChat} disabled={!chatInput.trim() || sendMessage.isPending} aria-label="Send community message">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 px-1">
                  <p className="truncate text-[10px] text-rose-200">{chatError}</p>
                  <p className="shrink-0 text-[10px] text-white/25">{chatInput.length}/280</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto p-3">
              <div className="max-h-48 min-h-28 overflow-auto rounded-xl border border-white/10 bg-white/[.045] p-3">
                <p className="mb-1 text-xs font-semibold text-white/45">Fantasy Arena guide</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-white/85">{answer}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {quickHelp.map((item) => (
                  <Button key={item.label} size="sm" variant="outline" className="h-9 border-white/10 bg-white/[.035] text-xs text-white hover:bg-white/10" onClick={() => ask(item.label)}>
                    {item.label}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about fees or entries"
                  maxLength={180}
                  className="border-white/10 bg-white/[.045] text-white placeholder:text-white/30"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") ask(input);
                  }}
                />
                <Button size="icon" onClick={() => ask(input)} disabled={!input.trim()} aria-label="Ask Arena help">
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>

              <Link href="/contact-us">
                <Button variant="outline" className="w-full border-white/10 bg-white/[.035] text-white hover:bg-white/10">
                  <Mail className="mr-2 h-4 w-4" /> Contact Fantasy Arena Support
                </Button>
              </Link>
            </div>
          )}
        </Card>
      ) : null}

      <button
        type="button"
        aria-label={open ? "Close community chat" : "Open community live chat"}
        onClick={() => (open ? setOpen(false) : openCommunity())}
        className="group flex h-11 max-w-[220px] items-center gap-2 rounded-full border border-cyan-100/15 bg-slate-950/75 px-3 text-white/85 opacity-85 shadow-[0_10px_35px_rgba(0,0,0,.42)] backdrop-blur-xl transition hover:border-cyan-200/30 hover:bg-slate-950/90 hover:opacity-100"
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-200">
          {open ? <Bot className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
          {!open ? <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" /> : null}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block text-[11px] font-black leading-3">Community Live</span>
          <span className="block max-w-[125px] truncate text-[10px] leading-4 text-white/35">{latestPreview ? `${latestPreview.teamName}: ${latestPreview.message}` : "Join the manager chat"}</span>
        </span>
        {unreadCount > 0 ? <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{Math.min(99, unreadCount)}</span> : null}
      </button>
    </div>
  );
}

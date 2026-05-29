import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircle, Bot, Send, Sparkles, X, HelpCircle } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type LiveChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
};

const quickHelp = [
  {
    label: "Fees",
    keywords: ["fee", "fees", "platform", "deposit", "withdraw", "marketplace"],
    answer: "Fantasy Arena fees: tournaments take 20% platform fee and 80% goes to prize pool. Marketplace sales take 8%, so sellers receive 92%. Withdrawals have a 3.5% fee. Deposits under N$200 have a 2% fee; deposits of N$200 or more have no deposit fee.",
  },
  {
    label: "Join tournament",
    keywords: ["join", "pin", "tournament", "competition", "enter"],
    answer: "To join a tournament, go to Tournaments. For public comps, tap Enter Tournament. For private comps, open Join by PIN, enter the PIN or invite link, then choose 5 cards of the correct rarity and set a captain. The entry fee is deducted from your wallet when you enter.",
  },
  {
    label: "Lineup rules",
    keywords: ["lineup", "team", "cards", "gk", "def", "mid", "fwd", "captain"],
    answer: "A tournament lineup needs exactly 5 cards. You need at least 1 GK, 1 DEF, 1 MID and 1 FWD. Your 5th card is a utility slot. Your captain must be one of the selected cards.",
  },
  {
    label: "Rarity rules",
    keywords: ["rarity", "common", "rare", "unique", "legendary"],
    answer: "Most tournaments require cards that match the tournament rarity. A Common tournament needs Common cards only, Rare needs Rare cards only, Unique needs Unique cards only, and Legendary needs Legendary cards only. Listed-for-sale cards cannot enter tournaments.",
  },
  {
    label: "Marketplace",
    keywords: ["sell", "buy", "card", "market", "marketplace", "listing"],
    answer: "In the marketplace, buyers pay the full listed price. The seller receives 92% and Fantasy Arena keeps an 8% marketplace fee. Common cards are tournament-only and cannot be traded if your economy settings block common trading.",
  },
  {
    label: "Rewards",
    keywords: ["reward", "winner", "prize", "won", "claim"],
    answer: "When a tournament is settled, the winner receives the configured prize. Rewards are tracked so the same tournament should not pay out twice. If a card reward is missing, admin can check the integrity tools and repair rewards.",
  },
];

function localArenaAnswer(message: string) {
  const text = message.toLowerCase();
  const match = quickHelp.find((item) => item.keywords.some((keyword) => text.includes(keyword)));
  if (match) return match.answer;
  return "I can help with Fantasy Arena basics. Try asking about fees, joining a tournament, PIN tournaments, lineup rules, card rarity, marketplace sales, withdrawals, deposits or rewards.";
}

export default function FloatingSupportWidget() {
  const [open, setOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiAnswer, setAiAnswer] = useState("Ask about fees, PIN tournaments, lineup rules, rarity, marketplace or rewards.");

  const { data: chatMessages, refetch: refetchChat } = useQuery<LiveChatMessage[]>({
    queryKey: ["/api/live-chat/messages?limit=24"],
    queryFn: async () => {
      const res = await fetch("/api/live-chat/messages?limit=24", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: open ? 5000 : false,
  });

  const sendChatMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/live-chat/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: async () => {
      setChatInput("");
      await refetchChat();
    },
  });

  const aiMutation = useMutation({
    mutationFn: async (message: string) => {
      const fallback = localArenaAnswer(message);
      try {
        const res = await fetch("/api/ai/help", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        if (!res.ok) return { answer: fallback };
        const data = await res.json();
        return { answer: String(data?.answer || fallback) };
      } catch {
        return { answer: fallback };
      }
    },
    onSuccess: (data) => {
      setAiAnswer(String(data?.answer || "No answer available."));
      setAiInput("");
    },
  });

  const latestMessages = useMemo(
    () => (Array.isArray(chatMessages) ? [...chatMessages].slice(-12).reverse() : []),
    [chatMessages],
  );

  const askQuick = (question: string) => {
    setAiInput("");
    aiMutation.mutate(question);
  };

  return (
    <div className="fixed bottom-20 right-3 z-[90] sm:bottom-4 sm:right-4">
      {open && (
        <Card className="mb-2 w-[min(92vw,360px)] max-h-[70vh] overflow-hidden border-border/70 bg-background/95 backdrop-blur-lg shadow-2xl sm:mb-3 sm:w-[min(92vw,380px)]">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Arena Help</p>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="ai" className="p-3">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="ai">Help</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-3 space-y-2">
              <div className="rounded-md border border-border/60 bg-background/60 p-2 min-h-24 max-h-44 overflow-auto">
                <p className="text-xs text-muted-foreground mb-1">Fantasy Arena helper</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{aiAnswer}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickHelp.slice(0, 4).map((item) => (
                  <Button key={item.label} size="sm" variant="outline" className="h-8 text-xs" onClick={() => askQuick(item.label)}>
                    {item.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask about fees or lineups"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const question = aiInput.trim();
                    if (!question || aiMutation.isPending) return;
                    aiMutation.mutate(question);
                  }}
                />
                <Button
                  size="icon"
                  onClick={() => {
                    const question = aiInput.trim();
                    if (!question || aiMutation.isPending) return;
                    aiMutation.mutate(question);
                  }}
                  disabled={aiMutation.isPending || aiInput.trim().length === 0}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="chat" className="mt-3 space-y-2">
              <div className="max-h-52 overflow-auto space-y-2 rounded-md border border-border/60 bg-background/60 p-2">
                {latestMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No live messages yet.</p>
                ) : (
                  latestMessages.map((message) => (
                    <div key={message.id} className="rounded-md border border-border/50 px-2 py-1.5">
                      <p className="text-[11px] font-medium text-foreground">{message.userName}</p>
                      <p className="text-xs text-foreground/90 break-words">{message.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Message the community"
                  maxLength={280}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const text = chatInput.trim();
                    if (!text || sendChatMutation.isPending) return;
                    sendChatMutation.mutate(text);
                  }}
                />
                <Button
                  size="icon"
                  onClick={() => {
                    const text = chatInput.trim();
                    if (!text || sendChatMutation.isPending) return;
                    sendChatMutation.mutate(text);
                  }}
                  disabled={sendChatMutation.isPending || chatInput.trim().length === 0}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      )}

      <Button
        size="icon"
        aria-label={open ? "Close Arena help" : "Open Arena help"}
        className="h-10 w-10 rounded-full shadow-xl sm:h-12 sm:w-12"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <Bot className="h-4 w-4 sm:h-5 sm:w-5" /> : <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
      </Button>
    </div>
  );
}

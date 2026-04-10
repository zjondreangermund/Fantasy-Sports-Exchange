import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircle, Bot, Send, Sparkles, X } from "lucide-react";
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

export default function FloatingSupportWidget() {
  const [open, setOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");

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
      const res = await fetch("/api/ai/help", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed to get AI help");
      return res.json() as Promise<{ answer: string }>;
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

  return (
    <div className="fixed bottom-4 right-4 z-[90]">
      {open && (
        <Card className="mb-3 w-[min(92vw,380px)] border-border/70 bg-background/95 backdrop-blur-lg shadow-2xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Live Help Center</p>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="chat" className="p-3">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="chat">Live Chat</TabsTrigger>
              <TabsTrigger value="ai">AI Help</TabsTrigger>
            </TabsList>

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

            <TabsContent value="ai" className="mt-3 space-y-2">
              <div className="rounded-md border border-border/60 bg-background/60 p-2 min-h-24">
                <p className="text-xs text-muted-foreground mb-1">Ask about lineup rules, rarity restrictions, referrals, and auctions.</p>
                {aiAnswer ? (
                  <p className="text-sm text-foreground">{aiAnswer}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">AI response will appear here.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask AI helper"
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
          </Tabs>
        </Card>
      )}

      <Button
        size="lg"
        className="rounded-full shadow-xl px-4"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <Bot className="h-5 w-5 mr-2" /> : <MessageCircle className="h-5 w-5 mr-2" />}
        {open ? "Close Help" : "Live Chat + AI"}
      </Button>
    </div>
  );
}

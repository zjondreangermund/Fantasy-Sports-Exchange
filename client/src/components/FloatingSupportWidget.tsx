import { useState } from "react";
import { Link } from "wouter";
import { Bot, HelpCircle, Mail, Sparkles, X } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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

function localArenaAnswer(message: string) {
  const text = message.toLowerCase();
  const match = quickHelp.find((item) => item.keywords.some((keyword) => text.includes(keyword)));
  if (match) return match.answer;
  return "Ask about fees, deposits, withdrawals, tournament entry, lineup rules, rarity requirements, marketplace trading or winner rewards. For an account-specific matter, use Contact Us.";
}

export default function FloatingSupportWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState(
    "Choose a topic or ask about Fantasy Arena fees, tournament entries, card rarity, lineups, marketplace trading or rewards.",
  );

  const ask = (question: string) => {
    const value = question.trim();
    if (!value) return;
    setAnswer(localArenaAnswer(value));
    setInput("");
  };

  return (
    <div className="fixed bottom-20 right-3 z-[90] hidden md:block sm:bottom-4 sm:right-4">
      {open ? (
        <Card className="mb-2 max-h-[70vh] w-[min(92vw,380px)] overflow-hidden border-border/70 bg-background/95 shadow-2xl backdrop-blur-lg sm:mb-3">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Arena Help</p>
              <p className="text-[11px] text-muted-foreground">Current Fantasy Arena rules</p>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Close Arena help">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3 p-3">
            <div className="max-h-48 min-h-28 overflow-auto rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Fantasy Arena guide</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{answer}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {quickHelp.map((item) => (
                <Button key={item.label} size="sm" variant="outline" className="h-9 text-xs" onClick={() => ask(item.label)}>
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
                onKeyDown={(event) => {
                  if (event.key === "Enter") ask(input);
                }}
              />
              <Button size="icon" onClick={() => ask(input)} disabled={!input.trim()} aria-label="Ask Arena help">
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>

            <Link href="/contact-us">
              <Button variant="outline" className="w-full">
                <Mail className="mr-2 h-4 w-4" /> Contact Fantasy Arena Support
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      <Button
        size="icon"
        aria-label={open ? "Close Arena help" : "Open Arena help"}
        className="h-10 w-10 rounded-full shadow-xl sm:h-12 sm:w-12"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <Bot className="h-4 w-4 sm:h-5 sm:w-5" /> : <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
      </Button>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import CardRevealScene, { getRevealDuration, type RevealRarity } from "../components/CardRevealScene";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

export default function CardRevealPage() {
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const source = searchParams.get("source") || "";
  const rewardMode = source === "tournament-reward";
  const cardIdParam = Number(searchParams.get("cardId") || 0);
  const rarityParam = (searchParams.get("rarity") || "").toLowerCase();
  const [, setLocation] = useLocation();
  const [rarity, setRarity] = useState<RevealRarity>(
    rarityParam === "common" || rarityParam === "rare" || rarityParam === "epic" || rarityParam === "legendary"
      ? (rarityParam as RevealRarity)
      : "legendary",
  );
  const [replayKey, setReplayKey] = useState(0);
  const [completed, setCompleted] = useState(false);

  const { data: cards, isLoading } = useQuery<PlayerCardWithPlayer[]>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cards");
      const data = await res.json();
      return Array.isArray(data) ? data : data.cards || [];
    },
  });

  const card = useMemo(() => {
    if (!cards?.length) return null;
    if (cardIdParam > 0) {
      const byId = cards.find((item) => Number(item.id) === cardIdParam);
      if (byId) return byId;
    }
    return cards.find((item) => String(item.rarity || "").toLowerCase() === rarity) || cards[0];
  }, [cards, rarity, cardIdParam]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white/80">
        Loading reveal scene...
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-black text-white/80">
        <p>No cards available for reveal.</p>
        <Button onClick={() => setLocation("/collection")}>Go to Collection</Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] overflow-hidden bg-black">
      <CardRevealScene
        cardData={card}
        rarity={rarity}
        duration={getRevealDuration(rarity)}
        replayKey={replayKey}
        onComplete={() => setCompleted(true)}
      />

      {!rewardMode && (
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
          {(["common", "rare", "epic", "legendary"] as RevealRarity[]).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={rarity === value ? "default" : "outline"}
              onClick={() => {
                setRarity(value);
                setCompleted(false);
                setReplayKey((k) => k + 1);
              }}
            >
              {value}
            </Button>
          ))}
        </div>
      )}

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Badge variant="secondary">{rarity.toUpperCase()} • {getRevealDuration(rarity)}s</Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setCompleted(false);
            setReplayKey((k) => k + 1);
          }}
        >
          Replay
        </Button>
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {completed ? (
          <>
            <Badge>{rewardMode ? "Reward Claimed" : "Reveal Complete"}</Badge>
            <Button onClick={() => setLocation(rewardMode ? "/dashboard" : "/collection")}>
              {rewardMode ? "Continue" : "Back to Collection"}
            </Button>
          </>
        ) : (
          <Badge variant="secondary">
            {rewardMode ? "Congratulations! Your tournament reward is revealing..." : "Cinematic reveal playing..."}
          </Badge>
        )}
      </div>
    </div>
  );
}

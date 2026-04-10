import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Metal3DCard from "../components/Metal3DCard";
import FantasyCardFan from "../components/FantasyCardFan";
import { fetchLocalPlayerRoster } from "../lib/local-player-roster";

export default function CardLabPage() {
  const { data: cards = [], isLoading, error } = useQuery({
    queryKey: ["local-roster-cards"],
    queryFn: () => fetchLocalPlayerRoster(),
  });

  const grouped = useMemo(() => {
    const order = ["common", "rare", "unique", "epic", "legendary"];
    return [...cards].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
  }, [cards]);

  const fanCards = useMemo(() => {
    const rarityPriority = ["legendary", "epic", "unique", "rare", "common"];
    return [...grouped]
      .sort((a, b) => rarityPriority.indexOf(a.rarity) - rarityPriority.indexOf(b.rarity))
      .slice(0, 4);
  }, [grouped]);

  return (
    <div className="flex-1 overflow-auto p-6 sm:p-8">
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="text-3xl font-black tracking-tight text-foreground">JSON Card Lab</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cards are loaded from /client/public/data/players.json and styled automatically by rarity.
        </p>

        {isLoading ? <p className="mt-6 text-sm text-muted-foreground">Loading cards...</p> : null}
        {error ? <p className="mt-6 text-sm text-red-400">Could not load roster JSON.</p> : null}

        {!isLoading && !error ? (
          <>
            {fanCards.length > 1 ? (
              <div className="mt-8">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">Stacked Preview</h2>
                <FantasyCardFan cards={fanCards} className="mt-3" />
              </div>
            ) : null}

            <div className="mt-8 grid grid-cols-1 place-items-center gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {grouped.map((card) => (
                <Metal3DCard key={card.id} player={card} className="!w-[220px]" />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

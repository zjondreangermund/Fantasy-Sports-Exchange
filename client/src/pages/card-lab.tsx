import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import FantasyCard from "../components/FantasyCard";
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
          <div className="mt-8 grid grid-cols-1 place-items-center gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {grouped.map((card) => (
              <FantasyCard key={card.id} player={card} className="!w-[220px]" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

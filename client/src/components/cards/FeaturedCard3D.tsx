import React from "react";
import Card3D from "../Card3D";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";

export default function FeaturedCard3D({
  card,
}: {
  card: PlayerCardWithPlayer;
}) {
  return (
    <div className="relative h-[420px] w-[280px] rounded-3xl overflow-hidden">
      <Card3D card={card} size="lg" />
    </div>
  );
}

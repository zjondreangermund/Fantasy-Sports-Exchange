import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { CARD_IMAGE_FALLBACK } from "../../lib/card-image";
import { cardVisualTokens, normalizeVisualRarity } from "./cardVisualTokens";
import { type PlayerCardData } from "./types";

export default function UnifiedPlayerCard({ player, className = "" }: { player: PlayerCardData; className?: string }) {
  const rarity = normalizeVisualRarity(player.rarity);
  const tokens = cardVisualTokens[player.rarity] || cardVisualTokens.common;

  const image = player.image || player.imageUrl || player.photo || CARD_IMAGE_FALLBACK;

  return (
    <div
      className={`relative w-[220px] aspect-[0.7/1] rounded-[28px] overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:-rotate-[1deg] ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* outer frame */}
      <div className={`absolute inset-0 rounded-[28px] ${tokens.frameOuter}`} />
      <div className="absolute inset-[4px] rounded-[24px] bg-black/80" />

      {/* engraved pattern */}
      <div
        className="absolute inset-[8px] rounded-[22px] opacity-70"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at center, rgba(255,255,255,0.08) 0px, transparent 3px)",
        }}
      />

      {/* content */}
      <div className="relative z-10 flex flex-col h-full p-3 text-white">

        {/* top */}
        <div className="text-[10px] flex justify-between opacity-80">
          <span>{player.season}</span>
          <span>{player.team?.slice(0, 3)}</span>
        </div>

        {/* image */}
        <div className="flex-1 flex items-center justify-center">
          <img
            src={image}
            className="h-[70%] object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]"
          />
        </div>

        {/* NAME (fixed visibility) */}
        <div className="text-center mt-2">
          <div className="text-[18px] font-black tracking-wide leading-none">
            {player.name}
          </div>
        </div>

        {/* stats */}
        <div className="mt-2 text-[10px] flex justify-between opacity-80">
          <span>{player.position}</span>
          <span>{player.rating}</span>
        </div>

        {/* footer */}
        <div className="mt-auto flex justify-between text-[10px] opacity-70">
          <span>{player.club}</span>
          <span className="flex items-center gap-1"><ShieldCheck size={12} />{player.nationality || ""}</span>
        </div>
      </div>
    </div>
  );
}

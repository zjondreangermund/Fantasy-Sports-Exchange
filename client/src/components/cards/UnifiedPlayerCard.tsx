import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { CARD_IMAGE_FALLBACK } from "../../lib/card-image";
import { cardVisualTokens, normalizeVisualRarity } from "./cardVisualTokens";
import { type PlayerCardData } from "./types";

export default function UnifiedPlayerCard({
  player,
  className = "",
}: {
  player: PlayerCardData;
  className?: string;
}) {
  const rarity = normalizeVisualRarity(player.rarity);
  const tokens = cardVisualTokens[player.rarity] || cardVisualTokens.common;

  const image =
    player.image || player.imageUrl || player.photo || CARD_IMAGE_FALLBACK;

  return (
    <div
      className={`relative w-[220px] aspect-[0.7/1] rounded-[28px] overflow-hidden transition-all duration-300 hover:scale-[1.05] hover:-rotate-[1deg] ${className}`}
    >
      {/* OUTER FRAME */}
      <div className={`absolute inset-0 rounded-[28px] ${tokens.frameOuter}`} />
      <div className="absolute inset-[3px] rounded-[25px] bg-black/90" />

      {/* INNER FRAME */}
      <div
        className={`absolute inset-[6px] rounded-[22px] bg-gradient-to-b ${tokens.frameInner}`}
      />

      {/* ENGRAVED PATTERN */}
      <div
        className="absolute inset-[6px] rounded-[22px] opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />

      {/* CONTENT */}
      <div className="relative z-10 flex flex-col h-full p-3 text-white">
        {/* TOP */}
        <div className="flex justify-between text-[10px] opacity-80">
          <span>{player.season || "2026-27"}</span>
          <span>{player.team?.slice(0, 3)}</span>
        </div>

        {/* BADGE */}
        <div className="mt-2 flex justify-between items-center">
          <span className="text-[10px] px-2 py-1 rounded-full border border-white/20">
            {player.rarity.toUpperCase()}
          </span>
          <span className="text-[10px] opacity-70">
            {player.serial}/{player.maxSupply}
          </span>
        </div>

        {/* IMAGE */}
        <div className="flex-1 flex items-center justify-center mt-2">
          <img
            src={image}
            className="h-[70%] object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.7)]"
          />
        </div>

        {/* NAME */}
        <div className="mt-2 text-center">
          <div className="text-[16px] font-bold uppercase tracking-wide">
            {player.name}
          </div>
        </div>

        {/* STATS */}
        <div className="mt-2 flex justify-between text-[10px] opacity-80">
          <span>{player.position}</span>
          <span className="font-bold">{player.rating}</span>
        </div>

        {/* LAST 5 */}
        <div className="mt-2 flex gap-1">
          {(player.last5Scores || []).map((s, i) => (
            <div
              key={i}
              className="w-2 rounded-full bg-white/40"
              style={{ height: `${Math.max(6, s * 0.4)}px` }}
            />
          ))}
        </div>

        {/* FOOTER */}
        <div className="mt-auto flex justify-between text-[10px] opacity-70">
          <span>{player.club}</span>
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} />
            {player.nationality || ""}
          </span>
        </div>
      </div>
    </div>
  );
}
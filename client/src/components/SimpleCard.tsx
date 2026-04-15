import { type PlayerCardData } from "./Metal3DCard";
import { useMemo, useState } from "react";
import { CARD_IMAGE_FALLBACK } from "../lib/card-image";
import { cardVisualTokens } from "./cards/cardVisualTokens";

type SimpleCardProps = {
  player: PlayerCardData;
  className?: string;
};

function fitName(name: string, max = 18) {
  const clean = String(name || "").trim().toUpperCase();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function getRarityLabel(rarity: PlayerCardData["rarity"]) {
  return String(rarity || "common").toUpperCase();
}

function getLast5(player: PlayerCardData) {
  const last5 = Array.isArray(player.last5Scores) ? player.last5Scores.slice(0, 5) : [];
  while (last5.length < 5) last5.push(0);
  return last5;
}

export default function SimpleCard({ player, className = "" }: SimpleCardProps) {
  const candidates = useMemo(() => {
    const list = [player.image, ...(player.imageCandidates || []), CARD_IMAGE_FALLBACK]
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(list));
  }, [player.image, player.imageCandidates]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))] || CARD_IMAGE_FALLBACK;
  const rarity = cardVisualTokens[player.rarity];
  const rarityLabel = getRarityLabel(player.rarity);
  const level = Math.max(1, Number(player.level) || 1);
  const xp = Math.max(0, Number(player.xp) || 0);
  const xpMax = Math.max(100, Number(player.xpMax) || 1000);
  const last5 = getLast5(player);
  const club = String(player.club || player.team || "FantasyFC").toUpperCase();
  const league = String(player.league || "Global League").toUpperCase();
  const name = fitName(player.name, 18);

  return (
    <article
      className={[
        "relative w-[148px] max-w-full aspect-[0.7/1] overflow-hidden rounded-[24px] border bg-gradient-to-b",
        rarity.shell,
        rarity.border,
        rarity.glow,
        className,
      ].join(" ")}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%),linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.08)_50%,rgba(0,0,0,0.24)_100%)]" />
      <div className={`absolute inset-0 bg-gradient-to-b ${rarity.wash}`} />
      <div className={`pointer-events-none absolute inset-[1px] rounded-[23px] bg-gradient-to-br ${rarity.frame}`} />
      <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[length:3px_3px] ${rarity.grain}`} />

      <div className="absolute left-3 top-3 z-20">
        <div className="text-[34px] font-black leading-none tracking-[-0.04em] text-white">{player.rating}</div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/90">{player.position}</div>
      </div>
      <div
        className={`absolute right-3 top-3 z-20 rounded-full border px-3 py-[5px] text-[9px] font-extrabold uppercase tracking-[0.18em] backdrop-blur-md ${rarity.badge}`}
      >
        {rarityLabel}
      </div>

      <div className="absolute inset-x-[10%] top-[17%] z-10 flex h-[48%] items-center justify-center [mask-image:radial-gradient(circle_at_50%_42%,black_58%,transparent_100%)]">
        {candidates.length > 0 ? (
          <img
            src={src}
            alt={player.name}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain drop-shadow-[0_16px_26px_rgba(0,0,0,0.55)]"
            onError={() => {
              if (candidateIndex < candidates.length - 1) {
                setCandidateIndex((prev) => prev + 1);
              }
            }}
          />
        ) : null}
      </div>

      <div className={`pointer-events-none absolute left-1/2 top-[44%] z-[11] h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-full ${rarity.halo} blur-3xl`} />

      <div className={`absolute left-[70%] top-[14%] z-20 h-2.5 w-2.5 rounded-full ${rarity.orb} shadow-[0_0_12px_rgba(255,255,255,0.95)]`} />
      <div className={`absolute left-[47%] top-[39%] z-20 h-4.5 w-4.5 rounded-full ${rarity.orb} shadow-[0_0_18px_rgba(255,255,255,0.95)]`} />
      <div className={`absolute left-[49%] top-[48%] z-20 h-3.5 w-3.5 rounded-full ${rarity.orb} shadow-[0_0_14px_rgba(255,255,255,0.95)]`} />
      {player.rarity !== "common" ? (
        <>
          <div className={`absolute left-[26%] top-[21%] z-20 h-1.5 w-1.5 animate-pulse rounded-full ${rarity.orb} shadow-[0_0_10px_rgba(255,255,255,0.95)]`} />
          <div className={`absolute left-[73%] top-[34%] z-20 h-1.5 w-1.5 animate-pulse rounded-full ${rarity.orb} shadow-[0_0_10px_rgba(255,255,255,0.95)]`} style={{ animationDelay: "220ms" }} />
          <div className={`absolute left-[38%] top-[55%] z-20 h-1 w-1 animate-pulse rounded-full ${rarity.orb} shadow-[0_0_8px_rgba(255,255,255,0.95)]`} style={{ animationDelay: "420ms" }} />
        </>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 z-20 text-center">
        <div className="mb-2 flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.11em] text-white/85">
          <span className="rounded-full border border-white/20 px-2 py-[2px]">{league}</span>
          <span className="rounded-full border border-white/20 px-2 py-[2px]">#{player.serial || 1}/{player.maxSupply || 0}</span>
        </div>
        <div className="flex items-center justify-center gap-3 text-[8px] font-bold uppercase tracking-[0.08em] text-white/85">
          <span>
            <span className="text-white/55">LV</span> {level}
          </span>
          <span>
            <span className="text-white/55">XP</span> {xp}/{xpMax}
          </span>
        </div>
        <div className="mt-2 truncate text-[11px] font-black uppercase leading-none text-white">{name}</div>
        <div className="mt-1 truncate text-[8px] uppercase tracking-[0.14em] text-white/60">{club}</div>
        <div className="mt-2 flex items-center justify-center gap-[6px] text-[8px] font-bold text-white/92">
          <span className="mr-1 text-white/55">L5</span>
          {last5.map((value, index) => (
            <span key={`${player.id}-l5-${index}`} className="inline-flex items-center gap-1">
              <span
                className={[
                  "inline-block h-[7px] w-[7px] rounded-full",
                  value >= 10 ? "bg-lime-400" : value >= 7 ? "bg-green-400" : value >= 4 ? "bg-amber-400" : "bg-orange-400",
                ].join(" ")}
              />
              <span>{value}</span>
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

import { type PlayerCardData } from "./Metal3DCard";
import { useMemo, useState } from "react";
import { CARD_IMAGE_FALLBACK } from "../lib/card-image";

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

const rarityStyles: Record<
  PlayerCardData["rarity"],
  { shell: string; border: string; glow: string; badge: string; orb: string }
> = {
  common: {
    shell: "from-[#0c1420] via-[#08101a] to-[#03060c]",
    border: "border-white/10",
    glow: "shadow-[0_18px_45px_rgba(0,0,0,0.45)]",
    badge: "bg-white/10 border-white/20 text-white/90",
    orb: "bg-white",
  },
  rare: {
    shell: "from-[#0b1d44] via-[#081428] to-[#03060c]",
    border: "border-sky-300/35",
    glow: "shadow-[0_18px_45px_rgba(36,99,235,0.28)]",
    badge: "bg-sky-400/18 border-sky-200/40 text-white",
    orb: "bg-sky-200",
  },
  unique: {
    shell: "from-[#34104b] via-[#170d2d] to-[#03060c]",
    border: "border-fuchsia-300/35",
    glow: "shadow-[0_18px_45px_rgba(168,85,247,0.30)]",
    badge: "bg-fuchsia-400/18 border-fuchsia-200/40 text-white",
    orb: "bg-fuchsia-200",
  },
  epic: {
    shell: "from-[#5b0f4a] via-[#2c0c2d] to-[#03060c]",
    border: "border-pink-300/35",
    glow: "shadow-[0_18px_45px_rgba(236,72,153,0.30)]",
    badge: "bg-pink-400/18 border-pink-200/40 text-white",
    orb: "bg-pink-200",
  },
  legendary: {
    shell: "from-[#5d3b00] via-[#2b1800] to-[#03060c]",
    border: "border-amber-200/50",
    glow: "shadow-[0_18px_50px_rgba(245,158,11,0.34)]",
    badge: "bg-amber-300/18 border-amber-100/45 text-white",
    orb: "bg-amber-200",
  },
};

export default function SimpleCard({ player, className = "" }: SimpleCardProps) {
  const candidates = useMemo(() => {
    const list = [player.image, ...(player.imageCandidates || []), CARD_IMAGE_FALLBACK]
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(list));
  }, [player.image, player.imageCandidates]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))] || CARD_IMAGE_FALLBACK;
  const rarity = rarityStyles[player.rarity];
  const rarityLabel = getRarityLabel(player.rarity);
  const level = Math.max(1, Number(player.level) || 1);
  const xp = Math.max(0, Number(player.xp) || 0);
  const xpMax = Math.max(100, Number(player.xpMax) || 1000);
  const last5 = getLast5(player);
  const club = String(player.club || player.team || "FantasyFC").toUpperCase();
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
      <div className="pointer-events-none absolute inset-[1px] rounded-[23px] bg-[linear-gradient(118deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.03)_18%,rgba(255,255,255,0)_42%)]" />

      <div className="absolute left-3 top-3 z-20">
        <div className="text-[34px] font-black leading-none tracking-[-0.04em] text-white">{player.rating}</div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/90">{player.position}</div>
      </div>
      <div
        className={`absolute right-3 top-3 z-20 rounded-full border px-3 py-[5px] text-[9px] font-extrabold uppercase tracking-[0.18em] backdrop-blur-md ${rarity.badge}`}
      >
        {rarityLabel}
      </div>

      <div className="absolute inset-x-[14%] top-[22%] z-10 flex h-[40%] items-center justify-center">
        {candidates.length > 0 ? (
          <img
            src={src}
            alt={player.name}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
            onError={() => {
              if (candidateIndex < candidates.length - 1) {
                setCandidateIndex((prev) => prev + 1);
              }
            }}
          />
        ) : null}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-[46%] z-[11] h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-2xl" />

      <div className={`absolute left-[70%] top-[14%] z-20 h-2.5 w-2.5 rounded-full ${rarity.orb} shadow-[0_0_12px_rgba(255,255,255,0.95)]`} />
      <div className={`absolute left-[47%] top-[39%] z-20 h-4.5 w-4.5 rounded-full ${rarity.orb} shadow-[0_0_18px_rgba(255,255,255,0.95)]`} />
      <div className={`absolute left-[49%] top-[48%] z-20 h-3.5 w-3.5 rounded-full ${rarity.orb} shadow-[0_0_14px_rgba(255,255,255,0.95)]`} />

      <div className="absolute inset-x-3 bottom-3 z-20 text-center">
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

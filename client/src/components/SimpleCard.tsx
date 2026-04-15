import { type PlayerCardData } from "./Metal3DCard";
import { useMemo, useState } from "react";
import { CARD_IMAGE_FALLBACK } from "../lib/card-image";
import { cardVisualTokens, normalizeVisualRarity } from "./cards/cardVisualTokens";

type SimpleCardProps = {
  player: PlayerCardData;
  className?: string;
};

function fitName(name: string, max = 18) {
  const clean = String(name || "").trim().toUpperCase();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function getLast5(player: PlayerCardData) {
  const last5 = Array.isArray(player.last5Scores) ? player.last5Scores.slice(0, 5) : [];
  while (last5.length < 5) last5.push(0);
  return last5;
}

export default function SimpleCard({ player, className = "" }: SimpleCardProps) {
  const visualRarity = normalizeVisualRarity(player.rarity);
  const rarity = cardVisualTokens[player.rarity];

  const candidates = useMemo(() => {
    const list = [player.image, player.imageUrl, player.photo, ...(player.imageCandidates || []), CARD_IMAGE_FALLBACK]
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(list));
  }, [player.image, player.imageUrl, player.photo, player.imageCandidates]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))] || CARD_IMAGE_FALLBACK;

  const level = Math.max(1, Number(player.level) || 1);
  const xp = Math.max(0, Number(player.xp) || 0);
  const xpMax = Math.max(100, Number(player.xpMax) || 1000);
  const last5 = getLast5(player);
  const club = String(player.club || player.team || "FantasyFC").toUpperCase();
  const league = String(player.league || "Global League").toUpperCase();
  const name = fitName(player.name, 18);
  const rating = Math.max(0, Number(player.rating || 0));
  const listedPrice = player.forSale && Number(player.price || 0) > 0 ? Number(player.price || 0) : null;

  return (
    <article
      className={[
        "group relative w-[154px] max-w-full aspect-[0.7/1] rounded-[26px] p-[2px] transition-transform duration-300 hover:-translate-y-1 hover:[transform:perspective(900px)_rotateX(5deg)_rotateY(-4deg)]",
        `bg-gradient-to-br ${rarity.frameOuter}`,
        rarity.glow,
        className,
      ].join(" ")}
    >
      <div className="absolute inset-[1px] rounded-[25px] bg-black/45 blur-sm" />
      <div className={["relative h-full w-full overflow-hidden rounded-[24px] border border-white/15 bg-gradient-to-b", rarity.shell, rarity.bevel].join(" ")}>
        <div className={`absolute inset-0 ${rarity.pattern}`} />
        <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.05)_24%,transparent_48%)]" />
        <div className="absolute -inset-x-4 top-[42%] h-20 bg-[radial-gradient(circle,rgba(255,255,255,0.16)_0%,transparent_72%)]" />

        <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
          <div className="rounded-xl border border-white/25 bg-black/35 px-2 py-1 backdrop-blur">
            <div className="text-[30px] font-black leading-none tracking-[-0.04em] text-white">{rating}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">OVR</div>
          </div>
          <div className={`rounded-full border px-2 py-[3px] text-[9px] font-extrabold uppercase tracking-[0.14em] ${rarity.badge}`}>{rarity.rarityLabel}</div>
        </div>

        <div className="absolute right-3 top-3 z-20 rounded-full border border-white/20 bg-black/35 px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.14em] text-white/85 backdrop-blur">
          {player.position}
        </div>

        <div className="absolute inset-x-[10%] top-[15%] z-10 flex h-[52%] items-end justify-center [mask-image:radial-gradient(circle_at_50%_32%,black_58%,transparent_100%)]">
          <img
            src={src}
            alt={player.name}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain drop-shadow-[0_24px_28px_rgba(0,0,0,0.62)]"
            onError={() => {
              if (candidateIndex < candidates.length - 1) setCandidateIndex((prev) => prev + 1);
            }}
          />
        </div>

        <div className={`pointer-events-none absolute left-[72%] top-[17%] z-20 h-2.5 w-2.5 rounded-full ${rarity.orb} shadow-[0_0_18px_rgba(255,255,255,0.9)]`} />
        <div className={`pointer-events-none absolute left-[27%] top-[20%] z-20 h-1.5 w-1.5 rounded-full ${rarity.orb} shadow-[0_0_12px_rgba(255,255,255,0.85)]`} />

        {listedPrice ? (
          <div className="absolute left-3 top-[42%] z-20 rounded-full border border-emerald-200/40 bg-emerald-500/22 px-2 py-1 text-[10px] font-bold text-emerald-50 backdrop-blur">
            Listed N${listedPrice.toFixed(0)}
          </div>
        ) : null}

        <div className="absolute inset-x-3 bottom-3 z-20">
          <div className="mb-2 flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.12em] text-white/85">
            <span className="rounded-full border border-white/25 bg-black/30 px-2 py-[2px]">{club}</span>
            <span className="rounded-full border border-white/25 bg-black/30 px-2 py-[2px]">#{player.serial || 1}/{player.maxSupply || 0}</span>
          </div>

          <div className="truncate text-[12px] font-black uppercase tracking-[0.02em] text-white">{name}</div>

          <div className="mt-1 flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.12em] text-white/70">
            <span>{league}</span>
            <span>LV {level} • XP {xp}/{xpMax}</span>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[8px] font-bold text-white/95">
            <span className="text-white/60">L5</span>
            {last5.map((value, index) => (
              <span key={`${player.id}-l5-${index}`} className={`inline-flex min-w-[22px] items-center justify-center rounded-md border px-1 py-[2px] ${rarity.statChip}`}>
                {Number(value || 0)}
              </span>
            ))}
          </div>

          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${visualRarity === "legendary" ? "from-amber-200 to-amber-500" : visualRarity === "unique" ? "from-fuchsia-300 to-violet-500" : visualRarity === "rare" ? "from-sky-300 to-blue-500" : "from-emerald-200 to-teal-400"}`}
              style={{ width: `${Math.min(100, Math.max(4, (xp / Math.max(1, xpMax)) * 100))}%` }}
            />
          </div>
        </div>

      </div>
    </article>
  );
}

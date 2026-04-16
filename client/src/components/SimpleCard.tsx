import { type PlayerCardData } from "./cards/types";
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

function getScoreTone(score: number) {
  if (score >= 70) return "bg-emerald-400/30 border-emerald-200/55 text-emerald-50";
  if (score >= 40) return "bg-amber-400/30 border-amber-200/55 text-amber-50";
  return "bg-rose-500/25 border-rose-200/45 text-rose-50";
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
        "group relative w-[154px] max-w-full aspect-[0.7/1] rounded-[26px] p-[3px]",
        "transition-[transform,box-shadow,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
        "hover:scale-[1.035] hover:[transform:perspective(1100px)_rotateX(7deg)_rotateY(-7deg)_translateY(-4px)]",
        `bg-gradient-to-br ${rarity.frameOuter}`,
        "shadow-[0_18px_36px_rgba(0,0,0,0.55)] hover:shadow-[0_28px_58px_rgba(0,0,0,0.68)]",
        rarity.glow,
        className,
      ].join(" ")}
    >
      <div className="absolute inset-[1px] rounded-[25px] bg-black/50 blur-[1px]" />
      <div className={["absolute inset-[3px] rounded-[22px] border border-white/30 bg-transparent", rarity.bevel].join(" ")} />
      <div className={["absolute inset-[7px] rounded-[18px] border border-white/18", rarity.innerGlow].join(" ")} />

      <div className={["relative h-full w-full overflow-hidden rounded-[22px] border border-white/15 bg-gradient-to-b", rarity.shell, rarity.bevel].join(" ")}>
        <div className={`absolute inset-0 ${rarity.pattern}`} />
        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.07)_22%,transparent_48%)]" />
        <div className="absolute inset-[2px] rounded-[20px] bg-[linear-gradient(140deg,rgba(255,255,255,0.22),transparent_24%,transparent_72%,rgba(0,0,0,0.25))]" />
        <div className="absolute -inset-x-4 top-[42%] h-24 bg-[radial-gradient(circle,rgba(255,255,255,0.16)_0%,transparent_74%)]" />

        <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
          <div className="rounded-xl border border-white/35 bg-black/40 px-2 py-1 backdrop-blur-md">
            <div className="text-[30px] font-black leading-none tracking-[-0.04em] text-white">{rating}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">OVR</div>
          </div>
          <div className={`rounded-full border px-2 py-[3px] text-[9px] font-extrabold uppercase tracking-[0.14em] ${rarity.badge}`}>{rarity.rarityLabel}</div>
        </div>

        <div className="absolute right-3 top-3 z-20 rounded-full border border-white/35 bg-black/40 px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
          {player.position}
        </div>
        <div className={`absolute right-3 top-[28px] z-20 rounded-full border px-2 py-[3px] text-[8px] font-bold uppercase tracking-[0.14em] backdrop-blur ${rarity.leagueBadge}`}>
          {league}
        </div>

        <div className="absolute inset-x-[4%] top-[12%] z-10 flex h-[56%] items-end justify-center overflow-visible [mask-image:radial-gradient(105%_100%_at_50%_34%,black_66%,transparent_98%)]">
          <div className={`pointer-events-none absolute left-1/2 top-[52%] h-[42%] w-[62%] -translate-x-1/2 rounded-full blur-2xl ${rarity.orb} opacity-40`} />
          <img
            src={src}
            alt={player.name}
            loading="lazy"
            decoding="async"
            className="h-[118%] w-auto max-w-none object-contain object-top drop-shadow-[0_28px_28px_rgba(0,0,0,0.64)]"
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
            <span className={`rounded-full border px-2 py-[2px] ${rarity.serialBadge}`}>#{player.serial || 1}/{player.maxSupply || 0}</span>
          </div>

          <div className="truncate text-[12px] font-black uppercase tracking-[0.02em] text-white">{name}</div>

          <div className="mt-1 flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.12em] text-white/70">
            <span>{player.position}</span>
            <span>LV {level} • XP {xp}/{xpMax}</span>
          </div>

          <div className="mt-2 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5">
            <div className="mb-1 flex items-center justify-between text-[7px] font-bold uppercase tracking-[0.14em] text-white/65">
              <span>Last 5</span>
              <span className="text-white/80">{Math.round(last5.reduce((sum, value) => sum + Number(value || 0), 0) / 5)} avg</span>
            </div>
            <div className="flex items-center gap-1.5 text-[8px] font-bold text-white/95">
            {last5.map((value, index) => (
              <span key={`${player.id}-l5-${index}`} className={`inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full border px-1 ${getScoreTone(Number(value || 0))}`}>
                {Number(value || 0)}
              </span>
            ))}
            </div>
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

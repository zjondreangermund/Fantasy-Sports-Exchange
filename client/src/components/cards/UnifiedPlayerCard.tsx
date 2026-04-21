import * as React from "react";
import { ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { CARD_IMAGE_FALLBACK } from "../../lib/card-image";
import { cardVisualTokens, normalizeVisualRarity } from "./cardVisualTokens";
import { type PlayerCardData } from "./types";

type UnifiedCardVariant = "default" | "compact" | "reveal" | "detail";
type UnifiedCardSize = "sm" | "md" | "lg";

type UnifiedPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
  size?: UnifiedCardSize;
  variant?: UnifiedCardVariant;
  selected?: boolean;
  interactive?: boolean;
};

const sizeClasses: Record<UnifiedCardSize, string> = {
  sm: "w-[168px]",
  md: "w-[208px]",
  lg: "w-[240px]",
};

function getLast5(player: PlayerCardData) {
  const values = Array.isArray(player.last5Scores) ? player.last5Scores.slice(0, 5).map((value) => Number(value || 0)) : [];
  while (values.length < 5) values.push(0);
  return values;
}

function getAverage(last5: number[], fallback: number) {
  const valid = last5.filter((value) => Number.isFinite(value));
  if (!valid.length) return Math.max(0, Math.round(Number(fallback || 0)));
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function getImageCandidates(player: PlayerCardData) {
  return Array.from(new Set([
    player.image,
    player.imageUrl,
    player.photo,
    ...(Array.isArray(player.imageCandidates) ? player.imageCandidates : []),
    CARD_IMAGE_FALLBACK,
  ].filter(Boolean) as string[]));
}

function toFlagEmoji(value?: string) {
  const code = String(value || "").trim().toUpperCase();
  if (code.length !== 2) return "🌍";
  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

function teamCode(player: PlayerCardData) {
  return String(player.club || player.team || "TEAM").trim().slice(0, 3).toUpperCase() || "TEAM";
}

function statusLabel(player: PlayerCardData) {
  if (player.status === "legacy") return "Legacy";
  if (player.status === "uncovered_league") return "Uncovered";
  return player.competitionEligible ? "Eligible" : "Training";
}

function scoreTone(value: number) {
  if (value >= 70) return "bg-emerald-400";
  if (value >= 50) return "bg-sky-400";
  if (value >= 30) return "bg-amber-400";
  return "bg-white/25";
}

export default function UnifiedPlayerCard({
  player,
  className = "",
  size = "md",
  variant = "default",
  selected = false,
  interactive = false,
}: UnifiedPlayerCardProps) {
  const rarity = normalizeVisualRarity(player.rarity);
  const tokens = cardVisualTokens[player.rarity] || cardVisualTokens.common;
  const imageCandidates = React.useMemo(() => getImageCandidates(player), [player]);
  const [imageIndex, setImageIndex] = React.useState(0);
  const src = imageCandidates[Math.min(imageIndex, Math.max(0, imageCandidates.length - 1))] || CARD_IMAGE_FALLBACK;
  const last5 = getLast5(player);
  const avg = getAverage(last5, player.rating);
  const name = String(player.name || "Unknown Player");
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  const bottomLine = nameParts.length > 1 ? nameParts.slice(-1).join(" ") : name;
  const topLine = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : String(player.position || "Player");
  const season = String(player.season || "2026-27");
  const serial = `${Number(player.serial || 1)}/${Number(player.maxSupply || 100)}`;
  const club = String(player.club || player.team || "Fantasy FC");
  const league = String(player.league || "Premier League");
  const flag = toFlagEmoji(player.nationality);
  const isCompact = variant === "compact";
  const isReveal = variant === "reveal";
  const tone = rarity === "common" ? "text-white" : "text-white";

  return (
    <article
      className={[
        "group relative aspect-[0.7/1] max-w-full overflow-hidden rounded-[28px] transition-transform duration-300",
        sizeClasses[size],
        interactive ? "hover:-translate-y-1 hover:rotate-[0.35deg] hover:scale-[1.02]" : "",
        selected ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-background" : "",
        className,
      ].join(" ")}
      data-rarity={rarity}
    >
      <div className={["absolute inset-0 rounded-[28px] bg-gradient-to-br", tokens.frameOuter, tokens.glow].join(" ")} />
      <div className="absolute inset-[3px] rounded-[25px] bg-black/80" />
      <div className={["absolute inset-[6px] rounded-[23px] bg-gradient-to-b", tokens.frameInner, tokens.innerGlow, tokens.bevel].join(" ")} />
      <div className={["absolute inset-[10px] rounded-[20px] bg-gradient-to-b", tokens.shell].join(" ")} />
      <div className={["absolute inset-[10px] rounded-[20px] opacity-90", tokens.pattern].join(" ")} />

      <div className="absolute inset-[10px] rounded-[20px] border border-white/10" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/12 via-transparent to-transparent opacity-70" />
      <div className="absolute inset-x-6 top-[54px] h-[42%] rounded-[24px] border border-white/10 bg-gradient-to-b from-white/10 via-white/[0.03] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
      <div className="absolute inset-x-8 top-[62px] h-[39%] rounded-[22px] bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.22),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_40%)] opacity-80" />

      <div className="absolute inset-0 z-20 flex flex-col px-4 pb-4 pt-3 text-white">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-white/78">
          <span>{season}</span>
          <span>{teamCode(player)}</span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", tokens.badge].join(" ")}>{tokens.rarityLabel}</span>
          <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold", tokens.serialBadge].join(" ")}>{serial}</span>
        </div>

        <div className="relative mt-3 h-[42%] shrink-0">
          <img
            src={src}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setImageIndex((current) => (current + 1 < imageCandidates.length ? current + 1 : current))}
            className={[
              "absolute inset-x-0 bottom-0 mx-auto h-full w-full object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]",
              isReveal ? "scale-[1.03]" : "",
            ].join(" ")}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={["inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold", tokens.leagueBadge].join(" ")}>
            <Sparkles className="h-3 w-3" />
            {statusLabel(player)}
          </span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/68">{league}</span>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 rounded-[16px] border border-white/10 bg-black/18 px-3 py-2.5">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/48">Last 5</div>
            <div className="mt-2 flex items-end gap-1.5">
              {last5.map((value, index) => (
                <div key={`${player.id}-score-${index}`} className="flex flex-col items-center gap-1">
                  <div className={["w-2 rounded-full", scoreTone(value)].join(" ")} style={{ height: `${Math.max(8, Math.min(28, value * 0.28))}px` }} />
                  {!isCompact ? <span className="text-[8px] text-white/45">{value || 0}</span> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/48">Average</div>
            <div className="mt-1 text-[26px] font-black leading-none tracking-tight">{avg}</div>
            <div className="mt-1 text-[10px] font-medium text-white/55">{player.position || "POS"}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
          <span className={["inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold", tokens.statChip].join(" ")}>
            <Trophy className="h-3 w-3" />
            {player.competitionEligible ? "Main comp" : "Development"}
          </span>
          <span className="truncate text-white/70">{player.provenanceMarker || "Verified"}</span>
        </div>

        <div className="mt-auto pt-4">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/52">{topLine}</div>
          <div className="truncate text-[18px] font-black uppercase leading-none tracking-[0.04em]">{bottomLine}</div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-medium text-white/68">
            <span className="truncate">{club}</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{flag}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

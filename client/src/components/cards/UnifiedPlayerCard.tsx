import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { CARD_IMAGE_FALLBACK } from "../../lib/card-image";
import { cardVisualTokens, normalizeVisualRarity } from "./cardVisualTokens";
import { type PlayerCardData } from "./types";

type UnifiedPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
};

function safeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function teamCode(player: PlayerCardData): string {
  return safeText(player.team || player.club, "TEAM").slice(0, 3).toUpperCase();
}

function getLast5(player: PlayerCardData): number[] {
  const values = Array.isArray(player.last5Scores)
    ? player.last5Scores.map((v) => Number(v || 0)).slice(0, 5)
    : [];
  while (values.length < 5) values.push(0);
  return values;
}

function avgScore(values: number[], fallback: number): number {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return Math.max(0, Math.round(Number(fallback || 0)));
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function totalPoints(values: number[], fallback?: number): number {
  const sum = values.reduce((acc, value) => acc + Number(value || 0), 0);
  return sum > 0 ? sum : Math.max(0, Number(fallback || 0));
}

function getImageCandidates(player: PlayerCardData): string[] {
  const candidates = [
    safeText(player.image),
    safeText(player.imageUrl),
    safeText(player.photo),
    ...(Array.isArray(player.imageCandidates) ? player.imageCandidates : []),
    CARD_IMAGE_FALLBACK,
  ].filter(Boolean) as string[];

  return Array.from(new Set(candidates));
}

function isProbablyFallback(src: string): boolean {
  const value = src.toLowerCase();
  return (
    value === CARD_IMAGE_FALLBACK.toLowerCase() ||
    value.includes("fallback") ||
    value.includes("/images/player-1") ||
    value.includes("/players/fallback")
  );
}

function pickInitialImageIndex(candidates: string[]): number {
  const firstReal = candidates.findIndex((src) => src && !isProbablyFallback(src));
  if (firstReal >= 0) return firstReal;
  return 0;
}

function glowForRarity(rarity: string): string {
  switch (rarity) {
    case "legendary":
      return "shadow-[0_0_42px_rgba(245,158,11,0.28)]";
    case "unique":
      return "shadow-[0_0_38px_rgba(217,70,239,0.24)]";
    case "rare":
      return "shadow-[0_0_34px_rgba(59,130,246,0.22)]";
    default:
      return "shadow-[0_0_22px_rgba(255,255,255,0.10)]";
  }
}

export default function UnifiedPlayerCard({
  player,
  className = "",
}: UnifiedPlayerCardProps) {
  const rarity = normalizeVisualRarity(player.rarity);
  const tokens = cardVisualTokens[rarity] || cardVisualTokens.common;

  const values = React.useMemo(() => getLast5(player), [player.last5Scores, player.rating]);
  const average = avgScore(values, Number(player.rating || 0));
  const total = totalPoints(values, player.totalPoints);

  const imageKey = React.useMemo(
    () =>
      [
        player.id,
        player.image,
        player.imageUrl,
        player.photo,
        ...(Array.isArray(player.imageCandidates) ? player.imageCandidates : []),
      ].join("|"),
    [player.id, player.image, player.imageUrl, player.photo, player.imageCandidates],
  );

  const imageCandidates = React.useMemo(() => getImageCandidates(player), [imageKey]);
  const [imageIndex, setImageIndex] = React.useState(() =>
    pickInitialImageIndex(imageCandidates),
  );

  React.useEffect(() => {
    setImageIndex(pickInitialImageIndex(imageCandidates));
  }, [imageKey]);

  const img = imageCandidates[imageIndex] || CARD_IMAGE_FALLBACK;

  const fullName = safeText(player.name, "Unknown Player");
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstLine =
    nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : fullName;
  const secondLine =
    nameParts.length > 1
      ? nameParts[nameParts.length - 1]
      : safeText(player.position, "PLAYER");

  const club = safeText(player.club || player.team, "Fantasy FC");
  const season = safeText(player.season, "2026-27");
  const serial = `${Number(player.serial || 1)}/${Number(player.maxSupply || 100)}`;
  const nationality = safeText(player.nationality, "");
  const statusLabel = player.competitionEligible ? "Eligible" : "Training";

  return (
    <div className={`[perspective:1400px] ${className}`}>
      <article
        className={[
          "group relative w-[220px] aspect-[0.7/1] max-w-full overflow-hidden rounded-[28px]",
          "transition-transform duration-300 will-change-transform",
          "hover:[transform:rotateX(7deg)_rotateY(-10deg)_translateY(-6px)]",
          glowForRarity(rarity),
        ].join(" ")}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className={`absolute inset-0 rounded-[28px] bg-gradient-to-br ${tokens.frameOuter}`}
          style={{ transform: "translateZ(0px)" }}
        />
        <div
          className="absolute inset-[2px] rounded-[26px] bg-black/90"
          style={{ transform: "translateZ(6px)" }}
        />
        <div
          className={`absolute inset-[6px] rounded-[23px] bg-gradient-to-b ${tokens.frameInner} ${tokens.innerGlow} ${tokens.bevel}`}
          style={{ transform: "translateZ(10px)" }}
        />
        <div
          className={`absolute inset-[10px] rounded-[20px] bg-gradient-to-b ${tokens.shell}`}
          style={{ transform: "translateZ(14px)" }}
        />

        <div
          className="absolute inset-[10px] rounded-[20px] opacity-45"
          style={{
            transform: "translateZ(15px)",
            backgroundImage: `
              repeating-linear-gradient(
                135deg,
                rgba(255,255,255,0.05) 0px,
                rgba(255,255,255,0.05) 1px,
                transparent 1px,
                transparent 10px
              ),
              radial-gradient(
                circle at 50% 18%,
                rgba(255,255,255,0.14),
                transparent 38%
              ),
              linear-gradient(
                180deg,
                rgba(255,255,255,0.04),
                transparent 30%,
                rgba(255,255,255,0.02) 70%,
                transparent 100%
              )
            `,
            backgroundSize: "100% 100%, 100% 100%, 100% 100%",
          }}
        />

        <div
          className="absolute inset-[10px] rounded-[20px] border border-white/10"
          style={{ transform: "translateZ(18px)" }}
        />
        <div
          className="absolute inset-0 rounded-[28px] bg-gradient-to-t from-black/40 via-transparent to-white/10 pointer-events-none"
          style={{ transform: "translateZ(20px)" }}
        />
        <div
          className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/14 via-transparent to-transparent opacity-70"
          style={{ transform: "translateZ(20px)" }}
        />
        <div
          className="absolute inset-x-5 top-[54px] h-[44%] rounded-[22px] border border-white/10 bg-gradient-to-b from-white/10 via-white/[0.03] to-transparent"
          style={{ transform: "translateZ(18px)" }}
        />

        <div
          className="relative z-10 flex h-full flex-col px-4 pb-4 pt-3 text-white"
          style={{ transform: "translateZ(24px)" }}
        >
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
            <span>{season}</span>
            <span>{teamCode(player)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                tokens.badge,
              ].join(" ")}
            >
              {safeText(player.rarity, "common")}
            </span>
            <span
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                tokens.serialBadge,
              ].join(" ")}
            >
              {serial}
            </span>
          </div>

          <div className="relative mt-3 h-[46%] shrink-0 overflow-hidden rounded-[16px]">
            <img
              src={img}
              alt={fullName}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.onerror = null;
                setImageIndex((current) =>
                  current + 1 < imageCandidates.length ? current + 1 : current,
                );
              }}
              className="absolute inset-x-0 bottom-0 mx-auto h-[98%] w-full object-cover object-top scale-[1.08] drop-shadow-[0_25px_35px_rgba(0,0,0,0.70)]"
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                tokens.leagueBadge,
              ].join(" ")}
            >
              {statusLabel}
            </span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
              {safeText(player.league, "Premier League")}
            </span>
          </div>

          <div className="mt-3 rounded-[16px] border border-white/10 bg-black/24 px-3 py-2.5">
            <div className="grid grid-cols-[1fr_auto_auto] items-end gap-3">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Last 5
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-white/80">
                  {values.map((score, index) => (
                    <span
                      key={`${fullName}-${index}`}
                      className="inline-flex min-w-[20px] items-center justify-center rounded-md bg-white/8 px-1.5 py-0.5"
                    >
                      {score}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Avg
                </div>
                <div className="mt-1 text-[24px] font-black leading-none tracking-tight">
                  {average}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Total
                </div>
                <div className="mt-1 text-[16px] font-black leading-none tracking-tight">
                  {total}
                </div>
                <div className="mt-1 text-[10px] font-medium uppercase text-white/60">
                  {safeText(player.position, "POS")}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4">
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
              {firstLine}
            </div>
            <div className="truncate text-[18px] font-black uppercase leading-none tracking-[0.04em]">
              {secondLine}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-medium text-white/70">
              <span className="truncate">{club}</span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={12} />
                {nationality}
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
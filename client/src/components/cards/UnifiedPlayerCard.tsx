import * as React from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { CARD_IMAGE_FALLBACK } from "../../lib/card-image";
import { cardVisualTokens, normalizeVisualRarity } from "./cardVisualTokens";
import { type PlayerCardData } from "./types";

type UnifiedPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
};

type Tilt = { rx: number; ry: number; mx: number; my: number };

function safeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function teamCode(player: PlayerCardData): string {
  return safeText(player.team || player.club, "FFC").slice(0, 3).toUpperCase();
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
  return sum > 0 ? sum : Math.max(0, Math.round(Number(fallback || 0)));
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
  return firstReal >= 0 ? firstReal : 0;
}

function rarityGlow(rarity: string): string {
  switch (rarity) {
    case "legendary":
      return "shadow-[0_30px_90px_rgba(245,158,11,0.38)]";
    case "unique":
      return "shadow-[0_30px_90px_rgba(168,85,247,0.34)]";
    case "rare":
      return "shadow-[0_30px_90px_rgba(59,130,246,0.32)]";
    default:
      return "shadow-[0_26px_70px_rgba(148,163,184,0.22)]";
  }
}

function rarityLabel(rarity: string): string {
  return rarity === "unique" ? "Unique" : rarity === "legendary" ? "Legendary" : rarity === "rare" ? "Rare" : "Common";
}

export default function UnifiedPlayerCard({ player, className = "" }: UnifiedPlayerCardProps) {
  const rarity = normalizeVisualRarity(player.rarity);
  const tokens = cardVisualTokens[rarity] || cardVisualTokens.common;
  const [tilt, setTilt] = React.useState<Tilt>({ rx: 0, ry: 0, mx: 50, my: 18 });

  const values = React.useMemo(() => getLast5(player), [player.last5Scores, player.rating]);
  const average = avgScore(values, Number(player.rating || 0));
  const total = totalPoints(values, player.totalPoints);
  const highScore = Math.max(1, ...values, average, total);

  const imageKey = React.useMemo(
    () => [player.id, player.image, player.imageUrl, player.photo, ...(Array.isArray(player.imageCandidates) ? player.imageCandidates : [])].join("|"),
    [player.id, player.image, player.imageUrl, player.photo, player.imageCandidates],
  );
  const imageCandidates = React.useMemo(() => getImageCandidates(player), [imageKey]);
  const [imageIndex, setImageIndex] = React.useState(() => pickInitialImageIndex(imageCandidates));

  React.useEffect(() => {
    setImageIndex(pickInitialImageIndex(imageCandidates));
  }, [imageKey, imageCandidates]);

  const img = imageCandidates[imageIndex] || CARD_IMAGE_FALLBACK;
  const fullName = safeText(player.name, "Unknown Player");
  const club = safeText(player.club || player.team, "Fantasy FC");
  const season = safeText(player.season, "2026-27");
  const serial = `${Number(player.serial || 1)}/${Number(player.maxSupply || 100)}`;
  const position = safeText(player.position, "POS").toUpperCase();
  const league = safeText(player.league, "Premier League");
  const nationality = safeText(player.nationality, "");
  const statusLabel = player.competitionEligible ? "Eligible" : "Training";

  const onMove = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    setTilt({
      ry: (px - 0.5) * 18,
      rx: (0.5 - py) * 16,
      mx: Math.round(px * 100),
      my: Math.round(py * 100),
    });
  };

  const resetTilt = () => setTilt({ rx: 0, ry: 0, mx: 50, my: 18 });

  return (
    <div className={`relative inline-flex [perspective:1600px] ${className}`}>
      <article
        onPointerMove={onMove}
        onPointerLeave={resetTilt}
        className={[
          "group relative w-[230px] aspect-[0.70/1] max-w-full overflow-visible rounded-[32px]",
          "transition-transform duration-200 ease-out will-change-transform",
          rarityGlow(rarity),
        ].join(" ")}
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(-2px)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div className="absolute -inset-[10px] rounded-[40px] bg-black/55 blur-2xl" style={{ transform: "translateZ(-24px)" }} />
        <div className={`absolute inset-0 rounded-[32px] bg-gradient-to-br ${tokens.frameOuter}`} style={{ transform: "translateZ(0px)" }} />
        <div className="absolute inset-[2px] rounded-[30px] bg-gradient-to-br from-white/40 via-black/70 to-black" style={{ transform: "translateZ(8px)" }} />
        <div className={`absolute inset-[7px] rounded-[26px] bg-gradient-to-b ${tokens.frameInner} ${tokens.bevel}`} style={{ transform: "translateZ(16px)" }} />
        <div className="absolute inset-[12px] rounded-[22px] bg-black/95" style={{ transform: "translateZ(23px)" }} />
        <div className={`absolute inset-[14px] rounded-[20px] bg-gradient-to-b ${tokens.shell}`} style={{ transform: "translateZ(28px)" }} />

        <div
          className="absolute inset-[14px] overflow-hidden rounded-[20px] opacity-70"
          style={{
            transform: "translateZ(32px)",
            backgroundImage: `
              radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,0.34), transparent 24%),
              repeating-linear-gradient(135deg, rgba(255,255,255,0.085) 0px, rgba(255,255,255,0.085) 1px, transparent 1px, transparent 9px),
              repeating-radial-gradient(circle at 50% 18%, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 2px, transparent 12px)
            `,
          }}
        />
        <div
          className="absolute inset-[14px] rounded-[20px] border border-white/15"
          style={{ transform: "translateZ(38px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), inset 0 -22px 50px rgba(0,0,0,.55)" }}
        />
        <div
          className="pointer-events-none absolute inset-[8px] rounded-[25px] opacity-0 mix-blend-screen transition-opacity duration-300 group-hover:opacity-100"
          style={{
            transform: "translateZ(80px)",
            background: `linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.16) 34%, transparent 52%), radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,.22), transparent 26%)`,
          }}
        />

        <div className="relative z-10 flex h-full flex-col px-4 pb-4 pt-3 text-white" style={{ transform: "translateZ(58px)" }}>
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em] text-white/80">
            <span>{season}</span>
            <span>{teamCode(player)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className={["inline-flex items-center rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]", tokens.badge].join(" ")}>{rarityLabel(rarity)}</span>
            <span className={["rounded-full border px-2 py-1 text-[9px] font-bold", tokens.serialBadge].join(" ")}>{serial}</span>
          </div>

          <div className="relative mt-3 h-[42%] shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-black/30">
            <div className="absolute inset-0 bg-gradient-to-b from-white/12 via-transparent to-black/55" />
            <img
              src={img}
              alt={fullName}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.onerror = null;
                setImageIndex((current) => (current + 1 < imageCandidates.length ? current + 1 : current));
              }}
              className="absolute inset-x-0 bottom-[-2px] mx-auto h-[108%] w-full object-cover object-top scale-[1.08] drop-shadow-[0_24px_26px_rgba(0,0,0,.72)]"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
              <div className="truncate text-[18px] font-black uppercase leading-none tracking-[0.02em] text-white drop-shadow">{fullName}</div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <div className="min-w-0 rounded-[14px] border border-white/10 bg-black/30 px-2.5 py-2">
              <div className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-white/45">{club}</div>
              <div className="mt-0.5 truncate text-[10px] font-bold text-white/75">{league}</div>
            </div>
            <div className="rounded-[14px] border border-white/10 bg-white/10 px-2.5 py-2 text-center">
              <div className="text-[9px] font-black uppercase text-white/45">Pos</div>
              <div className="text-[14px] font-black leading-none">{position}</div>
            </div>
          </div>

          <div className="mt-2 rounded-[16px] border border-white/10 bg-black/32 p-2.5">
            <div className="grid grid-cols-5 gap-1">
              {values.map((score, index) => {
                const height = Math.max(12, Math.min(42, (Number(score || 0) / highScore) * 42));
                return (
                  <div key={`${player.id}-${index}`} className="flex flex-col items-center gap-1">
                    <div className="flex h-[42px] w-full items-end justify-center rounded-lg bg-white/5 px-1">
                      <div className="w-full rounded-md bg-white/45 shadow-[0_0_12px_rgba(255,255,255,.18)]" style={{ height }} />
                    </div>
                    <span className="text-[9px] font-black text-white/70">{score}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-white/8 px-2 py-1 text-center"><div className="text-[8px] uppercase text-white/45">Avg</div><div className="text-[15px] font-black leading-none">{average}</div></div>
              <div className="rounded-lg bg-white/8 px-2 py-1 text-center"><div className="text-[8px] uppercase text-white/45">Total</div><div className="text-[15px] font-black leading-none">{total}</div></div>
              <div className="rounded-lg bg-white/8 px-2 py-1 text-center"><div className="text-[8px] uppercase text-white/45">Status</div><div className="truncate text-[10px] font-black leading-none">{statusLabel}</div></div>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[10px] font-semibold text-white/65">
            <span className="inline-flex min-w-0 items-center gap-1 truncate"><Sparkles size={12} /> {player.provenanceMarker || "Verified"}</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> {nationality || "FC"}</span>
          </div>
        </div>
      </article>
    </div>
  );
}

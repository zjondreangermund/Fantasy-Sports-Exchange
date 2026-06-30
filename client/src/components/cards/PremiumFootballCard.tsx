import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { type PlayerCardData } from "./types";
import Card3D from "./Card3D";
import {
  CARD_SIZE,
  CARD_THEMES,
  cardNumber,
  normalizeRarity,
  teamCode,
  type PremiumCardSize,
} from "./cardTheme";

export type PremiumFootballCardProps = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
  size?: PremiumCardSize;
  interactive?: boolean;
};

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function imageCandidates(player: PlayerCardData) {
  return unique([player.image, player.imageUrl, player.photo, ...(player.imageCandidates || [])]);
}

function displayName(name?: string) {
  return String(name || "Unknown Player").trim().toUpperCase();
}

function playerPoints(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores)
    ? player.last5Scores.map((score) => Number(score || 0))
    : [];
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.max(0, Math.round(Number(player.totalPoints || total || player.form || player.rating || 0)));
}

function Spark({ style }: { style: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-[55] block rounded-full bg-white shadow-[0_0_10px_white,0_0_22px_rgba(255,255,255,.8)]"
      style={style}
    />
  );
}

function PremiumFootballCardBase({
  player,
  selected = false,
  onClick,
  showPrice = false,
  className = "",
  size = "md",
  interactive = true,
}: PremiumFootballCardProps) {
  const rarity = normalizeRarity(player.rarity);
  const theme = CARD_THEMES[rarity];
  const dim = CARD_SIZE[size] || CARD_SIZE.md;
  const candidates = useMemo(() => imageCandidates(player), [player]);
  const imageKey = candidates.join("|");
  const [imageIndex, setImageIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const image = candidates[imageIndex];
  const hasImage = Boolean(image) && !imageFailed;
  const team = player.team || player.club || "Fantasy Arena";
  const rating = Math.max(0, Math.round(Number(player.rating || player.form || playerPoints(player) || 0)));
  const serial = player.serial && player.maxSupply
    ? `${player.serial}/${player.maxSupply}`
    : player.maxSupply
      ? `1/${player.maxSupply}`
      : "001/999";
  const price = Number(player.price || player.listedPrice || 0);

  useEffect(() => {
    setImageIndex(0);
    setImageFailed(false);
  }, [player.id, imageKey]);

  const onImageError = () => {
    if (imageIndex < candidates.length - 1) setImageIndex((value) => value + 1);
    else setImageFailed(true);
  };

  return (
    <Card3D
      onClick={onClick}
      disabled={!interactive}
      className={`${selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950 rounded-[28px]" : ""} ${className}`}
    >
      <article
        className="premium-football-card relative isolate overflow-hidden text-white"
        data-rarity={rarity}
        data-testid={`premium-football-card-${player.id}`}
        style={{
          width: dim.width,
          height: dim.height,
          borderRadius: dim.radius,
          background: theme.chrome,
          border: `2px solid ${theme.border}`,
          boxShadow: `${theme.glow}, inset 0 1px 0 rgba(255,255,255,.72), inset 0 -3px 0 rgba(0,0,0,.45)`,
          color: theme.text,
          ["--glow-rgb" as string]: theme.glowRgb,
          ["--card-accent" as string]: theme.accent,
        }}
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            background: theme.background,
          }}
        />

        <div
          className="absolute inset-[4px] z-10 rounded-[inherit] opacity-90"
          style={{
            background: theme.frame,
            clipPath: "polygon(0 0,100% 0,95% 100%,5% 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.70), inset 0 -18px 28px rgba(0,0,0,.38)",
          }}
        />

        <div className="absolute inset-[11px] z-20 rounded-[calc(1rem+4px)] border border-white/35 bg-black/25 shadow-[inset_0_0_22px_rgba(0,0,0,.48)]" />

        <div
          className="absolute inset-0 z-30 opacity-70 mix-blend-color-dodge transition-opacity duration-300 group-hover:opacity-95"
          style={{
            background: theme.foil,
            backgroundSize: "220% 220%",
            transform: "translateZ(18px)",
          }}
        />
        <div
          className="absolute inset-0 z-30 opacity-55 mix-blend-overlay transition-opacity duration-300 group-hover:opacity-80"
          style={{
            background: theme.holo,
            backgroundPosition: "var(--mx) var(--my)",
            transform: "translateZ(20px)",
          }}
        />
        <div
          className="absolute inset-0 z-40 opacity-70 mix-blend-screen transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.62), rgba(255,255,255,.16) 18%, transparent 42%)`,
            opacity: "calc(.18 + (var(--shine) * .62))",
          }}
        />
        <div
          className="absolute inset-0 z-50 pointer-events-none"
          style={{
            background: theme.glass,
          }}
        />

        <div className="absolute left-[7%] right-[7%] top-[8%] z-[60] flex items-start justify-between text-[10px] font-black uppercase tracking-[.12em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,.75)]">
          <div>
            <div>{player.season || "2026-27"}</div>
            <div style={{ color: theme.mutedText }}>{serial}</div>
          </div>
          <div className="text-right">
            <div>{teamCode(team)}</div>
            <div style={{ color: theme.mutedText }}>{cardNumber(player.id)}</div>
          </div>
        </div>

        <div className="absolute left-[10%] right-[10%] top-[16%] bottom-[23%] z-[45] overflow-visible rounded-[18px] border border-white/20 bg-black/25 shadow-[inset_0_0_28px_rgba(0,0,0,.74),0_0_28px_rgba(var(--glow-rgb),.20)]">
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 12%, rgba(var(--glow-rgb),.44), transparent 56%), linear-gradient(180deg, transparent, ${theme.dark})` }} />
          <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-emerald-950/85 via-emerald-900/35 to-transparent" />
          {hasImage ? (
            <img
              src={image}
              alt={player.name}
              onError={onImageError}
              draggable={false}
              loading="lazy"
              className="absolute bottom-[-2%] left-1/2 z-20 h-[112%] w-[126%] max-w-none -translate-x-1/2 object-contain object-bottom drop-shadow-[0_20px_18px_rgba(0,0,0,.74)] transition-transform duration-300 group-hover:scale-[1.035]"
            />
          ) : (
            <div className="absolute inset-0 z-20 grid place-items-center text-5xl font-black text-white/20">
              {displayName(player.name).slice(0, 2)}
            </div>
          )}
          <div className="absolute inset-0 z-30 bg-gradient-to-b from-white/10 via-transparent to-black/70" />
        </div>

        <div
          className="absolute left-[7%] right-[7%] bottom-[7%] z-[70] rounded-2xl border border-white/24 px-3 py-2 text-center shadow-[0_10px_24px_rgba(0,0,0,.48),inset_0_1px_0_rgba(255,255,255,.28)]"
          style={{ background: theme.nameplate }}
        >
          <h3 className="truncate text-sm font-black leading-tight tracking-[.10em] text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.8)]">
            {displayName(player.name)}
          </h3>
          <div className="mt-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[.14em]" style={{ color: theme.mutedText }}>
            <span>{player.position || "N/A"}</span>
            <span>•</span>
            <span>{team}</span>
          </div>
          <div className="mt-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[.12em]">
            <span style={{ color: theme.accent }}>OVR {rating || "—"}</span>
            <span className="text-white/45">•</span>
            <span style={{ color: theme.accent }}>PTS {playerPoints(player)}</span>
          </div>
          {showPrice && price > 0 ? (
            <div className="mt-1 text-[10px] font-black text-emerald-200">N${price.toFixed(2)}</div>
          ) : null}
        </div>

        <div className="absolute left-[7%] top-[50%] z-[75] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-[10px] font-black text-white shadow-[0_0_18px_rgba(var(--glow-rgb),.42)]">
          {theme.label.split(" ")[0].slice(0, 2)}
        </div>
        <div className="absolute right-[7%] top-[50%] z-[75] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-[10px] font-black text-white shadow-[0_0_18px_rgba(var(--glow-rgb),.42)]">
          FA
        </div>

        <div className="absolute bottom-[2.6%] left-1/2 z-[80] -translate-x-1/2 rounded-full border border-white/25 bg-black/40 px-3 py-1 text-[8px] font-black uppercase tracking-[.18em] text-white/80">
          {theme.label}
        </div>

        <Spark style={{ left: "14%", top: "13%", width: 3, height: 22, transform: "rotate(35deg)" }} />
        <Spark style={{ right: "13%", top: "18%", width: 2, height: 18, transform: "rotate(-28deg)", opacity: 0.82 }} />
        <Spark style={{ left: "18%", bottom: "22%", width: 2, height: 16, transform: "rotate(18deg)", opacity: 0.72 }} />
      </article>
    </Card3D>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;

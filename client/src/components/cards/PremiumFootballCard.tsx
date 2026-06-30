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

function fs(scale: number, value: number) {
  return Math.max(7, Math.round(value * scale));
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
  const scale = dim.width / CARD_SIZE.md.width;
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

  const styles: Record<string, CSSProperties> = {
    card: {
      position: "relative",
      isolation: "isolate",
      overflow: "hidden",
      width: dim.width,
      height: dim.height,
      borderRadius: dim.radius,
      background: theme.chrome,
      border: `2px solid ${theme.border}`,
      boxShadow: `${theme.glow}, inset 0 1px 0 rgba(255,255,255,.72), inset 0 -3px 0 rgba(0,0,0,.45)`,
      color: theme.text,
      fontFamily: "Inter, system-ui, sans-serif",
      transform: "translateZ(0)",
      ["--glow-rgb" as string]: theme.glowRgb,
    },
    base: { position: "absolute", inset: 0, zIndex: 0, background: theme.background },
    frame: {
      position: "absolute",
      inset: Math.max(4, dim.width * 0.022),
      zIndex: 10,
      borderRadius: Math.max(14, dim.radius - 4),
      background: theme.frame,
      opacity: 0.96,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.70), inset 0 -18px 28px rgba(0,0,0,.38)",
    },
    inner: {
      position: "absolute",
      left: "6%",
      right: "6%",
      top: "6%",
      bottom: "6%",
      zIndex: 20,
      borderRadius: Math.max(12, dim.radius - 10),
      border: "1px solid rgba(255,255,255,.28)",
      background: "rgba(0,0,0,.10)",
      boxShadow: "inset 0 0 24px rgba(0,0,0,.36)",
    },
    artStage: {
      position: "absolute",
      left: "5%",
      right: "5%",
      top: "13%",
      bottom: "18%",
      zIndex: 30,
      overflow: "hidden",
      borderRadius: Math.max(12, dim.radius - 8),
      background: `radial-gradient(circle at 50% 14%, rgba(${theme.glowRgb},.55), transparent 56%), linear-gradient(180deg, transparent, ${theme.dark})`,
    },
    pitch: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "34%",
      background: "linear-gradient(to top, rgba(0,0,0,.78), rgba(16,80,50,.32), transparent)",
    },
    image: {
      position: "absolute",
      left: "50%",
      bottom: "-1%",
      zIndex: 34,
      width: "108%",
      height: "96%",
      maxWidth: "none",
      objectFit: "contain",
      objectPosition: "center bottom",
      transform: "translateX(-50%)",
      filter: "drop-shadow(0 22px 18px rgba(0,0,0,.78))",
    },
    fallback: {
      position: "absolute",
      inset: 0,
      zIndex: 34,
      display: "grid",
      placeItems: "center",
      fontSize: fs(scale, 54),
      fontWeight: 900,
      color: "rgba(255,255,255,.22)",
    },
    foil: {
      position: "absolute",
      inset: 0,
      zIndex: 45,
      pointerEvents: "none",
      background: theme.foil,
      backgroundSize: "220% 220%",
      mixBlendMode: "color-dodge",
      opacity: 0.76,
    },
    holo: {
      position: "absolute",
      inset: 0,
      zIndex: 46,
      pointerEvents: "none",
      background: theme.holo,
      backgroundPosition: "var(--mx) var(--my)",
      mixBlendMode: "overlay",
      opacity: 0.6,
    },
    light: {
      position: "absolute",
      inset: 0,
      zIndex: 47,
      pointerEvents: "none",
      background: "radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.58), rgba(255,255,255,.13) 18%, transparent 42%)",
      mixBlendMode: "screen",
      opacity: "calc(.20 + (var(--shine) * .58))" as any,
    },
    glass: { position: "absolute", inset: 0, zIndex: 48, pointerEvents: "none", background: theme.glass },
    top: {
      position: "absolute",
      left: "8%",
      right: "8%",
      top: "7%",
      zIndex: 60,
      display: "flex",
      justifyContent: "space-between",
      fontSize: fs(scale, 10),
      fontWeight: 900,
      letterSpacing: ".10em",
      color: "white",
      textShadow: "0 2px 4px rgba(0,0,0,.75)",
    },
    nameplate: {
      position: "absolute",
      left: "7%",
      right: "7%",
      bottom: "7%",
      zIndex: 70,
      borderRadius: Math.max(12, dim.radius * 0.48),
      border: "1px solid rgba(255,255,255,.25)",
      padding: `${Math.max(6, dim.height * 0.022)}px ${Math.max(8, dim.width * 0.045)}px`,
      textAlign: "center",
      background: theme.nameplate,
      boxShadow: "0 10px 24px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.28)",
    },
    name: {
      margin: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: fs(scale, 14),
      lineHeight: 1.05,
      fontWeight: 900,
      letterSpacing: ".05em",
      color: "white",
      textShadow: "0 2px 3px rgba(0,0,0,.82)",
    },
    meta: {
      marginTop: Math.max(3, dim.height * 0.01),
      display: "flex",
      justifyContent: "center",
      gap: Math.max(5, dim.width * 0.025),
      fontSize: fs(scale, 9),
      fontWeight: 900,
      letterSpacing: ".10em",
      color: theme.mutedText,
      whiteSpace: "nowrap",
      overflow: "hidden",
    },
    sideBadgeLeft: {
      position: "absolute",
      left: "7%",
      top: "50%",
      zIndex: 75,
      width: Math.max(24, dim.width * 0.15),
      height: Math.max(24, dim.width * 0.15),
      transform: "translateY(-50%)",
      display: "grid",
      placeItems: "center",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,.30)",
      background: "rgba(0,0,0,.45)",
      fontSize: fs(scale, 10),
      fontWeight: 900,
      boxShadow: "0 0 18px rgba(var(--glow-rgb),.42)",
    },
    sideBadgeRight: {
      position: "absolute",
      right: "7%",
      top: "50%",
      zIndex: 75,
      width: Math.max(24, dim.width * 0.15),
      height: Math.max(24, dim.width * 0.15),
      transform: "translateY(-50%)",
      display: "grid",
      placeItems: "center",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,.30)",
      background: "rgba(0,0,0,.45)",
      fontSize: fs(scale, 10),
      fontWeight: 900,
      boxShadow: "0 0 18px rgba(var(--glow-rgb),.42)",
    },
    label: {
      position: "absolute",
      left: "50%",
      bottom: "2.5%",
      zIndex: 80,
      transform: "translateX(-50%)",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,.25)",
      background: "rgba(0,0,0,.42)",
      padding: `${Math.max(2, dim.height * 0.006)}px ${Math.max(8, dim.width * 0.045)}px`,
      fontSize: fs(scale, 8),
      fontWeight: 900,
      letterSpacing: ".16em",
      color: "rgba(255,255,255,.82)",
      whiteSpace: "nowrap",
    },
  };

  return (
    <Card3D onClick={onClick} disabled={!interactive} className={`${selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950 rounded-[28px]" : ""} ${className}`}>
      <article className="premium-football-card" data-rarity={rarity} data-testid={`premium-football-card-${player.id}`} style={styles.card}>
        <div style={styles.base} />
        <div style={styles.frame} />
        <div style={styles.inner} />
        <div style={styles.artStage}>
          <div style={styles.pitch} />
          {hasImage ? <img src={image} alt={player.name} onError={onImageError} draggable={false} loading="lazy" style={styles.image} /> : <div style={styles.fallback}>{displayName(player.name).slice(0, 2)}</div>}
        </div>
        <div style={styles.foil} />
        <div style={styles.holo} />
        <div style={styles.light} />
        <div style={styles.glass} />
        <div style={styles.top}>
          <div><div>{player.season || "2026-27"}</div><div style={{ color: theme.mutedText }}>{serial}</div></div>
          <div style={{ textAlign: "right" }}><div>{teamCode(team)}</div><div style={{ color: theme.mutedText }}>{cardNumber(player.id)}</div></div>
        </div>
        <div style={styles.nameplate}>
          <h3 style={styles.name}>{displayName(player.name)}</h3>
          <div style={styles.meta}><span>{player.position || "N/A"}</span><span>•</span><span>{team}</span></div>
          <div style={styles.meta}><span style={{ color: theme.accent }}>OVR {rating || "—"}</span><span>•</span><span style={{ color: theme.accent }}>PTS {playerPoints(player)}</span></div>
          {showPrice && price > 0 ? <div style={{ ...styles.meta, color: "#bbf7d0" }}>N${price.toFixed(2)}</div> : null}
        </div>
        <div style={styles.sideBadgeLeft}>{theme.label.split(" ")[0].slice(0, 2)}</div>
        <div style={styles.sideBadgeRight}>FA</div>
        <div style={styles.label}>{theme.label}</div>
      </article>
    </Card3D>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;

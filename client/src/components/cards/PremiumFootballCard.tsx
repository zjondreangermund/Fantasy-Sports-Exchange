import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { type PlayerCardData } from "./types";
import Card3D from "./Card3D";
import { CARD_SIZE, CARD_THEMES, cardNumber, normalizeRarity, teamCode, type PremiumCardSize } from "./cardTheme";

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
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.map((score) => Number(score || 0)) : [];
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.max(0, Math.round(Number(player.totalPoints || total || player.form || player.rating || 0)));
}

function fs(scale: number, value: number) {
  return Math.max(7, Math.round(value * scale));
}

function PremiumFootballCardBase({ player, selected = false, onClick, showPrice = false, className = "", size = "md", interactive = true }: PremiumFootballCardProps) {
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
  const serial = player.serial && player.maxSupply ? `${player.serial}/${player.maxSupply}` : player.maxSupply ? `1/${player.maxSupply}` : "001/999";
  const price = Number(player.price || player.listedPrice || 0);

  useEffect(() => {
    setImageIndex(0);
    setImageFailed(false);
  }, [player.id, imageKey]);

  const onImageError = () => {
    if (imageIndex < candidates.length - 1) setImageIndex((value) => value + 1);
    else setImageFailed(true);
  };

  const style = {
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
    } as CSSProperties,
    rarityWash: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      background: theme.background,
    } as CSSProperties,
    fullArtwork: {
      position: "absolute",
      inset: "5%",
      zIndex: 12,
      overflow: "hidden",
      borderRadius: Math.max(14, dim.radius - 8),
      border: "1px solid rgba(255,255,255,.28)",
      background: `radial-gradient(circle at 50% 12%, rgba(${theme.glowRgb},.55), transparent 56%), linear-gradient(180deg, rgba(0,0,0,.08), ${theme.dark})`,
      boxShadow: "inset 0 0 24px rgba(0,0,0,.42)",
    } as CSSProperties,
    image: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      maxWidth: "none",
      objectFit: "cover",
      objectPosition: "center center",
      transform: "scale(1.12)",
      filter: "saturate(1.16) contrast(1.08) brightness(.92)",
    } as CSSProperties,
    noImage: {
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      fontSize: fs(scale, 54),
      fontWeight: 900,
      color: "rgba(255,255,255,.22)",
    } as CSSProperties,
    darkFade: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.04) 42%, rgba(0,0,0,.72) 100%)",
    } as CSSProperties,
    frame: {
      position: "absolute",
      inset: Math.max(4, dim.width * 0.022),
      zIndex: 20,
      borderRadius: Math.max(14, dim.radius - 4),
      background: theme.frame,
      opacity: 0.42,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.70), inset 0 -18px 28px rgba(0,0,0,.38)",
      pointerEvents: "none",
    } as CSSProperties,
    foil: {
      position: "absolute",
      inset: 0,
      zIndex: 45,
      pointerEvents: "none",
      background: theme.foil,
      backgroundSize: "220% 220%",
      mixBlendMode: "color-dodge",
      opacity: 0.86,
    } as CSSProperties,
    holo: {
      position: "absolute",
      inset: 0,
      zIndex: 46,
      pointerEvents: "none",
      background: theme.holo,
      backgroundPosition: "var(--mx) var(--my)",
      mixBlendMode: "overlay",
      opacity: 0.68,
    } as CSSProperties,
    light: {
      position: "absolute",
      inset: 0,
      zIndex: 47,
      pointerEvents: "none",
      background: "radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.62), rgba(255,255,255,.16) 18%, transparent 42%)",
      mixBlendMode: "screen",
      opacity: "calc(.20 + (var(--shine) * .58))" as any,
    } as CSSProperties,
    glass: { position: "absolute", inset: 0, zIndex: 48, pointerEvents: "none", background: theme.glass } as CSSProperties,
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
      textShadow: "0 2px 5px rgba(0,0,0,.95)",
    } as CSSProperties,
    nameplate: {
      position: "absolute",
      left: "7%",
      right: "7%",
      bottom: "7%",
      zIndex: 70,
      borderRadius: Math.max(12, dim.radius * 0.48),
      border: "1px solid rgba(255,255,255,.28)",
      padding: `${Math.max(6, dim.height * 0.022)}px ${Math.max(8, dim.width * 0.045)}px`,
      textAlign: "center",
      background: theme.nameplate,
      boxShadow: "0 10px 24px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.28)",
      backdropFilter: "blur(6px)",
    } as CSSProperties,
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
      textShadow: "0 2px 3px rgba(0,0,0,.9)",
    } as CSSProperties,
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
    } as CSSProperties,
    badge: {
      position: "absolute",
      top: "50%",
      zIndex: 75,
      width: Math.max(24, dim.width * 0.15),
      height: Math.max(24, dim.width * 0.15),
      transform: "translateY(-50%)",
      display: "grid",
      placeItems: "center",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,.35)",
      background: "rgba(0,0,0,.55)",
      fontSize: fs(scale, 10),
      fontWeight: 900,
      boxShadow: "0 0 18px rgba(var(--glow-rgb),.42)",
    } as CSSProperties,
    label: {
      position: "absolute",
      left: "50%",
      bottom: "2.5%",
      zIndex: 80,
      transform: "translateX(-50%)",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,.25)",
      background: "rgba(0,0,0,.50)",
      padding: `${Math.max(2, dim.height * 0.006)}px ${Math.max(8, dim.width * 0.045)}px`,
      fontSize: fs(scale, 8),
      fontWeight: 900,
      letterSpacing: ".16em",
      color: "rgba(255,255,255,.86)",
      whiteSpace: "nowrap",
    } as CSSProperties,
  };

  return (
    <Card3D onClick={onClick} disabled={!interactive} className={`${selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950 rounded-[28px]" : ""} ${className}`}>
      <article className="premium-football-card" data-rarity={rarity} data-testid={`premium-football-card-${player.id}`} style={style.card}>
        <div style={style.rarityWash} />
        <div style={style.fullArtwork}>
          {hasImage ? <img src={image} alt={player.name} onError={onImageError} draggable={false} loading="lazy" style={style.image} /> : <div style={style.noImage}>{displayName(player.name).slice(0, 2)}</div>}
          <div style={style.darkFade} />
        </div>
        <div style={style.frame} />
        <div style={style.foil} />
        <div style={style.holo} />
        <div style={style.light} />
        <div style={style.glass} />
        <div style={style.top}>
          <div><div>{player.season || "2026-27"}</div><div style={{ color: theme.mutedText }}>{serial}</div></div>
          <div style={{ textAlign: "right" }}><div>{teamCode(team)}</div><div style={{ color: theme.mutedText }}>{cardNumber(player.id)}</div></div>
        </div>
        <div style={style.nameplate}>
          <h3 style={style.name}>{displayName(player.name)}</h3>
          <div style={style.meta}><span>{player.position || "N/A"}</span><span>•</span><span>{team}</span></div>
          <div style={style.meta}><span style={{ color: theme.accent }}>OVR {rating || "—"}</span><span>•</span><span style={{ color: theme.accent }}>PTS {playerPoints(player)}</span></div>
          {showPrice && price > 0 ? <div style={{ ...style.meta, color: "#bbf7d0" }}>N${price.toFixed(2)}</div> : null}
        </div>
        <div style={{ ...style.badge, left: "7%" }}>{theme.label.split(" ")[0].slice(0, 2)}</div>
        <div style={{ ...style.badge, right: "7%" }}>FA</div>
        <div style={style.label}>{theme.label}</div>
      </article>
    </Card3D>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;

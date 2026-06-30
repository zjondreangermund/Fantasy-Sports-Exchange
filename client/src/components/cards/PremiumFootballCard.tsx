import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { type PlayerCardData } from "./types";
import { CARD_SIZE, CARD_THEMES, normalizeRarity, teamCode, type PremiumCardSize } from "./cardTheme";

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

function font(scale: number, px: number) {
  return Math.max(7, Math.round(px * scale));
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
  const price = Number(player.price || player.listedPrice || 0);
  const serial = player.serial && player.maxSupply ? `${player.serial}/${player.maxSupply}` : player.maxSupply ? `1/${player.maxSupply}` : "1/100";

  useEffect(() => {
    setImageIndex(0);
    setImageFailed(false);
  }, [player.id, imageKey]);

  const onImageError = () => {
    if (imageIndex < candidates.length - 1) setImageIndex((value) => value + 1);
    else setImageFailed(true);
  };

  const cardStyle: CSSProperties = {
    position: "relative",
    width: dim.width,
    height: dim.height,
    minWidth: dim.width,
    minHeight: dim.height,
    borderRadius: dim.radius,
    overflow: "hidden",
    isolation: "isolate",
    color: theme.text,
    border: `2px solid ${theme.border}`,
    background: theme.chrome,
    boxShadow: selected
      ? `0 0 0 3px rgba(52,211,153,.9), ${theme.glow}`
      : theme.glow,
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    cursor: onClick ? "pointer" : "default",
  };

  return (
    <button
      type="button"
      disabled={!interactive && !onClick}
      onClick={onClick}
      className={className}
      data-card-engine="premium-football-card"
      style={{ border: 0, padding: 0, background: "transparent", display: "inline-block", lineHeight: 0 }}
    >
      <article style={cardStyle}>
        <div style={{ position: "absolute", inset: 0, zIndex: 0, background: theme.background }} />

        <div
          style={{
            position: "absolute",
            inset: "5%",
            zIndex: 8,
            borderRadius: dim.radius - 7,
            overflow: "hidden",
            background: `radial-gradient(circle at 50% 16%, rgba(${theme.glowRgb},.42), transparent 60%), linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.88))`,
            boxShadow: "inset 0 0 24px rgba(0,0,0,.45)",
          }}
        >
          {hasImage ? (
            <img
              src={image}
              alt={player.name}
              onError={onImageError}
              loading="lazy"
              draggable={false}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center center",
                transform: "scale(1.08)",
                filter: "saturate(1.12) contrast(1.08) brightness(.95)",
              }}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.22)", fontSize: font(scale, 56), fontWeight: 950 }}>
              {displayName(player.name).slice(0, 2)}
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.04) 45%, rgba(0,0,0,.82) 100%)" }} />
        </div>

        <div style={{ position: "absolute", inset: 4, zIndex: 16, borderRadius: dim.radius - 4, border: "1px solid rgba(255,255,255,.46)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.65), inset 0 -12px 22px rgba(0,0,0,.30)" }} />

        <div style={{ position: "absolute", inset: 0, zIndex: 20, background: theme.foil, mixBlendMode: "screen", opacity: .42, pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 21, background: theme.holo, mixBlendMode: "overlay", opacity: .42, pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 22, background: "linear-gradient(130deg, rgba(255,255,255,.36), transparent 24%, transparent 58%, rgba(255,255,255,.22) 70%, transparent 82%)", pointerEvents: "none" }} />

        <div style={{ position: "absolute", left: "8%", right: "8%", top: "7%", zIndex: 30, display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "white", fontSize: font(scale, 10), fontWeight: 950, letterSpacing: ".08em", textShadow: "0 2px 4px rgba(0,0,0,.88)", lineHeight: 1.05 }}>
          <div><div>{player.season || "2026-27"}</div><div style={{ color: theme.mutedText }}>{serial}</div></div>
          <div style={{ textAlign: "right" }}><div>{teamCode(team)}</div><div style={{ color: theme.mutedText }}>FA</div></div>
        </div>

        <div style={{ position: "absolute", left: "7%", top: "50%", zIndex: 31, transform: "translateY(-50%)", width: dim.width * .14, height: dim.width * .14, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.30)", color: "white", fontSize: font(scale, 10), fontWeight: 950, lineHeight: 1 }}>
          {theme.label.slice(0, 2)}
        </div>
        <div style={{ position: "absolute", right: "7%", top: "50%", zIndex: 31, transform: "translateY(-50%)", width: dim.width * .14, height: dim.width * .14, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.30)", color: "white", fontSize: font(scale, 10), fontWeight: 950, lineHeight: 1 }}>
          FA
        </div>

        <div style={{ position: "absolute", left: "7%", right: "7%", bottom: "7%", zIndex: 35, borderRadius: dim.radius * .48, padding: `${Math.max(6, dim.height * .023)}px ${Math.max(8, dim.width * .045)}px`, background: theme.nameplate, border: "1px solid rgba(255,255,255,.30)", boxShadow: "0 10px 24px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.26)", textAlign: "center", lineHeight: 1.05 }}>
          <h3 style={{ margin: 0, color: "white", fontSize: font(scale, 14), fontWeight: 950, letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 2px 4px rgba(0,0,0,.88)" }}>{displayName(player.name)}</h3>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: theme.mutedText, fontSize: font(scale, 9), fontWeight: 900, letterSpacing: ".08em", whiteSpace: "nowrap", overflow: "hidden" }}>
            <span>{player.position || "N/A"}</span><span>•</span><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{team}</span>
          </div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: theme.accent, fontSize: font(scale, 9), fontWeight: 900, letterSpacing: ".08em", whiteSpace: "nowrap" }}>
            <span>OVR {rating || "—"}</span><span>•</span><span>PTS {playerPoints(player)}</span>
          </div>
          {showPrice && price > 0 ? <div style={{ marginTop: 4, color: "#bbf7d0", fontSize: font(scale, 9), fontWeight: 950 }}>N${price.toFixed(2)}</div> : null}
        </div>

        <div style={{ position: "absolute", left: "50%", bottom: "2.4%", zIndex: 36, transform: "translateX(-50%)", padding: `2px ${Math.max(8, dim.width * .045)}px`, borderRadius: 999, background: "rgba(0,0,0,.56)", border: "1px solid rgba(255,255,255,.24)", color: "rgba(255,255,255,.82)", fontSize: font(scale, 8), fontWeight: 950, letterSpacing: ".14em", whiteSpace: "nowrap", lineHeight: 1.2 }}>
          {theme.label}
        </div>
      </article>
    </button>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;

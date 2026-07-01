import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
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

type MotionStyle = CSSProperties & {
  "--mx"?: string;
  "--my"?: string;
  "--rx"?: string;
  "--ry"?: string;
  "--shine"?: string;
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
  const [motion, setMotion] = useState<MotionStyle>({ "--mx": "50%", "--my": "24%", "--rx": "0deg", "--ry": "0deg", "--shine": "0" });
  const image = candidates[imageIndex];
  const hasImage = Boolean(image) && !imageFailed;
  const team = player.team || player.club || "Fantasy Arena";
  const rating = Math.max(0, Math.round(Number(player.rating || player.form || playerPoints(player) || 0)));
  const price = Number(player.price || player.listedPrice || 0);
  const serial = player.serial && player.maxSupply ? `${player.serial}/${player.maxSupply}` : player.maxSupply ? `1/${player.maxSupply}` : "1/100";
  const disabled = !interactive && !onClick;

  useEffect(() => {
    setImageIndex(0);
    setImageFailed(false);
  }, [player.id, imageKey]);

  const onImageError = () => {
    if (imageIndex < candidates.length - 1) setImageIndex((value) => value + 1);
    else setImageFailed(true);
  };

  const handleMove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      setMotion({
        "--mx": `${Math.round(x * 100)}%`,
        "--my": `${Math.round(y * 100)}%`,
        "--rx": `${((0.5 - y) * 9).toFixed(2)}deg`,
        "--ry": `${((x - 0.5) * 12).toFixed(2)}deg`,
        "--shine": "1",
      });
    },
    [disabled],
  );

  const resetMotion = useCallback(() => {
    setMotion({ "--mx": "50%", "--my": "24%", "--rx": "0deg", "--ry": "0deg", "--shine": "0" });
  }, []);

  const cardStyle: MotionStyle = {
    ...motion,
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
    boxShadow: selected ? `0 0 0 3px rgba(52,211,153,.9), ${theme.glow}` : theme.glow,
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    cursor: onClick ? "pointer" : "default",
    transform: "perspective(1000px) rotateX(var(--rx)) rotateY(var(--ry)) translateZ(0)",
    transformStyle: "preserve-3d",
    transition: "transform 180ms ease, box-shadow 180ms ease, filter 180ms ease",
    filter: selected ? "saturate(1.18) brightness(1.08)" : "saturate(1.08)",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={resetMotion}
      onFocus={resetMotion}
      className={className}
      aria-label={`${displayName(player.name)} ${theme.label} card`}
      data-card-engine="premium-football-card"
      style={{ border: 0, padding: 0, background: "transparent", display: "inline-block", lineHeight: 0, perspective: 1000 }}
    >
      <article style={cardStyle}>
        <style>{`
          @keyframes fa-card-foil-sweep { 0% { transform: translateX(-62%) rotate(10deg); opacity: .16; } 50% { opacity: .58; } 100% { transform: translateX(62%) rotate(10deg); opacity: .20; } }
          @keyframes fa-card-holo-drift { 0% { background-position: 0% 0%, 0% 50%; } 50% { background-position: 80% 40%, 100% 50%; } 100% { background-position: 0% 0%, 0% 50%; } }
          @keyframes fa-card-glow-pulse { 0%, 100% { opacity: .58; transform: scale(1); } 50% { opacity: .9; transform: scale(1.025); } }
          @media (prefers-reduced-motion: reduce) { [data-card-engine="premium-football-card"] * { animation: none !important; transition-duration: 0ms !important; } }
        `}</style>

        <div style={{ position: "absolute", inset: 0, zIndex: 0, background: theme.background }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 1, background: theme.frame, opacity: .84 }} />
        <div style={{ position: "absolute", inset: 6, zIndex: 2, borderRadius: dim.radius - 5, background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.64), transparent 24%), ${theme.chrome}`, opacity: .46, mixBlendMode: "screen" }} />
        <div style={{ position: "absolute", inset: 9, zIndex: 3, borderRadius: dim.radius - 8, border: "1px solid rgba(255,255,255,.34)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.68), inset 0 -18px 30px rgba(0,0,0,.38)" }} />

        <div style={{ position: "absolute", inset: "4.8%", zIndex: 8, borderRadius: dim.radius - 7, overflow: "hidden", background: `radial-gradient(circle at 50% 16%, rgba(${theme.glowRgb},.42), transparent 60%), linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.88))`, boxShadow: "inset 0 0 30px rgba(0,0,0,.56), inset 0 1px 0 rgba(255,255,255,.35)" }}>
          {hasImage ? (
            <img
              src={image}
              alt={player.name}
              onError={onImageError}
              loading="lazy"
              draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", transform: "scale(1.13)", filter: "saturate(1.18) contrast(1.1) brightness(.98)", transformOrigin: "center top" }}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.22)", fontSize: font(scale, 56), fontWeight: 950 }}>
              {displayName(player.name).slice(0, 2)}
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.05) 42%, rgba(0,0,0,.84) 100%)" }} />
        </div>

        <div style={{ position: "absolute", inset: "12% 8% 24%", zIndex: 14, opacity: .18, background: "repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 1px, transparent 1px 10px), repeating-linear-gradient(45deg, rgba(0,0,0,.48) 0 1px, transparent 1px 13px)", mixBlendMode: "overlay", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 4, zIndex: 16, borderRadius: dim.radius - 4, border: "1px solid rgba(255,255,255,.46)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.70), inset 0 -12px 22px rgba(0,0,0,.34)" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 19, background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.74), transparent 19%)`, opacity: "calc(.22 + (var(--shine) * .28))" as unknown as number, mixBlendMode: "screen", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 20, background: theme.foil, backgroundSize: "220% 220%", mixBlendMode: "screen", opacity: .46, pointerEvents: "none", animation: "fa-card-holo-drift 7s linear infinite" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 21, background: theme.holo, backgroundSize: "180% 180%", mixBlendMode: "overlay", opacity: .46, pointerEvents: "none", animation: "fa-card-holo-drift 9s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: "-10% -45%", zIndex: 22, background: "linear-gradient(105deg, transparent 34%, rgba(255,255,255,.46) 46%, rgba(255,255,255,.18) 52%, transparent 64%)", pointerEvents: "none", animation: "fa-card-foil-sweep 4.8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 23, background: theme.glass, mixBlendMode: "screen", opacity: .58, pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: -8, zIndex: 24, borderRadius: dim.radius + 8, background: `radial-gradient(circle at 50% 50%, rgba(${theme.glowRgb},.28), transparent 64%)`, mixBlendMode: "screen", pointerEvents: "none", animation: "fa-card-glow-pulse 3.6s ease-in-out infinite" }} />

        <div style={{ position: "absolute", left: "8%", right: "8%", top: "7%", zIndex: 30, display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "white", fontSize: font(scale, 10), fontWeight: 950, letterSpacing: ".08em", textShadow: "0 2px 4px rgba(0,0,0,.88)", lineHeight: 1.05 }}>
          <div><div>{player.season || "2026-27"}</div><div style={{ color: theme.mutedText }}>{serial}</div></div>
          <div style={{ textAlign: "right" }}><div>{teamCode(team)}</div><div style={{ color: theme.mutedText }}>FA</div></div>
        </div>

        <div style={{ position: "absolute", left: "7%", top: "50%", zIndex: 31, transform: "translateY(-50%)", width: dim.width * .14, height: dim.width * .14, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.34)", color: "white", fontSize: font(scale, 10), fontWeight: 950, lineHeight: 1, boxShadow: "inset 0 1px 0 rgba(255,255,255,.28)" }}>
          {theme.label.slice(0, 2)}
        </div>
        <div style={{ position: "absolute", right: "7%", top: "50%", zIndex: 31, transform: "translateY(-50%)", width: dim.width * .14, height: dim.width * .14, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.34)", color: "white", fontSize: font(scale, 10), fontWeight: 950, lineHeight: 1, boxShadow: "inset 0 1px 0 rgba(255,255,255,.28)" }}>
          FA
        </div>

        <div style={{ position: "absolute", left: "7%", right: "7%", bottom: "7%", zIndex: 35, borderRadius: dim.radius * .48, padding: `${Math.max(6, dim.height * .023)}px ${Math.max(8, dim.width * .045)}px`, background: theme.nameplate, border: "1px solid rgba(255,255,255,.34)", boxShadow: "0 10px 24px rgba(0,0,0,.60), inset 0 1px 0 rgba(255,255,255,.30)", textAlign: "center", lineHeight: 1.05 }}>
          <h3 style={{ margin: 0, color: "white", fontSize: font(scale, 14), fontWeight: 950, letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 2px 4px rgba(0,0,0,.88)" }}>{displayName(player.name)}</h3>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: theme.mutedText, fontSize: font(scale, 9), fontWeight: 900, letterSpacing: ".08em", whiteSpace: "nowrap", overflow: "hidden" }}>
            <span>{player.position || "N/A"}</span><span>•</span><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{team}</span>
          </div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: theme.accent, fontSize: font(scale, 9), fontWeight: 900, letterSpacing: ".08em", whiteSpace: "nowrap" }}>
            <span>OVR {rating || "—"}</span><span>•</span><span>PTS {playerPoints(player)}</span>
          </div>
          {showPrice && price > 0 ? <div style={{ marginTop: 4, color: "#bbf7d0", fontSize: font(scale, 9), fontWeight: 950 }}>N${price.toFixed(2)}</div> : null}
        </div>

        <div style={{ position: "absolute", left: "50%", bottom: "2.4%", zIndex: 36, transform: "translateX(-50%)", padding: `2px ${Math.max(8, dim.width * .045)}px`, borderRadius: 999, background: "rgba(0,0,0,.58)", border: "1px solid rgba(255,255,255,.26)", color: "rgba(255,255,255,.84)", fontSize: font(scale, 8), fontWeight: 950, letterSpacing: ".14em", whiteSpace: "nowrap", lineHeight: 1.2 }}>
          {theme.label}
        </div>
      </article>
    </button>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;

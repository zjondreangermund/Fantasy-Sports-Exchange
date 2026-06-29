import { type PlayerCardWithPlayer } from "../../../shared/schema";
import {
  CARD_SIZES,
  RARITY_THEME,
  normalizeRarity,
  teamAbbrev,
  jerseyNumber,
  type CardSize,
} from "./premium-card-theme";

export interface PremiumFootballCardProps {
  card: PlayerCardWithPlayer;
  size?: CardSize;
  imageUrl?: string | null;
  season?: string;
  points?: number | string;
  className?: string;
}

export default function PremiumFootballCard({
  card,
  size = "md",
  imageUrl,
  season = "2026-27",
  points,
  className = "",
}: PremiumFootballCardProps) {
  const player: Record<string, unknown> = (card as { player?: Record<string, unknown> }).player ?? {};
  const rarity = normalizeRarity((card as { rarity?: string }).rarity);
  const theme = RARITY_THEME[rarity];
  const s = CARD_SIZES[size];
  const fs = s.scale;

  const img =
    imageUrl ??
    (player.photo as string) ??
    (player.photoUrl as string) ??
    (player.imageUrl as string) ??
    (player.image_url as string) ??
    null;

  const clubLogo =
    (player.clubLogo as string) ??
    (player.club_logo as string) ??
    (player.teamLogo as string) ??
    (player.team_logo as string) ??
    null;

  const clubName = String(player.club ?? player.team ?? "");
  const playerName = String(player.name ?? "PLAYER");
  const position = String(player.position ?? "—").toUpperCase();
  const serialNumber = (card as { serialNumber?: number }).serialNumber ?? (card as { serial_number?: number }).serial_number ?? 1;
  const maxSupply = (card as { maxSupply?: number }).maxSupply ?? (card as { max_supply?: number }).max_supply ?? 100;
  const decisive = (card as { decisiveScore?: number }).decisiveScore ?? (card as { decisive_score?: number }).decisive_score;
  const pts = points ?? decisive ?? (player.overall as number) ?? "—";

  const totalW = s.w + s.edge;
  const totalH = s.h + s.edge;

  return (
    <div
      className={`premium-football-card premium-football-card--${rarity} ${className}`}
      style={{
        width: totalW,
        height: totalH,
        ["--glow-rgb" as string]: theme.glowRgb,
      }}
    >
      <div className="premium-football-card__ambient" aria-hidden />

      <div
        className="premium-football-card__edge premium-football-card__edge--right"
        style={{
          width: s.edge,
          height: s.h,
          background: `linear-gradient(180deg, ${theme.edgeLight} 0%, ${theme.edgeMid} 32%, ${theme.edgeDark} 100%)`,
          borderRadius: `0 ${s.radius}px ${s.radius}px 0`,
          transform: `translateZ(-${s.edge}px)`,
        }}
      />

      <div
        className="premium-football-card__edge premium-football-card__edge--bottom"
        style={{
          height: s.edge,
          background: `linear-gradient(90deg, ${theme.edgeDark} 0%, ${theme.edgeLight} 35%, ${theme.edgeMid} 58%, ${theme.edgeDark} 100%)`,
          borderRadius: `0 0 ${s.radius}px ${s.radius}px`,
          transform: `translateZ(-${s.edge}px)`,
        }}
      />

      <div
        className="premium-football-card__face"
        style={{
          width: s.w,
          height: s.h,
          borderRadius: s.radius,
          background: theme.face,
          boxShadow: `${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.72), inset 0 -3px 0 rgba(0,0,0,0.42), inset 0 0 35px rgba(255,255,255,0.08)`,
          border: `2px solid ${theme.border}`,
        }}
      >
        <div
          className="premium-football-card__frame"
          style={{
            inset: 4 * fs,
            borderRadius: s.radius - 3,
            background: theme.frame,
            opacity: 0.72,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.78), inset 0 -1px 0 rgba(0,0,0,0.28), 0 0 22px rgba(var(--glow-rgb),0.18)`,
          }}
        >
          <div className="premium-football-card__frame-highlight" style={{ background: theme.frameHighlight }} />
        </div>

        <div className="premium-football-card__foil" style={{ background: theme.foil, opacity: 0.68 }} aria-hidden />
        <div className="premium-football-card__holo" style={{ background: theme.holo, opacity: 0.58 }} aria-hidden />
        <div className="premium-football-card__chrome-sweep" aria-hidden />
        <div className="premium-football-card__glass" aria-hidden />

        <div
          className="premium-football-card__inner"
          style={{
            inset: `${9 * fs}px ${7 * fs}px ${7 * fs}px`,
            borderRadius: s.radius - 6,
            boxShadow: "inset 0 0 26px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.20)",
          }}
        >
          <div
            className="premium-football-card__photo-window"
            style={{
              borderColor: theme.windowBorder,
              background: theme.windowBg,
              marginTop: 26 * fs,
              boxShadow: `inset 0 0 28px rgba(0,0,0,0.72), inset 0 8px 22px rgba(255,255,255,0.05), 0 0 22px rgba(var(--glow-rgb),0.22)`,
            }}
          >
            <div className="premium-football-card__stadium-lights" style={{ background: theme.studioGlow }} />
            <div className="premium-football-card__turf" />

            {img ? (
              <img
                src={img}
                alt={playerName}
                className="premium-football-card__photo"
                style={{
                  objectFit: "contain",
                  objectPosition: "bottom center",
                  inset: "auto -8% 0 -8%",
                  width: "116%",
                  height: "116%",
                  maxWidth: "none",
                }}
                loading="lazy"
                draggable={false}
              />
            ) : (
              <div className="premium-football-card__photo-placeholder">
                {playerName.charAt(0)}
              </div>
            )}

            <div className="premium-football-card__photo-vignette" />
            <div className="premium-football-card__photo-glass" />
          </div>

          <div className="premium-football-card__header" style={{ fontSize: 7 * fs }}>
            <div className="premium-football-card__header-left">
              <span className="premium-football-card__season">{season}</span>
              <span className="premium-football-card__mint">
                <span aria-hidden>⚽</span> {serialNumber}/{maxSupply}
              </span>
            </div>
            <div className="premium-football-card__header-right">
              <span className="premium-football-card__team">{teamAbbrev(clubName)}</span>
              <span className="premium-football-card__jersey">{jerseyNumber(serialNumber)}</span>
            </div>
          </div>

          <div className="premium-football-card__footer">
            <h3 className="premium-football-card__name" style={{ fontSize: 13 * fs }}>
              {playerName.toUpperCase()}
            </h3>
            <p className="premium-football-card__position" style={{ fontSize: 8 * fs, color: theme.accent }}>
              {position}
            </p>

            <div className="premium-football-card__stats" style={{ fontSize: 7 * fs }}>
              <span>
                PTS <strong>{pts}</strong>
              </span>
              <span className="premium-football-card__stats-divider">•</span>
              <span>{clubName || "Unknown"}</span>
            </div>

            <div
              className="premium-football-card__edition"
              style={{ background: theme.labelBg, fontSize: 6.5 * fs }}
            >
              {theme.label}
            </div>

            <div className="premium-football-card__badges">
              <span className="premium-football-card__star" aria-hidden>
                ★
              </span>
              {clubLogo ? (
                <img src={clubLogo} alt="" className="premium-football-card__crest" />
              ) : (
                <span className="premium-football-card__fa-logo">FA</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

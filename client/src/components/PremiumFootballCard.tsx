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
  const pts = points ?? (player.overall as number) ?? "—";

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
      {/* Ambient rarity glow */}
      <div className="premium-football-card__ambient" aria-hidden />

      {/* 3D edge — right */}
      <div
        className="premium-football-card__edge premium-football-card__edge--right"
        style={{
          width: s.edge,
          height: s.h,
          background: `linear-gradient(180deg, ${theme.edgeLight} 0%, ${theme.edgeMid} 35%, ${theme.edgeDark} 100%)`,
          borderRadius: `0 ${s.radius}px ${s.radius}px 0`,
          transform: `translateZ(-${s.edge}px)`,
        }}
      />

      {/* 3D edge — bottom */}
      <div
        className="premium-football-card__edge premium-football-card__edge--bottom"
        style={{
          height: s.edge,
          background: `linear-gradient(90deg, ${theme.edgeDark} 0%, ${theme.edgeMid} 40%, ${theme.edgeDark} 100%)`,
          borderRadius: `0 0 ${s.radius}px ${s.radius}px`,
          transform: `translateZ(-${s.edge}px)`,
        }}
      />

      {/* Main face */}
      <div
        className="premium-football-card__face"
        style={{
          width: s.w,
          height: s.h,
          borderRadius: s.radius,
          background: theme.face,
          boxShadow: `${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.35)`,
          border: `1.5px solid ${theme.border}`,
        }}
      >
        {/* Metallic chrome frame inset */}
        <div
          className="premium-football-card__frame"
          style={{
            inset: 5 * fs,
            borderRadius: s.radius - 4,
            background: theme.frame,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.25)`,
          }}
        >
          <div className="premium-football-card__frame-highlight" style={{ background: theme.frameHighlight }} />
        </div>

        {/* Holographic foil layer */}
        <div className="premium-football-card__foil" style={{ background: theme.foil }} aria-hidden />
        <div className="premium-football-card__holo" style={{ background: theme.holo }} aria-hidden />

        {/* Chrome sweep animation */}
        <div className="premium-football-card__chrome-sweep" aria-hidden />

        {/* Glass top highlight */}
        <div className="premium-football-card__glass" aria-hidden />

        {/* Inner content area */}
        <div
          className="premium-football-card__inner"
          style={{
            inset: `${10 * fs}px ${8 * fs}px ${8 * fs}px`,
            borderRadius: s.radius - 6,
          }}
        >
          {/* Stadium lights + photo window */}
          <div className="premium-football-card__photo-window" style={{ borderColor: theme.windowBorder }}>
            <div className="premium-football-card__stadium-lights" style={{ background: theme.studioGlow }} />
            <div className="premium-football-card__turf" />

            {img ? (
              <img
                src={img}
                alt={playerName}
                className="premium-football-card__photo"
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

          {/* Header row */}
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

          {/* Footer info */}
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

import { type CSSProperties } from "react";
import { type PlayerCardData } from "./types";
import { CARD_THEMES, normalizeRarity } from "./cardTheme";

type Props = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  size?: "sm" | "md";
};

const SIZE = {
  sm: { width: 174, height: 252, radius: 24, pad: 7 },
  md: { width: 232, height: 334, radius: 30, pad: 9 },
};

const RARITY_GLOW: Record<string, string> = {
  common: "rgba(226,232,240,.48)",
  rare: "rgba(96,165,250,.68)",
  epic: "rgba(168,85,247,.75)",
  unique: "rgba(236,72,153,.78)",
  legendary: "rgba(251,191,36,.86)",
};

const RARITY_EDGE: Record<string, string> = {
  common: "linear-gradient(135deg,#f8fafc,#64748b 30%,#f8fafc 52%,#1e293b 82%,#e2e8f0)",
  rare: "linear-gradient(135deg,#dbeafe,#3b82f6 30%,#ffffff 48%,#1d4ed8 78%,#bfdbfe)",
  epic: "linear-gradient(135deg,#f5d0fe,#8b5cf6 28%,#ffffff 48%,#4c1d95 76%,#c4b5fd)",
  unique: "linear-gradient(135deg,#fce7f3,#ec4899 25%,#ffffff 48%,#7e22ce 78%,#bae6fd)",
  legendary: "linear-gradient(135deg,#fff7cc,#f59e0b 24%,#ffffff 44%,#92400e 74%,#fde68a)",
};

function imageOf(player: PlayerCardData) {
  return player.image || player.imageUrl || player.photo || player.imageCandidates?.[0] || "/players/fallback.svg";
}

function nameOf(player: PlayerCardData) {
  return String(player.name || "Unknown Player").toUpperCase();
}

function stat(player: PlayerCardData, fallback = 0) {
  return Math.max(0, Math.round(Number(player.rating || player.form || player.totalPoints || fallback || 0)));
}

function isFallbackImage(image: string) {
  return image.includes("/players/fallback") || image.includes("fallback.svg");
}

export default function CollectionStableCard({ player, selected = false, onClick, showPrice = false, size = "sm" }: Props) {
  const rarity = normalizeRarity(player.rarity);
  const theme = CARD_THEMES[rarity];
  const dim = SIZE[size] || SIZE.sm;
  const image = imageOf(player);
  const team = player.team || player.club || "Fantasy Arena";
  const price = Number(player.price || player.listedPrice || 0);
  const glow = RARITY_GLOW[rarity] || RARITY_GLOW.common;
  const edge = RARITY_EDGE[rarity] || RARITY_EDGE.common;
  const points = Math.max(0, Math.round(Number(player.totalPoints || player.form || player.rating || 0)));
  const scale = dim.width / SIZE.sm.width;
  const fallback = isFallbackImage(image);

  const cardStyle: CSSProperties = {
    width: dim.width,
    height: dim.height,
    borderRadius: dim.radius,
    position: "relative",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.78)",
    background: `${edge}, ${theme.chrome}`,
    boxShadow: selected
      ? `0 0 0 3px #34d399, 0 0 44px ${glow}, 0 24px 58px rgba(0,0,0,.72), inset 0 1px 0 rgba(255,255,255,.85)`
      : `0 0 34px ${glow}, 0 26px 54px rgba(0,0,0,.72), inset 0 1px 0 rgba(255,255,255,.88), inset 0 -18px 42px rgba(0,0,0,.36)`,
    color: "white",
    transform: "translateZ(0)",
  };

  return (
    <button type="button" onClick={onClick} className="group relative block touch-manipulation fa-card-lift" style={{ background: "transparent", border: 0, padding: 0, perspective: 900 }}>
      <span aria-hidden="true" className="absolute -inset-4 rounded-[2.4rem] opacity-75 blur-3xl transition duration-300 group-hover:opacity-95 group-active:scale-95" style={{ background: `radial-gradient(circle, ${glow}, transparent 60%)` }} />
      <span aria-hidden="true" className="absolute -inset-[2px] rounded-[2rem] opacity-80" style={{ background: edge }} />
      <article style={cardStyle} className="transition duration-300 group-hover:[transform:rotateX(2deg)_rotateY(-3deg)_translateY(-4px)]">
        <div style={{ position: "absolute", inset: 2, borderRadius: dim.radius - 2, background: "linear-gradient(145deg, rgba(255,255,255,.58), rgba(255,255,255,.08) 18%, rgba(2,6,23,.55) 45%, rgba(255,255,255,.22))", opacity: .9 }} />
        <div style={{ position: "absolute", inset: 0, background: theme.background, opacity: .86 }} />
        <div style={{ position: "absolute", inset: dim.pad, borderRadius: dim.radius - 9, overflow: "hidden", background: "linear-gradient(180deg,#111827,#020617)", boxShadow: "inset 0 0 38px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.2)" }}>
          <img
            src={image}
            alt={player.name}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: fallback ? "contain" : "cover",
              objectPosition: "center top",
              display: "block",
              padding: fallback ? `${12 * scale}px ${10 * scale}px 0` : 0,
              filter: fallback ? "saturate(1.05) contrast(1.1) brightness(.96)" : "saturate(1.24) contrast(1.15) brightness(1.04)",
              transform: fallback ? "scale(.95)" : "scale(1.06)",
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 15%, rgba(255,255,255,.36), transparent 34%), linear-gradient(180deg,rgba(255,255,255,.10),rgba(0,0,0,.00) 35%,rgba(0,0,0,.22) 55%,rgba(0,0,0,.88))" }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 82%, ${glow}, transparent 32%)`, mixBlendMode: "screen", opacity: .36 }} />
        </div>
        <div style={{ position: "absolute", inset: 0, background: theme.foil, mixBlendMode: "screen", opacity: rarity === "common" ? .42 : .62 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, transparent 7%, rgba(255,255,255,.58) 15%, transparent 24%, transparent 48%, rgba(255,255,255,.42) 60%, transparent 72%)", mixBlendMode: "screen", opacity: .92 }} />
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg, rgba(255,255,255,.09) 0 1px, transparent 1px 8px)", opacity: rarity === "common" ? .20 : .34, mixBlendMode: "overlay" }} />
        <div style={{ position: "absolute", inset: 4, borderRadius: dim.radius - 4, border: "1px solid rgba(255,255,255,.82)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), inset 0 -14px 26px rgba(0,0,0,.34)" }} />
        <div style={{ position: "absolute", inset: 11, borderRadius: dim.radius - 14, border: "1px solid rgba(255,255,255,.25)", boxShadow: `0 0 18px ${glow}` }} />
        <div style={{ position: "absolute", top: 13, left: 13, right: 13, display: "flex", justifyContent: "space-between", fontSize: 10 * scale, fontWeight: 950, letterSpacing: ".06em", textShadow: "0 3px 5px #000", lineHeight: 1.05 }}>
          <span>{player.season || "2026-27"}<br /><span style={{ color: "rgba(255,255,255,.80)" }}>{player.serial || 1}/{player.maxSupply || 100}</span></span>
          <span style={{ textAlign: "right" }}>{team.slice(0, 3).toUpperCase()}<br /><span style={{ color: "rgba(255,255,255,.80)" }}>FA</span></span>
        </div>
        <div style={{ position: "absolute", left: 13, top: "51%", transform: "translateY(-50%)", width: 33 * scale, height: 33 * scale, borderRadius: 999, background: "rgba(0,0,0,.62)", border: "1px solid rgba(255,255,255,.32)", display: "grid", placeItems: "center", fontSize: 10 * scale, fontWeight: 950, boxShadow: `0 0 22px ${glow}, inset 0 1px 0 rgba(255,255,255,.28)` }}>{theme.label.slice(0, 2)}</div>
        <div style={{ position: "absolute", right: 13, top: "51%", transform: "translateY(-50%)", width: 33 * scale, height: 33 * scale, borderRadius: 999, background: "rgba(0,0,0,.62)", border: "1px solid rgba(255,255,255,.32)", display: "grid", placeItems: "center", fontSize: 10 * scale, fontWeight: 950, boxShadow: `0 0 22px ${glow}, inset 0 1px 0 rgba(255,255,255,.28)` }}>FA</div>
        <div style={{ position: "absolute", left: 13, right: 13, bottom: 23, padding: `${8 * scale}px ${10 * scale}px`, borderRadius: 15 * scale, background: `linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.06)), ${theme.nameplate}`, border: "1px solid rgba(255,255,255,.38)", boxShadow: `0 12px 26px rgba(0,0,0,.68), 0 0 22px ${glow}, inset 0 1px 0 rgba(255,255,255,.32)`, backdropFilter: "blur(10px)", textAlign: "center" }}>
          <div style={{ fontSize: 13.5 * scale, lineHeight: 1.05, fontWeight: 950, letterSpacing: ".035em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 3px 6px rgba(0,0,0,.95)" }}>{nameOf(player)}</div>
          <div style={{ marginTop: 4, fontSize: 9.2 * scale, fontWeight: 900, color: theme.mutedText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".08em" }}>{player.position || "N/A"} • {team}</div>
          <div style={{ marginTop: 4, fontSize: 9.2 * scale, fontWeight: 950, color: theme.accent, letterSpacing: ".08em", textShadow: "0 0 10px rgba(255,255,255,.35)" }}>OVR {stat(player)} • PTS {points}</div>
          {showPrice && price > 0 ? <div style={{ marginTop: 4, fontSize: 9.2 * scale, fontWeight: 950, color: "#bbf7d0" }}>N${price.toFixed(2)}</div> : null}
        </div>
        <div style={{ position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)", fontSize: 8 * scale, fontWeight: 950, letterSpacing: ".17em", background: "rgba(0,0,0,.76)", padding: `2px ${11 * scale}px`, borderRadius: 999, border: "1px solid rgba(255,255,255,.25)", whiteSpace: "nowrap", boxShadow: `0 0 16px ${glow}` }}>{theme.label}</div>
      </article>
    </button>
  );
}

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
  sm: { width: 164, height: 236, radius: 22, pad: 8 },
  md: { width: 214, height: 308, radius: 28, pad: 10 },
};

const RARITY_GLOW: Record<string, string> = {
  common: "rgba(203,213,225,.42)",
  rare: "rgba(59,130,246,.55)",
  epic: "rgba(168,85,247,.62)",
  unique: "rgba(236,72,153,.62)",
  legendary: "rgba(251,191,36,.72)",
};

function imageOf(player: PlayerCardData) {
  return player.image || player.imageUrl || player.photo || player.imageCandidates?.[0] || "";
}

function nameOf(player: PlayerCardData) {
  return String(player.name || "Unknown Player").toUpperCase();
}

function stat(player: PlayerCardData, fallback = 0) {
  return Math.max(0, Math.round(Number(player.rating || player.form || player.totalPoints || fallback || 0)));
}

export default function CollectionStableCard({ player, selected = false, onClick, showPrice = false, size = "sm" }: Props) {
  const rarity = normalizeRarity(player.rarity);
  const theme = CARD_THEMES[rarity];
  const dim = SIZE[size] || SIZE.sm;
  const image = imageOf(player);
  const team = player.team || player.club || "Fantasy Arena";
  const price = Number(player.price || player.listedPrice || 0);
  const glow = RARITY_GLOW[rarity] || RARITY_GLOW.common;
  const points = Math.max(0, Math.round(Number(player.totalPoints || player.form || player.rating || 0)));
  const scale = dim.width / SIZE.sm.width;

  const cardStyle: CSSProperties = {
    width: dim.width,
    height: dim.height,
    borderRadius: dim.radius,
    position: "relative",
    overflow: "hidden",
    border: `1px solid rgba(255,255,255,.62)`,
    background: `linear-gradient(145deg, rgba(255,255,255,.42), rgba(255,255,255,.08) 18%, rgba(5,10,28,.74) 50%, rgba(255,255,255,.18)), ${theme.chrome}`,
    boxShadow: selected
      ? `0 0 0 3px #34d399, 0 0 34px ${glow}, 0 20px 42px rgba(0,0,0,.65)`
      : `0 0 26px ${glow}, 0 18px 38px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.65)`,
    color: "white",
    transform: "translateZ(0)",
  };

  return (
    <button type="button" onClick={onClick} className="group relative block touch-manipulation" style={{ background: "transparent", border: 0, padding: 0 }}>
      <span aria-hidden="true" className="absolute -inset-2 rounded-[2rem] opacity-60 blur-2xl transition group-active:scale-95" style={{ background: `radial-gradient(circle, ${glow}, transparent 62%)` }} />
      <article style={cardStyle}>
        <div style={{ position: "absolute", inset: 0, background: theme.background, opacity: .9 }} />
        <div style={{ position: "absolute", inset: dim.pad, borderRadius: dim.radius - 8, overflow: "hidden", background: "linear-gradient(180deg,#111827,#020617)", boxShadow: "inset 0 0 30px rgba(0,0,0,.7)" }}>
          {image ? (
            <img src={image} alt={player.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(1.15) contrast(1.08) brightness(.98)" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontWeight: 950, fontSize: 36 * scale, color: "rgba(255,255,255,.25)" }}>{nameOf(player).slice(0, 2)}</div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.18),rgba(0,0,0,.02) 33%,rgba(0,0,0,.28) 56%,rgba(0,0,0,.88))" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 20%, rgba(255,255,255,.38), transparent 40%)", mixBlendMode: "screen" }} />
        </div>
        <div style={{ position: "absolute", inset: 0, background: theme.foil, mixBlendMode: "screen", opacity: .45 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, transparent 8%, rgba(255,255,255,.40) 16%, transparent 27%, transparent 56%, rgba(255,255,255,.30) 66%, transparent 78%)", mixBlendMode: "screen" }} />
        <div style={{ position: "absolute", inset: 4, borderRadius: dim.radius - 4, border: "1px solid rgba(255,255,255,.70)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.7), inset 0 -10px 20px rgba(0,0,0,.28)" }} />
        <div style={{ position: "absolute", inset: 10, borderRadius: dim.radius - 12, border: "1px solid rgba(255,255,255,.22)" }} />
        <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", justifyContent: "space-between", fontSize: 10 * scale, fontWeight: 950, letterSpacing: ".06em", textShadow: "0 2px 4px #000", lineHeight: 1.05 }}>
          <span>{player.season || "2026-27"}<br /><span style={{ color: "rgba(255,255,255,.72)" }}>{player.serial || 1}/{player.maxSupply || 100}</span></span>
          <span style={{ textAlign: "right" }}>{team.slice(0, 3).toUpperCase()}<br /><span style={{ color: "rgba(255,255,255,.72)" }}>FA</span></span>
        </div>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 31 * scale, height: 31 * scale, borderRadius: 999, background: "rgba(0,0,0,.54)", border: "1px solid rgba(255,255,255,.28)", display: "grid", placeItems: "center", fontSize: 10 * scale, fontWeight: 950, boxShadow: `0 0 18px ${glow}` }}>{theme.label.slice(0, 2)}</div>
        <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", width: 31 * scale, height: 31 * scale, borderRadius: 999, background: "rgba(0,0,0,.54)", border: "1px solid rgba(255,255,255,.28)", display: "grid", placeItems: "center", fontSize: 10 * scale, fontWeight: 950, boxShadow: `0 0 18px ${glow}` }}>FA</div>
        <div style={{ position: "absolute", left: 14, right: 14, bottom: 22, padding: `${7 * scale}px ${9 * scale}px`, borderRadius: 14 * scale, background: theme.nameplate, border: "1px solid rgba(255,255,255,.32)", boxShadow: "0 10px 22px rgba(0,0,0,.64), inset 0 1px 0 rgba(255,255,255,.28)", backdropFilter: "blur(8px)", textAlign: "center" }}>
          <div style={{ fontSize: 13 * scale, lineHeight: 1.05, fontWeight: 950, letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 2px 5px rgba(0,0,0,.9)" }}>{nameOf(player)}</div>
          <div style={{ marginTop: 4, fontSize: 9 * scale, fontWeight: 900, color: theme.mutedText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".08em" }}>{player.position || "N/A"} • {team}</div>
          <div style={{ marginTop: 4, fontSize: 9 * scale, fontWeight: 950, color: theme.accent, letterSpacing: ".08em" }}>OVR {stat(player)} • PTS {points}</div>
          {showPrice && price > 0 ? <div style={{ marginTop: 4, fontSize: 9 * scale, fontWeight: 950, color: "#bbf7d0" }}>N${price.toFixed(2)}</div> : null}
        </div>
        <div style={{ position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)", fontSize: 8 * scale, fontWeight: 950, letterSpacing: ".16em", background: "rgba(0,0,0,.68)", padding: `2px ${10 * scale}px`, borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", whiteSpace: "nowrap" }}>{theme.label}</div>
      </article>
    </button>
  );
}

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
  sm: { width: 144, height: 216, radius: 19, pad: 7 },
  md: { width: 168, height: 252, radius: 22, pad: 8 },
};

const RARITY_GLOW: Record<string, string> = {
  common: "rgba(226,232,240,.46)",
  rare: "rgba(248,113,113,.58)",
  epic: "rgba(96,165,250,.70)",
  unique: "rgba(236,72,153,.72)",
  legendary: "rgba(251,191,36,.86)",
};

const RARITY_EDGE: Record<string, string> = {
  common: "linear-gradient(135deg,#f8fafc,#6b7280 20%,#ffffff 39%,#334155 63%,#e2e8f0)",
  rare: "linear-gradient(135deg,#fff1f2,#ef4444 20%,#ffffff 39%,#7f1d1d 63%,#fecaca)",
  epic: "linear-gradient(135deg,#eef2ff,#6366f1 20%,#ffffff 39%,#1d4ed8 63%,#bfdbfe)",
  unique: "linear-gradient(135deg,#fdf2f8,#ec4899 18%,#ffffff 39%,#7e22ce 62%,#bae6fd)",
  legendary: "linear-gradient(135deg,#fff7cc,#f59e0b 18%,#ffffff 39%,#92400e 62%,#fde68a)",
};

const SLAB: Record<string, string> = {
  common: "linear-gradient(145deg,#f8fafc 0%,#94a3b8 20%,#334155 44%,#e2e8f0 62%,#111827 86%,#f8fafc 100%)",
  rare: "linear-gradient(145deg,#fff1f2 0%,#ef4444 20%,#7f1d1d 44%,#fecaca 62%,#2b0606 86%,#fff1f2 100%)",
  epic: "linear-gradient(145deg,#eef2ff 0%,#6366f1 20%,#1d4ed8 44%,#dbeafe 62%,#172554 86%,#eef2ff 100%)",
  unique: "linear-gradient(145deg,#fdf2f8 0%,#ec4899 18%,#0891b2 43%,#f0abfc 62%,#581c87 86%,#fdf2f8 100%)",
  legendary: "linear-gradient(145deg,#fff7cc 0%,#facc15 18%,#a16207 43%,#fff2a8 62%,#78350f 86%,#fff7cc 100%)",
};

function imageOf(player: PlayerCardData) {
  return player.image || player.imageUrl || player.photo || player.imageCandidates?.[0] || "/players/fallback.svg";
}

function nameOf(player: PlayerCardData) {
  const parts = String(player.name || "Unknown Player").trim().split(/\s+/);
  if (parts.length <= 2) return parts.join(" ").toUpperCase();
  return `${parts[0]} ${parts[parts.length - 1]}`.toUpperCase();
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
  const slab = SLAB[rarity] || SLAB.common;
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
    background: `${edge}, ${slab}`,
    boxShadow: selected
      ? `0 0 0 3px #34d399, 0 0 38px ${glow}, 0 22px 48px rgba(0,0,0,.68), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -18px 34px rgba(0,0,0,.44)`
      : `0 0 28px ${glow}, 0 22px 46px rgba(0,0,0,.68), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -18px 34px rgba(0,0,0,.44)`,
    color: "white",
    transform: "translateZ(0)",
  };

  return (
    <button type="button" onClick={onClick} className="group relative block touch-manipulation fa-card-lift" style={{ background: "transparent", border: 0, padding: 0, perspective: 800 }}>
      <span aria-hidden="true" className="absolute -inset-4 rounded-[2rem] opacity-70 blur-2xl transition duration-300 group-hover:opacity-95" style={{ background: `radial-gradient(circle, ${glow}, transparent 64%)` }} />
      <article style={cardStyle} className="transition duration-300 group-hover:[transform:rotateX(2deg)_rotateY(-2deg)_translateY(-3px)]">
        <div style={{ position: "absolute", inset: 3, borderRadius: dim.radius - 3, background: slab, opacity: .96 }} />
        <div style={{ position: "absolute", inset: 5, borderRadius: dim.radius - 6, border: "1px solid rgba(255,255,255,.58)", boxShadow: "inset 0 2px 5px rgba(255,255,255,.62), inset 0 -18px 28px rgba(0,0,0,.38)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 14%, rgba(255,255,255,.55), transparent 22%), linear-gradient(116deg, transparent 10%, rgba(255,255,255,.58) 20%, transparent 32%, transparent 58%, rgba(255,255,255,.36) 68%, transparent 80%)", mixBlendMode: "screen", opacity: .80 }} />
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg, rgba(255,255,255,.15) 0 1px, rgba(0,0,0,.06) 1px 2px, transparent 2px 8px)", mixBlendMode: "overlay", opacity: .36 }} />

        <div style={{ position: "absolute", left: 15 * scale, right: 15 * scale, top: 17 * scale, height: 126 * scale, borderRadius: 12 * scale, overflow: "hidden", background: "radial-gradient(circle at 50% 10%,rgba(255,255,255,.24),rgba(15,23,42,.68) 45%,rgba(2,6,23,.9))", border: "1px solid rgba(255,255,255,.46)", boxShadow: `inset 0 0 26px rgba(0,0,0,.60), 0 8px 16px rgba(0,0,0,.32), 0 0 18px ${glow}` }}>
          <img src={image} alt={player.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? `${18 * scale}px ${18 * scale}px 0` : 0, filter: fallback ? "saturate(.94) contrast(1.08) brightness(1.04)" : "saturate(1.10) contrast(1.08) brightness(1.03)", transform: fallback ? "scale(.78)" : "scale(.84)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.13),transparent 38%,rgba(0,0,0,.30)), radial-gradient(circle at 50% 2%, rgba(255,255,255,.46), transparent 26%)" }} />
        </div>

        <div style={{ position: "absolute", top: 15 * scale, left: 15 * scale, fontSize: 8.4 * scale, fontWeight: 950, lineHeight: 1.05, textShadow: "0 2px 5px rgba(0,0,0,.88)" }}>{player.season || "2026-27"}<br />{player.serial || 1}/{player.maxSupply || 100}</div>
        <div style={{ position: "absolute", top: 15 * scale, right: 15 * scale, fontSize: 8.4 * scale, fontWeight: 950, textAlign: "right", lineHeight: 1.05, textShadow: "0 2px 5px rgba(0,0,0,.88)" }}>{team.slice(0, 3).toUpperCase()}<br />FA</div>
        <div style={{ position: "absolute", left: 13 * scale, top: 111 * scale, width: 26 * scale, height: 26 * scale, borderRadius: 999, background: "rgba(2,6,23,.78)", border: "1px solid rgba(255,255,255,.42)", display: "grid", placeItems: "center", fontSize: 8 * scale, fontWeight: 950, boxShadow: `0 0 16px ${glow}, inset 0 1px 0 rgba(255,255,255,.26)` }}>{rarity.slice(0, 2).toUpperCase()}</div>
        <div style={{ position: "absolute", right: 13 * scale, top: 111 * scale, width: 26 * scale, height: 26 * scale, borderRadius: 999, background: "rgba(2,6,23,.78)", border: "1px solid rgba(255,255,255,.42)", display: "grid", placeItems: "center", fontSize: 8 * scale, fontWeight: 950, boxShadow: `0 0 16px ${glow}, inset 0 1px 0 rgba(255,255,255,.26)` }}>FA</div>

        <div style={{ position: "absolute", left: 11 * scale, right: 11 * scale, bottom: 31 * scale, padding: `${7 * scale}px ${8 * scale}px`, borderRadius: 12 * scale, background: `linear-gradient(180deg, rgba(255,255,255,.18), rgba(0,0,0,.06)), ${theme.nameplate}`, border: "1px solid rgba(255,255,255,.48)", boxShadow: `0 9px 18px rgba(0,0,0,.64), 0 0 18px ${glow}, inset 0 1px 0 rgba(255,255,255,.40)`, textAlign: "center" }}>
          <div style={{ fontSize: 12.5 * scale, lineHeight: 1.02, fontWeight: 950, letterSpacing: ".025em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 3px 5px rgba(0,0,0,.92)" }}>{nameOf(player)}</div>
          <div style={{ marginTop: 3, fontSize: 7.8 * scale, fontWeight: 900, color: "rgba(255,255,255,.72)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".07em" }}>{player.position || "N/A"} • {team}</div>
          <div style={{ marginTop: 3, fontSize: 7.8 * scale, fontWeight: 950, color: theme.accent, letterSpacing: ".07em", textShadow: `0 0 10px ${glow}` }}>OVR {stat(player)} • PTS {points}</div>
          {showPrice && price > 0 ? <div style={{ marginTop: 3, fontSize: 7.8 * scale, fontWeight: 950, color: "#bbf7d0" }}>N${price.toFixed(2)}</div> : null}
        </div>
        <div style={{ position: "absolute", left: "50%", bottom: 7 * scale, transform: "translateX(-50%)", fontSize: 6.7 * scale, fontWeight: 950, letterSpacing: ".15em", background: "rgba(2,6,23,.84)", padding: `${2 * scale}px ${8 * scale}px`, borderRadius: 999, border: "1px solid rgba(255,255,255,.32)", whiteSpace: "nowrap", boxShadow: `0 0 14px ${glow}` }}>{theme.label}</div>
      </article>
    </button>
  );
}

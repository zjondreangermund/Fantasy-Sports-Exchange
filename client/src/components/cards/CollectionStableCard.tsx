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
  sm: { width: 148, height: 220, radius: 20, pad: 8 },
  md: { width: 178, height: 266, radius: 24, pad: 9 },
};

const RARITY_GLOW: Record<string, string> = {
  common: "rgba(226,232,240,.46)",
  rare: "rgba(251,146,60,.62)",
  epic: "rgba(129,140,248,.68)",
  unique: "rgba(236,72,153,.72)",
  legendary: "rgba(251,191,36,.76)",
};

const RARITY_EDGE: Record<string, string> = {
  common: "linear-gradient(135deg,#ffffff,#94a3b8 18%,#f8fafc 36%,#475569 58%,#ffffff 80%,#94a3b8)",
  rare: "linear-gradient(135deg,#fff7ed,#fb923c 20%,#ffffff 38%,#7f1d1d 60%,#fed7aa 82%,#fff7ed)",
  epic: "linear-gradient(135deg,#eef2ff,#818cf8 20%,#ffffff 38%,#1d4ed8 60%,#c4b5fd 82%,#eef2ff)",
  unique: "linear-gradient(135deg,#fdf2f8,#ec4899 20%,#ffffff 38%,#06b6d4 60%,#c084fc 82%,#fdf2f8)",
  legendary: "linear-gradient(135deg,#fffde7,#fbbf24 20%,#ffffff 38%,#92400e 60%,#fde68a 82%,#fffde7)",
};

const METAL_SLAB: Record<string, string> = {
  common: "linear-gradient(145deg,#f8fafc 0%,#cbd5e1 18%,#64748b 38%,#e2e8f0 58%,#334155 80%,#f8fafc 100%)",
  rare: "linear-gradient(145deg,#fff7ed 0%,#fb923c 18%,#7f1d1d 42%,#fecaca 60%,#3f1111 82%,#fff7ed 100%)",
  epic: "linear-gradient(145deg,#eef2ff 0%,#818cf8 18%,#1d4ed8 42%,#e0e7ff 60%,#312e81 82%,#eef2ff 100%)",
  unique: "linear-gradient(145deg,#fdf2f8 0%,#ec4899 18%,#0891b2 42%,#f0abfc 60%,#581c87 82%,#fdf2f8 100%)",
  legendary: "linear-gradient(145deg,#fffde7 0%,#facc15 18%,#92400e 42%,#fff7cc 60%,#78350f 82%,#fffde7 100%)",
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
  const slab = METAL_SLAB[rarity] || METAL_SLAB.common;
  const points = Math.max(0, Math.round(Number(player.totalPoints || player.form || player.rating || 0)));
  const scale = dim.width / SIZE.sm.width;
  const fallback = isFallbackImage(image);

  const cardStyle: CSSProperties = {
    width: dim.width,
    height: dim.height,
    borderRadius: dim.radius,
    position: "relative",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.86)",
    background: `${edge}, ${slab}`,
    boxShadow: selected
      ? `0 0 0 3px #34d399, 0 0 34px ${glow}, 0 18px 42px rgba(0,0,0,.66), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -18px 34px rgba(0,0,0,.42)`
      : `0 0 24px ${glow}, 0 18px 40px rgba(0,0,0,.66), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -16px 34px rgba(0,0,0,.42)`,
    color: "white",
    transform: "translateZ(0)",
  };

  return (
    <button type="button" onClick={onClick} className="group relative block touch-manipulation fa-card-lift" style={{ background: "transparent", border: 0, padding: 0, perspective: 800 }}>
      <span aria-hidden="true" className="absolute -inset-3 rounded-[1.8rem] opacity-60 blur-2xl transition duration-300 group-hover:opacity-90" style={{ background: `radial-gradient(circle, ${glow}, transparent 64%)` }} />
      <article style={cardStyle} className="transition duration-300 group-hover:[transform:rotateX(2deg)_rotateY(-2deg)_translateY(-3px)]">
        <div style={{ position: "absolute", inset: 3, borderRadius: dim.radius - 3, background: slab, opacity: .96 }} />
        <div style={{ position: "absolute", inset: 6, borderRadius: dim.radius - 8, border: "1px solid rgba(255,255,255,.56)", boxShadow: "inset 0 2px 5px rgba(255,255,255,.58), inset 0 -18px 28px rgba(0,0,0,.34)" }} />
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg, rgba(255,255,255,.18) 0 1px, rgba(0,0,0,.06) 1px 2px, transparent 2px 9px)", mixBlendMode: "overlay", opacity: .44 }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 25% 16%, rgba(255,255,255,.64), transparent 18%), radial-gradient(circle at 78% 72%, rgba(255,255,255,.18), transparent 22%), linear-gradient(116deg, transparent 10%, rgba(255,255,255,.54) 20%, transparent 32%, transparent 58%, rgba(255,255,255,.36) 68%, transparent 80%)", mixBlendMode: "screen", opacity: .78 }} />

        <div style={{ position: "absolute", left: 11 * scale, right: 11 * scale, top: 12 * scale, height: 118 * scale, borderRadius: 14 * scale, overflow: "hidden", background: "linear-gradient(180deg,rgba(2,6,23,.84),rgba(15,23,42,.42))", border: "1px solid rgba(255,255,255,.46)", boxShadow: "inset 0 0 28px rgba(0,0,0,.62), 0 8px 16px rgba(0,0,0,.32)" }}>
          <img src={image} alt={player.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? `${13 * scale}px ${16 * scale}px 0` : 0, filter: fallback ? "saturate(.92) contrast(1.05) brightness(1.04)" : "saturate(1.08) contrast(1.08) brightness(1.02)", transform: fallback ? "scale(.82)" : "scale(.9)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.12),transparent 36%,rgba(0,0,0,.36)), radial-gradient(circle at 50% 8%, rgba(255,255,255,.45), transparent 26%)" }} />
        </div>

        <div style={{ position: "absolute", top: 17 * scale, left: 17 * scale, fontSize: 9.5 * scale, fontWeight: 950, lineHeight: 1.05, textShadow: "0 2px 5px rgba(0,0,0,.86)" }}>{player.season || "2026-27"}<br />{player.serial || 1}/{player.maxSupply || 100}</div>
        <div style={{ position: "absolute", top: 17 * scale, right: 17 * scale, fontSize: 9.5 * scale, fontWeight: 950, textAlign: "right", lineHeight: 1.05, textShadow: "0 2px 5px rgba(0,0,0,.86)" }}>{team.slice(0, 3).toUpperCase()}<br />FA</div>
        <div style={{ position: "absolute", left: 13 * scale, top: 115 * scale, width: 27 * scale, height: 27 * scale, borderRadius: 999, background: "rgba(2,6,23,.76)", border: "1px solid rgba(255,255,255,.42)", display: "grid", placeItems: "center", fontSize: 8.2 * scale, fontWeight: 950, boxShadow: `0 0 15px ${glow}, inset 0 1px 0 rgba(255,255,255,.24)` }}>{rarity.slice(0, 2).toUpperCase()}</div>
        <div style={{ position: "absolute", right: 13 * scale, top: 115 * scale, width: 27 * scale, height: 27 * scale, borderRadius: 999, background: "rgba(2,6,23,.76)", border: "1px solid rgba(255,255,255,.42)", display: "grid", placeItems: "center", fontSize: 8.2 * scale, fontWeight: 950, boxShadow: `0 0 15px ${glow}, inset 0 1px 0 rgba(255,255,255,.24)` }}>FA</div>

        <div style={{ position: "absolute", left: 11 * scale, right: 11 * scale, bottom: 31 * scale, padding: `${7 * scale}px ${8 * scale}px`, borderRadius: 12 * scale, background: `linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,.08)), ${theme.nameplate}`, border: "1px solid rgba(255,255,255,.48)", boxShadow: `0 9px 18px rgba(0,0,0,.62), 0 0 16px ${glow}, inset 0 1px 0 rgba(255,255,255,.42)`, textAlign: "center" }}>
          <div style={{ fontSize: 13 * scale, lineHeight: 1.02, fontWeight: 950, letterSpacing: ".025em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 3px 5px rgba(0,0,0,.92)" }}>{nameOf(player)}</div>
          <div style={{ marginTop: 3, fontSize: 8.4 * scale, fontWeight: 900, color: "rgba(255,255,255,.72)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".07em" }}>{player.position || "N/A"} • {team}</div>
          <div style={{ marginTop: 3, fontSize: 8.3 * scale, fontWeight: 950, color: theme.accent, letterSpacing: ".07em", textShadow: `0 0 10px ${glow}` }}>OVR {stat(player)} • PTS {points}</div>
          {showPrice && price > 0 ? <div style={{ marginTop: 3, fontSize: 8.2 * scale, fontWeight: 950, color: "#bbf7d0" }}>N${price.toFixed(2)}</div> : null}
        </div>
        <div style={{ position: "absolute", left: "50%", bottom: 7 * scale, transform: "translateX(-50%)", fontSize: 7.1 * scale, fontWeight: 950, letterSpacing: ".16em", background: "rgba(2,6,23,.82)", padding: `${2 * scale}px ${9 * scale}px`, borderRadius: 999, border: "1px solid rgba(255,255,255,.32)", whiteSpace: "nowrap", boxShadow: `0 0 14px ${glow}` }}>{theme.label}</div>
      </article>
    </button>
  );
}

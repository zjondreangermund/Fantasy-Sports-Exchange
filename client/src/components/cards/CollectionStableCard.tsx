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
  sm: { width: 146, height: 220, radius: 20 },
  md: { width: 170, height: 256, radius: 23 },
};

const RARITY_GLOW: Record<string, string> = {
  common: "rgba(226,232,240,.54)",
  rare: "rgba(248,113,113,.64)",
  epic: "rgba(96,165,250,.76)",
  unique: "rgba(236,72,153,.82)",
  legendary: "rgba(251,191,36,.92)",
};

const RARITY_EDGE: Record<string, string> = {
  common: "linear-gradient(135deg,#ffffff 0%,#94a3b8 15%,#ffffff 32%,#334155 54%,#e2e8f0 78%,#ffffff 100%)",
  rare: "linear-gradient(135deg,#fff1f2 0%,#fb7185 15%,#ffffff 33%,#991b1b 55%,#fecaca 80%,#ffffff 100%)",
  epic: "linear-gradient(135deg,#eff6ff 0%,#60a5fa 15%,#ffffff 33%,#1d4ed8 55%,#bfdbfe 80%,#ffffff 100%)",
  unique: "linear-gradient(135deg,#fdf2f8 0%,#ec4899 15%,#ffffff 33%,#06b6d4 55%,#c084fc 80%,#ffffff 100%)",
  legendary: "linear-gradient(135deg,#fff7cc 0%,#fbbf24 15%,#ffffff 33%,#92400e 55%,#fde68a 80%,#ffffff 100%)",
};

const HIGH_GLOSS_SLAB: Record<string, string> = {
  common: "linear-gradient(145deg,#f8fafc 0%,#cbd5e1 16%,#64748b 36%,#f8fafc 51%,#1e293b 76%,#ffffff 100%)",
  rare: "linear-gradient(145deg,#fff1f2 0%,#fb7185 16%,#7f1d1d 38%,#fecaca 53%,#2b0606 77%,#fff1f2 100%)",
  epic: "linear-gradient(145deg,#eff6ff 0%,#60a5fa 16%,#1d4ed8 38%,#dbeafe 53%,#172554 77%,#eff6ff 100%)",
  unique: "linear-gradient(145deg,#fdf2f8 0%,#ec4899 16%,#0891b2 38%,#f0abfc 53%,#581c87 77%,#fdf2f8 100%)",
  legendary: "linear-gradient(145deg,#fff7cc 0%,#facc15 16%,#a16207 38%,#fff2a8 53%,#78350f 77%,#fff7cc 100%)",
};

const RARITY_NAME: Record<string, string> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  unique: "UNIQUE",
  legendary: "LEGENDARY",
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

function numberStat(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
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
  const slab = HIGH_GLOSS_SLAB[rarity] || HIGH_GLOSS_SLAB.common;
  const ovr = stat(player);
  const points = numberStat(player.totalPoints || player.form || player.rating || 0);
  const form = numberStat(player.form || player.rating || 0);
  const scale = dim.width / SIZE.sm.width;
  const fallback = isFallbackImage(image);
  const rarityLabel = RARITY_NAME[rarity] || rarity.toUpperCase();

  const cardStyle: CSSProperties = {
    width: dim.width,
    height: dim.height,
    borderRadius: dim.radius,
    position: "relative",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.84)",
    background: `${edge}, ${slab}`,
    boxShadow: selected
      ? `0 0 0 3px #34d399, 0 0 42px ${glow}, 0 22px 50px rgba(0,0,0,.72), inset 0 1px 0 rgba(255,255,255,.98), inset 0 -18px 38px rgba(0,0,0,.48)`
      : `0 0 32px ${glow}, 0 22px 48px rgba(0,0,0,.72), inset 0 1px 0 rgba(255,255,255,.98), inset 0 -18px 38px rgba(0,0,0,.48)`,
    color: "white",
    transform: "translateZ(0)",
  };

  return (
    <button type="button" onClick={onClick} className="group relative block touch-manipulation fa-card-lift" style={{ background: "transparent", border: 0, padding: 0, perspective: 900 }}>
      <span aria-hidden="true" className="absolute -inset-4 rounded-[2rem] opacity-75 blur-2xl transition duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(circle, ${glow}, transparent 64%)` }} />
      <article style={cardStyle} className="transition duration-300 group-hover:[transform:rotateX(2deg)_rotateY(-2deg)_translateY(-3px)]">
        <div style={{ position: "absolute", inset: 3, borderRadius: dim.radius - 3, background: slab, opacity: .98 }} />
        <div style={{ position: "absolute", inset: 5, borderRadius: dim.radius - 6, border: "1px solid rgba(255,255,255,.62)", boxShadow: "inset 0 2px 6px rgba(255,255,255,.68), inset 0 -20px 32px rgba(0,0,0,.42)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(116deg, transparent 5%, rgba(255,255,255,.72) 18%, transparent 31%, transparent 54%, rgba(255,255,255,.48) 66%, transparent 80%), radial-gradient(circle at 50% 10%, rgba(255,255,255,.64), transparent 24%)", mixBlendMode: "screen", opacity: .86 }} />
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 1px, rgba(0,0,0,.08) 1px 2px, transparent 2px 7px)", mixBlendMode: "overlay", opacity: .26 }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 18% 22%, rgba(255,255,255,.38), transparent 14%), radial-gradient(circle at 80% 78%, rgba(255,255,255,.16), transparent 20%)", mixBlendMode: "screen", opacity: .76 }} />

        <div style={{ position: "absolute", left: 14 * scale, right: 14 * scale, top: 17 * scale, height: 122 * scale, borderRadius: 13 * scale, overflow: "hidden", background: "radial-gradient(circle at 50% 8%,rgba(255,255,255,.26),rgba(15,23,42,.62) 42%,rgba(2,6,23,.94))", border: "1px solid rgba(255,255,255,.52)", boxShadow: `inset 0 0 28px rgba(0,0,0,.62), 0 10px 18px rgba(0,0,0,.34), 0 0 18px ${glow}` }}>
          <img src={image} alt={player.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? `${18 * scale}px ${18 * scale}px 0` : 0, filter: fallback ? "saturate(.94) contrast(1.08) brightness(1.06)" : "saturate(1.12) contrast(1.10) brightness(1.05)", transform: fallback ? "scale(.78)" : "scale(.86)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.16),transparent 36%,rgba(0,0,0,.32)), radial-gradient(circle at 50% 0%, rgba(255,255,255,.50), transparent 26%)" }} />
        </div>

        <div style={{ position: "absolute", top: 13 * scale, left: 13 * scale, fontSize: 8 * scale, fontWeight: 950, lineHeight: 1.05, textShadow: "0 2px 5px rgba(0,0,0,.88)" }}>{player.serial || 1}/{player.maxSupply || 100}</div>
        <div style={{ position: "absolute", top: 13 * scale, right: 13 * scale, fontSize: 8 * scale, fontWeight: 950, textAlign: "right", lineHeight: 1.05, textShadow: "0 2px 5px rgba(0,0,0,.88)" }}>{String(team).slice(0, 3).toUpperCase()}</div>

        <div style={{ position: "absolute", left: "50%", top: 118 * scale, transform: "translateX(-50%)", borderRadius: 999, background: `linear-gradient(180deg, rgba(255,255,255,.24), rgba(0,0,0,.26)), ${theme.nameplate}`, border: "1px solid rgba(255,255,255,.46)", padding: `${3 * scale}px ${9 * scale}px`, fontSize: 7.5 * scale, fontWeight: 950, letterSpacing: ".14em", whiteSpace: "nowrap", boxShadow: `0 0 16px ${glow}, inset 0 1px 0 rgba(255,255,255,.32)` }}>{rarityLabel}</div>

        <div style={{ position: "absolute", left: 11 * scale, right: 11 * scale, bottom: 33 * scale, padding: `${6 * scale}px ${7 * scale}px`, borderRadius: 12 * scale, background: "linear-gradient(180deg, rgba(2,6,23,.82), rgba(2,6,23,.58))", border: "1px solid rgba(255,255,255,.34)", boxShadow: `0 9px 18px rgba(0,0,0,.64), 0 0 16px ${glow}, inset 0 1px 0 rgba(255,255,255,.20)`, textAlign: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 * scale }}>
            <StatChip label="OVR" value={ovr} scale={scale} glow={glow} />
            <StatChip label="PTS" value={points} scale={scale} glow={glow} />
            <StatChip label="FORM" value={form} scale={scale} glow={glow} />
          </div>
          <div style={{ marginTop: 4 * scale, fontSize: 7.4 * scale, fontWeight: 900, color: "rgba(255,255,255,.72)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".07em" }}>{player.position || "N/A"} • {team}</div>
          {showPrice && price > 0 ? <div style={{ marginTop: 2 * scale, fontSize: 7.6 * scale, fontWeight: 950, color: "#bbf7d0" }}>N${price.toFixed(2)}</div> : null}
        </div>

        <div style={{ position: "absolute", left: 9 * scale, right: 9 * scale, bottom: 7 * scale, minHeight: 24 * scale, display: "grid", placeItems: "center", borderRadius: 999, background: `linear-gradient(180deg, rgba(255,255,255,.18), rgba(0,0,0,.18)), ${theme.nameplate}`, border: "1px solid rgba(255,255,255,.42)", boxShadow: `0 0 18px ${glow}, inset 0 1px 0 rgba(255,255,255,.34)` }}>
          <div style={{ maxWidth: "94%", fontSize: 11.2 * scale, lineHeight: 1, fontWeight: 950, letterSpacing: ".03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 3px 5px rgba(0,0,0,.94)" }}>{nameOf(player)}</div>
        </div>
      </article>
    </button>
  );
}

function StatChip({ label, value, scale, glow }: { label: string; value: number; scale: number; glow: string }) {
  return (
    <div style={{ borderRadius: 8 * scale, background: "linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.04))", border: "1px solid rgba(255,255,255,.22)", boxShadow: `inset 0 1px 0 rgba(255,255,255,.18), 0 0 8px ${glow}`, padding: `${3 * scale}px 0` }}>
      <div style={{ fontSize: 5.8 * scale, fontWeight: 900, color: "rgba(255,255,255,.52)", letterSpacing: ".08em", lineHeight: 1 }}>{label}</div>
      <div style={{ marginTop: 1 * scale, fontSize: 9.2 * scale, fontWeight: 950, color: "white", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

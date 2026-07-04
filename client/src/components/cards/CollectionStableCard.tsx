import { type CSSProperties } from "react";
import { type PlayerCardData } from "./types";
import { normalizeRarity } from "./cardTheme";

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

const RARITY_NAME: Record<string, string> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  unique: "UNIQUE",
  legendary: "LEGENDARY",
};

const RARITY_PALETTE: Record<string, { glow: string; edge: string; slab: string; plate: string; accent: string; ink: string }> = {
  common: {
    glow: "rgba(226,232,240,.52)",
    edge: "linear-gradient(135deg,#ffffff 0%,#cbd5e1 14%,#ffffff 32%,#64748b 54%,#e2e8f0 78%,#ffffff 100%)",
    slab: "linear-gradient(145deg,#f8fafc 0%,#cbd5e1 16%,#64748b 36%,#f8fafc 51%,#1e293b 76%,#ffffff 100%)",
    plate: "linear-gradient(145deg,#f8fafc 0%,#94a3b8 28%,#334155 56%,#e2e8f0 100%)",
    accent: "#e2e8f0",
    ink: "#020617",
  },
  rare: {
    glow: "rgba(244,63,94,.66)",
    edge: "linear-gradient(135deg,#fff1f2 0%,#fb7185 14%,#ffffff 32%,#7f1d1d 54%,#fecaca 78%,#fff1f2 100%)",
    slab: "linear-gradient(145deg,#fff1f2 0%,#f43f5e 16%,#7f1d1d 38%,#fecaca 53%,#2b0606 77%,#fff1f2 100%)",
    plate: "linear-gradient(145deg,#fecaca 0%,#ef4444 24%,#7f1d1d 62%,#fff1f2 100%)",
    accent: "#fecaca",
    ink: "#fff1f2",
  },
  epic: {
    glow: "rgba(59,130,246,.78)",
    edge: "linear-gradient(135deg,#eff6ff 0%,#60a5fa 14%,#ffffff 32%,#1d4ed8 54%,#bfdbfe 78%,#eff6ff 100%)",
    slab: "linear-gradient(145deg,#eff6ff 0%,#3b82f6 16%,#1d4ed8 38%,#dbeafe 53%,#172554 77%,#eff6ff 100%)",
    plate: "linear-gradient(145deg,#dbeafe 0%,#2563eb 25%,#172554 62%,#eff6ff 100%)",
    accent: "#bfdbfe",
    ink: "#eff6ff",
  },
  unique: {
    glow: "rgba(217,70,239,.94)",
    edge: "linear-gradient(135deg,#fff1ff 0%,#ff4fd8 12%,#ffffff 29%,#a100c7 48%,#4c005f 66%,#f0abfc 84%,#fff1ff 100%)",
    slab: "linear-gradient(145deg,#fff1ff 0%,#ff40d2 10%,#b600d8 24%,#6d007f 43%,#f02dff 58%,#32003f 78%,#f8b4ff 100%)",
    plate: "linear-gradient(145deg,#ff8df0 0%,#d100ff 24%,#6d007f 55%,#270033 78%,#ffd6ff 100%)",
    accent: "#f5d0fe",
    ink: "#fff1ff",
  },
  legendary: {
    glow: "rgba(251,191,36,.94)",
    edge: "linear-gradient(135deg,#fff7cc 0%,#fbbf24 14%,#ffffff 32%,#92400e 54%,#fde68a 78%,#fff7cc 100%)",
    slab: "linear-gradient(145deg,#fff7cc 0%,#facc15 16%,#a16207 38%,#fff2a8 53%,#78350f 77%,#fff7cc 100%)",
    plate: "linear-gradient(145deg,#fff7cc 0%,#f59e0b 26%,#92400e 62%,#fff2a8 100%)",
    accent: "#fde68a",
    ink: "#fff7cc",
  },
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
  const palette = RARITY_PALETTE[rarity] || RARITY_PALETTE.common;
  const dim = SIZE[size] || SIZE.sm;
  const image = imageOf(player);
  const team = player.team || player.club || "Fantasy Arena";
  const price = Number(player.price || player.listedPrice || 0);
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
    border: "1px solid rgba(255,255,255,.86)",
    background: `${palette.edge}, ${palette.slab}`,
    boxShadow: selected
      ? `0 0 0 3px #34d399, 0 0 44px ${palette.glow}, 0 22px 52px rgba(0,0,0,.74), inset 0 1px 0 rgba(255,255,255,.98), inset 0 -18px 40px rgba(0,0,0,.50)`
      : `0 0 34px ${palette.glow}, 0 22px 50px rgba(0,0,0,.74), inset 0 1px 0 rgba(255,255,255,.98), inset 0 -18px 40px rgba(0,0,0,.50)`,
    color: "white",
    transform: "translateZ(0)",
  };

  return (
    <button type="button" onClick={onClick} className="group relative block touch-manipulation fa-card-lift" style={{ background: "transparent", border: 0, padding: 0, perspective: 900 }}>
      <span aria-hidden="true" className="absolute -inset-4 rounded-[2rem] opacity-80 blur-2xl transition duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(circle, ${palette.glow}, transparent 64%)` }} />
      <article style={cardStyle} className="transition duration-300 group-hover:[transform:rotateX(2deg)_rotateY(-2deg)_translateY(-3px)]">
        <div style={{ position: "absolute", inset: 3, borderRadius: dim.radius - 3, background: palette.slab, opacity: .985 }} />
        <div style={{ position: "absolute", inset: 5, borderRadius: dim.radius - 6, border: "1px solid rgba(255,255,255,.64)", boxShadow: "inset 0 2px 6px rgba(255,255,255,.70), inset 0 -20px 34px rgba(0,0,0,.44)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(116deg, transparent 5%, rgba(255,255,255,.76) 18%, transparent 31%, transparent 54%, rgba(255,255,255,.50) 66%, transparent 80%), radial-gradient(circle at 50% 10%, rgba(255,255,255,.68), transparent 24%)", mixBlendMode: "screen", opacity: .88 }} />
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg, rgba(255,255,255,.11) 0 1px, rgba(0,0,0,.09) 1px 2px, transparent 2px 7px)", mixBlendMode: "overlay", opacity: .25 }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 18% 22%, rgba(255,255,255,.42), transparent 14%), radial-gradient(circle at 80% 78%, rgba(255,255,255,.18), transparent 20%)", mixBlendMode: "screen", opacity: .78 }} />
        {rarity === "unique" ? <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,0,221,.18), rgba(255,255,255,.22), rgba(107,0,255,.16), transparent)", mixBlendMode: "color-dodge", opacity: .58 }} /> : null}

        <div style={{ position: "absolute", left: 14 * scale, right: 14 * scale, top: 17 * scale, height: 122 * scale, borderRadius: 13 * scale, overflow: "hidden", background: "radial-gradient(circle at 50% 8%,rgba(255,255,255,.26),rgba(15,23,42,.62) 42%,rgba(2,6,23,.94))", border: "1px solid rgba(255,255,255,.54)", boxShadow: `inset 0 0 28px rgba(0,0,0,.64), 0 10px 18px rgba(0,0,0,.34), 0 0 20px ${palette.glow}` }}>
          <img src={image} alt={player.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? `${18 * scale}px ${18 * scale}px 0` : 0, filter: fallback ? "saturate(.94) contrast(1.08) brightness(1.06)" : "saturate(1.12) contrast(1.10) brightness(1.05)", transform: fallback ? "scale(.78)" : "scale(.86)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.16),transparent 36%,rgba(0,0,0,.34)), radial-gradient(circle at 50% 0%, rgba(255,255,255,.52), transparent 26%)" }} />
        </div>

        <div style={{ position: "absolute", top: 13 * scale, left: 13 * scale, fontSize: 8 * scale, fontWeight: 950, lineHeight: 1.05, textShadow: "0 2px 5px rgba(0,0,0,.88)" }}>{player.serial || 1}/{player.maxSupply || 100}</div>
        <div style={{ position: "absolute", top: 13 * scale, right: 13 * scale, fontSize: 8 * scale, fontWeight: 950, textAlign: "right", lineHeight: 1.05, textShadow: "0 2px 5px rgba(0,0,0,.88)" }}>{String(team).slice(0, 3).toUpperCase()}</div>

        <div style={{ position: "absolute", left: "50%", top: 118 * scale, transform: "translateX(-50%)", borderRadius: 999, background: `linear-gradient(180deg, rgba(255,255,255,.26), rgba(0,0,0,.25)), ${palette.plate}`, border: "1px solid rgba(255,255,255,.48)", padding: `${3 * scale}px ${9 * scale}px`, fontSize: 7.5 * scale, fontWeight: 950, letterSpacing: ".14em", whiteSpace: "nowrap", color: palette.ink, textShadow: rarity === "common" ? "0 1px 1px rgba(255,255,255,.55)" : "0 2px 4px rgba(0,0,0,.65)", boxShadow: `0 0 18px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,.35)` }}>{rarityLabel}</div>

        <div style={{ position: "absolute", left: 11 * scale, right: 11 * scale, bottom: 33 * scale, padding: `${6 * scale}px ${7 * scale}px`, borderRadius: 12 * scale, background: "linear-gradient(180deg, rgba(2,6,23,.84), rgba(2,6,23,.60))", border: "1px solid rgba(255,255,255,.35)", boxShadow: `0 9px 18px rgba(0,0,0,.64), 0 0 16px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,.21)`, textAlign: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 * scale }}>
            <StatChip label="OVR" value={ovr} scale={scale} glow={palette.glow} />
            <StatChip label="PTS" value={points} scale={scale} glow={palette.glow} />
            <StatChip label="FORM" value={form} scale={scale} glow={palette.glow} />
          </div>
          <div style={{ marginTop: 4 * scale, fontSize: 7.4 * scale, fontWeight: 900, color: "rgba(255,255,255,.72)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".07em" }}>{player.position || "N/A"} • {team}</div>
          {showPrice && price > 0 ? <div style={{ marginTop: 2 * scale, fontSize: 7.6 * scale, fontWeight: 950, color: "#bbf7d0" }}>N${price.toFixed(2)}</div> : null}
        </div>

        <div style={{ position: "absolute", left: 9 * scale, right: 9 * scale, bottom: 7 * scale, minHeight: 24 * scale, display: "grid", placeItems: "center", borderRadius: 999, background: `linear-gradient(180deg, rgba(255,255,255,.20), rgba(0,0,0,.20)), ${palette.plate}`, border: "1px solid rgba(255,255,255,.44)", boxShadow: `0 0 20px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,.36)` }}>
          <div style={{ maxWidth: "94%", fontSize: 11.2 * scale, lineHeight: 1, fontWeight: 950, letterSpacing: ".03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: palette.ink, textShadow: rarity === "common" ? "0 1px 1px rgba(255,255,255,.55)" : "0 3px 5px rgba(0,0,0,.74)" }}>{nameOf(player)}</div>
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

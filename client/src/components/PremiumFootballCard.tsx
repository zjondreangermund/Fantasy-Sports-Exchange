import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { type PlayerCardData } from "./cards/types";

type Props = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

type Theme = {
  label: string;
  chrome: string;
  plate: string;
  border: string;
  glow: string;
  glowStrong: string;
  text: string;
  tint: string;
  beam: string;
};

const themes: Record<string, Theme> = {
  common: {
    label: "COMMON",
    chrome: "linear-gradient(135deg,#ffffff 0%,#eef3f8 12%,#8d99a8 31%,#ffffff 47%,#65717d 63%,#f8fbff 82%,#cfd8e3 100%)",
    plate: "linear-gradient(135deg,#ffffff,#dce4ee 48%,#7b8794 72%,#f7fbff)",
    border: "#f8fbff",
    glow: "rgba(226,232,240,.88)",
    glowStrong: "rgba(255,255,255,.96)",
    text: "#06111f",
    tint: "rgba(226,232,240,.50)",
    beam: "rgba(255,255,255,.92)",
  },
  rare: {
    label: "RARE",
    chrome: "linear-gradient(135deg,#f2fbff 0%,#7ec8ff 16%,#1764ff 34%,#eaf8ff 50%,#0d2f94 68%,#dbf3ff 100%)",
    plate: "linear-gradient(135deg,#f3fbff,#5cb8ff 45%,#1450cc 72%,#e9f7ff)",
    border: "#dbeafe",
    glow: "rgba(59,130,246,.96)",
    glowStrong: "rgba(147,197,253,1)",
    text: "#03132e",
    tint: "rgba(37,99,235,.45)",
    beam: "rgba(125,211,252,.92)",
  },
  unique: {
    label: "UNIQUE",
    chrome: "linear-gradient(135deg,#fff1ff 0%,#fb83ff 15%,#d946ef 35%,#fff6ff 50%,#7417c9 70%,#ffd9ff 100%)",
    plate: "linear-gradient(135deg,#fff1ff,#f06cff 44%,#7e22ce 72%,#ffe4ff)",
    border: "#ffd7ff",
    glow: "rgba(217,70,239,.98)",
    glowStrong: "rgba(244,114,182,1)",
    text: "#250331",
    tint: "rgba(217,70,239,.45)",
    beam: "rgba(244,114,182,.94)",
  },
  epic: {
    label: "EPIC",
    chrome: "linear-gradient(135deg,#eef2ff 0%,#aab6ff 15%,#6366f1 34%,#f6f7ff 50%,#1d4ed8 70%,#dbeafe 100%)",
    plate: "linear-gradient(135deg,#eef2ff,#818cf8 44%,#2563eb 72%,#e0e7ff)",
    border: "#e0e7ff",
    glow: "rgba(99,102,241,.96)",
    glowStrong: "rgba(129,140,248,1)",
    text: "#07113f",
    tint: "rgba(99,102,241,.45)",
    beam: "rgba(165,180,252,.94)",
  },
  legendary: {
    label: "LEGENDARY",
    chrome: "linear-gradient(135deg,#fff7bf 0%,#ffd84d 15%,#f59e0b 34%,#fff9d6 50%,#9a5b00 69%,#fff2a8 100%)",
    plate: "linear-gradient(135deg,#fff7bf,#ffd43b 40%,#b87500 70%,#fff4a3)",
    border: "#fff2a8",
    glow: "rgba(245,158,11,1)",
    glowStrong: "rgba(253,230,138,1)",
    text: "#171006",
    tint: "rgba(245,158,11,.48)",
    beam: "rgba(253,224,71,.96)",
  },
};

const sizes = {
  sm: { w: 176, h: 246, s: 0.489 },
  md: { w: 204, h: 286, s: 0.567 },
  lg: { w: 254, h: 356, s: 0.706 },
};

function uniq(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}
function imagesFor(player: PlayerCardData) {
  return uniq([player.image, ...(player.imageCandidates || [])]);
}
function initials(name?: string) {
  return String(name || "Player").split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
function shortName(name?: string) {
  return String(name || "Unknown Player").trim().toUpperCase();
}
function clubCode(club?: string) {
  const words = String(club || "FA").trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}
function positionLabel(position?: string) {
  const value = String(position || "PLAYER").toUpperCase();
  if (value === "FWD") return "FORWARD";
  if (value === "MID") return "MIDFIELDER";
  if (value === "DEF") return "DEFENDER";
  if (value === "GK") return "GOALKEEPER";
  return value;
}
function points(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.map((v) => Number(v || 0)) : [];
  return Math.max(0, Math.round(Number(player.totalPoints || scores.reduce((a, b) => a + b, 0) || player.form || player.rating || 0)));
}
function Spark({ x, y, s = 14 }: { x: number; y: number; s?: number }) {
  return <span aria-hidden style={{ position: "absolute", left: x, top: y, width: s, height: s, zIndex: 44, pointerEvents: "none", filter: "drop-shadow(0 0 8px white) drop-shadow(0 0 16px rgba(255,255,255,.88))" }}><i style={{ position: "absolute", left: "50%", top: 0, width: 2, height: s, transform: "translateX(-50%)", background: "white", borderRadius: 2 }} /><i style={{ position: "absolute", left: 0, top: "50%", width: s, height: 2, transform: "translateY(-50%)", background: "white", borderRadius: 2 }} /><i style={{ position: "absolute", inset: s * 0.38, borderRadius: "50%", background: "white" }} /></span>;
}
function ChromeFacet({ style }: { style: CSSProperties }) {
  return <div style={{ position: "absolute", background: "linear-gradient(135deg,rgba(255,255,255,.96),rgba(255,255,255,.12) 38%,rgba(0,0,0,.58) 68%,rgba(255,255,255,.42))", boxShadow: "inset 0 12px 20px rgba(255,255,255,.42), inset 0 -14px 22px rgba(0,0,0,.42)", ...style }} />;
}

function PremiumFootballCardBase({ player, selected = false, onClick, showPrice = false, className = "", size = "md" }: Props) {
  const rarity = String(player.rarity || "common").toLowerCase();
  const theme = themes[rarity] || themes.common;
  const dim = sizes[size] || sizes.md;
  const imgs = useMemo(() => imagesFor(player), [player]);
  const imageKey = imgs.join("|");
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const img = imgs[index];
  const showImg = Boolean(img) && !failed;
  const team = player.team || player.club || "Fantasy Arena";
  const rating = Math.round(Number(player.rating || player.form || points(player) || 0));
  const serial = player.serial && player.maxSupply ? `${player.serial}/${player.maxSupply}` : player.maxSupply ? `1/${player.maxSupply}` : "1000/1000";
  const price = Number(player.price || player.listedPrice || 0);
  const displayName = shortName(player.name);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [player.id, imageKey]);

  function onImageError() {
    if (index < imgs.length - 1) setIndex((v) => v + 1);
    else setFailed(true);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={["group relative bg-transparent p-0 text-left outline-none transition-transform duration-200 hover:-translate-y-1", selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950" : "", onClick ? "cursor-pointer" : "cursor-default", className].join(" ")}
      style={{ width: dim.w, height: dim.h, borderRadius: 22 * dim.s }}
      data-testid={`premium-football-card-${player.id}`}
    >
      <div style={{ position: "relative", width: 360, height: 504, transform: `scale(${dim.s})`, transformOrigin: "top left", overflow: "hidden", borderRadius: 30, color: theme.text, background: theme.chrome, border: `3px solid ${theme.border}`, boxShadow: `0 0 0 1px rgba(255,255,255,.98) inset, 0 0 0 8px rgba(255,255,255,.18) inset, 0 0 38px rgba(255,255,255,.82), 0 0 70px ${theme.glow}, 0 0 110px ${theme.tint}, 0 26px 74px rgba(0,0,0,.64)`, fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ position: "absolute", inset: 5, zIndex: 8, borderRadius: 26, pointerEvents: "none", border: "1px solid rgba(255,255,255,.96)", boxShadow: `inset 0 0 24px rgba(255,255,255,.86), inset 0 0 54px rgba(255,255,255,.30), 0 0 28px ${theme.glowStrong}` }} />
        <div style={{ position: "absolute", inset: 13, zIndex: 8, borderRadius: 20, pointerEvents: "none", border: "1px solid rgba(0,0,0,.24)", boxShadow: "inset 0 2px 0 rgba(255,255,255,.88), inset 0 -16px 30px rgba(0,0,0,.34)" }} />

        <div style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "hidden" }}>
          <ChromeFacet style={{ top: -30, left: -34, width: 270, height: 266, clipPath: "polygon(0 0,78% 0,50% 100%,0 68%)" }} />
          <ChromeFacet style={{ top: 40, right: -24, width: 220, height: 202, clipPath: "polygon(20% 0,100% 0,100% 86%,12% 100%)" }} />
          <ChromeFacet style={{ top: 140, left: 78, width: 180, height: 118, clipPath: "polygon(0 18%,86% 0,100% 74%,24% 100%)" }} />
          <ChromeFacet style={{ bottom: 130, left: -42, width: 248, height: 190, clipPath: "polygon(0 0,100% 26%,72% 100%,0 86%)" }} />
          <ChromeFacet style={{ bottom: 104, right: -26, width: 216, height: 146, clipPath: "polygon(14% 0,100% 20%,100% 100%,0 78%)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: .26, backgroundImage: "radial-gradient(circle,rgba(255,255,255,.95) 0 1px,transparent 1.5px)", backgroundSize: "8px 8px" }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 18% 7%,rgba(255,255,255,.96),transparent 22%), radial-gradient(circle at 85% 34%,${theme.beam},transparent 18%), radial-gradient(circle at 54% 72%,${theme.tint},transparent 24%), linear-gradient(118deg,rgba(255,255,255,.82) 0%,transparent 18%,rgba(0,0,0,.24) 42%,rgba(255,255,255,.64) 58%,transparent 75%)` }} />
        </div>

        <div style={{ position: "absolute", left: 10, right: 10, top: 54, bottom: 125, zIndex: 14, overflow: "hidden", borderRadius: 10, background: `radial-gradient(circle at 50% 18%,rgba(255,255,255,.72),transparent 28%), linear-gradient(to bottom,rgba(0,0,0,.02),rgba(0,0,0,.10))` }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(142deg,transparent 0%,transparent 31%,${theme.beam} 44%,transparent 54%,transparent 100%)`, opacity: .48, mixBlendMode: "screen" }} />
          {showImg ? (
            <img src={img} alt={player.name || "Player"} loading="lazy" decoding="async" onError={onImageError} className="transition-transform duration-200 group-hover:scale-[1.05]" style={{ position: "absolute", left: "50%", bottom: 2, width: "166%", height: "151%", transform: "translateX(-50%)", objectFit: "contain", objectPosition: "bottom center", filter: `saturate(1.24) contrast(1.14) brightness(1.14) drop-shadow(0 23px 18px rgba(0,0,0,.62)) drop-shadow(0 0 18px ${theme.glow})`, zIndex: 10, opacity: 1 }} />
          ) : (
            <div style={{ position: "absolute", left: "50%", top: "48%", transform: "translate(-50%,-50%)", width: 128, height: 128, borderRadius: 26, border: "2px solid rgba(0,0,0,.18)", background: "rgba(255,255,255,.22)", display: "grid", placeItems: "center", fontSize: 38, fontWeight: 950, color: "rgba(0,0,0,.40)" }}>{initials(player.name)}</div>
          )}
        </div>

        <div style={{ position: "absolute", top: 17, left: 22, right: 22, zIndex: 38, display: "flex", justifyContent: "space-between", fontWeight: 950, color: "white", textShadow: "0 2px 8px rgba(0,0,0,.80), 0 0 12px rgba(255,255,255,.60)" }}>
          <div style={{ fontSize: 18, lineHeight: 1.08 }}><div>{player.season || "2026-27"}</div><div>{serial}</div></div>
          <div style={{ textAlign: "right", fontSize: 18, lineHeight: 1.08 }}><div>{clubCode(team)}</div><div>+{Math.max(1, rating || 1)}</div><div>{player.position || "PL"}</div></div>
        </div>

        <div style={{ position: "absolute", left: 16, right: 16, bottom: 107, height: 58, zIndex: 20, clipPath: "polygon(0 42%,50% 0,100% 42%,100% 100%,0 100%)", background: theme.plate, borderTop: "2px solid rgba(255,255,255,.92)", boxShadow: "0 -14px 30px rgba(255,255,255,.34), inset 0 2px 0 rgba(255,255,255,.92), inset 0 -12px 22px rgba(0,0,0,.24)", backdropFilter: "blur(6px)" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none", background: "linear-gradient(118deg,transparent 0%,transparent 22%,rgba(255,255,255,.95) 36%,rgba(255,255,255,.24) 45%,transparent 58%)", mixBlendMode: "screen", opacity: .48 }} />
        <div style={{ position: "absolute", left: -120, top: 20, zIndex: 31, width: 580, height: 74, transform: "rotate(-30deg)", pointerEvents: "none", background: "linear-gradient(90deg,transparent,rgba(255,255,255,.98),transparent)", filter: "blur(1px)", opacity: .36 }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 32, pointerEvents: "none", background: `linear-gradient(52deg,transparent 0%,transparent 54%,${theme.beam} 66%,rgba(255,255,255,.14) 72%,transparent 81%)`, mixBlendMode: "screen", opacity: .34 }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 33, pointerEvents: "none", background: `radial-gradient(circle at 15% 18%,rgba(255,255,255,.95),transparent 7%), radial-gradient(circle at 86% 23%,rgba(255,255,255,.92),transparent 6%), radial-gradient(circle at 79% 54%,${theme.beam},transparent 5%), radial-gradient(circle at 22% 78%,rgba(255,255,255,.70),transparent 6%)`, mixBlendMode: "screen" }} />
        <Spark x={42} y={76} s={15} /><Spark x={279} y={93} s={18} /><Spark x={304} y={245} s={14} /><Spark x={74} y={344} s={13} />

        <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, zIndex: 40, textAlign: "center" }}>
          <div style={{ minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px" }}>
            <div style={{ fontSize: displayName.length > 18 ? 19 : 24, lineHeight: .98, fontWeight: 950, letterSpacing: ".03em", textTransform: "uppercase", color: theme.text, textShadow: "0 1px 0 rgba(255,255,255,.66), 0 2px 8px rgba(0,0,0,.55)" }}>{displayName}</div>
          </div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" }}>{positionLabel(player.position)}</div>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, fontSize: 11, fontWeight: 900 }}><span>PTS {points(player)}</span><span>{player.nationality || "Unknown"}</span></div>
          <div style={{ margin: "7px auto 0", width: 138, borderRadius: 10, border: "1px solid rgba(0,0,0,.22)", background: "linear-gradient(145deg,rgba(255,255,255,.92),rgba(255,255,255,.30))", padding: "5px 8px", fontSize: 9, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase", boxShadow: "inset 0 1px 0 rgba(255,255,255,.84),0 0 16px rgba(255,255,255,.44)" }}>{showPrice && price > 0 ? `N$${price.toFixed(2)}` : `${theme.label} EDITION`}</div>
        </div>
        <div style={{ position: "absolute", left: 22, bottom: 22, zIndex: 42, width: 26, height: 26, borderRadius: "50%", border: "2px solid rgba(0,0,0,.70)", display: "grid", placeItems: "center", fontSize: 12 }}>★</div>
        <div style={{ position: "absolute", right: 22, bottom: 22, zIndex: 42, width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(0,0,0,.70)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 950 }}>FA</div>
      </div>
    </button>
  );
}

export default memo(PremiumFootballCardBase);

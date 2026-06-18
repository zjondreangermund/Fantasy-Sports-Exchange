import { memo, useEffect, useMemo, useState } from "react";
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
  face: string;
  plate: string;
  border: string;
  glow: string;
  text: string;
};

const themes: Record<string, Theme> = {
  common: {
    label: "COMMON",
    face: "linear-gradient(145deg,#ffffff 0%,#d7dde5 36%,#9ca6b2 72%,#f8fafc 100%)",
    plate: "linear-gradient(145deg,#ffffff,#cfd6df 52%,#8b95a1)",
    border: "#ffffff",
    glow: "rgba(226,232,240,.70)",
    text: "#0b1220",
  },
  rare: {
    label: "RARE",
    face: "linear-gradient(145deg,#eef7ff 0%,#61b4ff 35%,#1557da 72%,#dcefff 100%)",
    plate: "linear-gradient(145deg,#f0f9ff,#4aa3ff 50%,#1450cc)",
    border: "#dbeafe",
    glow: "rgba(59,130,246,.78)",
    text: "#06152f",
  },
  unique: {
    label: "UNIQUE",
    face: "linear-gradient(145deg,#fff1ff 0%,#ef65ff 34%,#8628dd 72%,#f5d0fe 100%)",
    plate: "linear-gradient(145deg,#fff1ff,#df56ff 48%,#8326dc)",
    border: "#ffd7ff",
    glow: "rgba(217,70,239,.82)",
    text: "#270334",
  },
  epic: {
    label: "EPIC",
    face: "linear-gradient(145deg,#eef2ff 0%,#99a5ff 34%,#2454e6 72%,#e0e7ff 100%)",
    plate: "linear-gradient(145deg,#eef2ff,#8793ff 48%,#2354e6)",
    border: "#e0e7ff",
    glow: "rgba(99,102,241,.78)",
    text: "#08113f",
  },
  legendary: {
    label: "LEGENDARY",
    face: "linear-gradient(145deg,#fff8c7 0%,#ffd027 34%,#c28305 72%,#fff2a8 100%)",
    plate: "linear-gradient(145deg,#fff8c7,#ffd027 46%,#c28305)",
    border: "#fff2a8",
    glow: "rgba(245,158,11,.92)",
    text: "#171006",
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
  return uniq([player.image, player.imageUrl, player.photo, ...(player.imageCandidates || [])]);
}

function initials(name?: string) {
  return String(name || "Player").split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function nameParts(name?: string) {
  const parts = String(name || "Unknown Player").trim().split(/\s+/);
  return [parts[0] || "UNKNOWN", parts.slice(1).join(" ")];
}

function clubCode(club?: string) {
  const words = String(club || "FA").trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

function points(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.map((v) => Number(v || 0)) : [];
  return Math.max(0, Math.round(Number(player.totalPoints || scores.reduce((a, b) => a + b, 0) || player.form || player.rating || 0)));
}

function Spark({ x, y, s = 14 }: { x: number; y: number; s?: number }) {
  return (
    <span style={{ position: "absolute", left: x, top: y, width: s, height: s, zIndex: 35, filter: "drop-shadow(0 0 10px white)" }}>
      <i style={{ position: "absolute", left: "50%", top: 0, width: 2, height: s, transform: "translateX(-50%)", background: "white", borderRadius: 2 }} />
      <i style={{ position: "absolute", left: 0, top: "50%", width: s, height: 2, transform: "translateY(-50%)", background: "white", borderRadius: 2 }} />
    </span>
  );
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
  const [first, last] = nameParts(player.name);
  const team = player.team || player.club || "Fantasy Arena";
  const rating = Math.round(Number(player.rating || player.form || points(player) || 0));
  const serial = player.serial && player.maxSupply ? `${player.serial}/${player.maxSupply}` : player.maxSupply ? `1/${player.maxSupply}` : "1000/1000";
  const price = Number(player.price || player.listedPrice || 0);

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
      className={["group relative bg-transparent p-0 text-left outline-none transition-transform hover:-translate-y-1", selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950" : "", onClick ? "cursor-pointer" : "cursor-default", className].join(" ")}
      style={{ width: dim.w, height: dim.h, borderRadius: 22 * dim.s }}
      data-testid={`premium-football-card-${player.id}`}
    >
      <div style={{ position: "relative", width: 360, height: 504, transform: `scale(${dim.s})`, transformOrigin: "top left", overflow: "hidden", borderRadius: 26, color: theme.text, background: theme.face, border: `3px solid ${theme.border}`, boxShadow: `0 0 0 1px rgba(255,255,255,.8) inset,0 0 0 7px rgba(255,255,255,.12) inset,0 0 44px ${theme.glow},0 24px 70px rgba(0,0,0,.5)`, fontFamily: "Inter,system-ui,sans-serif" }}>
        <div style={{ position: "absolute", inset: 7, borderRadius: 22, border: "1px solid rgba(255,255,255,.85)", boxShadow: `inset 0 0 22px rgba(255,255,255,.7),0 0 24px ${theme.glow}`, zIndex: 5 }} />
        <div style={{ position: "absolute", inset: 13, borderRadius: 18, border: "1px solid rgba(0,0,0,.24)", boxShadow: "inset 0 2px 0 rgba(255,255,255,.7),inset 0 -14px 28px rgba(0,0,0,.28)", zIndex: 5 }} />

        <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 1 }}>
          <div style={{ position: "absolute", top: -28, left: -28, width: 260, height: 252, clipPath: "polygon(0 0,76% 0,48% 100%,0 68%)", background: "linear-gradient(145deg,rgba(0,0,0,.2),rgba(255,255,255,.35))", boxShadow: "inset 0 10px 20px rgba(0,0,0,.3),inset 0 -8px 16px rgba(255,255,255,.4)" }} />
          <div style={{ position: "absolute", top: 44, right: -18, width: 200, height: 188, clipPath: "polygon(22% 0,100% 0,100% 84%,15% 100%)", background: "linear-gradient(145deg,rgba(255,255,255,.38),rgba(0,0,0,.2))", boxShadow: "inset 0 9px 20px rgba(0,0,0,.28),inset 0 -8px 16px rgba(255,255,255,.42)" }} />
          <div style={{ position: "absolute", top: 142, left: 74, width: 164, height: 106, clipPath: "polygon(0 18%,86% 0,100% 74%,24% 100%)", background: "linear-gradient(145deg,rgba(0,0,0,.15),rgba(255,255,255,.42))", boxShadow: "inset 0 8px 18px rgba(0,0,0,.26),inset 0 -7px 15px rgba(255,255,255,.42)" }} />
          <div style={{ position: "absolute", bottom: 138, left: -40, width: 234, height: 176, clipPath: "polygon(0 0,100% 26%,72% 100%,0 86%)", background: "linear-gradient(145deg,rgba(0,0,0,.16),rgba(255,255,255,.34))" }} />
          <div style={{ position: "absolute", inset: 0, opacity: .22, backgroundImage: "radial-gradient(circle,rgba(255,255,255,.95) 0 1px,transparent 1.4px)", backgroundSize: "8px 8px" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 28% 12%,rgba(255,255,255,.65),transparent 24%),linear-gradient(115deg,transparent,rgba(255,255,255,.34) 30%,transparent 46%,rgba(0,0,0,.18))" }} />
        </div>

        <div style={{ position: "absolute", top: 18, left: 22, right: 22, zIndex: 30, display: "flex", justifyContent: "space-between", fontWeight: 950, textShadow: "0 1px 0 rgba(255,255,255,.48)" }}>
          <div style={{ fontSize: 18, lineHeight: 1.08 }}><div>{player.season || "2026-27"}</div><div>{serial}</div></div>
          <div style={{ textAlign: "right", fontSize: 18, lineHeight: 1.08 }}><div>{clubCode(team)}</div><div>#{rating || 1}</div></div>
        </div>

        <div style={{ position: "absolute", top: 48, right: 34, zIndex: 31, width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg,rgba(255,255,255,.88),rgba(255,255,255,.28))", border: "2px solid rgba(0,0,0,.2)", fontSize: 12, fontWeight: 950 }}>{clubCode(team).slice(0, 2)}</div>

        <div style={{ position: "absolute", left: 18, right: 18, top: 68, bottom: 148, zIndex: 12, overflow: "visible" }}>
          {showImg ? <img src={img} alt={player.name || "Player"} loading="lazy" decoding="async" onError={onImageError} style={{ position: "absolute", left: "50%", bottom: -10, width: "146%", height: "132%", transform: "translateX(-50%)", objectFit: "contain", objectPosition: "bottom center", filter: "drop-shadow(0 22px 18px rgba(0,0,0,.52)) saturate(1.16) contrast(1.08)", zIndex: 14 }} className="transition-transform duration-200 group-hover:scale-[1.035]" /> : <div style={{ position: "absolute", left: "50%", top: "48%", transform: "translate(-50%,-50%)", width: 128, height: 128, borderRadius: 26, border: "2px solid rgba(0,0,0,.18)", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 950, color: "rgba(0,0,0,.38)" }}>{initials(player.name)}</div>}
        </div>

        <div style={{ position: "absolute", left: 18, right: 18, bottom: 132, height: 62, zIndex: 18, clipPath: "polygon(0 42%,50% 0,100% 40%,100% 100%,0 100%)", background: theme.plate, borderTop: "2px solid rgba(255,255,255,.7)", boxShadow: "0 -12px 24px rgba(255,255,255,.24),inset 0 -12px 22px rgba(0,0,0,.22)" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none", background: "linear-gradient(118deg,transparent 0%,transparent 26%,rgba(255,255,255,.82) 38%,rgba(255,255,255,.18) 46%,transparent 56%)", mixBlendMode: "screen", opacity: .82 }} />
        <div style={{ position: "absolute", left: -88, top: 8, zIndex: 22, width: 530, height: 92, transform: "rotate(-32deg)", pointerEvents: "none", background: "linear-gradient(90deg,transparent,rgba(255,255,255,.96),transparent)", filter: "blur(1px)", opacity: .76 }} />
        <Spark x={45} y={78} s={16} /><Spark x={278} y={96} s={19} /><Spark x={306} y={250} s={14} /><Spark x={74} y={348} s={13} />

        <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, zIndex: 32, textAlign: "center" }}>
          <div style={{ fontSize: 34, lineHeight: .92, fontWeight: 950, letterSpacing: ".045em", textTransform: "uppercase", color: theme.text, textShadow: "0 1px 0 rgba(255,255,255,.46),0 7px 14px rgba(0,0,0,.18)" }}><div>{first}</div>{last ? <div>{last}</div> : null}</div>
          <div style={{ marginTop: 9, fontSize: 15, fontWeight: 950, letterSpacing: ".12em", textTransform: "uppercase" }}>{player.position || "PLAYER"}</div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center", alignItems: "center", gap: 13, fontSize: 13, fontWeight: 900 }}><span>PTS {points(player)}</span><span>{player.nationality || "FC"}</span></div>
          <div style={{ margin: "11px auto 0", width: 140, borderRadius: 10, border: "1px solid rgba(0,0,0,.24)", background: "linear-gradient(145deg,rgba(255,255,255,.8),rgba(255,255,255,.18))", padding: "6px 8px", fontSize: 10, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" }}>{showPrice && price > 0 ? `N$${price.toFixed(2)}` : `${theme.label} EDITION`}</div>
        </div>

        <div style={{ position: "absolute", left: 22, bottom: 23, zIndex: 34, width: 30, height: 30, borderRadius: "50%", border: "3px solid rgba(0,0,0,.74)", display: "grid", placeItems: "center" }}>★</div>
        <div style={{ position: "absolute", right: 21, bottom: 23, zIndex: 34, width: 34, height: 34, borderRadius: "50%", border: "2px solid rgba(0,0,0,.74)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 950 }}>FA</div>
      </div>
    </button>
  );
}

export default memo(PremiumFootballCardBase);

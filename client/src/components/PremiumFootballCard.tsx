import { memo, useMemo, useRef, useState, type MouseEvent } from "react";
import { type PlayerCardData } from "./cards/types";

type PremiumFootballCardProps = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

type RarityTheme = {
  label: string;
  palette: string[];
  base: string;
  depth: string[];
  glow: string;
  muted: string;
  soft: string;
  text: string;
};

const PTS: [number, number][][] = [
  [[0, 0], [70, 9], [140, 0], [212, 7], [280, 0]],
  [[4, 68], [76, 58], [148, 72], [218, 60], [280, 68]],
  [[0, 136], [72, 146], [144, 132], [220, 148], [280, 138]],
  [[8, 204], [80, 194], [152, 208], [222, 196], [280, 206]],
  [[0, 272], [74, 282], [148, 268], [216, 278], [280, 274]],
  [[6, 340], [78, 330], [150, 344], [224, 334], [280, 342]],
  [[0, 408], [70, 418], [142, 404], [212, 416], [280, 410]],
  [[0, 476], [70, 476], [140, 476], [210, 476], [280, 476]],
];

const themes: Record<string, RarityTheme> = {
  common: {
    label: "Common",
    palette: ["#f8fafc", "#e2e8f0", "#94a3b8", "#475569", "#1e293b"],
    base: "#475569",
    depth: ["#334155", "#1e293b", "#0f172a", "#080e19"],
    glow: "rgba(148,163,184,0.34)",
    muted: "#94a3b8",
    soft: "rgba(203,213,225,0.52)",
    text: "#ffffff",
  },
  rare: {
    label: "Rare",
    palette: ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"],
    base: "#1d4ed8",
    depth: ["#1e3a8a", "#172554", "#0d1a3f", "#070e24"],
    glow: "rgba(59,130,246,0.45)",
    muted: "#93c5fd",
    soft: "rgba(147,197,253,0.58)",
    text: "#ffffff",
  },
  unique: {
    label: "Unique",
    palette: ["#fae8ff", "#f0abfc", "#d946ef", "#9333ea", "#4c1d95"],
    base: "#7e22ce",
    depth: ["#581c87", "#4c1d95", "#2e1065", "#1a0b35"],
    glow: "rgba(168,85,247,0.50)",
    muted: "#f0abfc",
    soft: "rgba(240,171,252,0.60)",
    text: "#ffffff",
  },
  epic: {
    label: "Epic",
    palette: ["#e0f2fe", "#a5f3fc", "#38bdf8", "#4f46e5", "#312e81"],
    base: "#4338ca",
    depth: ["#3730a3", "#312e81", "#1e1b4b", "#11102a"],
    glow: "rgba(99,102,241,0.50)",
    muted: "#a5b4fc",
    soft: "rgba(165,180,252,0.62)",
    text: "#ffffff",
  },
  legendary: {
    label: "Legendary",
    palette: ["#fff7ed", "#fde68a", "#f59e0b", "#b45309", "#78350f"],
    base: "#b45309",
    depth: ["#92400e", "#78350f", "#451a03", "#261002"],
    glow: "rgba(245,158,11,0.58)",
    muted: "#fde68a",
    soft: "rgba(253,230,138,0.68)",
    text: "#ffffff",
  },
};

const sizeMap = {
  sm: { width: 156, height: 265, scale: 0.557 },
  md: { width: 168, height: 286, scale: 0.6 },
  lg: { width: 208, height: 354, scale: 0.743 },
};

type Tri = { points: string; colorIndex: number };

function buildTris(): Tri[] {
  const out: Tri[] = [];
  for (let r = 0; r < PTS.length - 1; r += 1) {
    for (let c = 0; c < PTS[r].length - 1; c += 1) {
      const t1: [number, number][] = [PTS[r][c], PTS[r][c + 1], PTS[r + 1][c]];
      const t2: [number, number][] = [PTS[r][c + 1], PTS[r + 1][c + 1], PTS[r + 1][c]];
      for (const t of [t1, t2]) {
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
        const colorIndex = Math.abs(Math.round(Math.sin(cx * 0.055 + cy * 0.038) * 2.2 + Math.cos(cx * 0.034 - cy * 0.062) * 1.8)) % 5;
        out.push({ points: t.map((p) => p.join(",")).join(" "), colorIndex });
      }
    }
  }
  return out;
}

const TRIS = buildTris();

function initials(name: string) {
  return String(name || "Player")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function firstValidImage(player: PlayerCardData) {
  return [player.image, player.imageUrl, player.photo, ...(player.imageCandidates || [])].filter(Boolean) as string[];
}

function shortText(value: string | undefined, fallback: string, max = 18) {
  const text = String(value || fallback).trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function statTotal(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.map((v) => Number(v || 0)).slice(0, 5) : [];
  const total = Number(player.totalPoints || scores.reduce((sum, value) => sum + value, 0) || player.form || player.rating || 0);
  return Math.max(0, Math.round(total));
}

function depthShadow(theme: RarityTheme) {
  return [
    `1px 1px 0 ${theme.depth[0]}`,
    `2px 2px 0 ${theme.depth[0]}`,
    `3px 3px 0 ${theme.depth[1]}`,
    `4px 4px 0 ${theme.depth[1]}`,
    `5px 5px 0 ${theme.depth[2]}`,
    `6px 6px 0 ${theme.depth[2]}`,
    `7px 7px 0 ${theme.depth[3]}`,
    `8px 8px 0 ${theme.depth[3]}`,
    `0 26px 56px ${theme.glow}`,
    "0 0 0 1px rgba(255,255,255,0.14)",
  ].join(",");
}

function PremiumFootballCardBase({ player, selected = false, onClick, showPrice = false, className = "", size = "md" }: PremiumFootballCardProps) {
  const rarity = String(player.rarity || "common").toLowerCase();
  const theme = themes[rarity] || themes.common;
  const dimensions = sizeMap[size];
  const images = useMemo(() => firstValidImage(player), [player]);
  const [imageIndex, setImageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [gloss, setGloss] = useState({ x: 50, y: 50 });
  const ref = useRef<HTMLButtonElement>(null);
  const currentImage = images[imageIndex];
  const showImage = Boolean(currentImage) && !failed;
  const rating = Math.max(0, Math.round(Number(player.rating || player.form || statTotal(player) || 0)));
  const serial = player.serial && player.maxSupply ? `${player.serial} / ${player.maxSupply}` : player.maxSupply ? `1 / ${player.maxSupply}` : player.season || "25-26";
  const teamName = player.team || player.club || "Fantasy Arena";
  const clubMark = shortText(teamName, "FA", 1).toUpperCase();

  const handleMouseMove = (event: MouseEvent<HTMLButtonElement>) => {
    if (!ref.current || window.matchMedia("(pointer: coarse)").matches) return;
    const rect = ref.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setTilt({ x: ((y - rect.height / 2) / (rect.height / 2)) * -8, y: ((x - rect.width / 2) / (rect.width / 2)) * 8 });
    setGloss({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  };

  const handleImageError = () => {
    if (imageIndex < images.length - 1) {
      setImageIndex((index) => index + 1);
    } else {
      setFailed(true);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={[
        "group relative isolate bg-transparent p-0 text-left outline-none transition-transform duration-200",
        onClick ? "cursor-pointer" : "cursor-default",
        selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950" : "",
        className,
      ].join(" ")}
      style={{ width: dimensions.width, height: dimensions.height, borderRadius: 18 * dimensions.scale }}
      data-testid={`premium-football-card-${player.id}`}
      aria-label={`${player.name || "Player"} card`}
    >
      <div
        style={{
          position: "relative",
          width: 280,
          height: 476,
          borderRadius: 18,
          overflow: "hidden",
          background: theme.base,
          transformOrigin: "top left",
          transform: `scale(${dimensions.scale}) perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${hovered ? -5 : 0}px)`,
          transition: hovered ? "transform 90ms ease-out" : "transform 220ms ease-out",
          boxShadow: depthShadow(theme),
        }}
      >
        <svg viewBox="0 0 280 476" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", zIndex: 0 }}>
          {TRIS.map((triangle, index) => (
            <polygon key={index} points={triangle.points} fill={theme.palette[triangle.colorIndex]} stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
          ))}
        </svg>

        <div style={{ position: "absolute", inset: 0, zIndex: 1, background: `radial-gradient(circle at 50% 4%, rgba(255,255,255,0.34), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.20), transparent 22%, rgba(0,0,0,0.18) 72%, rgba(255,255,255,0.08))`, pointerEvents: "none" }} />

        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 148, zIndex: 2, overflow: "hidden" }}>
          {showImage ? (
            <img
              src={currentImage}
              alt={player.name || "Player"}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
              style={{
                width: "100%",
                height: "106%",
                objectFit: "contain",
                objectPosition: "bottom center",
                transform: "translateY(6px)",
                filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.58))",
              }}
            />
          ) : (
            <div style={{ position: "absolute", left: "50%", bottom: 38, transform: "translateX(-50%)", width: 128, height: 128, borderRadius: 24, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.55)", fontSize: 36, fontWeight: 900 }}>
              {initials(player.name)}
            </div>
          )}
        </div>

        <div style={{ position: "absolute", bottom: 148, left: 0, right: 0, height: 82, background: `linear-gradient(to top, ${theme.base}, transparent)`, zIndex: 3, pointerEvents: "none" }} />

        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", zIndex: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#fff", background: "rgba(0,0,0,0.52)", padding: "2px 6px", borderRadius: 3, letterSpacing: "0.08em" }}>{player.season || "25-26"}</span>
            <span style={{ fontSize: 7, fontWeight: 800, color: theme.muted, background: "rgba(0,0,0,0.42)", padding: "1px 5px", borderRadius: 2 }}>{shortText(teamName, "Fantasy Arena", 18)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: `1.5px solid ${theme.soft}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 950, color: "#fff" }}>{clubMark}</div>
            <span style={{ fontSize: 10, fontWeight: 950, color: "#fff", background: "rgba(0,0,0,0.45)", padding: "1px 5px", borderRadius: 3 }}>{rating}</span>
          </div>
        </div>

        {hovered ? <div style={{ position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none", background: `radial-gradient(ellipse at ${gloss.x}% ${gloss.y}%, rgba(255,255,255,0.24) 0%, transparent 58%)` }} /> : null}

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 176,
            background: "linear-gradient(to bottom, rgba(5,10,22,0) 0%, rgba(6,10,21,0.96) 18%, #050812 100%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "10px 14px 16px",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
            <div style={{ width: 11, height: 11, borderRadius: "50%", border: `1.5px solid ${theme.soft}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: theme.soft }} />
            </div>
            <span style={{ fontSize: 7.5, fontWeight: 900, color: theme.muted, letterSpacing: "0.16em", textTransform: "uppercase" }}>{theme.label}</span>
            <span style={{ marginLeft: "auto", fontSize: 7.5, fontFamily: "monospace", color: theme.muted, opacity: 0.72 }}>{serial}</span>
          </div>

          <div style={{ fontSize: 30, fontWeight: 950, color: theme.text, textTransform: "uppercase", lineHeight: 0.92, letterSpacing: "-0.02em", marginBottom: 7 }}>
            {String(player.name || "Unknown Player").split(/\s+/).slice(0, 2).map((part, index) => <span key={`${part}-${index}`}>{part}{index === 0 ? <br /> : null}</span>)}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ minWidth: 0, flex: 1, fontSize: 10, fontWeight: 800, color: theme.muted, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.position || "Player"}</span>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <span style={{ fontSize: 8.5, color: theme.muted }}>PTS {statTotal(player)}</span>
              <span style={{ fontSize: 8.5, color: theme.muted, background: "rgba(255,255,255,0.08)", padding: "1px 4px", borderRadius: 2 }}>{player.nationality || "FC"}</span>
            </div>
          </div>

          {showPrice && Number(player.price || player.listedPrice || 0) > 0 ? (
            <div style={{ marginTop: 7, borderRadius: 7, background: "rgba(16,185,129,0.92)", color: "#022c22", textAlign: "center", fontSize: 10, fontWeight: 950, padding: "4px 6px" }}>
              N${Number(player.price || player.listedPrice || 0).toFixed(2)}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;

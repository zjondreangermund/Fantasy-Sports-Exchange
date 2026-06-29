export type CardRarity = "common" | "rare" | "unique" | "epic" | "legendary";

export function normalizeRarity(v?: string | null): CardRarity {
  const r = String(v ?? "common").toLowerCase();
  if (r === "legendary") return "legendary";
  if (r === "epic") return "epic";
  if (r === "unique") return "unique";
  if (r === "rare") return "rare";
  return "common";
}

export type CardSize = "sm" | "md" | "lg";

export const CARD_SIZES: Record<
  CardSize,
  { w: number; h: number; edge: number; radius: number; scale: number }
> = {
  sm: { w: 158, h: 228, edge: 9, radius: 14, scale: 0.88 },
  md: { w: 186, h: 268, edge: 12, radius: 16, scale: 1 },
  lg: { w: 226, h: 326, edge: 14, radius: 18, scale: 1.22 },
};

export type RarityTheme = {
  face: string;
  frame: string;
  frameHighlight: string;
  edgeDark: string;
  edgeMid: string;
  edgeLight: string;
  border: string;
  glow: string;
  glowRgb: string;
  label: string;
  labelBg: string;
  accent: string;
  foil: string;
  holo: string;
  windowBg: string;
  windowBorder: string;
  studioGlow: string;
  actionBorder: string;
  actionText: string;
};

export const RARITY_THEME: Record<CardRarity, RarityTheme> = {
  common: {
    face: "linear-gradient(135deg,#f8fafc 0%,#9aa7b8 15%,#e7eef7 28%,#6d7889 44%,#cbd5e1 58%,#566274 76%,#f1f5f9 100%)",
    frame: "linear-gradient(145deg,#ffffff 0%,#c8d2df 24%,#7e8da0 48%,#eef4fb 70%,#64748b 100%)",
    frameHighlight: "linear-gradient(180deg,rgba(255,255,255,.88) 0%,rgba(255,255,255,.12) 38%,transparent 72%)",
    edgeDark: "#3f4a5a",
    edgeMid: "#718096",
    edgeLight: "#f1f5f9",
    border: "rgba(226,232,240,0.82)",
    glow: "0 12px 38px rgba(148,163,184,.45), 0 2px 12px rgba(0,0,0,.55), inset 0 0 22px rgba(255,255,255,.10)",
    glowRgb: "148,163,184",
    label: "COMMON CHROME",
    labelBg: "linear-gradient(90deg,rgba(71,85,105,.98),rgba(203,213,225,.70),rgba(100,116,139,.98))",
    accent: "#f8fafc",
    foil: "linear-gradient(115deg,transparent 20%,rgba(255,255,255,.55) 38%,rgba(180,220,255,.35) 48%,rgba(255,255,255,.48) 56%,transparent 74%)",
    holo: "repeating-linear-gradient(125deg,rgba(255,255,255,.08) 0 2px,transparent 2px 7px),linear-gradient(45deg,rgba(59,130,246,.12),rgba(236,72,153,.10),rgba(34,197,94,.10))",
    windowBg: "linear-gradient(180deg,#111827 0%,#020617 100%)",
    windowBorder: "rgba(226,232,240,.55)",
    studioGlow: "radial-gradient(ellipse 90% 62% at 50% 10%,rgba(226,232,240,.34),transparent 68%)",
    actionBorder: "rgba(226,232,240,.58)",
    actionText: "#e2e8f0",
  },
  rare: {
    face: "linear-gradient(135deg,#5f0000 0%,#ef4444 18%,#fff1f2 31%,#b91c1c 48%,#f87171 63%,#7f1d1d 78%,#fecaca 100%)",
    frame: "linear-gradient(145deg,#fff1f2 0%,#fb7185 24%,#991b1b 48%,#fee2e2 70%,#450a0a 100%)",
    frameHighlight: "linear-gradient(180deg,rgba(255,245,245,.84) 0%,rgba(255,150,150,.18) 42%,transparent 74%)",
    edgeDark: "#450a0a",
    edgeMid: "#991b1b",
    edgeLight: "#fecaca",
    border: "rgba(254,202,202,.82)",
    glow: "0 14px 46px rgba(239,68,68,.58), 0 0 90px rgba(220,38,38,.24), inset 0 0 22px rgba(255,255,255,.10)",
    glowRgb: "239,68,68",
    label: "RARE PRIZM",
    labelBg: "linear-gradient(90deg,rgba(127,29,29,.98),rgba(248,113,113,.82),rgba(153,27,27,.98))",
    accent: "#fee2e2",
    foil: "linear-gradient(115deg,transparent 18%,rgba(255,210,210,.64) 38%,rgba(255,255,255,.38) 50%,rgba(255,150,150,.40) 58%,transparent 76%)",
    holo: "repeating-linear-gradient(125deg,rgba(255,220,220,.10) 0 2px,transparent 2px 7px),linear-gradient(45deg,rgba(255,255,255,.08),rgba(251,113,133,.16),rgba(250,204,21,.08))",
    windowBg: "linear-gradient(180deg,#1a0505 0%,#050101 100%)",
    windowBorder: "rgba(248,113,113,.62)",
    studioGlow: "radial-gradient(ellipse 90% 60% at 50% 9%,rgba(248,113,113,.48),transparent 66%)",
    actionBorder: "rgba(248,113,113,.70)",
    actionText: "#fecaca",
  },
  unique: {
    face: "linear-gradient(135deg,#1e1b4b 0%,#7c3aed 16%,#67e8f9 31%,#ec4899 47%,#fef3c7 58%,#6366f1 74%,#312e81 100%)",
    frame: "linear-gradient(145deg,#f5d0fe 0%,#22d3ee 20%,#a855f7 42%,#f0abfc 64%,#4338ca 100%)",
    frameHighlight: "linear-gradient(180deg,rgba(255,255,255,.82) 0%,rgba(236,72,153,.20) 38%,transparent 72%)",
    edgeDark: "#1e1b4b",
    edgeMid: "#7c3aed",
    edgeLight: "#e9d5ff",
    border: "rgba(216,180,254,.86)",
    glow: "0 16px 58px rgba(168,85,247,.62), 0 0 105px rgba(34,211,238,.22), inset 0 0 24px rgba(255,255,255,.12)",
    glowRgb: "168,85,247",
    label: "UNIQUE HOLO",
    labelBg: "linear-gradient(90deg,rgba(109,40,217,.98),rgba(34,211,238,.75),rgba(219,39,119,.95))",
    accent: "#f5d0fe",
    foil: "linear-gradient(115deg,transparent 16%,rgba(255,180,255,.55) 35%,rgba(180,255,255,.45) 46%,rgba(255,255,180,.38) 54%,rgba(255,255,255,.30) 61%,transparent 78%)",
    holo: "repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.095) 0deg 8deg,transparent 8deg 16deg),linear-gradient(45deg,rgba(34,211,238,.18),rgba(236,72,153,.16),rgba(250,204,21,.12))",
    windowBg: "linear-gradient(180deg,#120828 0%,#050212 100%)",
    windowBorder: "rgba(216,180,254,.70)",
    studioGlow: "radial-gradient(ellipse 94% 64% at 50% 8%,rgba(168,85,247,.58),transparent 64%)",
    actionBorder: "rgba(216,180,254,.70)",
    actionText: "#f5d0fe",
  },
  epic: {
    face: "linear-gradient(135deg,#020617 0%,#312e81 16%,#818cf8 30%,#ffffff 41%,#4f46e5 52%,#0ea5e9 68%,#111827 100%)",
    frame: "linear-gradient(145deg,#eef2ff 0%,#818cf8 21%,#4338ca 43%,#bae6fd 64%,#1e1b4b 100%)",
    frameHighlight: "linear-gradient(180deg,rgba(255,255,255,.86) 0%,rgba(129,140,248,.20) 40%,transparent 72%)",
    edgeDark: "#111827",
    edgeMid: "#4338ca",
    edgeLight: "#c7d2fe",
    border: "rgba(199,210,254,.86)",
    glow: "0 16px 56px rgba(99,102,241,.60), 0 0 100px rgba(14,165,233,.24), inset 0 0 24px rgba(255,255,255,.12)",
    glowRgb: "129,140,248",
    label: "EPIC ICE CHROME",
    labelBg: "linear-gradient(90deg,rgba(30,27,75,.98),rgba(129,140,248,.78),rgba(14,165,233,.92))",
    accent: "#dbeafe",
    foil: "linear-gradient(115deg,transparent 16%,rgba(180,190,255,.58) 36%,rgba(255,255,255,.45) 49%,rgba(125,211,252,.34) 59%,transparent 78%)",
    holo: "repeating-linear-gradient(135deg,rgba(191,219,254,.10) 0 3px,transparent 3px 9px),linear-gradient(45deg,rgba(14,165,233,.18),rgba(99,102,241,.18),rgba(255,255,255,.08))",
    windowBg: "linear-gradient(180deg,#0a0a1a 0%,#030712 100%)",
    windowBorder: "rgba(129,140,248,.70)",
    studioGlow: "radial-gradient(ellipse 90% 58% at 50% 10%,rgba(129,140,248,.54),transparent 66%)",
    actionBorder: "rgba(129,140,248,.70)",
    actionText: "#dbeafe",
  },
  legendary: {
    face: "linear-gradient(135deg,#451a03 0%,#d97706 15%,#fff7ed 28%,#fbbf24 43%,#f97316 58%,#78350f 76%,#fde68a 100%)",
    frame: "linear-gradient(145deg,#fff7ed 0%,#fde68a 18%,#fbbf24 36%,#d97706 58%,#78350f 100%)",
    frameHighlight: "linear-gradient(180deg,rgba(255,255,255,.92) 0%,rgba(251,191,36,.22) 40%,transparent 72%)",
    edgeDark: "#451a03",
    edgeMid: "#b45309",
    edgeLight: "#fef3c7",
    border: "rgba(253,230,138,.92)",
    glow: "0 18px 68px rgba(245,158,11,.70), 0 0 130px rgba(251,191,36,.34), inset 0 0 28px rgba(255,255,255,.16)",
    glowRgb: "251,191,36",
    label: "LEGENDARY GOLD PRIZM",
    labelBg: "linear-gradient(90deg,rgba(120,53,15,.98),rgba(251,191,36,.88),rgba(217,119,6,.95))",
    accent: "#fff7ed",
    foil: "linear-gradient(115deg,transparent 14%,rgba(255,240,180,.70) 34%,rgba(255,255,255,.55) 47%,rgba(255,190,90,.42) 58%,transparent 78%)",
    holo: "repeating-conic-gradient(from 45deg at 50% 50%,rgba(255,230,150,.12) 0deg 6deg,transparent 6deg 12deg),linear-gradient(45deg,rgba(255,255,255,.10),rgba(251,191,36,.20),rgba(249,115,22,.12))",
    windowBg: "linear-gradient(180deg,#1a1005 0%,#080402 100%)",
    windowBorder: "rgba(253,230,138,.78)",
    studioGlow: "radial-gradient(ellipse 98% 68% at 50% 7%,rgba(251,191,36,.66),transparent 62%)",
    actionBorder: "rgba(253,230,138,.78)",
    actionText: "#fff7ed",
  },
};

export function teamAbbrev(team?: string | null): string {
  if (!team) return "—";
  const clean = team.replace(/[^a-zA-Z\s]/g, "").trim();
  if (!clean) return "—";
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1].slice(0, 2)).toUpperCase();
  return clean.slice(0, 3).toUpperCase();
}

export function jerseyNumber(seed: number | string): string {
  const n = typeof seed === "number" ? seed : seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `#${(n % 99) + 1}`;
}

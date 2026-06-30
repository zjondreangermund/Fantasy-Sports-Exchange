import { type Rarity } from "./types";

export type PremiumCardSize = "sm" | "md" | "lg" | "xl";

export type PremiumCardTheme = {
  label: string;
  chrome: string;
  frame: string;
  background: string;
  foil: string;
  holo: string;
  glass: string;
  nameplate: string;
  border: string;
  text: string;
  mutedText: string;
  glow: string;
  glowRgb: string;
  accent: string;
  dark: string;
};

export const CARD_SIZE: Record<PremiumCardSize, { width: number; height: number; radius: number; scale: number }> = {
  sm: { width: 178, height: 252, radius: 18, scale: 0.78 },
  md: { width: 220, height: 312, radius: 22, scale: 1 },
  lg: { width: 280, height: 396, radius: 28, scale: 1.26 },
  xl: { width: 340, height: 480, radius: 34, scale: 1.54 },
};

export function normalizeRarity(value?: string | null): Rarity {
  const rarity = String(value || "common").toLowerCase();
  if (rarity === "rare" || rarity === "unique" || rarity === "epic" || rarity === "legendary") return rarity;
  return "common";
}

export const CARD_THEMES: Record<Rarity, PremiumCardTheme> = {
  common: {
    label: "COMMON CHROME",
    chrome: "linear-gradient(135deg,#f8fafc 0%,#94a3b8 16%,#e2e8f0 31%,#64748b 50%,#cbd5e1 70%,#475569 100%)",
    frame: "linear-gradient(145deg,#ffffff 0%,#cbd5e1 22%,#64748b 48%,#eef2f7 68%,#334155 100%)",
    background: "radial-gradient(circle at 30% 15%,rgba(255,255,255,.55),transparent 28%),linear-gradient(160deg,#172033 0%,#0b1120 52%,#020617 100%)",
    foil: "linear-gradient(115deg,transparent 16%,rgba(255,255,255,.58) 38%,rgba(160,210,255,.36) 49%,rgba(255,255,255,.44) 58%,transparent 78%)",
    holo: "repeating-linear-gradient(125deg,rgba(255,255,255,.09) 0 2px,transparent 2px 7px),linear-gradient(45deg,rgba(59,130,246,.12),rgba(236,72,153,.10),rgba(34,197,94,.10))",
    glass: "linear-gradient(130deg,rgba(255,255,255,.34),rgba(255,255,255,.08) 22%,transparent 48%,rgba(255,255,255,.08) 76%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(15,23,42,.82),rgba(226,232,240,.30),rgba(15,23,42,.86))",
    border: "rgba(226,232,240,.82)",
    text: "#f8fafc",
    mutedText: "rgba(248,250,252,.68)",
    glow: "0 18px 48px rgba(148,163,184,.46),0 4px 18px rgba(0,0,0,.64)",
    glowRgb: "148,163,184",
    accent: "#e2e8f0",
    dark: "#020617",
  },
  rare: {
    label: "RARE PRIZM",
    chrome: "linear-gradient(135deg,#7f1d1d 0%,#ef4444 18%,#fff1f2 31%,#b91c1c 50%,#fb7185 70%,#450a0a 100%)",
    frame: "linear-gradient(145deg,#fff1f2 0%,#fb7185 23%,#991b1b 49%,#fee2e2 70%,#450a0a 100%)",
    background: "radial-gradient(circle at 32% 10%,rgba(248,113,113,.55),transparent 28%),linear-gradient(160deg,#240606 0%,#120202 58%,#050101 100%)",
    foil: "linear-gradient(115deg,transparent 16%,rgba(255,210,210,.64) 38%,rgba(255,255,255,.38) 50%,rgba(255,150,150,.40) 58%,transparent 78%)",
    holo: "repeating-linear-gradient(125deg,rgba(255,220,220,.11) 0 2px,transparent 2px 7px),linear-gradient(45deg,rgba(255,255,255,.09),rgba(251,113,133,.18),rgba(250,204,21,.08))",
    glass: "linear-gradient(130deg,rgba(255,245,245,.36),rgba(255,120,120,.10) 24%,transparent 50%,rgba(255,255,255,.08) 76%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(69,10,10,.90),rgba(248,113,113,.38),rgba(69,10,10,.92))",
    border: "rgba(254,202,202,.86)",
    text: "#fff1f2",
    mutedText: "rgba(255,241,242,.70)",
    glow: "0 20px 56px rgba(239,68,68,.60),0 0 90px rgba(220,38,38,.26),0 4px 18px rgba(0,0,0,.64)",
    glowRgb: "239,68,68",
    accent: "#fecaca",
    dark: "#050101",
  },
  epic: {
    label: "EPIC ICE CHROME",
    chrome: "linear-gradient(135deg,#020617 0%,#312e81 16%,#818cf8 30%,#ffffff 42%,#4f46e5 55%,#0ea5e9 74%,#111827 100%)",
    frame: "linear-gradient(145deg,#eef2ff 0%,#818cf8 22%,#4338ca 44%,#bae6fd 66%,#1e1b4b 100%)",
    background: "radial-gradient(circle at 30% 10%,rgba(129,140,248,.58),transparent 28%),linear-gradient(160deg,#0b0b24 0%,#05051a 58%,#020617 100%)",
    foil: "linear-gradient(115deg,transparent 16%,rgba(180,190,255,.58) 36%,rgba(255,255,255,.45) 49%,rgba(125,211,252,.34) 59%,transparent 78%)",
    holo: "repeating-linear-gradient(135deg,rgba(191,219,254,.11) 0 3px,transparent 3px 9px),linear-gradient(45deg,rgba(14,165,233,.18),rgba(99,102,241,.18),rgba(255,255,255,.08))",
    glass: "linear-gradient(130deg,rgba(255,255,255,.38),rgba(129,140,248,.12) 25%,transparent 50%,rgba(125,211,252,.10) 76%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(30,27,75,.90),rgba(129,140,248,.40),rgba(14,165,233,.34),rgba(30,27,75,.92))",
    border: "rgba(199,210,254,.90)",
    text: "#eef2ff",
    mutedText: "rgba(238,242,255,.70)",
    glow: "0 20px 58px rgba(99,102,241,.64),0 0 95px rgba(14,165,233,.28),0 4px 18px rgba(0,0,0,.64)",
    glowRgb: "129,140,248",
    accent: "#dbeafe",
    dark: "#020617",
  },
  unique: {
    label: "UNIQUE HOLO",
    chrome: "linear-gradient(135deg,#1e1b4b 0%,#7c3aed 16%,#67e8f9 31%,#ec4899 48%,#fef3c7 59%,#6366f1 76%,#312e81 100%)",
    frame: "linear-gradient(145deg,#f5d0fe 0%,#22d3ee 20%,#a855f7 43%,#f0abfc 65%,#4338ca 100%)",
    background: "radial-gradient(circle at 30% 10%,rgba(168,85,247,.62),transparent 30%),linear-gradient(160deg,#160b34 0%,#080418 58%,#040211 100%)",
    foil: "linear-gradient(115deg,transparent 16%,rgba(255,180,255,.56) 35%,rgba(180,255,255,.46) 46%,rgba(255,255,180,.38) 54%,rgba(255,255,255,.30) 61%,transparent 78%)",
    holo: "repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.10) 0deg 8deg,transparent 8deg 16deg),linear-gradient(45deg,rgba(34,211,238,.20),rgba(236,72,153,.18),rgba(250,204,21,.12))",
    glass: "linear-gradient(130deg,rgba(255,255,255,.38),rgba(236,72,153,.12) 25%,transparent 50%,rgba(34,211,238,.12) 76%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(49,46,129,.90),rgba(34,211,238,.34),rgba(219,39,119,.40),rgba(49,46,129,.92))",
    border: "rgba(216,180,254,.92)",
    text: "#f5d0fe",
    mutedText: "rgba(245,208,254,.72)",
    glow: "0 22px 64px rgba(168,85,247,.68),0 0 110px rgba(34,211,238,.26),0 4px 18px rgba(0,0,0,.64)",
    glowRgb: "168,85,247",
    accent: "#f5d0fe",
    dark: "#050212",
  },
  legendary: {
    label: "LEGENDARY GOLD PRIZM",
    chrome: "linear-gradient(135deg,#451a03 0%,#d97706 16%,#fff7ed 29%,#fbbf24 44%,#f97316 60%,#78350f 78%,#fde68a 100%)",
    frame: "linear-gradient(145deg,#fff7ed 0%,#fde68a 19%,#fbbf24 37%,#d97706 59%,#78350f 100%)",
    background: "radial-gradient(circle at 30% 9%,rgba(251,191,36,.68),transparent 31%),linear-gradient(160deg,#211305 0%,#120902 58%,#050201 100%)",
    foil: "linear-gradient(115deg,transparent 14%,rgba(255,240,180,.72) 34%,rgba(255,255,255,.56) 47%,rgba(255,190,90,.44) 58%,transparent 78%)",
    holo: "repeating-conic-gradient(from 45deg at 50% 50%,rgba(255,230,150,.13) 0deg 6deg,transparent 6deg 12deg),linear-gradient(45deg,rgba(255,255,255,.11),rgba(251,191,36,.22),rgba(249,115,22,.13))",
    glass: "linear-gradient(130deg,rgba(255,255,255,.42),rgba(251,191,36,.14) 25%,transparent 50%,rgba(255,255,255,.10) 76%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(69,26,3,.92),rgba(251,191,36,.42),rgba(217,119,6,.40),rgba(69,26,3,.94))",
    border: "rgba(253,230,138,.94)",
    text: "#fff7ed",
    mutedText: "rgba(255,247,237,.74)",
    glow: "0 24px 72px rgba(245,158,11,.74),0 0 130px rgba(251,191,36,.36),0 4px 18px rgba(0,0,0,.64)",
    glowRgb: "251,191,36",
    accent: "#fde68a",
    dark: "#050201",
  },
};

export function teamCode(team?: string | null): string {
  const cleaned = String(team || "FA").replace(/[^a-zA-Z\s]/g, " ").trim();
  if (!cleaned) return "FA";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 3).map((part) => part[0]).join("").toUpperCase();
}

export function cardNumber(seed?: string | number): string {
  const raw = String(seed || "1");
  const sum = raw.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return `#${String((sum % 99) + 1).padStart(2, "0")}`;
}

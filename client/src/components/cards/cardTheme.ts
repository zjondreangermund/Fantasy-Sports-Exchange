import { type Rarity } from "./types";

export type PremiumCardSize = "xs" | "sm" | "md" | "lg" | "xl";

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
  xs: { width: 96, height: 136, radius: 12, scale: 0.5 },
  sm: { width: 164, height: 232, radius: 18, scale: 0.74 },
  md: { width: 204, height: 290, radius: 22, scale: 0.94 },
  lg: { width: 258, height: 366, radius: 28, scale: 1.18 },
  xl: { width: 314, height: 444, radius: 34, scale: 1.44 },
};

export function normalizeRarity(value?: string | null): Rarity {
  const rarity = String(value || "common").toLowerCase();
  if (rarity === "rare" || rarity === "unique" || rarity === "epic" || rarity === "legendary") return rarity;
  return "common";
}

export const CARD_THEMES: Record<Rarity, PremiumCardTheme> = {
  common: {
    label: "COMMON",
    chrome: "linear-gradient(135deg,#f8fafc 0%,#94a3b8 14%,#ffffff 28%,#64748b 49%,#e2e8f0 70%,#334155 100%)",
    frame: "linear-gradient(145deg,#ffffff 0%,#dbe3ee 20%,#64748b 46%,#f8fafc 66%,#263241 100%)",
    background: "radial-gradient(circle at 30% 15%,rgba(255,255,255,.62),transparent 28%),linear-gradient(160deg,#172033 0%,#0b1120 52%,#020617 100%)",
    foil: "linear-gradient(115deg,transparent 16%,rgba(255,255,255,.66) 38%,rgba(160,210,255,.40) 49%,rgba(255,255,255,.50) 58%,transparent 78%)",
    holo: "repeating-linear-gradient(125deg,rgba(255,255,255,.10) 0 2px,transparent 2px 7px),linear-gradient(45deg,rgba(59,130,246,.13),rgba(236,72,153,.10),rgba(34,197,94,.10))",
    glass: "linear-gradient(130deg,rgba(255,255,255,.42),rgba(255,255,255,.09) 22%,transparent 48%,rgba(255,255,255,.10) 76%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(15,23,42,.88),rgba(226,232,240,.34),rgba(15,23,42,.92))",
    border: "rgba(248,250,252,.95)", text: "#f8fafc", mutedText: "rgba(248,250,252,.74)",
    glow: "0 20px 54px rgba(148,163,184,.56),0 0 42px rgba(255,255,255,.15),0 4px 18px rgba(0,0,0,.68)", glowRgb: "148,163,184", accent: "#f8fafc", dark: "#020617",
  },
  rare: {
    label: "RARE",
    chrome: "linear-gradient(135deg,#020617 0%,#075985 15%,#38bdf8 29%,#e0f2fe 42%,#0284c7 57%,#2563eb 74%,#061329 100%)",
    frame: "linear-gradient(145deg,#e0f2fe 0%,#38bdf8 22%,#0369a1 45%,#93c5fd 68%,#071b3d 100%)",
    background: "radial-gradient(circle at 30% 10%,rgba(56,189,248,.66),transparent 29%),linear-gradient(160deg,#071b3d 0%,#031226 58%,#010713 100%)",
    foil: "linear-gradient(115deg,transparent 16%,rgba(186,230,253,.70) 36%,rgba(255,255,255,.50) 49%,rgba(59,130,246,.42) 59%,transparent 78%)",
    holo: "repeating-linear-gradient(135deg,rgba(186,230,253,.14) 0 3px,transparent 3px 9px),linear-gradient(45deg,rgba(14,165,233,.24),rgba(37,99,235,.22),rgba(255,255,255,.10))",
    glass: "linear-gradient(130deg,rgba(255,255,255,.44),rgba(56,189,248,.16) 25%,transparent 50%,rgba(147,197,253,.13) 76%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(3,37,65,.96),rgba(2,132,199,.48),rgba(37,99,235,.42),rgba(3,37,65,.98))",
    border: "rgba(186,230,253,.98)", text: "#e0f2fe", mutedText: "rgba(224,242,254,.78)",
    glow: "0 22px 64px rgba(14,165,233,.78),0 0 110px rgba(37,99,235,.38),0 4px 18px rgba(0,0,0,.68)", glowRgb: "14,165,233", accent: "#7dd3fc", dark: "#010713",
  },
  epic: {
    label: "EPIC",
    chrome: "linear-gradient(135deg,#220306 0%,#7f1d1d 15%,#ef233c 29%,#fff1f2 42%,#dc2626 57%,#fb7185 74%,#2b0308 100%)",
    frame: "linear-gradient(145deg,#fff1f2 0%,#fb7185 22%,#b91c1c 45%,#fecdd3 68%,#450a0a 100%)",
    background: "radial-gradient(circle at 30% 10%,rgba(239,35,60,.70),transparent 29%),linear-gradient(160deg,#30050a 0%,#180205 58%,#070102 100%)",
    foil: "linear-gradient(115deg,transparent 16%,rgba(254,205,211,.72) 36%,rgba(255,255,255,.52) 49%,rgba(239,68,68,.45) 59%,transparent 78%)",
    holo: "repeating-linear-gradient(135deg,rgba(254,205,211,.14) 0 3px,transparent 3px 9px),linear-gradient(45deg,rgba(239,35,60,.26),rgba(185,28,28,.23),rgba(255,255,255,.10))",
    glass: "linear-gradient(130deg,rgba(255,255,255,.44),rgba(239,68,68,.17) 25%,transparent 50%,rgba(251,113,133,.14) 76%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(69,10,10,.96),rgba(220,38,38,.50),rgba(251,113,133,.42),rgba(69,10,10,.98))",
    border: "rgba(254,205,211,.98)", text: "#fff1f2", mutedText: "rgba(255,241,242,.78)",
    glow: "0 22px 66px rgba(239,35,60,.80),0 0 112px rgba(185,28,28,.42),0 4px 18px rgba(0,0,0,.68)", glowRgb: "239,35,60", accent: "#fb7185", dark: "#070102",
  },
  unique: {
    label: "UNIQUE",
    chrome: "linear-gradient(135deg,#12051f 0%,#3b0764 14%,#8b5cf6 29%,#c084fc 42%,#581c87 56%,#a855f7 74%,#1e0633 100%)",
    frame: "linear-gradient(145deg,#f5d0fe 0%,#a855f7 18%,#581c87 42%,#d8b4fe 64%,#2e1065 100%)",
    background: "radial-gradient(circle at 30% 10%,rgba(192,132,252,.70),transparent 30%),linear-gradient(160deg,#1a062c 0%,#080312 58%,#030109 100%)",
    foil: "linear-gradient(115deg,transparent 15%,rgba(235,210,255,.66) 34%,rgba(192,132,252,.52) 46%,rgba(255,255,255,.44) 54%,rgba(126,34,206,.36) 62%,transparent 78%)",
    holo: "repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.12) 0deg 8deg,transparent 8deg 16deg),linear-gradient(45deg,rgba(168,85,247,.26),rgba(126,34,206,.22),rgba(236,72,153,.12))",
    glass: "linear-gradient(130deg,rgba(255,255,255,.44),rgba(168,85,247,.18) 25%,transparent 50%,rgba(216,180,254,.16) 76%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(46,16,101,.96),rgba(126,34,206,.50),rgba(192,132,252,.42),rgba(46,16,101,.98))",
    border: "rgba(245,208,254,.98)", text: "#faf5ff", mutedText: "rgba(250,245,255,.78)",
    glow: "0 22px 68px rgba(168,85,247,.82),0 0 116px rgba(126,34,206,.44),0 4px 18px rgba(0,0,0,.68)", glowRgb: "168,85,247", accent: "#d8b4fe", dark: "#030109",
  },
  legendary: {
    label: "LEGENDARY",
    chrome: "linear-gradient(135deg,#2b1700 0%,#854d0e 13%,#facc15 27%,#fff7c2 40%,#f59e0b 54%,#fde047 68%,#5a3305 84%,#1a0d00 100%)",
    frame: "linear-gradient(145deg,#fff7c2 0%,#facc15 20%,#a16207 43%,#fde68a 65%,#5a3305 100%)",
    background: "radial-gradient(circle at 30% 10%,rgba(250,204,21,.78),transparent 30%),linear-gradient(160deg,#2f2105 0%,#120d02 58%,#050300 100%)",
    foil: "linear-gradient(115deg,transparent 14%,rgba(255,247,194,.82) 32%,rgba(250,204,21,.58) 44%,rgba(255,255,255,.68) 51%,rgba(245,158,11,.54) 61%,transparent 80%)",
    holo: "repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.16) 0deg 7deg,transparent 7deg 14deg),linear-gradient(45deg,rgba(250,204,21,.34),rgba(245,158,11,.26),rgba(255,255,255,.13))",
    glass: "linear-gradient(130deg,rgba(255,255,255,.54),rgba(250,204,21,.20) 25%,transparent 48%,rgba(253,224,71,.18) 73%,transparent)",
    nameplate: "linear-gradient(90deg,rgba(66,32,6,.98),rgba(161,98,7,.58),rgba(250,204,21,.46),rgba(66,32,6,.98))",
    border: "rgba(255,247,194,1)", text: "#fffbea", mutedText: "rgba(255,251,235,.82)",
    glow: "0 24px 74px rgba(250,204,21,.90),0 0 126px rgba(245,158,11,.52),0 4px 20px rgba(0,0,0,.72)", glowRgb: "250,204,21", accent: "#fde047", dark: "#050300",
  },
};

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
  sm: { w: 150, h: 220, edge: 8, radius: 12, scale: 0.82 },
  md: { w: 172, h: 252, edge: 10, radius: 14, scale: 1 },
  lg: { w: 210, h: 308, edge: 12, radius: 16, scale: 1.18 },
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
    face: "linear-gradient(155deg, #8a96a8 0%, #c8d2de 18%, #9aa8ba 42%, #7a8898 68%, #5c6878 100%)",
    frame: "linear-gradient(145deg, #e8eef5 0%, #b8c4d4 35%, #8898aa 70%, #6a7888 100%)",
    frameHighlight: "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, transparent 45%)",
    edgeDark: "#4a5568",
    edgeMid: "#718096",
    edgeLight: "#cbd5e1",
    border: "rgba(203,213,225,0.55)",
    glow: "0 8px 32px rgba(100,116,139,0.35), 0 2px 8px rgba(0,0,0,0.45)",
    glowRgb: "100,116,139",
    label: "COMMON EDITION",
    labelBg: "linear-gradient(90deg, rgba(71,85,105,0.95), rgba(100,116,139,0.9))",
    accent: "#e2e8f0",
    foil: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.35) 45%, rgba(200,210,225,0.25) 50%, transparent 65%)",
    holo: "repeating-linear-gradient(125deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 8px)",
    windowBg: "linear-gradient(180deg, #0a1628 0%, #061018 100%)",
    windowBorder: "rgba(203,213,225,0.35)",
    studioGlow: "radial-gradient(ellipse 80% 60% at 50% 15%, rgba(148,163,184,0.25), transparent 70%)",
    actionBorder: "rgba(148,163,184,0.45)",
    actionText: "#cbd5e1",
  },
  rare: {
    face: "linear-gradient(155deg, #7f1d1d 0%, #dc2626 22%, #ef4444 48%, #b91c1c 72%, #450a0a 100%)",
    frame: "linear-gradient(145deg, #fecaca 0%, #ef4444 30%, #991b1b 65%, #450a0a 100%)",
    frameHighlight: "linear-gradient(180deg, rgba(255,220,220,0.55) 0%, transparent 42%)",
    edgeDark: "#450a0a",
    edgeMid: "#991b1b",
    edgeLight: "#fca5a5",
    border: "rgba(248,113,113,0.6)",
    glow: "0 10px 40px rgba(220,38,38,0.45), 0 0 60px rgba(239,68,68,0.15)",
    glowRgb: "239,68,68",
    label: "RARE EDITION",
    labelBg: "linear-gradient(90deg, rgba(153,27,27,0.98), rgba(220,38,38,0.92))",
    accent: "#fecaca",
    foil: "linear-gradient(115deg, transparent 28%, rgba(255,200,200,0.4) 44%, rgba(255,255,255,0.2) 50%, transparent 62%)",
    holo: "repeating-linear-gradient(125deg, rgba(255,180,180,0.08) 0 2px, transparent 2px 7px)",
    windowBg: "linear-gradient(180deg, #1a0505 0%, #0a0202 100%)",
    windowBorder: "rgba(248,113,113,0.45)",
    studioGlow: "radial-gradient(ellipse 85% 55% at 50% 12%, rgba(239,68,68,0.35), transparent 68%)",
    actionBorder: "rgba(248,113,113,0.55)",
    actionText: "#fecaca",
  },
  unique: {
    face: "linear-gradient(155deg, #4c1d95 0%, #7c3aed 25%, #a855f7 45%, #ec4899 62%, #6366f1 82%, #312e81 100%)",
    frame: "linear-gradient(145deg, #e9d5ff 0%, #a855f7 25%, #7c3aed 55%, #4c1d95 85%)",
    frameHighlight: "linear-gradient(180deg, rgba(255,230,255,0.55) 0%, transparent 40%)",
    edgeDark: "#312e81",
    edgeMid: "#6d28d9",
    edgeLight: "#c4b5fd",
    border: "rgba(168,85,247,0.65)",
    glow: "0 12px 48px rgba(124,58,237,0.5), 0 0 80px rgba(168,85,247,0.2)",
    glowRgb: "168,85,247",
    label: "UNIQUE EDITION",
    labelBg: "linear-gradient(90deg, rgba(109,40,217,0.98), rgba(219,39,119,0.92))",
    accent: "#e9d5ff",
    foil: "linear-gradient(115deg, transparent 25%, rgba(255,180,255,0.35) 42%, rgba(180,255,255,0.25) 48%, rgba(255,255,180,0.2) 52%, transparent 68%)",
    holo: "repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.06) 0deg 8deg, transparent 8deg 16deg)",
    windowBg: "linear-gradient(180deg, #120828 0%, #080418 100%)",
    windowBorder: "rgba(196,130,255,0.5)",
    studioGlow: "radial-gradient(ellipse 90% 60% at 50% 10%, rgba(168,85,247,0.45), transparent 65%)",
    actionBorder: "rgba(196,130,255,0.55)",
    actionText: "#e9d5ff",
  },
  epic: {
    labelBg: "linear-gradient(90deg, rgba(30,27,75,0.98), rgba(67,56,202,0.92))",
    accent: "#c7d2fe",
    foil: "linear-gradient(115deg, transparent 30%, rgba(180,190,255,0.35) 46%, rgba(255,255,255,0.15) 50%, transparent 64%)",
    holo: "repeating-linear-gradient(135deg, rgba(129,140,248,0.07) 0 3px, transparent 3px 9px)",
    windowBg: "linear-gradient(180deg, #0a0a1a 0%, #050510 100%)",
    windowBorder: "rgba(129,140,248,0.45)",
    studioGlow: "radial-gradient(ellipse 85% 55% at 50% 12%, rgba(99,102,241,0.35), transparent 68%)",
    actionBorder: "rgba(129,140,248,0.5)",
    actionText: "#c7d2fe",
  },
  legendary: {
    face: "linear-gradient(155deg, #78350f 0%, #d97706 22%, #fbbf24 48%, #f59e0b 68%, #92400e 100%)",
    frame: "linear-gradient(145deg, #fef3c7 0%, #fbbf24 22%, #d97706 52%, #92400e 88%)",
    frameHighlight: "linear-gradient(180deg, rgba(255,250,220,0.7) 0%, transparent 38%)",
    edgeDark: "#451a03",
    edgeMid: "#92400e",
    edgeLight: "#fde68a",
    border: "rgba(252,211,77,0.75)",
    glow: "0 14px 56px rgba(245,158,11,0.55), 0 0 90px rgba(251,191,36,0.25)",
    glowRgb: "251,191,36",
    label: "LEGENDARY EDITION",
    labelBg: "linear-gradient(90deg, rgba(146,64,14,0.98), rgba(217,119,6,0.95))",
    accent: "#fef3c7",
    foil: "linear-gradient(115deg, transparent 22%, rgba(255,240,180,0.5) 40%, rgba(255,255,255,0.35) 48%, rgba(255,220,150,0.3) 54%, transparent 70%)",
    holo: "repeating-conic-gradient(from 45deg at 50% 50%, rgba(255,230,150,0.08) 0deg 6deg, transparent 6deg 12deg)",
    windowBg: "linear-gradient(180deg, #1a1005 0%, #0a0802 100%)",
    windowBorder: "rgba(252,211,77,0.55)",
    studioGlow: "radial-gradient(ellipse 95% 65% at 50% 8%, rgba(251,191,36,0.5), transparent 62%)",
    actionBorder: "rgba(252,211,77,0.65)",
    actionText: "#fef3c7",
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

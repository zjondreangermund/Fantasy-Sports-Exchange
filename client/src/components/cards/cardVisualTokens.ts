import { type PlayerCardData } from "../Metal3DCard";

export type CardVisualToken = {
  rarityLabel: string;
  shell: string;
  frameOuter: string;
  frameInner: string;
  bevel: string;
  glow: string;
  pattern: string;
  badge: string;
  orb: string;
  statChip: string;
};

const common: CardVisualToken = {
  rarityLabel: "COMMON",
  shell: "from-[#111827] via-[#0b1220] to-[#050912]",
  frameOuter: "from-[#a7b1c2] via-[#6b7280] to-[#3f4b5f]",
  frameInner: "from-[#1f2937] via-[#111827] to-[#0b1220]",
  bevel: "shadow-[inset_0_2px_0_rgba(255,255,255,0.38),inset_0_-3px_8px_rgba(0,0,0,0.55)]",
  glow: "shadow-[0_14px_42px_rgba(45,212,191,0.18)]",
  pattern: "bg-[radial-gradient(circle_at_20%_20%,rgba(148,163,184,0.18),transparent_42%),repeating-linear-gradient(120deg,rgba(148,163,184,0.06)_0px,rgba(148,163,184,0.06)_2px,transparent_2px,transparent_8px)]",
  badge: "bg-emerald-300/14 border-emerald-200/35 text-emerald-100",
  orb: "bg-emerald-200",
  statChip: "bg-emerald-500/20 border-emerald-200/35 text-emerald-50",
};

const rare: CardVisualToken = {
  rarityLabel: "RARE",
  shell: "from-[#081935] via-[#0b1f43] to-[#071326]",
  frameOuter: "from-[#7dd3fc] via-[#2563eb] to-[#1e3a8a]",
  frameInner: "from-[#0e223f] via-[#0c1d33] to-[#081426]",
  bevel: "shadow-[inset_0_2px_0_rgba(255,255,255,0.44),inset_0_-4px_10px_rgba(2,6,23,0.62)]",
  glow: "shadow-[0_14px_44px_rgba(59,130,246,0.4)]",
  pattern: "bg-[radial-gradient(circle_at_78%_12%,rgba(125,211,252,0.27),transparent_42%),linear-gradient(120deg,rgba(56,189,248,0.12),transparent_44%),repeating-linear-gradient(45deg,rgba(56,189,248,0.07)_0_3px,transparent_3px_8px)]",
  badge: "bg-sky-400/20 border-sky-200/40 text-sky-50",
  orb: "bg-sky-200",
  statChip: "bg-sky-500/24 border-sky-200/45 text-sky-50",
};

const unique: CardVisualToken = {
  rarityLabel: "UNIQUE",
  shell: "from-[#200826] via-[#2b0d3d] to-[#120719]",
  frameOuter: "from-[#f472b6] via-[#a855f7] to-[#6d28d9]",
  frameInner: "from-[#2e0f45] via-[#210a34] to-[#13081f]",
  bevel: "shadow-[inset_0_2px_0_rgba(255,255,255,0.42),inset_0_-4px_10px_rgba(0,0,0,0.58)]",
  glow: "shadow-[0_16px_48px_rgba(217,70,239,0.42)]",
  pattern: "bg-[radial-gradient(circle_at_80%_16%,rgba(244,114,182,0.33),transparent_40%),radial-gradient(circle_at_20%_80%,rgba(168,85,247,0.26),transparent_46%),repeating-linear-gradient(128deg,rgba(236,72,153,0.09)_0_4px,transparent_4px_12px)]",
  badge: "bg-fuchsia-400/24 border-fuchsia-200/42 text-fuchsia-50",
  orb: "bg-fuchsia-200",
  statChip: "bg-fuchsia-500/24 border-fuchsia-200/42 text-fuchsia-50",
};

const legendary: CardVisualToken = {
  rarityLabel: "LEGENDARY",
  shell: "from-[#2b1700] via-[#3b2304] to-[#1a0f00]",
  frameOuter: "from-[#fde68a] via-[#f59e0b] to-[#b45309]",
  frameInner: "from-[#382107] via-[#261505] to-[#170d03]",
  bevel: "shadow-[inset_0_2px_0_rgba(255,255,255,0.5),inset_0_-4px_10px_rgba(0,0,0,0.58)]",
  glow: "shadow-[0_18px_52px_rgba(245,158,11,0.5)]",
  pattern: "bg-[radial-gradient(circle_at_75%_14%,rgba(253,224,71,0.34),transparent_40%),radial-gradient(circle_at_30%_70%,rgba(251,191,36,0.25),transparent_46%),repeating-linear-gradient(115deg,rgba(251,191,36,0.1)_0_3px,transparent_3px_11px)]",
  badge: "bg-amber-300/24 border-amber-100/50 text-amber-50",
  orb: "bg-amber-200",
  statChip: "bg-amber-500/26 border-amber-100/50 text-amber-50",
};

export const cardVisualTokens: Record<PlayerCardData["rarity"], CardVisualToken> = {
  common,
  rare,
  unique,
  epic: unique,
  legendary,
};

export function normalizeVisualRarity(rarity: PlayerCardData["rarity"]): "common" | "rare" | "unique" | "legendary" {
  if (rarity === "epic") return "unique";
  if (rarity === "rare" || rarity === "unique" || rarity === "legendary") return rarity;
  return "common";
}

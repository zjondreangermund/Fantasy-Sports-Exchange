import { normalizeVisualRarity } from "@/components/cards/cardVisualTokens";
import { type PlayerCardData } from "./types";

export type CardVisualToken = {
  rarityLabel: string;
  shell: string;
  frameOuter: string;
  frameInner: string;
  innerGlow: string;
  bevel: string;
  glow: string;
  pattern: string;
  badge: string;
  leagueBadge: string;
  serialBadge: string;
  orb: string;
  statChip: string;
};

const common: CardVisualToken = {
  rarityLabel: "COMMON",
  shell: "from-[#111827] via-[#0b1220] to-[#050912]",
  frameOuter: "from-[#a7b1c2] via-[#6b7280] to-[#3f4b5f]",
  frameInner: "from-[#1f2937] via-[#111827] to-[#0b1220]",
  innerGlow: "shadow-[inset_0_0_26px_rgba(203,213,225,0.16)]",
  bevel: "shadow-[inset_0_2px_0_rgba(255,255,255,0.38),inset_0_-3px_8px_rgba(0,0,0,0.55)]",
  glow: "shadow-[0_14px_42px_rgba(45,212,191,0.18)]",
  pattern: "bg-[radial-gradient(circle_at_18%_14%,rgba(148,163,184,0.16),transparent_46%),repeating-radial-gradient(circle_at_0_0,rgba(226,232,240,0.05)_0_1px,transparent_1px_4px)]",
  badge: "bg-emerald-300/14 border-emerald-200/35 text-emerald-100",
  leagueBadge: "bg-slate-700/50 border-slate-200/20 text-slate-100/90",
  serialBadge: "bg-slate-800/70 border-slate-200/25 text-slate-100/95",
  orb: "bg-emerald-200",
  statChip: "bg-emerald-500/20 border-emerald-200/35 text-emerald-50",
};

const rare: CardVisualToken = {
  rarityLabel: "RARE",
  shell: "from-[#081935] via-[#0b1f43] to-[#071326]",
  frameOuter: "from-[#7dd3fc] via-[#2563eb] to-[#1e3a8a]",
  frameInner: "from-[#0e223f] via-[#0c1d33] to-[#081426]",
  innerGlow: "shadow-[inset_0_0_28px_rgba(56,189,248,0.2)]",
  bevel: "shadow-[inset_0_2px_0_rgba(255,255,255,0.44),inset_0_-4px_10px_rgba(2,6,23,0.62)]",
  glow: "shadow-[0_14px_44px_rgba(59,130,246,0.4)]",
  pattern: "bg-[radial-gradient(circle_at_78%_12%,rgba(125,211,252,0.24),transparent_42%),repeating-linear-gradient(52deg,rgba(56,189,248,0.09)_0_2px,transparent_2px_10px),linear-gradient(135deg,rgba(148,197,255,0.14),transparent_52%)]",
  badge: "bg-sky-400/20 border-sky-200/40 text-sky-50",
  leagueBadge: "bg-blue-700/45 border-sky-100/30 text-sky-50",
  serialBadge: "bg-blue-950/70 border-sky-100/35 text-sky-50",
  orb: "bg-sky-200",
  statChip: "bg-sky-500/24 border-sky-200/45 text-sky-50",
};

const unique: CardVisualToken = {
  rarityLabel: "UNIQUE",
  shell: "from-[#200826] via-[#2b0d3d] to-[#120719]",
  frameOuter: "from-[#f472b6] via-[#a855f7] to-[#6d28d9]",
  frameInner: "from-[#2e0f45] via-[#210a34] to-[#13081f]",
  innerGlow: "shadow-[inset_0_0_28px_rgba(217,70,239,0.24)]",
  bevel: "shadow-[inset_0_2px_0_rgba(255,255,255,0.42),inset_0_-4px_10px_rgba(0,0,0,0.58)]",
  glow: "shadow-[0_16px_48px_rgba(217,70,239,0.42)]",
  pattern: "bg-[radial-gradient(circle_at_80%_16%,rgba(244,114,182,0.3),transparent_42%),radial-gradient(circle_at_20%_80%,rgba(168,85,247,0.24),transparent_50%),repeating-radial-gradient(circle_at_50%_30%,rgba(233,213,255,0.06)_0_2px,transparent_2px_10px)]",
  badge: "bg-fuchsia-400/24 border-fuchsia-200/42 text-fuchsia-50",
  leagueBadge: "bg-fuchsia-700/40 border-fuchsia-100/30 text-fuchsia-50",
  serialBadge: "bg-violet-950/68 border-fuchsia-100/35 text-fuchsia-50",
  orb: "bg-fuchsia-200",
  statChip: "bg-fuchsia-500/24 border-fuchsia-200/42 text-fuchsia-50",
};

const legendary: CardVisualToken = {
  rarityLabel: "LEGENDARY",
  shell: "from-[#2b1700] via-[#3b2304] to-[#1a0f00]",
  frameOuter: "from-[#fde68a] via-[#f59e0b] to-[#b45309]",
  frameInner: "from-[#382107] via-[#261505] to-[#170d03]",
  innerGlow: "shadow-[inset_0_0_34px_rgba(252,211,77,0.26)]",
  bevel: "shadow-[inset_0_2px_0_rgba(255,255,255,0.5),inset_0_-4px_10px_rgba(0,0,0,0.58)]",
  glow: "shadow-[0_18px_52px_rgba(245,158,11,0.5)]",
  pattern: "bg-[radial-gradient(circle_at_75%_14%,rgba(253,224,71,0.32),transparent_40%),radial-gradient(circle_at_30%_70%,rgba(251,191,36,0.24),transparent_48%),repeating-linear-gradient(0deg,rgba(251,191,36,0.09)_0_1px,transparent_1px_14px),repeating-linear-gradient(90deg,rgba(251,191,36,0.06)_0_1px,transparent_1px_14px)]",
  badge: "bg-amber-300/24 border-amber-100/50 text-amber-50",
  leagueBadge: "bg-amber-700/44 border-amber-100/42 text-amber-50",
  serialBadge: "bg-amber-950/72 border-amber-100/45 text-amber-50",
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

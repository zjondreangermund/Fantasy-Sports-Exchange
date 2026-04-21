import type { PlayerCardData } from "./types";

export type VisualRarity = "common" | "rare" | "unique" | "legendary";

export type CardVisualTokenSet = {
  rarityLabel: string;
  frameOuter: string;
  frameInner: string;
  shell: string;
  innerGlow: string;
  bevel: string;
  pattern: string;
  glow: string;
  badge: string;
  serialBadge: string;
  leagueBadge: string;
  statChip: string;
};

export function normalizeVisualRarity(
  rarity: PlayerCardData["rarity"],
): VisualRarity {
  switch (String(rarity || "").toLowerCase()) {
    case "rare":
      return "rare";
    case "unique":
    case "epic":
      return "unique";
    case "legendary":
      return "legendary";
    default:
      return "common";
  }
}

export const cardVisualTokens: Record<VisualRarity, CardVisualTokenSet> = {
  common: {
    rarityLabel: "Common",
    frameOuter: "from-slate-300 via-zinc-200 to-slate-500",
    frameInner: "from-slate-100/70 via-zinc-100/40 to-slate-400/35",
    shell: "from-slate-900 via-zinc-900 to-slate-950",
    innerGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
    bevel: "shadow-[inset_0_-12px_24px_rgba(0,0,0,0.35)]",
    pattern:
      "bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.10),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.04)_0,transparent_35%,rgba(255,255,255,0.03)_65%,transparent_100%)]",
    glow: "shadow-[0_0_26px_rgba(255,255,255,0.12)]",
    badge: "border-white/20 bg-white/10 text-white/90",
    serialBadge: "border-white/15 bg-black/25 text-white/80",
    leagueBadge: "border-white/15 bg-white/8 text-white/85",
    statChip: "border-white/15 bg-white/8 text-white/85",
  },

  rare: {
    rarityLabel: "Rare",
    frameOuter: "from-sky-400 via-blue-500 to-indigo-700",
    frameInner: "from-sky-200/45 via-blue-300/25 to-indigo-500/25",
    shell: "from-slate-950 via-blue-950 to-indigo-950",
    innerGlow: "shadow-[inset_0_1px_0_rgba(191,219,254,0.22)]",
    bevel: "shadow-[inset_0_-14px_28px_rgba(3,7,18,0.45)]",
    pattern:
      "bg-[radial-gradient(circle_at_50%_15%,rgba(147,197,253,0.14),transparent_38%),linear-gradient(135deg,rgba(96,165,250,0.06)_0,transparent_35%,rgba(129,140,248,0.05)_65%,transparent_100%)]",
    glow: "shadow-[0_0_30px_rgba(59,130,246,0.20)]",
    badge: "border-sky-200/25 bg-sky-300/10 text-sky-100",
    serialBadge: "border-sky-200/20 bg-slate-950/35 text-sky-100/85",
    leagueBadge: "border-sky-200/18 bg-sky-300/8 text-sky-100/85",
    statChip: "border-sky-200/18 bg-sky-300/8 text-sky-100/85",
  },

  unique: {
    rarityLabel: "Unique",
    frameOuter: "from-fuchsia-400 via-violet-500 to-purple-800",
    frameInner: "from-fuchsia-200/45 via-violet-300/25 to-purple-500/25",
    shell: "from-slate-950 via-purple-950 to-fuchsia-950",
    innerGlow: "shadow-[inset_0_1px_0_rgba(233,213,255,0.22)]",
    bevel: "shadow-[inset_0_-14px_28px_rgba(17,0,32,0.48)]",
    pattern:
      "bg-[radial-gradient(circle_at_50%_15%,rgba(216,180,254,0.14),transparent_38%),linear-gradient(135deg,rgba(232,121,249,0.06)_0,transparent_35%,rgba(167,139,250,0.05)_65%,transparent_100%)]",
    glow: "shadow-[0_0_34px_rgba(217,70,239,0.22)]",
    badge: "border-fuchsia-200/25 bg-fuchsia-300/10 text-fuchsia-50",
    serialBadge: "border-fuchsia-200/18 bg-slate-950/35 text-fuchsia-50/85",
    leagueBadge: "border-fuchsia-200/18 bg-fuchsia-300/8 text-fuchsia-50/85",
    statChip: "border-fuchsia-200/18 bg-fuchsia-300/8 text-fuchsia-50/85",
  },

  legendary: {
    rarityLabel: "Legendary",
    frameOuter: "from-amber-200 via-yellow-400 to-orange-600",
    frameInner: "from-yellow-100/55 via-amber-200/25 to-orange-400/25",
    shell: "from-stone-950 via-amber-950 to-orange-950",
    innerGlow: "shadow-[inset_0_1px_0_rgba(254,240,138,0.24)]",
    bevel: "shadow-[inset_0_-14px_28px_rgba(35,20,0,0.52)]",
    pattern:
      "bg-[radial-gradient(circle_at_50%_15%,rgba(253,224,71,0.14),transparent_38%),linear-gradient(135deg,rgba(251,191,36,0.07)_0,transparent_35%,rgba(251,146,60,0.05)_65%,transparent_100%)]",
    glow: "shadow-[0_0_36px_rgba(245,158,11,0.24)]",
    badge: "border-yellow-100/30 bg-amber-300/12 text-yellow-50",
    serialBadge: "border-yellow-100/20 bg-stone-950/35 text-yellow-50/85",
    leagueBadge: "border-yellow-100/20 bg-amber-300/8 text-yellow-50/85",
    statChip: "border-yellow-100/20 bg-amber-300/8 text-yellow-50/85",
  },
};
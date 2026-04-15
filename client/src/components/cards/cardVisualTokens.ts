import { type PlayerCardData } from "../Metal3DCard";

export type CardVisualToken = {
  shell: string;
  border: string;
  glow: string;
  badge: string;
  orb: string;
  wash: string;
  halo: string;
  frame: string;
  grain: string;
};

export const cardVisualTokens: Record<PlayerCardData["rarity"], CardVisualToken> = {
  common: {
    shell: "from-[#0c1420] via-[#08101a] to-[#03060c]",
    border: "border-white/15",
    glow: "shadow-[0_18px_45px_rgba(0,0,0,0.45)]",
    badge: "bg-white/10 border-white/20 text-white/90",
    orb: "bg-white",
    wash: "from-white/7 via-transparent to-transparent",
    halo: "bg-white/10",
    frame: "from-white/20 via-white/10 to-transparent",
    grain: "opacity-20",
  },
  rare: {
    shell: "from-[#0b1d44] via-[#081428] to-[#03060c]",
    border: "border-sky-300/60",
    glow: "shadow-[0_18px_55px_rgba(36,99,235,0.45)]",
    badge: "bg-sky-400/18 border-sky-200/40 text-white",
    orb: "bg-sky-200",
    wash: "from-sky-300/32 via-blue-300/12 to-transparent",
    halo: "bg-sky-300/30",
    frame: "from-sky-200/30 via-sky-300/15 to-transparent",
    grain: "opacity-25",
  },
  unique: {
    shell: "from-[#34104b] via-[#170d2d] to-[#03060c]",
    border: "border-fuchsia-300/55",
    glow: "shadow-[0_18px_55px_rgba(168,85,247,0.48)]",
    badge: "bg-fuchsia-400/18 border-fuchsia-200/40 text-white",
    orb: "bg-fuchsia-200",
    wash: "from-fuchsia-300/34 via-purple-300/14 to-transparent",
    halo: "bg-fuchsia-300/30",
    frame: "from-fuchsia-200/28 via-purple-300/16 to-transparent",
    grain: "opacity-30",
  },
  epic: {
    shell: "from-[#5b0f4a] via-[#2c0c2d] to-[#03060c]",
    border: "border-pink-300/58",
    glow: "shadow-[0_18px_58px_rgba(236,72,153,0.50)]",
    badge: "bg-pink-400/18 border-pink-200/40 text-white",
    orb: "bg-pink-200",
    wash: "from-pink-300/36 via-fuchsia-300/14 to-transparent",
    halo: "bg-pink-300/32",
    frame: "from-pink-200/30 via-fuchsia-300/18 to-transparent",
    grain: "opacity-30",
  },
  legendary: {
    shell: "from-[#5d3b00] via-[#2b1800] to-[#03060c]",
    border: "border-amber-200/75",
    glow: "shadow-[0_20px_60px_rgba(245,158,11,0.55)]",
    badge: "bg-amber-300/18 border-amber-100/45 text-white",
    orb: "bg-amber-200",
    wash: "from-amber-200/40 via-yellow-300/16 to-transparent",
    halo: "bg-amber-200/36",
    frame: "from-amber-100/35 via-amber-300/20 to-transparent",
    grain: "opacity-35",
  },
};

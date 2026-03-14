import React from "react";

export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerCardData = {
  id: string;
  name: string;
  rating: number;
  position: string;
  club?: string;
  image?: string;
  rarity: Rarity;
  serial?: number;
  maxSupply?: number;
  form?: number;
};

type FantasyCardProps = {
  player: PlayerCardData;
  className?: string;
};

const frameMap: Record<Rarity, string> = {
  common: "/frames/common.svg",
  rare: "/frames/rare.svg",
  unique: "/frames/unique.svg",
  epic: "/frames/epic.svg",
  legendary: "/frames/legendary.svg",
};

const rarityMeta: Record<
  Rarity,
  {
    label: string;
    textureClass: string;
    spotlightClass: string;
    accent: string;
    accentSoft: string;
    baseTop: string;
    baseMid: string;
    baseBottom: string;
    rarityBadgeClass: string;
  }
> = {
  common: {
    label: "Common",
    textureClass: "luxury-texture-common",
    spotlightClass: "luxury-spotlight-common",
    accent: "#c7ced8",
    accentSoft: "rgba(199,206,216,0.30)",
    baseTop: "#171c23",
    baseMid: "#232a34",
    baseBottom: "#2b313a",
    rarityBadgeClass: "border-[#c7ced8]/45 bg-[#c7ced8]/10 text-[#e4e9ef]",
  },
  rare: {
    label: "Rare",
    textureClass: "luxury-texture-rare",
    spotlightClass: "luxury-spotlight-rare",
    accent: "#77b8ff",
    accentSoft: "rgba(119,184,255,0.34)",
    baseTop: "#091127",
    baseMid: "#102650",
    baseBottom: "#0d1b3d",
    rarityBadgeClass: "border-[#77b8ff]/45 bg-[#2f6bff]/22 text-[#c7e4ff]",
  },
  epic: {
    label: "Epic",
    textureClass: "luxury-texture-epic",
    spotlightClass: "luxury-spotlight-epic",
    accent: "#d14dff",
    accentSoft: "rgba(209,77,255,0.34)",
    baseTop: "#120a1f",
    baseMid: "#2a1246",
    baseBottom: "#1a0d2e",
    rarityBadgeClass: "border-[#d14dff]/50 bg-[#7a3cff]/25 text-[#f0ccff]",
  },
  legendary: {
    label: "Legendary",
    textureClass: "luxury-texture-legendary",
    spotlightClass: "luxury-spotlight-legendary",
    accent: "#ffd978",
    accentSoft: "rgba(255,217,120,0.36)",
    baseTop: "#211604",
    baseMid: "#3c2a09",
    baseBottom: "#4a3510",
    rarityBadgeClass: "border-[#ffd978]/55 bg-[#f2c14e]/22 text-[#ffe9b5]",
  },
  unique: {
    label: "Mythic",
    textureClass: "luxury-texture-unique",
    spotlightClass: "luxury-spotlight-unique",
    accent: "#7cf7ff",
    accentSoft: "rgba(124,247,255,0.34)",
    baseTop: "#05060a",
    baseMid: "#0d1016",
    baseBottom: "#11131a",
    rarityBadgeClass: "border-[#7cf7ff]/55 bg-[#7cf7ff]/14 text-[#dffcff]",
  },
};

const rarityEdgeClass: Record<Rarity, string> = {
  common: "luxury-edge-common",
  rare: "luxury-edge-rare",
  epic: "luxury-edge-epic",
  legendary: "luxury-edge-legendary",
  unique: "luxury-edge-unique",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeStats(player: PlayerCardData) {
  const rating = clamp(Number(player.rating) || 70, 45, 99);
  const form = clamp(Number(player.form) || 72, 40, 99);
  const pos = String(player.position || "").toUpperCase();

  const atkBias = pos.includes("ST") || pos.includes("FW") ? 8 : pos.includes("MID") ? 4 : -2;
  const defBias = pos.includes("GK") || pos.includes("DEF") ? 9 : pos.includes("MID") ? 3 : -4;

  return [
    { key: "ATK", value: clamp(rating + atkBias, 40, 99) },
    { key: "VIS", value: clamp(Math.round(rating * 0.9 + form * 0.12), 38, 99) },
    { key: "CTL", value: clamp(Math.round(rating * 0.94 + 2), 38, 99) },
    { key: "DEF", value: clamp(rating + defBias, 35, 99) },
    { key: "ENG", value: clamp(Math.round(form * 0.92 + 8), 40, 99) },
    { key: "FRM", value: form },
  ];
}

export default function FantasyCard({ player, className }: FantasyCardProps) {
  const rarity = player.rarity;
  const meta = rarityMeta[rarity];
  const stats = computeStats(player);

  return (
    <div
      className={[
        "group relative isolate aspect-[2.5/3.5] w-[260px] overflow-visible transition duration-300 hover:-translate-y-1",
        className || "",
      ].join(" ")}
      style={{
        ["--card-accent" as string]: meta.accent,
        ["--card-accent-soft" as string]: meta.accentSoft,
      }}
    >
      <div
        className={[
          "luxury-card-shell absolute inset-0 overflow-hidden rounded-[24px]",
          rarityEdgeClass[rarity],
        ].join(" ")}
        style={{
          background: `linear-gradient(180deg, ${meta.baseTop} 0%, ${meta.baseMid} 56%, ${meta.baseBottom} 100%)`,
        }}
      >
        <div className={["pointer-events-none absolute inset-0 z-[1] opacity-[0.92]", meta.textureClass].join(" ")} />

        <div className={["pointer-events-none absolute inset-x-[7%] top-[17%] z-[2] h-[42%] rounded-[999px] blur-3xl", meta.spotlightClass].join(" ")} />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-20 bg-gradient-to-b from-white/10 via-white/[0.02] to-transparent" />

        <div className="absolute inset-x-[3.8%] top-[15.5%] bottom-[30%] z-[3] overflow-hidden rounded-[18px]">
          {player.image ? (
            <img
              src={player.image}
              alt={player.name}
              className="h-full w-full object-cover object-[50%_15%] saturate-[1.06] contrast-[1.08] brightness-[0.96] transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-white/10 to-transparent" />
          )}

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.15),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0)_40%,rgba(0,0,0,0.62)_100%)]" />
        </div>

        <img
          src={frameMap[rarity]}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-[1.2%] z-[6] h-[97.6%] w-[97.6%] object-cover opacity-55"
        />

        <div className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between">
          <div>
            <p className="font-[Outfit] text-[42px] font-extrabold leading-none tracking-tight text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]">{player.rating}</p>
            <p className="mt-0.5 font-[Inter] text-[10px] font-semibold uppercase tracking-[0.24em] text-white/72">OVR</p>
          </div>

          <div className="text-right">
            <p className="font-[Outfit] text-[17px] font-black uppercase tracking-[0.11em] text-white">{player.position}</p>
            <span className={["mt-1 inline-flex rounded-full border px-2 py-0.5 font-[Inter] text-[9px] font-semibold uppercase tracking-[0.16em]", meta.rarityBadgeClass].join(" ")}>
              {meta.label}
            </span>
          </div>
        </div>

        <div className="absolute inset-x-3.5 bottom-3.5 z-20 rounded-[16px] border border-white/14 bg-black/35 px-3.5 pb-2.5 pt-2.5 backdrop-blur-md shadow-[0_12px_28px_rgba(0,0,0,0.42)]">
          <p className="truncate text-center font-[Outfit] text-[20px] font-extrabold uppercase leading-tight tracking-[0.02em] text-white">{player.name}</p>
          <p className="mt-0.5 truncate text-center font-[Inter] text-[10px] font-medium uppercase tracking-[0.15em] text-white/66">{player.club || "FantasyFC"} • EPL</p>

          <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
            {stats.map((stat) => (
              <div key={stat.key} className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-1 text-center">
                <div className="font-[Inter] text-[8px] font-semibold uppercase tracking-[0.15em] text-white/58">{stat.key}</div>
                <div className="font-[Outfit] text-[13px] font-bold leading-tight text-white">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 flex items-center justify-between font-[Inter] text-[9px] font-semibold uppercase tracking-[0.14em] text-white/62">
            <span>S26</span>
            <span>
              #{String(player.serial || 1).padStart(3, "0")} / {player.maxSupply || 500}
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-[13px] bg-gradient-to-b from-white/[0.10] via-white/[0.03] to-transparent" />

        <div className="pointer-events-none absolute inset-0 z-[11] opacity-0 transition duration-500 group-hover:opacity-100">
          <div className="luxury-shine absolute inset-[-22%]" />
        </div>

        <div className="pointer-events-none absolute inset-0 z-[9] rounded-[24px] border border-white/12" />
      </div>
    </div>
  );
}

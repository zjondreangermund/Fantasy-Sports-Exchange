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

const rarityShell: Record<Rarity, string> = {
  common: "rounded-[22px] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
  rare: "border-2 border-[#45a2ff]/90 shadow-[0_0_24px_rgba(69,162,255,0.28),0_18px_42px_rgba(0,0,0,0.42)] [clip-path:polygon(24%_0%,76%_0%,100%_18%,100%_82%,76%_100%,24%_100%,0%_82%,0%_18%)]",
  unique: "border-2 border-[#b154ff]/90 shadow-[0_0_28px_rgba(177,84,255,0.28),0_18px_42px_rgba(0,0,0,0.42)] [clip-path:polygon(50%_0%,92%_14%,92%_70%,50%_100%,8%_70%,8%_14%)]",
  epic: "border-2 border-[#ffc246]/95 shadow-[0_0_30px_rgba(255,194,70,0.30),0_18px_46px_rgba(0,0,0,0.46)] [clip-path:polygon(50%_0%,94%_16%,84%_100%,16%_100%,6%_16%)]",
  legendary: "border-2 border-[#ff9123]/95 shadow-[0_0_36px_rgba(255,145,35,0.34),0_18px_52px_rgba(0,0,0,0.48)] [clip-path:polygon(10%_10%,20%_0%,34%_10%,50%_0%,66%_10%,80%_0%,90%_10%,100%_24%,100%_100%,0%_100%,0%_24%)]",
};

const rarityInner: Record<Rarity, string> = {
  common: "rounded-[20px]",
  rare: "[clip-path:polygon(24.5%_1%,75.5%_1%,99%_18.5%,99%_81.5%,75.5%_99%,24.5%_99%,1%_81.5%,1%_18.5%)]",
  unique: "[clip-path:polygon(50%_1.5%,90.5%_15%,90.5%_69.5%,50%_98.5%,9.5%_69.5%,9.5%_15%)]",
  epic: "[clip-path:polygon(50%_1%,92.5%_16.5%,82.8%_98.5%,17.2%_98.5%,7.5%_16.5%)]",
  legendary: "[clip-path:polygon(10.5%_11%,20.2%_1.8%,34%_11%,50%_1.8%,66%_11%,79.8%_1.8%,89.5%_11%,98.5%_24.5%,98.5%_98.5%,1.5%_98.5%,1.5%_24.5%)]",
};

const rarityGlow: Record<Rarity, string> = {
  common: "shadow-[inset_0_0_40px_rgba(255,255,255,0.10)]",
  rare: "shadow-[inset_0_0_40px_rgba(69,162,255,0.35)]",
  unique: "shadow-[inset_0_0_40px_rgba(177,84,255,0.35)]",
  epic: "shadow-[inset_0_0_40px_rgba(255,194,70,0.38)]",
  legendary: "shadow-[inset_0_0_48px_rgba(255,145,35,0.50)]",
};

const rarityAccent: Record<Rarity, string> = {
  common: "from-white/10 via-white/5 to-transparent",
  rare: "from-[#45a2ff]/20 via-[#45a2ff]/5 to-transparent",
  unique: "from-[#b154ff]/20 via-[#b154ff]/5 to-transparent",
  epic: "from-[#ffc246]/20 via-[#ffc246]/5 to-transparent",
  legendary: "from-[#ff9123]/25 via-[#ff9123]/5 to-transparent",
};

export default function FantasyCard({ player, className }: FantasyCardProps) {
  const rarity = player.rarity;
  return (
    <div
      className={[
        "group card-shell relative isolate aspect-[0.7] w-[240px] overflow-hidden bg-[linear-gradient(180deg,rgba(12,14,20,0.98),rgba(2,3,6,1))] transition duration-200 hover:-translate-y-1",
        rarityShell[player.rarity],
        `card-aura-${rarity}`,
        className || "",
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-[2px] overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.10),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.28))]",
          rarityInner[player.rarity],
        ].join(" ")}
      >
        <div className={["pointer-events-none absolute inset-0 z-[3]", rarityGlow[player.rarity]].join(" ")} />

        <div className={["pointer-events-none absolute inset-x-0 top-0 z-[2] h-28 bg-gradient-to-b", rarityAccent[player.rarity]].join(" ")} />

        <div className="pointer-events-none absolute inset-x-[12%] top-[14%] z-[2] h-[52%] rounded-[999px] bg-white/12 blur-3xl" />

        <img src={frameMap[rarity]} alt="" aria-hidden className="card-frame pointer-events-none absolute inset-0 z-[8] h-full w-full object-cover" />

        <div className="card-player absolute inset-x-[3%] top-[15%] bottom-[24%] z-[1] overflow-hidden">
          {player.image ? (
            <img
              src={player.image}
              alt={player.name}
              className="h-full w-full object-cover object-[50%_18%] saturate-[1.08] contrast-[1.12] brightness-[0.95]"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-white/10 to-transparent" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/45" />
        </div>

        <div className="pointer-events-none absolute inset-0 z-[9] opacity-0 transition duration-500 group-hover:opacity-100">
          <div className="absolute inset-[-20%] -translate-x-[120%] rotate-[8deg] bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,0)_35%,rgba(255,255,255,0.18)_48%,rgba(255,255,255,0)_60%,transparent_75%)] group-hover:animate-[shineSweep_1.1s_ease]" />
        </div>

        <div className="absolute left-4 top-4 z-10">
          <p className="text-[38px] font-black leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">{player.rating}</p>
          <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.22em] text-white/80">{player.position}</p>
        </div>

        <div className="absolute inset-x-4 bottom-4 z-10">
          <div className="text-center text-[10px] uppercase tracking-[0.24em] text-white/55">{player.rarity}</div>
          <div className="mt-1 text-center text-[20px] font-black uppercase leading-tight text-white truncate">{player.name}</div>
          <div className="mt-1 text-center text-[11px] uppercase tracking-[0.2em] text-white/55">{player.club || "FantasyFC"}</div>

          <div className="mt-2 flex items-center justify-center gap-1.5">
            <span className="rounded-md border border-white/20 bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white/90">
              #{player.serial || 1}/{player.maxSupply || 100}
            </span>
            <span className="rounded-md border border-white/20 bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white/90">
              FORM {Number(player.form || 0)}
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[7] h-44 bg-gradient-to-t from-black via-black/70 to-transparent" />
      </div>
    </div>
  );
}

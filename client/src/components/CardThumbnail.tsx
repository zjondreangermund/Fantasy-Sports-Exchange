import { memo } from "react";
import { Shield } from "lucide-react";
import CardPlayerImage from "./CardPlayerImage";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

type CardThumbnailProps = {
  card: PlayerCardWithPlayer;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
};

const rarityShell: Record<string, string> = {
  common: "rounded-[22px] border border-[#7a7c80]/45 shadow-[0_10px_30px_rgba(0,0,0,0.42)]",
  rare: "border-2 border-[#E2E8F0]/90 shadow-[0_0_24px_rgba(0,71,171,0.32),0_18px_42px_rgba(0,0,0,0.42)] [clip-path:polygon(24%_0%,76%_0%,100%_18%,100%_82%,76%_100%,24%_100%,0%_82%,0%_18%)]",
  unique: "border-2 border-[#FF007F]/85 shadow-[0_0_24px_rgba(183,110,121,0.3),0_18px_42px_rgba(0,0,0,0.42)] [clip-path:polygon(50%_0%,92%_14%,92%_70%,50%_100%,8%_70%,8%_14%)]",
  epic: "border-2 border-[#d14dff]/95 shadow-[0_0_30px_rgba(209,77,255,0.30),0_18px_46px_rgba(0,0,0,0.46)] [clip-path:polygon(50%_0%,94%_16%,84%_100%,16%_100%,6%_16%)]",
  legendary: "border-2 border-[#FFD700]/95 shadow-[0_0_36px_rgba(255,215,0,0.34),0_18px_52px_rgba(0,0,0,0.48)] [clip-path:polygon(10%_10%,20%_0%,34%_10%,50%_0%,66%_10%,80%_0%,90%_10%,100%_24%,100%_100%,0%_100%,0%_24%)]",
};

const rarityInner: Record<string, string> = {
  common: "rounded-[20px]",
  rare: "[clip-path:polygon(24.5%_1%,75.5%_1%,99%_18.5%,99%_81.5%,75.5%_99%,24.5%_99%,1%_81.5%,1%_18.5%)]",
  unique: "[clip-path:polygon(50%_1.5%,90.5%_15%,90.5%_69.5%,50%_98.5%,9.5%_69.5%,9.5%_15%)]",
  epic: "[clip-path:polygon(50%_1%,92.5%_16.5%,82.8%_98.5%,17.2%_98.5%,7.5%_16.5%)]",
  legendary: "[clip-path:polygon(10.5%_11%,20.2%_1.8%,34%_11%,50%_1.8%,66%_11%,79.8%_1.8%,89.5%_11%,98.5%_24.5%,98.5%_98.5%,1.5%_98.5%,1.5%_24.5%)]",
};

const rarityGlow: Record<string, string> = {
  common: "shadow-[inset_0_0_40px_rgba(255,255,255,0.10)]",
  rare: "shadow-[inset_0_0_40px_rgba(0,71,171,0.35)]",
  unique: "shadow-[inset_0_0_40px_rgba(183,110,121,0.34)]",
  epic: "shadow-[inset_0_0_40px_rgba(255,194,70,0.38)]",
  legendary: "shadow-[inset_0_0_48px_rgba(255,215,0,0.50)]",
};

const rarityAccent: Record<string, string> = {
  common: "from-white/10 via-white/5 to-transparent",
  rare: "from-[#0047AB]/24 via-[#0047AB]/8 to-transparent",
  unique: "from-[#B76E79]/24 via-[#B76E79]/8 to-transparent",
  epic: "from-[#ffc246]/20 via-[#ffc246]/5 to-transparent",
  legendary: "from-[#FFD700]/25 via-[#FFD700]/5 to-transparent",
};

const rarityChip: Record<string, string> = {
  common: "bg-[#7A7C80]/20 border-[#7A7C80]/35 text-[#d8dadd]",
  rare: "bg-[#0047AB]/28 border-[#E2E8F0]/42 text-[#eaf3ff]",
  unique: "bg-[#FF007F]/16 border-[#FF007F]/38 text-[#ffd8ec]",
  epic: "bg-[#ffc246]/20 border-[#ffc246]/45 text-[#fff3d6]",
  legendary: "bg-[#FFD700]/25 border-[#FFD700]/50 text-[#fff6bf]",
};

const rarityTone: Record<string, string> = {
  common: "card-rarity-common",
  rare: "card-rarity-rare",
  unique: "card-rarity-unique",
  epic: "card-rarity-epic",
  legendary: "card-rarity-legendary",
};

const raritySurface: Record<string, string> = {
  common: "card-surface-common",
  rare: "card-surface-rare",
  unique: "card-surface-unique",
  epic: "card-surface-epic",
  legendary: "card-surface-legendary",
};

const rarityPortrait: Record<string, string> = {
  common: "portrait-common",
  rare: "portrait-rare",
  unique: "portrait-unique",
  epic: "portrait-epic",
  legendary: "portrait-legendary",
};

const rarityOverlayFx: Record<string, string> = {
  common: "",
  rare: "",
  unique: "",
  epic: "",
  legendary: "thumb-holo-legendary",
};

const rarityMotion: Record<string, string> = {
  common: "card-motion-common",
  rare: "card-motion-rare",
  unique: "card-motion-unique",
  epic: "card-motion-epic",
  legendary: "card-motion-legendary",
};

const rarityShine: Record<string, string> = {
  common: "card-shine-common",
  rare: "card-shine-rare",
  unique: "card-shine-unique",
  epic: "card-shine-epic",
  legendary: "card-shine-legendary",
};

const raritySelectedRing: Record<string, string> = {
  common: "ring-white/25",
  rare: "ring-[#45a2ff]/45",
  unique: "ring-[#b154ff]/45",
  epic: "ring-[#ffc246]/45",
  legendary: "ring-[#ff9123]/50",
};

function CardThumbnailBase({
  card,
  size = "md",
  selected = false,
  selectable = false,
  onClick,
  showPrice = false,
}: CardThumbnailProps) {
  const rarity = String(card.rarity || "common").toLowerCase();
  const shell = rarityShell[rarity] || rarityShell.common;
  const inner = rarityInner[rarity] || rarityInner.common;
  const glow = rarityGlow[rarity] || rarityGlow.common;
  const accent = rarityAccent[rarity] || rarityAccent.common;
  const chip = rarityChip[rarity] || rarityChip.common;
  const tone = rarityTone[rarity] || rarityTone.common;
  const surface = raritySurface[rarity] || raritySurface.common;
  const portrait = rarityPortrait[rarity] || rarityPortrait.common;
  const overlayFx = rarityOverlayFx[rarity] || "";
  const motion = rarityMotion[rarity] || rarityMotion.common;
  const shine = rarityShine[rarity] || rarityShine.common;
  const selectedRing = raritySelectedRing[rarity] || raritySelectedRing.common;
  const player = card.player || ({} as any);

  const frame =
    size === "sm"
      ? "w-[168px]"
      : size === "lg"
        ? "w-[240px]"
        : "w-[208px]";

  const title = (player?.name || "Unknown Player").toUpperCase();
  const subtitle = `${String(player?.position || "N/A").toUpperCase()}${player?.team ? ` • ${String(player.team).toUpperCase()}` : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group card-thumbnail-shell relative isolate aspect-[0.7] ${frame} overflow-hidden text-left transition duration-200 hover:-translate-y-1 ${shell} ${tone} ${motion} ${
        selectable ? "cursor-pointer" : "cursor-default"
      } ${selected ? `ring-2 ${selectedRing}` : ""}`}
      data-testid={`card-thumbnail-${card.id}`}
    >
      <div className={`absolute inset-[2px] overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.10),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.28))] ${inner}`}>
        <div className={`pointer-events-none absolute inset-0 z-[1] ${surface}`} />
        <div className={`pointer-events-none absolute inset-0 z-[3] ${glow}`} />

        <div className={`pointer-events-none absolute inset-x-0 top-0 z-[2] h-28 bg-gradient-to-b ${accent}`} />

        <div className="absolute inset-x-0 top-[16%] bottom-[23%] z-[1]">
          <CardPlayerImage card={card} alt={player?.name || "Player"} thumb className={`h-full w-full object-cover object-top ${portrait}`} />
        </div>

        <div className="absolute left-2 right-2 top-2 z-10 flex items-center justify-between">
          <span className={`rounded-md border px-2 py-1 text-[10px] font-extrabold tracking-[0.12em] ${chip}`}>
            {rarity.toUpperCase()}
          </span>
          <span className="rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white/90">
            {card.serialNumber || 1}/{card.maxSupply || 100}
          </span>
        </div>

        <div className="absolute inset-x-4 bottom-5 z-10">
          <p className="truncate text-center text-[11px] uppercase tracking-[0.22em] text-white/55">{rarity}</p>
          <p className="truncate mt-1 text-center text-[20px] font-black uppercase leading-none text-white">{title}</p>
          <p className="truncate mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{subtitle}</p>
          {showPrice && Number(card.price || 0) > 0 && (
            <p className="mt-2 text-center text-[11px] font-bold text-emerald-300">N${Number(card.price || 0).toFixed(2)}</p>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black via-black/55 to-transparent" />
        {overlayFx ? <div className={`pointer-events-none absolute inset-0 z-[4] ${overlayFx}`} /> : null}
      </div>

      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <div className={`absolute inset-[-20%] -translate-x-[120%] rotate-[8deg] bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,0)_35%,rgba(255,255,255,0.18)_48%,rgba(255,255,255,0)_60%,transparent_75%)] ${shine}`} />
      </div>

      {selected && (
        <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Shield className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

const CardThumbnail = memo(CardThumbnailBase);

export default CardThumbnail;

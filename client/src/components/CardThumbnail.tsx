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

const rarityTheme: Record<string, { edge: string; chip: string; glow: string; aura: string }> = {
  common: {
    edge: "from-slate-300/35 via-slate-100/15 to-transparent",
    chip: "bg-slate-200/20 border-slate-200/40 text-slate-100",
    glow: "shadow-[0_14px_28px_rgba(2,6,23,0.55),0_6px_18px_rgba(148,163,184,0.24)]",
    aura: "ring-slate-200/25",
  },
  rare: {
    edge: "from-rose-500/45 via-orange-300/20 to-transparent",
    chip: "bg-rose-500/25 border-rose-300/40 text-rose-100",
    glow: "shadow-[0_14px_28px_rgba(2,6,23,0.55),0_8px_20px_rgba(244,63,94,0.28)]",
    aura: "ring-rose-300/30",
  },
  unique: {
    edge: "from-violet-500/45 via-fuchsia-300/20 to-transparent",
    chip: "bg-violet-500/25 border-violet-300/40 text-violet-100",
    glow: "shadow-[0_14px_28px_rgba(2,6,23,0.55),0_8px_20px_rgba(139,92,246,0.28)]",
    aura: "ring-violet-300/30",
  },
  epic: {
    edge: "from-indigo-500/45 via-sky-300/20 to-transparent",
    chip: "bg-indigo-500/25 border-indigo-300/40 text-indigo-100",
    glow: "shadow-[0_14px_28px_rgba(2,6,23,0.55),0_8px_20px_rgba(99,102,241,0.28)]",
    aura: "ring-indigo-300/30",
  },
  legendary: {
    edge: "from-amber-500/55 via-yellow-300/25 to-transparent",
    chip: "bg-amber-500/25 border-amber-300/45 text-amber-100",
    glow: "shadow-[0_16px_30px_rgba(2,6,23,0.56),0_10px_24px_rgba(245,158,11,0.32)]",
    aura: "ring-amber-300/35",
  },
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
  const theme = rarityTheme[rarity] || rarityTheme.common;
  const player = card.player || ({} as any);

  const frame =
    size === "sm"
      ? "w-[140px] h-[210px]"
      : size === "lg"
        ? "w-[230px] h-[338px]"
        : "w-[184px] h-[270px]";

  const title = (player?.name || "Unknown Player").toUpperCase();
  const subtitle = `${String(player?.position || "N/A").toUpperCase()}${player?.team ? ` • ${String(player.team).toUpperCase()}` : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative ${frame} rounded-2xl overflow-hidden border border-white/14 bg-slate-950 text-left ${theme.glow} ${
        selectable ? "cursor-pointer" : "cursor-default"
      } ${selected ? `ring-2 ${theme.aura}` : ""}`}
      data-testid={`card-thumbnail-${card.id}`}
    >
      <CardPlayerImage card={card} alt={player?.name || "Player"} thumb className="h-full w-full object-cover object-[50%_20%] scale-[1.02]" />

      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/20 to-black/88" />

      <div className={`absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b ${theme.edge}`} />
      <div className={`pointer-events-none absolute inset-0 rounded-2xl ring-1 ${theme.aura}`} />

      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <div className="absolute -left-[48%] top-0 h-full w-[62%] -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[cardShine_2.4s_linear_infinite]" />
      </div>

      <div className="absolute left-2 right-2 top-2 flex items-center justify-between">
        <span className={`rounded-md border px-2 py-1 text-[10px] font-extrabold tracking-[0.12em] ${theme.chip}`}>
          {rarity.toUpperCase()}
        </span>
        <span className="rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white/90">
          {card.serialNumber || 1}/{card.maxSupply || 100}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="truncate text-[12px] font-black tracking-[0.08em] text-white">{title}</p>
        <p className="truncate text-[10px] font-semibold tracking-[0.1em] text-white/80">{subtitle}</p>
        {showPrice && Number(card.price || 0) > 0 && (
          <p className="mt-1 text-[11px] font-bold text-emerald-300">N${Number(card.price || 0).toFixed(2)}</p>
        )}
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

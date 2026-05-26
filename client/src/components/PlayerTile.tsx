import { memo, useMemo, useState } from "react";
import { Activity, Crown, Gem, Shield, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { type PlayerCardData } from "./cards/types";

type PlayerTileProps = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
};

const rarityStyles: Record<string, { ring: string; badge: string; glow: string; icon: typeof Shield }> = {
  common: {
    ring: "border-slate-600/70 bg-slate-900/70",
    badge: "bg-slate-100 text-slate-950",
    glow: "shadow-[0_0_24px_rgba(148,163,184,.12)]",
    icon: Shield,
  },
  rare: {
    ring: "border-cyan-400/55 bg-slate-950/80",
    badge: "bg-cyan-300 text-slate-950",
    glow: "shadow-[0_0_28px_rgba(34,211,238,.22)]",
    icon: Zap,
  },
  unique: {
    ring: "border-fuchsia-300/55 bg-slate-950/80",
    badge: "bg-fuchsia-300 text-slate-950",
    glow: "shadow-[0_0_32px_rgba(217,70,239,.24)]",
    icon: Gem,
  },
  epic: {
    ring: "border-violet-300/55 bg-slate-950/80",
    badge: "bg-violet-300 text-slate-950",
    glow: "shadow-[0_0_32px_rgba(139,92,246,.24)]",
    icon: Gem,
  },
  legendary: {
    ring: "border-amber-300/65 bg-black/85",
    badge: "bg-amber-300 text-black",
    glow: "shadow-[0_0_36px_rgba(251,191,36,.30)]",
    icon: Crown,
  },
};

function playerInitials(name: string) {
  return String(name || "Player")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getPoints(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.map((v) => Number(v || 0)).filter((v) => v > 0) : [];
  const last = scores.length ? scores[scores.length - 1] : Number(player.form || player.rating || 0);
  const total = Number(player.totalPoints || scores.reduce((sum, value) => sum + value, 0));
  const trend = scores.length > 1 ? (scores[scores.length - 1] >= scores[0] ? "up" : "down") : "neutral";
  return { last: Math.round(last), total: Math.round(total), trend };
}

function PlayerTileBase({ player, selected = false, onClick, showPrice = false, className = "" }: PlayerTileProps) {
  const [failed, setFailed] = useState(false);
  const rarity = String(player.rarity || "common").toLowerCase();
  const style = rarityStyles[rarity] || rarityStyles.common;
  const Icon = style.icon;
  const points = useMemo(() => getPoints(player), [player]);
  const TrendIcon = points.trend === "up" ? TrendingUp : points.trend === "down" ? TrendingDown : Activity;
  const image = player.image || player.imageUrl || player.photo || player.imageCandidates?.[0];
  const showImage = Boolean(image) && !failed;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative flex min-h-[178px] w-[142px] flex-col overflow-hidden rounded-2xl border p-2 text-left transition-all duration-200 hover:-translate-y-1 hover:scale-[1.025]",
        style.ring,
        style.glow,
        selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950" : "",
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      ].join(" ")}
      data-testid={`player-tile-${player.id}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.12),transparent_40%),linear-gradient(180deg,rgba(15,23,42,.05),rgba(0,0,0,.55))]" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 to-transparent" />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div>
          <p className="text-[24px] font-black leading-none text-white">{Number(player.rating || points.last || 0).toFixed(0)}</p>
          <p className="mt-0.5 text-[11px] font-black uppercase tracking-wide text-white/82">{player.position || "N/A"}</p>
        </div>
        <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-[7px] font-black uppercase tracking-[.16em] ${style.badge}`}>
          <Icon className="h-2.5 w-2.5" />
          {rarity.slice(0, 3)}
        </div>
      </div>

      <div className="relative z-10 mt-1 flex flex-1 items-end justify-center overflow-hidden rounded-xl bg-white/[0.04]">
        {showImage ? (
          <img
            src={image}
            alt={player.name}
            onError={() => setFailed(true)}
            className="absolute bottom-0 h-[118%] w-[115%] object-contain object-bottom drop-shadow-[0_16px_12px_rgba(0,0,0,.55)] transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-24 w-20 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-2xl font-black text-white/40">
            {playerInitials(player.name)}
          </div>
        )}
      </div>

      <div className="relative z-20 mt-2">
        <p className="truncate text-[12px] font-black uppercase tracking-wide text-white">{player.name}</p>
        <p className="truncate text-[9px] font-semibold uppercase tracking-[.14em] text-slate-400">{player.team || player.club || "Free Agent"}</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1">
            <p className="text-[8px] font-bold uppercase text-slate-500">Last</p>
            <p className="text-sm font-black text-white">{points.last}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1">
            <p className="flex items-center gap-1 text-[8px] font-bold uppercase text-slate-500">
              <TrendIcon className="h-2.5 w-2.5" /> Points
            </p>
            <p className="text-sm font-black text-white">{points.total}</p>
          </div>
        </div>
        {showPrice && Number(player.price || player.listedPrice || 0) > 0 ? (
          <p className="mt-2 rounded-lg bg-emerald-400/12 px-2 py-1 text-center text-[10px] font-black text-emerald-300">
            N${Number(player.price || player.listedPrice || 0).toFixed(2)}
          </p>
        ) : null}
      </div>
    </button>
  );
}

const PlayerTile = memo(PlayerTileBase);
export default PlayerTile;

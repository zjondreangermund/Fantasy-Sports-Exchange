import { memo, useMemo, useState } from "react";
import { Activity, CheckCircle2, Crown, Gem, Shield, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { type PlayerCardData } from "./cards/types";

type PlayerTileProps = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
};

const rarityStyles: Record<string, { border: string; badge: string; rating: string; accent: string; icon: typeof Shield }> = {
  common: {
    border: "border-slate-700/80",
    badge: "border-slate-500/40 bg-slate-500/10 text-slate-200",
    rating: "border-slate-500/40 bg-slate-700/70 text-white",
    accent: "from-slate-400/18 via-transparent to-transparent",
    icon: Shield,
  },
  rare: {
    border: "border-blue-400/45",
    badge: "border-blue-400/40 bg-blue-500/10 text-blue-300",
    rating: "border-blue-300/50 bg-blue-600/70 text-white",
    accent: "from-blue-400/24 via-transparent to-transparent",
    icon: Zap,
  },
  unique: {
    border: "border-fuchsia-300/45",
    badge: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300",
    rating: "border-fuchsia-300/50 bg-fuchsia-700/65 text-white",
    accent: "from-fuchsia-400/24 via-transparent to-transparent",
    icon: Gem,
  },
  epic: {
    border: "border-violet-300/45",
    badge: "border-violet-400/40 bg-violet-500/10 text-violet-300",
    rating: "border-violet-300/50 bg-violet-700/65 text-white",
    accent: "from-violet-400/24 via-transparent to-transparent",
    icon: Gem,
  },
  legendary: {
    border: "border-amber-300/55",
    badge: "border-amber-300/45 bg-amber-300/10 text-amber-300",
    rating: "border-amber-300/60 bg-amber-500/20 text-amber-100",
    accent: "from-amber-300/26 via-transparent to-transparent",
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
  return { last: Math.round(last * 10) / 10, total: Math.round(total * 10) / 10, trend };
}

function getLastFive(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.slice(0, 5).map((value) => Number(value || 0)) : [];
  while (scores.length < 5) scores.push(0);
  return scores;
}

function PlayerTileBase({ player, selected = false, onClick, showPrice = false, className = "" }: PlayerTileProps) {
  const [failed, setFailed] = useState(false);
  const rarity = String(player.rarity || "common").toLowerCase();
  const style = rarityStyles[rarity] || rarityStyles.common;
  const Icon = style.icon;
  const points = useMemo(() => getPoints(player), [player]);
  const lastFive = useMemo(() => getLastFive(player), [player]);
  const TrendIcon = points.trend === "up" ? TrendingUp : points.trend === "down" ? TrendingDown : Activity;
  const image = player.image || player.imageUrl || player.photo || player.imageCandidates?.[0];
  const showImage = Boolean(image) && !failed;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative flex h-[252px] w-[186px] flex-col overflow-hidden rounded-3xl border bg-[#08111f] p-3 text-left shadow-[0_18px_50px_rgba(0,0,0,.32)] transition-all duration-200 hover:-translate-y-1 hover:bg-[#0b1628]",
        style.border,
        selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950" : "",
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      ].join(" ")}
      data-testid={`player-tile-${player.id}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${style.accent}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.10),transparent_38%),linear-gradient(180deg,transparent_35%,rgba(0,0,0,.80)_100%)]" />

      <div className="relative z-20 flex items-start justify-between gap-2">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-[22px] font-black shadow-[0_0_22px_rgba(37,99,235,.16)] ${style.rating}`}>
          {Number(player.rating || points.last || 0).toFixed(0)}
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1">
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[.14em] ${style.badge}`}>
            <Icon className="h-3 w-3" />
            {rarity}
          </div>
          <p className="text-[10px] font-black uppercase tracking-wide text-white/80">{player.position || "N/A"}</p>
        </div>
      </div>

      <div className="relative z-10 mt-1 flex flex-1 items-end justify-center overflow-hidden rounded-2xl border border-white/5 bg-black/18">
        <div className="absolute inset-x-5 bottom-0 h-9 rounded-full bg-black/55 blur-lg" />
        {showImage ? (
          <img
            src={image}
            alt={player.name}
            onError={() => setFailed(true)}
            className="absolute bottom-0 left-1/2 h-[120%] w-[118%] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_18px_14px_rgba(0,0,0,.58)] transition-transform duration-200 group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-3xl font-black text-white/35">
            {playerInitials(player.name)}
          </div>
        )}
      </div>

      <div className="relative z-20 mt-3">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-[15px] font-black leading-none text-white">{player.name}</p>
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-400" />
        </div>
        <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">{player.team || player.club || "Free Agent"}</p>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/8 bg-black/30 px-2 py-1.5">
            <p className="text-[8px] font-bold uppercase text-slate-500">Points</p>
            <p className="text-[15px] font-black text-white">{points.total}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/30 px-2 py-1.5">
            <p className="flex items-center gap-1 text-[8px] font-bold uppercase text-slate-500">
              <TrendIcon className="h-2.5 w-2.5" /> Last
            </p>
            <p className="text-[15px] font-black text-white">{points.last}</p>
          </div>
        </div>

        <div className="mt-2 flex items-end gap-1.5">
          {lastFive.map((score, index) => (
            <div key={`${score}-${index}`} className="h-5 flex-1 rounded-t bg-emerald-400/25">
              <div
                className="mt-auto w-full rounded-t bg-gradient-to-t from-emerald-600 to-lime-300"
                style={{ height: `${Math.max(18, Math.min(100, Number(score || 0) * 8))}%` }}
              />
            </div>
          ))}
        </div>

        {showPrice && Number(player.price || player.listedPrice || 0) > 0 ? (
          <p className="mt-2 rounded-xl bg-emerald-400/12 px-2 py-1 text-center text-[11px] font-black text-emerald-300">
            N${Number(player.price || player.listedPrice || 0).toFixed(2)}
          </p>
        ) : null}
      </div>
    </button>
  );
}

const PlayerTile = memo(PlayerTileBase);
export default PlayerTile;

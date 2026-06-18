import { memo, useMemo, useState } from "react";
import { Crown, Gem, Shield, Sparkles, Star, Zap } from "lucide-react";
import { type PlayerCardData } from "./cards/types";

type PremiumFootballCardProps = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

type RarityTheme = {
  label: string;
  frame: string;
  glow: string;
  plate: string;
  badge: string;
  accent: string;
  icon: typeof Shield;
};

const themes: Record<string, RarityTheme> = {
  common: {
    label: "COMMON",
    frame: "from-slate-200 via-white to-slate-400",
    glow: "shadow-[0_18px_38px_rgba(148,163,184,.24)]",
    plate: "from-slate-900 via-slate-800 to-slate-950",
    badge: "border-slate-300/50 bg-slate-200 text-slate-950",
    accent: "rgba(203,213,225,.45)",
    icon: Shield,
  },
  rare: {
    label: "RARE",
    frame: "from-sky-200 via-white to-blue-500",
    glow: "shadow-[0_18px_42px_rgba(59,130,246,.32)]",
    plate: "from-blue-950 via-slate-900 to-slate-950",
    badge: "border-blue-200/70 bg-blue-300 text-blue-950",
    accent: "rgba(96,165,250,.52)",
    icon: Star,
  },
  unique: {
    label: "UNIQUE",
    frame: "from-fuchsia-200 via-white to-violet-600",
    glow: "shadow-[0_20px_48px_rgba(168,85,247,.36)]",
    plate: "from-violet-950 via-slate-900 to-fuchsia-950",
    badge: "border-fuchsia-200/70 bg-fuchsia-300 text-fuchsia-950",
    accent: "rgba(217,70,239,.52)",
    icon: Gem,
  },
  epic: {
    label: "EPIC",
    frame: "from-indigo-200 via-white to-cyan-500",
    glow: "shadow-[0_20px_48px_rgba(99,102,241,.34)]",
    plate: "from-indigo-950 via-slate-900 to-cyan-950",
    badge: "border-indigo-200/70 bg-indigo-300 text-indigo-950",
    accent: "rgba(129,140,248,.52)",
    icon: Zap,
  },
  legendary: {
    label: "LEGENDARY",
    frame: "from-yellow-200 via-white to-amber-500",
    glow: "shadow-[0_22px_54px_rgba(245,158,11,.42)]",
    plate: "from-amber-950 via-slate-950 to-yellow-950",
    badge: "border-yellow-100/80 bg-yellow-300 text-yellow-950",
    accent: "rgba(251,191,36,.58)",
    icon: Crown,
  },
};

const sizeClasses = {
  sm: "h-[218px] w-[156px]",
  md: "h-[232px] w-[168px]",
  lg: "h-[286px] w-[208px]",
};

function initials(name: string) {
  return String(name || "Player")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function firstValidImage(player: PlayerCardData) {
  return [player.image, player.imageUrl, player.photo, ...(player.imageCandidates || [])].filter(Boolean) as string[];
}

function statLine(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.map((v) => Number(v || 0)).slice(0, 5) : [];
  while (scores.length < 5) scores.push(0);
  const total = Number(player.totalPoints || scores.reduce((sum, value) => sum + value, 0) || player.form || player.rating || 0);
  return { scores, total: Math.round(total) };
}

function PremiumFootballCardBase({ player, selected = false, onClick, showPrice = false, className = "", size = "md" }: PremiumFootballCardProps) {
  const rarity = String(player.rarity || "common").toLowerCase();
  const theme = themes[rarity] || themes.common;
  const Icon = theme.icon;
  const images = useMemo(() => firstValidImage(player), [player]);
  const [imageIndex, setImageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const currentImage = images[imageIndex];
  const showImage = Boolean(currentImage) && !failed;
  const stats = useMemo(() => statLine(player), [player]);
  const rating = Math.max(0, Math.round(Number(player.rating || player.form || stats.total || 0)));
  const serial = player.serial && player.maxSupply ? `#${String(player.serial).padStart(3, "0")}/${player.maxSupply}` : player.maxSupply ? `#001/${player.maxSupply}` : player.season || "25-26";

  const handleImageError = () => {
    if (imageIndex < images.length - 1) {
      setImageIndex((index) => index + 1);
    } else {
      setFailed(true);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative isolate overflow-visible rounded-[24px] bg-transparent p-0 text-left transition-transform duration-200",
        onClick ? "cursor-pointer hover:-translate-y-1" : "cursor-default",
        selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950" : "",
        className,
      ].join(" ")}
      data-testid={`premium-football-card-${player.id}`}
      aria-label={`${player.name || "Player"} card`}
    >
      <div className={["relative overflow-hidden rounded-[24px] bg-gradient-to-br p-[3px]", sizeClasses[size], theme.frame, theme.glow].join(" ")}>
        <div className={`relative h-full w-full overflow-hidden rounded-[21px] bg-gradient-to-b ${theme.plate}`}>
          <div className="absolute inset-0 opacity-80" style={{ background: `radial-gradient(circle at 50% 8%, ${theme.accent}, transparent 36%)` }} />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.20)_18%,transparent_34%,transparent_60%,rgba(255,255,255,.18)_74%,transparent_100%)] opacity-70" />
          <div className="absolute inset-x-3 top-3 h-[52%] rounded-[18px] border border-white/18 bg-white/[.08] shadow-inner" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,.18),transparent_34%),linear-gradient(180deg,transparent_42%,rgba(0,0,0,.82)_100%)]" />

          <div className="absolute left-2 top-2 z-30 flex h-11 w-11 flex-col items-center justify-center rounded-2xl border border-white/25 bg-black/55 text-white backdrop-blur-md">
            <span className="text-[19px] font-black leading-none">{rating}</span>
            <span className="mt-0.5 text-[7px] font-black uppercase tracking-widest text-white/65">OVR</span>
          </div>

          <div className="absolute right-2 top-2 z-30 flex flex-col items-end gap-1">
            <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[.12em] ${theme.badge}`}>
              <Icon className="h-2.5 w-2.5" />
              {theme.label}
            </div>
            <span className="rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white/75 backdrop-blur-md">{player.position || "N/A"}</span>
          </div>

          <div className="absolute inset-x-2 bottom-[62px] top-9 z-20 flex items-end justify-center overflow-hidden rounded-[18px]">
            <div className="absolute bottom-0 h-10 w-[82%] rounded-full bg-black/55 blur-xl" />
            {showImage ? (
              <img
                src={currentImage}
                alt={player.name}
                loading="lazy"
                decoding="async"
                onError={handleImageError}
                className="absolute bottom-0 left-1/2 h-[118%] w-[122%] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_18px_14px_rgba(0,0,0,.62)] transition-transform duration-200 group-hover:scale-[1.035]"
              />
            ) : (
              <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/15 bg-white/[.08] text-3xl font-black text-white/45">
                {initials(player.name)}
              </div>
            )}
          </div>

          <div className="absolute inset-x-2 bottom-2 z-40 rounded-[17px] border border-white/15 bg-black/62 p-2 backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black uppercase leading-none tracking-wide text-white">{player.name || "Unknown Player"}</p>
                <p className="mt-1 truncate text-[8px] font-bold uppercase tracking-[.12em] text-white/58">{player.team || player.club || "Fantasy Arena"}</p>
              </div>
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-yellow-200" />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-white/[.08] px-1.5 py-1">
                <p className="text-[6px] font-black uppercase text-white/38">PTS</p>
                <p className="text-[11px] font-black text-white">{stats.total}</p>
              </div>
              <div className="rounded-lg bg-white/[.08] px-1.5 py-1">
                <p className="text-[6px] font-black uppercase text-white/38">LVL</p>
                <p className="text-[11px] font-black text-white">{player.level || 1}</p>
              </div>
              <div className="rounded-lg bg-white/[.08] px-1.5 py-1">
                <p className="text-[6px] font-black uppercase text-white/38">SER</p>
                <p className="truncate text-[9px] font-black text-white">{serial}</p>
              </div>
            </div>

            {showPrice && Number(player.price || player.listedPrice || 0) > 0 ? (
              <p className="mt-1.5 rounded-lg bg-emerald-300 px-2 py-1 text-center text-[10px] font-black text-emerald-950">
                N${Number(player.price || player.listedPrice || 0).toFixed(2)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;

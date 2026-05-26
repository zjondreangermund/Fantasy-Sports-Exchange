import { memo, useMemo, useState } from "react";
import { Crown, Gem, Shield, Star, Zap } from "lucide-react";
import { type PlayerCardData } from "./cards/types";

type Props = {
  player: PlayerCardData;
  className?: string;
};

type Look = {
  label: string;
  border: string;
  badge: string;
  glow: string;
  accent: string;
  background: string;
  Icon: typeof Shield;
};

const looks: Record<string, Look> = {
  common: {
    label: "COMMON",
    border: "border-slate-600/70",
    badge: "border-slate-400/40 bg-slate-900/70 text-slate-100",
    glow: "shadow-[0_0_30px_rgba(148,163,184,.12)]",
    accent: "from-slate-400 to-slate-200",
    background: "radial-gradient(circle at 50% 25%, rgba(148,163,184,.22), transparent 45%), linear-gradient(145deg,#111827,#020617 72%)",
    Icon: Shield,
  },
  rare: {
    label: "RARE",
    border: "border-blue-400/60",
    badge: "border-blue-300/40 bg-blue-500/15 text-blue-200",
    glow: "shadow-[0_0_38px_rgba(59,130,246,.24)]",
    accent: "from-cyan-300 to-blue-500",
    background: "radial-gradient(circle at 50% 25%, rgba(37,99,235,.36), transparent 45%), linear-gradient(145deg,#082f62,#020617 72%)",
    Icon: Zap,
  },
  unique: {
    label: "UNIQUE",
    border: "border-fuchsia-400/60",
    badge: "border-fuchsia-300/40 bg-fuchsia-500/15 text-fuchsia-200",
    glow: "shadow-[0_0_40px_rgba(217,70,239,.25)]",
    accent: "from-fuchsia-300 to-violet-500",
    background: "radial-gradient(circle at 50% 25%, rgba(168,85,247,.38), transparent 45%), linear-gradient(145deg,#3b0764,#020617 72%)",
    Icon: Gem,
  },
  legendary: {
    label: "LEGENDARY",
    border: "border-amber-300/70",
    badge: "border-amber-200/45 bg-amber-400/14 text-amber-200",
    glow: "shadow-[0_0_44px_rgba(251,191,36,.30)]",
    accent: "from-yellow-200 to-amber-500",
    background: "radial-gradient(circle at 50% 25%, rgba(245,158,11,.38), transparent 45%), linear-gradient(145deg,#271505,#020617 72%)",
    Icon: Crown,
  },
  epic: {
    label: "EPIC",
    border: "border-violet-400/60",
    badge: "border-violet-300/40 bg-violet-500/15 text-violet-200",
    glow: "shadow-[0_0_40px_rgba(139,92,246,.25)]",
    accent: "from-violet-300 to-indigo-500",
    background: "radial-gradient(circle at 50% 25%, rgba(124,58,237,.34), transparent 45%), linear-gradient(145deg,#1e1b4b,#020617 72%)",
    Icon: Gem,
  },
};

function scoresOf(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.map((v) => Number(v || 0)).slice(0, 5) : [];
  while (scores.length < 5) scores.push(0);
  return scores;
}

function pointsOf(player: PlayerCardData) {
  const scores = scoresOf(player).filter((v) => v > 0);
  return Number(player.totalPoints || scores.reduce((sum, v) => sum + v, 0));
}

function splitName(name: string) {
  const parts = String(name || "Unknown Player").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { small: "", main: parts[0] || "Unknown" };
  return { small: parts.slice(0, -1).join(" "), main: parts.slice(-1).join(" ") };
}

function PremiumCollectionCardBase({ player, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const rarity = String(player?.rarity || "common").toLowerCase();
  const look = looks[rarity] || looks.common;
  const Icon = look.Icon;
  const scores = useMemo(() => scoresOf(player), [player]);
  const total = useMemo(() => pointsOf(player), [player]);
  const { small, main } = splitName(player?.name || "Unknown Player");
  const image = player?.image || player?.imageUrl || player?.photo || player?.imageCandidates?.[0];
  const showImage = Boolean(image) && !failed;

  return (
    <article
      className={["group relative h-[360px] w-[240px] overflow-hidden rounded-[26px] border bg-slate-950 transition duration-300 hover:-translate-y-1 hover:scale-[1.02]", look.border, look.glow, className].join(" ")}
      style={{ background: look.background }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,.10),transparent_24%,transparent_62%,rgba(255,255,255,.08)_78%,transparent_92%)]" />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(135deg, transparent 0 42%, rgba(255,255,255,.11) 42% 43%, transparent 43%)", backgroundSize: "42px 42px" }} />
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${look.accent}`} />

      <div className="relative z-20 flex items-start justify-between p-4">
        <div>
          <p className="text-[34px] font-black leading-none tracking-tight text-white">{Number(player?.rating || 0).toFixed(0)}</p>
          <p className="mt-1 text-sm font-black uppercase tracking-wide text-white/90">{player?.position || "N/A"}</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] ${look.badge}`}>
          <Icon className="h-3.5 w-3.5" />
          {look.label}
        </div>
      </div>

      <div className="absolute inset-x-3 top-[68px] h-[196px] overflow-hidden rounded-[22px] border border-white/10 bg-black/16">
        <div className={`absolute inset-0 bg-gradient-to-t ${look.accent} opacity-15`} />
        <div className="absolute inset-x-4 bottom-3 h-14 rounded-full bg-black/60 blur-xl" />
        {showImage ? (
          <img src={image} alt={player?.name || "Player"} onError={() => setFailed(true)} className="absolute bottom-[-8px] left-1/2 h-[120%] w-[122%] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_24px_18px_rgba(0,0,0,.65)] transition duration-300 group-hover:scale-105" loading="lazy" decoding="async" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl font-black text-white/12">FA</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
      </div>

      <div className="absolute inset-x-4 top-[246px] z-30">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">{small}</p>
        <p className="truncate text-xl font-black leading-tight text-white">{main}</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{player?.team || player?.club || "Free Agent"}{player?.nationality ? ` • ${player.nationality}` : ""}</p>
      </div>

      <div className="absolute inset-x-4 bottom-4 z-30 grid grid-cols-[1fr_1fr] gap-2">
        <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Points</p>
          <p className="text-lg font-black text-white">{Math.round(total * 10) / 10}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Last 5</p>
          <div className="mt-1 flex h-6 items-end gap-1.5">
            {scores.map((score, i) => (
              <span key={`${score}-${i}`} className="w-full rounded-t bg-gradient-to-t from-emerald-700 to-lime-300" style={{ height: `${Math.max(6, Math.min(24, Number(score || 0) * 0.55))}px` }} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

const PremiumCollectionCard = memo(PremiumCollectionCardBase);
export default PremiumCollectionCard;

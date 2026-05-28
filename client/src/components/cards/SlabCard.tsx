import { useMemo, useState } from "react";
import { Activity, Crown, Gem, Shield, Sparkles, TrendingDown, TrendingUp, Zap } from "lucide-react";

export type SlabRarity = "common" | "rare" | "unique" | "epic" | "legendary";

type CardStats = {
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defense?: number;
  physical?: number;
};

type SlabCardProps = {
  name: string;
  rarity: SlabRarity;
  avgScore: number;
  serialNumber: string;
  className?: string;
  imageSrc?: string;
  season?: string;
  teamCode?: string;
  shirtNumber?: string | number;
  age?: number;
  countryCode?: string;
  position?: string;
  stats?: CardStats;
  last5?: number[];
  value?: string;
  status?: "active" | "legacy" | "uncovered_league";
  competitionEligible?: boolean;
  provenanceMarker?: string;
};

type Theme = {
  label: string;
  title: string;
  surface: string;
  frame: string;
  glow: string;
  text: string;
  muted: string;
  badge: string;
  statPanel: string;
  glass: string;
  line: string;
  portraitGlow: string;
  pattern: string;
  particle: string;
  shape: string;
  sweepOpacity: number;
  icon: typeof Shield;
};

const cardShape = "polygon(9% 1%,91% 1%,99% 10%,99% 88%,86% 99%,14% 99%,1% 88%,1% 10%)";
const shieldShape = "polygon(10% 1%,90% 1%,99% 12%,99% 86%,50% 99%,1% 86%,1% 12%)";
const crystalShape = "polygon(7% 8%,20% 1%,37% 5%,50% 1%,63% 5%,80% 1%,93% 8%,99% 23%,96% 88%,84% 99%,16% 99%,4% 88%,1% 23%)";
const crownShape = "polygon(7% 12%,18% 4%,30% 8%,40% 1%,50% 10%,60% 1%,70% 8%,82% 4%,93% 12%,99% 30%,96% 88%,84% 99%,16% 99%,4% 88%,1% 30%)";

const themes: Record<SlabRarity, Theme> = {
  common: {
    label: "COMMON",
    title: "Clean Silver",
    surface: "linear-gradient(180deg,#f8fafc 0%,#e2e8f0 48%,#cbd5e1 100%)",
    frame: "linear-gradient(145deg,#ffffff 0%,#cfd8e3 26%,#7f8996 55%,#ffffff 100%)",
    glow: "0 24px 62px rgba(226,232,240,.28)",
    text: "text-slate-950",
    muted: "text-slate-700",
    badge: "border-slate-400/55 bg-white/78 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]",
    statPanel: "border-slate-400/40 bg-white/72 text-slate-950",
    glass: "rgba(255,255,255,.58)",
    line: "rgba(15,23,42,.13)",
    portraitGlow: "radial-gradient(circle at 50% 35%,rgba(255,255,255,.95),rgba(148,163,184,.28) 45%,transparent 70%)",
    pattern: "rgba(15,23,42,.11)",
    particle: "rgba(15,23,42,.12)",
    shape: shieldShape,
    sweepOpacity: 0.34,
    icon: Shield,
  },
  rare: {
    label: "RARE",
    title: "Neon Tech",
    surface: "linear-gradient(180deg,#061a3d 0%,#073a78 50%,#020617 100%)",
    frame: "linear-gradient(145deg,#67e8f9 0%,#0284c7 28%,#0f172a 58%,#38bdf8 100%)",
    glow: "0 28px 72px rgba(56,189,248,.45)",
    text: "text-white",
    muted: "text-cyan-100/76",
    badge: "border-cyan-200/35 bg-cyan-300/14 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,.18)]",
    statPanel: "border-cyan-200/24 bg-slate-950/56 text-white",
    glass: "rgba(8,47,73,.52)",
    line: "rgba(125,211,252,.28)",
    portraitGlow: "radial-gradient(circle at 50% 35%,rgba(125,211,252,.82),rgba(14,165,233,.24) 43%,transparent 72%)",
    pattern: "rgba(125,211,252,.24)",
    particle: "rgba(103,232,249,.38)",
    shape: cardShape,
    sweepOpacity: 0.55,
    icon: Zap,
  },
  unique: {
    label: "UNIQUE",
    title: "Royal Crystal",
    surface: "linear-gradient(180deg,#1e0b3f 0%,#4c1d95 46%,#12051f 100%)",
    frame: "linear-gradient(145deg,#fde68a 0%,#a855f7 22%,#4c1d95 52%,#f0abfc 76%,#facc15 100%)",
    glow: "0 30px 82px rgba(168,85,247,.55)",
    text: "text-white",
    muted: "text-fuchsia-100/78",
    badge: "border-yellow-200/45 bg-white/13 text-white shadow-[0_0_26px_rgba(217,70,239,.22)]",
    statPanel: "border-fuchsia-100/24 bg-black/42 text-white",
    glass: "rgba(76,29,149,.42)",
    line: "rgba(253,224,71,.32)",
    portraitGlow: "radial-gradient(circle at 50% 34%,rgba(253,224,71,.54),rgba(168,85,247,.43) 42%,transparent 72%)",
    pattern: "rgba(255,255,255,.18)",
    particle: "rgba(253,224,71,.36)",
    shape: crystalShape,
    sweepOpacity: 0.66,
    icon: Gem,
  },
  legendary: {
    label: "LEGENDARY",
    title: "Black Gold Icon",
    surface: "linear-gradient(180deg,#050505 0%,#151008 46%,#000000 100%)",
    frame: "linear-gradient(145deg,#fff7ad 0%,#f59e0b 22%,#111827 45%,#000 63%,#facc15 100%)",
    glow: "0 34px 94px rgba(250,204,21,.58)",
    text: "text-yellow-50",
    muted: "text-yellow-100/76",
    badge: "border-yellow-200/55 bg-yellow-300/14 text-yellow-100 shadow-[0_0_30px_rgba(250,204,21,.25)]",
    statPanel: "border-yellow-200/28 bg-black/58 text-yellow-50",
    glass: "rgba(0,0,0,.48)",
    line: "rgba(250,204,21,.42)",
    portraitGlow: "radial-gradient(circle at 50% 33%,rgba(255,247,173,.78),rgba(245,158,11,.32) 42%,transparent 72%)",
    pattern: "rgba(250,204,21,.20)",
    particle: "rgba(250,204,21,.42)",
    shape: crownShape,
    sweepOpacity: 0.76,
    icon: Crown,
  },
  epic: {
    label: "EPIC",
    title: "Arcane Violet",
    surface: "linear-gradient(180deg,#140629 0%,#3b0764 48%,#0b0418 100%)",
    frame: "linear-gradient(145deg,#ddd6fe 0%,#8b5cf6 25%,#312e81 56%,#c4b5fd 100%)",
    glow: "0 32px 88px rgba(139,92,246,.56)",
    text: "text-violet-50",
    muted: "text-violet-100/76",
    badge: "border-violet-200/45 bg-violet-300/14 text-violet-50 shadow-[0_0_26px_rgba(139,92,246,.30)]",
    statPanel: "border-violet-200/25 bg-black/45 text-violet-50",
    glass: "rgba(76,29,149,.44)",
    line: "rgba(196,181,253,.34)",
    portraitGlow: "radial-gradient(circle at 50% 33%,rgba(221,214,254,.58),rgba(124,58,237,.35) 42%,transparent 72%)",
    pattern: "rgba(196,181,253,.24)",
    particle: "rgba(167,139,250,.40)",
    shape: crystalShape,
    sweepOpacity: 0.68,
    icon: Gem,
  },
};

function splitName(name: string) {
  const parts = String(name || "PLAYER NAME").trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "PLAYER", lastName: "NAME" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1).join(" ") };
}

function clamp(value: number, min = 1, max = 99) {
  return Math.max(min, Math.min(max, Math.round(value || 0)));
}

function getStats(rating: number, stats?: CardStats) {
  const base = clamp(rating || 70, 45, 99);
  return [
    ["PAC", stats?.pace ?? base + 1],
    ["SHO", stats?.shooting ?? base - 2],
    ["PAS", stats?.passing ?? base],
    ["DRI", stats?.dribbling ?? base + 2],
    ["DEF", stats?.defense ?? base - 8],
    ["PHY", stats?.physical ?? base - 1],
  ].map(([label, value]) => [label, clamp(Number(value), 1, 99)] as const);
}

function formTrend(last5?: number[]) {
  const values = Array.isArray(last5) ? last5.map((v) => Number(v || 0)).filter((v) => v > 0) : [];
  if (values.length < 2) return "neutral" as const;
  return values[values.length - 1] >= values[0] ? "up" as const : "down" as const;
}

function normalizeLast5(last5?: number[]) {
  const values = Array.isArray(last5) ? last5.slice(0, 5).map((v) => Math.max(0, Math.round(Number(v || 0)))) : [];
  while (values.length < 5) values.push(0);
  return values;
}

function RarityPattern({ theme, rarity }: { theme: Theme; rarity: SlabRarity }) {
  const bg =
    rarity === "unique"
      ? `linear-gradient(126deg,transparent 0 25%,${theme.pattern} 25% 27%,transparent 27% 54%,${theme.pattern} 54% 56%,transparent 56%),linear-gradient(36deg,transparent 0 44%,${theme.pattern} 44% 46%,transparent 46%)`
      : rarity === "legendary"
        ? `radial-gradient(circle at 24% 18%,${theme.particle} 0 1px,transparent 2px),linear-gradient(135deg,transparent 0 31%,${theme.pattern} 31% 32%,transparent 32% 66%,${theme.pattern} 66% 67%,transparent 67%)`
        : rarity === "rare"
          ? `linear-gradient(90deg,transparent 0 47%,${theme.pattern} 47% 48%,transparent 48%),linear-gradient(135deg,transparent 0 38%,${theme.pattern} 38% 40%,transparent 40%)`
          : `linear-gradient(135deg,transparent 0 36%,${theme.pattern} 36% 38%,transparent 38%),radial-gradient(circle at 20% 22%,${theme.pattern} 0 1px,transparent 2px)`;

  return (
    <>
      <div className="absolute inset-0 opacity-85 mix-blend-overlay" style={{ backgroundImage: bg, backgroundSize: "42px 42px,20px 20px" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.36),transparent_38%),linear-gradient(115deg,transparent_0%,rgba(255,255,255,.20)_18%,transparent_31%,transparent_62%,rgba(255,255,255,.14)_76%,transparent_92%)]" />
      <div className="absolute -inset-y-24 -left-24 w-20 rotate-[17deg] bg-white/30 blur-xl opacity-0 transition-all duration-700 group-hover:translate-x-96 group-hover:opacity-100" />
    </>
  );
}

function PortraitLayer({ theme, imageSrc, name, fallbackText }: { theme: Theme; imageSrc?: string; name: string; fallbackText: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageSrc) && !failed;

  return (
    <div className="absolute inset-x-[5%] top-[16%] z-20 h-[51%] overflow-visible">
      <div className="absolute inset-x-[4%] top-[8%] h-[74%] rounded-[1.4rem]" style={{ background: theme.portraitGlow }} />
      <div className="absolute inset-x-[15%] bottom-[4%] h-11 rounded-full bg-black/45 blur-lg" />
      <div className="absolute inset-x-[14%] bottom-[11%] h-px" style={{ background: theme.line }} />
      {showImage ? (
        <img
          src={imageSrc}
          alt={name}
          onError={() => setFailed(true)}
          className="absolute left-1/2 top-[-13%] h-[126%] w-[118%] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_22px_18px_rgba(0,0,0,.62)] transition-transform duration-300 group-hover:scale-[1.045] group-hover:-translate-y-1"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute left-1/2 top-[8%] flex h-[72%] w-[64%] -translate-x-1/2 items-center justify-center rounded-[1.2rem] border border-white/18 bg-white/10 text-center text-[36px] font-black uppercase tracking-[-.12em] text-white/35 backdrop-blur-sm">
          {fallbackText}
        </div>
      )}
    </div>
  );
}

function LiveBadge({ status, eligible, trend, theme }: { status?: SlabCardProps["status"]; eligible?: boolean; trend: "up" | "down" | "neutral"; theme: Theme }) {
  const TrendIcon = trend === "down" ? TrendingDown : trend === "up" ? TrendingUp : Activity;
  const label = status === "active" ? "LIVE" : eligible ? "READY" : "CARD";
  return (
    <div className={`absolute left-[8%] top-[17%] z-40 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black tracking-[.12em] ${theme.badge}`}>
      <TrendIcon className="h-2.5 w-2.5" />
      <span>{label}</span>
    </div>
  );
}

function CardBackGhost({ theme, season, teamCode }: { theme: Theme; season: string; teamCode: string }) {
  return (
    <div className="pointer-events-none absolute inset-[9px] z-10 opacity-[0.08]" style={{ clipPath: theme.shape }}>
      <div className="absolute inset-x-0 top-[42%] text-center text-[40px] font-black tracking-[.22em] text-current">FSE</div>
      <div className="absolute inset-x-0 bottom-[17%] text-center text-[9px] font-black tracking-[.28em] text-current">{season} • {teamCode}</div>
    </div>
  );
}

export default function SlabCard({
  name,
  rarity,
  avgScore,
  serialNumber,
  className = "",
  imageSrc,
  season = "2026-27",
  teamCode = "FSE",
  age = 24,
  countryCode = "FC",
  position = "ST",
  stats,
  last5,
  status,
  competitionEligible,
  provenanceMarker = "",
}: SlabCardProps) {
  const theme = themes[rarity] ?? themes.common;
  const rating = clamp(Number(avgScore || 0), 1, 99);
  const { firstName, lastName } = splitName(name);
  const statRows = useMemo(() => getStats(rating, stats), [rating, stats]);
  const trend = formTrend(last5);
  const recent = normalizeLast5(last5);
  const Icon = theme.icon;
  const initials = `${firstName[0] || "P"}${lastName[0] || "L"}`;

  return (
    <article
      data-rarity={rarity}
      className={[
        "group relative w-[190px] max-w-full aspect-[5/7] select-none transition-all duration-300 hover:-translate-y-1 hover:scale-[1.025]",
        className,
      ].join(" ")}
      style={{ filter: `drop-shadow(${theme.glow})`, transformStyle: "preserve-3d" }}
    >
      <div className="absolute inset-0" style={{ clipPath: theme.shape, background: theme.frame }} />
      <div className="absolute inset-[3px]" style={{ clipPath: theme.shape, background: theme.surface }} />
      <div className="absolute inset-[7px]" style={{ clipPath: theme.shape, background: `linear-gradient(145deg,transparent,${theme.glass},transparent)` }} />
      <div className="absolute inset-[8px] border border-white/18" style={{ clipPath: theme.shape }} />

      <div className="absolute inset-[3px] overflow-hidden" style={{ clipPath: theme.shape }}>
        <RarityPattern theme={theme} rarity={rarity} />
        <CardBackGhost theme={theme} season={season} teamCode={teamCode} />
        <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/70 via-black/28 to-transparent" />
        <div className="absolute inset-x-[10%] top-[9%] h-[58%] rounded-[1.8rem] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,.12)]" />
      </div>

      <div className={`absolute left-[9%] top-[7%] z-30 ${theme.text}`}>
        <div className="text-[34px] font-black leading-none tracking-tighter drop-shadow-[0_3px_6px_rgba(0,0,0,.40)]">{rating}</div>
        <div className="mt-1 text-[13px] font-black leading-none tracking-wide">{String(position || "ST").slice(0, 3).toUpperCase()}</div>
      </div>

      <div className={`absolute right-[8%] top-[7%] z-30 flex flex-col items-end gap-1 ${theme.text}`}>
        <div className={`rounded-full border px-2.5 py-1 text-[7px] font-black tracking-[.18em] ${theme.badge}`}>{theme.label}</div>
        <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${theme.badge}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <LiveBadge status={status} eligible={competitionEligible} trend={trend} theme={theme} />
      <PortraitLayer theme={theme} imageSrc={imageSrc} name={name} fallbackText={initials} />

      <div className={`absolute inset-x-[8%] top-[62%] z-30 ${theme.text}`}>
        <div className="truncate text-[18px] font-black leading-none tracking-wide drop-shadow-[0_3px_8px_rgba(0,0,0,.65)]">{lastName}</div>
        <div className={`mt-1 flex items-center gap-1 truncate text-[8px] font-black uppercase tracking-[.16em] ${theme.muted}`}>
          <Sparkles className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{firstName} • {teamCode}</span>
        </div>
      </div>

      <div className={`absolute inset-x-[7%] bottom-[12.5%] z-30 rounded-2xl border px-3 py-2 ${theme.statPanel} backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,.12)]`}>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
          {statRows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-1 text-[9px] font-black">
              <span>{value}</span>
              <span className={`text-[7px] ${theme.muted}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`absolute inset-x-[8%] bottom-[21%] z-30 flex items-center justify-between gap-1 text-[7px] font-black ${theme.muted}`}>
        <span className="tracking-[.16em]">LAST 5</span>
        <div className="flex items-center gap-1">
          {recent.map((value, idx) => (
            <span key={`${value}-${idx}`} className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[8px] leading-none text-white/90">
              {value}
            </span>
          ))}
        </div>
      </div>

      <div className={`absolute bottom-[5.2%] left-[9%] z-30 text-[7px] font-black ${theme.muted}`}>{String(countryCode).slice(0, 3).toUpperCase()} • AGE {age}</div>
      <div className={`absolute bottom-[5.2%] right-[9%] z-30 text-[7px] font-black ${theme.muted}`}>{serialNumber}</div>
      {provenanceMarker ? <div className={`absolute bottom-[8.4%] right-[9%] z-30 text-[6px] ${theme.muted}`}>{provenanceMarker}</div> : null}

      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ clipPath: theme.shape, boxShadow: `inset 0 0 0 1px ${theme.line}, inset 0 0 42px ${theme.line}` }} />
      <div className="pointer-events-none absolute -inset-[18%] opacity-0 mix-blend-screen transition-opacity duration-300 group-hover:opacity-100" style={{ background: `linear-gradient(105deg,transparent 15%,rgba(255,255,255,${theme.sweepOpacity}) 45%,transparent 62%)`, transform: "translateX(-36%) rotate(10deg)" }} />
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_110%,rgba(255,255,255,.18),transparent_44%)]" />
      <span className="sr-only">{theme.label} Sorare-style fantasy player card</span>
    </article>
  );
}

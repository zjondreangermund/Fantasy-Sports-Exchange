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
  surface: string;
  frame: string;
  side: string;
  edge: string;
  glow: string;
  pedestal: string;
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
  icon: typeof Shield;
};

const cardShape = "polygon(9% 1%,91% 1%,99% 10%,99% 88%,86% 99%,14% 99%,1% 88%,1% 10%)";
const shieldShape = "polygon(10% 1%,90% 1%,99% 12%,99% 86%,50% 99%,1% 86%,1% 12%)";
const crystalShape = "polygon(7% 8%,20% 1%,37% 5%,50% 1%,63% 5%,80% 1%,93% 8%,99% 23%,96% 88%,84% 99%,16% 99%,4% 88%,1% 23%)";
const crownShape = "polygon(7% 12%,18% 4%,30% 8%,40% 1%,50% 10%,60% 1%,70% 8%,82% 4%,93% 12%,99% 30%,96% 88%,84% 99%,16% 99%,4% 88%,1% 30%)";
const octagonShape = "polygon(24% 0,76% 0,100% 24%,100% 76%,76% 100%,24% 100%,0 76%,0 24%)";

const themes: Record<SlabRarity, Theme> = {
  common: {
    label: "COMMON",
    surface: "linear-gradient(180deg,#f8fafc 0%,#dbeafe 45%,#cbd5e1 100%)",
    frame: "linear-gradient(145deg,#ffffff 0%,#e2e8f0 16%,#64748b 42%,#f8fafc 72%,#475569 100%)",
    side: "linear-gradient(90deg,#334155,#cbd5e1 38%,#0f172a 100%)",
    edge: "rgba(226,232,240,.92)",
    glow: "0 44px 110px rgba(226,232,240,.40)",
    pedestal: "rgba(226,232,240,.62)",
    text: "text-slate-950",
    muted: "text-slate-700",
    badge: "border-slate-400/60 bg-white/85 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]",
    statPanel: "border-slate-400/45 bg-white/78 text-slate-950",
    glass: "rgba(255,255,255,.62)",
    line: "rgba(15,23,42,.16)",
    portraitGlow: "radial-gradient(circle at 50% 36%,rgba(255,255,255,1),rgba(148,163,184,.42) 46%,transparent 72%)",
    pattern: "rgba(15,23,42,.12)",
    particle: "rgba(15,23,42,.13)",
    shape: shieldShape,
    icon: Shield,
  },
  rare: {
    label: "RARE",
    surface: "linear-gradient(180deg,#061a3d 0%,#075985 48%,#020617 100%)",
    frame: "linear-gradient(145deg,#cffafe 0%,#22d3ee 15%,#0f172a 43%,#0284c7 66%,#67e8f9 100%)",
    side: "linear-gradient(90deg,#020617,#0369a1 36%,#020617 100%)",
    edge: "rgba(103,232,249,.96)",
    glow: "0 48px 120px rgba(56,189,248,.68)",
    pedestal: "rgba(56,189,248,.72)",
    text: "text-white",
    muted: "text-cyan-100/80",
    badge: "border-cyan-100/45 bg-cyan-300/18 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.32)]",
    statPanel: "border-cyan-100/30 bg-slate-950/64 text-white",
    glass: "rgba(8,47,73,.58)",
    line: "rgba(125,211,252,.44)",
    portraitGlow: "radial-gradient(circle at 50% 35%,rgba(165,243,252,.96),rgba(14,165,233,.38) 43%,transparent 74%)",
    pattern: "rgba(125,211,252,.26)",
    particle: "rgba(103,232,249,.48)",
    shape: cardShape,
    icon: Zap,
  },
  unique: {
    label: "UNIQUE",
    surface: "linear-gradient(180deg,#1e0b3f 0%,#581c87 48%,#12051f 100%)",
    frame: "linear-gradient(145deg,#fde68a 0%,#f0abfc 17%,#4c1d95 45%,#a855f7 67%,#facc15 100%)",
    side: "linear-gradient(90deg,#17052f,#7e22ce 38%,#0f051d 100%)",
    edge: "rgba(240,171,252,.96)",
    glow: "0 50px 126px rgba(217,70,239,.70)",
    pedestal: "rgba(217,70,239,.76)",
    text: "text-white",
    muted: "text-fuchsia-100/82",
    badge: "border-yellow-200/50 bg-white/14 text-white shadow-[0_0_32px_rgba(217,70,239,.34)]",
    statPanel: "border-fuchsia-100/30 bg-black/48 text-white",
    glass: "rgba(76,29,149,.48)",
    line: "rgba(253,224,71,.42)",
    portraitGlow: "radial-gradient(circle at 50% 34%,rgba(253,224,71,.68),rgba(168,85,247,.56) 42%,transparent 74%)",
    pattern: "rgba(255,255,255,.20)",
    particle: "rgba(253,224,71,.42)",
    shape: crystalShape,
    icon: Gem,
  },
  epic: {
    label: "EPIC",
    surface: "linear-gradient(180deg,#140629 0%,#3b0764 48%,#0b0418 100%)",
    frame: "linear-gradient(145deg,#ddd6fe 0%,#a78bfa 18%,#312e81 50%,#7c3aed 70%,#c4b5fd 100%)",
    side: "linear-gradient(90deg,#17072f,#6d28d9 36%,#070312 100%)",
    edge: "rgba(196,181,253,.96)",
    glow: "0 50px 126px rgba(139,92,246,.72)",
    pedestal: "rgba(139,92,246,.74)",
    text: "text-violet-50",
    muted: "text-violet-100/80",
    badge: "border-violet-200/50 bg-violet-300/16 text-violet-50 shadow-[0_0_32px_rgba(139,92,246,.36)]",
    statPanel: "border-violet-200/30 bg-black/50 text-violet-50",
    glass: "rgba(76,29,149,.50)",
    line: "rgba(196,181,253,.42)",
    portraitGlow: "radial-gradient(circle at 50% 33%,rgba(221,214,254,.70),rgba(124,58,237,.48) 42%,transparent 74%)",
    pattern: "rgba(196,181,253,.26)",
    particle: "rgba(167,139,250,.46)",
    shape: crystalShape,
    icon: Gem,
  },
  legendary: {
    label: "LEGENDARY",
    surface: "linear-gradient(180deg,#050505 0%,#151008 46%,#000000 100%)",
    frame: "linear-gradient(145deg,#fff7ad 0%,#facc15 18%,#111827 43%,#000 60%,#f59e0b 78%,#fef3c7 100%)",
    side: "linear-gradient(90deg,#090703,#92400e 35%,#000 100%)",
    edge: "rgba(250,204,21,.98)",
    glow: "0 54px 136px rgba(250,204,21,.78)",
    pedestal: "rgba(250,204,21,.82)",
    text: "text-yellow-50",
    muted: "text-yellow-100/80",
    badge: "border-yellow-200/60 bg-yellow-300/16 text-yellow-100 shadow-[0_0_36px_rgba(250,204,21,.40)]",
    statPanel: "border-yellow-200/34 bg-black/62 text-yellow-50",
    glass: "rgba(0,0,0,.54)",
    line: "rgba(250,204,21,.55)",
    portraitGlow: "radial-gradient(circle at 50% 33%,rgba(255,247,173,.92),rgba(245,158,11,.48) 42%,transparent 74%)",
    pattern: "rgba(250,204,21,.24)",
    particle: "rgba(250,204,21,.52)",
    shape: crownShape,
    icon: Crown,
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
  const bg = rarity === "legendary"
    ? `radial-gradient(circle at 24% 18%,${theme.particle} 0 1px,transparent 2px),linear-gradient(135deg,transparent 0 31%,${theme.pattern} 31% 32%,transparent 32% 66%,${theme.pattern} 66% 67%,transparent 67%)`
    : rarity === "rare"
      ? `linear-gradient(90deg,transparent 0 47%,${theme.pattern} 47% 48%,transparent 48%),linear-gradient(135deg,transparent 0 38%,${theme.pattern} 38% 40%,transparent 40%)`
      : `linear-gradient(126deg,transparent 0 25%,${theme.pattern} 25% 27%,transparent 27% 54%,${theme.pattern} 54% 56%,transparent 56%),linear-gradient(36deg,transparent 0 44%,${theme.pattern} 44% 46%,transparent 46%)`;
  return (
    <>
      <div className="absolute inset-0 opacity-90 mix-blend-overlay" style={{ backgroundImage: bg, backgroundSize: "42px 42px,20px 20px" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.45),transparent_36%),linear-gradient(115deg,transparent_0%,rgba(255,255,255,.24)_18%,transparent_31%,transparent_62%,rgba(255,255,255,.18)_76%,transparent_92%)]" />
      <div className="absolute -inset-y-28 -left-28 w-24 rotate-[17deg] bg-white/40 blur-xl opacity-0 transition-all duration-700 group-hover:translate-x-[28rem] group-hover:opacity-100" />
    </>
  );
}

function NeonChamber({ theme }: { theme: Theme }) {
  return (
    <div className="absolute inset-x-[11%] top-[19%] z-10 h-[37%]" style={{ clipPath: octagonShape }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%,${theme.edge},${theme.glass} 38%,rgba(0,0,0,.58) 100%)` }} />
      <div className="absolute inset-[3px] border border-white/20" style={{ clipPath: octagonShape, boxShadow: `inset 0 0 26px ${theme.edge},0 0 22px ${theme.edge}` }} />
      <div className="absolute inset-x-[12%] bottom-[11%] h-4 rounded-full blur-lg" style={{ background: theme.edge }} />
    </div>
  );
}

function PortraitLayer({ theme, imageSrc, name, fallbackText }: { theme: Theme; imageSrc?: string; name: string; fallbackText: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageSrc) && !failed;
  return (
    <div className="absolute inset-x-[-10%] top-[3%] z-20 h-[70%] overflow-visible">
      <div className="absolute inset-x-[5%] top-[18%] h-[72%] rounded-[2.4rem] blur-[1px]" style={{ background: theme.portraitGlow }} />
      <div className="absolute inset-x-[13%] bottom-[-2%] h-16 rounded-full blur-xl" style={{ background: `radial-gradient(ellipse at center,${theme.edge},rgba(0,0,0,.65),transparent 72%)` }} />
      {showImage ? (
        <img
          src={imageSrc}
          alt={name}
          onError={() => setFailed(true)}
          className="absolute left-1/2 top-[-28%] h-[166%] w-[158%] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_32px_24px_rgba(0,0,0,.78)] transition-transform duration-300 group-hover:scale-[1.08] group-hover:-translate-y-2"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute left-1/2 top-[18%] flex h-[58%] w-[56%] -translate-x-1/2 items-center justify-center rounded-[1.8rem] border border-white/18 bg-white/10 text-center text-[42px] font-black uppercase tracking-[-.12em] text-white/36 backdrop-blur-sm">
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
    <div className={`absolute left-[8%] top-[16%] z-40 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black tracking-[.12em] ${theme.badge}`}>
      <TrendIcon className="h-2.5 w-2.5" />
      <span>{label}</span>
    </div>
  );
}

function CardBackGhost({ theme, season, teamCode }: { theme: Theme; season: string; teamCode: string }) {
  return (
    <div className="pointer-events-none absolute inset-[12px] z-10 opacity-[0.10]" style={{ clipPath: theme.shape }}>
      <div className="absolute inset-x-0 top-[42%] text-center text-[42px] font-black tracking-[.22em] text-current">FSE</div>
      <div className="absolute inset-x-0 bottom-[18%] text-center text-[9px] font-black tracking-[.28em] text-current">{season} • {teamCode}</div>
    </div>
  );
}

function BackCardStack({ theme }: { theme: Theme }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-[3%] -right-[9%] z-0 w-[86%] rotate-[6deg] rounded-[2rem] border border-white/14 opacity-52 blur-[0.2px]" style={{ background: theme.side }} />
      <div className="pointer-events-none absolute inset-y-[7%] -left-[8%] z-0 w-[80%] -rotate-[5deg] rounded-[1.8rem] border border-white/12 opacity-30" style={{ background: `linear-gradient(170deg,transparent,${theme.glass})` }} />
      <div className="pointer-events-none absolute -inset-x-[16%] bottom-[-12%] z-0 h-20 rounded-full blur-3xl" style={{ background: `radial-gradient(ellipse at center,${theme.pedestal},transparent 70%)` }} />
    </>
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
  shirtNumber,
  age = 24,
  countryCode = "FC",
  position = "ST",
  stats,
  last5,
  value,
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
  const shirt = shirtNumber ? `#${shirtNumber}` : String(position || "ST").slice(0, 3).toUpperCase();

  return (
    <article
      data-rarity={rarity}
      className={[
        "group relative w-[230px] max-w-full aspect-[5/7] select-none transition-all duration-300 hover:-translate-y-2 hover:scale-[1.035]",
        className,
      ].join(" ")}
      style={{ filter: `drop-shadow(${theme.glow})`, transformStyle: "preserve-3d" }}
    >
      <BackCardStack theme={theme} />
      <div className="absolute inset-[6px] translate-x-[15px] translate-y-[18px] opacity-95" style={{ clipPath: theme.shape, background: theme.side, boxShadow: "0 24px 46px rgba(0,0,0,.56)" }} />
      <div className="absolute inset-[3px] translate-x-[8px] translate-y-[10px] opacity-90" style={{ clipPath: theme.shape, background: `linear-gradient(120deg,rgba(0,0,0,.68),${theme.edge},rgba(0,0,0,.72))` }} />
      <div className="absolute inset-0" style={{ clipPath: theme.shape, background: theme.frame }} />
      <div className="absolute inset-[5px]" style={{ clipPath: theme.shape, background: `linear-gradient(145deg,rgba(255,255,255,.58),transparent 18%,rgba(0,0,0,.54) 52%,${theme.edge} 100%)` }} />
      <div className="absolute inset-[12px]" style={{ clipPath: theme.shape, background: theme.surface }} />
      <div className="absolute inset-[18px]" style={{ clipPath: theme.shape, background: `linear-gradient(145deg,transparent,${theme.glass},transparent)` }} />
      <div className="absolute inset-[7px] opacity-100" style={{ clipPath: theme.shape, boxShadow: `inset 0 0 0 3px ${theme.edge}, inset 0 0 36px ${theme.edge}, 0 0 34px ${theme.edge}` }} />

      <div className="absolute inset-[12px] overflow-hidden" style={{ clipPath: theme.shape }}>
        <RarityPattern theme={theme} rarity={rarity} />
        <div className="absolute inset-0 opacity-80" style={{ backgroundImage: `radial-gradient(circle at 15% 20%, ${theme.particle} 0 1px, transparent 2px), radial-gradient(circle at 80% 35%, ${theme.particle} 0 1px, transparent 2px), radial-gradient(circle at 55% 75%, ${theme.particle} 0 1px, transparent 2px)`, backgroundSize: "36px 36px, 44px 44px, 52px 52px" }} />
        <CardBackGhost theme={theme} season={season} teamCode={teamCode} />
        <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/82 via-black/40 to-transparent" />
        <div className="absolute inset-x-[7%] top-[8%] h-[60%] rounded-[2rem] border border-white/14 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,.18)]" />
      </div>

      <NeonChamber theme={theme} />

      <div className={`absolute left-[9%] top-[7%] z-30 ${theme.text}`}>
        <div className="text-[38px] font-black leading-none tracking-tighter drop-shadow-[0_4px_8px_rgba(0,0,0,.55)]">{rating}</div>
        <div className="mt-1 text-[13px] font-black leading-none tracking-wide">{String(position || "ST").slice(0, 3).toUpperCase()}</div>
      </div>

      <div className={`absolute right-[8%] top-[7%] z-30 flex flex-col items-end gap-1 ${theme.text}`}>
        <div className={`rounded-full border px-2.5 py-1 text-[7px] font-black tracking-[.18em] ${theme.badge}`}>{theme.label}</div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${theme.badge}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <LiveBadge status={status} eligible={competitionEligible} trend={trend} theme={theme} />
      <PortraitLayer theme={theme} imageSrc={imageSrc} name={name} fallbackText={initials} />

      <div className={`absolute inset-x-[8%] top-[61%] z-30 ${theme.text}`}>
        <div className="truncate text-[20px] font-black leading-none tracking-wide drop-shadow-[0_4px_9px_rgba(0,0,0,.78)]">{lastName}</div>
        <div className={`mt-1 flex items-center gap-1 truncate text-[8px] font-black uppercase tracking-[.16em] ${theme.muted}`}>
          <Sparkles className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{firstName} • {teamCode} • {shirt}</span>
        </div>
      </div>

      <div className={`absolute inset-x-[7%] bottom-[12.5%] z-30 rounded-2xl border px-3 py-2 ${theme.statPanel} backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_12px_30px_rgba(0,0,0,.36)]`}>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
          {statRows.map(([label, stat]) => (
            <div key={label} className="flex items-baseline justify-between gap-1 text-[9px] font-black">
              <span>{stat}</span>
              <span className={`text-[7px] ${theme.muted}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`absolute inset-x-[8%] bottom-[21%] z-30 flex items-center justify-between gap-1 text-[7px] font-black ${theme.muted}`}>
        <span className="tracking-[.16em]">LAST 5</span>
        <div className="flex items-center gap-1">
          {recent.map((score, idx) => (
            <span key={`${score}-${idx}`} className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[8px] leading-none text-white/90">
              {score}
            </span>
          ))}
        </div>
      </div>

      {value ? <div className={`absolute bottom-[8.3%] left-[9%] z-30 text-[6px] font-black ${theme.muted}`}>{value}</div> : null}
      <div className={`absolute bottom-[5.2%] left-[9%] z-30 text-[7px] font-black ${theme.muted}`}>{String(countryCode).slice(0, 3).toUpperCase()} • AGE {age}</div>
      <div className={`absolute bottom-[5.2%] right-[9%] z-30 text-[7px] font-black ${theme.muted}`}>{serialNumber}</div>
      {provenanceMarker ? <div className={`absolute bottom-[8.4%] right-[9%] z-30 text-[6px] ${theme.muted}`}>{provenanceMarker}</div> : null}

      <div className="pointer-events-none absolute inset-0 opacity-100" style={{ clipPath: theme.shape, boxShadow: `inset 0 0 0 2px ${theme.line}, inset 0 0 64px ${theme.line}, 0 0 28px ${theme.edge},0 0 72px ${theme.edge}` }} />
      <div className="pointer-events-none absolute inset-y-[4%] left-[-3px] w-5 opacity-100 blur-[1px]" style={{ background: `linear-gradient(180deg,transparent,${theme.edge},transparent)` }} />
      <div className="pointer-events-none absolute inset-y-[4%] right-[-3px] w-5 opacity-100 blur-[1px]" style={{ background: `linear-gradient(180deg,transparent,${theme.edge},transparent)` }} />
      <div className="pointer-events-none absolute -inset-[18%] opacity-0 mix-blend-screen transition-opacity duration-300 group-hover:opacity-100" style={{ background: "linear-gradient(105deg,transparent 15%,rgba(255,255,255,.74) 45%,transparent 62%)", transform: "translateX(-36%) rotate(10deg)" }} />
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_110%,rgba(255,255,255,.26),transparent_44%)]" />
      <span className="sr-only">{theme.label} premium neon 3D fantasy player card</span>
    </article>
  );
}

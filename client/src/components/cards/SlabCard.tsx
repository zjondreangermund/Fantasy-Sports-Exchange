import { useMemo, useState } from "react";
import { Activity, Crown, Gem, Shield, Sparkles, TrendingDown, TrendingUp, Zap } from "lucide-react";

export type SlabRarity = "common" | "rare" | "unique" | "epic" | "legendary";

type CardStats = { pace?: number; shooting?: number; passing?: number; dribbling?: number; defense?: number; physical?: number };

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
  common: { label: "COMMON", surface: "linear-gradient(180deg,#f8fafc 0%,#dbeafe 45%,#cbd5e1 100%)", frame: "linear-gradient(145deg,#ffffff 0%,#e2e8f0 16%,#64748b 42%,#f8fafc 72%,#475569 100%)", side: "linear-gradient(90deg,#334155,#cbd5e1 38%,#0f172a 100%)", edge: "rgba(226,232,240,.82)", glow: "0 34px 86px rgba(226,232,240,.34)", pedestal: "rgba(226,232,240,.45)", text: "text-slate-950", muted: "text-slate-700", badge: "border-slate-400/60 bg-white/85 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]", statPanel: "border-slate-400/45 bg-white/78 text-slate-950", glass: "rgba(255,255,255,.62)", line: "rgba(15,23,42,.16)", portraitGlow: "radial-gradient(circle at 50% 36%,rgba(255,255,255,1),rgba(148,163,184,.34) 46%,transparent 72%)", pattern: "rgba(15,23,42,.12)", particle: "rgba(15,23,42,.13)", shape: shieldShape, icon: Shield },
  rare: { label: "RARE", surface: "linear-gradient(180deg,#061a3d 0%,#075985 48%,#020617 100%)", frame: "linear-gradient(145deg,#cffafe 0%,#22d3ee 15%,#0f172a 43%,#0284c7 66%,#67e8f9 100%)", side: "linear-gradient(90deg,#020617,#0369a1 36%,#020617 100%)", edge: "rgba(103,232,249,.90)", glow: "0 38px 94px rgba(56,189,248,.56)", pedestal: "rgba(56,189,248,.56)", text: "text-white", muted: "text-cyan-100/80", badge: "border-cyan-100/45 bg-cyan-300/18 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.32)]", statPanel: "border-cyan-100/30 bg-slate-950/64 text-white", glass: "rgba(8,47,73,.58)", line: "rgba(125,211,252,.44)", portraitGlow: "radial-gradient(circle at 50% 35%,rgba(165,243,252,.90),rgba(14,165,233,.32) 43%,transparent 74%)", pattern: "rgba(125,211,252,.26)", particle: "rgba(103,232,249,.48)", shape: cardShape, icon: Zap },
  unique: { label: "UNIQUE", surface: "linear-gradient(180deg,#1e0b3f 0%,#581c87 48%,#12051f 100%)", frame: "linear-gradient(145deg,#fde68a 0%,#f0abfc 17%,#4c1d95 45%,#a855f7 67%,#facc15 100%)", side: "linear-gradient(90deg,#17052f,#7e22ce 38%,#0f051d 100%)", edge: "rgba(240,171,252,.90)", glow: "0 40px 98px rgba(217,70,239,.58)", pedestal: "rgba(217,70,239,.58)", text: "text-white", muted: "text-fuchsia-100/82", badge: "border-yellow-200/50 bg-white/14 text-white shadow-[0_0_32px_rgba(217,70,239,.34)]", statPanel: "border-fuchsia-100/30 bg-black/48 text-white", glass: "rgba(76,29,149,.48)", line: "rgba(253,224,71,.42)", portraitGlow: "radial-gradient(circle at 50% 34%,rgba(253,224,71,.55),rgba(168,85,247,.44) 42%,transparent 74%)", pattern: "rgba(255,255,255,.20)", particle: "rgba(253,224,71,.42)", shape: crystalShape, icon: Gem },
  epic: { label: "EPIC", surface: "linear-gradient(180deg,#140629 0%,#3b0764 48%,#0b0418 100%)", frame: "linear-gradient(145deg,#ddd6fe 0%,#a78bfa 18%,#312e81 50%,#7c3aed 70%,#c4b5fd 100%)", side: "linear-gradient(90deg,#17072f,#6d28d9 36%,#070312 100%)", edge: "rgba(196,181,253,.90)", glow: "0 40px 98px rgba(139,92,246,.58)", pedestal: "rgba(139,92,246,.58)", text: "text-violet-50", muted: "text-violet-100/80", badge: "border-violet-200/50 bg-violet-300/16 text-violet-50 shadow-[0_0_32px_rgba(139,92,246,.36)]", statPanel: "border-violet-200/30 bg-black/50 text-violet-50", glass: "rgba(76,29,149,.50)", line: "rgba(196,181,253,.42)", portraitGlow: "radial-gradient(circle at 50% 33%,rgba(221,214,254,.58),rgba(124,58,237,.40) 42%,transparent 74%)", pattern: "rgba(196,181,253,.26)", particle: "rgba(167,139,250,.46)", shape: crystalShape, icon: Gem },
  legendary: { label: "LEGENDARY", surface: "linear-gradient(180deg,#050505 0%,#151008 46%,#000000 100%)", frame: "linear-gradient(145deg,#fff7ad 0%,#facc15 18%,#111827 43%,#000 60%,#f59e0b 78%,#fef3c7 100%)", side: "linear-gradient(90deg,#090703,#92400e 35%,#000 100%)", edge: "rgba(250,204,21,.92)", glow: "0 42px 108px rgba(250,204,21,.62)", pedestal: "rgba(250,204,21,.62)", text: "text-yellow-50", muted: "text-yellow-100/80", badge: "border-yellow-200/60 bg-yellow-300/16 text-yellow-100 shadow-[0_0_36px_rgba(250,204,21,.40)]", statPanel: "border-yellow-200/34 bg-black/62 text-yellow-50", glass: "rgba(0,0,0,.54)", line: "rgba(250,204,21,.55)", portraitGlow: "radial-gradient(circle at 50% 33%,rgba(255,247,173,.78),rgba(245,158,11,.38) 42%,transparent 74%)", pattern: "rgba(250,204,21,.24)", particle: "rgba(250,204,21,.52)", shape: crownShape, icon: Crown },
};

function splitName(name: string) { const parts = String(name || "PLAYER NAME").trim().toUpperCase().split(/\s+/).filter(Boolean); if (parts.length <= 1) return { firstName: parts[0] || "PLAYER", lastName: "NAME" }; return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1).join(" ") }; }
function clamp(value: number, min = 1, max = 99) { return Math.max(min, Math.min(max, Math.round(value || 0))); }
function getStats(rating: number, stats?: CardStats) { const base = clamp(rating || 70, 45, 99); return [["PAC", stats?.pace ?? base + 1], ["SHO", stats?.shooting ?? base - 2], ["PAS", stats?.passing ?? base], ["DRI", stats?.dribbling ?? base + 2], ["DEF", stats?.defense ?? base - 8], ["PHY", stats?.physical ?? base - 1]].map(([label, value]) => [label, clamp(Number(value), 1, 99)] as const); }
function formTrend(last5?: number[]) { const values = Array.isArray(last5) ? last5.map((v) => Number(v || 0)).filter((v) => v > 0) : []; if (values.length < 2) return "neutral" as const; return values[values.length - 1] >= values[0] ? "up" as const : "down" as const; }
function normalizeLast5(last5?: number[]) { const values = Array.isArray(last5) ? last5.slice(0, 5).map((v) => Math.max(0, Math.round(Number(v || 0)))) : []; while (values.length < 5) values.push(0); return values; }

function RarityPattern({ theme, rarity }: { theme: Theme; rarity: SlabRarity }) {
  const shapeSet = rarity === "legendary"
    ? [crownShape, crystalShape, octagonShape, cardShape, shieldShape]
    : rarity === "unique" || rarity === "epic"
      ? [crystalShape, cardShape, octagonShape, shieldShape, crystalShape]
      : [cardShape, shieldShape, octagonShape, cardShape, shieldShape];

  const shapes = [
    { className: "left-[-22%] top-[7%] h-[25%] w-[64%] rotate-[-18deg]", clipPath: shapeSet[0] },
    { className: "right-[-30%] top-[16%] h-[29%] w-[78%] rotate-[-18deg]", clipPath: shapeSet[1] },
    { className: "left-[8%] top-[39%] h-[18%] w-[48%] rotate-[-18deg]", clipPath: shapeSet[2] },
    { className: "right-[-12%] bottom-[21%] h-[24%] w-[66%] rotate-[-18deg]", clipPath: shapeSet[3] },
    { className: "left-[-12%] bottom-[34%] h-[17%] w-[40%] rotate-[-18deg]", clipPath: shapeSet[4] },
  ];

  return <>
    <div className="absolute inset-0 opacity-55 mix-blend-overlay" style={{ backgroundImage: `linear-gradient(126deg,transparent 0 24%,${theme.pattern} 24% 25.5%,transparent 25.5% 55%,${theme.pattern} 55% 56.5%,transparent 56.5%),radial-gradient(circle at 24% 18%,${theme.particle} 0 1px,transparent 2px)`, backgroundSize: "58px 58px,38px 38px" }} />
    <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 0%,rgba(255,255,255,.34),transparent 34%),linear-gradient(115deg,transparent 0%,rgba(255,255,255,.18) 18%,transparent 31%,transparent 62%,rgba(255,255,255,.12) 76%,transparent 92%)" }} />
    {shapes.map((shape, index) => <div key={index} className={`absolute ${shape.className} rounded-[1.4rem] border border-black/25 bg-white/[0.055] opacity-60 mix-blend-overlay`} style={{ clipPath: shape.clipPath, boxShadow: `inset 7px 7px 14px rgba(0,0,0,.58), inset -5px -5px 11px rgba(255,255,255,.20), 1px 1px 2px rgba(255,255,255,.18), 0 0 0 1px ${theme.line}` }} />)}
    <div className="absolute inset-[5%] rounded-[1.8rem] opacity-45" style={{ clipPath: theme.shape, boxShadow: "inset 12px 12px 24px rgba(0,0,0,.30), inset -10px -10px 18px rgba(255,255,255,.12)" }} />
    <div className="absolute -inset-y-28 -left-28 w-24 rotate-[17deg] bg-white/35 blur-xl opacity-0 transition-all duration-700 group-hover:translate-x-[28rem] group-hover:opacity-100" />
  </>;
}

function NeonChamber({ theme }: { theme: Theme }) {
  return <div className="absolute inset-x-[18%] top-[26%] z-10 h-[22%]" style={{ clipPath: octagonShape }}><div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%,${theme.edge},${theme.glass} 34%,rgba(0,0,0,.36) 100%)` }} /><div className="absolute inset-[3px] border border-white/18" style={{ clipPath: octagonShape, boxShadow: `inset 0 0 18px ${theme.edge},0 0 14px ${theme.edge}` }} /></div>;
}

function PortraitLayer({ theme, imageSrc, name, fallbackText }: { theme: Theme; imageSrc?: string; name: string; fallbackText: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageSrc) && !failed;
  return <div className="absolute inset-x-[-5%] top-[10%] z-20 h-[56%] overflow-visible"><div className="absolute inset-x-[8%] top-[16%] h-[70%] rounded-[2rem] blur-[1px]" style={{ background: theme.portraitGlow }} /><div className="absolute inset-x-[16%] bottom-[1%] h-12 rounded-full blur-xl" style={{ background: `radial-gradient(ellipse at center,${theme.edge},rgba(0,0,0,.55),transparent 72%)` }} />{showImage ? <img src={imageSrc} alt={name} onError={() => setFailed(true)} className="absolute left-1/2 top-[-15%] h-[142%] w-[138%] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_28px_22px_rgba(0,0,0,.72)] transition-transform duration-300 group-hover:scale-[1.06] group-hover:-translate-y-1" loading="lazy" decoding="async" /> : <div className="absolute left-1/2 top-[24%] flex h-[40%] w-[44%] -translate-x-1/2 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-center text-[28px] font-black uppercase tracking-[-.10em] text-white/18 backdrop-blur-sm">{fallbackText}</div>}</div>;
}

function LiveBadge({ status, eligible, trend, theme }: { status?: SlabCardProps["status"]; eligible?: boolean; trend: "up" | "down" | "neutral"; theme: Theme }) { const TrendIcon = trend === "down" ? TrendingDown : trend === "up" ? TrendingUp : Activity; const label = status === "active" ? "LIVE" : eligible ? "READY" : "CARD"; return <div className={`absolute left-[8%] top-[16%] z-40 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black tracking-[.12em] ${theme.badge}`}><TrendIcon className="h-2.5 w-2.5" /><span>{label}</span></div>; }
function CardBackGhost({ theme, season, teamCode }: { theme: Theme; season: string; teamCode: string }) { return <div className="pointer-events-none absolute inset-[12px] z-10 opacity-[0.08]" style={{ clipPath: theme.shape }}><div className="absolute inset-x-0 top-[42%] text-center text-[38px] font-black tracking-[.22em] text-current">FSE</div><div className="absolute inset-x-0 bottom-[18%] text-center text-[9px] font-black tracking-[.28em] text-current">{season} • {teamCode}</div></div>; }
function BackCardStack({ theme }: { theme: Theme }) { return <><div className="pointer-events-none absolute inset-y-[4%] -right-[6%] z-0 w-[82%] rotate-[4deg] rounded-[1.8rem] border border-white/12 opacity-46 blur-[0.2px]" style={{ background: theme.side }} /><div className="pointer-events-none absolute inset-y-[7%] -left-[6%] z-0 w-[76%] -rotate-[4deg] rounded-[1.6rem] border border-white/10 opacity-26" style={{ background: `linear-gradient(170deg,transparent,${theme.glass})` }} /><div className="pointer-events-none absolute -inset-x-[12%] bottom-[-9%] z-0 h-16 rounded-full blur-3xl" style={{ background: `radial-gradient(ellipse at center,${theme.pedestal},transparent 70%)` }} /></>; }

export default function SlabCard({ name, rarity, avgScore, serialNumber, className = "", imageSrc, season = "2026-27", teamCode = "FSE", shirtNumber, age = 24, countryCode = "FC", position = "ST", stats, last5, value, status, competitionEligible, provenanceMarker = "" }: SlabCardProps) {
  const theme = themes[rarity] ?? themes.common;
  const rating = clamp(Number(avgScore || 0), 1, 99);
  const { firstName, lastName } = splitName(name);
  const statRows = useMemo(() => getStats(rating, stats), [rating, stats]);
  const trend = formTrend(last5);
  const recent = normalizeLast5(last5);
  const Icon = theme.icon;
  const initials = `${firstName[0] || "P"}${lastName[0] || "L"}`;
  const shirt = shirtNumber ? `#${shirtNumber}` : String(position || "ST").slice(0, 3).toUpperCase();

  return <article data-rarity={rarity} className={["group relative w-[205px] max-w-full aspect-[5/7] select-none transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.025]", className].join(" ")} style={{ filter: `drop-shadow(${theme.glow})`, transformStyle: "preserve-3d" }}>
    <BackCardStack theme={theme} />
    <div className="absolute inset-[5px] translate-x-[8px] translate-y-[10px] opacity-88" style={{ clipPath: theme.shape, background: theme.side, boxShadow: "0 18px 36px rgba(0,0,0,.48)" }} />
    <div className="absolute inset-0" style={{ clipPath: theme.shape, background: theme.frame }} />
    <div className="absolute inset-[5px]" style={{ clipPath: theme.shape, background: `linear-gradient(145deg,rgba(255,255,255,.50),transparent 18%,rgba(0,0,0,.45) 52%,${theme.edge} 100%)` }} />
    <div className="absolute inset-[11px]" style={{ clipPath: theme.shape, background: theme.surface }} />
    <div className="absolute inset-[16px]" style={{ clipPath: theme.shape, background: `linear-gradient(145deg,transparent,${theme.glass},transparent)` }} />
    <div className="absolute inset-[7px] opacity-95" style={{ clipPath: theme.shape, boxShadow: `inset 0 0 0 2px ${theme.edge}, inset 0 0 28px ${theme.edge}, 0 0 24px ${theme.edge}` }} />

    <div className="absolute inset-[11px] overflow-hidden" style={{ clipPath: theme.shape }}>
      <RarityPattern theme={theme} rarity={rarity} />
      <div className="absolute inset-0 opacity-75" style={{ backgroundImage: `radial-gradient(circle at 15% 20%, ${theme.particle} 0 1px, transparent 2px), radial-gradient(circle at 80% 35%, ${theme.particle} 0 1px, transparent 2px), radial-gradient(circle at 55% 75%, ${theme.particle} 0 1px, transparent 2px)`, backgroundSize: "36px 36px, 44px 44px, 52px 52px" }} />
      <CardBackGhost theme={theme} season={season} teamCode={teamCode} />
      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/80 via-black/36 to-transparent" />
      <div className="absolute inset-x-[8%] top-[9%] h-[55%] rounded-[1.7rem] border border-white/12 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,.16)]" />
    </div>

    <NeonChamber theme={theme} />
    <div className={`absolute left-[9%] top-[7%] z-30 ${theme.text}`}><div className="text-[35px] font-black leading-none tracking-tighter drop-shadow-[0_4px_8px_rgba(0,0,0,.52)]">{rating}</div><div className="mt-1 text-[13px] font-black leading-none tracking-wide">{String(position || "ST").slice(0, 3).toUpperCase()}</div></div>
    <div className={`absolute right-[8%] top-[7%] z-30 flex flex-col items-end gap-1 ${theme.text}`}><div className={`rounded-full border px-2.5 py-1 text-[7px] font-black tracking-[.18em] ${theme.badge}`}>{theme.label}</div><div className={`flex h-7 w-7 items-center justify-center rounded-full border ${theme.badge}`}><Icon className="h-4 w-4" /></div></div>
    <LiveBadge status={status} eligible={competitionEligible} trend={trend} theme={theme} />
    <PortraitLayer theme={theme} imageSrc={imageSrc} name={name} fallbackText={initials} />

    <div className={`absolute inset-x-[8%] top-[66%] z-30 ${theme.text}`}><div className="truncate text-[19px] font-black leading-none tracking-wide drop-shadow-[0_4px_9px_rgba(0,0,0,.78)]">{lastName}</div><div className={`mt-1 flex items-center gap-1 truncate text-[8px] font-black uppercase tracking-[.16em] ${theme.muted}`}><Sparkles className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{firstName} • {teamCode} • {shirt}</span></div></div>
    <div className={`absolute inset-x-[7%] bottom-[8.8%] z-30 rounded-2xl border px-3 py-2 ${theme.statPanel} backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_12px_30px_rgba(0,0,0,.34)]`}><div className="grid grid-cols-3 gap-x-3 gap-y-1.5">{statRows.map(([label, stat]) => <div key={label} className="flex items-baseline justify-between gap-1 text-[9px] font-black"><span>{stat}</span><span className={`text-[7px] ${theme.muted}`}>{label}</span></div>)}</div></div>
    <div className={`absolute inset-x-[8%] bottom-[20%] z-30 flex items-center justify-between gap-1 text-[7px] font-black ${theme.muted}`}><span className="tracking-[.16em]">LAST 5</span><div className="flex items-center gap-1">{recent.map((score, idx) => <span key={`${score}-${idx}`} className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[8px] leading-none text-white/90">{score}</span>)}</div></div>
    {value ? <div className={`absolute bottom-[5.8%] left-[9%] z-30 text-[6px] font-black ${theme.muted}`}>{value}</div> : null}
    <div className={`absolute bottom-[3.4%] left-[9%] z-30 text-[7px] font-black ${theme.muted}`}>{String(countryCode).slice(0, 3).toUpperCase()} • AGE {age}</div>
    <div className={`absolute bottom-[3.4%] right-[9%] z-30 text-[7px] font-black ${theme.muted}`}>{serialNumber}</div>
    {provenanceMarker ? <div className={`absolute bottom-[6%] right-[9%] z-30 text-[6px] ${theme.muted}`}>{provenanceMarker}</div> : null}
    <div className="pointer-events-none absolute inset-0 opacity-95" style={{ clipPath: theme.shape, boxShadow: `inset 0 0 0 2px ${theme.line}, inset 0 0 50px ${theme.line}, 0 0 18px ${theme.edge},0 0 42px ${theme.edge}` }} />
    <div className="pointer-events-none absolute inset-y-[5%] left-[-2px] w-4 opacity-90 blur-[1px]" style={{ background: `linear-gradient(180deg,transparent,${theme.edge},transparent)` }} />
    <div className="pointer-events-none absolute inset-y-[5%] right-[-2px] w-4 opacity-90 blur-[1px]" style={{ background: `linear-gradient(180deg,transparent,${theme.edge},transparent)` }} />
    <div className="pointer-events-none absolute -inset-[18%] opacity-0 mix-blend-screen transition-opacity duration-300 group-hover:opacity-100" style={{ background: "linear-gradient(105deg,transparent 15%,rgba(255,255,255,.62) 45%,transparent 62%)", transform: "translateX(-36%) rotate(10deg)" }} />
    <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_110%,rgba(255,255,255,.20),transparent_44%)]" />
    <span className="sr-only">{theme.label} premium engraved 3D fantasy player card</span>
  </article>;
}

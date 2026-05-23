import { useMemo } from "react";
import { Crown, Gem, Shield, Sparkles, Zap } from "lucide-react";

export type SlabRarity = "common" | "rare" | "unique" | "legendary";

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
  frame: string;
  face: string;
  glow: string;
  text: string;
  muted: string;
  badge: string;
  panel: string;
  line: string;
  shape: string;
  aura: string;
  pattern: string;
  Icon: typeof Shield;
};

const themes: Record<SlabRarity, Theme> = {
  common: {
    label: "COMMON",
    title: "Clean Silver",
    frame: "linear-gradient(145deg,#ffffff 0%,#d9dde3 34%,#8f98a5 67%,#f5f7fa 100%)",
    face: "linear-gradient(180deg,#f5f5f2 0%,#d8d8d2 58%,#bfc3c8 100%)",
    glow: "0 18px 46px rgba(226,232,240,.25)",
    text: "text-zinc-950",
    muted: "text-zinc-600",
    badge: "border-zinc-900/15 bg-white/65 text-zinc-950",
    panel: "border-zinc-900/12 bg-white/55",
    line: "rgba(24,24,27,.15)",
    shape: "polygon(10% 0%,90% 0%,100% 10%,100% 88%,50% 100%,0% 88%,0% 10%)",
    aura: "radial-gradient(circle at 52% 35%,rgba(255,255,255,.92),rgba(148,163,184,.20) 44%,transparent 70%)",
    pattern: "rgba(39,39,42,.12)",
    Icon: Shield,
  },
  rare: {
    label: "RARE",
    title: "Neon Tech",
    frame: "linear-gradient(145deg,#7dd3fc 0%,#0284c7 30%,#0f172a 68%,#38bdf8 100%)",
    face: "linear-gradient(180deg,#031a39 0%,#072d5f 54%,#020617 100%)",
    glow: "0 22px 60px rgba(56,189,248,.42)",
    text: "text-white",
    muted: "text-cyan-100/75",
    badge: "border-cyan-200/30 bg-cyan-300/12 text-cyan-50",
    panel: "border-cyan-200/20 bg-slate-950/42",
    line: "rgba(125,211,252,.28)",
    shape: "polygon(10% 0%,90% 0%,100% 11%,100% 87%,88% 100%,12% 100%,0% 87%,0% 11%)",
    aura: "radial-gradient(circle at 50% 35%,rgba(125,211,252,.72),rgba(14,165,233,.22) 42%,transparent 72%)",
    pattern: "rgba(125,211,252,.20)",
    Icon: Zap,
  },
  unique: {
    label: "UNIQUE",
    title: "Royal Crystal",
    frame: "linear-gradient(145deg,#fde68a 0%,#a855f7 25%,#4c1d95 55%,#f0abfc 78%,#facc15 100%)",
    face: "linear-gradient(180deg,#1e0b3f 0%,#4c1d95 45%,#12051f 100%)",
    glow: "0 24px 68px rgba(168,85,247,.48)",
    text: "text-white",
    muted: "text-fuchsia-100/75",
    badge: "border-yellow-200/35 bg-white/12 text-white",
    panel: "border-fuchsia-100/20 bg-black/32",
    line: "rgba(253,224,71,.30)",
    shape: "polygon(7% 8%,20% 0%,38% 5%,50% 0%,62% 5%,80% 0%,93% 8%,100% 24%,96% 88%,84% 100%,16% 100%,4% 88%,0% 24%)",
    aura: "radial-gradient(circle at 50% 34%,rgba(253,224,71,.48),rgba(168,85,247,.42) 43%,transparent 73%)",
    pattern: "rgba(255,255,255,.18)",
    Icon: Gem,
  },
  legendary: {
    label: "LEGENDARY",
    title: "Black Gold Icon",
    frame: "linear-gradient(145deg,#fff7ad 0%,#f59e0b 22%,#111827 47%,#000 65%,#facc15 100%)",
    face: "linear-gradient(180deg,#050505 0%,#17120a 48%,#000000 100%)",
    glow: "0 26px 78px rgba(250,204,21,.52)",
    text: "text-yellow-50",
    muted: "text-yellow-100/72",
    badge: "border-yellow-200/45 bg-yellow-300/12 text-yellow-100",
    panel: "border-yellow-200/22 bg-black/46",
    line: "rgba(250,204,21,.36)",
    shape: "polygon(6% 12%,18% 4%,30% 8%,40% 0%,50% 10%,60% 0%,70% 8%,82% 4%,94% 12%,100% 29%,96% 88%,84% 100%,16% 100%,4% 88%,0% 29%)",
    aura: "radial-gradient(circle at 50% 33%,rgba(255,247,173,.70),rgba(245,158,11,.30) 42%,transparent 73%)",
    pattern: "rgba(250,204,21,.18)",
    Icon: Crown,
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

function FinePattern({ theme, rarity }: { theme: Theme; rarity: SlabRarity }) {
  const crystal = rarity === "unique";
  const luxury = rarity === "legendary";
  return (
    <>
      <div
        className="absolute inset-0 opacity-90 mix-blend-overlay"
        style={{
          backgroundImage: crystal
            ? `linear-gradient(125deg,transparent 0 28%,${theme.pattern} 28% 30%,transparent 30% 55%,${theme.pattern} 55% 57%,transparent 57%),linear-gradient(35deg,transparent 0 44%,${theme.pattern} 44% 46%,transparent 46%)`
            : luxury
              ? `radial-gradient(circle at 22% 16%,${theme.pattern} 0 1px,transparent 2px),linear-gradient(135deg,transparent 0 32%,${theme.pattern} 32% 33%,transparent 33% 66%,${theme.pattern} 66% 67%,transparent 67%)`
              : `linear-gradient(135deg,transparent 0 36%,${theme.pattern} 36% 38%,transparent 38%),radial-gradient(circle at 20% 22%,${theme.pattern} 0 1px,transparent 2px)`,
          backgroundSize: crystal ? "44px 44px,60px 60px" : luxury ? "20px 20px,54px 54px" : "32px 32px,18px 18px",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,.18)_18%,transparent_30%,transparent_62%,rgba(255,255,255,.12)_76%,transparent_92%)] opacity-75" />
      <div className="absolute -inset-y-20 -left-20 w-16 rotate-[17deg] bg-white/25 blur-xl transition-transform duration-700 group-hover:translate-x-80" />
    </>
  );
}

function PlayerStage({ theme, rarity, imageSrc, name }: { theme: Theme; rarity: SlabRarity; imageSrc?: string; name: string }) {
  return (
    <div className="absolute inset-x-[6%] top-[21%] z-20 h-[40%]">
      <div className="absolute inset-0 rounded-[1.25rem]" style={{ background: theme.aura }} />
      {rarity !== "common" ? <div className="absolute inset-x-4 bottom-2 h-9 rounded-full bg-black/45 blur-md" /> : null}
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={name}
          className="absolute -top-4 left-1/2 h-[132%] w-[112%] -translate-x-1/2 object-contain drop-shadow-[0_18px_16px_rgba(0,0,0,.58)] transition-transform duration-300 group-hover:scale-[1.045]"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute left-1/2 top-8 h-24 w-20 -translate-x-1/2 rounded-xl bg-white/20" />
      )}
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
  shirtNumber = "10",
  age = 24,
  countryCode = "FC",
  position = "ST",
  stats,
  provenanceMarker = "",
}: SlabCardProps) {
  const theme = themes[rarity] ?? themes.common;
  const rating = clamp(Number(avgScore || 0), 1, 99);
  const { firstName, lastName } = splitName(name);
  const statRows = useMemo(() => getStats(rating, stats), [rating, stats]);
  const Icon = theme.Icon;

  return (
    <article
      className={["group relative w-[176px] max-w-full aspect-[0.69/1] select-none transition-all duration-300 hover:-translate-y-1 hover:scale-[1.025]", className].join(" ")}
      style={{ filter: `drop-shadow(${theme.glow})`, transformStyle: "preserve-3d" }}
    >
      <div className="absolute inset-0" style={{ clipPath: theme.shape, background: theme.frame }} />
      <div className="absolute inset-[3px]" style={{ clipPath: theme.shape, background: theme.face }} />
      <div className="absolute inset-[6px] border border-white/20" style={{ clipPath: theme.shape }} />

      <div className="absolute inset-[3px] overflow-hidden" style={{ clipPath: theme.shape }}>
        <FinePattern theme={theme} rarity={rarity} />
        <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.46),transparent_62%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/55 to-transparent" />
      </div>

      <div className={`absolute left-[9%] top-[8%] z-30 ${theme.text}`}>
        <div className="text-[30px] font-black leading-none tracking-tighter">{rating}</div>
        <div className="mt-1 text-[13px] font-black leading-none tracking-wide">{String(position || "ST").slice(0, 3).toUpperCase()}</div>
      </div>

      <div className={`absolute right-[8%] top-[8%] z-30 flex flex-col items-end gap-1 ${theme.text}`}>
        <div className={`rounded-full border px-2 py-0.5 text-[7px] font-black tracking-[.16em] ${theme.badge}`}>{theme.label}</div>
        <Icon className="h-5 w-5 opacity-90" />
      </div>

      <PlayerStage theme={theme} rarity={rarity} imageSrc={imageSrc} name={name} />

      <div className={`absolute inset-x-[9%] top-[61%] z-30 ${theme.text}`}>
        <div className="truncate text-[15px] font-black leading-none tracking-wide drop-shadow-[0_2px_5px_rgba(0,0,0,.45)]">{lastName}</div>
        <div className={`mt-1 truncate text-[8px] font-black uppercase tracking-[.18em] ${theme.muted}`}>{firstName} • {teamCode}</div>
      </div>

      <div className={`absolute inset-x-[8%] bottom-[13%] z-30 rounded-xl border px-2 py-1.5 ${theme.panel} backdrop-blur-sm`}>
        <div className="grid grid-cols-3 gap-x-2 gap-y-1">
          {statRows.map(([label, value]) => (
            <div key={label} className={`flex items-baseline justify-between gap-1 text-[9px] font-black ${theme.text}`}>
              <span>{value}</span>
              <span className={`text-[7px] ${theme.muted}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`absolute bottom-[5%] left-[9%] z-30 text-[7px] font-black ${theme.muted}`}>{String(countryCode).slice(0, 3).toUpperCase()} • AGE {age}</div>
      <div className={`absolute bottom-[5%] right-[9%] z-30 text-[7px] font-black ${theme.muted}`}>{serialNumber}</div>
      {provenanceMarker ? <div className={`absolute bottom-[9%] right-[9%] z-30 text-[6px] ${theme.muted}`}>{provenanceMarker}</div> : null}

      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ clipPath: theme.shape, boxShadow: `inset 0 0 0 1px ${theme.line}, inset 0 0 34px ${theme.line}` }} />
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_110%,rgba(255,255,255,.16),transparent_44%)]" />
      <span className="sr-only">{theme.title} {theme.label} fantasy player card</span>
    </article>
  );
}

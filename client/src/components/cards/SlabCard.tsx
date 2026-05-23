import { useMemo } from "react";
import { Shield, Sparkles, Star, Trophy } from "lucide-react";

export type SlabRarity = "common" | "rare" | "unique" | "legendary";

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
  last5?: number[];
  value?: string;
  status?: "active" | "legacy" | "uncovered_league";
  competitionEligible?: boolean;
  provenanceMarker?: string;
};

const rarityThemes: Record<
  SlabRarity,
  {
    label: string;
    shell: string;
    bevel: string;
    inner: string;
    accent: string;
    glow: string;
    badge: string;
    text: string;
    muted: string;
    line: string;
    playerAura: string;
    panel: string;
    pattern: string;
    stats: string;
  }
> = {
  common: {
    label: "COMMON",
    shell: "from-slate-200 via-white to-slate-400",
    bevel: "from-white via-slate-200 to-slate-500",
    inner: "from-slate-100 via-zinc-50 to-slate-300",
    accent: "rgba(148,163,184,0.95)",
    glow: "shadow-[0_18px_45px_rgba(226,232,240,0.22)]",
    badge: "bg-zinc-950/10 text-zinc-900 border-zinc-900/20",
    text: "text-zinc-950",
    muted: "text-zinc-700",
    line: "border-zinc-900/18",
    playerAura: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.95), rgba(148,163,184,0.24) 44%, transparent 68%)",
    panel: "bg-white/55 border-zinc-900/10",
    pattern: "rgba(15,23,42,0.08)",
    stats: "bg-zinc-950/10 text-zinc-900",
  },
  rare: {
    label: "RARE",
    shell: "from-rose-950 via-red-600 to-red-950",
    bevel: "from-red-200 via-red-600 to-red-950",
    inner: "from-red-950 via-rose-800 to-black",
    accent: "rgba(248,113,113,0.96)",
    glow: "shadow-[0_20px_55px_rgba(239,68,68,0.42)]",
    badge: "bg-white/12 text-white border-white/25",
    text: "text-white",
    muted: "text-white/72",
    line: "border-white/18",
    playerAura: "radial-gradient(circle at 50% 32%, rgba(254,202,202,0.78), rgba(220,38,38,0.32) 42%, transparent 70%)",
    panel: "bg-black/22 border-white/15",
    pattern: "rgba(255,255,255,0.12)",
    stats: "bg-white/12 text-white",
  },
  unique: {
    label: "UNIQUE",
    shell: "from-fuchsia-950 via-indigo-800 to-purple-950",
    bevel: "from-amber-200 via-fuchsia-500 to-indigo-950",
    inner: "from-indigo-950 via-violet-950 to-fuchsia-950",
    accent: "rgba(217,70,239,0.98)",
    glow: "shadow-[0_22px_65px_rgba(168,85,247,0.48)]",
    badge: "bg-white/12 text-white border-fuchsia-100/30",
    text: "text-white",
    muted: "text-white/72",
    line: "border-white/18",
    playerAura: "radial-gradient(circle at 50% 30%, rgba(253,224,71,0.58), rgba(168,85,247,0.40) 42%, transparent 72%)",
    panel: "bg-black/24 border-fuchsia-100/18",
    pattern: "rgba(255,255,255,0.13)",
    stats: "bg-white/12 text-white",
  },
  legendary: {
    label: "LEGENDARY",
    shell: "from-yellow-950 via-amber-400 to-yellow-800",
    bevel: "from-yellow-100 via-amber-300 to-yellow-900",
    inner: "from-yellow-300 via-amber-500 to-yellow-900",
    accent: "rgba(251,191,36,0.98)",
    glow: "shadow-[0_24px_70px_rgba(245,158,11,0.48)]",
    badge: "bg-black/12 text-black border-black/18",
    text: "text-black",
    muted: "text-black/66",
    line: "border-black/18",
    playerAura: "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.82), rgba(251,191,36,0.44) 44%, transparent 72%)",
    panel: "bg-yellow-50/38 border-black/10",
    pattern: "rgba(0,0,0,0.10)",
    stats: "bg-black/10 text-black",
  },
};

function splitName(name: string) {
  const parts = String(name || "PLAYER NAME")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "PLAYER", lastName: "NAME" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1).join(" ") };
}

function StatBars({ form, tone }: { form: number[]; tone: string }) {
  return (
    <div className="flex items-end gap-1">
      {form.map((value, index) => (
        <div key={`bar-${index}`} className={`w-1.5 rounded-sm ${tone}`} style={{ height: `${Math.max(8, Math.min(27, value * 0.24))}px` }} />
      ))}
    </div>
  );
}

function PremiumPattern({ pattern }: { pattern: string }) {
  return (
    <div
      className="absolute inset-0 opacity-80 mix-blend-overlay"
      style={{
        backgroundImage: `linear-gradient(120deg, transparent 0 28%, ${pattern} 28% 30%, transparent 30% 58%, ${pattern} 58% 60%, transparent 60%), radial-gradient(circle at 20% 18%, ${pattern} 0 1px, transparent 2px), radial-gradient(circle at 80% 22%, ${pattern} 0 1px, transparent 2px)`,
        backgroundSize: "52px 52px, 18px 18px, 22px 22px",
      }}
    />
  );
}

function StageBackdrop({ rarity, aura }: { rarity: SlabRarity; aura: string }) {
  const haloOpacity = rarity === "common" ? "opacity-55" : "opacity-90";
  return (
    <div className="absolute inset-x-2.5 top-[13%] h-[47%] overflow-hidden rounded-[1.05rem]">
      <div className={`absolute inset-0 ${haloOpacity}`} style={{ background: aura }} />
      <div className="absolute inset-x-4 bottom-1 h-[38%] rounded-[100%] bg-black/28 blur-md" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/30" />
      <div className="absolute -left-5 top-3 h-28 w-10 rotate-12 bg-white/16 blur-xl" />
      <div className="absolute -right-5 top-3 h-28 w-10 -rotate-12 bg-white/16 blur-xl" />
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
  teamCode = "LIV",
  shirtNumber = "10",
  age = 24,
  countryCode = "ARG",
  last5 = [65, 78, 72, 85, 80],
  provenanceMarker = "",
}: SlabCardProps) {
  const theme = rarityThemes[rarity] ?? rarityThemes.common;
  const bars = useMemo(() => {
    const values = Array.isArray(last5) ? last5.slice(0, 5).map((v) => Number(v || 0)) : [];
    while (values.length < 5) values.push(50);
    return values;
  }, [last5]);

  const { firstName, lastName } = splitName(name);
  const barTone = rarity === "legendary" || rarity === "common" ? "bg-black/70" : "bg-white/88";

  return (
    <article
      className={[
        "group relative w-[176px] max-w-full aspect-[0.57/1] overflow-hidden rounded-[1.65rem] p-[3px] bg-gradient-to-br transition-all duration-300 hover:-translate-y-1 hover:scale-[1.025]",
        theme.shell,
        theme.glow,
        className,
      ].join(" ")}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className={`absolute inset-0 rounded-[1.65rem] bg-gradient-to-br ${theme.bevel}`} />
      <div className="absolute inset-[1px] rounded-[1.55rem] border border-white/30" />

      <div className={`relative h-full overflow-hidden rounded-[1.45rem] border bg-gradient-to-b ${theme.inner} ${theme.line}`}>
        <PremiumPattern pattern={theme.pattern} />

        <div className="absolute inset-0 opacity-45 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.85),transparent_38%),linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.24)_18%,transparent_34%,transparent_58%,rgba(255,255,255,0.18)_72%,transparent_88%)]" />
        <div className="absolute -inset-y-20 -left-16 w-14 rotate-[18deg] bg-white/24 blur-xl transition-transform duration-700 group-hover:translate-x-72" />

        <div className={`absolute inset-x-2.5 top-2 z-30 flex items-center justify-between text-[8px] font-black tracking-wide ${theme.text}`}>
          <div className={`rounded-full border px-2 py-0.5 ${theme.panel}`}>{season}</div>
          <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${theme.panel}`}>
            <span>{teamCode}</span>
            {!!shirtNumber && <span>#{shirtNumber}</span>}
          </div>
        </div>

        <div className="absolute left-3 top-11 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/18 shadow-inner">
          <Shield className={`h-3.5 w-3.5 ${theme.text}`} />
        </div>
        <div className="absolute right-3 top-11 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/18 shadow-inner">
          <Trophy className={`h-3.5 w-3.5 ${theme.text}`} />
        </div>

        <StageBackdrop rarity={rarity} aura={theme.playerAura} />

        <div className="absolute inset-x-0 top-[16%] z-20 flex justify-center">
          <div className="relative h-[136px] w-[132px]">
            <div className="absolute inset-x-4 bottom-2 h-7 rounded-[100%] bg-black/35 blur-md" />
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={name}
                className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_14px_16px_rgba(0,0,0,0.50)] transition-transform duration-300 group-hover:scale-[1.04]"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="mx-auto mt-6 h-24 w-20 rounded-xl bg-white/20" />
            )}
          </div>
        </div>

        <div className={`absolute inset-x-3 top-[56%] z-30 rounded-2xl border px-2.5 py-2 ${theme.panel} ${theme.text} backdrop-blur-md`}>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className={`mb-1 text-[6px] font-black tracking-[0.18em] ${theme.muted}`}>LAST 5</div>
              <StatBars form={bars} tone={barTone} />
            </div>
            <div className="text-right">
              <div className={`text-[6px] font-black tracking-[0.16em] ${theme.muted}`}>AVG</div>
              <div className="text-[23px] font-black leading-none tracking-tighter">{Number(avgScore || 0).toFixed(0)}</div>
            </div>
          </div>
        </div>

        <div className={`absolute inset-x-3 bottom-[11%] z-30 rounded-2xl border px-2 py-2 text-center ${theme.panel} ${theme.text} backdrop-blur-md`}>
          <div className="leading-[0.9]">
            <div className="truncate text-[10px] font-black tracking-[0.08em]">{firstName}</div>
            <div className="mt-1 truncate text-[13px] font-black tracking-[0.08em]">{lastName}</div>
          </div>
          <div className={`mt-1 flex items-center justify-center gap-1 text-[7px] font-black tracking-[0.18em] ${theme.muted}`}>
            <Sparkles className="h-2.5 w-2.5" />
            <span>{theme.label}</span>
          </div>
        </div>

        <div className={`absolute bottom-2.5 left-3 z-30 text-[7px] font-black ${theme.muted}`}>AGE {age}</div>
        <div className={`absolute bottom-2.5 right-3 z-30 text-[7px] font-black ${theme.muted}`}>{String(countryCode).slice(0, 3).toUpperCase()}</div>

        <div className={`absolute left-3 top-[75%] z-30 rounded-full border px-1.5 py-0.5 text-[6px] font-black tracking-wide ${theme.badge}`}>{theme.label}</div>
        <div className={`absolute right-3 top-[75%] z-30 flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[6px] font-black ${theme.badge}`}>
          <Star className="h-2.5 w-2.5" />
          <span>{serialNumber}</span>
        </div>

        {provenanceMarker ? <div className="absolute right-3 top-[84%] z-30 text-[6px] text-white/70">{provenanceMarker}</div> : null}
      </div>
    </article>
  );
}

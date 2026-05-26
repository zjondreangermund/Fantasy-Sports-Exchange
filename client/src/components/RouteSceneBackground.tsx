import { useMemo } from "react";

type SceneKey =
  | "dashboard"
  | "lineup"
  | "market"
  | "analytics"
  | "competitions"
  | "collection"
  | "wallet"
  | "league"
  | "admin"
  | "default";

type SceneConfig = {
  base: string;
  primary: string;
  secondary: string;
  accent: string;
  pattern: string;
  beams: string;
  vignette: string;
};

const scenes: Record<SceneKey, SceneConfig> = {
  dashboard: {
    base: "from-[#050816] via-[#07111f] to-[#02040a]",
    primary: "rgba(34,211,238,.16)",
    secondary: "rgba(37,99,235,.16)",
    accent: "rgba(16,185,129,.10)",
    pattern: "opacity-[.18]",
    beams: "opacity-45",
    vignette: "from-black/10 via-transparent to-black/55",
  },
  lineup: {
    base: "from-[#03110d] via-[#061422] to-[#020409]",
    primary: "rgba(16,185,129,.18)",
    secondary: "rgba(34,197,94,.12)",
    accent: "rgba(59,130,246,.13)",
    pattern: "opacity-[.22]",
    beams: "opacity-55",
    vignette: "from-emerald-950/10 via-transparent to-black/65",
  },
  market: {
    base: "from-[#080914] via-[#07111f] to-[#03040a]",
    primary: "rgba(250,204,21,.10)",
    secondary: "rgba(59,130,246,.16)",
    accent: "rgba(168,85,247,.12)",
    pattern: "opacity-[.16]",
    beams: "opacity-50",
    vignette: "from-amber-950/10 via-transparent to-black/70",
  },
  analytics: {
    base: "from-[#050a14] via-[#06101d] to-[#02050b]",
    primary: "rgba(56,189,248,.12)",
    secondary: "rgba(20,184,166,.12)",
    accent: "rgba(99,102,241,.10)",
    pattern: "opacity-[.26]",
    beams: "opacity-35",
    vignette: "from-cyan-950/5 via-transparent to-black/65",
  },
  competitions: {
    base: "from-[#090711] via-[#111827] to-[#03040a]",
    primary: "rgba(251,191,36,.16)",
    secondary: "rgba(37,99,235,.14)",
    accent: "rgba(236,72,153,.10)",
    pattern: "opacity-[.18]",
    beams: "opacity-60",
    vignette: "from-yellow-950/10 via-transparent to-black/70",
  },
  collection: {
    base: "from-[#060712] via-[#0b1220] to-[#03040a]",
    primary: "rgba(148,163,184,.12)",
    secondary: "rgba(168,85,247,.13)",
    accent: "rgba(34,211,238,.10)",
    pattern: "opacity-[.14]",
    beams: "opacity-42",
    vignette: "from-slate-900/15 via-transparent to-black/70",
  },
  wallet: {
    base: "from-[#04110f] via-[#07111f] to-[#02040a]",
    primary: "rgba(52,211,153,.15)",
    secondary: "rgba(14,165,233,.11)",
    accent: "rgba(250,204,21,.08)",
    pattern: "opacity-[.13]",
    beams: "opacity-35",
    vignette: "from-emerald-950/10 via-transparent to-black/70",
  },
  league: {
    base: "from-[#050816] via-[#07162a] to-[#02040a]",
    primary: "rgba(59,130,246,.18)",
    secondary: "rgba(34,211,238,.12)",
    accent: "rgba(16,185,129,.08)",
    pattern: "opacity-[.17]",
    beams: "opacity-48",
    vignette: "from-blue-950/10 via-transparent to-black/65",
  },
  admin: {
    base: "from-[#0b0711] via-[#111827] to-[#03040a]",
    primary: "rgba(244,63,94,.12)",
    secondary: "rgba(99,102,241,.12)",
    accent: "rgba(34,211,238,.08)",
    pattern: "opacity-[.20]",
    beams: "opacity-32",
    vignette: "from-rose-950/10 via-transparent to-black/70",
  },
  default: {
    base: "from-[#050812] via-[#07111f] to-[#02040a]",
    primary: "rgba(37,99,235,.14)",
    secondary: "rgba(34,211,238,.10)",
    accent: "rgba(148,163,184,.08)",
    pattern: "opacity-[.15]",
    beams: "opacity-35",
    vignette: "from-black/10 via-transparent to-black/65",
  },
};

function sceneFromPath(pathname: string): SceneKey {
  if (pathname === "/" || pathname === "/dashboard") return "dashboard";
  if (pathname.startsWith("/live-lineup")) return "lineup";
  if (pathname.startsWith("/marketplace") || pathname.startsWith("/auctions")) return "market";
  if (pathname.startsWith("/analytics")) return "analytics";
  if (pathname.startsWith("/competitions")) return "competitions";
  if (pathname.startsWith("/collection") || pathname.startsWith("/card-lab") || pathname.startsWith("/card-reveal")) return "collection";
  if (pathname.startsWith("/wallet") || pathname.startsWith("/account")) return "wallet";
  if (pathname.startsWith("/premier-league")) return "league";
  if (pathname.startsWith("/admin")) return "admin";
  return "default";
}

export default function RouteSceneBackground({ pathname }: { pathname: string }) {
  const scene = useMemo(() => scenes[sceneFromPath(pathname)] || scenes.default, [pathname]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#050812]">
      <div className={`absolute inset-0 bg-gradient-to-br ${scene.base}`} />

      <div
        className="absolute -left-[18%] -top-[22%] h-[58rem] w-[58rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${scene.primary} 0%, transparent 62%)` }}
      />
      <div
        className="absolute -right-[20%] top-[4%] h-[48rem] w-[48rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${scene.secondary} 0%, transparent 64%)` }}
      />
      <div
        className="absolute bottom-[-26%] left-[22%] h-[42rem] w-[42rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${scene.accent} 0%, transparent 66%)` }}
      />

      <div className={`absolute inset-0 ${scene.pattern} bg-[linear-gradient(90deg,rgba(255,255,255,.055)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:56px_56px]`} />
      <div className="absolute inset-0 opacity-[.18] bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,.18),transparent_34%)]" />

      <div className={`absolute inset-x-[-15%] top-[-20%] h-64 rotate-[-8deg] bg-gradient-to-r from-transparent via-white/8 to-transparent blur-xl ${scene.beams}`} />
      <div className={`absolute inset-x-[-20%] top-[28%] h-44 rotate-[7deg] bg-gradient-to-r from-transparent via-cyan-200/7 to-transparent blur-2xl ${scene.beams}`} />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/65 to-transparent" />
      <div className={`absolute inset-0 bg-gradient-to-b ${scene.vignette}`} />
    </div>
  );
}

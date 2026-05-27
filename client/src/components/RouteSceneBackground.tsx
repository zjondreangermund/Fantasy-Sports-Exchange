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
  image: string;
  imageOpacity: string;
  primary: string;
  secondary: string;
  accent: string;
  grid: string;
  overlay: string;
  label: string;
};

const scenes: Record<SceneKey, SceneConfig> = {
  dashboard: {
    base: "from-[#020617] via-[#061526] to-[#02040a]",
    image: "url(https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.30]",
    primary: "rgba(34,211,238,.34)",
    secondary: "rgba(59,130,246,.28)",
    accent: "rgba(16,185,129,.20)",
    grid: "opacity-[.23]",
    overlay: "from-cyan-950/25 via-transparent to-black/80",
    label: "CONTROL ROOM",
  },
  lineup: {
    base: "from-[#02120d] via-[#06251a] to-[#020409]",
    image: "url(https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.32]",
    primary: "rgba(34,197,94,.38)",
    secondary: "rgba(16,185,129,.24)",
    accent: "rgba(59,130,246,.22)",
    grid: "opacity-[.30]",
    overlay: "from-emerald-950/30 via-transparent to-black/82",
    label: "MATCHDAY LIVE",
  },
  market: {
    base: "from-[#090711] via-[#101827] to-[#03040a]",
    image: "url(https://images.unsplash.com/photo-1640340434855-6084b1f4901c?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.24]",
    primary: "rgba(251,191,36,.30)",
    secondary: "rgba(168,85,247,.28)",
    accent: "rgba(59,130,246,.26)",
    grid: "opacity-[.22]",
    overlay: "from-amber-950/30 via-transparent to-black/84",
    label: "TRADING FLOOR",
  },
  analytics: {
    base: "from-[#020817] via-[#061523] to-[#02050b]",
    image: "url(https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.20]",
    primary: "rgba(56,189,248,.32)",
    secondary: "rgba(20,184,166,.25)",
    accent: "rgba(99,102,241,.24)",
    grid: "opacity-[.35]",
    overlay: "from-cyan-950/22 via-transparent to-black/86",
    label: "DATA LAB",
  },
  competitions: {
    base: "from-[#0b0611] via-[#141827] to-[#03040a]",
    image: "url(https://images.unsplash.com/photo-1518604666860-9ed391f76460?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.32]",
    primary: "rgba(251,191,36,.34)",
    secondary: "rgba(37,99,235,.28)",
    accent: "rgba(236,72,153,.22)",
    grid: "opacity-[.22]",
    overlay: "from-yellow-950/30 via-transparent to-black/86",
    label: "TOURNAMENT NIGHT",
  },
  collection: {
    base: "from-[#04040b] via-[#09111f] to-[#02040a]",
    image: "url(https://images.unsplash.com/photo-1518005020951-eccb494ad742?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.28]",
    primary: "rgba(148,163,184,.26)",
    secondary: "rgba(168,85,247,.30)",
    accent: "rgba(34,211,238,.22)",
    grid: "opacity-[.20]",
    overlay: "from-slate-950/30 via-transparent to-black/84",
    label: "CARD VAULT",
  },
  wallet: {
    base: "from-[#02110e] via-[#06131e] to-[#02040a]",
    image: "url(https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.22]",
    primary: "rgba(52,211,153,.34)",
    secondary: "rgba(14,165,233,.24)",
    accent: "rgba(250,204,21,.16)",
    grid: "opacity-[.22]",
    overlay: "from-emerald-950/28 via-transparent to-black/84",
    label: "FINANCE HUB",
  },
  league: {
    base: "from-[#020617] via-[#071a32] to-[#02040a]",
    image: "url(https://images.unsplash.com/photo-1556056504-5c7696c4c28d?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.28]",
    primary: "rgba(59,130,246,.35)",
    secondary: "rgba(34,211,238,.24)",
    accent: "rgba(16,185,129,.18)",
    grid: "opacity-[.24]",
    overlay: "from-blue-950/26 via-transparent to-black/82",
    label: "LIVE LEAGUES",
  },
  admin: {
    base: "from-[#090611] via-[#111827] to-[#03040a]",
    image: "url(https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.20]",
    primary: "rgba(244,63,94,.28)",
    secondary: "rgba(99,102,241,.24)",
    accent: "rgba(34,211,238,.16)",
    grid: "opacity-[.24]",
    overlay: "from-rose-950/24 via-transparent to-black/86",
    label: "ADMIN OPS",
  },
  default: {
    base: "from-[#050812] via-[#07111f] to-[#02040a]",
    image: "url(https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=2400&auto=format&fit=crop)",
    imageOpacity: "opacity-[.20]",
    primary: "rgba(37,99,235,.24)",
    secondary: "rgba(34,211,238,.18)",
    accent: "rgba(148,163,184,.14)",
    grid: "opacity-[.18]",
    overlay: "from-black/20 via-transparent to-black/82",
    label: "FANTASY ARENA",
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
        className={`absolute inset-0 ${scene.imageOpacity} mix-blend-screen`}
        style={{ backgroundImage: scene.image, backgroundSize: "cover", backgroundPosition: "center", filter: "contrast(1.08) saturate(1.1)" }}
      />
      <div className="absolute inset-0 bg-black/45" />

      <div
        className="absolute -left-[15%] -top-[20%] h-[58rem] w-[58rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${scene.primary} 0%, transparent 58%)` }}
      />
      <div
        className="absolute -right-[18%] top-[2%] h-[50rem] w-[50rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${scene.secondary} 0%, transparent 58%)` }}
      />
      <div
        className="absolute bottom-[-24%] left-[26%] h-[44rem] w-[44rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${scene.accent} 0%, transparent 60%)` }}
      />

      <div className={`absolute inset-0 ${scene.grid} bg-[linear-gradient(90deg,rgba(255,255,255,.10)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.08)_1px,transparent_1px)] bg-[size:54px_54px]`} />
      <div className="absolute inset-0 opacity-[.20] bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,.22),transparent_36%)]" />

      <div className="absolute left-10 top-16 hidden text-[12vw] font-black uppercase leading-none tracking-[.08em] text-white/[.035] lg:block">
        {scene.label}
      </div>

      <div className="absolute inset-x-[-18%] top-[-15%] h-72 rotate-[-8deg] bg-gradient-to-r from-transparent via-white/14 to-transparent blur-xl opacity-70" />
      <div className="absolute inset-x-[-20%] top-[30%] h-52 rotate-[7deg] bg-gradient-to-r from-transparent via-cyan-200/12 to-transparent blur-2xl opacity-55" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/80 to-transparent" />
      <div className={`absolute inset-0 bg-gradient-to-b ${scene.overlay}`} />
    </div>
  );
}

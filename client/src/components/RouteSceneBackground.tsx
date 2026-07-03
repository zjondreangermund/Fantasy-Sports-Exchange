import { useMemo } from "react";

type SceneKey =
  | "dashboard"
  | "lineup"
  | "market"
  | "auction"
  | "analytics"
  | "competitions"
  | "collection"
  | "wallet"
  | "account"
  | "league"
  | "lab"
  | "admin"
  | "default";

type SceneConfig = {
  base: string;
  image: string;
  imageOpacity: string;
  primary: string;
  secondary: string;
  accent: string;
  overlay: string;
  label: string;
};

const footballStadiumImage = "url(https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=2400&auto=format&fit=crop)";

const scenes: Record<SceneKey, SceneConfig> = {
  dashboard: {
    base: "from-[#020617] via-[#061526] to-[#02040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.34]",
    primary: "rgba(34,211,238,.34)",
    secondary: "rgba(59,130,246,.28)",
    accent: "rgba(16,185,129,.20)",
    overlay: "from-cyan-950/20 via-transparent to-black/82",
    label: "CONTROL ROOM",
  },
  lineup: {
    base: "from-[#02120d] via-[#06251a] to-[#020409]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.38]",
    primary: "rgba(34,197,94,.38)",
    secondary: "rgba(16,185,129,.24)",
    accent: "rgba(59,130,246,.22)",
    overlay: "from-emerald-950/24 via-transparent to-black/84",
    label: "MATCHDAY LIVE",
  },
  market: {
    base: "from-[#090711] via-[#101827] to-[#03040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.30]",
    primary: "rgba(251,191,36,.30)",
    secondary: "rgba(168,85,247,.28)",
    accent: "rgba(59,130,246,.26)",
    overlay: "from-amber-950/24 via-transparent to-black/86",
    label: "TRADING FLOOR",
  },
  auction: {
    base: "from-[#130706] via-[#1f1012] to-[#050304]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.32]",
    primary: "rgba(251,113,133,.34)",
    secondary: "rgba(249,115,22,.28)",
    accent: "rgba(168,85,247,.20)",
    overlay: "from-orange-950/22 via-transparent to-black/86",
    label: "AUCTION HOUSE",
  },
  analytics: {
    base: "from-[#020817] via-[#061523] to-[#02050b]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.28]",
    primary: "rgba(56,189,248,.32)",
    secondary: "rgba(20,184,166,.25)",
    accent: "rgba(99,102,241,.24)",
    overlay: "from-cyan-950/18 via-transparent to-black/86",
    label: "DATA LAB",
  },
  competitions: {
    base: "from-[#0b0611] via-[#141827] to-[#03040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.38]",
    primary: "rgba(251,191,36,.34)",
    secondary: "rgba(37,99,235,.28)",
    accent: "rgba(236,72,153,.22)",
    overlay: "from-yellow-950/22 via-transparent to-black/86",
    label: "TOURNAMENT NIGHT",
  },
  collection: {
    base: "from-[#04040b] via-[#09111f] to-[#02040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.32]",
    primary: "rgba(148,163,184,.26)",
    secondary: "rgba(168,85,247,.30)",
    accent: "rgba(34,211,238,.22)",
    overlay: "from-slate-950/22 via-transparent to-black/86",
    label: "CARD VAULT",
  },
  wallet: {
    base: "from-[#02110e] via-[#06131e] to-[#02040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.28]",
    primary: "rgba(52,211,153,.34)",
    secondary: "rgba(14,165,233,.24)",
    accent: "rgba(250,204,21,.16)",
    overlay: "from-emerald-950/22 via-transparent to-black/84",
    label: "FINANCE HUB",
  },
  account: {
    base: "from-[#050816] via-[#10162a] to-[#03040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.24]",
    primary: "rgba(129,140,248,.30)",
    secondary: "rgba(45,212,191,.18)",
    accent: "rgba(244,114,182,.14)",
    overlay: "from-indigo-950/20 via-transparent to-black/84",
    label: "CLUB OFFICE",
  },
  league: {
    base: "from-[#020617] via-[#071a32] to-[#02040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.32]",
    primary: "rgba(59,130,246,.35)",
    secondary: "rgba(34,211,238,.24)",
    accent: "rgba(16,185,129,.18)",
    overlay: "from-blue-950/22 via-transparent to-black/82",
    label: "LIVE LEAGUES",
  },
  lab: {
    base: "from-[#090611] via-[#111827] to-[#03040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.28]",
    primary: "rgba(168,85,247,.34)",
    secondary: "rgba(34,211,238,.22)",
    accent: "rgba(250,204,21,.14)",
    overlay: "from-purple-950/22 via-transparent to-black/86",
    label: "CARD LAB",
  },
  admin: {
    base: "from-[#090611] via-[#111827] to-[#03040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.24]",
    primary: "rgba(244,63,94,.28)",
    secondary: "rgba(99,102,241,.24)",
    accent: "rgba(34,211,238,.16)",
    overlay: "from-rose-950/20 via-transparent to-black/86",
    label: "ADMIN OPS",
  },
  default: {
    base: "from-[#050812] via-[#07111f] to-[#02040a]",
    image: footballStadiumImage,
    imageOpacity: "opacity-[.30]",
    primary: "rgba(37,99,235,.24)",
    secondary: "rgba(34,211,238,.18)",
    accent: "rgba(148,163,184,.14)",
    overlay: "from-black/16 via-transparent to-black/84",
    label: "FANTASY ARENA",
  },
};

function sceneFromPath(pathname: string): SceneKey {
  if (pathname === "/" || pathname === "/dashboard") return "dashboard";
  if (pathname.startsWith("/live-lineup") || pathname.startsWith("/select-squad")) return "lineup";
  if (pathname.startsWith("/marketplace")) return "market";
  if (pathname.startsWith("/auctions")) return "auction";
  if (pathname.startsWith("/analytics")) return "analytics";
  if (pathname.startsWith("/competitions")) return "competitions";
  if (pathname.startsWith("/collection") || pathname.startsWith("/card-reveal")) return "collection";
  if (pathname.startsWith("/card-lab")) return "lab";
  if (pathname.startsWith("/wallet")) return "wallet";
  if (pathname.startsWith("/account")) return "account";
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
        style={{ backgroundImage: scene.image, backgroundSize: "cover", backgroundPosition: "center", filter: "contrast(1.12) saturate(1.18) brightness(.95)" }}
      />
      <div className="absolute inset-0 bg-black/42" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/86 to-transparent" />

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

      <div className="absolute inset-0 opacity-[.16] bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,.20),transparent_36%)]" />
      <div className="absolute left-10 top-16 hidden text-[12vw] font-black uppercase leading-none tracking-[.08em] text-white/[.025] lg:block">
        {scene.label}
      </div>
      <div className="absolute inset-x-[-18%] top-[-15%] h-72 rotate-[-8deg] bg-gradient-to-r from-transparent via-white/12 to-transparent blur-xl opacity-55" />
      <div className="absolute inset-x-[-20%] top-[30%] h-52 rotate-[7deg] bg-gradient-to-r from-transparent via-cyan-200/10 to-transparent blur-2xl opacity-45" />
      <div className={`absolute inset-0 bg-gradient-to-b ${scene.overlay}`} />
    </div>
  );
}

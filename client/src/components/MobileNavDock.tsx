import { useLocation } from "wouter";
import { Gem, Home, ShoppingCart, Trophy, UserCircle } from "lucide-react";
import { Link } from "wouter";

type MobileNavItem = {
  title: string;
  href: string;
  icon: typeof Home;
  accent: string;
  glow: string;
};

const items: MobileNavItem[] = [
  { title: "Home", href: "/", icon: Home, accent: "from-cyan-200 via-sky-300 to-blue-500", glow: "rgba(56,189,248,.48)" },
  { title: "Play", href: "/competitions", icon: Trophy, accent: "from-amber-200 via-orange-300 to-rose-400", glow: "rgba(251,191,36,.50)" },
  { title: "Cards", href: "/collection", icon: Gem, accent: "from-violet-200 via-fuchsia-300 to-purple-500", glow: "rgba(168,85,247,.58)" },
  { title: "Market", href: "/marketplace", icon: ShoppingCart, accent: "from-emerald-200 via-cyan-300 to-teal-500", glow: "rgba(45,212,191,.50)" },
  { title: "Profile", href: "/account", icon: UserCircle, accent: "from-slate-100 via-indigo-200 to-purple-400", glow: "rgba(199,210,254,.42)" },
];

function isActivePath(location: string, href: string) {
  if (href === "/") return location === "/" || location === "/dashboard";
  return location === href || location.startsWith(`${href}/`);
}

export default function MobileNavDock() {
  const [location] = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)] md:hidden" aria-label="Mobile primary navigation">
      <div className="relative mx-auto max-w-md overflow-hidden rounded-[2rem] border border-white/15 bg-[#080b1d]/92 p-1.5 shadow-[0_-1.4rem_5rem_rgba(0,0,0,.62),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(168,85,247,.35),transparent_42%),linear-gradient(180deg,rgba(255,255,255,.10),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        <div className="relative grid grid-cols-5 gap-1">
          {items.map((item) => {
            const active = isActivePath(location, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group relative flex min-h-[4.35rem] flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.45rem] px-1 text-[0.58rem] font-black uppercase tracking-[0.08em] transition-all duration-300 active:scale-95",
                  active ? "text-white" : "text-slate-500 hover:text-slate-200",
                ].join(" ")}
                data-testid={`mobile-nav-${item.title.toLowerCase()}`}
              >
                {active ? <div className={`absolute inset-0 bg-gradient-to-br ${item.accent} opacity-24`} /> : null}
                {active ? <div className="absolute inset-0 rounded-[1.45rem] border border-white/20" /> : null}
                {active ? <div className="absolute left-1/2 top-1 h-1 w-10 -translate-x-1/2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.8)]" /> : null}
                {active ? <div className="absolute bottom-1 left-1/2 h-8 w-12 -translate-x-1/2 rounded-full blur-xl" style={{ background: item.glow }} /> : null}
                <div className={active ? `relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br ${item.accent} shadow-[0_10px_28px_rgba(0,0,0,.38)]` : "relative grid h-10 w-10 place-items-center rounded-2xl bg-white/[.04]"}>
                  <Icon className={active ? "h-5 w-5 text-white drop-shadow" : "h-5 w-5 text-slate-500 group-hover:text-cyan-200"} />
                </div>
                <span className="relative leading-none">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

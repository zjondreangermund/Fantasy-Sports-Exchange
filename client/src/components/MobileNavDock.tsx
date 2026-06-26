import { useLocation } from "wouter";
import { Gem, Home, ShoppingCart, Trophy, UserCircle } from "lucide-react";
import { Link } from "wouter";

type MobileNavItem = {
  title: string;
  href: string;
  icon: typeof Home;
  accent: string;
};

const items: MobileNavItem[] = [
  { title: "Home", href: "/", icon: Home, accent: "from-cyan-300 to-blue-400" },
  { title: "Play", href: "/competitions", icon: Trophy, accent: "from-amber-300 to-orange-400" },
  { title: "Cards", href: "/collection", icon: Gem, accent: "from-violet-300 to-fuchsia-400" },
  { title: "Market", href: "/marketplace", icon: ShoppingCart, accent: "from-emerald-300 to-cyan-400" },
  { title: "Profile", href: "/account", icon: UserCircle, accent: "from-slate-200 to-purple-300" },
];

function isActivePath(location: string, href: string) {
  if (href === "/") return location === "/" || location === "/dashboard";
  return location === href || location.startsWith(`${href}/`);
}

export default function MobileNavDock() {
  const [location] = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)] md:hidden" aria-label="Mobile primary navigation">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[1.6rem] border border-white/10 bg-slate-950/88 p-1.5 shadow-[0_-1.2rem_4rem_rgba(0,0,0,0.50)] backdrop-blur-2xl">
        {items.map((item) => {
          const active = isActivePath(location, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group relative flex min-h-13 flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.1rem] px-1 text-[0.58rem] font-black uppercase tracking-[0.07em] transition-all",
                active ? "text-white" : "text-slate-500 hover:text-slate-200",
              ].join(" ")}
              data-testid={`mobile-nav-${item.title.toLowerCase()}`}
            >
              {active ? <div className={`absolute inset-0 bg-gradient-to-br ${item.accent} opacity-18`} /> : null}
              {active ? <div className={`absolute inset-x-3 top-1 h-0.5 rounded-full bg-gradient-to-r ${item.accent}`} /> : null}
              <Icon className={active ? "relative h-5 w-5 text-white" : "relative h-5 w-5 text-slate-500 group-hover:text-cyan-200"} />
              <span className="relative leading-none">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

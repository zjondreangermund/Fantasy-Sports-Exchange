import * as React from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  BookOpen,
  ChevronRight,
  CircleUserRound,
  Gem,
  Home,
  Menu,
  ShieldQuestion,
  ShoppingBag,
  Sparkles,
  Trophy,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import UnreadNotificationDot from "../UnreadNotificationDot";
import NativeAppUpdatePrompt from "./NativeAppUpdatePrompt";
import NativeRouteBoundary from "./NativeRouteBoundary";
import NativePlayPage from "./NativePlayPage";
import NativeSquadPage from "./NativeSquadPage";
import NativeCardsPage from "./NativeCardsPage";

type NativeMobileShellProps = {
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

const primaryItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Play", href: "/competitions", icon: Trophy },
  { label: "Squad", href: "/live-lineup", icon: UsersRound },
  { label: "Cards", href: "/collection", icon: Gem },
];

const moreItems: Array<NavItem & { description: string }> = [
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag, description: "Buy cards and manage your listings" },
  { label: "Prize Vault", href: "/prize-vault", icon: Sparkles, description: "See the rarity ladders and rewards" },
  { label: "Wallet", href: "/wallet", icon: WalletCards, description: "Balance, deposits and transactions" },
  { label: "Premier League", href: "/premier-league", icon: Trophy, description: "Fixtures and matchday context" },
  { label: "Profile & Inbox", href: "/account", icon: CircleUserRound, description: "Your club, alerts and referrals" },
  { label: "Scoring Rules", href: "/legal/scoring", icon: BookOpen, description: "Understand exactly how points work" },
  { label: "Help Centre", href: "/help", icon: ShieldQuestion, description: "Rules, support and account help" },
];

function isActive(location: string, href: string) {
  if (href === "/") return location === "/" || location === "/dashboard";
  if (href === "/live-lineup") return location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries");
  return location === href || location.startsWith(`${href}/`);
}

function routeTitle(location: string) {
  if (location === "/" || location === "/dashboard") return "Matchday HQ";
  if (location.startsWith("/competitions") || location.startsWith("/free") || location.startsWith("/play-free")) return "Play";
  if (location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries")) return "My Squad";
  if (location.startsWith("/collection")) return "My Cards";
  if (location.startsWith("/marketplace")) return "Marketplace";
  if (location.startsWith("/prize-vault")) return "Prize Vault";
  if (location.startsWith("/wallet")) return "Wallet";
  if (location.startsWith("/premier-league") || location.startsWith("/leagues")) return "Premier League";
  if (location.startsWith("/account") || location.startsWith("/profile")) return "My Club";
  if (location.startsWith("/legal/scoring")) return "Scoring";
  if (location.startsWith("/help") || location.startsWith("/faq")) return "Help";
  return "Fantasy Arena";
}

function compactNativePage(location: string, children: React.ReactNode, nativeFull: boolean) {
  if (nativeFull) return children;
  if (location.startsWith("/competitions") || location.startsWith("/free") || location.startsWith("/play-free")) return <NativePlayPage />;
  if (location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries")) return <NativeSquadPage />;
  if (location.startsWith("/collection")) return <NativeCardsPage />;
  return children;
}

export default function NativeMobileShell({ children }: NativeMobileShellProps) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const nativeFull = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("nativeFull") === "1";
  const pageContent = compactNativePage(location, children, nativeFull);

  React.useEffect(() => {
    setMoreOpen(false);
  }, [location]);

  return (
    <div
      className="relative flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#050713] text-white"
      data-native-mobile-shell
    >
      <style>{`
        [data-native-mobile-shell] [data-native-full-route="true"] > main {
          min-height: 0 !important;
          overflow: visible !important;
          max-width: 100% !important;
        }
        [data-native-mobile-shell] [data-native-full-route="true"] .max-w-7xl,
        [data-native-mobile-shell] [data-native-full-route="true"] .max-w-6xl,
        [data-native-mobile-shell] [data-native-full-route="true"] .max-w-5xl {
          max-width: 100% !important;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,.16),transparent_42%),radial-gradient(circle_at_90%_10%,rgba(139,92,246,.22),transparent_46%)]" />

      <header className="relative z-40 flex shrink-0 items-center justify-between border-b border-white/[.07] bg-[#070a18]/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] backdrop-blur-2xl">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Fantasy Arena home">
          <img
            src="/brand/fantasy-arena-logo.jpg"
            alt="Fantasy Arena"
            className="h-10 w-10 shrink-0 rounded-[0.9rem] border border-white/10 object-cover shadow-[0_0_24px_rgba(139,92,246,.2)]"
          />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.23em] text-cyan-200/70">Fantasy Arena</p>
            <h1 className="truncate text-[17px] font-black leading-tight text-white">{routeTitle(location)}</h1>
          </div>
        </Link>
        <Link
          href="/account?tab=inbox"
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[.055] text-slate-200 active:scale-95"
          aria-label="Open notifications"
        >
          <Bell className="h-5 w-5" />
          <UnreadNotificationDot className="absolute right-1.5 top-1.5" />
        </Link>
      </header>

      <main
        className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]"
        data-app-scroll-root
      >
        <NativeRouteBoundary key={`${location}:${nativeFull ? "full" : "compact"}`} routeKey={location}>
          <div className="min-w-0" data-page-scroll-content data-native-full-route={nativeFull ? "true" : "false"}>{pageContent}</div>
        </NativeRouteBoundary>
      </main>

      <nav
        className="absolute inset-x-0 bottom-0 z-50 border-t border-white/[.08] bg-[#070a18]/95 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)] pt-1.5 backdrop-blur-2xl"
        aria-label="Fantasy Arena app navigation"
      >
        <div className="grid grid-cols-5 gap-1">
          {primaryItems.map((item) => {
            const active = isActive(location, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-[3.7rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-extrabold transition active:scale-95 ${active ? "bg-cyan-300/[.11] text-cyan-100" : "text-slate-500"}`}
              >
                {active ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,.8)]" /> : null}
                <Icon className={`h-[21px] w-[21px] ${active ? "text-cyan-300" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-[3.7rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-extrabold transition active:scale-95 ${moreOpen ? "bg-violet-300/[.11] text-violet-100" : "text-slate-500"}`}
            aria-label="Open more Fantasy Arena features"
          >
            <Menu className={`h-[21px] w-[21px] ${moreOpen ? "text-violet-300" : "text-slate-500"}`} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="absolute inset-0 z-[90] flex items-end bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="More Fantasy Arena features">
          <button className="absolute inset-0" onClick={() => setMoreOpen(false)} aria-label="Close more menu" />
          <section className="relative z-10 max-h-[82dvh] w-full overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-[#0a0d1c] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-4 shadow-[0_-2rem_5rem_rgba(0,0,0,.65)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-300/75">Club menu</p>
                <h2 className="mt-1 text-xl font-black">More ways to play</h2>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.035] p-3.5 active:scale-[.99]">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300/15 to-violet-400/15 text-cyan-200"><Icon className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><p className="font-bold text-white">{item.label}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{item.description}</p></div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      <NativeAppUpdatePrompt />
    </div>
  );
}

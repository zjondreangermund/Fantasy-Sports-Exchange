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
import NativeHomePage from "./NativeHomePage";
import NativePlayPage from "./NativePlayPage";
import NativeSquadPage from "./NativeSquadPage";
import NativeCardsPage from "./NativeCardsPage";
import NativeMarketPage from "./NativeMarketPage";
import NativeVaultPage from "./NativeVaultPage";
import NativeWalletPage from "./NativeWalletPage";
import NativePremierLeaguePage from "./NativePremierLeaguePage";
import NativeClubPage from "./NativeClubPage";
import "./native-arena-theme.css";

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
  { label: "Squad", href: "/live-lineup", icon: UsersRound },
  { label: "Play", href: "/competitions", icon: Trophy },
  { label: "Cards", href: "/collection", icon: Gem },
];

const moreItems: Array<NavItem & { description: string }> = [
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag, description: "Buy & manage cards" },
  { label: "Prize Vault", href: "/prize-vault", icon: Sparkles, description: "Rewards & ladders" },
  { label: "Wallet", href: "/wallet", icon: WalletCards, description: "Balance & activity" },
  { label: "Premier League", href: "/premier-league", icon: Trophy, description: "Matches & table" },
  { label: "My Club", href: "/account", icon: CircleUserRound, description: "Inbox & referrals" },
  { label: "Scoring", href: "/legal/scoring", icon: BookOpen, description: "How points work" },
  { label: "Help", href: "/help", icon: ShieldQuestion, description: "Rules & support" },
];

function isActive(location: string, href: string) {
  if (href === "/") return location === "/" || location === "/dashboard";
  if (href === "/live-lineup") return location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries");
  return location === href || location.startsWith(`${href}/`);
}

function routeTitle(location: string) {
  if (location === "/" || location === "/dashboard") return "Arena HQ";
  if (location.startsWith("/competitions") || location.startsWith("/free") || location.startsWith("/play-free")) return "Enter Arena";
  if (location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries")) return "My Squad";
  if (location.startsWith("/collection")) return "My Cards";
  if (location.startsWith("/marketplace")) return "Marketplace";
  if (location.startsWith("/prize-vault")) return "Prize Vault";
  if (location.startsWith("/wallet")) return "Wallet";
  if (location.startsWith("/premier-league") || location.startsWith("/leagues")) return "Match Centre";
  if (location.startsWith("/account") || location.startsWith("/profile")) return "My Club";
  if (location.startsWith("/legal/scoring")) return "Scoring";
  if (location.startsWith("/help") || location.startsWith("/faq")) return "Help";
  return "Fantasy Arena";
}

function routeSubtitle(location: string) {
  if (location === "/" || location === "/dashboard") return "PLAY • COMPETE • WIN";
  if (location.startsWith("/competitions") || location.startsWith("/free") || location.startsWith("/play-free")) return "CHOOSE CUP • BUILD 5 • ENTER";
  if (location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries")) return "YOUR FIVE • LIVE SCORE";
  if (location.startsWith("/collection")) return "OWN • BUILD • UPGRADE";
  if (location.startsWith("/marketplace")) return "FIND • BUY • TRADE";
  if (location.startsWith("/prize-vault")) return "CLIMB • UNLOCK • WIN";
  if (location.startsWith("/wallet")) return "BALANCE • ACTIVITY";
  if (location.startsWith("/premier-league") || location.startsWith("/leagues")) return "REAL FOOTBALL • LIVE DATA";
  if (location.startsWith("/account") || location.startsWith("/profile")) return "PROFILE • INBOX • REFER";
  return "FANTASY ARENA";
}

function routeKey(location: string) {
  if (location === "/" || location === "/dashboard") return "home";
  if (location.startsWith("/competitions") || location.startsWith("/free") || location.startsWith("/play-free")) return "play";
  if (location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries")) return "squad";
  if (location.startsWith("/collection")) return "cards";
  if (location.startsWith("/marketplace")) return "market";
  if (location.startsWith("/prize-vault")) return "vault";
  if (location.startsWith("/wallet")) return "wallet";
  if (location.startsWith("/premier-league") || location.startsWith("/leagues")) return "league";
  if (location.startsWith("/account") || location.startsWith("/profile")) return "club";
  return "info";
}

function compactNativePage(location: string, children: React.ReactNode, nativeFull: boolean) {
  if (nativeFull) return children;
  if (location === "/" || location === "/dashboard") return <NativeHomePage />;
  if (location.startsWith("/competitions") || location.startsWith("/free") || location.startsWith("/play-free")) return <NativePlayPage />;
  if (location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries")) return <NativeSquadPage />;
  if (location.startsWith("/collection")) return <NativeCardsPage />;
  if (location.startsWith("/marketplace")) return <NativeMarketPage />;
  if (location.startsWith("/prize-vault")) return <NativeVaultPage />;
  if (location.startsWith("/wallet")) return <NativeWalletPage />;
  if (location.startsWith("/premier-league") || location.startsWith("/leagues")) return <NativePremierLeaguePage />;
  if (location.startsWith("/account") || location.startsWith("/profile")) return <NativeClubPage />;
  return children;
}

export default function NativeMobileShell({ children }: NativeMobileShellProps) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const nativeFull = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("nativeFull") === "1";
  const pageContent = compactNativePage(location, children, nativeFull);
  const currentRoute = routeKey(location);

  React.useEffect(() => {
    setMoreOpen(false);
  }, [location]);

  return (
    <div
      className="relative flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden text-white"
      data-native-mobile-shell
      data-arena-route={currentRoute}
    >
      <div className="arena-ambient-orb left-[-5rem] top-[8rem] h-48 w-48 bg-fuchsia-600/30" />
      <div className="arena-ambient-orb right-[-5rem] top-[19rem] h-56 w-56 bg-cyan-500/20 [animation-delay:-3s]" />

      <header className="arena-header relative z-40 shrink-0 px-3.5 pb-2.5 pt-[calc(env(safe-area-inset-top,0px)+0.55rem)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Fantasy Arena home">
            <div className="arena-logo-frame h-[46px] w-[46px] shrink-0 rounded-2xl">
              <img
                src="/brand/fantasy-arena-logo.jpg"
                alt="Fantasy Arena"
                className="h-full w-full rounded-[0.95rem] object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.24em] text-fuchsia-200/80">Fantasy Arena</p>
                <span className="arena-live-pill inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[.12em]">
                  <span className="arena-live-dot h-1.5 w-1.5 rounded-full bg-emerald-300" />Live
                </span>
              </div>
              <h1 className="mt-0.5 truncate text-[18px] font-black leading-tight tracking-tight text-white">{routeTitle(location)}</h1>
              <p className="mt-0.5 truncate text-[7px] font-extrabold tracking-[.19em] text-cyan-200/45">{routeSubtitle(location)}</p>
            </div>
          </Link>
          <Link
            href="/account?tab=inbox"
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-400/[.1] to-cyan-300/[.06] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_0_18px_rgba(139,92,246,.08)]"
            aria-label="Open notifications"
          >
            <Bell className="h-[19px] w-[19px]" />
            <UnreadNotificationDot className="absolute right-1.5 top-1.5" />
          </Link>
        </div>
        <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-fuchsia-400/35 to-cyan-300/35" />
      </header>

      <main
        className="arena-page-frame relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[calc(env(safe-area-inset-bottom,0px)+7.2rem)]"
        data-app-scroll-root
      >
        <NativeRouteBoundary key={`${location}:${nativeFull ? "full" : "compact"}`} routeKey={location}>
          <div className="min-w-0" data-page-scroll-content data-native-full-route={nativeFull ? "true" : "false"}>{pageContent}</div>
        </NativeRouteBoundary>
      </main>

      <nav
        className="arena-bottom-dock absolute inset-x-0 bottom-0 z-50 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)] pt-1.5 backdrop-blur-2xl"
        aria-label="Fantasy Arena app navigation"
      >
        <div className="grid grid-cols-5 items-end gap-1">
          {primaryItems.map((item) => {
            const active = isActive(location, item.href);
            const Icon = item.icon;
            const isPlay = item.href === "/competitions";
            if (isPlay) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative -mt-5 flex min-h-[4.75rem] flex-col items-center justify-start gap-1 text-[9px] font-black text-white"
                  aria-label="Play Fantasy Arena"
                >
                  <span className="arena-play-button relative grid h-[54px] w-[54px] place-items-center rounded-[1.2rem]">
                    <Trophy className="h-6 w-6 text-white drop-shadow-[0_0_6px_rgba(255,255,255,.35)]" />
                  </span>
                  <span className={active ? "text-cyan-100" : "text-violet-100/80"}>PLAY</span>
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active ? "true" : "false"}
                className="arena-nav-item flex min-h-[3.65rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[9px] font-extrabold transition"
              >
                <Icon className="h-[20px] w-[20px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            data-active={moreOpen ? "true" : "false"}
            className="arena-nav-item flex min-h-[3.65rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[9px] font-extrabold transition"
            aria-label="Open more Fantasy Arena features"
          >
            <Menu className="h-[20px] w-[20px]" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="absolute inset-0 z-[90] flex items-end bg-black/75 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="More Fantasy Arena features">
          <button className="absolute inset-0" onClick={() => setMoreOpen(false)} aria-label="Close more menu" />
          <section className="arena-more-sheet relative z-10 max-h-[78dvh] w-full overflow-y-auto rounded-t-[2rem] border-t px-3.5 pb-[calc(env(safe-area-inset-bottom,0px)+1.15rem)] pt-3.5">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gradient-to-r from-fuchsia-400/40 to-cyan-300/40" />
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.24em] text-fuchsia-300/75">Arena menu</p>
                <h2 className="mt-1 text-xl font-black tracking-tight">Choose your zone</h2>
                <p className="mt-1 text-[10px] text-slate-500">Every tile opens a live Fantasy Arena route.</p>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid h-10 w-10 place-items-center rounded-2xl border border-fuchsia-300/15 bg-white/[.04]" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item, index) => {
                const Icon = item.icon;
                const wide = index === moreItems.length - 1;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`arena-menu-tile flex min-h-[92px] flex-col justify-between rounded-2xl p-3 ${wide ? "col-span-2" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-400/15 to-cyan-300/12 text-cyan-100 shadow-[inset_0_0_14px_rgba(139,92,246,.06)]"><Icon className="h-[18px] w-[18px]" /></div>
                      <ChevronRight className="h-4 w-4 text-slate-700" />
                    </div>
                    <div className="mt-2 min-w-0"><p className="truncate text-xs font-black text-white">{item.label}</p><p className="mt-0.5 truncate text-[9px] text-slate-500">{item.description}</p></div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.035] px-3 py-2.5 text-center text-[9px] font-bold text-slate-500">
              Compact app views use the same live website data and actions.
            </div>
          </section>
        </div>
      ) : null}

      <NativeAppUpdatePrompt />
    </div>
  );
}

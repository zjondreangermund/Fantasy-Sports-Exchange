import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";

import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { ThemeProvider, ThemeToggle } from "./components/ThemeProvider";
import StadiumAmbientLayer from "./components/StadiumAmbientLayer";
import RouteSceneBackground from "./components/RouteSceneBackground";
import FloatingSupportWidget from "./components/FloatingSupportWidget";
import FloatingEventNotifications from "./components/FloatingEventNotifications";
import LivePulseDock from "./components/LivePulseDock";
import MatchdayQuickDock from "./components/MatchdayQuickDock";
import MobileNavDock from "./components/MobileNavDock";
import SiteFooter from "./components/SiteFooter";
import PageScene, { routeToPageSceneVariant } from "./components/PageScene";
import { useAuth } from "./hooks/use-auth";
import { useScrollRepair } from "./hooks/use-scroll-repair";
import { Skeleton } from "./components/ui/skeleton";

import NotFound from "./pages/not-found";

const LandingPage = React.lazy(() => import("./pages/landing"));
const LegalCentrePage = React.lazy(() => import("./pages/legal-centre"));
const TrustCentrePage = React.lazy(() => import("./pages/trust-centre"));
const OnboardingPage = React.lazy(() => import("./pages/onboarding"));
const OnboardingPacksScene = React.lazy(() => import("./pages/onboarding-packs"));
const OnboardingTunnelPage = React.lazy(() => import("./pages/onboarding-tunnel"));
const CardRevealPage = React.lazy(() => import("./pages/card-reveal"));
const DashboardPage = React.lazy(() => import("./pages/dashboard"));
const AnalyticsPage = React.lazy(() => import("./pages/analytics"));
const LiveLineupPage = React.lazy(() => import("./pages/live-lineup"));
const SelectSquadPage = React.lazy(() => import("./pages/select-squad"));
const CollectionPage = React.lazy(() => import("./pages/collection-clean"));
const MarketplacePage = React.lazy(() => import("./pages/marketplace-v2"));
const AuctionsPage = React.lazy(() => import("./pages/auctions"));
const WalletPage = React.lazy(() => import("./pages/wallet"));
const AccountPage = React.lazy(() => import("./pages/account"));
const CompetitionsPage = React.lazy(() => import("./pages/competitions-vault"));
const PrizeVaultPage = React.lazy(() => import("./pages/prize-vault"));
const PremierLeaguePage = React.lazy(() => import("./pages/premier-league"));
const AdminPage = React.lazy(() => import("./pages/admin"));
const AdminTestConsolePage = React.lazy(() => import("./pages/admin-test-console"));
const AdminSeasonSimulatorPage = React.lazy(() => import("./pages/admin-season-simulator"));
const AdminLiveDataPage = React.lazy(() => import("./pages/admin-live-data"));
const CardLabPage = React.lazy(() => import("./pages/card-lab"));

const legalInfoPaths = [
  "/about", "/contact", "/help", "/faq",
  "/legal/terms", "/legal/privacy", "/legal/aml-kyc", "/legal/cookies", "/legal/refunds",
  "/legal/responsible-play", "/legal/fair-play", "/legal/marketplace", "/legal/prize-vault", "/legal/scoring",
];
const trustInfoPaths = ["/trust/status", "/trust/security", "/trust/payments", "/trust/releases", "/trust/roadmap"];
const publicInfoPaths = [...legalInfoPaths, ...trustInfoPaths];

function RouteFallback() {
  return <div className="flex flex-1 items-center justify-center"><Skeleton className="h-8 w-32" /></div>;
}

function PublicInformationRoutes() {
  return <>
    {legalInfoPaths.map((path) => <Route key={path} path={path} component={LegalCentrePage} />)}
    {trustInfoPaths.map((path) => <Route key={path} path={path} component={TrustCentrePage} />)}
  </>;
}

function AuthenticatedRouter() {
  const { data: onboarding, isLoading } = useQuery<{ completed: boolean }>({ queryKey: ["/api/onboarding/status"] });

  if (isLoading) return <div className="flex flex-1 items-center justify-center"><Skeleton className="h-8 w-32" /></div>;

  if (onboarding && !onboarding.completed) {
    return (
      <React.Suspense fallback={<RouteFallback />}>
        <Switch>
          <PublicInformationRoutes />
          <Route path="/onboarding" component={OnboardingPage} />
          <Route path="/onboarding-packs" component={OnboardingPacksScene} />
          <Route path="/onboarding-tunnel" component={OnboardingTunnelPage} />
          <Route path="/card-reveal" component={CardRevealPage} />
          <Route component={OnboardingPage} />
        </Switch>
      </React.Suspense>
    );
  }

  return (
    <React.Suspense fallback={<RouteFallback />}>
      <Switch>
        <PublicInformationRoutes />
        <Route path="/" component={DashboardPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/live-lineup" component={LiveLineupPage} />
        <Route path="/select-squad" component={SelectSquadPage} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/onboarding-packs" component={OnboardingPacksScene} />
        <Route path="/onboarding-tunnel" component={OnboardingTunnelPage} />
        <Route path="/card-reveal" component={CardRevealPage} />
        <Route path="/competitions" component={CompetitionsPage} />
        <Route path="/prize-vault" component={PrizeVaultPage} />
        <Route path="/premier-league" component={PremierLeaguePage} />
        <Route path="/card-lab" component={CardLabPage} />
        <Route path="/collection" component={CollectionPage} />
        <Route path="/marketplace" component={MarketplacePage} />
        <Route path="/auctions" component={AuctionsPage} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/account" component={AccountPage} />
        <Route path="/admin/test-console" component={AdminTestConsolePage} />
        <Route path="/admin/season-simulator" component={AdminSeasonSimulatorPage} />
        <Route path="/admin/live-data" component={AdminLiveDataPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </React.Suspense>
  );
}

function AuthenticatedApp() {
  const [location] = useLocation();
  const isPlayRoute = location.startsWith("/competitions") || location.startsWith("/prize-vault");
  const isInfoRoute = publicInfoPaths.includes(location);
  const style = { "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem" };
  const { data: user } = useQuery<{ managerTeamName?: string }>({ queryKey: ["/api/user"] });
  const teamName = user?.managerTeamName || "Your Stadium";
  useScrollRepair(location);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch("/api/audit/client-event", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "route_view", path: location, title: document.title, ts: new Date().toISOString() }), signal: controller.signal }).catch(() => {});
    return () => controller.abort();
  }, [location]);

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className={`app-shell flex min-h-[100dvh] w-full overflow-x-hidden bg-black ${isPlayRoute ? "play-route-shell" : ""}`}>
        <AppSidebar />
        <div className={`app-content relative isolate flex min-h-[100dvh] min-w-0 flex-1 flex-col overflow-x-hidden ${isPlayRoute ? "play-route-content" : ""}`}>
          <RouteSceneBackground pathname={location} />
          {!isPlayRoute && !isInfoRoute && <StadiumAmbientLayer teamName={teamName} />}
          <header className="sticky top-0 z-50 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/80 p-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="h-10 w-10 rounded-xl border border-white/15 bg-white/5" />
              <span className="text-xs font-bold text-white/65">Show / hide menu</span>
            </div>
            <ThemeToggle />
          </header>
          {!isInfoRoute && <LivePulseDock />}
          <main className={`app-scroll-root relative z-10 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-auto pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-0 ${isPlayRoute ? "play-route-scroll" : ""}`} data-app-scroll-root>
            <div className="min-h-full flex-1 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-0"><AuthenticatedRouter /></div>
            <SiteFooter />
          </main>
          {!isInfoRoute && <MatchdayQuickDock />}
          {!isInfoRoute && <MobileNavDock />}
          {!isInfoRoute && <FloatingEventNotifications />}
          <FloatingSupportWidget />
        </div>
      </div>
    </SidebarProvider>
  );
}

function PublicRouter() {
  return (
    <React.Suspense fallback={<RouteFallback />}>
      <Switch>
        <PublicInformationRoutes />
        <Route component={LandingPage} />
      </Switch>
    </React.Suspense>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  React.useEffect(() => { const params = new URLSearchParams(window.location.search); const ref = String(params.get("ref") || "").trim(); if (ref) localStorage.setItem("fantasy_referral_code", ref); }, []);
  React.useEffect(() => { if (!user) return; const code = localStorage.getItem("fantasy_referral_code"); if (!code) return; fetch("/api/referrals/claim", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }), }).then(() => localStorage.removeItem("fantasy_referral_code")).catch(() => {}); }, [user]);
  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="flex flex-col items-center gap-4"><Skeleton className="h-12 w-12 rounded-md" /><Skeleton className="h-4 w-32" /></div></div>;
  if (!user) { const pathname = window.location.pathname || "/"; return <PageScene variant={routeToPageSceneVariant(pathname, false)} className="min-h-screen"><PublicRouter /></PageScene>; }
  return <AuthenticatedApp />;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><ThemeProvider><TooltipProvider><AppContent /><Toaster /></TooltipProvider></ThemeProvider></QueryClientProvider>;
}

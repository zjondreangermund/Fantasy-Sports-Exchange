import * as React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";

import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { ThemeProvider, ThemeToggle } from "./components/ThemeProvider";
import StadiumAmbientLayer from "./components/StadiumAmbientLayer";
import FloatingSupportWidget from "./components/FloatingSupportWidget";
import FloatingEventNotifications from "./components/FloatingEventNotifications";
import { useAuth } from "./hooks/use-auth";
import { Skeleton } from "./components/ui/skeleton";

import NotFound from "./pages/not-found";

const LandingPage = React.lazy(() => import("./pages/landing"));
const OnboardingPage = React.lazy(() => import("./pages/onboarding"));
const OnboardingPacksScene = React.lazy(() => import("./pages/onboarding-packs"));
const OnboardingTunnelPage = React.lazy(() => import("./pages/onboarding-tunnel"));
const CardRevealPage = React.lazy(() => import("./pages/card-reveal"));
const DashboardPage = React.lazy(() => import("./pages/dashboard"));
const CollectionPage = React.lazy(() => import("./pages/collection"));
const MarketplacePage = React.lazy(() => import("./pages/marketplace"));
const AuctionsPage = React.lazy(() => import("./pages/auctions"));
const WalletPage = React.lazy(() => import("./pages/wallet"));
const AccountPage = React.lazy(() => import("./pages/account"));
const CompetitionsPage = React.lazy(() => import("./pages/competitions"));
const PremierLeaguePage = React.lazy(() => import("./pages/premier-league"));
const AdminPage = React.lazy(() => import("./pages/admin"));
const CardLabPage = React.lazy(() => import("./pages/card-lab"));

function RouteFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Skeleton className="w-32 h-8" />
    </div>
  );
}

function AuthenticatedRouter() {
  // ✅ Use /status (doesn't 404 when offers not created yet)
  const { data: onboarding, isLoading } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/onboarding/status"],
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  // ✅ If onboarding is not completed, force user into onboarding flow
  if (onboarding && !onboarding.completed) {
    return (
      <React.Suspense fallback={<RouteFallback />}>
        <Switch>
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
        <Route path="/" component={DashboardPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/onboarding-packs" component={OnboardingPacksScene} />
        <Route path="/onboarding-tunnel" component={OnboardingTunnelPage} />
        <Route path="/card-reveal" component={CardRevealPage} />
        <Route path="/competitions" component={CompetitionsPage} />
        <Route path="/premier-league" component={PremierLeaguePage} />
        <Route path="/card-lab" component={CardLabPage} />
        <Route path="/collection" component={CollectionPage} />
        <Route path="/marketplace" component={MarketplacePage} />
        <Route path="/auctions" component={AuctionsPage} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/account" component={AccountPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </React.Suspense>
  );
}

function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Fetch user data for team name
  const { data: user } = useQuery<{ managerTeamName?: string }>({
    queryKey: ["/api/user"],
  });

  const teamName = user?.managerTeamName || "Your Stadium";

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 relative">
          <StadiumAmbientLayer teamName={teamName} />
          <header className="flex items-center justify-between gap-2 p-2 border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative z-10">
            <AuthenticatedRouter />
          </main>
          <FloatingEventNotifications />
          <FloatingSupportWidget />
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = String(params.get("ref") || "").trim();
    if (!ref) return;
    localStorage.setItem("fantasy_referral_code", ref);
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const code = localStorage.getItem("fantasy_referral_code");
    if (!code) return;
    fetch("/api/referrals/claim", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then(() => {
        localStorage.removeItem("fantasy_referral_code");
      })
      .catch(() => {
        // Keep code for a retry on next load if request fails.
      });
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-md" />
          <Skeleton className="w-32 h-4" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <React.Suspense fallback={<RouteFallback />}>
        <LandingPage />
      </React.Suspense>
    );
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

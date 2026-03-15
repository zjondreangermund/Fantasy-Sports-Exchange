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
import { useAuth } from "./hooks/use-auth";
import { Skeleton } from "./components/ui/skeleton";

import NotFound from "./pages/not-found";
import LandingPage from "./pages/landing";
import OnboardingPage from "./pages/onboarding";
import OnboardingPacksScene from "./pages/onboarding-packs";
import OnboardingTunnelPage from "./pages/onboarding-tunnel";
import CardRevealPage from "./pages/card-reveal";
import DashboardPage from "./pages/dashboard";
import CollectionPage from "./pages/collection";
import MarketplacePage from "./pages/marketplace";
import AuctionsPage from "./pages/auctions";
import WalletPage from "./pages/wallet";
import AccountPage from "./pages/account";
import CompetitionsPage from "./pages/competitions";
import PremierLeaguePage from "./pages/premier-league";
import AdminPage from "./pages/admin";
import CardLabPage from "./pages/card-lab";

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
      <Switch>
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/onboarding-packs" component={OnboardingPacksScene} />
        <Route path="/onboarding-tunnel" component={OnboardingTunnelPage} />
        <Route path="/card-reveal" component={CardRevealPage} />
        <Route component={OnboardingPage} />
      </Switch>
    );
  }

  return (
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
    return <LandingPage />;
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

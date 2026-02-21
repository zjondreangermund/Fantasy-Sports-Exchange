import * as React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";

import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { ThemeProvider, ThemeToggle } from "./components/ThemeProvider";
import { useAuth } from "./hooks/use-auth";
import { Skeleton } from "./components/ui/skeleton";

import NotFound from "./pages/not-found";
import LandingPage from "./pages/landing";
import OnboardingPage from "./pages/onboarding";
import OnboardingPacksScene from "./pages/onboarding-packs";
import OnboardingTunnelPage from "./pages/onboarding-tunnel";
import DashboardPage from "./pages/dashboard";
import CollectionPage from "./pages/collection";
import MarketplacePage from "./pages/marketplace";
import AuctionsPage from "./pages/auctions";
import WalletPage from "./pages/wallet";
import AccountPage from "./pages/account";
import CompetitionsPage from "./pages/competitions";
import PremierLeaguePage from "./pages/premier-league";
import AdminPage from "./pages/admin";

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
        <Route component={OnboardingPage} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/onboarding-packs" component={OnboardingPacksScene} />
      <Route path="/onboarding-tunnel" component={OnboardingTunnelPage} />
      <Route path="/competitions" component={CompetitionsPage} />
      <Route path="/premier-league" component={PremierLeaguePage} />
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
          {/* Stadium Background */}
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95)), url(https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=2000)",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              opacity: 0.4,
            }}
          />
          {/* Team Name Overlay */}
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none z-0 text-center"
            style={{
              opacity: 0.08,
            }}
          >
            <div
              style={{
                fontSize: "clamp(3rem, 12vw, 10rem)",
                fontWeight: 900,
                color: "white",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                lineHeight: 1,
                textShadow: "0 0 60px rgba(255,255,255,0.5)",
              }}
            >
              {teamName}
            </div>
          </div>
          <header className="flex items-center justify-between gap-2 p-2 border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative z-10">
            <AuthenticatedRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

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

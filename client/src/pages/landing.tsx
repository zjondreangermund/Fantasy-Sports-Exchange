// Fixed: Go up one level to reach /components/ from /pages/
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Trophy, Users, TrendingUp, Star, Shield, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">FantasyFC</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/api/login">
              <Button data-testid="button-login">Sign In</Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="relative pt-14 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/images/hero-banner.png"
            alt="Fantasy Football"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-background" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-2xl">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Collect. Compete.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Conquer.
              </span>
            </h1>
            <p className="mt-6 text-lg text-white/70 max-w-lg">
              Build your dream squad with collectible player cards. Trade rare
              cards, compete in leagues, and rise to the top of the leaderboards.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/api/login">
                <Button size="lg" data-testid="button-get-started">
                  Get Started Free
                </Button>
              </a>
            </div>
            <div className="mt-6 flex items-center gap-4 text-white/50 text-sm">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4" /> 5 Free Packs on Signup
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-4 h-4" /> No Blockchain Required
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-4">
          How It Works
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-md mx-auto">
          No crypto, no wallets, no complexity. Just pure fantasy football fun.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Open Packs</h3>
            <p className="text-sm text-muted-foreground">
              Sign up and receive 3 starter packs with 9 players. Choose your
              best 5 to build your lineup.
            </p>
          </Card>
          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Trade Cards</h3>
            <p className="text-sm text-muted-foreground">
              Deposit funds and trade rare, unique and legendary cards on the
              marketplace to build the ultimate squad.
            </p>
          </Card>
          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Compete</h3>
            <p className="text-sm text-muted-foreground">
              Your players earn points based on real-world performances. Level up
              cards and climb the ranks.
            </p>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Trophy className="w-4 h-4" />
            <span>FantasyFC &copy; 2026</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Terms</span>
            <span>Privacy</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

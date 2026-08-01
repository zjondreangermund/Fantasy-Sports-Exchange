import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Users, TrendingUp, Star, Shield, Zap, CheckCircle2, BarChart3, Clock3 } from "lucide-react";
import { motion } from "framer-motion";

const BRAND_ICON = "/brand/fantasy-arena-icon.svg?v=lion-2026-08";
const BRAND_LOGO = "/brand/fa-premium-2026.svg?v=lion-2026-08";

export default function LandingPage() {
  const [heroVideoError, setHeroVideoError] = useState(false);
  const refCode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : "";
  const loginHref = refCode ? `/api/login?ref=${encodeURIComponent(refCode)}` : "/api/login";

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes crowdSweep {
          0% { transform: translateX(-60%) rotate(-10deg); opacity: 0 }
          22% { opacity: .35 }
          55% { transform: translateX(60%) rotate(10deg); opacity: .25 }
          100% { transform: translateX(120%) rotate(14deg); opacity: 0 }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: .35; transform: scale(1) }
          50% { opacity: .7; transform: scale(1.04) }
        }
      `}</style>

      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-fuchsia-300/30 bg-black shadow-[0_0_25px_rgba(168,85,247,.3)]">
              <img src={BRAND_ICON} alt="Fantasy Arena crowned lion" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-lg font-black leading-none text-foreground">Fantasy Arena</div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-[.24em] text-purple-400">Play • Compete • Win</div>
            </div>
          </div>
          <a href={loginHref}>
            <Button data-testid="button-login">Sign In with Google</Button>
          </a>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0">
          {!heroVideoError ? (
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/cinematics/tunnel.png"
              onError={() => setHeroVideoError(true)}
            >
              <source src="/cinematics/tunnel_16x9.mp4" type="video/mp4" />
            </video>
          ) : (
            <img
              src="/images/hero-banner.png"
              alt="Fantasy Football"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-background" />
          <div
            className="absolute -top-10 left-0 h-[140%] w-[60%] blur-3xl"
            style={{
              background: "linear-gradient(90deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.16) 50%, rgba(59,130,246,0) 100%)",
              animation: "crowdSweep 6.2s ease-in-out infinite",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_430px] lg:px-8 lg:py-36">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
              <h1 className="font-serif text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Collect. Compete.
                <br />
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Conquer.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg text-white/70">
                Build your dream squad with collectible player cards. Trade rare cards, compete in leagues, and rise to the top of the leaderboards.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href={loginHref} className="relative inline-flex">
                  <span
                    className="absolute -inset-2 rounded-2xl blur-xl"
                    style={{
                      background: "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.55), rgba(59,130,246,0.0) 70%)",
                      animation: "glowPulse 2.4s ease-in-out infinite",
                    }}
                    aria-hidden
                  />
                  <Button size="lg" data-testid="button-get-started" className="relative">Get Started Free</Button>
                </a>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">See How It Works</Button>
                </a>
              </div>

              <motion.div className="mt-6 flex items-center gap-4 text-sm text-white/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.35 }}>
                <span className="flex items-center gap-1"><Star className="h-4 w-4" /> 5 Free Packs on Signup</span>
                <span className="flex items-center gap-1"><Shield className="h-4 w-4" /> No Blockchain Required</span>
              </motion.div>

              <div className="mt-5 flex flex-wrap gap-2">
                {["Live EPL-linked scoring", "Fast Google sign-in", "Clear rarity progression"].map((chip) => (
                  <span key={chip} className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80">
                    <CheckCircle2 className="h-3.5 w-3.5" />{chip}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .1, duration: .55 }} className="hidden justify-center lg:flex">
            <img src={BRAND_LOGO} alt="Fantasy Arena crowned lion logo" className="max-h-[480px] w-full object-contain drop-shadow-[0_0_45px_rgba(124,58,237,.45)]" />
          </motion.div>
        </div>
      </section>

      <section className="relative z-20 mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-border/80 bg-card/95 p-5 backdrop-blur">
            <div className="mb-2 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10"><BarChart3 className="h-5 w-5 text-primary" /></div><p className="text-sm text-muted-foreground">Live Data</p></div>
            <p className="text-2xl font-bold text-foreground">EPL Sync</p><p className="mt-1 text-sm text-muted-foreground">Player points update from real match output</p>
          </Card>
          <Card className="border-border/80 bg-card/95 p-5 backdrop-blur">
            <div className="mb-2 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10"><Clock3 className="h-5 w-5 text-primary" /></div><p className="text-sm text-muted-foreground">Onboarding</p></div>
            <p className="text-2xl font-bold text-foreground">~2 min</p><p className="mt-1 text-sm text-muted-foreground">Get cards, pick a lineup, enter your first contest</p>
          </Card>
          <Card className="border-border/80 bg-card/95 p-5 backdrop-blur">
            <div className="mb-2 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10"><TrendingUp className="h-5 w-5 text-primary" /></div><p className="text-sm text-muted-foreground">Progression</p></div>
            <p className="text-2xl font-bold text-foreground">Level + Trade</p><p className="mt-1 text-sm text-muted-foreground">Build value through XP, market timing, and competition results</p>
          </Card>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-center text-2xl font-bold text-foreground sm:text-3xl">How It Works</h2>
        <p className="mx-auto mb-12 max-w-md text-center text-muted-foreground">No crypto, no wallets, no complexity. Just pure fantasy football fun.</p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="p-6 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10"><Users className="h-6 w-6 text-primary" /></div><h3 className="mb-2 font-semibold text-foreground">Open Packs</h3><p className="text-sm text-muted-foreground">Sign up and receive 5 starter packs with 15 players. Choose your best 5 to build your lineup.</p></Card>
          <Card className="p-6 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10"><TrendingUp className="h-6 w-6 text-primary" /></div><h3 className="mb-2 font-semibold text-foreground">Trade Cards</h3><p className="text-sm text-muted-foreground">Deposit funds and trade rare, unique and legendary cards on the marketplace to build the ultimate squad.</p></Card>
          <Card className="p-6 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10"><Zap className="h-6 w-6 text-primary" /></div><h3 className="mb-2 font-semibold text-foreground">Compete</h3><p className="text-sm text-muted-foreground">Your players earn points based on real-world performances. Level up cards and climb the ranks.</p></Card>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 text-center sm:p-10">
          <h3 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">Ready for Matchday?</h3>
          <p className="mx-auto mb-6 max-w-xl text-muted-foreground">Join now, lock your lineup, and start climbing the leaderboard before the next kickoff.</p>
          <a href={loginHref}><Button size="lg" data-testid="button-final-cta">Start Free with Google</Button></a>
        </Card>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <img src={BRAND_ICON} alt="" className="h-9 w-9 rounded-xl object-contain" />
            <span>Fantasy Arena &copy; 2026</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="/terms-and-conditions" className="hover:text-foreground">Terms</a>
            <a href="/privacy-policy" className="hover:text-foreground">Privacy</a>
            <a href="/contact-us" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

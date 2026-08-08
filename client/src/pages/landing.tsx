import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  BarChart3,
  CheckCircle2,
  Gift,
  Handshake,
  MessageCircle,
  ShoppingCart,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";

const BRAND_LOGO = "/brand/fantasy-arena-logo.jpg?v=lion-jpg-2026-08";

const freeFlowSteps = [
  {
    icon: Users,
    title: "1. Create your club",
    text: "Sign in and register a unique Fantasy Arena manager team name. Your club becomes your identity across tournaments, cards and the community.",
  },
  {
    icon: Star,
    title: "2. Get your 5 FREE starter cards",
    text: "Enter the Starter Draft and choose one Common player card from each group: Goalkeeper, Defender, Midfielder, Forward and Wildcard. Your five choices are minted into your Collection.",
  },
  {
    icon: Trophy,
    title: "3. Enter FREE Card Cups",
    text: "Use your Common cards in eligible N$0-entry Free Card Cups. You do not need to deposit money to start playing Fantasy Arena.",
  },
  {
    icon: BarChart3,
    title: "4. Real football decides your score",
    text: "Your cards score from real Premier League performances, including minutes, goals, assists, clean sheets, saves, crucial passes, tackles, interceptions, duels, shots on target, dribbles, blocks, passing and more. Your captain adds a 10% lineup bonus.",
  },
  {
    icon: Gift,
    title: "5. Win better player cards",
    text: "Perform well in Free Card Cups and you can win player-card rewards, including Rare cards. Winning a card grows your Collection without requiring you to buy it.",
  },
  {
    icon: TrendingUp,
    title: "6. Keep it, use it or loan it out",
    text: "A card you win can stay in your Collection, be used in eligible higher-rarity tournaments, or be listed on the Loan Marketplace when loans are open. Keep building from Common toward Rare, Unique, Epic and Legendary.",
  },
];

const deeperFeatures = [
  {
    icon: Gift,
    title: "Prize Vault",
    text: "Official eligible tournaments can contribute toward rarity-specific Prize Vault rewards. Open the Prize Vault inside Fantasy Arena to see the current reward, unlock progress and the next reward.",
  },
  {
    icon: ShoppingCart,
    title: "Marketplace & Auctions",
    text: "When launch controls are open, eligible cards can be bought, sold or auctioned. Pricing, fees and confirmation details are shown where the transaction happens.",
  },
  {
    icon: Handshake,
    title: "Loan Marketplace",
    text: "Eligible Rare, Unique, Epic and Legendary cards can be loaned for selected gameweeks. Cards you win can therefore have tournament utility even when you are not using them yourself.",
  },
  {
    icon: MessageCircle,
    title: "Community Live",
    text: "Talk football with other managers, discuss performances and follow the Fantasy Arena community while you use the platform.",
  },
];

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

      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-fuchsia-300/30 bg-black shadow-[0_0_25px_rgba(168,85,247,.3)]">
              <img src={BRAND_LOGO} alt="Fantasy Arena crowned lion" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-black leading-none text-foreground sm:text-lg">Fantasy Arena</div>
              <div className="mt-1 hidden text-[9px] font-bold uppercase tracking-[.24em] text-purple-400 sm:block">Play • Compete • Win</div>
            </div>
          </div>
          <div className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
            <a href="#how-it-works" className="hover:text-foreground">How It Works</a>
            <a href="#free-card-cups" className="hover:text-foreground">Free Card Cups</a>
            <a href="/legal/scoring" className="hover:text-foreground">Scoring</a>
            <a href="#more-ways" className="hover:text-foreground">More Ways to Play</a>
          </div>
          <a href={loginHref}><Button data-testid="button-login">Start Free</Button></a>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0">
          {!heroVideoError ? (
            <video className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/cinematics/tunnel.png" onError={() => setHeroVideoError(true)}>
              <source src="/cinematics/tunnel_16x9.mp4" type="video/mp4" />
            </video>
          ) : (
            <img src="/images/hero-banner.png" alt="Fantasy Football" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/72 to-background" />
          <div className="absolute -top-10 left-0 h-[140%] w-[60%] blur-3xl" style={{ background: "linear-gradient(90deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.16) 50%, rgba(59,130,246,0) 100%)", animation: "crowdSweep 6.2s ease-in-out infinite" }} />
        </div>

        <div className="relative z-10 mx-auto flex max-w-7xl items-center px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-emerald-100">
                <CheckCircle2 className="h-4 w-4" /> Free to start
              </div>
              <h1 className="font-serif text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Start Free. Build Your Club.<br />
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Win Your Way Up.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
                Get 5 FREE Premier League player cards, enter FREE Card Cups, score from real match performances and build your Collection toward stronger cards, bigger competitions and rewards.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href={loginHref} className="relative inline-flex">
                  <span className="absolute -inset-2 rounded-2xl blur-xl" style={{ background: "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.55), rgba(59,130,246,0.0) 70%)", animation: "glowPulse 2.4s ease-in-out infinite" }} aria-hidden />
                  <Button size="lg" data-testid="button-get-started" className="relative">Get My 5 Free Cards</Button>
                </a>
                <a href="#how-it-works"><Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">See How It Works</Button></a>
              </div>
              <motion.div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/65" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.35 }}>
                <span className="flex items-center gap-1"><Star className="h-4 w-4" /> 5 FREE starter cards</span>
                <span className="flex items-center gap-1"><Trophy className="h-4 w-4" /> FREE Card Cups</span>
                <span className="flex items-center gap-1"><BarChart3 className="h-4 w-4" /> Real EPL scoring</span>
              </motion.div>
              <p className="mt-4 text-sm font-semibold text-emerald-100/80">No deposit required to start.</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-border/80 bg-card/95 p-5 backdrop-blur">
            <div className="mb-2 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10"><Users className="h-5 w-5 text-primary" /></div><p className="text-sm text-muted-foreground">Starter Draft</p></div>
            <p className="text-2xl font-bold text-foreground">15 Choices → Keep 5</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose your free Starter 5 and begin building your club.</p>
          </Card>
          <Card className="border-emerald-300/20 bg-emerald-400/[.07] p-5 backdrop-blur">
            <div className="mb-2 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-400/10"><Trophy className="h-5 w-5 text-emerald-300" /></div><p className="text-sm text-emerald-100/65">Free Route</p></div>
            <p className="text-2xl font-bold text-foreground">FREE Card Cups</p>
            <p className="mt-1 text-sm text-muted-foreground">Compete with your cards and work toward winning better cards.</p>
          </Card>
          <Card className="border-border/80 bg-card/95 p-5 backdrop-blur">
            <div className="mb-2 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10"><Target className="h-5 w-5 text-primary" /></div><p className="text-sm text-muted-foreground">Real Football</p></div>
            <p className="text-2xl font-bold text-foreground">5 Cards + Captain</p>
            <p className="mt-1 text-sm text-muted-foreground">GK, DEF, MID, FWD and Wildcard/Utility with real-match scoring.</p>
          </Card>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-center text-3xl font-black text-foreground sm:text-4xl">How Fantasy Arena Works</h2>
        <p className="mx-auto mb-12 max-w-3xl text-center leading-7 text-muted-foreground">
          The easiest way to understand Fantasy Arena is to start with the free route: build your club, choose your cards, play Free Card Cups and grow from what you win.
        </p>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {freeFlowSteps.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-border/80 bg-card/75 p-6 backdrop-blur">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                <div><h3 className="font-bold text-foreground">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="free-card-cups" className="border-y border-emerald-300/10 bg-emerald-400/[.035]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <div className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Your free route</div>
              <h2 className="mt-3 text-3xl font-black text-foreground sm:text-4xl">Starting free is part of the game — not a trial.</h2>
              <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">
                Every new manager can receive a free Starter 5 and enter eligible Free Card Cups. The goal is simple: use real football knowledge to perform well, win better cards and build upward through the rarity levels.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["5 free starter cards", "N$0 Free Card Cups", "Real Premier League scoring", "Win player cards", "Build Common → Legendary"].map((item) => (
                  <span key={item} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-100">{item}</span>
                ))}
              </div>
            </div>
            <Card className="border-emerald-300/20 bg-background/70 p-6">
              <h3 className="text-xl font-black text-foreground">What can I do with a card I win?</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <p><strong className="text-foreground">Keep it:</strong> build your permanent Collection and rarity depth.</p>
                <p><strong className="text-foreground">Play it:</strong> use the card in tournaments where its rarity is eligible.</p>
                <p><strong className="text-foreground">Loan it:</strong> when the Loan Marketplace is open, eligible cards can be loaned to another manager for selected gameweeks.</p>
                <p><strong className="text-foreground">Trade it later:</strong> eligible cards can be listed when Marketplace trading controls are open.</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border/80 bg-card/60 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[.18em] text-primary">Scoring</div>
              <h2 className="mt-2 text-2xl font-black text-foreground">Real performances. Published points.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Fantasy Arena publishes the complete scoring table separately so managers can see exactly what earns or loses points before competing.</p>
            </div>
            <a href="/legal/scoring"><Button variant="outline">View Complete Scoring Rules</Button></a>
          </div>
        </div>
      </section>

      <section id="more-ways" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <div className="text-xs font-black uppercase tracking-[.2em] text-primary">Discover more when you're ready</div>
          <h2 className="mt-3 text-3xl font-black text-foreground sm:text-4xl">More Ways to Play</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">The free route comes first. These additional systems live in their own areas of Fantasy Arena, where their detailed rules and pricing belong.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {deeperFeatures.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="p-6">
              <div className="mb-3 flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><h3 className="font-bold text-foreground">{title}</h3></div>
              <p className="text-sm leading-6 text-muted-foreground">{text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.045] p-5 text-center">
          <p className="text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Production Preview:</strong> Fantasy Arena is open so you can create your club and see how the platform works while final launch checks are completed. Some launch-controlled features may remain temporarily unavailable until they are opened from Admin.</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 text-center sm:p-10">
          <h3 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">Ready to Build Your Club?</h3>
          <p className="mx-auto mb-2 max-w-xl text-muted-foreground">Choose your five free starter cards and discover Fantasy Arena for yourself.</p>
          <p className="mx-auto mb-6 max-w-xl text-sm font-semibold text-emerald-300">Free to start. No deposit required.</p>
          <a href={loginHref}><Button size="lg" data-testid="button-final-cta">Get My 5 Free Cards</Button></a>
        </Card>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><img src={BRAND_LOGO} alt="" className="h-9 w-9 rounded-xl object-cover" /><span>Fantasy Arena &copy; 2026</span></div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground"><a href="/terms-and-conditions" className="hover:text-foreground">Terms</a><a href="/privacy-policy" className="hover:text-foreground">Privacy</a><a href="/contact-us" className="hover:text-foreground">Contact</a></div>
        </div>
      </footer>
    </div>
  );
}

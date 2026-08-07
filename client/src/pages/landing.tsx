import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  BarChart3,
  CheckCircle2,
  Gavel,
  Gift,
  MessageCircle,
  ShoppingCart,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

const BRAND_LOGO = "/brand/fantasy-arena-logo.jpg?v=lion-jpg-2026-08";

const tournamentRules = [
  { rarity: "Common", requirement: "5 Common", fee: "N$10", funding: "2.0×" },
  { rarity: "Rare", requirement: "4 Rare + 1 Common/Rare", fee: "N$50", funding: "1.8×" },
  { rarity: "Unique", requirement: "3 Unique + 2 Common/Rare/Unique", fee: "N$100", funding: "1.7×" },
  { rarity: "Epic", requirement: "2 Epic + 3 lower/Epic", fee: "N$250", funding: "1.6×" },
  { rarity: "Legendary", requirement: "1 Legendary + any 4", fee: "N$500", funding: "1.5×" },
];

const flowSteps = [
  {
    icon: Users,
    title: "1. Create your club",
    text: "Sign in with Google and register a unique manager team name. Team names cannot be reused by another manager.",
  },
  {
    icon: Star,
    title: "2. Choose your Starter 5",
    text: "You receive 15 Common starter choices across five groups: Goalkeepers, Defenders, Midfielders, Forwards and Wildcards. Choose one card from each group to keep as your five starter cards.",
  },
  {
    icon: Target,
    title: "3. Build a five-card tournament team",
    text: "Every tournament entry uses exactly five different cards: Goalkeeper, Defender, Midfielder, Forward and one Utility card. Pick one of the five as captain before submitting.",
  },
  {
    icon: Trophy,
    title: "4. Enter the correct rarity tournament",
    text: "Each tournament shows its rarity requirement, entry fee, deadline and prize information before you confirm. Submitted lineups are final, and used cards stay locked until that entry is settled or cancelled.",
  },
  {
    icon: BarChart3,
    title: "5. Score from real Premier League matches",
    text: "Cards score from real Premier League match data: minutes, goals, assists, clean sheets, saves, bonus points and detailed actions such as key/crucial passes, tackles, interceptions, duels, shots on target, successful dribbles, blocks and fouls. Your captain adds 10% to the lineup total.",
  },
  {
    icon: Gift,
    title: "6. Unlock the Prize Vault together",
    text: "Official public tournament entries of the same rarity and gameweek count toward that rarity's shared Prize Vault ladder. The highest fully unlocked prize becomes the active reward for that rarity and gameweek.",
  },
  {
    icon: TrendingUp,
    title: "7. Grow your collection",
    text: "Build beyond your starter cards with Common, Rare, Unique, Epic and Legendary cards. When trading controls are open, eligible cards can be bought or listed on the Marketplace and bid on through Auctions.",
  },
  {
    icon: Wallet,
    title: "8. Receive winnings and claim prizes",
    text: "Cash tournament winnings are credited to your Fantasy Arena N$ balance after settlement. Prize Vault winners claim physical, voucher or cash rewards from My Teams & Prizes and complete any required contact, age, identity or delivery checks.",
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

      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-fuchsia-300/30 bg-black shadow-[0_0_25px_rgba(168,85,247,.3)]">
              <img src={BRAND_LOGO} alt="Fantasy Arena crowned lion" className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="text-lg font-black leading-none text-foreground">Fantasy Arena</div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-[.24em] text-purple-400">Play • Compete • Win</div>
            </div>
          </div>
          <a href={loginHref}><Button data-testid="button-login">Sign In with Google</Button></a>
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
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-background" />
          <div className="absolute -top-10 left-0 h-[140%] w-[60%] blur-3xl" style={{ background: "linear-gradient(90deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.16) 50%, rgba(59,130,246,0) 100%)", animation: "crowdSweep 6.2s ease-in-out infinite" }} />
        </div>

        <div className="relative z-10 mx-auto flex max-w-7xl items-center px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
              <h1 className="font-serif text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Collect. Compete.<br /><span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Conquer.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-white/70">Create your club, collect Premier League player cards, build five-card tournament teams, score from real match performances and chase cash and Prize Vault rewards.</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href={loginHref} className="relative inline-flex">
                  <span className="absolute -inset-2 rounded-2xl blur-xl" style={{ background: "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.55), rgba(59,130,246,0.0) 70%)", animation: "glowPulse 2.4s ease-in-out infinite" }} aria-hidden />
                  <Button size="lg" data-testid="button-get-started" className="relative">Create Your Club</Button>
                </a>
                <a href="#how-it-works"><Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">See Exactly How It Works</Button></a>
              </div>
              <motion.div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.35 }}>
                <span className="flex items-center gap-1"><Star className="h-4 w-4" /> 5 Free Starter Cards</span>
                <span className="flex items-center gap-1"><Target className="h-4 w-4" /> 5-Card Tournament Teams</span>
                <span className="flex items-center gap-1"><BarChart3 className="h-4 w-4" /> Real EPL Match Scoring</span>
              </motion.div>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Common → Legendary rarities", "Prize Vault ladders", "Marketplace + Auctions", "Community Live chat"].map((chip) => <span key={chip} className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80"><CheckCircle2 className="h-3.5 w-3.5" />{chip}</span>)}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-border/80 bg-card/95 p-5 backdrop-blur"><div className="mb-2 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10"><Users className="h-5 w-5 text-primary" /></div><p className="text-sm text-muted-foreground">Starter Setup</p></div><p className="text-2xl font-bold text-foreground">15 Choices → Keep 5</p><p className="mt-1 text-sm text-muted-foreground">Choose one Common starter card from each of five position groups.</p></Card>
          <Card className="border-border/80 bg-card/95 p-5 backdrop-blur"><div className="mb-2 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10"><Trophy className="h-5 w-5 text-primary" /></div><p className="text-sm text-muted-foreground">Tournament Team</p></div><p className="text-2xl font-bold text-foreground">5 Cards + Captain</p><p className="mt-1 text-sm text-muted-foreground">GK, DEF, MID, FWD and Utility, with a 10% captain bonus.</p></Card>
          <Card className="border-border/80 bg-card/95 p-5 backdrop-blur"><div className="mb-2 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10"><Gift className="h-5 w-5 text-primary" /></div><p className="text-sm text-muted-foreground">Prize Vault</p></div><p className="text-2xl font-bold text-foreground">Shared Rarity Ladder</p><p className="mt-1 text-sm text-muted-foreground">Tournament entries work together to unlock the next reward for that rarity and gameweek.</p></Card>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-center text-3xl font-black text-foreground sm:text-4xl">How Fantasy Arena Actually Works</h2>
        <p className="mx-auto mb-12 max-w-3xl text-center text-muted-foreground">Fantasy Arena is a five-card Premier League fantasy competition built around collectible player cards, rarity tournaments, real match statistics and shared Prize Vault ladders. This is the current flow from signup to winning.</p>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {flowSteps.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-border/80 bg-card/75 p-6 backdrop-blur">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                <div><h3 className="font-bold text-foreground">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-14">
          <div className="mb-6 text-center"><h3 className="text-2xl font-black text-foreground">Tournament rarity rules</h3><p className="mt-2 text-sm text-muted-foreground">Rarity changes which cards you may enter. It does not multiply a player's football score.</p></div>
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/60">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border/80 bg-white/[.03] text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Tournament</th><th className="px-4 py-3">Required cards</th><th className="px-4 py-3">Entry fee</th><th className="px-4 py-3">Prize Vault funding</th></tr></thead>
              <tbody>{tournamentRules.map((rule) => <tr key={rule.rarity} className="border-b border-border/50 last:border-0"><td className="px-4 py-3 font-bold text-foreground">{rule.rarity}</td><td className="px-4 py-3 text-muted-foreground">{rule.requirement}</td><td className="px-4 py-3 font-semibold text-foreground">{rule.fee}</td><td className="px-4 py-3 font-semibold text-primary">{rule.funding}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">What does 2.0× funding mean?</strong> The Prize Vault unlock target is the advertised prize value multiplied by the rarity funding factor. For example, a N$100 Common prize at 2.0× has a N$200 unlock target. At a N$10 Common entry fee, that tier needs 20 qualifying entries before it is fully unlocked.</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="p-6"><div className="mb-3 flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /><h3 className="font-bold text-foreground">Marketplace</h3></div><p className="text-sm leading-6 text-muted-foreground">Buy eligible listed cards or list cards from your Collection when marketplace controls are open. Prices and fees are shown in Namibian dollars before confirmation.</p></Card>
          <Card className="p-6"><div className="mb-3 flex items-center gap-2"><Gavel className="h-5 w-5 text-primary" /><h3 className="font-bold text-foreground">Auctions</h3></div><p className="text-sm leading-6 text-muted-foreground">Bid on auctioned cards when auctions are open. Your bid must meet the displayed minimum and auction rules, and winning bids settle through your Fantasy Arena balance.</p></Card>
          <Card className="p-6"><div className="mb-3 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /><h3 className="font-bold text-foreground">Community Live</h3></div><p className="text-sm leading-6 text-muted-foreground">Chat with other managers from the floating Community Live panel while you use the site. Replies, mentions, edits and message controls are built into the chat.</p></Card>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-5 text-center">
          <p className="text-sm leading-6 text-amber-100/85"><strong className="text-amber-100">Production preview:</strong> You can create your club, receive starter cards and explore the arena now. Trading, wallet actions, paid tournament entries and auction bids may remain read-only until launch controls are opened.</p>
        </div>

        <div className="mt-8 text-center"><a href="/legal/scoring" className="text-sm font-bold text-primary hover:underline">View the complete scoring table →</a></div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8"><Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 text-center sm:p-10"><h3 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">Ready to Build Your Club?</h3><p className="mx-auto mb-6 max-w-xl text-muted-foreground">Create your manager team name, choose your five free starter cards and enter the Fantasy Arena dashboard.</p><a href={loginHref}><Button size="lg" data-testid="button-final-cta">Create Your Club with Google</Button></a></Card></section>

      <footer className="border-t border-border py-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3 text-sm text-muted-foreground"><img src={BRAND_LOGO} alt="" className="h-9 w-9 rounded-xl object-cover" /><span>Fantasy Arena &copy; 2026</span></div><div className="flex items-center gap-4 text-sm text-muted-foreground"><a href="/terms-and-conditions" className="hover:text-foreground">Terms</a><a href="/privacy-policy" className="hover:text-foreground">Privacy</a><a href="/contact-us" className="hover:text-foreground">Contact</a></div></div></footer>
    </div>
  );
}

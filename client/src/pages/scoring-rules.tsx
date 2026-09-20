import { Link } from "wouter";
import { CheckCircle2, Info, ShieldCheck, Trophy } from "lucide-react";
import {
  CAPTAIN_BONUS_PERCENT,
  PLAYER_SCORE_RULES,
  SCORE_PRECISION_DECIMALS,
} from "../../../shared/game-rules";

type ScoreRow = {
  group: "Core" | "Detailed performance" | "Penalties";
  event: string;
  applies: string;
  points: string;
  note?: string;
};

const p = PLAYER_SCORE_RULES.positive;
const d = PLAYER_SCORE_RULES.detailedPerformance;
const n = PLAYER_SCORE_RULES.negative;
const c = PLAYER_SCORE_RULES.caps;

const rows: ScoreRow[] = [
  { group: "Core", event: "Played 60 minutes or more", applies: "All positions", points: `+${p.minutes60Plus}` },
  { group: "Core", event: "Played 30–59 minutes", applies: "All positions", points: `+${p.minutes30To59}` },
  { group: "Core", event: "Played 1–29 minutes", applies: "All positions", points: `+${p.minutes1To29}` },
  { group: "Core", event: "Every exact minute played", applies: "All positions", points: `+${p.minutePlayed} each`, note: "Added on top of the appearance band so 89 and 90 minutes do not score identically." },
  { group: "Core", event: "Goal scored", applies: "All positions", points: `+${p.goal} each` },
  { group: "Core", event: "Assist", applies: "All positions", points: `+${p.assist} each` },
  { group: "Core", event: "Clean sheet", applies: "Goalkeeper", points: `+${p.cleanSheetGoalkeeper}` },
  { group: "Core", event: "Clean sheet", applies: "Defender", points: `+${p.cleanSheetDefender}` },
  { group: "Core", event: "Clean sheet", applies: "Midfielder", points: `+${p.cleanSheetMidfielder}` },
  { group: "Core", event: "Penalty saved", applies: "Goalkeeper", points: `+${p.penaltySaveGoalkeeper} each` },
  { group: "Core", event: "Every 3 saves", applies: "Goalkeeper", points: `+${p.everyThreeSavesGoalkeeper}` },
  { group: "Core", event: "Every individual goalkeeper save", applies: "Goalkeeper", points: `+${d.goalkeeperSave} each`, note: "Awarded alongside the existing bonus for every third save." },

  { group: "Detailed performance", event: "Key / crucial pass", applies: "All positions", points: `+${d.keyPass} each`, note: "A pass recorded by the detailed match provider as creating a direct shooting opportunity." },
  { group: "Detailed performance", event: "Every completed pass", applies: "All positions", points: `+${(1 / d.completedPassesPerPoint).toFixed(4)} each`, note: `Every pass counts fractionally; capped at +${d.completedPassesMax} per player per gameweek.` },
  { group: "Detailed performance", event: "Passing accuracy", applies: "All positions", points: `+${d.passingAccuracyPercent} per %`, note: "A player completing 80% of passes receives +0.88 points." },
  { group: "Detailed performance", event: "Successful tackle", applies: "Outfield players", points: `+${d.tackle} each` },
  { group: "Detailed performance", event: "Interception", applies: "Outfield players", points: `+${d.interception} each` },
  { group: "Detailed performance", event: "Duel won", applies: "Outfield players", points: `+${d.duelWon} each` },
  { group: "Detailed performance", event: "Duel lost", applies: "Outfield players", points: String(d.duelLost) },
  { group: "Detailed performance", event: "Shot on target", applies: "Outfield players", points: `+${d.shotOnTarget} each` },
  { group: "Detailed performance", event: "Shot off target", applies: "Outfield players", points: `+${d.shotOffTarget} each` },
  { group: "Detailed performance", event: "Successful dribble", applies: "Outfield players", points: `+${d.successfulDribble} each` },
  { group: "Detailed performance", event: "Unsuccessful dribble", applies: "Outfield players", points: String(d.unsuccessfulDribble) },
  { group: "Detailed performance", event: "Defensive block", applies: "All positions", points: `+${d.block} each` },
  { group: "Detailed performance", event: "Foul won", applies: "All positions", points: `+${d.foulDrawn} each` },
  { group: "Detailed performance", event: "Foul committed", applies: "All positions", points: String(d.foulCommitted), note: "This reduces the performance component before its cap is applied." },
  { group: "Detailed performance", event: "Penalty won", applies: "All positions", points: `+${d.penaltyWon} each` },
  { group: "Detailed performance", event: "Penalty scored", applies: "All positions", points: `+${d.penaltyScored} each`, note: "Awarded in addition to the ordinary goal points." },
  { group: "Detailed performance", event: "Penalty conceded", applies: "All positions", points: String(d.penaltyConceded) },
  { group: "Detailed performance", event: "Offside", applies: "Outfield players", points: String(d.offside) },

  { group: "Penalties", event: "Yellow card", applies: "All positions", points: String(n.yellowCard) },
  { group: "Penalties", event: "Red card", applies: "All positions", points: String(n.redCard) },
  { group: "Penalties", event: "Own goal", applies: "All positions", points: String(n.ownGoal) },
  { group: "Penalties", event: "Penalty missed", applies: "All positions", points: String(n.penaltyMissed) },
  { group: "Penalties", event: "Each additional goal conceded after the first", applies: "Goalkeeper or Defender", points: String(n.extraGoalConcededGoalkeeperOrDefender) },
];

export default function ScoringRulesPage() {
  return (
    <main className="min-h-screen bg-[#02040c] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 font-black text-white">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />Fantasy Arena
          </Link>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/legal/game-rules" className="rounded-full border border-white/10 px-3 py-1.5 text-white/60 hover:text-white">Game Rules</Link>
            <Link href="/help" className="rounded-full border border-white/10 px-3 py-1.5 text-white/60 hover:text-white">Help</Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,.16),transparent_35%),linear-gradient(145deg,#0b1020,#050711)] p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-200"><Trophy className="h-6 w-6" /></div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Fantasy Arena Trust Centre</div>
              <h1 className="mt-2 text-3xl font-black sm:text-5xl">Scoring Rules</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">Fantasy Arena scores five-card lineups from official Premier League data. Every minute, completed pass and verified match action contributes to a precise four-decimal score.</p>
              <div className="mt-3 text-xs text-white/35">Last updated: 20 September 2026</div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <RuleCard title="Every action counts" text="Exact minutes, every pass, passing accuracy, tackles, duels, shots, dribbles and penalty involvement all shape your score." />
          <RuleCard title="No proxy points" text="ICT, BPS and provider fantasy bonus systems do not add Fantasy Arena points. Only recorded player match statistics count." />
          <RuleCard title={`Captain bonus +${CAPTAIN_BONUS_PERCENT}%`} text="The captain adds a 10% bonus to the lineup total. The card's own score remains unchanged." />
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <h2 className="text-xl font-black">Complete points table</h2>
            <p className="mt-1 text-sm text-white/50">Hold your pointer over a row for 3 seconds to see guided help.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[790px] border-collapse text-left text-sm">
              <thead className="bg-cyan-300/8 text-[11px] uppercase tracking-[.16em] text-cyan-100/70">
                <tr><th className="px-5 py-4">Category</th><th className="px-5 py-4">Match event</th><th className="px-5 py-4">Applies to</th><th className="px-5 py-4 text-right">Points</th><th className="px-5 py-4">Explanation</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.group}-${row.event}-${row.applies}`} className="border-t border-white/8 hover:bg-white/[.035]" data-help={`${row.event} gives ${row.points} points to ${row.applies}. ${row.note || ""}`}>
                    <td className="px-5 py-4 text-[10px] font-black uppercase tracking-[.12em] text-cyan-100/55">{row.group}</td>
                    <td className="px-5 py-4 font-semibold text-white/90">{row.event}</td>
                    <td className="px-5 py-4 text-white/52">{row.applies}</td>
                    <td className={`px-5 py-4 text-right text-base font-black ${row.points.startsWith("-") ? "text-rose-300" : "text-emerald-300"}`}>{row.points}</td>
                    <td className="px-5 py-4 text-xs leading-5 text-white/42">{row.note || "Applied when confirmed by official gameweek data."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-400/[.06] p-5 sm:p-6">
          <div className="flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" /><div><h2 className="font-black">Player-stat-only scoring</h2><p className="mt-2 text-sm leading-6 text-white/55">Fantasy Arena scores recorded player match actions only. Core events such as minutes, goals, assists, cards, clean sheets and saves are combined with verified detailed actions such as passes, tackles, duels, shots and dribbles. If detailed actions are temporarily unavailable, no ICT, BPS, FPL bonus or other proxy points are added.</p></div></div>
        </section>

        <section className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-400/[.06] p-5 sm:p-6">
          <div className="flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-violet-200" /><div><h2 className="font-black">Score component limits</h2><p className="mt-2 text-sm leading-6 text-white/55">Decisive actions are capped at {c.decisiveMin}–{c.decisiveMax}; performance at {c.performanceMin}–{c.performanceMax}; penalties at {c.penaltiesMin}–{c.penaltiesMax}; bonus at {c.bonusMin}–{c.bonusMax}; and the final card score at {c.finalMin}–{c.finalMax}.</p></div></div>
        </section>

        <section className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-400/[.06] p-5 sm:p-6">
          <div className="flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" /><div><h2 className="font-black">Precise scoring and fair tie-breakers</h2><p className="mt-2 text-sm leading-6 text-white/55">Player scores, captain bonuses and lineup totals are kept to {SCORE_PRECISION_DECIMALS} decimal places. If teams still finish level, the winner is decided by captain score, goals, assists, key passes, shots on target, defensive actions, goalkeeper saves, completed passes, minutes played, lower squad value, card XP, rarity prestige and finally the earlier lineup submission.</p></div></div>
        </section>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-white/48">
          Final settlement uses the stored gameweek scoring snapshot after official checks. Live totals can change before settlement when provider data is corrected or completed.
        </div>
      </div>
    </main>
  );
}

function RuleCard({ title, text }: { title: string; text: string }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="flex items-center gap-2 font-black"><CheckCircle2 className="h-4 w-4 text-cyan-300" />{title}</div><p className="mt-2 text-sm leading-6 text-white/50">{text}</p></section>;
}

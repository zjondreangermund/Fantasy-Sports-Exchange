import fs from "node:fs";

const competitions = fs.readFileSync("client/src/pages/competitions-vault.tsx", "utf8");
const landing = fs.readFileSync("client/src/pages/landing.tsx", "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(competitions.includes("PLAY_CURRENT_GAMEWEEK_TABS_V1"), "Play current-gameweek patch marker is missing");
expect(competitions.includes('const [tournamentView, setTournamentView] = useState<"live" | "completed">("live")'), "Play must default to Live & Upcoming rather than completed tournaments");
expect(competitions.includes("futureSettlementWeeks"), "Current gameweek must advance from tournament settlement cutoffs");
expect(competitions.includes("row.settlementMs > now"), "Past-settlement gameweeks must not remain current");
expect(competitions.includes('tournamentView === "completed" ? completedOfficial : official'), "Completed tournaments must live in their own tab");
expect(competitions.includes("Latest completed"), "Completed tab needs a latest-completed gameweek selector");
expect(competitions.includes("Live & Upcoming"), "Play needs a Live & Upcoming tab");
expect(competitions.includes("Completed <span"), "Play needs a Completed tab");
expect(!competitions.includes('{completedOfficial.length ? <section className="rounded-[2rem]'), "Completed tournaments must not render underneath the normal Play list");
expect(competitions.includes('tournamentView === "live" ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">My Private Tournaments</h2>'), "Private tournament controls must stay out of the Completed tab");
expect(landing.includes('data-auth-copy="login-signup"'), "Landing login CTA marker is missing");
expect(landing.includes('>Login / Sign Up</Button>'), "Landing login CTA must say Login / Sign Up");

if (failures.length) {
  console.error("Play gameweek/navigation verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Play navigation verified: current GW follows settlement, completed tournaments are tabbed, and login copy is explicit.");

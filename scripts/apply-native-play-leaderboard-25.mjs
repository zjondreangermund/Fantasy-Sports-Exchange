import fs from "node:fs";

const file = "client/src/components/native/NativePlayPage.tsx";
const marker = "NATIVE_PLAY_LEADERBOARD_25_V1";
let source = fs.readFileSync(file, "utf8");

if (source.includes(marker)) {
  console.log("[native-play-leaderboard] already applied");
  process.exit(0);
}

function replaceRequired(from, to, label) {
  if (!source.includes(from)) throw new Error(`[native-play-leaderboard] ${label} could not be located`);
  source = source.replace(from, to);
}

replaceRequired(
  'import CardPlayerImage from "../CardPlayerImage";',
  'import CardPlayerImage from "../CardPlayerImage";\nimport NativeTournamentLeaderboard from "./NativeTournamentLeaderboard";',
  "native leaderboard import",
);

replaceRequired(
  '  const [pin, setPin] = React.useState("");',
  '  const [pin, setPin] = React.useState("");\n  // NATIVE_PLAY_LEADERBOARD_25_V1\n  const [leaderboardTournament, setLeaderboardTournament] = React.useState<Tournament | null>(null);',
  "native leaderboard state",
);

replaceRequired(
  '<TournamentRow key={tournament.id} tournament={tournament} onEnter={() => openTournament(tournament)} />',
  '<TournamentRow key={tournament.id} tournament={tournament} onEnter={() => openTournament(tournament)} onLeaderboard={() => setLeaderboardTournament(tournament)} />',
  "open cup leaderboard button wiring",
);

replaceRequired(
  '<div className="mt-3 flex items-center justify-between border-t border-white/[.06] pt-2.5 text-xs"><span className="text-slate-500">5 cards locked for this entry</span><Link href="/live-lineup" className="font-black text-cyan-200">View squad</Link></div>',
  '<div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[.06] pt-2.5 text-xs"><span className="text-slate-500">5 cards locked for this entry</span><div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => competition && setLeaderboardTournament(competition)} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[9px] font-black ${tone.border} ${tone.soft} ${tone.text}`}><Trophy className="h-3 w-3" />Leaderboard</button><Link href="/live-lineup" className="rounded-lg bg-white/[.05] px-2 py-1.5 text-[9px] font-black text-cyan-200">View squad</Link></div></div>',
  "my entries leaderboard button",
);

replaceRequired(
  '      {selected ? (',
  '      {leaderboardTournament ? (\n        <NativeTournamentLeaderboard tournament={leaderboardTournament} onClose={() => setLeaderboardTournament(null)} />\n      ) : null}\n\n      {selected ? (',
  "native leaderboard overlay",
);

replaceRequired(
  'function TournamentRow({ tournament, onEnter }: { tournament: Tournament; onEnter: () => void }) {',
  'function TournamentRow({ tournament, onEnter, onLeaderboard }: { tournament: Tournament; onEnter: () => void; onLeaderboard: () => void }) {',
  "tournament row leaderboard prop",
);

replaceRequired(
  '<div className="mt-3 flex items-center justify-between border-t border-white/[.06] pt-2.5"><div className="flex items-center gap-2 text-[10px] text-slate-500"><UsersRound className="h-3.5 w-3.5" /><span>5-card team</span><ShieldCheck className="ml-1 h-3.5 w-3.5" /><span>Premier League</span></div><button onClick={onEnter} disabled={!open} className={`rounded-xl px-3.5 py-2 text-[10px] font-black disabled:bg-white/5 disabled:text-slate-600 ${open ? tone.button : ""}`}>{open ? fee > 0 ? money(fee) : "Enter" : "Closed"}</button></div>',
  '<div className="mt-3 border-t border-white/[.06] pt-2.5"><div className="flex items-center gap-2 text-[10px] text-slate-500"><UsersRound className="h-3.5 w-3.5" /><span>5-card team</span><ShieldCheck className="ml-1 h-3.5 w-3.5" /><span>Premier League</span></div><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={onLeaderboard} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black ${tone.border} ${tone.soft} ${tone.text}`}><Trophy className="h-3.5 w-3.5" />Leaderboard</button><button onClick={onEnter} disabled={!open} className={`rounded-xl px-3.5 py-2 text-[10px] font-black disabled:bg-white/5 disabled:text-slate-600 ${open ? tone.button : ""}`}>{open ? fee > 0 ? money(fee) : "Enter" : "Closed"}</button></div></div>',
  "tournament row action buttons",
);

fs.writeFileSync(file, source);
console.log("[native-play-leaderboard] Added mobile Leaderboard buttons, 25-team paging and live scoring drilldown.");

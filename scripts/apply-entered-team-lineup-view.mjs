import fs from "node:fs";

const file = "client/src/pages/live-lineup.tsx";
let source = fs.readFileSync(file, "utf8");
const marker = "ENTERED_TOURNAMENT_TEAMS_LINEUP_V1";
if (source.includes(marker)) {
  console.log("[entered-team-lineup] already applied");
  process.exit(0);
}

function replaceRequired(from, to, label) {
  if (!source.includes(from)) throw new Error(`[entered-team-lineup] anchor not found: ${label}`);
  source = source.replace(from, to);
}

replaceRequired(
  'import CardProfileModal from "../components/cards/CardProfileModal";\n',
  'import CardProfileModal from "../components/cards/CardProfileModal";\nimport TournamentEntryTeamCard from "../components/tournaments/TournamentEntryTeamCard";\n',
  "entered-team component import",
);
replaceRequired(
  'import { type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";',
  'import { type CompetitionEntry, type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";',
  "competition entry type import",
);

replaceRequired(
  `function shortTeam(value: unknown) {\n  return String(value || "FA").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "FA";\n}\n`,
  `function shortTeam(value: unknown) {\n  return String(value || "FA").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "FA";\n}\n\nfunction entryCompetitionId(entry: CompetitionEntry) {\n  return Number((entry as any).competitionId ?? (entry as any).competition_id ?? 0);\n}\n\nfunction entryId(entry: CompetitionEntry) {\n  return Number((entry as any).id || 0);\n}\n\nfunction competitionFinished(competition: any) {\n  return ["completed", "cancelled"].includes(String(competition?.status || "").toLowerCase());\n}\n`,
  "entry helpers",
);

const lineupQueryEnd = `  const { data: livePointEvents = [] } = useQuery<LivePointEvent[]>({`;
replaceRequired(
  lineupQueryEnd,
  `  // ${marker}\n  const { data: enteredRaw = [] } = useQuery<CompetitionEntry[]>({\n    queryKey: ["/api/competitions/my-entries"],\n    queryFn: async () => {\n      const response = await fetch("/api/competitions/my-entries", { credentials: "include" });\n      if (!response.ok) return [];\n      const data = await response.json();\n      return Array.isArray(data) ? data : data?.entries || [];\n    },\n    refetchInterval: 30_000,\n  });\n  const { data: competitionsRaw = [] } = useQuery<any[]>({\n    queryKey: ["/api/competitions"],\n    queryFn: async () => {\n      const response = await fetch("/api/competitions", { credentials: "include" });\n      if (!response.ok) return [];\n      const data = await response.json();\n      return Array.isArray(data) ? data : data?.competitions || [];\n    },\n    refetchInterval: 30_000,\n  });\n\n${lineupQueryEnd}`,
  "entered teams queries",
);

replaceRequired(
  `  const relevantTeamEvents = livePointEvents\n    .filter((event) => {`,
  `  const competitionById = useMemo(() => new Map(competitionsRaw.map((competition) => [Number(competition.id), competition])), [competitionsRaw]);\n  const enteredTeams = useMemo(() => enteredRaw\n    .map((entry) => ({ entry, competition: competitionById.get(entryCompetitionId(entry)) }))\n    .filter((row) => Boolean(row.competition))\n    .sort((a, b) => {\n      const activeDiff = Number(competitionFinished(a.competition)) - Number(competitionFinished(b.competition));\n      return activeDiff || entryId(b.entry) - entryId(a.entry);\n    }), [competitionById, enteredRaw]);\n\n  const relevantTeamEvents = livePointEvents\n    .filter((event) => {`,
  "entered teams derived state",
);

replaceRequired(
  `<h1 className="mt-2 text-3xl font-black tracking-tight text-white">Live Lineup</h1>\n            <p className="mt-1 max-w-3xl text-sm text-slate-400">Official season statistics are shown on player cards. Team-feed events remain separate and are never assigned to an individual player without a verified player event.</p>`,
  `<h1 className="mt-2 text-3xl font-black tracking-tight text-white">Tournament Lineups</h1>\n            <p className="mt-1 max-w-3xl text-sm text-slate-400">Your submitted teams are shown with the tournament they entered, the exact five locked cards, captain contribution and live/final tournament score.</p>`,
  "lineup heading",
);

const currentFiveAnchor = `        {isLoading ? (\n          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">`;
replaceRequired(
  currentFiveAnchor,
  `        <section className="space-y-3 rounded-3xl border border-cyan-300/15 bg-cyan-300/[.035] p-4 sm:p-5">\n          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-200/65">Entered teams</p><h2 className="mt-1 text-xl font-black text-white">Your tournament squads</h2><p className="mt-1 text-xs text-slate-500">Each card below is one submitted tournament entry. Multiple teams in the same tournament stay separate.</p></div><div className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-200">{enteredTeams.length} teams</div></div>\n          {enteredTeams.length ? <div className="space-y-3">{enteredTeams.map(({ entry, competition }) => <TournamentEntryTeamCard key={entryId(entry)} entry={entry} competition={competition} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">You have not submitted a tournament team yet.</div>}\n        </section>\n\n        <section>\n          <div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Collection reference</p><h2 className="mt-1 text-lg font-black text-white">Current five-card reference lineup</h2></div>\n${currentFiveAnchor}`,
  "entered-team section",
);

replaceRequired(
  `        )}\n\n        <section className="grid gap-5 xl:grid-cols-[1fr_.72fr]">`,
  `        )}\n        </section>\n\n        <section className="grid gap-5 xl:grid-cols-[1fr_.72fr]">`,
  "close collection reference section",
);

fs.writeFileSync(file, source);
console.log("[entered-team-lineup] detailed Squad/Lineup now shows every entered tournament team and tournament association.");

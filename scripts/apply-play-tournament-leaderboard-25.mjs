import fs from "node:fs";

const file = "client/src/pages/competitions-vault.tsx";
let source = fs.readFileSync(file, "utf8");

const marker = "PLAY_TOURNAMENT_LEADERBOARD_25_V1";
if (source.includes(marker)) {
  console.log("[play-leaderboard-25] already applied");
  process.exit(0);
}

const functionAnchor = "function TournamentLeaderboardPreview({ comp }: { comp: Tournament }) {";
const functionIndex = source.indexOf(functionAnchor);
if (functionIndex < 0) throw new Error("[play-leaderboard-25] TournamentLeaderboardPreview not found");

source = source.replace(
  "/leaderboard?page=${page}&pageSize=100",
  "/leaderboard?page=${page}&pageSize=25",
);
source = source.replace("100 teams per page", "25 teams per page");

const previewStart = source.indexOf('    <section className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-3.5">', functionIndex);
const dialogStart = source.indexOf('    <Dialog open={open}', previewStart);
if (previewStart < 0 || dialogStart < 0) throw new Error("[play-leaderboard-25] leaderboard preview section anchors not found");

const launcher = `    {/* ${marker} */}
    <section className="mt-5">
      <button
        type="button"
        onClick={() => { setPage(1); setSelectedEntry(null); setExpandedCardId(null); setOpen(true); }}
        className="group w-full rounded-2xl border bg-black/35 p-3.5 text-left transition hover:-translate-y-0.5"
        style={{ borderColor: accent + "66", boxShadow: "0 0 24px " + rarityTheme[tier(comp.tier)].glow }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border" style={{ borderColor: accent + "66", background: accent + "18" }}><Eye className="h-5 w-5" style={{ color: accent }} /></div>
            <div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[.17em]" style={{ color: accent }}>Leaderboard</div><div className="mt-0.5 truncate text-sm font-black text-white">View standings & scoring</div></div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-right"><div><div className="text-sm font-black text-white">{totalEntries} teams</div><div className="text-[10px] font-bold text-white/45">25 per page</div></div><ChevronRight className="h-4 w-4 text-white/45 transition group-hover:translate-x-0.5" /></div>
        </div>
      </button>
      <div className="mt-2 px-1 text-[10px] font-semibold leading-4 text-white/40">Live scores refresh every 15 seconds. Open a team to see all five cards, captain contribution and exact player scoring actions.</div>
    </section>

`;
source = source.slice(0, previewStart) + launcher + source.slice(dialogStart);

const oldPagination = `              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.035] p-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button>
                <span className="text-xs font-bold text-white/65">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  Next<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>`;
const newPagination = `              <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] p-2">
                {page > 1 ? <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button> : <span />}
                <span className="text-center text-[11px] font-bold text-white/65">{leaderboard?.leaderboard?.length ? "Showing " + ((page - 1) * 25 + 1) + "-" + ((page - 1) * 25 + leaderboard.leaderboard.length) + " of " + leaderboard.totalEntries : "No entries"}<span className="block text-[10px] font-semibold text-white/35">Page {page} of {totalPages}</span></span>
                {page < totalPages ? <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  Next<ChevronRight className="ml-1 h-4 w-4" />
                </Button> : <span />}
              </div>`;
if (!source.includes(oldPagination)) throw new Error("[play-leaderboard-25] pagination block not found");
source = source.replace(oldPagination, newPagination);

source = source.replace(
  "Select any team to view its five-player lineup and exact scoring actions.",
  "Select any team to view its five-card lineup, player totals, captain bonus and live/final score. Then tap a player for the exact scoring actions.",
);

const playerScoreRow = '<div className="shrink-0 text-right"><div className="text-base font-black text-emerald-200">{scoreLabel(player.points)}</div><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/40">points</div></div>';
const playerContributionRow = '<div className="shrink-0 text-right"><div className="text-base font-black text-emerald-200">{scoreLabel(player.contribution)}</div><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/40">team pts</div></div>';
if (!source.includes(playerScoreRow)) throw new Error("[play-leaderboard-25] player score row not found");
source = source.replace(playerScoreRow, playerContributionRow);

fs.writeFileSync(file, source);
console.log("[play-leaderboard-25] Play tournament cards now open a 25-team paginated leaderboard with live scoring details.");

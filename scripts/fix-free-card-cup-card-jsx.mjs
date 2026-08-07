import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "client", "src", "pages", "competitions.tsx");
let source = fs.readFileSync(file, "utf8");

const start = source.indexOf("function CompetitionCard(");
if (start < 0) throw new Error("Free Card Cup CompetitionCard function not found");

const cleanFunction = `function CompetitionCard({ comp, entered, onJoin }: { comp: CompetitionWithEntries; entered: boolean; onJoin: () => void }) {
  const entryCount = n(comp.entryCount || (comp.entries || []).length);
  const maxEntries = n(comp.max_entries || comp.maxEntries);
  const freeCardCup = n(comp.entryFee) <= 0 && (comp.isFreeCardCup || Boolean((comp as any).prizeCardRarity));
  const progress = freeCardCup
    ? (maxEntries ? Math.min(100, Math.round((entryCount / maxEntries) * 100)) : 100)
    : (maxEntries ? Math.min(100, Math.round((entryCount / maxEntries) * 100)) : prizeProgress(comp));
  const countdown = tournamentCountdown(comp);
  const settlement = tournamentSettlementLabel(comp);
  const schedule = comp.entryOpen === false || comp.status === "active" || comp.status === "closed"
    ? \`settles \${settlement}\`
    : \`entries lock in \${countdown}\`;

  return (
    <Card className={freeCardCup
      ? "group relative overflow-hidden rounded-[2rem] border-emerald-300/30 bg-emerald-950/30 p-0 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,.28)]"
      : "group relative overflow-hidden rounded-[2rem] border-white/10 bg-slate-950/70 p-0 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,.28)]"}>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="capitalize bg-primary/20 text-primary-foreground">{comp.tier}</Badge>
              {freeCardCup && <Badge className="bg-emerald-300 text-emerald-950">FREE ENTRY</Badge>}
            </div>
            <h3 className="mt-2 text-xl font-black">{comp.name}</h3>
            <p className="text-xs text-white/45">GW {comp.gameWeek} • {schedule}</p>
          </div>
          {entered ? (
            <Badge className="bg-emerald-400/20 text-emerald-100">Entered</Badge>
          ) : comp.entryOpen === false ? (
            <Badge className="bg-red-400/20 text-red-100"><Lock className="mr-1 h-3 w-3" />Locked</Badge>
          ) : (
            <Badge className="bg-cyan-400/20 text-cyan-100">Open</Badge>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/55">
          <Clock className="mr-2 inline h-3.5 w-3.5" />Premier League gameweek points only. Cup matches and fixtures after settlement are excluded.
        </div>

        <PrizeEconomics comp={comp} />

        <div className="grid grid-cols-2 gap-2 text-sm">
          <InfoPill label="Entrants" value={\`\${entryCount}\${maxEntries ? \`/\${maxEntries}\` : ""}\`} helper="This GW only" />
          <InfoPill
            label={freeCardCup ? "Reward" : "Progress"}
            value={freeCardCup ? "Rare Card" : \`\${progress}%\`}
            helper={freeCardCup ? "Winner card prize" : comp.prizeUnlocked ? "Prize unlocked" : "Prize locked"}
          />
        </div>

        {!freeCardCup && (
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan-300" style={{ width: \`\${progress}%\` }} />
          </div>
        )}

        <Button
          onClick={onJoin}
          disabled={entered || comp.entryOpen === false}
          className={freeCardCup ? "w-full rounded-xl bg-emerald-400 font-bold text-emerald-950 hover:bg-emerald-300" : "w-full rounded-xl bg-primary font-bold"}
        >
          {entered ? "Already Entered" : comp.entryOpen === false ? "Closed" : freeCardCup ? "Enter FREE Card Cup" : \`Enter N$\${money(comp.entryFee)}\`}
        </Button>
      </div>
    </Card>
  );
}`;

// CompetitionCard is the final function in this page. Replacing from its start to EOF
// avoids depending on the malformed generated JSX from the compatibility patch.
source = source.slice(0, start) + cleanFunction + "\n";
fs.writeFileSync(file, source);
console.log("[free-card-cups] Repaired CompetitionCard JSX");

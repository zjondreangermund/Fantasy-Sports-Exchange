import fs from "node:fs";

const file = "client/src/components/FootballDataCentre.tsx";
let source = fs.readFileSync(file, "utf8");
const marker = "MATCH_CENTRE_POPUP_WORKSPACE_V1";

if (source.includes(marker)) {
  console.log("[match-centre-popup] popup workspace already applied.");
  process.exit(0);
}

const cardImport = 'import { Card } from "./ui/card";';
const dialogImport = 'import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";';
if (!source.includes(dialogImport)) {
  if (!source.includes(cardImport)) throw new Error("[match-centre-popup] Card import anchor not found");
  source = source.replace(cardImport, `${cardImport}\n${dialogImport}`);
}

const oldGrid = '<div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">';
if (!source.includes(oldGrid)) throw new Error("[match-centre-popup] match-centre split-grid anchor not found");
source = source.replace(oldGrid, `<div className="grid gap-4" data-match-centre-popup-list="${marker}">`);

const oldDetails = `            {match.isError && !match.data ? (\n              <Card className="flex min-h-[18rem] flex-col items-center justify-center gap-3 border-amber-500/30 p-8 text-center">\n                <AlertTriangle className="h-6 w-6 text-amber-300" />\n                <div className="font-semibold">Detailed match intelligence is temporarily unavailable.</div>\n                <div className="text-sm text-muted-foreground">{match.error instanceof Error ? match.error.message : "The live provider could not return this fixture."}</div>\n                <Button size="sm" variant="outline" onClick={() => match.refetch()}>Retry match details</Button>\n              </Card>\n            ) : <MatchIntelligence data={match.data} loading={match.isLoading} onPlayer={(id) => setSelectedPlayerId(id)} />}\n          </div>\n          {selectedPlayerId ? <PlayerProfile data={playerProfile.data} loading={playerProfile.isLoading} /> : null}`;

const newDetails = `          </div>\n\n          <Dialog\n            open={Boolean(selectedFixtureId)}\n            onOpenChange={(open) => {\n              if (!open) {\n                setSelectedFixtureId(null);\n                setSelectedPlayerId(null);\n              }\n            }}\n          >\n            <DialogContent className="max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-5xl rounded-[1.4rem] border-violet-500/30 bg-[#080b14] p-3 shadow-2xl sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)] sm:p-5">\n              <DialogHeader className="sticky top-0 z-20 -mx-3 -mt-3 border-b border-white/10 bg-[#080b14]/95 px-4 py-3 pr-14 backdrop-blur sm:-mx-5 sm:-mt-5 sm:px-5 sm:py-4 sm:pr-14">\n                <DialogTitle className="text-base font-black sm:text-lg">Match intelligence</DialogTitle>\n                <DialogDescription className="text-xs sm:text-sm">Live report, statistics, events, lineups, ratings, availability and head-to-head for the selected fixture.</DialogDescription>\n              </DialogHeader>\n              {match.isError && !match.data ? (\n                <Card className="flex min-h-[18rem] flex-col items-center justify-center gap-3 border-amber-500/30 p-8 text-center">\n                  <AlertTriangle className="h-6 w-6 text-amber-300" />\n                  <div className="font-semibold">Detailed match intelligence is temporarily unavailable.</div>\n                  <div className="text-sm text-muted-foreground">{match.error instanceof Error ? match.error.message : "The live provider could not return this fixture."}</div>\n                  <Button size="sm" variant="outline" onClick={() => match.refetch()}>Retry match details</Button>\n                </Card>\n              ) : <MatchIntelligence data={match.data} loading={match.isLoading} onPlayer={(id) => setSelectedPlayerId(id)} />}\n              {selectedPlayerId ? <PlayerProfile data={playerProfile.data} loading={playerProfile.isLoading} /> : null}\n            </DialogContent>\n          </Dialog>`;

if (!source.includes(oldDetails)) throw new Error("[match-centre-popup] inline match-intelligence block not found");
source = source.replace(oldDetails, newDetails);

fs.writeFileSync(file, source);
console.log("[match-centre-popup] fixture taps now open full match intelligence in a scrollable popup workspace instead of expanding below the fixture list.");

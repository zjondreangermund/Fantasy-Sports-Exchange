import fs from "node:fs";

function patchFile(path, transform) {
  const source = fs.readFileSync(path, "utf8");
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(path, next);
    console.log(`[manual-settlement] patched ${path}`);
  } else {
    console.log(`[manual-settlement] ${path} already patched`);
  }
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[manual-settlement] anchor not found: ${label}`);
  return source.replace(from, to);
}

function replaceOneOf(source, variants, to, marker, label) {
  if (source.includes(marker || to)) return source;
  for (const from of variants) {
    if (source.includes(from)) return source.replace(from, to);
  }
  throw new Error(`[manual-settlement] anchor not found: ${label}`);
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[manual-settlement] anchor not found: ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

patchFile("server/services/scoreUpdater.ts", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    "  async updateCompetition(competitionId: number): Promise<CompetitionScoreResult> {",
    "  async updateCompetition(competitionId: number, options: { forceFinal?: boolean } = {}): Promise<CompetitionScoreResult> {",
    "score updater manual-final signature",
  );
  source = insertAfter(
    source,
    "    if (String(comp.status) === \"cancelled\") throw new Error(`Competition ${competitionId} is cancelled`);\n",
    "    const forceFinal = Boolean(options.forceFinal);\n",
    "const forceFinal = Boolean(options.forceFinal);",
    "score updater force-final flag",
  );
  const finalBlockFrom = `    if (![\"active\", \"closed\"].includes(String(comp.status))) throw new Error(\`Competition \${competitionId} cannot be scored (status: \${comp.status})\`);\n\n    const final = this.isSettlementFinal(comp);\n    const currentGameweek = this.currentOrNextGameweek(bootstrap);`;
  const finalBlockTo = `    if (![\"active\", \"closed\"].includes(String(comp.status))) throw new Error(\`Competition \${competitionId} cannot be scored (status: \${comp.status})\`);\n\n    // MANUAL_TOURNAMENT_SETTLEMENT_V1\n    if (forceFinal) {\n      const settlement = this.settlementDeadline(comp);\n      const eligibleFixtures = this.fixturesForGameweek(fixtures, gameWeek).filter((fixture: any) => {\n        if (!fixture?.kickoff_time) return false;\n        const kickoff = new Date(String(fixture.kickoff_time));\n        if (!Number.isFinite(kickoff.getTime())) return false;\n        return !settlement || kickoff.getTime() <= settlement.getTime();\n      });\n      if (!eligibleFixtures.length) throw new Error(\"No eligible Premier League fixtures are available for manual settlement\");\n      const unfinishedFixtures = eligibleFixtures.filter((fixture: any) => !fixture?.finished && !fixture?.finished_provisional);\n      if (unfinishedFixtures.length) throw new Error(\"Eligible Premier League fixtures are still unfinished\");\n    }\n\n    const final = forceFinal || this.isSettlementFinal(comp);\n    const currentGameweek = this.currentOrNextGameweek(bootstrap);`;
  source = replaceOnce(source, finalBlockFrom, finalBlockTo, "score updater manual final guard");
  return source;
});

patchFile("server/routes/economyIntegrity.routes.ts", (original) => {
  let source = original;
  source = insertAfter(
    source,
    "      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: \"Valid tournament required\" });\n",
    "      const forceManual = Boolean(req.body?.forceManual ?? req.body?.force);\n",
    "const forceManual = Boolean(req.body?.forceManual",
    "manual settle request flag",
  );
  source = replaceOnce(
    source,
    "        const scoring = await new ScoreUpdateService(storage).updateCompetition(competitionId);",
    "        const scoring = await new ScoreUpdateService(storage).updateCompetition(competitionId, { forceFinal: forceManual });",
    "manual settlement scoring call",
  );
  source = replaceOnce(
    source,
    "            settledAt: new Date().toISOString(),",
    "            settledAt: new Date().toISOString(),\n            manualSettlement: forceManual,",
    "settlement manual metadata",
  );
  source = replaceOnce(
    source,
    "        values (${adminId}, 'admin.tournament.settled', ${JSON.stringify({ competitionId, grossPool, platformFee, prizePool, prizeType, prizeVault, sharedEntries, prizeAward: awardRecord, cardLocksReleased: true, replayedPostings })}::jsonb)",
    "        values (${adminId}, 'admin.tournament.settled', ${JSON.stringify({ competitionId, grossPool, platformFee, prizePool, prizeType, prizeVault, sharedEntries, prizeAward: awardRecord, cardLocksReleased: true, replayedPostings, manualSettlement: forceManual })}::jsonb)",
    "manual settlement audit metadata",
  );
  source = insertAfter(
    source,
    "          replayedPostings,\n",
    "          manualSettlement: forceManual,\n",
    "manualSettlement: forceManual,",
    "manual settlement response metadata",
  );
  source = insertAfter(
    source,
    "        \"Stored score does not match the final scoring snapshot\",\n",
    "        \"Eligible Premier League fixtures are still unfinished\",\n        \"No eligible Premier League fixtures are available for manual settlement\",\n",
    "Eligible Premier League fixtures are still unfinished",
    "manual settlement validation messages",
  );
  return source;
});

patchFile("client/src/components/admin/AdminTournamentManager.tsx", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    '    mutationFn: async (competitionId: number) => (await apiRequest("POST", `/api/admin/competitions/settle/${competitionId}`, {})).json(),',
    '    mutationFn: async ({ competitionId, forceManual }: { competitionId: number; forceManual: boolean }) => (await apiRequest("POST", `/api/admin/competitions/settle/${competitionId}`, { forceManual })).json(),',
    "admin settle mutation payload",
  );

  source = replaceOneOf(
    source,
    [
      '    onSuccess: () => {',
      '    onSuccess: (result: any) => {',
    ],
    '    onSuccess: (result: any) => {',
    'onSuccess: (result: any) => {',
    "admin settle result handler",
  );
  source = replaceOneOf(
    source,
    [
      '      toast({ title: "Tournament settled", description: "Tuesday-frozen scores, ranks and prizes are now final." });',
      '      toast({ title: "Tournament settled", description: result?.settlement?.manualSettlement ? "Manual settlement completed using finished eligible Premier League fixtures." : "Final scores, ranks and prizes are now settled." });',
    ],
    '      toast({ title: "Tournament settled", description: result?.settlement?.manualSettlement ? "Manual settlement completed using finished eligible Premier League fixtures." : "Final scores, ranks and prizes are now settled." });',
    'result?.settlement?.manualSettlement',
    "manual settlement success message",
  );

  const requestFrom = `  const requestSettlement = (comp: any) => {\n    if (!window.confirm(\`Settle \"\${comp.name || \"this tournament\"}\" using the score frozen at \${settlementLabel(comp.endDate || comp.end_date)}?\`)) return;\n    settleMutation.mutate(Number(comp.id));\n  };`;
  const requestTo = `  const requestSettlement = (comp: any) => {\n    const settlement = comp.endDate || comp.end_date;\n    const settlementMs = new Date(String(settlement || \"\")).getTime();\n    const forceManual = !Number.isFinite(settlementMs) || Date.now() < settlementMs;\n    const warning = forceManual\n      ? \`MANUAL EARLY SETTLEMENT\\n\\nThis will freeze the current official Premier League scores, calculate ranks, issue the tournament prize/payout and release tournament card locks. It will only proceed if every eligible Premier League fixture is finished.\\n\\nSettle \"\${comp.name || \"this tournament\"}\" now?\`\n      : \`Settle \"\${comp.name || \"this tournament\"}\" using the final score at \${settlementLabel(settlement)}?\`;\n    if (!window.confirm(warning)) return;\n    settleMutation.mutate({ competitionId: Number(comp.id), forceManual });\n  };`;
  source = replaceOnce(source, requestFrom, requestTo, "manual settlement confirmation");

  const guardedReady = 'const readyToSettle = !isCancelled && !isCompleted && ["active", "closed"].includes(status) && Number.isFinite(settlementMs) && Date.now() >= settlementMs;';
  const simpleReady = 'const readyToSettle = ["active", "closed"].includes(status) && Number.isFinite(settlementMs) && Date.now() >= settlementMs;';
  const guardedCanSettle = 'const canSettle = !isCancelled && !isCompleted && ["active", "closed"].includes(status); const earlyManualSettle = canSettle && (!Number.isFinite(settlementMs) || Date.now() < settlementMs);';
  const simpleCanSettle = 'const canSettle = ["active", "closed"].includes(status); const earlyManualSettle = canSettle && (!Number.isFinite(settlementMs) || Date.now() < settlementMs);';
  source = replaceOneOf(
    source,
    [guardedReady, simpleReady],
    source.includes("const isCancelled =") ? guardedCanSettle : simpleCanSettle,
    "const canSettle =",
    "manual settle availability",
  );
  source = replaceOnce(
    source,
    '{readyToSettle ? <Button size="sm" disabled={settling} onClick={() => onSettle(comp)} className="mt-3 w-full bg-emerald-300 font-black text-slate-950 hover:bg-emerald-200"><CheckCircle2 className="mr-2 h-4 w-4" />{settling ? "Settling..." : "Settle Tuesday Results"}</Button> : null}',
    '{canSettle ? <Button size="sm" disabled={settling} onClick={() => onSettle(comp)} className={`mt-3 w-full font-black text-slate-950 ${earlyManualSettle ? "bg-amber-300 hover:bg-amber-200" : "bg-emerald-300 hover:bg-emerald-200"}`}><CheckCircle2 className="mr-2 h-4 w-4" />{settling ? "Settling..." : earlyManualSettle ? "Manual Settle Now" : "Settle Tournament"}</Button> : null}',
    "manual settle tournament button",
  );
  return source;
});

console.log("[manual-settlement] Safe manual settlement controls are ready.");
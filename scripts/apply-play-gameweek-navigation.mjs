import fs from "node:fs";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`[play-gameweek-navigation] patched ${file}`);
  } else {
    console.log(`[play-gameweek-navigation] ${file} already patched`);
  }
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[play-gameweek-navigation] anchor not found: ${label}`);
  return source.replace(from, to);
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[play-gameweek-navigation] anchor not found: ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

patchFile("client/src/pages/competitions-vault.tsx", (original) => {
  let source = original;

  if (!source.includes('const [tournamentView, setTournamentView] = useState<"live" | "completed">("live")')) {
    source = replaceOnce(
      source,
      '  const [gameweekFilter, setGameweekFilter] = useState<number | "current">("current");',
      '  const [gameweekFilter, setGameweekFilter] = useState<number | "current">("current");\n  const [tournamentView, setTournamentView] = useState<"live" | "completed">("live");',
      "tournament view state",
    );
  }

  if (!source.includes("PLAY_SETTLEMENT_CURRENT_GW_V1")) {
    const currentStart = source.indexOf("  const currentGw = useMemo(() => {");
    const selectedTierStart = source.indexOf("  const selectedTier = tier(selected?.tier);", currentStart);
    if (currentStart < 0 || selectedTierStart <= currentStart) {
      throw new Error("[play-gameweek-navigation] could not isolate current gameweek section");
    }

    const replacement = `  // PLAY_SETTLEMENT_CURRENT_GW_V1\n  // The Play page advances as soon as the previous tournament settlement window has passed.\n  // Keep the Prize Vault/FPL gameweek as a fallback, but never let a stale GW1 status pin Play to GW1.\n  const currentGw = useMemo(() => {\n    const now = Date.now();\n    const futureSettlementWeeks = official\n      .map((c) => {\n        const gw = Number(c.gameWeek || c.game_week || 0);\n        const rawSettlement = c.settlementAt || c.settlement_at || c.endDate || c.end_date;\n        const settlementMs = new Date(String(rawSettlement || \"\")).getTime();\n        return { gw, settlementMs };\n      })\n      .filter((row) => row.gw > 0 && Number.isFinite(row.settlementMs) && row.settlementMs > now)\n      .map((row) => row.gw)\n      .sort((a, b) => a - b);\n    if (futureSettlementWeeks.length) return futureSettlementWeeks[0];\n\n    // Keep this marker compatible with the existing gameweek-isolation generator.\n    const vaultGameWeek = Number(prizeVault?.currentGameWeek || 0);\n    if (vaultGameWeek > 0) return vaultGameWeek;\n\n    const vaultWeeks = (Object.values(prizeVault?.summary || {}) as VaultSummary[])\n      .map((summary) => Number(summary?.currentGameWeek || 0))\n      .filter((gw) => Number.isInteger(gw) && gw > 0);\n    if (vaultWeeks.length) return Math.max(...vaultWeeks);\n\n    const fallback = official\n      .filter((c) => [\"open\", \"active\", \"upcoming\"].includes(String(c.status || \"\").toLowerCase()))\n      .map((c) => Number(c.gameWeek || c.game_week || 0))\n      .filter(Boolean)\n      .sort((a, b) => a - b);\n    return fallback[0] || 1;\n  }, [official, prizeVault]);\n\n  const latestCompletedGw = useMemo(() => {\n    const completedWeeks = completedOfficial\n      .map((c) => Number(c.gameWeek || c.game_week || 0))\n      .filter(Boolean)\n      .sort((a, b) => b - a);\n    return completedWeeks[0] || 0;\n  }, [completedOfficial]);\n  const tournamentPool = tournamentView === \"completed\" ? completedOfficial : official;\n  const gameweeks = [...new Set<number>(tournamentPool.map((c) => Number(c.gameWeek || c.game_week || 0)).filter(Boolean))].sort((a, b) => a - b);\n  const shownGw = gameweekFilter === \"current\"\n    ? tournamentView === \"completed\"\n      ? latestCompletedGw || currentGw\n      : currentGw\n    : gameweekFilter;\n  const visible = tournamentPool.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === activeRarity);\n`;
    source = source.slice(0, currentStart) + replacement + source.slice(selectedTierStart);
  }

  const sectionAnchor = '        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">\n';
  const tabs = `          {/* PLAY_CURRENT_GAMEWEEK_TABS_V1 */}\n          <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-black/30 p-1">\n            <button type="button" onClick={() => { setTournamentView("live"); setGameweekFilter("current"); }} className={\`rounded-lg px-4 py-2 text-xs font-black transition \${tournamentView === "live" ? "bg-purple-500 text-white shadow-lg" : "text-white/55 hover:text-white"}\`}>Live & Upcoming</button>\n            <button type="button" onClick={() => { setTournamentView("completed"); setGameweekFilter("current"); }} className={\`rounded-lg px-4 py-2 text-xs font-black transition \${tournamentView === "completed" ? "bg-purple-500 text-white shadow-lg" : "text-white/55 hover:text-white"}\`}>Completed <span className="ml-1 text-[10px] opacity-70">({completedOfficial.length})</span></button>\n          </div>\n`;
  source = insertAfter(source, sectionAnchor, tabs, "PLAY_CURRENT_GAMEWEEK_TABS_V1", "Play tournament tabs");

  if (!source.includes('const count = tournamentPool.filter')) {
    source = replaceOnce(
      source,
      '              const count = official.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === rarity).length;\n              const vaultEntries = Number(prizeVault?.summary?.[rarity]?.currentGameWeek) === Number(shownGw) ? Number(prizeVault?.summary?.[rarity]?.currentEntries || 0) : 0;',
      '              const count = tournamentPool.filter((c) => Number(c.gameWeek || c.game_week) === Number(shownGw) && tier(c.tier) === rarity).length;\n              const vaultEntries = tournamentView === "live" && Number(prizeVault?.summary?.[rarity]?.currentGameWeek) === Number(shownGw) ? Number(prizeVault?.summary?.[rarity]?.currentEntries || 0) : 0;',
      "rarity counts by selected tab",
    );
  }

  if (!source.includes('{tournamentView === "live" ? <button onClick={() => setCreateOpen(true)}')) {
    source = replaceOnce(
      source,
      '            <button onClick={() => setCreateOpen(true)} className="min-h-[100px] min-w-0 rounded-2xl border border-purple-300/25 bg-black/25 px-4 py-3 text-left transition hover:border-purple-300/50 hover:bg-purple-500/10"><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.18em] text-purple-300"><Plus className="h-3.5 w-3.5" />Create</div><div className="mt-1 break-words font-black text-white">Private tournament</div></button>',
      '            {tournamentView === "live" ? <button onClick={() => setCreateOpen(true)} className="min-h-[100px] min-w-0 rounded-2xl border border-purple-300/25 bg-black/25 px-4 py-3 text-left transition hover:border-purple-300/50 hover:bg-purple-500/10"><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.18em] text-purple-300"><Plus className="h-3.5 w-3.5" />Create</div><div className="mt-1 break-words font-black text-white">Private tournament</div></button> : null}',
      "hide create tournament in completed tab",
    );
  }

  if (!source.includes('Latest completed (GW${latestCompletedGw || currentGw})')) {
    source = replaceOnce(
      source,
      '<option value="current">Current gameweek (GW{currentGw})</option>{gameweeks.map((gw) => <option key={gw} value={gw}>GW{gw}</option>)}',
      '<option value="current">{tournamentView === "completed" ? `Latest completed (GW${latestCompletedGw || currentGw})` : `Current gameweek (GW${currentGw})`}</option>{gameweeks.map((gw) => <option key={gw} value={gw}>GW{gw}</option>)}',
      "gameweek filter label",
    );
  }

  const pinBlock = '<div className="mt-4 grid gap-2 rounded-2xl border border-purple-300/20 bg-purple-500/10 p-3 sm:grid-cols-[1fr_auto]"><div className="relative"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-200/60" /><Input value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") findPinMutation.mutate(); }} placeholder="Enter private tournament PIN" className="h-11 border-white/10 bg-black/35 pl-10 uppercase text-white" /></div><Button onClick={() => findPinMutation.mutate()} disabled={findPinMutation.isPending} className="bg-purple-500 font-black hover:bg-purple-400">{findPinMutation.isPending ? "Finding…" : "Find tournament"}</Button></div>';
  if (!source.includes(`{tournamentView === "live" ? ${pinBlock} : null}`)) {
    source = replaceOnce(source, pinBlock, `{tournamentView === "live" ? ${pinBlock} : null}`, "hide private PIN in completed tab");
  }

  if (!source.includes('tournamentView === "live" && pinTournament')) {
    source = replaceOnce(
      source,
      '        {pinTournament ? <section><TournamentCard comp={pinTournament} entryCount={entryCounts.get(Number(pinTournament.id)) || 0} onEnter={() => openTournament(pinTournament)} /></section> : null}',
      '        {tournamentView === "live" && pinTournament ? <section><TournamentCard comp={pinTournament} entryCount={entryCounts.get(Number(pinTournament.id)) || 0} onEnter={() => openTournament(pinTournament)} /></section> : null}',
      "private tournament visibility",
    );
  }

  if (!source.includes('vault={tournamentView === "live" ? sharedSummaryFor(comp) : undefined}')) {
    source = replaceOnce(
      source,
      '        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{isLoading ? <Card className="col-span-full border-white/10 bg-white/5 p-8 text-center text-white/50">Loading tournaments…</Card> : visible.length ? visible.map((comp) => <TournamentCard key={comp.id} comp={comp} vault={sharedSummaryFor(comp)} entryCount={entryCounts.get(Number(comp.id)) || 0} onEnter={() => openTournament(comp)} />) : <Card className="col-span-full border-white/10 bg-white/5 p-8 text-center text-white/50">No {activeRarity} tournament found for GW{shownGw}.</Card>}</section>',
      '        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{isLoading ? <Card className="col-span-full border-white/10 bg-white/5 p-8 text-center text-white/50">Loading tournaments…</Card> : visible.length ? visible.map((comp) => <TournamentCard key={comp.id} comp={comp} vault={tournamentView === "live" ? sharedSummaryFor(comp) : undefined} entryCount={entryCounts.get(Number(comp.id)) || 0} onEnter={() => tournamentView === "completed" ? toast({ title: "Tournament completed", description: "This tournament is kept for records and can no longer be entered." }) : openTournament(comp)} />) : <Card className="col-span-full border border-white/10 bg-white/5 p-8 text-center text-white/50">No {activeRarity} {tournamentView === "completed" ? "completed tournament" : "tournament"} found for GW{shownGw}.</Card>}</section>',
      "tab-aware tournament cards",
    );
  }

  const completedStartToken = '        {completedOfficial.length ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">Completed Tournaments</h2>';
  const completedStart = source.indexOf(completedStartToken);
  if (completedStart >= 0) {
    const privateSectionStart = source.indexOf('        <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">My Private Tournaments</h2>', completedStart);
    if (privateSectionStart < 0) throw new Error("[play-gameweek-navigation] completed section end not found");
    source = source.slice(0, completedStart) + source.slice(privateSectionStart);
  }

  if (!source.includes('{tournamentView === "live" ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">My Private Tournaments</h2>')) {
    source = replaceOnce(
      source,
      '        <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">My Private Tournaments</h2><TournamentCreatorHub /></section>',
      '        {tournamentView === "live" ? <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 text-xl font-black">My Private Tournaments</h2><TournamentCreatorHub /></section> : null}',
      "hide private tournaments in completed tab",
    );
  }

  return source;
});

patchFile("client/src/pages/landing.tsx", (original) => {
  if (original.includes('data-auth-copy="login-signup"')) return original;
  for (const from of [
    '<a href={loginHref}><Button data-testid="button-login">Start Free</Button></a>',
    '<a href={loginHref}><Button data-testid="button-login">Enter Free</Button></a>',
  ]) {
    if (original.includes(from)) {
      return original.replace(from, '<a href={loginHref}><Button data-testid="button-login" data-auth-copy="login-signup">Login / Sign Up</Button></a>');
    }
  }
  throw new Error("[play-gameweek-navigation] anchor not found: landing login CTA");
});

console.log("[play-gameweek-navigation] settlement-driven gameweek, completed tab, and Login / Sign Up CTA are ready.");

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const write = (rel, source) => fs.writeFileSync(path.join(root, rel), source);

function replaceOnce(source, from, to, label, marker = to) {
  if (source.includes(marker)) return source;
  if (!source.includes(from)) throw new Error(`Gameweek isolation patch anchor not found: ${label}`);
  return source.replace(from, to);
}

function replaceSection(source, startToken, endToken, replacement, label, marker) {
  if (marker && source.includes(marker)) return source;
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Gameweek isolation section start not found: ${label}`);
  const end = source.indexOf(endToken, start);
  if (end < 0) throw new Error(`Gameweek isolation section end not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// 1) Prize Vault is funded ONLY by official Prize Ladder tournaments.
{
  const rel = "server/routes/prizeVault.routes.ts";
  let source = read(rel);
  source = replaceOnce(
    source,
    'import { db } from "../db.js";',
    'import { db } from "../db.js";\nimport { fplApi } from "../services/fplApi.js";',
    "Prize Vault FPL gameweek import",
    'import { fplApi } from "../services/fplApi.js";',
  );
  source = replaceOnce(
    source,
    `        where lower(c.status::text) in ('open', 'active')
          and c.name not like '[TEST]%'
        order by c.game_week asc, c.id asc`,
    `        where lower(c.status::text) in ('open', 'active', 'upcoming')
          and c.name not like '[TEST]%'
          and (
            lower(coalesce(c.prize_key, '')) = 'ladder'
            or (
              coalesce(c.prize_key, '') = ''
              and coalesce(c.entry_fee, 0) > 0
              and lower(coalesce(c.prize_type, 'goods')) <> 'cash_pool'
            )
          )
        order by c.game_week asc, c.id asc`,
    "Prize Vault qualifying competition filter",
    "lower(coalesce(c.prize_key, '')) = 'ladder'",
  );
  source = replaceOnce(
    source,
    `      // Competitions defines the current gameweek as the earliest open/active
      // gameweek. Prize Vault must use the same definition. Selecting the latest
      // open gameweek caused future zero-entry tournaments to hide live entries.
      const currentGameWeek = activeRows.length
        ? Math.min(...activeRows.map((row) => Number(row.gameWeek)))
        : 0;`,
    `      // GAMEWEEK_ISOLATION_V1: FPL is the clock. A stale/open tournament from
      // the previous gameweek must never carry Prize Vault progress into the next.
      const officialGameWeek = Number(await fplApi.getCurrentGameweek().catch(() => 0));
      const currentGameWeek = officialGameWeek > 0
        ? officialGameWeek
        : activeRows.length
          ? Math.min(...activeRows.map((row) => Number(row.gameWeek)))
          : 0;`,
    "Prize Vault FPL-controlled current gameweek",
    "GAMEWEEK_ISOLATION_V1",
  );
  write(rel, source);
}

// 2) Tournament Arena: free card cups are a separate product, never a Prize Vault card.
{
  const rel = "client/src/pages/competitions-vault.tsx";
  let source = read(rel);
  source = replaceOnce(
    source,
    'type VaultPayload = { summary?: Record<string, VaultSummary> };',
    'type VaultPayload = { currentGameWeek?: number; summary?: Record<string, VaultSummary> };',
    "Vault payload current gameweek",
  );
  const helperAnchor = 'const isPublicArenaTournament = (comp: Tournament) => String(comp.visibility || "public").toLowerCase() !== "private";';
  const helpers = `${helperAnchor}
const competitionPrizeKey = (comp: Tournament) => String(comp?.prizeKey ?? comp?.prize_key ?? "").toLowerCase();
const competitionPrizeType = (comp: Tournament) => String(comp?.prizeType ?? comp?.prize_type ?? "").toLowerCase();
const competitionEntryFee = (comp: Tournament) => Number(comp?.entryFee ?? comp?.entry_fee ?? 0);
const competitionPrizeCardRarity = (comp: Tournament) => String(comp?.prizeCardRarity ?? comp?.prize_card_rarity ?? "").toLowerCase();
const isFreeCardCup = (comp: Tournament) => competitionEntryFee(comp) <= 0 && (competitionPrizeKey(comp).startsWith("free-") || competitionPrizeType(comp) === "card" || Boolean(competitionPrizeCardRarity(comp)));
const isCreatorCashTournament = (comp: Tournament) => competitionPrizeType(comp) === "cash_pool" || competitionPrizeKey(comp) === "user-cash";
const isPrizeVaultTournament = (comp: Tournament) => {
  if (isFreeCardCup(comp) || isCreatorCashTournament(comp)) return false;
  const key = competitionPrizeKey(comp);
  return key === "ladder" || (competitionEntryFee(comp) > 0 && !key);
};`;
  source = replaceOnce(source, helperAnchor, helpers, "Tournament type helpers", "const isPrizeVaultTournament =");

  source = replaceOnce(
    source,
    `  const currentGw = useMemo(() => {
    const live = official.filter((c) => ["open", "active"].includes(String(c.status))).map((c) => Number(c.gameWeek || c.game_week || 0)).filter(Boolean).sort((a, b) => a - b);
    if (live.length) return live[0];`,
    `  const currentGw = useMemo(() => {
    const vaultGameWeek = Number(prizeVault?.currentGameWeek || 0);
    if (vaultGameWeek > 0) return vaultGameWeek;
    const live = official.filter((c) => ["open", "active"].includes(String(c.status))).map((c) => Number(c.gameWeek || c.game_week || 0)).filter(Boolean).sort((a, b) => a - b);
    if (live.length) return live[0];`,
    "Tournament current gameweek follows FPL/Prize Vault",
    "const vaultGameWeek = Number(prizeVault?.currentGameWeek || 0);",
  );
  source = source.replace('  }, [official]);', '  }, [official, prizeVault?.currentGameWeek]);');

  source = replaceOnce(
    source,
    `  const sharedSummaryFor = (comp: Tournament): VaultSummary | undefined => {
    if (!isPublicArenaTournament(comp)) return undefined;`,
    `  const sharedSummaryFor = (comp: Tournament): VaultSummary | undefined => {
    if (!isPublicArenaTournament(comp) || !isPrizeVaultTournament(comp)) return undefined;`,
    "Free/cash competitions cannot receive Vault summary",
    "!isPrizeVaultTournament(comp)",
  );

  const tournamentCard = `function TournamentCard({ comp, vault, entryCount, onEnter }: { comp: Tournament; vault?: VaultSummary; entryCount: number; onEnter: () => void }) {
  // GAMEWEEK_ISOLATED_TOURNAMENT_CARD
  const r = tier(comp.tier);
  const t = rarityTheme[r];
  const requirement = getTournamentRarityRequirement(r);
  const tournamentEntries = Number(comp.entryCount ?? comp.entry_count ?? 0);
  const freeCardCup = isFreeCardCup(comp);
  const cashTournament = isCreatorCashTournament(comp);
  const vaultTournament = isPrizeVaultTournament(comp);
  const sharedEntries = vaultTournament ? Number(vault?.currentEntries ?? tournamentEntries) : 0;
  const target = vaultTournament ? Number(vault?.targetEntries ?? comp.requiredEntrants ?? 0) : 0;
  const vaultProgress = vaultTournament ? percentage(sharedEntries, target) : 0;
  const maxEntries = Number(comp.maxEntries || comp.max_entries || 0);
  const capacityProgress = maxEntries ? percentage(tournamentEntries, maxEntries) : 0;
  const status = comp.entryOpen === false ? "Locked" : String(comp.status || "open");
  const canEnter = comp.entryOpen !== false && comp.status === "open";
  const submissionClosesAt = comp.submissionClosesAt || comp.submission_closes_at;
  const settlementAt = comp.settlementAt || comp.settlement_at || comp.endDate || comp.end_date;
  const entryLockLabel = submissionClosesAt ? dateLabel(submissionClosesAt) : "First PL kickoff";
  const rewardRarity = competitionPrizeCardRarity(comp) || r;
  const rewardLabel = rewardRarity.charAt(0).toUpperCase() + rewardRarity.slice(1);
  const prizeTitle = vault?.activePrize?.title || vault?.nextPrize?.title || comp.prizeDescription || comp.prize_description || "Prize ladder";
  const cashPool = Number(comp.prizePoolTotal ?? comp.prize_pool_total ?? 0);

  return <Card className={\`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br \${t.gradient} p-5 text-white\`} style={{ borderColor: \`${t.accent}55\`, boxShadow: \`0 0 35px \${t.glow},0 24px 60px rgba(0,0,0,.45)\` }}><div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.12)_18%,transparent_38%)]" /><div className="relative"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color: t.accent }}>{freeCardCup ? "FREE CARD CUP" : cashTournament ? "CASH TOURNAMENT" : \`${r} PRIZE VAULT TOURNAMENT\`}</div><h2 className="mt-2 text-2xl font-black">{comp.name}</h2></div><Badge className="capitalize" style={{ background: \`${t.accent}22\`, color: t.accent }}>{status}</Badge></div><div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase tracking-[.15em] text-white/40">Cards required</div><div className="mt-1 text-sm font-black" style={{ color: t.accent }}>{requirement.shortLabel}</div></div>

  {freeCardCup ? <><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Entry" value="FREE" /><Metric label="Tournament entries" value={maxEntries ? \`${tournamentEntries}/\${maxEntries}\` : String(tournamentEntries)} /><Metric label="My submitted teams" value={String(entryCount)} /><Metric label="Winner card" value={\`${rewardLabel} Player Card\`} /><Metric label="Entry lock" value={entryLockLabel} /><Metric label="Settlement" value={dateLabel(settlementAt)} /></div><div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-[11px] leading-5 text-emerald-100"><b>Separate from the Prize Vault.</b> Entries in this FREE Card Cup do not fund, unlock or advance the {r} rarity Prize Ladder. The winner receives the stated player-card prize.</div>{maxEntries ? <div className="mt-4"><div className="flex justify-between text-xs text-white/55"><span>Free Cup entries</span><b>{capacityProgress}%</b></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: \`${capacityProgress}%\`, background: t.accent, boxShadow: \`0 0 18px \${t.glow}\` }} /></div></div> : null}<Button onClick={onEnter} disabled={!canEnter} className="mt-4 w-full font-black" style={{ background: canEnter ? t.accent : "#334155", color: r === "legendary" && canEnter ? "#111827" : "white" }}>{!canEnter ? <><Lock className="mr-2 h-4 w-4" />Closed</> : entryCount > 0 ? "Enter another FREE team" : "Enter FREE"}</Button></> : cashTournament ? <><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Entry" value={money(comp.entryFee ?? comp.entry_fee)} /><Metric label="Tournament entries" value={maxEntries ? \`${tournamentEntries}/\${maxEntries}\` : String(tournamentEntries)} /><Metric label="My submitted teams" value={String(entryCount)} /><Metric label="Cash prize pool" value={money(cashPool)} /><Metric label="Entry lock" value={entryLockLabel} /><Metric label="Settlement" value={dateLabel(settlementAt)} /></div><div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-[11px] leading-5 text-cyan-100"><b>Cash tournament.</b> This tournament is separate from the Prize Vault and does not advance any rarity ladder.</div><Button onClick={onEnter} disabled={!canEnter} className="mt-4 w-full font-black" style={{ background: canEnter ? t.accent : "#334155", color: r === "legendary" && canEnter ? "#111827" : "white" }}>{!canEnter ? <><Lock className="mr-2 h-4 w-4" />Closed</> : entryCount > 0 ? "Enter another team" : "Enter"}</Button></> : <><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Entry" value={money(comp.entryFee ?? comp.entry_fee)} /><Metric label="Tournament entries" value={maxEntries ? \`${tournamentEntries}/\${maxEntries}\` : String(tournamentEntries)} /><Metric label="My submitted teams" value={String(entryCount)} /><Metric label="Shared vault entries" value={\`${sharedEntries}/\${target || 0}\`} /><Metric label="Current prize" value={prizeTitle} /><Metric label="Entry lock" value={entryLockLabel} /><Metric label="Settlement" value={dateLabel(settlementAt)} /></div><div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/10 p-3 text-[11px] leading-5 text-amber-100">Only Premier League points recorded for this gameweek before Tuesday settlement count. FA Cup matches and Premier League fixtures played after settlement are excluded.</div><div className="mt-4"><div className="flex justify-between text-xs text-white/55"><span>Shared {r} Prize Vault progress</span><b>{vaultProgress}%</b></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: \`${vaultProgress}%\`, background: t.accent, boxShadow: \`0 0 18px \${t.glow}\` }} /></div><div className="mt-4 flex gap-2"><Link href={\`/prize-vault?rarity=\${r}\`} className="flex-1"><Button variant="outline" className="w-full border-white/15 bg-black/20 text-white"><Gift className="mr-2 h-4 w-4" />Prize ladder</Button></Link><Button onClick={onEnter} disabled={!canEnter} className="flex-1 font-black" style={{ background: canEnter ? t.accent : "#334155", color: r === "legendary" && canEnter ? "#111827" : "white" }}>{!canEnter ? <><Lock className="mr-2 h-4 w-4" />Closed</> : entryCount > 0 ? "Enter another team" : "Enter"}</Button></div></div></>}</div></Card>;
}

`;
  source = replaceSection(source, "function TournamentCard(", "function Stat(", tournamentCard, "Tournament card product separation", "GAMEWEEK_ISOLATED_TOURNAMENT_CARD");
  write(rel, source);
}

// 3) FPL current gameweek resolution must roll forward instead of falling back to GW1.
{
  const rel = "server/services/fplApi.ts";
  let source = read(rel);
  source = replaceOnce(
    source,
    '  async getCurrentGameweek() { const b = await this.bootstrap(); const current = b.events?.find((e: any) => e.is_current); return current?.id || 1; },',
    '  async getCurrentGameweek() { const b = await this.bootstrap(); const events = Array.isArray(b?.events) ? b.events : []; const current = events.find((e: any) => e?.is_current) || events.find((e: any) => e?.is_next) || [...events].reverse().find((e: any) => e?.finished); return Math.max(1, Number(current?.id || 1)); },',
    "FPL current/next gameweek resolution",
    "events.find((e: any) => e?.is_next)",
  );
  write(rel, source);
}

// 4) All enriched card payloads expose current-gameweek Fantasy Arena points.
{
  const rel = "server/services/playerCardEnrichment.ts";
  let source = read(rel);
  source = replaceOnce(
    source,
    'import { buildFplPlayerIndex, overallFromFplElement } from "./fplPlayerIdentity.js";',
    'import { buildFplPlayerIndex, overallFromFplElement } from "./fplPlayerIdentity.js";\nimport { calculatePlayerScore, mapFplStatsToPlayerStats } from "./scoring.js";',
    "Card enrichment scoring import",
    'calculatePlayerScore, mapFplStatsToPlayerStats',
  );
  source = replaceOnce(
    source,
    `  const [bootstrap, apiFootballDirectory] = await Promise.all([
    fplApi.bootstrap().catch(() => null),
    loadApiFootballPlayerDirectory().catch(() => []),
  ]);`,
    `  const [bootstrap, liveData, apiFootballDirectory] = await Promise.all([
    fplApi.bootstrap().catch(() => null),
    fplApi.getLiveGameweek().catch(() => null),
    loadApiFootballPlayerDirectory().catch(() => []),
  ]);`,
    "Card enrichment live gameweek fetch",
    "const [bootstrap, liveData, apiFootballDirectory]",
  );
  source = replaceOnce(
    source,
    '  const fplIndex = buildFplPlayerIndex(bootstrap || {});',
    '  const fplIndex = buildFplPlayerIndex(bootstrap || {});\n  const liveByElementId = new Map<number, any>();\n  for (const element of Array.isArray((liveData as any)?.elements) ? (liveData as any).elements : []) liveByElementId.set(Number(element.id), element);',
    "Card enrichment live map",
    "const liveByElementId = new Map<number, any>();",
  );
  source = replaceOnce(
    source,
    '    const currentPosition = apiFootballPlayer?.position || canonical?.position || String(player.position || "MID");\n    const totalPoints = matchedElement ? Number(matchedElement.total_points || 0) : null;',
    '    const currentPosition = apiFootballPlayer?.position || canonical?.position || String(player.position || "MID");\n    const liveElement = matchedElement ? liveByElementId.get(Number(matchedElement.id)) : null;\n    const currentGameweekPoints = liveElement ? Number(calculatePlayerScore(mapFplStatsToPlayerStats(liveElement), currentPosition)?.total_score || 0) : 0;\n    const totalPoints = matchedElement ? Number(matchedElement.total_points || 0) : null;',
    "Current gameweek points calculation",
    "const currentGameweekPoints = liveElement",
  );
  source = replaceOnce(source, '      totalPoints,\n      // Historical match rows', '      totalPoints,\n      currentGameweekPoints,\n      // Historical match rows', "Card top-level current GW points", "      currentGameweekPoints,\n      // Historical");
  source = replaceOnce(source, '        totalPoints,\n        form,', '        totalPoints,\n        currentGameweekPoints,\n        form,', "Player current GW points", "        currentGameweekPoints,\n        form,");
  write(rel, source);
}

// 5) User Collection cards use the same current-GW score source.
{
  const rel = "server/routes/cards.routes.ts";
  let source = read(rel);
  source = replaceOnce(
    source,
    '        let last5Scores = Array.isArray(card.last5Scores) ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5) : [];',
    '        let currentGameweekPoints = 0;\n        let last5Scores = Array.isArray(card.last5Scores) ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5) : [];',
    "Collection current GW points variable",
    "let currentGameweekPoints = 0;",
  );
  source = replaceOnce(
    source,
    '          const latestLiveScore = Number(calculatedScore?.total_score || 0);',
    '          currentGameweekPoints = Number(calculatedScore?.total_score || 0);\n          const latestLiveScore = currentGameweekPoints;',
    "Collection current GW points assignment",
    "const latestLiveScore = currentGameweekPoints;",
  );
  source = replaceOnce(source, '          totalPoints,\n          last5Scores,', '          totalPoints,\n          currentGameweekPoints,\n          last5Scores,', "Collection card current GW payload", "          currentGameweekPoints,\n          last5Scores,");
  source = replaceOnce(source, '            totalPoints,\n            form,', '            totalPoints,\n            currentGameweekPoints,\n            form,', "Collection player current GW payload", "            currentGameweekPoints,\n            form,");
  write(rel, source);
}

// 6) Card PTS means this gameweek, never cumulative season points.
{
  const rel = "client/src/lib/fantasy-card-adapter.ts";
  let source = read(rel);
  source = replaceOnce(
    source,
    '    player?.totalPoints,\n    player?.total_points,\n    (card as any).totalPoints,',
    '    (card as any).currentGameweekPoints,\n    player?.currentGameweekPoints,\n    player?.totalPoints,\n    player?.total_points,\n    (card as any).totalPoints,',
    "PTS verification includes current gameweek",
    "(card as any).currentGameweekPoints,",
  );
  source = replaceOnce(
    source,
    '  const totalPoints = statsVerified\n    ? finiteNumber(player?.totalPoints, player?.total_points, (card as any).totalPoints)\n    : 0;',
    '  // PTS on Fantasy Arena cards is a gameweek score. Season totals remain available in player profiles.\n  const totalPoints = statsVerified\n    ? finiteNumber((card as any).currentGameweekPoints, player?.currentGameweekPoints)\n    : 0;',
    "Card PTS current gameweek only",
    "PTS on Fantasy Arena cards is a gameweek score",
  );
  write(rel, source);
}

// 7) Dashboard lineup score must also be current-GW only.
{
  const rel = "client/src/pages/dashboard.tsx";
  let source = read(rel);
  source = replaceOnce(
    source,
    '  const lineupScore = lineupCards.reduce((sum, card) => { const scores = Array.isArray(card.last5Scores) ? card.last5Scores as number[] : []; return sum + Number(scores[scores.length - 1] || 0); }, 0);',
    '  const lineupScore = lineupCards.reduce((sum, card) => sum + Number((card as any).currentGameweekPoints || 0), 0);',
    "Dashboard lineup current-GW score",
    "(card as any).currentGameweekPoints || 0",
  );
  write(rel, source);
}

// 8) Prize Vault should visibly roll over while left open across a gameweek boundary.
{
  const rel = "client/src/pages/prize-vault.tsx";
  let source = read(rel);
  source = replaceOnce(
    source,
    '      return response.json();\n    },\n  });',
    '      return response.json();\n    },\n    staleTime: 0,\n    refetchOnWindowFocus: true,\n    refetchInterval: 60_000,\n  });',
    "Prize Vault rollover refetch",
    "refetchInterval: 60_000",
  );
  write(rel, source);
}

console.log("[gameweek-isolation] Free cups separated from Prize Vault; current-GW points and rollover isolation applied.");

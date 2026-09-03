import fs from "node:fs";

const SERVER = "server/routes/prizeVault.routes.ts";
const VAULT_PAGE = "client/src/pages/prize-vault.tsx";
const TOURNAMENT_PAGE = "client/src/pages/competitions-vault.tsx";
const MARKER = "PRIZE_VAULT_EXACT_TOURNAMENT_LINK_V1";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function writeIfChanged(file, source, next) {
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`[prize-vault-link] patched ${file}`);
  } else {
    console.log(`[prize-vault-link] ${file} already patched`);
  }
}

function requireMatch(source, pattern, label) {
  if (!pattern.test(source)) throw new Error(`Prize Vault exact-link patch anchor not found: ${label}`);
}

function patchServer() {
  const source = read(SERVER);
  if (source.includes(MARKER)) {
    console.log(`[prize-vault-link] ${SERVER} already patched`);
    return;
  }

  let next = source;
  next = next.replace(
    'app.get("/api/prize-vault", async (_req, res) => {',
    'app.get("/api/prize-vault", async (req, res) => {',
  );
  if (!next.includes('app.get("/api/prize-vault", async (req, res) => {')) {
    throw new Error("Prize Vault exact-link patch anchor not found: request parameter");
  }

  const tryAnchor = '    try {\n      // Test/simulator competitions are never allowed to fund or unlock the live';
  if (!next.includes(tryAnchor)) throw new Error("Prize Vault exact-link patch anchor not found: route start");
  next = next.replace(
    tryAnchor,
    `    try {\n      // ${MARKER}\n      // A Prize Vault request may identify the exact paid ladder tournament. This\n      // prevents a lagging FPL is_current flag or a stale previous-GW status from\n      // making a real GW3 entry appear as zero in the Vault.\n      const requestedGameWeekRaw = Number.parseInt(String(req.query.gameWeek || ""), 10);\n      const requestedGameWeek = requestedGameWeekRaw >= 1 && requestedGameWeekRaw <= 38 ? requestedGameWeekRaw : 0;\n      const requestedCompetitionIdRaw = Number.parseInt(String(req.query.competitionId || ""), 10);\n      const requestedCompetitionId = requestedCompetitionIdRaw > 0 ? requestedCompetitionIdRaw : 0;\n\n      // Test/simulator competitions are never allowed to fund or unlock the live`,
  );

  const selectPattern = /          c\.id,\n          c\.game_week as "gameWeek",\n          c\.tier::text as rarity,\n          coalesce\(c\.entry_fee, 0\)::float as "entryFee",\n          c\.status::text as status,/;
  requireMatch(next, selectPattern, "competition select fields");
  next = next.replace(
    selectPattern,
    `          c.id,\n          c.name,\n          c.game_week as "gameWeek",\n          c.tier::text as rarity,\n          coalesce(c.entry_fee, 0)::float as "entryFee",\n          c.status::text as status,\n          c.start_date as "startDate",\n          c.end_date as "endDate",\n          ((c.start_date is null or c.start_date <= now()) and (c.end_date is null or c.end_date > now())) as "entryWindowOpen",`,
  );

  const wherePattern = /        where lower\(c\.status::text\) in \('open', 'active'(?:, 'upcoming')?\)[\s\S]*?        order by c\.game_week asc, c\.id asc/;
  requireMatch(next, wherePattern, "official Prize Ladder filter");
  next = next.replace(
    wherePattern,
    `        where c.created_by_user_id is null\n          and c.season = \${SEASON_KEY}\n          and coalesce(lower(nullif(trim(c.visibility), '')), 'public') = 'public'\n          and coalesce(c.entry_fee, 0) > 0\n          and lower(coalesce(nullif(trim(c.prize_type), ''), 'goods')) <> 'cash_pool'\n          and lower(coalesce(nullif(trim(c.prize_key), ''), 'ladder')) = 'ladder'\n          and lower(c.status::text) <> 'cancelled'\n          and c.name not like '[TEST]%'\n        order by c.game_week asc, c.id asc`,
  );

  const gameweekPattern = /      \/\/ GAMEWEEK_ISOLATION_V1:[\s\S]*?          : 0;/;
  requireMatch(next, gameweekPattern, "generated gameweek resolver");
  next = next.replace(
    gameweekPattern,
    `      // GAMEWEEK_ISOLATION_V1: keep FPL as a final fallback only. The paid\n      // tournament entry window is authoritative while entries are open.\n      const officialGameWeek = Number(await fplApi.getCurrentGameweek().catch(() => 0));\n      const requestedCompetition = requestedCompetitionId > 0\n        ? activeRows.find((row) => Number(row.id) === requestedCompetitionId)\n        : undefined;\n      const entryWindowGameWeeks = activeRows\n        .filter((row) => Boolean(row.entryWindowOpen) && !["completed", "cancelled"].includes(String(row.status || "").toLowerCase()))\n        .map((row) => Number(row.gameWeek || 0))\n        .filter((gameWeek) => Number.isFinite(gameWeek) && gameWeek > 0);\n      const statusGameWeeks = activeRows\n        .filter((row) => ["open", "active"].includes(String(row.status || "").toLowerCase()))\n        .map((row) => Number(row.gameWeek || 0))\n        .filter((gameWeek) => Number.isFinite(gameWeek) && gameWeek > 0);\n      const currentGameWeek = requestedCompetition\n        ? Number(requestedCompetition.gameWeek || 0)\n        : requestedGameWeek > 0\n          ? requestedGameWeek\n          : entryWindowGameWeeks.length\n            ? Math.max(...entryWindowGameWeeks)\n            : statusGameWeeks.length\n              ? Math.max(...statusGameWeeks)\n              : officialGameWeek > 0\n                ? officialGameWeek\n                : activeRows.length\n                  ? Math.max(...activeRows.map((row) => Number(row.gameWeek || 0)))\n                  : 0;`,
  );

  const mapStart = next.indexOf('      const activeByRarity = new Map<string, any>();');
  const mapEnd = next.indexOf('      const ladders: Record<string, any> = {};', mapStart);
  if (mapStart < 0 || mapEnd < 0) throw new Error("Prize Vault exact-link patch anchor not found: rarity map");
  const mapReplacement = `      const activeByRarity = new Map<string, any>();\n      for (const row of activeRows) {\n        const gameWeek = Number(row.gameWeek);\n        if (gameWeek !== currentGameWeek) continue;\n\n        const rarity = String(row.rarity || "common").toLowerCase();\n        const entryCount = Math.max(0, Number(row.entryCount || 0));\n        const candidate = { ...row, rarity, gameWeek: currentGameWeek, entryCount };\n        const previous = activeByRarity.get(rarity);\n        const requestedMatch = requestedCompetitionId > 0 && Number(row.id) === requestedCompetitionId;\n        const previousRequestedMatch = requestedCompetitionId > 0 && Number(previous?.id || 0) === requestedCompetitionId;\n        const canonicalName = \`GW\${currentGameWeek} \${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Prize Ladder\`;\n        const canonical = String(row.name || "") === canonicalName;\n        const previousCanonical = String(previous?.name || "") === canonicalName;\n\n        // One rarity/gameweek must resolve to one official paid Prize Ladder row.\n        // An explicitly linked tournament wins; otherwise prefer the canonical\n        // official name, then the row carrying the larger real entry count.\n        if (!previous\n          || requestedMatch\n          || (!previousRequestedMatch && canonical && !previousCanonical)\n          || (!previousRequestedMatch && canonical === previousCanonical && entryCount > Number(previous.entryCount || 0))) {\n          activeByRarity.set(rarity, candidate);\n        }\n      }\n\n`;
  next = next.slice(0, mapStart) + mapReplacement + next.slice(mapEnd);

  next = next.replace(
    `          currentEntries,\n          entryFee: RARITY_ENTRY_FEES[rarity],`,
    `          currentEntries,\n          competitionId: Number(source?.id || 0),\n          competitionName: String(source?.name || ""),\n          entryFee: RARITY_ENTRY_FEES[rarity],`,
  );
  next = next.replace(
    `          currentGameWeek,\n          currentEntries,\n          targetEntries: progressTarget,`,
    `          currentGameWeek,\n          currentEntries,\n          competitionId: Number(source?.id || 0),\n          competitionName: String(source?.name || ""),\n          targetEntries: progressTarget,`,
  );

  writeIfChanged(SERVER, source, next);
}

function patchVaultPage() {
  const source = read(VAULT_PAGE);
  if (source.includes("PRIZE_VAULT_QUERY_LINK_V1")) {
    console.log(`[prize-vault-link] ${VAULT_PAGE} already patched`);
    return;
  }
  let next = source;

  next = next.replace(
    'type VaultSummary = {\n  currentEntries: number;',
    'type VaultSummary = {\n  currentGameWeek?: number;\n  competitionId?: number;\n  competitionName?: string;\n  currentEntries: number;',
  );
  next = next.replace(
    'type VaultPayload = {\n  items: VaultItem[];',
    'type VaultPayload = {\n  currentGameWeek?: number;\n  items: VaultItem[];',
  );

  const componentAnchor = 'export default function PrizeVaultPage() {\n';
  if (!next.includes(componentAnchor)) throw new Error("Prize Vault exact-link patch anchor not found: vault component");
  next = next.replace(
    componentAnchor,
    `${componentAnchor}  // PRIZE_VAULT_QUERY_LINK_V1\n  const vaultQuery = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();\n  const requestedGameWeekRaw = Number.parseInt(vaultQuery.get("gameWeek") || "", 10);\n  const requestedGameWeek = requestedGameWeekRaw >= 1 && requestedGameWeekRaw <= 38 ? requestedGameWeekRaw : 0;\n  const requestedCompetitionIdRaw = Number.parseInt(vaultQuery.get("competitionId") || "", 10);\n  const requestedCompetitionId = requestedCompetitionIdRaw > 0 ? requestedCompetitionIdRaw : 0;\n`,
  );

  next = next.replace(
    '    queryKey: ["/api/prize-vault"],\n    queryFn: async () => {\n      const response = await fetch("/api/prize-vault", { credentials: "include" });',
    '    queryKey: ["/api/prize-vault", requestedGameWeek, requestedCompetitionId],\n    queryFn: async () => {\n      const params = new URLSearchParams();\n      if (requestedGameWeek > 0) params.set("gameWeek", String(requestedGameWeek));\n      if (requestedCompetitionId > 0) params.set("competitionId", String(requestedCompetitionId));\n      const suffix = params.toString() ? `?${params.toString()}` : "";\n      const response = await fetch(`/api/prize-vault${suffix}`, { credentials: "include" });',
  );

  const historyAnchor = '    if (typeof window !== "undefined") window.history.replaceState({}, "", `/prize-vault?rarity=${key}`);';
  if (!next.includes(historyAnchor)) throw new Error("Prize Vault exact-link patch anchor not found: rarity history");
  next = next.replace(
    historyAnchor,
    '    if (typeof window !== "undefined") {\n      const params = new URLSearchParams();\n      params.set("rarity", key);\n      const resolvedGameWeek = Number(data?.currentGameWeek || requestedGameWeek || 0);\n      if (resolvedGameWeek > 0) params.set("gameWeek", String(resolvedGameWeek));\n      if (requestedCompetitionId > 0) params.set("competitionId", String(requestedCompetitionId));\n      window.history.replaceState({}, "", `/prize-vault?${params.toString()}`);\n    }',
  );

  next = next.replace(
    '<div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/70">Fantasy Arena 2026/27</div>',
    '<div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/70">Fantasy Arena 2026/27 • GW{Number(data?.currentGameWeek || requestedGameWeek || 0) || "—"}</div>',
  );

  writeIfChanged(VAULT_PAGE, source, next);
}

function patchTournamentPage() {
  const source = read(TOURNAMENT_PAGE);
  if (source.includes("PRIZE_VAULT_EXACT_LINK_FROM_TOURNAMENT_V1") && source.includes("PRIZE_VAULT_TOURNAMENT_ENTRY_MIRROR_V2")) {
    console.log(`[prize-vault-link] ${TOURNAMENT_PAGE} already patched`);
    return;
  }
  let next = source;

  const topLink = 'href={`/prize-vault?rarity=${activeRarity}`}';
  const patchedTopLink = 'href={`/prize-vault?rarity=${activeRarity}&gameWeek=${shownGw}`}';
  if (!next.includes(patchedTopLink)) {
    if (!next.includes(topLink)) throw new Error("Prize Vault exact-link patch anchor not found: tournament header link");
    next = next.replace(topLink, patchedTopLink);
  }

  const cardLink = 'href={`/prize-vault?rarity=${r}`}';
  const patchedCardLink = 'href={`/prize-vault?rarity=${r}&gameWeek=${Number(comp.gameWeek || comp.game_week || 0)}&competitionId=${Number(comp.id || 0)}`}';
  if (!next.includes(patchedCardLink)) {
    if (!next.includes(cardLink)) throw new Error("Prize Vault exact-link patch anchor not found: tournament card link");
    next = next.replace(cardLink, patchedCardLink);
  }

  const sharedEntriesOld = '  const sharedEntries = vaultTournament ? Number(vault?.currentEntries ?? tournamentEntries) : 0;';
  const sharedEntriesNew = '  // PRIZE_VAULT_TOURNAMENT_ENTRY_MIRROR_V2: every entry in an official paid Prize Ladder tournament is a qualifying Vault entry.\n  const sharedEntries = vaultTournament ? tournamentEntries : 0;';
  if (!next.includes("PRIZE_VAULT_TOURNAMENT_ENTRY_MIRROR_V2")) {
    if (!next.includes(sharedEntriesOld)) throw new Error("Prize Vault exact-link patch anchor not found: tournament qualifying entry count");
    next = next.replace(sharedEntriesOld, sharedEntriesNew);
  }

  const markerAnchor = 'function TournamentCard({ comp, vault, entryCount, onEnter }:';
  if (!next.includes("PRIZE_VAULT_EXACT_LINK_FROM_TOURNAMENT_V1")) {
    if (!next.includes(markerAnchor)) throw new Error("Prize Vault exact-link patch anchor not found: tournament card marker");
    next = next.replace(markerAnchor, `// PRIZE_VAULT_EXACT_LINK_FROM_TOURNAMENT_V1\n${markerAnchor}`);
  }

  writeIfChanged(TOURNAMENT_PAGE, source, next);
}

patchServer();
patchVaultPage();
patchTournamentPage();
console.log("Prize Vault exact tournament linking is ready: tournament ID/gameweek and Vault entry totals now share one source on both the Vault and tournament ladder card.");

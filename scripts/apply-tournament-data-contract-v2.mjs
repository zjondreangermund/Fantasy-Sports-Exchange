import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, source) => fs.writeFileSync(file, source);

function patchFile(file, transform) {
  const source = read(file);
  const next = transform(source);
  if (next !== source) write(file, next);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Tournament data-contract patch anchor not found: ${label}`);
  return source.replace(from, to);
}

function insertBefore(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`Tournament data-contract patch anchor not found: ${label}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`Tournament data-contract patch anchor not found: ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function replaceSection(source, startToken, endToken, replacement, marker, label) {
  if (source.includes(marker)) return source;
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Tournament data-contract section start not found: ${label}`);
  const end = source.indexOf(endToken, start);
  if (end < 0) throw new Error(`Tournament data-contract section end not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// 1) Keep public tournament totals and private current-user entries as two
// different values. The previous total-entry display repair accidentally fed the
// public total into the "My submitted teams" prop for every account.
patchFile("client/src/pages/competitions-vault.tsx", (original) => {
  let source = original;

  const toastImport = 'import { useToast } from "../hooks/use-toast";';
  source = insertAfter(source, toastImport, '\nimport { useAuth } from "../hooks/use-auth";', 'from "../hooks/use-auth"', "auth hook import");

  source = insertAfter(
    source,
    '  const { toast } = useToast();',
    '\n  const { user } = useAuth();',
    'const { user } = useAuth();',
    "authenticated user for entry cache",
  );

  const oldEntryQuery = `  const { data: entries = [] } = useQuery<CompetitionEntry[]>({\n    queryKey: ["/api/competitions/my-entries"],\n    queryFn: async () => {`;
  const userScopedEntryQuery = `  const { data: entries = [] } = useQuery<CompetitionEntry[]>({\n    queryKey: ["/api/competitions/my-entries", user?.id || "anonymous"],\n    enabled: Boolean(user?.id),\n    queryFn: async () => {`;
  source = replaceOnce(source, oldEntryQuery, userScopedEntryQuery, "user-scoped my entries query");

  const totalHelper = `\n// SITE_AUDIT_TOTAL_ENTRY_COUNT_V1\nconst tournamentEntryCount = (competition: Tournament | null | undefined) => Math.max(0, Number(competition?.entryCount ?? competition?.entry_count ?? 0) || 0);`;
  source = source.replace(totalHelper, "");

  if (!source.includes("USER_SCOPED_TOURNAMENT_ENTRY_COUNTS_V2")) {
    const unavailableAnchor = `  const unavailableCardIds = useMemo(() => {`;
    const userCounts = `  // USER_SCOPED_TOURNAMENT_ENTRY_COUNTS_V2\n  const entryCounts = useMemo(() => {\n    const counts = new Map<number, number>();\n    for (const entry of entries) {\n      const competitionId = entryCompetitionId(entry);\n      if (!competitionId) continue;\n      counts.set(competitionId, (counts.get(competitionId) || 0) + 1);\n    }\n    return counts;\n  }, [entries]);\n`;
    source = insertBefore(source, unavailableAnchor, userCounts, "USER_SCOPED_TOURNAMENT_ENTRY_COUNTS_V2", "restore current-user entry counts");
  }

  source = source.replaceAll('entryCount={tournamentEntryCount(pinTournament)}', 'entryCount={entryCounts.get(Number(pinTournament.id)) || 0}');
  source = source.replaceAll('entryCount={tournamentEntryCount(comp)}', 'entryCount={entryCounts.get(Number(comp.id)) || 0}');

  // Make the labels unambiguous: public totals are everyone; "My" is only the
  // authenticated user's own entries. Free Cups and paid Vault tournaments are
  // named explicitly so users never think they entered something they did not.
  source = source.replaceAll('label="Tournament entries"', 'label={freeCardCup ? "All FREE Cup entries" : vaultTournament ? "All paid tournament entries" : "All tournament entries"}');
  source = source.replaceAll('label="My submitted teams"', 'label={freeCardCup ? "My FREE Cup teams" : vaultTournament ? "My paid teams" : "My teams"}');
  source = source.replaceAll('label="Shared vault entries"', 'label="Prize Vault qualifying entries"');

  return source;
});

// 2) User-specific entry history must never be cacheable across sessions.
patchFile("server/routes.ts", (original) => {
  let source = original;

  const oldMyEntries = '  app.get("/api/competitions/my-entries", requireAuth, async (req: any, res) => res.json(await storage.getUserCompetitions(req.authUserId)));';
  const safeMyEntries = `  // USER_SCOPED_MY_ENTRIES_API_V2\n  app.get("/api/competitions/my-entries", requireAuth, async (req: any, res) => {\n    res.setHeader("Cache-Control", "private, no-store, max-age=0");\n    const userId = String(req.authUserId || "");\n    if (!userId) return res.status(401).json({ message: "Unauthorized" });\n    return res.json(await storage.getUserCompetitions(userId));\n  });`;
  source = replaceOnce(source, oldMyEntries, safeMyEntries, "private my-entries API");

  const liveHubV2 = `  // TOURNAMENT_DATA_CONTRACT_LIVE_HUB_V2\n  app.get("/api/live/hub", async (_req, res) => {\n    try {\n      const { db } = await import("./db.js");\n      const [liveGames, listings, competitionCountResult, pointFeed] = await Promise.all([\n        fplApi.getLiveGames().catch(() => []),\n        storage.getMarketplaceListings().catch(() => []),\n        db.execute(sql\`\n          select count(*)::int as count\n          from app.competitions c\n          where lower(c.status::text) in ('open', 'active')\n            and c.name not like '[TEST]%'\n            and coalesce(lower(nullif(trim(c.visibility), '')), 'public') <> 'private'\n        \`).catch(() => null),\n        buildRealFplPointFeed(12).catch(() => []),\n      ]);\n      const competitionRows = rowsOf(competitionCountResult);\n      const liveCompetitions = Math.max(0, Number(competitionRows[0]?.count || 0));\n      res.setHeader("Cache-Control", "private, max-age=5, stale-while-revalidate=10");\n      return res.json({\n        updatedAt: new Date().toISOString(),\n        liveMatches: Array.isArray(liveGames) ? liveGames.length : 0,\n        activeListings: Array.isArray(listings) ? listings.length : 0,\n        liveCompetitions,\n        pointFeed: Array.isArray(pointFeed) ? pointFeed : [],\n        chatHighlights: [],\n        recentSales: [],\n      });\n    } catch (error) {\n      console.error("Live hub summary failed:", error);\n      return res.json({ updatedAt: new Date().toISOString(), liveMatches: 0, activeListings: 0, liveCompetitions: 0, pointFeed: [], chatHighlights: [], recentSales: [] });\n    }\n  });\n\n`;
  source = replaceSection(
    source,
    '  // SITE_AUDIT_LIVE_HUB_V1\n  app.get("/api/live/hub"',
    '  app.get("/api/live/point-feed"',
    liveHubV2,
    "TOURNAMENT_DATA_CONTRACT_LIVE_HUB_V2",
    "live hub database-backed competition count",
  );

  return source;
});

// 3) Prize Vault qualifying entries: paid official ladder entries only. Historical
// official rows may have NULL or blank prize_key/prize_type metadata. Blank values
// are treated as the historical ladder/goods defaults; N$0 Free Cups and cash-pool
// creator tournaments are excluded explicitly.
patchFile("server/routes/prizeVault.routes.ts", (original) => {
  let source = original;
  const oldFilters = `\n          and coalesce(lower(c.visibility), 'public') = 'public'\n          and lower(coalesce(c.prize_type, 'goods')) = 'goods'\n          and lower(coalesce(c.prize_key, 'ladder')) = 'ladder'`;
  const safeFilters = `\n          and coalesce(lower(nullif(trim(c.visibility), '')), 'public') = 'public'\n          and coalesce(c.entry_fee, 0) > 0\n          and lower(coalesce(nullif(trim(c.prize_type), ''), 'goods')) <> 'cash_pool'\n          and lower(coalesce(nullif(trim(c.prize_key), ''), 'ladder')) = 'ladder'`;
  source = replaceOnce(source, oldFilters, safeFilters, "historical paid Prize Vault filter");
  return source;
});

// 4) The highlighted live strip now links each metric to the surface that owns the
// data, and provides an explicit scoring-rules link.
patchFile("client/src/components/LivePulseDock.tsx", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    `          <Badge variant="outline" className="gap-1">\n            <Activity className="h-3 w-3 text-red-500" />\n            {data?.liveMatches ?? 0} live matches\n          </Badge>`,
    `          <Link href="/premier-league" title="Open live Premier League stats">\n            <Badge variant="outline" className="gap-1 cursor-pointer">\n              <Activity className="h-3 w-3 text-red-500" />\n              {data?.liveMatches ?? 0} live matches\n            </Badge>\n          </Link>`,
    "live matches metric link",
  );
  source = replaceOnce(
    source,
    `          <Badge variant="outline" className="gap-1">\n            <ShoppingCart className="h-3 w-3 text-emerald-500" />\n            {data?.activeListings ?? 0} active listings\n          </Badge>`,
    `          <Link href="/marketplace" title="Open active Marketplace listings">\n            <Badge variant="outline" className="gap-1 cursor-pointer">\n              <ShoppingCart className="h-3 w-3 text-emerald-500" />\n              {data?.activeListings ?? 0} active listings\n            </Badge>\n          </Link>`,
    "active listings metric link",
  );
  source = replaceOnce(
    source,
    `          <Badge variant="outline" className="gap-1">\n            <Trophy className="h-3 w-3 text-violet-500" />\n            {data?.liveCompetitions ?? 0} competitions open/live\n          </Badge>`,
    `          <Link href="/competitions" title="Open current tournaments">\n            <Badge variant="outline" className="gap-1 cursor-pointer">\n              <Trophy className="h-3 w-3 text-violet-500" />\n              {data?.liveCompetitions ?? 0} competitions open/live\n            </Badge>\n          </Link>`,
    "competition metric link",
  );
  source = replaceOnce(
    source,
    `          <Badge className={liveSummary.hasPositiveMomentum ? "bg-emerald-600" : "bg-zinc-600"}>\n            Momentum {liveSummary.hasPositiveMomentum ? "+" : ""}{liveSummary.momentum}\n          </Badge>`,
    `          <Link href="/my-entries" title="Open my tournament scores and entries">\n            <Badge className={(liveSummary.hasPositiveMomentum ? "bg-emerald-600" : "bg-zinc-600") + " cursor-pointer"}>\n              Momentum {liveSummary.hasPositiveMomentum ? "+" : ""}{liveSummary.momentum}\n            </Badge>\n          </Link>`,
    "momentum metric link",
  );
  source = replaceOnce(
    source,
    `          <div className="min-w-[220px] flex-1 truncate text-muted-foreground">\n            {liveSummary.topReason}\n            {data?.chatHighlights?.length ? \` • \${data.chatHighlights[data.chatHighlights.length - 1]?.userName}: \${data.chatHighlights[data.chatHighlights.length - 1]?.text}\` : ""}\n          </div>`,
    `          <div className="min-w-[220px] flex-1 truncate text-muted-foreground">\n            <Link href="/legal/scoring" className="hover:text-foreground" title="Open Fantasy Arena scoring rules">{liveSummary.topReason}</Link>\n            {data?.chatHighlights?.length ? \` • \${data.chatHighlights[data.chatHighlights.length - 1]?.userName}: \${data.chatHighlights[data.chatHighlights.length - 1]?.text}\` : ""}\n          </div>`,
    "scoring feed link",
  );
  source = replaceOnce(
    source,
    `            <Link href="/competitions"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Tournaments</Button></Link>`,
    `            <Link href="/competitions"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Tournaments</Button></Link>\n            <Link href="/legal/scoring"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Scoring</Button></Link>`,
    "explicit scoring navigation link",
  );
  return source;
});

// 5) When a user logs out, cancel old-user requests and remove all non-auth query
// cache so a different account on the same browser cannot inherit wallet/cards/
// entries while its own requests are loading.
patchFile("client/src/hooks/use-auth.ts", (source) => {
  const oldSuccess = `    onSuccess: () => {\n      queryClient.setQueryData(["/api/auth/user"], null);\n    },`;
  const safeSuccess = `    onSuccess: async () => {\n      // USER_SESSION_CACHE_ISOLATION_V2\n      await queryClient.cancelQueries();\n      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "/api/auth/user" });\n      queryClient.setQueryData(["/api/auth/user"], null);\n    },`;
  return replaceOnce(source, oldSuccess, safeSuccess, "logout cache isolation");
});

console.log("Applied tournament data contract v2: user-only My entries, paid/free/vault separation, DB-backed live stats, linked live metrics and cross-account cache isolation.");

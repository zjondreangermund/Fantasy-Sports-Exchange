import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const competitions = read("client/src/pages/competitions-vault.tsx");
const routes = read("server/routes.ts");
const prizeVault = read("server/routes/prizeVault.routes.ts");
const storage = read("server/storage.ts");
const liveDock = read("client/src/components/LivePulseDock.tsx");
const auth = read("client/src/hooks/use-auth.ts");

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(storage.includes("eq(competitionEntries.userId, userId)"), "Storage must filter My entries by authenticated userId");
check(routes.includes("USER_SCOPED_MY_ENTRIES_API_V2"), "My entries API must use the private user-scoped v2 handler");
check(routes.includes('Cache-Control", "private, no-store, max-age=0"'), "My entries response must not be cacheable across users");
check(routes.includes("storage.getUserCompetitions(userId)"), "My entries API must load only the authenticated user history");

check(competitions.includes('queryKey: ["/api/competitions/my-entries", user?.id || "anonymous"]'), "Frontend My entries cache must be keyed by authenticated user ID");
check(competitions.includes("enabled: Boolean(user?.id)"), "My entries query must wait for an authenticated user");
check(competitions.includes("USER_SCOPED_TOURNAMENT_ENTRY_COUNTS_V2"), "Tournament page must build a user-only entry count map");
check(competitions.includes('entryCount={entryCounts.get(Number(comp.id)) || 0}'), "Tournament cards must receive the current user's own entry count");
check(!competitions.includes("entryCount={tournamentEntryCount(comp)}"), "Public tournament totals must never be passed into the My entries prop");
check(competitions.includes('"All FREE Cup entries"'), "Free Cup total heading must identify all-player entries");
check(competitions.includes('"My FREE Cup teams"'), "Free Cup user heading must identify only the logged-in user's teams");
check(competitions.includes('"All paid tournament entries"'), "Paid tournament total heading must identify all-player entries");
check(competitions.includes('"My paid teams"'), "Paid tournament user heading must identify only the logged-in user's teams");
check(competitions.includes('label="Prize Vault qualifying entries"'), "Paid Vault card must label qualifying shared entries clearly");
check(competitions.includes("const tournamentEntries = Number(comp.entryCount"), "Tournament-wide total must still come from the competition API entryCount");
check(competitions.includes("const freeCardCup = isFreeCardCup(comp)"), "Free Cup product separation must remain active");
check(competitions.includes("const vaultTournament = isPrizeVaultTournament(comp)"), "Prize Vault product separation must remain active");

check(prizeVault.includes("coalesce(c.entry_fee, 0) > 0"), "Prize Vault must count paid entries only");
check(prizeVault.includes("nullif(trim(c.prize_key), '')"), "Prize Vault must accept blank historical ladder keys safely");
check(prizeVault.includes("nullif(trim(c.prize_type), '')"), "Prize Vault must normalize blank historical prize types safely");
check(prizeVault.includes("<> 'cash_pool'"), "Creator cash tournaments must stay outside the shared Prize Vault");
check(prizeVault.includes("ce.user_id not like 'test-bot-%'"), "Test bots must stay outside Prize Vault qualifying totals");

check(routes.includes("TOURNAMENT_DATA_CONTRACT_LIVE_HUB_V2"), "Live hub must use the database-backed v2 summary");
check(routes.includes("select count(*)::int as count"), "Live tournament total must be counted directly from the database");
check(routes.includes("lower(c.status::text) in ('open', 'active')"), "Live hub must count open/active tournaments");
check(routes.includes("coalesce(lower(nullif(trim(c.visibility), '')), 'public') <> 'private'"), "Live hub must count user-visible public tournaments only");
check(routes.includes("entryCount: entries.length"), "Competition API must expose the full tournament entry total independently of My entries");

for (const href of ["/premier-league", "/marketplace", "/competitions", "/my-entries", "/legal/scoring"]) {
  check(liveDock.includes(`href="${href}"`), `Highlighted live strip is missing link: ${href}`);
}
check(liveDock.includes("Open live Premier League stats"), "Live matches metric must explain its destination");
check(liveDock.includes("Open active Marketplace listings"), "Marketplace metric must explain its destination");
check(liveDock.includes("Open current tournaments"), "Tournament metric must explain its destination");
check(liveDock.includes("Open my tournament scores and entries"), "Momentum metric must link to the user's tournament scores");
check(liveDock.includes("Open Fantasy Arena scoring rules"), "Live scoring reason must link to scoring rules");

check(auth.includes("USER_SESSION_CACHE_ISOLATION_V2"), "Logout must isolate cached data between accounts");
check(auth.includes("await queryClient.cancelQueries()"), "Logout must cancel old-user in-flight queries");
check(auth.includes("queryClient.removeQueries"), "Logout must remove old-user private query cache");

if (failures.length) {
  console.error("Tournament data contract v2 verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Tournament data contract v2 verified: public totals, private My entries, paid/free/vault separation, live metric links and cross-account cache isolation.");

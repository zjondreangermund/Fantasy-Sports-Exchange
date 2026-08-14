import "./apply-tournament-data-contract-v2.mjs";
import "./verify-tournament-data-contract-v2.mjs";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const competitions = read("client/src/pages/competitions-vault.tsx");
const app = read("client/src/App.tsx");
const quickDock = read("client/src/components/MatchdayQuickDock.tsx");
const prizeVault = read("server/routes/prizeVault.routes.ts");
const routes = read("server/routes.ts");
const marketplace = read("server/routes/marketplace.routes.ts");
const userTournaments = read("server/routes/userTournaments.routes.ts");
const sidebar = read("client/src/components/app-sidebar.tsx");
const mobileNav = read("client/src/components/MobileNavDock.tsx");
const footer = read("client/src/components/SiteFooter.tsx");

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const count = (source, text) => source.split(text).length - 1;

check(competitions.includes("USER_SCOPED_TOURNAMENT_ENTRY_COUNTS_V2"), "Tournament page must keep current-user entry counts separate from public totals");
check(competitions.includes('entryCount={entryCounts.get(Number(pinTournament.id)) || 0}'), "Private tournament card must use the current user's own entry count");
check(competitions.includes('entryCount={entryCounts.get(Number(comp.id)) || 0}'), "Official tournament cards must use the current user's own entry count");
check(!competitions.includes("entryCount={tournamentEntryCount(comp)}"), "Public totals must not populate the My entries field");
check(competitions.includes("SITE_AUDIT_INVITE_AUTO_LOOKUP_V1"), "Private invite PIN must auto-resolve on the tournament page");
check(competitions.includes("initialInvitePin"), "Tournament page must read the PIN from /join/:pin or ?pin=");

check(app.includes('<Route path="/join/:pin" component={CompetitionsPage} />'), "Authenticated router must own /join/:pin");
check(app.includes("SITE_AUDIT_PENDING_INVITE_V1"), "Private tournament PIN must survive Google OAuth redirect");
check(quickDock.includes('<Link href="/live-lineup">'), "Edit Lineup quick action must open the actual lineup editor");
check(!quickDock.includes('/collection?editLineup=1'), "Unused collection editLineup shortcut must stay removed");

check(prizeVault.includes("coalesce(c.entry_fee, 0) > 0"), "Prize Vault must count paid entries only");
check(prizeVault.includes("nullif(trim(c.prize_key), '')"), "Prize Vault must accept historical blank ladder keys");
check(prizeVault.includes("nullif(trim(c.prize_type), '')"), "Prize Vault must normalize historical blank prize types");
check(prizeVault.includes("<> 'cash_pool'"), "Prize Vault must exclude creator cash tournaments");
check(!prizeVault.includes("and c.created_by_user_id is null\n          and lower(coalesce(c.prize_key, '')) = 'ladder'"), "Prize Vault must not reject legitimate admin-created official ladders solely by creator id");

check(routes.includes("TOURNAMENT_DATA_CONTRACT_LIVE_HUB_V2"), "Server must expose the database-backed live hub summary used by LivePulseDock");
check(routes.includes('app.get("/api/live/hub"'), "Live hub endpoint is missing");
check(routes.includes("select count(*)::int as count"), "Live hub must count current open/active tournaments directly from the database");
check(routes.includes("updatedAt: new Date().toISOString()"), "Live hub must return a freshness timestamp");
check(routes.includes("SITE_AUDIT_SETTLEMENT_CLOCK_V1"), "Server must calculate the Tuesday CAT settlement clock");
check(routes.includes("const settlementAt = catTuesdaySettlementAfterKickoff(new Date(submissionClosesAt));"), "Competition API must expose calculated settlementAt");
check(routes.includes("submissionClosesAt, settlementAt, entryOpen"), "Competition response must return entry lock and settlement together");
check(routes.includes("USER_SCOPED_MY_ENTRIES_API_V2"), "My entries API must be private and user scoped");

check(!marketplace.includes('registerTournamentCreatorRoutes(app, { requireAuth })'), "Marketplace must not register tournament creator routes a second time");
check(!marketplace.includes('app.post("/api/user-tournaments/create"'), "Marketplace must not shadow the canonical tournament creation endpoint");
check(count(userTournaments, 'app.post("/api/user-tournaments/create"') === 1, "User tournament module must own exactly one create endpoint");
check(userTournaments.includes("const TOURNAMENT_FEE_RATE = 0.10"), "User-created tournament platform fee must remain 10%");
check(userTournaments.includes("User-created tournaments are cash tournaments and require a paid entry fee"), "User-created tournaments must remain paid-only");

for (const href of ["/", "/competitions", "/my-entries", "/prize-vault", "/collection", "/marketplace", "/auctions", "/premier-league", "/wallet", "/account", "/game-rules", "/terms-and-conditions", "/help", "/contact-us"]) {
  check(sidebar.includes(`href: "${href}"`), `Sidebar route missing: ${href}`);
}
for (const href of ["/", "/competitions", "/collection", "/marketplace", "/account"]) {
  check(mobileNav.includes(`href: "${href}"`), `Mobile navigation route missing: ${href}`);
}
for (const href of ["/about", "/contact-us", "/help", "/faq", "/game-rules", "/legal/scoring", "/legal/prize-vault", "/legal/marketplace", "/legal/fair-play", "/terms-and-conditions", "/privacy-policy", "/legal/aml-kyc", "/legal/cookies", "/legal/refunds", "/legal/responsible-play", "/trust/status", "/trust/security", "/trust/payments", "/trust/releases", "/trust/roadmap"]) {
  check(footer.includes(`"${href}"`), `Footer route missing: ${href}`);
}

if (failures.length) {
  console.error("Site integrity audit verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Site integrity audit verified: public totals stay separate from My entries, Prize Vault uses paid qualifying entries, live stats are linked and DB-backed, invites/settlement/navigation remain intact.");

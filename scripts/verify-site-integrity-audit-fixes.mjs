import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const competitions = read("client/src/pages/competitions-vault.tsx");
const app = read("client/src/App.tsx");
const quickDock = read("client/src/components/MatchdayQuickDock.tsx");
const prizeVault = read("server/routes/prizeVault.routes.ts");
const marketplace = read("server/routes/marketplace.routes.ts");
const userTournaments = read("server/routes/userTournaments.routes.ts");
const sidebar = read("client/src/components/app-sidebar.tsx");
const mobileNav = read("client/src/components/MobileNavDock.tsx");
const footer = read("client/src/components/SiteFooter.tsx");

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const count = (source, text) => source.split(text).length - 1;

check(competitions.includes("SITE_AUDIT_TOTAL_ENTRY_COUNT_V1"), "Tournament page must use the total-entry-count repair");
check(competitions.includes("tournamentEntryCount(pinTournament)"), "Private tournament cards must show total server entryCount");
check(competitions.includes("tournamentEntryCount(comp)"), "Official tournament cards must show total server entryCount");
check(!competitions.includes("entryCounts.get(Number(comp.id))"), "Tournament display must not count only the current user's entries");
check(competitions.includes("SITE_AUDIT_INVITE_AUTO_LOOKUP_V1"), "Private invite PIN must auto-resolve on the tournament page");
check(competitions.includes("initialInvitePin"), "Tournament page must read the PIN from /join/:pin or ?pin=");

check(app.includes('<Route path="/join/:pin" component={CompetitionsPage} />'), "Authenticated router must own /join/:pin");
check(app.includes("SITE_AUDIT_PENDING_INVITE_V1"), "Private tournament PIN must survive Google OAuth redirect");
check(quickDock.includes('<Link href="/live-lineup">'), "Edit Lineup quick action must open the actual lineup editor");
check(!quickDock.includes('/collection?editLineup=1'), "Unused collection editLineup shortcut must stay removed");

check(prizeVault.includes("and c.created_by_user_id is null"), "Prize Vault must exclude user-created tournaments");
check(prizeVault.includes("lower(coalesce(c.prize_key, '')) = 'ladder'"), "Prize Vault must require the official ladder prize key");
check(prizeVault.includes("lower(coalesce(c.prize_type, 'goods')) = 'goods'"), "Prize Vault must require official goods prizes");
check(prizeVault.includes("coalesce(lower(c.visibility), 'public') = 'public'"), "Prize Vault must require public official tournaments");

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

console.log("Site integrity audit verified: total tournament counts, official Prize Vault isolation, invite routing, lineup shortcut, canonical tournament creation, and primary navigation links.");

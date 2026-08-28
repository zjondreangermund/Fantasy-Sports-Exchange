#!/usr/bin/env node
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const failures = [];
const expect = (value, message) => { if (!value) failures.push(message); };

const market = read("client/src/pages/marketplace-v2.tsx");
const loan = read("client/src/components/marketplace/LoanMarketPanel.tsx");
const adapter = read("client/src/lib/fantasy-card-adapter.ts");
const stable = read("client/src/components/cards/CollectionStableCard.tsx");
const profile = read("client/src/components/cards/CardProfileModal.tsx");
const analytics = read("client/src/pages/analytics.tsx");
const liveLineup = read("client/src/pages/live-lineup.tsx");
const cards = read("server/routes/cards.routes.ts");
const enrichment = read("server/services/playerCardEnrichment.ts");
const identity = read("server/services/fplPlayerIdentity.ts");
const marketRoute = read("server/routes/marketplace.routes.ts");
const loanRoute = read("server/routes/loanMarket.routes.ts");

expect(market.includes("CardProfileModal"), "Marketplace must open the collection card profile modal");
expect(market.includes("onViewProfile={setSelected}"), "Loan market must share the profile modal");
// Marketplace ranking and card PTS now intentionally use the same precise Fantasy Arena
// current-gameweek score as tournaments. Official FPL season totals remain reference data
// on the API/profile surfaces and must not replace the Arena tournament score.
expect(market.includes("Arena GW points"), "Marketplace must label Fantasy Arena current-gameweek points");
expect(market.includes('verifiedPlayerStat(card, "currentGameweekPoints", "card.currentGameweekPoints")'), "Marketplace must read verified current-gameweek Arena points");
expect(!market.includes("fantasy.totalPoints || card.decisiveScore"), "Marketplace must not fall back to decisive score as points");
expect(!market.includes("fantasy.rating ||"), "Marketplace must not substitute a derived rating for Arena points");
expect(loan.includes("loanCard(loan)"), "Loan rows must provide the real card to the profile modal");
expect(loan.includes("Arena OVR derived from official FPL inputs"), "Loan rows must disclose that Arena OVR is derived when that metric is displayed");
expect(!loan.includes("loan.overall || loan.decisive_score"), "Loan rows must not display stored fallback ratings");
expect(adapter.includes("statsVerified"), "Card adapter must expose verified-stat state");
expect(!adapter.includes("card.decisiveScore);"), "Card adapter must not invent rating or form from decisive score");
expect(!adapter.includes("last5Scores.reduce"), "Card adapter must not reconstruct season points from cached values");
expect(stable.includes("statsVerified && Number.isFinite(exactPoints)"), "Cards must suppress unverified point values");
expect(stable.includes('label="PTS"'), "Collection cards must expose the exact Fantasy Arena PTS field");
expect(stable.includes('label="FORM"'), "Collection cards must keep verified form separate from PTS");
expect(profile.includes("officialStat(data"), "Profile modal must suppress unverified numeric stats");
expect(analytics.includes("Only provider-linked Premier League statistics are included"), "Analytics must declare official-only data");
expect(analytics.includes("Top Verified Performers"), "Analytics rankings must use verified players only");
expect(analytics.includes("Avg Arena OVR"), "Analytics must call the derived metric Arena OVR");
expect(!analytics.includes("Avg Official OVR"), "Analytics must not call Arena OVR an official rating");
expect(analytics.includes("Arena OVR is a Fantasy Arena rating derived from verified FPL inputs"), "Analytics must explain the derived rating");
expect(!analytics.includes("card.decisiveScore"), "Analytics must not use decisive score as player performance");
expect(!analytics.includes("last5Scores"), "Analytics must not claim reconstructed last-five performance");
expect(liveLineup.includes("Team-feed events remain separate"), "Live lineup must separate team feed from player statistics");
expect(liveLineup.includes("Official statistics unavailable — no estimate shown"), "Live lineup must show neutral missing-data state");
expect(liveLineup.includes("label=\"A-OVR\""), "Live lineup must label the derived Arena OVR clearly where it is displayed");
expect(liveLineup.includes("Arena OVR is derived from verified FPL inputs"), "Live lineup must explain the derived rating");
expect(!liveLineup.includes("fixtureDifficulty"), "Live lineup must not invent fixture difficulty from card scores");
expect(!liveLineup.includes("eventMatchesCard"), "Team events must not be attributed to individual players by club name");
expect(cards.includes("getPlayerCardWithPlayer(cardId, viewerUserId)"), "Profiles must work for marketplace cards");
expect(cards.includes("const rawCard = await storage.getPlayerCard(cardId)"), "Profiles must work for loan and auction cards");
expect(enrichment.includes("last5Scores: []"), "Shared card enrichment must not reconstruct last-five results");
expect(!enrichment.includes("card.decisiveScore"), "Shared card enrichment must not use card progression as football performance");
expect(identity.includes("not an official league rating"), "Arena OVR source must be documented as a derived platform rating");
expect(marketRoute.includes("const currentGameweekPoints ="), "Sale listings must calculate precise current-gameweek Arena points");
expect(marketRoute.includes("officialFplSeasonPoints"), "Sale listings must retain official FPL season points as reference data");
expect(marketRoute.includes("totalPoints = identityVerified ? currentGameweekPoints : null"), "Sale listing PTS must use verified Arena gameweek points only");
expect(loanRoute.includes("official_total_points"), "Loan listings must use official provider reference points");

if (failures.length) {
  console.error("Marketplace and sitewide stats integrity verification failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exit(1);
}
console.log("Marketplace, collection, analytics and live-lineup surfaces use verified provider identity, precise Arena gameweek scoring, clearly labelled derived metrics where shown, and neutral missing-data states.");

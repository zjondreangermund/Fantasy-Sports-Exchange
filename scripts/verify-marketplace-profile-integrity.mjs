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
expect(market.includes("Season points"), "Marketplace must label official season points");
expect(market.includes("Arena OVR derived from official FPL inputs"), "Marketplace legacy summary disclosure must remain explicit until its separate listing-data migration");
expect(!market.includes("fantasy.totalPoints || card.decisiveScore"), "Marketplace must not fall back to decisive score as points");
expect(loan.includes("loanCard(loan)"), "Loan rows must provide the real card to the profile modal");
expect(loan.includes("Arena OVR derived from official FPL inputs"), "Loan legacy summary disclosure must remain explicit until its separate listing-data migration");
expect(!loan.includes("loan.overall || loan.decisive_score"), "Loan rows must not display stored fallback ratings");
expect(adapter.includes("statsVerified"), "Card adapter must expose verified-stat state");
expect(!adapter.includes("card.decisiveScore);"), "Card adapter must not invent rating or form from decisive score");
expect(!adapter.includes("last5Scores.reduce"), "Card adapter must not reconstruct season points from cached values");

// The shared player-card engine now hydrates API-Football rating/match data from the
// card profile endpoint. Marketplace/Collection/loan card faces all share this engine.
expect(stable.includes('const rating: number | string = statsVerified ? decimalStat(player.rating) : "—"'), "Cards must show verified API-Football rating only");
expect(stable.includes('label="RTG"'), "Shared card face must label API-Football rating clearly");
expect(stable.includes('label="MATCH"'), "Shared card face must expose verified match count instead of FPL form");
expect(stable.includes("isApiFootballPortrait"), "Shared card face must detect API-Football portraits");
expect(stable.includes('mixBlendMode: apiFootballPortrait ? "multiply"'), "Shared card face must suppress white API-Football image backgrounds");

expect(profile.includes("officialStat(data"), "Profile modal must suppress unverified numeric stats");
expect(profile.includes('return "API-Football verified"'), "Profile modal must identify API-Football as the player provider");
expect(!profile.includes('"FPL Points"'), "Profile modal must not expose FPL points as player-profile data");
expect(!profile.includes('label="Ownership"'), "Profile modal must not expose FPL ownership");
expect(analytics.includes("Only provider-linked Premier League statistics are included"), "Analytics must declare official-only data");
expect(analytics.includes("Top Verified Performers"), "Analytics rankings must use verified players only");
expect(analytics.includes("Avg Arena OVR"), "Analytics must call the derived metric Arena OVR");
expect(!analytics.includes("Avg Official OVR"), "Analytics must not call Arena OVR an official rating");
expect(analytics.includes("Arena OVR is a Fantasy Arena rating derived from verified FPL inputs"), "Analytics must explain its legacy derived rating until separately migrated");
expect(!analytics.includes("card.decisiveScore"), "Analytics must not use decisive score as player performance");
expect(!analytics.includes("last5Scores"), "Analytics must not claim reconstructed last-five performance");
expect(liveLineup.includes("Team-feed events remain separate"), "Live lineup must separate team feed from player statistics");
expect(liveLineup.includes("Official statistics unavailable — no estimate shown"), "Live lineup must show neutral missing-data state");
expect(liveLineup.includes("label=\"A-OVR\""), "Live lineup legacy summary must label its derived Arena OVR clearly");
expect(liveLineup.includes("Arena OVR is derived from verified FPL inputs"), "Live lineup must explain its legacy derived rating until separately migrated");
expect(!liveLineup.includes("fixtureDifficulty"), "Live lineup must not invent fixture difficulty from card scores");
expect(!liveLineup.includes("eventMatchesCard"), "Team events must not be attributed to individual players by club name");
expect(cards.includes("getPlayerCardWithPlayer(cardId, viewerUserId)"), "Profiles must work for marketplace cards");
expect(cards.includes("const rawCard = await storage.getPlayerCard(cardId)"), "Profiles must work for loan and auction cards");
expect(cards.includes("getApiFootballPlayerProfileSnapshot"), "Player card profiles must use API-Football match data");
expect(!cards.includes("fplApi.playerSummary"), "Player card profiles must not use FPL player history");
expect(enrichment.includes("last5Scores: []"), "Shared card enrichment must not reconstruct last-five results");
expect(!enrichment.includes("card.decisiveScore"), "Shared card enrichment must not use card progression as football performance");
expect(identity.includes("not an official league rating"), "Arena OVR source must be documented as a derived platform rating");
expect(marketRoute.includes("officialTotalPoints"), "Sale listing integrity must retain its stored provider-points contract");
expect(loanRoute.includes("official_total_points"), "Loan listing integrity must retain its stored provider-points contract");

if (failures.length) {
  console.error("Marketplace and sitewide stats integrity verification failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exit(1);
}
console.log("Marketplace/Collection shared cards use API-Football profile data while legacy analytics/listing summaries remain explicitly labelled until their separate migration.");

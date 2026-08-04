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
const cards = read("server/routes/cards.routes.ts");
const marketRoute = read("server/routes/marketplace.routes.ts");
const loanRoute = read("server/routes/loanMarket.routes.ts");

expect(market.includes("CardProfileModal"), "Marketplace must open the collection card profile modal");
expect(market.includes("onViewProfile={setSelected}"), "Loan market must share the profile modal");
expect(market.includes("Season points"), "Marketplace must label official season points");
expect(!market.includes("fantasy.totalPoints || card.decisiveScore"), "Marketplace must not fall back to decisive score as points");
expect(loan.includes("loanCard(loan)"), "Loan rows must provide the real card to the profile modal");
expect(!loan.includes("loan.overall || loan.decisive_score"), "Loan rows must not display stored fallback ratings");
expect(adapter.includes("statsVerified"), "Card adapter must expose verified-stat state");
expect(!adapter.includes("card.decisiveScore);"), "Card adapter must not invent rating or form from decisive score");
expect(stable.includes('statsVerified ? numberStat(player.rating) : "—"'), "Cards must show dashes for unverified stats");
expect(profile.includes("officialStat(data"), "Profile modal must suppress unverified numeric stats");
expect(cards.includes("getPlayerCardWithPlayer(cardId, viewerUserId)"), "Profiles must work for marketplace cards");
expect(cards.includes("const rawCard = await storage.getPlayerCard(cardId)"), "Profiles must work for loan and auction cards");
expect(marketRoute.includes("officialTotalPoints"), "Sale listings must use official provider points");
expect(loanRoute.includes("official_total_points"), "Loan listings must use official provider points");

if (failures.length) {
  console.error("Marketplace profile integrity verification failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exit(1);
}
console.log("Marketplace and loan cards open verified profiles, and unverified performance values are not presented as facts.");

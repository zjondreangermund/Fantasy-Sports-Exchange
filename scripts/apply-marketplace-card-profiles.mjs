#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const originalBlob = "be424c09b7ff62c093b0a2f47d1b4c08ad56aeb2";
const original = execFileSync("git", ["cat-file", "blob", originalBlob], { encoding: "utf8" });
const broken = 'failures.forEach((failure) => console.error(`- ${failure}`));';
const repaired = 'failures.forEach((failure) => console.error("- " + failure));';
if (!original.includes(broken)) throw new Error("Marketplace profile migration source could not be repaired");
const runnable = original.replace(broken, repaired);
const target = path.join(process.cwd(), ".tmp-apply-marketplace-card-profiles.mjs");
fs.writeFileSync(target, runnable, "utf8");
try {
  await import(`${pathToFileURL(target).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(target, { force: true });
}

const verifier = [
  '#!/usr/bin/env node',
  'import fs from "node:fs";',
  '',
  'const read = (file) => fs.readFileSync(file, "utf8");',
  'const failures = [];',
  'const expect = (value, message) => { if (!value) failures.push(message); };',
  '',
  'const market = read("client/src/pages/marketplace-v2.tsx");',
  'const loan = read("client/src/components/marketplace/LoanMarketPanel.tsx");',
  'const adapter = read("client/src/lib/fantasy-card-adapter.ts");',
  'const stable = read("client/src/components/cards/CollectionStableCard.tsx");',
  'const profile = read("client/src/components/cards/CardProfileModal.tsx");',
  'const analytics = read("client/src/pages/analytics.tsx");',
  'const liveLineup = read("client/src/pages/live-lineup.tsx");',
  'const cards = read("server/routes/cards.routes.ts");',
  'const enrichment = read("server/services/playerCardEnrichment.ts");',
  'const marketRoute = read("server/routes/marketplace.routes.ts");',
  'const loanRoute = read("server/routes/loanMarket.routes.ts");',
  '',
  'expect(market.includes("CardProfileModal"), "Marketplace must open the collection card profile modal");',
  'expect(market.includes("onViewProfile={setSelected}"), "Loan market must share the profile modal");',
  'expect(market.includes("Season points"), "Marketplace must label official season points");',
  'expect(!market.includes("fantasy.totalPoints || card.decisiveScore"), "Marketplace must not fall back to decisive score as points");',
  'expect(loan.includes("loanCard(loan)"), "Loan rows must provide the real card to the profile modal");',
  'expect(!loan.includes("loan.overall || loan.decisive_score"), "Loan rows must not display stored fallback ratings");',
  'expect(adapter.includes("statsVerified"), "Card adapter must expose verified-stat state");',
  'expect(!adapter.includes("card.decisiveScore);"), "Card adapter must not invent rating or form from decisive score");',
  'expect(!adapter.includes("last5Scores.reduce"), "Card adapter must not reconstruct season points from cached values");',
  'expect(stable.includes("statsVerified ? numberStat(player.rating)"), "Cards must show verified stats only");',
  'expect(profile.includes("officialStat(data"), "Profile modal must suppress unverified numeric stats");',
  'expect(analytics.includes("Only provider-linked Premier League statistics are included"), "Analytics must declare official-only data");',
  'expect(analytics.includes("Top Verified Performers"), "Analytics rankings must use verified players only");',
  'expect(!analytics.includes("card.decisiveScore"), "Analytics must not use decisive score as player performance");',
  'expect(!analytics.includes("last5Scores"), "Analytics must not claim reconstructed last-five performance");',
  'expect(liveLineup.includes("Team-feed events remain separate"), "Live lineup must separate team feed from player statistics");',
  'expect(liveLineup.includes("Official statistics unavailable — no estimate shown"), "Live lineup must show neutral missing-data state");',
  'expect(!liveLineup.includes("fixtureDifficulty"), "Live lineup must not invent fixture difficulty from card scores");',
  'expect(!liveLineup.includes("eventMatchesCard"), "Team events must not be attributed to individual players by club name");',
  'expect(cards.includes("getPlayerCardWithPlayer(cardId, viewerUserId)"), "Profiles must work for marketplace cards");',
  'expect(cards.includes("const rawCard = await storage.getPlayerCard(cardId)"), "Profiles must work for loan and auction cards");',
  'expect(enrichment.includes("last5Scores: []"), "Shared card enrichment must not reconstruct last-five results");',
  'expect(!enrichment.includes("card.decisiveScore"), "Shared card enrichment must not use card progression as football performance");',
  'expect(marketRoute.includes("officialTotalPoints"), "Sale listings must use official provider points");',
  'expect(loanRoute.includes("official_total_points"), "Loan listings must use official provider points");',
  '',
  'if (failures.length) {',
  '  console.error("Marketplace and sitewide stats integrity verification failed:");',
  '  failures.forEach((failure) => console.error("- " + failure));',
  '  process.exit(1);',
  '}',
  'console.log("Marketplace, collection, analytics and live-lineup surfaces use verified provider stats and neutral missing-data states.");',
  '',
].join("\n");
fs.writeFileSync(path.join(process.cwd(), "scripts/verify-marketplace-profile-integrity.mjs"), verifier, "utf8");

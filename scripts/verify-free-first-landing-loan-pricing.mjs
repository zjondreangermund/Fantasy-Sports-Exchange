import fs from "node:fs";

const landing = fs.readFileSync("client/src/pages/landing.tsx", "utf8");
const loanShared = fs.readFileSync("shared/loan-market.ts", "utf8");
const loanRoute = fs.readFileSync("server/routes/loanMarket.routes.ts", "utf8");
const loanClient = fs.readFileSync("client/src/components/marketplace/LoanMarketPanel.tsx", "utf8");
const legal = fs.readFileSync("client/src/pages/legal-centre.tsx", "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

function rejectText(source, text, label) {
  if (source.includes(text)) throw new Error(`Unexpected ${label}: ${text}`);
}

requireText(landing, "Start Free. Build Your Club.", "free-first hero");
requireText(landing, "Get My 5 Free Cards", "free signup CTA");
requireText(landing, "FREE Card Cups", "free tournament path");
requireText(landing, "Starting free is part of the game — not a trial.", "free-route explanation");
requireText(landing, "Loan it:", "won-card loan hint");
rejectText(landing, "const tournamentRules", "paid rarity table on landing");
rejectText(landing, "What does 2.0× funding mean?", "Prize Vault funding calculation on landing");

requireText(loanShared, 'import { getMarketplaceFloorPrice } from "./card-economy";', "Marketplace floor source");
requireText(loanShared, "export const LOAN_MINIMUM_RATE = 0.10", "10% loan minimum rate");
requireText(loanShared, "paidBasis > 0 ? paidBasis : getMarketplaceFloorPrice(normalized)", "purchase-or-floor minimum basis");

requireText(loanRoute, "LOAN_ACQUISITION_PRICING_V1", "server acquisition pricing marker");
requireText(loanRoute, '/api/marketplace/loans/my-minimums', "loan minimum API");
requireText(loanRoute, "costBasis: acquisition.costBasis", "server-side acquisition minimum enforcement");
requireText(loanRoute, "marketplace.purchase.completed", "Marketplace purchase cost basis");
requireText(loanRoute, "auction_escrow_holds", "auction purchase cost basis");

requireText(loanClient, "Purchased cards start at 10% of what you paid", "loan pricing explanation");
requireText(loanClient, "minimumPricePerGameweek", "calculated client minimum");
requireText(loanClient, "10% of the", "won/free floor explanation");

requireText(legal, "minimum loan listing price per gameweek is 10%", "published loan minimum rule");

console.log("Free-first landing and acquisition-based loan pricing verified.");

import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const cards = read("client/src/components/native/NativeCardsPage.tsx");
const tradeSheet = read("client/src/components/native/NativeCardTradeSheet.tsx");
const market = read("client/src/components/native/NativeMarketPage.tsx");
const integrity = read("scripts/apply-native-trading-integrity.mjs");
const loanPricing = read("scripts/apply-loan-acquisition-pricing.mjs");
const loanShared = read("shared/loan-market.ts");
const economy = read("shared/card-economy.ts");

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(cards.includes("NativeCardTradeSheet"), "My Cards no longer opens native trading actions");
expect(cards.includes('/marketplace?mode=buy'), "My Cards lost its Buy cards link");
expect(cards.includes('/marketplace?mode=loan'), "My Cards lost its Loan market link");
expect(cards.includes('/api/marketplace/loans/mine'), "My Cards no longer loads the user's loan state");
expect(tradeSheet.includes('POST", "/api/marketplace/list"'), "Native card sheet cannot create sale listings");
expect(tradeSheet.includes('/api/marketplace/cancel/${Number(card.id)}'), "Native card sheet cannot cancel sale listings");
expect(tradeSheet.includes('POST", "/api/marketplace/loans/list"'), "Native card sheet cannot create loan listings");
expect(tradeSheet.includes('/api/marketplace/loans/${Number(currentLoan.id)}/cancel'), "Native card sheet cannot cancel loan listings");
expect(tradeSheet.includes("MARKETPLACE_FEE_RATE"), "Native sale sheet no longer uses the canonical marketplace fee");
expect(tradeSheet.includes("getLoanFeeBreakdown"), "Native loan sheet no longer uses the canonical loan fee breakdown");
expect(tradeSheet.includes("LOAN_DURATIONS_GAMEWEEKS"), "Native loan sheet lost canonical loan durations");
expect(tradeSheet.includes("returns automatically"), "Native loan confirmation no longer explains automatic card return");

expect(market.includes('type MarketMode = "buy" | "loan"'), "Native marketplace lost Buy/Loan mode state");
expect(market.includes('setMarketMode("buy")'), "Native marketplace Buy toggle is missing");
expect(market.includes('setMarketMode("loan")'), "Native marketplace Loan toggle is missing");
expect(market.includes('/api/marketplace/loans/${Number(loan.id)}/accept'), "Native marketplace cannot accept a loan");
expect(market.includes('/api/marketplace/loans'), "Native marketplace no longer loads loan listings");
expect(market.includes("NATIVE_MARKET_BUY_LOAN_V2"), "Native marketplace trading marker is missing");

expect(integrity.includes('app.get("/api/marketplace/loans/mine"'), "Server patch lost per-user loan state endpoint");
expect(integrity.includes('app.post("/api/marketplace/loans/:loanId/cancel"'), "Server patch lost loan cancellation endpoint");
expect(integrity.includes("NATIVE_CARD_SALE_LOAN_GUARD_V1"), "Server patch no longer blocks selling loan-reserved cards");
expect(integrity.includes("NATIVE_MARKET_BUY_LOAN_GUARD_V1"), "Server patch no longer blocks buying loan-reserved cards");
expect(integrity.includes("LOAN_MARKET_FEE_RATE"), "Server patch no longer forces the canonical loan fee rate");
expect(loanPricing.includes('import "./apply-native-trading-integrity.mjs"'), "Native trading integrity is not applied during normal loan-pricing build preparation");

expect(loanShared.includes("LOAN_MARKET_FEE_RATE = 0.10"), "Canonical loan market fee is no longer 10%");
expect(economy.includes("MARKETPLACE_FEE_RATE = 0.08"), "Canonical sale marketplace fee is no longer 8%");

if (failures.length) {
  console.error("Native card trading verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Native card trading verification passed: My Cards buy/sell/loan actions, Buy/Loan marketplace modes, fee rules, cancellation and automatic-return safeguards are wired.");

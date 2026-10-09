import assert from "node:assert/strict";
import { getMarketplaceListingPrice } from "../shared/card-economy.js";

const cases: Array<{ name: string; listing: any; expected: number }> = [
  { name: "current price overrides a stale alias", listing: { price: 100, listedPrice: 25 }, expected: 100 },
  { name: "zero current price does not resurrect a stale ask", listing: { price: 0, listedPrice: 25 }, expected: 0 },
  { name: "legacy alias is used only when current price is absent", listing: { listedPrice: "25.50" }, expected: 25.5 },
  { name: "null current price does not resurrect a stale ask", listing: { price: null, listedPrice: 25 }, expected: 0 },
  { name: "invalid current price resolves to zero", listing: { price: "not-a-price", listedPrice: 25 }, expected: 0 },
  { name: "missing listing resolves to zero", listing: null, expected: 0 },
];

for (const testCase of cases) {
  assert.equal(getMarketplaceListingPrice(testCase.listing), testCase.expected, testCase.name);
}

console.log(`Marketplace price resolver passed ${cases.length} precedence and fallback cases.`);

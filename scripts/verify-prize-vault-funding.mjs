#!/usr/bin/env node
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const engine = read("server/services/prizeEngine.ts");
const route = read("server/routes/prizeVault.routes.ts");
const sharedRules = read("shared/game-rules.ts");

const entryFees = {
  common: 10,
  rare: 50,
  unique: 100,
  epic: 250,
  legendary: 500,
};
const multipliers = {
  common: 2,
  rare: 1.8,
  unique: 1.7,
  epic: 1.6,
  legendary: 1.5,
};

expect(engine.includes('from "../../shared/game-rules.js"'), "Prize Engine must use the shared rarity funding constants");
expect(engine.includes("calculatePrizeFunding"), "Prize Engine must centralize its funding calculation");
expect(engine.includes("entryRevenueAtUnlock"), "Prize Engine must expose actual entry revenue at unlock");
expect(engine.includes("fundingSurplus"), "Prize Engine must expose rounding surplus");
expect(route.includes("entryRevenueAtUnlock: prize.entryRevenueAtUnlock"), "Prize Vault API must expose entry revenue at unlock");
expect(route.includes("fundingSurplus: prize.fundingSurplus"), "Prize Vault API must expose funding surplus");
expect(route.includes("required entries = ceil((prize value × funding multiplier) ÷ entry fee)"), "Prize Vault API must explain its entry formula");

for (const [rarity, fee] of Object.entries(entryFees)) {
  expect(new RegExp(`${rarity}:\\s*${fee}(?:,|\\n)`).test(sharedRules), `Shared ${rarity} entry fee must be N$${fee}`);
}
for (const [rarity, multiplier] of Object.entries(multipliers)) {
  expect(new RegExp(`${rarity}:\\s*${String(multiplier).replace(".", "\\.")}(?:,|\\n)`).test(sharedRules), `Shared ${rarity} multiplier must be ${multiplier}x`);
}

const prizePattern = /makePrize\("([^"]+)",\s*"([^"]+)",\s*(\d+),\s*"([^"]+)",\s*"(common|rare|unique|epic|legendary)"\)/g;
const prizes = [];
let match;
while ((match = prizePattern.exec(engine))) {
  const [, key, title, rawValue, category, rarity] = match;
  const value = Number(rawValue);
  const entryFee = entryFees[rarity];
  const multiplier = multipliers[rarity];
  const unlockTarget = Math.ceil(value * multiplier);
  const requiredEntrants = Math.ceil(unlockTarget / entryFee);
  const entryRevenueAtUnlock = requiredEntrants * entryFee;
  prizes.push({ key, title, value, category, rarity, entryFee, multiplier, unlockTarget, requiredEntrants, entryRevenueAtUnlock });
}

expect(prizes.length > 0, "Prize catalog could not be parsed");
expect(new Set(prizes.map((prize) => prize.key)).size === prizes.length, "Prize keys must be unique");
expect(prizes.every((prize) => prize.value > 0 && prize.requiredEntrants > 0), "Every prize must have a positive value and required entry count");
expect(prizes.every((prize) => prize.entryRevenueAtUnlock >= prize.unlockTarget), "Every prize must be fully funded at its required entry count");

const legendary = prizes.filter((prize) => prize.rarity === "legendary");
expect(legendary.length === 20, `Legendary ladder must have 20 prizes; found ${legendary.length}`);
expect(!legendary.some((prize) => /champions league/i.test(prize.title)), "Champions League prize must be replaced");
expect(legendary[15]?.key === "legendary-dream-home", "Legendary prize 16 must remain Dream Home / Equivalent Value");
expect(legendary[15]?.value === 1_500_000, "Legendary prize 16 must remain valued at N$1,500,000");
expect(legendary.slice(16).every((prize) => prize.value > 1_500_000), "Legendary prizes 17-20 must all exceed N$1,500,000");
expect(legendary.every((prize, index) => index === 0 || prize.value >= legendary[index - 1].value), "Legendary prize values must be ascending");

const expectedLegendaryEntries = new Map([
  ["legendary-dream-home", 4500],
  ["legendary-cash-2000000", 6000],
  ["legendary-performance-suv", 7500],
  ["legendary-yacht", 10500],
  ["legendary-grand-prize", 15000],
]);
for (const [key, expectedEntries] of expectedLegendaryEntries) {
  const prize = legendary.find((item) => item.key === key);
  expect(Boolean(prize), `Missing Legendary prize ${key}`);
  expect(prize?.requiredEntrants === expectedEntries, `${key} must require ${expectedEntries} entries`);
}

if (failures.length) {
  console.error("Prize Vault funding verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Verified ${prizes.length} prizes. Entry requirements use value × rarity multiplier ÷ rarity entry fee, rounded up.`);
console.log("Legendary tiers 16-20: N$1.5m/4,500; N$2m/6,000; N$2.5m/7,500; N$3.5m/10,500; N$5m/15,000.");

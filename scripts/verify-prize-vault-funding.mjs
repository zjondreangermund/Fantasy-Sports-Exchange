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
  common: 1.7,
  rare: 1.6,
  unique: 1.5,
  epic: 1.4,
  legendary: 1.3,
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
  expect(multiplier > 1, `${rarity} funding multiplier must remain above 1.0x to protect prize principal`);
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
  const grossReserveAfterPrize = entryRevenueAtUnlock - value;
  prizes.push({ key, title, value, category, rarity, entryFee, multiplier, unlockTarget, requiredEntrants, entryRevenueAtUnlock, grossReserveAfterPrize });
}

expect(prizes.length > 0, "Prize catalog could not be parsed");
expect(new Set(prizes.map((prize) => prize.key)).size === prizes.length, "Prize keys must be unique");
expect(prizes.every((prize) => prize.value > 0 && prize.requiredEntrants > 0), "Every prize must have a positive value and required entry count");
expect(prizes.every((prize) => prize.unlockTarget >= prize.value), "No prize may unlock below its published prize value");
expect(prizes.every((prize) => prize.entryRevenueAtUnlock >= prize.unlockTarget), "Every prize must be fully funded at its required entry count");
expect(prizes.every((prize) => prize.entryRevenueAtUnlock >= prize.value), "No Prize Vault tier may create a gross prize-value loss at unlock");
expect(prizes.every((prize) => prize.grossReserveAfterPrize >= 0), "Every Prize Vault tier must retain a non-negative gross reserve after the prize value");

for (const rarity of Object.keys(entryFees)) {
  const rarityPrizes = prizes.filter((prize) => prize.rarity === rarity);
  expect(rarityPrizes.length > 0, `${rarity} Prize Vault ladder must not be empty`);
  expect(rarityPrizes.every((prize, index) => index === 0 || prize.requiredEntrants >= rarityPrizes[index - 1].requiredEntrants), `${rarity} required entry counts must remain ascending`);
}

const legendary = prizes.filter((prize) => prize.rarity === "legendary");
expect(legendary.length === 20, `Legendary ladder must have 20 prizes; found ${legendary.length}`);
expect(!legendary.some((prize) => /champions league/i.test(prize.title)), "Champions League prize must be replaced");
expect(legendary[15]?.key === "legendary-dream-home", "Legendary prize 16 must remain Dream Home / Equivalent Value");
expect(legendary[15]?.value === 1_500_000, "Legendary prize 16 must remain valued at N$1,500,000");
expect(legendary.slice(16).every((prize) => prize.value > 1_500_000), "Legendary prizes 17-20 must all exceed N$1,500,000");
expect(legendary.every((prize, index) => index === 0 || prize.value >= legendary[index - 1].value), "Legendary prize values must be ascending");

const expectedLegendaryEntries = new Map([
  ["legendary-dream-home", 3900],
  ["legendary-cash-2000000", 5200],
  ["legendary-performance-suv", 6500],
  ["legendary-yacht", 9100],
  ["legendary-grand-prize", 13000],
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

const minimumReserve = prizes.reduce((min, prize) => Math.min(min, prize.grossReserveAfterPrize), Number.POSITIVE_INFINITY);
console.log(`Verified ${prizes.length} prizes. Entry requirements use value × rarity multiplier ÷ rarity entry fee, rounded up.`);
console.log(`No-loss guard passed: every prize is fully funded before unlock; minimum gross reserve above prize value is N$${minimumReserve.toFixed(2)}.`);
console.log("Funding multipliers: Common 1.7x, Rare 1.6x, Unique 1.5x, Epic 1.4x, Legendary 1.3x.");
console.log("Legendary tiers 16-20: N$1.5m/3,900; N$2m/5,200; N$2.5m/6,500; N$3.5m/9,100; N$5m/13,000.");

import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(file, "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const reward = read("server/services/dailyLoginReward.ts");
const panel = read("client/src/components/dashboard/DailyLoginRewardPanel.tsx");
const engine = read("server/services/prizeEngine.ts");
const catalog = read("client/src/components/prize-vault/prizeArtworkCatalogLegacy.ts");

expect(reward.includes("WEEKLY_COMMON_REWARD_INTERVAL_DAYS = 7"), "Weekly Common reward interval must be 7 days");
expect(reward.includes("account.signup_day + 1"), "First free Common reward must remain eligible from signup Day 2");
expect(reward.includes("last_reward_day + ${WEEKLY_COMMON_REWARD_INTERVAL_DAYS}"), "Subsequent Common rewards must wait 7 days after the last reward");
expect(reward.includes("last_reward_day + ${WEEKLY_COMMON_REWARD_INTERVAL_DAYS}::integer"), "Weekly reward date arithmetic must bind an explicitly typed PostgreSQL integer");
expect(reward.includes("reward.weekly_common.claimed"), "Weekly Common reward audit action is missing");
expect(reward.includes("Weekly common card collected"), "Weekly Common notification is missing");
expect(!reward.includes("interval '1 day'"), "Old next-day reward interval must not remain active");
expect(panel.includes("Weekly Common reward"), "Dashboard must label the reward as weekly");
expect(panel.includes("Your first weekly card unlocks on Day 2"), "Dashboard must explain the Day 2 first reward");
expect(panel.includes("Next weekly card"), "Dashboard must show the next weekly reward timing");

expect(engine.includes('makePrize("legendary-world-cup", "N$250,000 Cash", 250000, "Cash", "legendary")'), "World Cup trip must be replaced with N$250,000 Cash without changing value");
expect(engine.includes('makePrize("legendary-tiny-home", "N$350,000 Vehicle Deposit / Equivalent Value", 350000, "Vehicle", "legendary")'), "Tiny Home must be replaced with N$350,000 Vehicle Deposit without changing value");
expect(!engine.includes("FIFA World Cup VIP Trip"), "World Cup VIP Trip must not remain in the Legendary ladder");
expect(!engine.includes("Tiny Home / Equivalent Value"), "Tiny Home must not remain in the Legendary ladder");
expect(catalog.includes("legendary-05-cash-250000.png"), "N$250,000 Cash artwork must remain mapped");
expect(catalog.includes("legendary-08-vehicle-deposit-350000.svg"), "Vehicle Deposit artwork must be mapped");
expect(!catalog.includes("legendary-08-tiny-home.png"), "Old Tiny Home artwork mapping must be removed");

const newArtwork = path.join("client", "public", "prizes", "legendary", "legendary-08-vehicle-deposit-350000.svg");
const oldArtwork = path.join("client", "public", "prizes", "legendary", "legendary-08-tiny-home.png");
expect(fs.existsSync(newArtwork), "New N$350,000 Vehicle Deposit Legendary artwork is missing");
expect(!fs.existsSync(oldArtwork), "Old Tiny Home Legendary artwork still exists");
if (fs.existsSync(newArtwork)) {
  const svg = read(newArtwork);
  expect(svg.includes("N$350,000") && svg.includes("VEHICLE DEPOSIT"), "Vehicle Deposit artwork does not match the replacement prize");
}

if (failures.length) {
  console.error("Weekly Common / Legendary refresh verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Weekly Common reward and Legendary prize replacements verified: Day 2 first reward, then every 7 days; same N$250k/N$350k prize values retained.");

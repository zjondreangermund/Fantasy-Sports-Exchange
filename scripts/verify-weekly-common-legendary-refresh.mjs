import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(file, "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const reward = read("server/services/dailyLoginReward.ts");
const rewardBalancePatch = read("scripts/apply-common-reward-position-balance.mjs");
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

// Position-aware Common rewards: the position is chosen for tournament utility,
// while the player identity remains random inside that position. This rule must
// stay scoped to Common cards only.
expect(reward.includes("COMMON_REWARD_POSITION_BALANCE_V1"), "Weekly Common position-balancing marker is missing");
expect(reward.includes('COMMON_TOURNAMENT_POSITIONS = ["GK", "DEF", "MID", "FWD"]'), "Common reward must balance GK/DEF/MID/FWD");
expect(reward.includes("commonRewardTargetTeams(commonCountAfterReward"), "Common reward must calculate the next team-capacity milestone");
expect(reward.includes("Math.ceil(Math.max(1, commonCountAfterReward) / 5)"), "Common reward must start balancing before each 10/15/20-card milestone");
expect(reward.includes("commonRewardPositionPriority(positionCountsBefore, commonCountAfterReward)"), "Common reward must prioritize the user's limiting position");
expect(reward.includes("findWeeklyCommonPlayerForPosition(tx, userId, position, true)"), "Common reward must prefer a new random player in the needed position");
expect(reward.includes("findWeeklyCommonPlayerForPosition(tx, userId, position, false)"), "Common reward must preserve position balance even if a duplicate player identity is required");
expect(reward.includes("p.position::text = ${position}"), "Weekly Common player selection must constrain the awarded position");
expect(reward.includes("owned.rarity::text = 'common'"), "Weekly position balancing must inspect Common ownership only");
expect(reward.includes("supply.rarity::text = 'common'"), "Weekly position balancing must mint Common supply only");
expect(reward.includes("VALUES (${Number(player.id)}, ${userId}, 'common'"), "Weekly reward mint must remain Common rarity");
expect(!rewardBalancePatch.includes("rarity::text = 'rare'"), "Position balancing must not apply to Rare cards");
expect(!rewardBalancePatch.includes("rarity::text = 'unique'"), "Position balancing must not apply to Unique cards");
expect(!rewardBalancePatch.includes("rarity::text = 'epic'"), "Position balancing must not apply to Epic cards");
expect(!rewardBalancePatch.includes("rarity::text = 'legendary'"), "Position balancing must not apply to Legendary cards");

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

console.log("Weekly Common reward verified: Day 2 then every 7 days; Common-only position balancing targets tournament-team capacity while player identity stays random. Legendary prize replacements remain unchanged.");

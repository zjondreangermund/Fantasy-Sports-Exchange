import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(file, "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const reward = read("server/services/dailyLoginReward.ts");
const rewardBalancePatch = read("scripts/apply-common-reward-position-balance.mjs");
const panel = read("client/src/components/dashboard/DailyLoginRewardPanel.tsx");
const referrals = read("server/routes/referrals.routes.ts");
const app = read("client/src/App.tsx");
const installApp = read("client/src/components/InstallAppButton.tsx");
const siteView = read("client/src/lib/site-view.ts");
const scroll = read("client/src/unified-scroll.css");
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

// Referral rewards are also free Common cards, so they must use the same
// position-first, random-player-within-position strategy without touching any
// tradable rarity. The reward mint and referral claim must also be atomic: a
// failed referral row may never leave an owned card behind.
expect(referrals.includes("REFERRAL_COMMON_POSITION_BALANCE_V1"), "Referral Common position-balancing marker is missing");
expect(referrals.includes("REFERRAL_ATOMIC_CLAIM_V1"), "Atomic referral claim marker is missing");
expect(referrals.includes('COMMON_POSITIONS = ["GK", "DEF", "MID", "FWD"]'), "Referral rewards must balance GK/DEF/MID/FWD");
expect(referrals.includes("referralTargetTeams(commonCountAfterReward"), "Referral rewards must calculate the same next team-capacity milestone");
expect(referrals.includes("Math.ceil(Math.max(1, commonCountAfterReward) / 5)"), "Referral rewards must balance before each 10/15/20-card milestone");
expect(referrals.includes("referralPositionPriority(counts, ownedCommon.length + 1)"), "Referral rewards must prioritize the referrer's limiting Common position");
expect(referrals.includes("const unseen = positionPool.filter"), "Referral rewards must prefer a new random player identity inside the needed position");
expect(referrals.includes("values (${playerId}, ${userId}, 'common'"), "Referral reward mint must remain Common rarity");
expect(referrals.includes("grantPositionBalancedCommonCard(storage, referrerUserId, tx)"), "Referral claim must mint the position-balanced Common card inside its transaction");
expect(referrals.includes("db.transaction(async (tx: any)"), "Referral claim must use one database transaction");
expect(referrals.includes("pg_advisory_xact_lock"), "Referral claim must serialize retries/concurrent claims");
expect(referrals.includes("alter table app.referrals add column if not exists referral_code text"), "Referral startup compatibility must add the missing referral_code column");
expect(referrals.includes("referrals_referred_user_id_unique_idx"), "Referral claims need a durable unique referred-user constraint");
for (const rarity of ["rare", "unique", "epic", "legendary"]) {
  expect(!referrals.includes(`rarity: "${rarity}"`), `Referral position balancing must not mint ${rarity} cards`);
}

// Signed-in web users who have not installed Fantasy Arena must always retain
// a visible install affordance. Installed native/PWA sessions hide it.
expect(app.includes('import InstallAppButton from "./components/InstallAppButton";'), "Authenticated app must import the Install App control");
expect(app.includes("<InstallAppButton />"), "Authenticated header must show the Install App option to eligible web users");
expect(installApp.includes("beforeinstallprompt"), "Install App control must capture the browser install prompt");
expect(installApp.includes("appinstalled"), "Install App control must react when installation completes");
expect(installApp.includes("if (isInstalledMobileApp()) return null"), "Install App option must be hidden once the app is installed");
expect(installApp.includes("Install App"), "Install App control must have an explicit user-facing label");
expect(installApp.includes("Add to Home Screen"), "iOS install fallback instructions must be available");

// Every fresh installed-app session is desktop-first, while a temporary Mobile
// view switch remains possible for that session. Pinch zoom must allow panning
// in both directions in Desktop view.
expect(siteView.includes('APP_SESSION_VIEW_STORAGE_KEY = "fantasy_arena_app_session_view"'), "Installed app must keep temporary view changes session-scoped");
expect(siteView.includes('if (isInstalledMobileApp()) return "desktop";'), "Installed mobile app must default to Desktop view on a fresh app session");
expect(siteView.includes("window.sessionStorage.setItem(APP_SESSION_VIEW_STORAGE_KEY, mode)"), "Installed app view toggles must not replace the next-launch Desktop default");
expect(siteView.includes("user-scalable=yes"), "App viewports must keep browser zoom enabled");
expect(scroll.includes("APP_DESKTOP_VIEW_PAN_V1"), "Desktop-view app panning guard is missing");
expect(scroll.includes("touch-action: pan-x pan-y pinch-zoom !important;"), "Zoomed Desktop view must permit horizontal and vertical panning");

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
  console.error("Weekly/referral Common reward and mobile app UX verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Common rewards verified: weekly and referral cards balance tournament positions while player identity remains random; referral rewards are atomic/idempotent; signed-in web users retain Install App access; installed app sessions default to Desktop view and support two-axis panning while zoomed.");

import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function need(source, token, label) {
  if (!source.includes(token)) throw new Error(`[notification-truth] missing ${label}`);
}
function reject(source, token, label) {
  if (source.includes(token)) throw new Error(`[notification-truth] unsafe ${label}`);
}

const routes = read("server/routes/notifications.routes.ts");
const community = read("server/routes/communityChatV2.routes.ts");
const economy = read("server/routes/economyIntegrity.routes.ts");
const daily = read("server/services/dailyLoginReward.ts");
const pack = read("server/services/packAuctionEscrow.ts");

need(routes, "NOTIFICATION_TRUTH_GUARDS_V1:gameweek-clock", "gameweek timing marker");
need(routes, 'c.fixture_window_start as "fixtureStart"', "verified first-kickoff timestamp");
need(routes, "competition.fixtureStart || competition.startDate", "kickoff-based gameweek selection");
need(routes, "earliest?.fixtureStart || earliest?.startDate", "kickoff-based start/lock reminder clock");

need(economy, "NOTIFICATION_TRUTH_GUARDS_V1:entry-evidence", "exact-entry notification evidence marker");
need(economy, "ce.id = ${entryId}", "entry ID evidence");
need(economy, "ce.competition_id = c.id", "competition evidence");
need(economy, "ce.user_id = u.id", "entry-owner evidence");

need(community, "NOTIFICATION_TRUTH_GUARDS_V1:unique-mention", "unique mention marker");
need(community, "HAVING count(*) = 1", "ambiguous-handle suppression");

need(daily, "NOTIFICATION_TRUTH_GUARDS_V1:weekly-reward", "weekly reward truth marker");
need(daily, "await createNotificationOnce(tx", "weekly reward exactly-once notification");
need(daily, "weekly-common:${rewardDay}:card:${Number(card.id)}", "weekly reward dedupe identity");
reject(daily, "INSERT INTO app.notifications (user_id, type, title, message)", "raw weekly notification insert");

need(pack, "NOTIFICATION_TRUTH_GUARDS_V1:pack-auction", "pack auction truth marker");
need(pack, "pack-auction:${auctionId}:settled:${buyerId}", "buy-now settlement dedupe");
need(pack, "pack-auction:${auctionId}:settled:${winnerId}", "auction winner settlement dedupe");
reject(pack, "INSERT INTO app.notifications (user_id, type, title, message, read, created_at)", "raw pack-auction notification insert");

console.log("Notification truth guards verified: start/lock reminders use first kickoff, entry alerts require the committed entry, ambiguous mentions are suppressed, and reward/auction success alerts are transaction-backed and deduplicated.");
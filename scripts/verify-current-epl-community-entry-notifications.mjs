import fs from "node:fs";
import "./prepare-current-epl-common-patcher.mjs";
import "./apply-current-epl-community-entry-notifications.mjs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function need(source, text, label) {
  if (!source.includes(text)) throw new Error(`[arena-live-entry] missing ${label}`);
}

const communityServer = read("server/routes/communityChatV2.routes.ts");
const communityClient = read("client/src/lib/community-chat.ts");
const economy = read("server/routes/economyIntegrity.routes.ts");
const notifications = read("server/services/notifications.ts");
const weekly = read("server/services/dailyLoginReward.ts");
const weeklyPatcher = read("scripts/apply-common-reward-position-balance.mjs");
const referrals = read("server/routes/referrals.routes.ts");
const rewardRepair = read("server/services/tournamentRewards.ts");
const freeCupAwards = read("scripts/apply-free-card-cup-auto-awards.mjs");

need(communityClient, "MAX_SAVED_AGE_MS = 24 * 60 * 60 * 1000", "24-hour browser chat cache");
need(communityServer, "COMMUNITY_24H_RETENTION_V1", "24-hour server retention marker");
need(communityServer, "DELETE FROM app.community_chat_messages", "expired chat deletion");
need(communityServer, "m.created_at >= now() - interval '24 hours'", "24-hour chat query window");
need(communityServer, "Community Live scheduled retention cleanup failed", "hourly retention cleanup");
need(communityServer, "community-mention:", "mention notification dedupe");
need(communityServer, "await createNotificationOnce(db", "mention notifications remain push-enabled");

need(notifications, "app.notification_push_deliveries", "web push delivery queue");
need(notifications, "app.notification_native_push_deliveries", "native push delivery queue");

need(economy, "TOURNAMENT_ENTRY_PUSH_V1", "tournament submission notification helper");
need(economy, "has been submitted to", "team-name entry confirmation copy");
need(economy, "milestoneCount % 25", "25-entry milestone trigger");
need(economy, "Next bigger reward:", "Prize Ladder momentum copy");
need(economy, "prize-ladder:", "Prize Ladder milestone dedupe");
need(economy, "notifyTournamentEntryActivity(userId, competitionId, Number(entry.id))", "entry notification call after submit");

need(weeklyPatcher, "coalesce(p.fpl_id, 0) > 0", "weekly Common official FPL identity filter");
need(weeklyPatcher, "NOT IN ('departed', 'superseded', 'unlinked', 'archived')", "weekly Common departed-player exclusion");
need(weekly, "coalesce(p.fpl_id, 0) > 0", "runtime weekly FPL identity filter");
need(weekly, "NOT IN ('departed', 'superseded', 'unlinked', 'archived')", "runtime weekly departed-player exclusion");
need(referrals, '!["departed", "superseded", "unlinked", "archived"].includes(status)', "referral departed-player exclusion");
need(rewardRepair, "CURRENT_EPL_REWARD_REPAIR_V1", "tournament reward-repair EPL guard");
need(rewardRepair, "fplId > 0", "reward-repair FPL identity requirement");
need(freeCupAwards, "coalesce(p.fpl_id, 0) > 0", "Free Cup fallback FPL identity requirement");
need(freeCupAwards, "not in ('departed','superseded','unlinked','archived')", "Free Cup fallback departed-player exclusion");

console.log("Current EPL reward safeguards, 24-hour Community Live retention, mention pushes, tournament entry confirmations and every-25-entry momentum notifications verified.");

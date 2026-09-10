import fs from "node:fs";

await import("./prepare-current-epl-common-patcher.mjs");
await import("./apply-community-24h-retention.mjs");
await import("./apply-current-epl-reward-guards.mjs");
await import("./apply-stable-player-card-images.mjs");
await import("./apply-tournament-entry-notifications.mjs");
await import("./apply-tournament-settlement-broadcasts.mjs");

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
const collectionProfileCard = read("client/src/components/cards/CollectionProfileCard.tsx");
const cardProfileModal = read("client/src/components/cards/CardProfileModal.tsx");

need(communityClient, "MAX_SAVED_AGE_MS = 24 * 60 * 60 * 1000", "24-hour browser chat cache");
need(communityServer, "COMMUNITY_24H_RETENTION_V2", "24-hour server retention marker");
need(communityServer, "DELETE FROM app.community_chat_messages", "expired chat deletion");
need(communityServer, "m.created_at >= now() - interval '24 hours'", "24-hour chat query window");
need(communityServer, "Community Live scheduled 24-hour cleanup failed", "scheduled retention cleanup");
need(communityServer, "community-mention:", "mention notification dedupe");
need(communityServer, "await createNotificationOnce(db", "mention notifications remain push-enabled");

need(notifications, "app.notification_push_deliveries", "web push delivery queue");
need(notifications, "app.notification_native_push_deliveries", "native push delivery queue");

need(economy, "TOURNAMENT_ENTRY_MOMENTUM_PUSH_V2", "tournament submission/momentum helper");
need(economy, "has been entered into", "team-name entry confirmation copy");
need(economy, "entryCount % 25", "25-entry milestone trigger");
need(economy, "Next bigger reward:", "Prize Ladder momentum copy");
need(economy, "More entries can push the Prize Ladder even higher", "energetic bigger-reward copy");
need(economy, "where coalesce(is_banned, false) = false", "all-active-manager broadcast guard");
need(economy, "notifyTournamentEntryActivity(userId, competitionId, Number(entry.id))", "entry notification call after submit");

need(economy, "TOURNAMENT_SETTLEMENT_BROADCAST_V1", "settlement broadcast marker");
need(economy, "CHAMPION!", "winner congratulations notification");
need(economy, "you finished #", "entrant settlement result notification");
need(economy, "Think your squad can take the next one?", "public winner encouragement copy");
need(economy, "public-settlement-winner", "public settlement dedupe");

need(collectionProfileCard, "retainedImages", "collection profile portrait candidates");
need(collectionProfileCard, "existingVerified", "collection profile identity preservation");
need(collectionProfileCard, "verifiedImageUrl: retainedPrimary", "collection profile portrait retention");
need(cardProfileModal, "retainedImages", "modal portrait candidates");
need(cardProfileModal, "existingVerified", "modal identity preservation");
need(cardProfileModal, "verifiedImageUrl: retainedPrimary", "modal portrait retention");

const helperStart = weeklyPatcher.indexOf("async function findWeeklyCommonPlayerForPosition");
const helperEnd = helperStart >= 0 ? weeklyPatcher.indexOf("async function", helperStart + 20) : -1;
const helperSegment = helperStart >= 0 ? weeklyPatcher.slice(helperStart, helperEnd > helperStart ? helperEnd : weeklyPatcher.length) : "";
need(helperSegment, "coalesce(p.fpl_id, 0) > 0", "generated weekly Common official FPL identity filter");
need(helperSegment, "NOT IN ('departed', 'superseded', 'unlinked', 'archived')", "generated weekly Common departed-player exclusion");
need(weekly, "coalesce(p.fpl_id, 0) > 0", "runtime weekly FPL identity filter");
need(weekly, "NOT IN ('departed', 'superseded', 'unlinked', 'archived')", "runtime weekly departed-player exclusion");
need(referrals, '!["departed", "superseded", "unlinked", "archived"].includes(status)', "referral departed-player exclusion");
need(rewardRepair, "CURRENT_EPL_REWARD_REPAIR_V2", "tournament reward-repair EPL guard");
need(rewardRepair, "fplId > 0", "reward-repair FPL identity requirement");
need(freeCupAwards, "coalesce(p.fpl_id, 0) > 0", "Free Cup fallback FPL identity requirement");
need(freeCupAwards, "not in ('departed','superseded','unlinked','archived')", "Free Cup fallback departed-player exclusion");

console.log("Current EPL reward safeguards, rolling 24-hour Community Live retention, mention pushes, stable player portraits, tournament entry confirmations, every-25-entry momentum alerts and settlement winner broadcasts verified.");

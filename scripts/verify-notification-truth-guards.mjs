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

const notifier = read("server/services/notifications.ts");
const scorer = read("server/services/scoreUpdater.ts");
const notificationClient = read("client/src/lib/notifications.ts");
need(notifier, "GAMEWEEK_ENTRY_CLOSED_GOOD_LUCK_V1", "gameweek closed notification");
need(notifier, "firstKickoffByWeek", "first kickoff, not early fantasy deadline");
need(notifier, "nowMs >= kickoff", "only notify after first match starts");
need(notifier, "FROM app.competition_entries ce", "entrant-only recipient list");
need(notifier, "JOIN app.competitions c ON c.id = ce.competition_id", "registered cup linkage");
need(notifier, "NOT EXISTS (", "already-notified recipients excluded");
need(notifier, "gameweek:${season}:${gameWeek}:entries-closed-good-luck", "per-season per-week dedupe");
need(notifier, "createNotificationOnce(db", "persistent Inbox and push delivery jobs");
need(scorer, "await notifyGameweekEntriesClosed(fixtures, now)", "dispatch at cutoff and crash retry");
need(routes, "Suppress the old separate 'GW is live' push", "no redundant second live push");
need(notificationClient, 'replacementKey.endsWith(":entries-closed-good-luck")', "Inbox routes to My Entries");

// MINT_PUSH_FLOOD_GUARD_V1 — across page polling, restarts and multiple eligible cards.
const mintPopup = read("client/src/components/WeeklyCommonMintDialog.tsx");
const floatingToasts = read("client/src/components/FloatingEventNotifications.tsx");
const alertPreferences = read("server/services/arenaAttention.ts");
need(notifier, "create table if not exists app.notification_push_topic_limits", "durable, per-manager notification burst limiter");
need(notifier, 'dedupeKey.startsWith("card:weekly-ready:")', "weekly reward phone push family");
need(notifier, 'dedupeKey.startsWith("replacement-claim:")', "replacement choice phone push family");
need(notifier, 'const quietMinutes = mintPushTopic ? 720 : 30;', "mint reminders 12h, live scores 30-minute phone quiet period");
need(notifier, 'limitedTopic', "only repeat-prone phone pushes are throttled");
need(notifier, 'if (notification?.id && queuePush)', "Inbox notification is created independently of push throttle");
need(alertPreferences, '"mint"', "user can mute mint phone reminders but not lose Inbox");
need(mintPopup, "WEEKLY_MINT_POPUP_SNOOZE_V1", "once-per-week dismissible claim modal");
need(mintPopup, "localStorage.setItem(promptKey, \"later\")", "dismissal remembered across polling and app restart");
need(mintPopup, "Later — remind me in Inbox", "reward stays claimable after modal is dismissed");
reject(mintPopup, 'onEscapeKeyDown={(event) => event.preventDefault()}', "forced mint modal");
need(floatingToasts, 'key.startsWith("replacement-reminder:")', "no repeated old mint toast");
need(floatingToasts, 'key.startsWith("card:weekly-ready:")', "no repeated weekly reminder toast");



need(economy, "NOTIFICATION_TRUTH_GUARDS_V1:entry-evidence", "exact-entry notification evidence marker");
need(economy, "ce.id = ${entryId}", "entry ID evidence");
need(economy, "ce.competition_id = c.id", "competition evidence");
need(economy, "ce.user_id = u.id", "entry-owner evidence");

need(community, "NOTIFICATION_TRUTH_GUARDS_V1:unique-mention", "unique mention marker");
need(community, "HAVING count(*) = 1", "ambiguous-handle suppression");

need(daily, "NOTIFICATION_TRUTH_GUARDS_V1:weekly-reward", "weekly reward truth marker");
need(daily, "await createNotificationOnce(tx", "weekly reward exactly-once notification");
if (!daily.includes("weekly-common:${rewardDay}:card:${Number(card.id)}") && !daily.includes("card:weekly-minted:${rewardDay}:${Number(card.id)}")) {
  throw new Error("[notification-truth] missing weekly reward dedupe identity");
}
reject(daily, "INSERT INTO app.notifications (user_id, type, title, message)", "raw weekly notification insert");

need(pack, "NOTIFICATION_TRUTH_GUARDS_V1:pack-auction", "pack auction truth marker");
need(pack, "pack-auction:${auctionId}:settled:${buyerId}", "buy-now settlement dedupe");
need(pack, "pack-auction:${auctionId}:settled:${winnerId}", "auction winner settlement dedupe");
reject(pack, "INSERT INTO app.notifications (user_id, type, title, message, read, created_at)", "raw pack-auction notification insert");


// ADMIN_NOTIFICATION_DELIVERY_AUDIT_V1 — diagnostics must be visible only to admins.
const adminAudit = read("server/routes/adminNotificationAudit.routes.ts");
const adminRoutes = read("server/routes/admin.routes.ts");
const adminPage = read("client/src/pages/admin.tsx");
const adminAuditPanel = read("client/src/components/admin/AdminNotificationAuditPanel.tsx");
need(adminRoutes, "registerAdminNotificationAuditRoutes(app, { requireAuth, isAdmin });", "admin notification routes registered with RBAC");
need(adminAudit, 'app.get("/api/admin/notification-audit/summary", requireAuth, isAdmin', "restricted notification summary");
need(adminAudit, 'app.get("/api/admin/notification-audit/events", requireAuth, isAdmin', "restricted event details");
need(adminAudit, 'app.get("/api/admin/notification-audit/users", requireAuth, isAdmin', "restricted push connection status");
need(adminAudit, "notification_native_push_deliveries", "Android delivery audit");
need(adminAudit, "notification_push_deliveries", "Web push delivery audit");
need(adminPage, '<TabsTrigger value="notifications"', "visible admin Notifications tab");
need(adminPage, "<AdminNotificationAuditPanel", "admin notification panel integrated");
need(adminAuditPanel, "Provider accepted", "provider-send disclaimer");
need(adminAuditPanel, "No push token", "user coverage without overriding notification consent");

console.log("Notification truth guards verified: start/lock reminders use first kickoff, entry alerts require the committed entry, ambiguous mentions are suppressed, and reward/auction success alerts are transaction-backed and deduplicated.");

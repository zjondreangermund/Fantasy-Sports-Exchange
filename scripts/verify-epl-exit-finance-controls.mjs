import assert from "node:assert/strict";
import fs from "node:fs";
import "./apply-departed-card-archive.mjs";

const read = (path) => fs.readFileSync(path, "utf8");
const need = (source, token, message) => assert.ok(source.includes(token), message);

const transfer = read("server/services/playerTransferMonitoring.ts");
const app = read("client/src/App.tsx");
const account = read("client/src/pages/account.tsx");
const economy = read("server/routes/economyIntegrity.routes.ts");
const competitions = read("client/src/pages/competitions-vault.tsx");
const admin = read("server/routes/admin.routes.ts");
const adminUi = read("client/src/components/admin/AdminTournamentManager.tsx");
const notifications = read("server/services/notifications.ts");
const notificationRoutes = read("server/routes/notifications.routes.ts");
const departurePolicy = read("server/services/departedCardPolicy.ts");
const cardsRoutes = read("server/routes/cards.routes.ts");
const departedArchive = read("scripts/apply-departed-card-archive.mjs");
const webPush = read("server/services/webPush.ts");
const nativePush = read("server/services/nativePush.ts");
const pushControl = read("client/src/components/PushNotificationControl.tsx");
const serviceWorker = read("client/public/sw.js");
const packageJson = read("package.json");
const capacitorConfig = read("capacitor.config.ts");
const androidWorkflow = read(".github/workflows/android-app-build.yml");

need(transfer, "EPL_REPLACEMENT_SAME_POSITION_V1", "same-position replacement marker is missing");
need(transfer, 'source.position::text as "sourcePosition"', "replacement claims do not expose the departed player position");
need(transfer, 'and p.position::text=${sourcePosition}', "replacement candidates are not restricted to the same position");
need(transfer, "CURRENT_EPL_REPLACEMENT_POOL_V1", "replacement candidates must be checked against the official current EPL roster.");
need(transfer, 'p.fpl_id = any(${currentFplIdArray}::int[])', "replacement candidates must still exist in the current FPL player pool.");
need(transfer, "Mint the same-position, same-rarity replacement from Inbox within 14 days", "departure notification does not explain the 14-day manual claim window");
need(transfer, "reminder after 7 days", "departure notification does not explain the 7-day reminder");
need(transfer, "auto-mints after 14 days", "departure notification does not explain delayed automatic minting");
need(transfer, "cl.card_id=pc.id", "departed source-card archive does not protect active tournament locks");
need(transfer, "cl.expires_at is null or cl.expires_at > now()", "departed source-card archive does not wait for active tournament locks to clear");
assert.ok(!app.includes("<MandatoryReplacementClaimDialog />"), "EPL replacement claims must not block the whole app with a mandatory modal.");
need(app, "<PushNotificationControl />", "installed-app push notification control is not mounted globally");
need(account, "Mint {String(note.replacementRarity", "Inbox must expose the manual replacement mint action.");
need(account, "replacementSourcePosition", "Inbox replacement action must show the protected football position.");
need(account, "replacementAutoMintAt", "Inbox must show when the replacement will auto-mint.");
need(departurePolicy, "EPL_REPLACEMENT_CLAIM_WINDOW_V1", "replacement claim-window marker is missing.");
need(departurePolicy, "EPL_REPLACEMENT_REMINDER_DAYS = 7", "replacement reminder must be scheduled after 7 days.");
need(departurePolicy, "EPL_REPLACEMENT_AUTO_MINT_DAYS = 14", "replacement auto-mint deadline must be 14 days.");
need(departurePolicy, "replacement-reminder:${claimId}", "replacement reminder notification is missing.");
need(departurePolicy, "now < autoMintMs", "replacement must remain manual before the 14-day deadline.");
need(departurePolicy, "Delayed EPL departure replacement failed", "overdue replacement auto-mint path is missing.");
assert.ok(!departurePolicy.includes("and lower(pr.rarity)='common'"), "delayed automatic replacement must not be limited to Common cards.");
need(cardsRoutes, "autoReplaceUnlockedDepartures", "collection reads must prepare/remind overdue departure claims.");
need(cardsRoutes, "DELAYED_EPL_DEPARTURE_REPLACEMENT_V1", "collection must preserve the 14-day replacement claim window.");
need(cardsRoutes, "same-position, same-rarity replacement", "collection eligibility text must not falsely claim a replacement already exists.");
need(cardsRoutes, "PROVIDER_CONFIRMED_DEPARTURE_REPLACEMENT_V1", "API-Football transfer-out evidence must be persisted before the collection returns an unavailable departed card.");
need(cardsRoutes, "providerDepartedPlayerIds", "provider-confirmed departures must create the same-request protected replacement claim.");
need(notificationRoutes, "autoReplaceUnlockedDepartures", "notification/background sync must process reminders and overdue replacement claims.");
need(notificationRoutes, "replacementAutoMintAt", "notification API must expose the automatic mint deadline.");
need(notificationRoutes, "replacement-reminder:", "notification API must link reminder notifications to their replacement claim.");
assert.ok(!notificationRoutes.includes("if (selected?.locked) return res.status(409)"), "manual replacement retry must not be blocked by an old tournament lock.");
assert.ok(!account.includes("Keep bought card"), "departed EPL replacement notifications must not offer a keep-ineligible-card path.");
need(departedArchive, "pr.replacement_card_id is not null", "source cards must not be archived before replacement_card_id exists.");
need(departedArchive, "Keep the source card owned until the replacement mint succeeds", "source-card archival must occur only after a successful replacement mint.");

need(economy, "PRIZE_LADDER_UNDER_MINIMUM_CASH_FALLBACK_V1", "under-minimum Prize Ladder settlement fallback is missing");
need(economy, "const underMinimumCashFallback = prizeVault && !prizeAward && grossPool > 0", "fallback is not restricted to an official Prize Ladder with no unlocked reward");
need(economy, "? toMoney(grossPool * 0.8)", "winner is not allocated 80% of collected entry fees");
need(economy, "? toMoney(grossPool * 0.2)", "Fantasy Arena is not allocated the 20% platform share");
need(economy, "if (underMinimumCashFallback) payoutPercentages = [1]", "fallback is not winner-takes-all");
need(economy, "cashPayoutEnabled", "fallback cash is not wired through payout and replay verification");
need(economy, "Prize Ladder minimum entry threshold was not reached", "winner notification does not explain the fallback");
need(economy, 'prizeVault,\n          underMinimumCashFallback,\n          sharedEntries,', "fallback status is not returned by settlement");
need(economy, '(N$${payout.toFixed(2)})', "fallback notification lost the Namibian-dollar symbol");
assert.equal((economy.match(/manualSettlement: forceManual,\n            underMinimumCashFallback,/g) || []).length, 1, "fallback settlement metadata must be inserted exactly once");
need(competitions, "PRIZE_LADDER_FALLBACK_DISCLOSURE_V1", "public tournament UI does not disclose the fallback");
need(competitions, "#1 receives 80%", "public tournament UI does not explain the 80/20 rule");

need(admin, "TOURNAMENT_BANK_RECONCILIATION_V1", "bank reconciliation contract is missing");
need(admin, "approvedDepositsGross", "admin finance does not reconcile approved external deposits");
need(admin, "paidWithdrawalsNet", "admin finance does not reconcile paid withdrawals");
need(admin, "walletLiability", "admin finance does not expose wallet liabilities");
need(admin, "minimumRequiredBankReserve", "admin finance does not calculate a minimum bank reserve");
need(admin, "reserveHeadroom", "admin finance does not show reserve headroom");
need(admin, "projectedWinnerCashFallback", "admin finance does not expose per-tournament fallback cash");
need(adminUi, "Bank &amp; reserve reconciliation", "admin UI does not show the bank reconciliation dashboard");
need(adminUi, "80% winner fallback", "admin UI does not identify under-minimum Prize Ladder fallback amounts");
need(adminUi, "Expected bank cash", "admin UI does not show expected bank cash");
need(adminUi, "Minimum reserve", "admin UI does not show required reserves");

need(packageJson, '"web-push"', "Web Push server dependency is missing");
need(packageJson, '"@capacitor/push-notifications"', "Capacitor native push plugin is missing");
need(notifications, "app.web_push_subscriptions", "Web Push subscription schema is missing");
need(notifications, "app.notification_push_deliveries", "durable push delivery queue is missing");
need(notifications, "app.native_push_subscriptions", "native Android push subscription schema is missing");
need(notifications, "app.notification_native_push_deliveries", "durable native push delivery queue is missing");
need(notifications, "on conflict (notification_id, subscription_id) do nothing", "push delivery queue is not idempotent");
need(notificationRoutes, 'app.post("/api/push/subscription"', "push subscription endpoint is missing");
need(notificationRoutes, 'app.delete("/api/push/subscription"', "push opt-out endpoint is missing");
need(notificationRoutes, 'app.post("/api/push/native-subscription"', "native Android subscription endpoint is missing");
need(notificationRoutes, 'app.delete("/api/push/native-subscription"', "native Android opt-out endpoint is missing");
need(notificationRoutes, "startWebPushDeliveryWorker();", "push delivery worker is not started");
need(notificationRoutes, "startNativePushDeliveryWorker();", "native push delivery worker is not started");
need(notificationRoutes, "startSubscribedNotificationSync();", "subscribed users do not receive scheduled gameweek notifications while the app is closed");
need(notificationRoutes, "15 * 60_000", "background gameweek notification sync interval is missing");
need(webPush, "webpush.generateVAPIDKeys()", "persistent automatic VAPID setup is missing");
need(webPush, "for update of delivery skip locked", "push delivery claims are not concurrency safe");
need(webPush, "statusCode === 404 || statusCode === 410", "expired push subscriptions are not retired");
need(nativePush, "https://www.googleapis.com/auth/firebase.messaging", "Firebase service-account authorization is missing");
need(nativePush, "https://fcm.googleapis.com/v1/projects/", "FCM HTTP v1 delivery is missing");
need(nativePush, "for update of delivery skip locked", "native push delivery claims are not concurrency safe");
need(nativePush, "UNREGISTERED|registration-token-not-registered", "expired FCM tokens are not retired");
need(pushControl, "Notification.requestPermission()", "installed app does not request notification permission from a user action");
need(pushControl, "registration.pushManager.subscribe", "installed app does not create a Web Push subscription");
need(pushControl, 'import("@capacitor/push-notifications")', "native Android app does not use the Capacitor push plugin");
need(pushControl, 'platform: "android"', "native Android token is not registered with the server");
need(pushControl, "isInstalledMobileApp()", "notification prompt is not restricted to installed app sessions");
need(serviceWorker, 'self.addEventListener("push"', "service worker does not display background notifications");
need(serviceWorker, 'self.addEventListener("notificationclick"', "service worker does not open the correct app screen from a notification");
need(capacitorConfig, "PushNotifications", "Capacitor foreground notification presentation is not configured");
need(androidWorkflow, "FIREBASE_ANDROID_GOOGLE_SERVICES_JSON_BASE64", "Android build cannot receive its Firebase client configuration securely");

console.log("EPL departure replacements verified: notification-first manual minting, 7-day reminder, 14-day automatic mint fallback, same rarity + same position, lock-safe source archival, installed PWA/native Android push, under-minimum Prize Ladder 80/20 fallback, and bank/reserve reconciliation are protected.");

// This verifier is the final shared mutating/checkpoint pass in every production
// build target after the large generated tournament/notification patch stack. Keep
// UI polish and self-test controls here so earlier source generators cannot erase
// them before Vite/TypeScript compilation.
await import("./apply-tournament-neon-rarity.mjs");
await import("./apply-notification-self-test.mjs");
await import("./verify-tournament-neon-rarity.mjs");
await import("./verify-notification-self-test.mjs");

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const need = (source, token, message) => assert.ok(source.includes(token), message);
const reject = (source, token, message) => assert.ok(!source.includes(token), message);

const realLoan = read("server/services/realLifeLoanMonitoring.ts");
const transferMonitoring = read("server/services/playerTransferMonitoring.ts");
const departed = read("server/services/departedCardPolicy.ts");
const notifications = read("server/routes/notifications.routes.ts");
const notificationService = read("server/services/notifications.ts");
const notificationClient = read("client/src/lib/notifications.ts");
const apiProGenerator = read("scripts/apply-api-football-pro-mode.mjs");
const accountGenerator = read("scripts/apply-player-transfer-notifications.mjs");
const nativeClub = read("client/src/components/native/NativeClubPage.tsx");
const pushControl = read("client/src/components/PushNotificationControl.tsx");
const serviceWorker = read("client/public/sw.js");
const floating = read("client/src/components/FloatingEventNotifications.tsx");
const platformLoan = read("server/services/loanDeparturePolicy.ts");
const webPush = read("server/services/webPush.ts");
const nativePush = read("server/services/nativePush.ts");

need(realLoan, "app.real_life_player_loans", "real-life player-loan persistence is missing");
need(realLoan, "app.api_football_transfers", "API-Football transfer evidence is not used");
need(realLoan, "isLoanType(transfer.transferType)", "real-life loan detection does not require a loan transfer type");
need(realLoan, "plTeams.has(fromTeamId) && !plTeams.has(toTeamId)", "real-life loan detection does not require PL-to-non-PL movement");
need(realLoan, 'evidenceSource: "api-football-transfer"', "API-Football is not the primary real-life loan evidence");
need(realLoan, "guardian_transfer_news+dual_roster_absence", "guarded transfer-news fallback is missing");
need(realLoan, "strongConfirmedLoanHeadline", "news fallback does not require a strong confirmed-loan headline");
need(realLoan, "const speculative =", "news fallback does not reject rumor/speculation wording");
need(realLoan, "if (evidence?.current) continue", "news fallback does not require current-roster absence");
need(realLoan, "status='loaned_out'", "real-life loan player state is not distinguished from permanent departure");
need(realLoan, "Keep until return", "owner notification is missing the keep-until-return choice");
need(realLoan, "same", "real-life loan notification/replacement copy is incomplete");
need(realLoan, "departure_kind='real_life_loan'", "real-life loan claims are not typed separately");
need(realLoan, "If you mint a replacement, the original card is permanently retired", "replacement permanence is not explained");
need(realLoan, "REAL_LIFE_LOAN_NOTIFICATION_STABILITY_V1", "real-life loan notification stability marker is missing");
need(realLoan, "decision=case when departure_kind='real_life_loan' then decision else 'pending' end", "Keep-until-return choice is reset on every sync");
need(realLoan, "update app.notifications", "real-life loan notification content is not refreshed in place");
need(realLoan, "if (createdNotification?.id) claims += 1", "real-life loan sync does not distinguish a newly created notification from an existing one");
reject(realLoan, "delete from app.notifications\n      where user_id=", "real-life loan sync must never delete and recreate the replacement notification");
need(realLoan, "You chose to keep", "keep-until-return persistence is missing");
need(realLoan, "returned to the Premier League", "return-to-PL reactivation handling is missing");
need(realLoan, "until a newer transfer explicitly brings", "API-backed loans can be ended by lagging roster data");
need(realLoan, "transfer_date >", "API-backed loan return does not require newer transfer evidence");

need(departed, "coalesce(pr.departure_kind,'permanent') <> 'real_life_loan'", "14-day permanent-departure auto-mint still includes real-life loans");
need(departed, "lower(coalesce(p.status,'')) <> 'loaned_out'", "generic permanent-departure claim creation still includes loaned-out players");
need(departed, "realLifeLoanToTeam", "replacement claim decoration does not expose real-life loan metadata");

need(notifications, "syncRealLifePlayerLoanChoices(userId)", "opening Inbox does not refresh real-life loan evidence");
need(notifications, "replacementDepartureKind", "Inbox API does not expose real-life loan claim type");
need(notifications, 'app.post("/api/player-replacements/:id/keep"', "keep-until-return endpoint is missing");
need(notifications, "assertRealLifeLoanReplacementAllowed", "replacement mint does not respect a prior keep decision");

need(transferMonitoring, "latestApiFootballTransferIsLoanOut", "permanent departure processing does not guard against API-Football real-life loans");
need(transferMonitoring, "if (await latestApiFootballTransferIsLoanOut(playerName)) continue", "real-life loans can still enter permanent-departure claims");
need(transferMonitoring, 'departure_kind as "departureKind"', "replacement claims do not expose departure kind");
need(transferMonitoring, "Replacement is deferred until that platform loan ends", "platform-borrowed cards are not safely deferred");

need(apiProGenerator, 'syncRealLifePlayerLoanChoices } from "./realLifeLoanMonitoring.js"', "API-Football transfer generator does not import real-life loan sync");
need(apiProGenerator, "const realLifeLoanSync = await syncRealLifePlayerLoanChoices()", "API-Football transfer sync does not trigger real-life loan processing");

need(accountGenerator, "Real-life loan decision", "full Inbox generator is missing the real-life loan choice panel");
need(accountGenerator, "keepRealLifeLoanMutation", "full Inbox generator is missing Keep-until-return action");
need(accountGenerator, "No 14-day auto-mint", "full Inbox incorrectly suggests real-life loans auto-mint");
need(nativeClub, "Real-life loan decision", "native Inbox is missing the real-life loan choice panel");
need(nativeClub, "keepRealLifeLoanMutation", "native Inbox is missing Keep-until-return action");
need(nativeClub, "If you replace, the original card is retired permanently", "native Inbox does not explain permanent replacement");

need(floating, "Choose card option", "floating alert does not distinguish real-life loan choice");
need(webPush, 'key.startsWith("replacement-claim:")', "web push does not route real-life loan claim notifications to Inbox");
need(nativePush, 'key.startsWith("replacement-claim:")', "native push does not route real-life loan claim notifications to Inbox");
need(webPush, '/account?tab=inbox&notification=', "web replacement push does not deep-link to the exact Inbox message");
need(nativePush, '/account?tab=inbox&notification=', "native replacement push does not deep-link to the exact Inbox message");
need(notificationClient, '/account?tab=inbox&notification=', "in-app replacement alerts do not deep-link to the exact Inbox message");
need(pushControl, "actionableNotificationPath", "native Android click handler cannot upgrade older Inbox-only push links");
need(pushControl, "notification?.data?.notificationId", "native Android click handler does not recover the stored notification ID");
need(serviceWorker, "actionableNotificationPath", "PWA click handler cannot upgrade older Inbox-only push links");
need(serviceWorker, "event.notification?.data?.notificationId", "PWA click handler does not recover the stored notification ID");
need(notificationService, "native_subscription.disabled_at is null", "push creation does not prefer native Android delivery when the native app is registered");
need(notificationService, "lower(coalesce(mobile_subscription.user_agent,'')) like '%android%'", "push creation does not identify Android web subscriptions for duplicate suppression");
need(notificationService, "order by mobile_subscription.updated_at desc", "multiple stale Android web subscriptions are not collapsed to the most recent subscription");

need(platformLoan, "PLATFORM_LOAN_DEPARTURE_POLICY_DISABLED_V1", "Fantasy Arena marketplace loans can still trigger the wrong real-life loan workflow");
need(platformLoan, "Fantasy Arena marketplace loans do not use the real-life football loan replacement rule.", "old platform-loan choice endpoint is not disabled");

reject(accountGenerator, "Mint temporary replacement", "full Inbox still exposes the old platform-loan temporary replacement action");
reject(nativeClub, "Temporary loan replacement added", "native Inbox still exposes the old platform-loan temporary replacement result");
reject(floating, "Choose loan option", "floating alerts still expose the old platform-loan action");

console.log("Real-life player-loan policy verified: API-Football PL-to-non-PL loan transfers are primary evidence, owners may keep until return or replace, replacement pushes open the exact actionable Inbox item, and native Android delivery suppresses duplicate mobile-web pushes.");

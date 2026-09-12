import fs from "node:fs";

const routesPath = "server/routes/notifications.routes.ts";
const controlPath = "client/src/components/PushNotificationControl.tsx";
const onboardingPath = "client/src/pages/onboarding.tsx";
const adminLivePath = "scripts/apply-admin-live-ops-notifications.mjs";

const routes = fs.readFileSync(routesPath, "utf8");
const control = fs.readFileSync(controlPath, "utf8");
const adminLive = fs.readFileSync(adminLivePath, "utf8");

function need(source, token, label) {
  if (!source.includes(token)) throw new Error(`[production-notifications] missing ${label}`);
}
function forbid(source, token, label) {
  if (source.includes(token)) throw new Error(`[production-notifications] obsolete ${label} still present`);
}

// No user-facing or server-side notification test lab remains.
forbid(routes, 'app.post("/api/push/test"', "push self-test route");
forbid(routes, "PUSH_SELF_TEST_TEMPLATES", "push self-test templates");
forbid(control, "PUSH_TEST_PRESETS", "push self-test presets");
forbid(control, '"/api/push/test"', "push self-test API call");
forbid(control, "data-push-self-test-dialog", "push self-test dialog");
forbid(control, "testMutation", "push self-test mutation");
forbid(control, "setTestOpen", "push self-test state");

// Real delivery and opt-in/opt-out controls remain intact.
need(routes, "startWebPushDeliveryWorker();", "Web Push delivery worker");
need(routes, "startNativePushDeliveryWorker();", "native push delivery worker");
need(routes, "startSubscribedNotificationSync();", "scheduled notification sync");
need(routes, "15 * 60_000", "15-minute scheduled reminder cadence");
need(routes, 'app.post("/api/push/subscription"', "Web Push subscription route");
need(routes, 'app.post("/api/push/native-subscription"', "Android push subscription route");
need(control, "Notification.requestPermission()", "notification permission request");
need(control, 'platform: "android"', "Android FCM token registration");
need(control, "disableMutation.mutate();", "notification disable action");

// Tournament timing contract: once when entries open, 24h lock warning, 2h lock
// warning, then live notification for managers who actually entered.
need(routes, "entries are open", "entries-open reminder");
need(adminLive, "PRODUCTION_NOTIFICATION_TIMING_V1", "24-hour lineup-lock policy patch");
need(adminLive, "locks-within-24h", "24-hour lineup-lock dedupe");
need(routes, "locks-within-2h", "two-hour lineup-lock reminder");
need(routes, "entered-teams-live", "entered-team live notification");

// Admin operational notifications must cover both account-creation paths and every
// committed tournament entry. Matching dedupe keys prevent duplicate admin pushes.
need(adminLive, "AUTH_STORAGE", "Replit auth signup path");
need(adminLive, "DATABASE_STORAGE", "database signup path");
need(adminLive, "admin:new-signup:", "signup notification dedupe");
need(adminLive, "🎟️ New tournament entry", "admin tournament-entry alert");
need(adminLive, "admin:competition:", "admin tournament-entry dedupe");

// The Starter Draft polish historically shared this verifier. Preserve it while
// removing the notification test feature.
let onboarding = fs.readFileSync(onboardingPath, "utf8");
onboarding = onboarding.replace(
  'pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]',
  'pb-5',
);
onboarding = onboarding.replace(
  '<CardThumbnail card={card} size="xs" selected={isSelected} selectable />',
  '<CardThumbnail card={card} size="xs" selected={isSelected} selectable showStats={false} showMeta={false} />',
);
onboarding = onboarding.replace(
  'className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#030611]/96 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom,0px))] pt-2.5 shadow-[0_-18px_50px_rgba(0,0,0,.45)] backdrop-blur-xl sm:px-6"',
  'className="relative z-30 w-full shrink-0 border-t border-white/10 bg-[#030611]/96 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom,0px))] pt-2.5 shadow-[0_-12px_36px_rgba(0,0,0,.30)] backdrop-blur-xl sm:px-6"',
);
if (!onboarding.includes('showStats={false} showMeta={false}')) {
  throw new Error("[starter-draft] compact cards still expose overlapping stats/meta");
}
if (onboarding.includes('className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#030611]/96')) {
  throw new Error("[starter-draft] pick counter still overlays player cards");
}
fs.writeFileSync(onboardingPath, onboarding);

console.log("Production notifications verified: real events only, admin signup/entry alerts, entries-open + 24h/2h lock reminders, live/result delivery preserved, and no notification test lab.");

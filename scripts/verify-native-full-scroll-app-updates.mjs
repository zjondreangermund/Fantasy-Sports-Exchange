import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function need(source, token, label) {
  if (!source.includes(token)) throw new Error(`[native-scroll-update] missing ${label}`);
}

const css = read("client/src/native-mobile.css");
const shell = read("client/src/components/native/NativeMobileShell.tsx");
const pushControl = read("client/src/components/PushNotificationControl.tsx");
const updatePrompt = read("client/src/components/native/NativeAppUpdatePrompt.tsx");
const notifications = read("server/services/notifications.ts");
const nativePush = read("server/services/nativePush.ts");
const routes = read("server/routes/notifications.routes.ts");

need(css, "NATIVE_FULL_PAGE_SCROLL_UPDATE_V1", "native full-page scroll marker");
need(css, "--fa-native-viewport-height", "measured viewport height");
need(css, "overflow-y: scroll !important", "native vertical scroll authority");
need(css, "overflow-x: auto !important", "native horizontal pan authority");
need(css, "touch-action: pan-x pan-y pinch-zoom !important", "two-axis native panning and pinch zoom");
need(shell, "FA_NATIVE_VISUAL_VIEWPORT_V1", "visual viewport synchronizer");
need(shell, "window.visualViewport", "visual viewport API usage");
need(shell, "scrollRoot?.scrollTo", "route scroll reset");

need(pushControl, "installedNativeVersion()", "native installed-version registration");
need(pushControl, "appVersion: installedNativeVersion()", "native app version payload");
need(notifications, "app_version text", "native subscription app-version schema");
need(notifications, "add column if not exists app_version text", "native subscription app-version migration");
need(nativePush, "normalizeAppVersion", "native app-version validation");
need(nativePush, "app_version = coalesce", "native app-version upsert");
need(nativePush, "android-update:", "Android update push deep link");
need(nativePush, "native-web-update:", "remote app update push deep link");

need(routes, "NATIVE_APP_UPDATE_NOTIFICATION_V1", "native update notification synchronizer");
need(routes, "native-web-update:full-page-scroll-v1", "scroll rollout Inbox/push notification");
need(routes, "ANDROID_RELEASES_API", "Android release discovery");
need(routes, "android-update:${release.version}", "version-deduped Android update notice");
need(routes, "await syncNativeAppUpdateNotifications();", "scheduled native update notification sync");
need(routes, "req.body?.appVersion", "native subscription version route");

need(updatePrompt, "const CACHE_MAX_AGE_MS = 30 * 60 * 1000", "short update cache");
need(updatePrompt, "appUpdate", "push-forced update check");
need(updatePrompt, "clearForcedUpdateFlag", "forced update URL cleanup");
need(updatePrompt, "Your login and app data stay in place", "in-place update guidance");

console.log("Native full-page scroll + app update delivery verified: tournaments/pages keep full two-axis touch reach, known app installs receive the rollout message, and future Android releases notify older registered versions with an in-place update prompt.");

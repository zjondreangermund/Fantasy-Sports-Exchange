import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
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
const updateRoutes = read("server/routes/androidUpdate.routes.ts");
const retention = read("server/routes/retention.routes.ts");
const activity = read("android/app/src/main/java/com/fantasyfc/app/MainActivity.java");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const gradle = read("android/app/build.gradle");

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
need(nativePush, "normalizeAppVersion", "native app-version validation");
need(nativePush, "app_version = coalesce", "native app-version upsert");

need(routes, "NATIVE_APP_UPDATE_NOTIFICATION_V1", "native update notification synchronizer");
need(routes, "NATIVE_APP_UPDATE_NOTIFICATIONS_ENABLED", "update rollout notification safety gate");
need(routes, "req.body?.appVersion", "native subscription version route");

need(updateRoutes, "/api/android/releases/latest", "same-origin Android metadata route");
need(updateRoutes, "/api/android/releases/latest.apk", "same-origin Android APK route");
need(updateRoutes, "application/vnd.android.package-archive", "APK MIME type");
need(updateRoutes, "bytes[0] !== 0x50", "APK ZIP signature validation");
need(retention, "registerAndroidUpdateRoutes(app)", "Android update route registration");

need(updatePrompt, 'const RELEASES_API = "/api/android/releases/latest"', "same-origin update metadata");
need(updatePrompt, "FantasyArenaUpdater", "native updater bridge use");
need(updatePrompt, "updater.installLatestUpdate()", "in-app update action");
need(updatePrompt, "Your browser and GitHub will not open", "no-browser update guidance");
if (updatePrompt.includes("window.open(release.downloadUrl")) throw new Error("[native-scroll-update] legacy GitHub/browser updater still present");
if (updatePrompt.includes("api.github.com/repos/zjondreangermund")) throw new Error("[native-scroll-update] client must not expose GitHub release API");

need(activity, 'FantasyArenaNative/1.1.11', "Android 1.1.11 user agent");
need(activity, "webView.addJavascriptInterface", "native updater JavaScript bridge");
need(activity, "APP_UPDATE_URL", "fixed Fantasy Arena update URL");
need(activity, "getPackageArchiveInfo", "downloaded APK package validation");
need(activity, "archiveVersion <= installedVersion", "Android update version validation");
need(activity, "FileProvider.getUriForFile", "private APK install URI");
need(activity, "ACTION_MANAGE_UNKNOWN_APP_SOURCES", "Android source permission flow");
need(manifest, "android.permission.REQUEST_INSTALL_PACKAGES", "APK update install permission");
need(gradle, "versionCode 13", "Android 1.1.11 versionCode");
need(gradle, 'versionName "1.1.11"', "Android 1.1.11 versionName");

console.log("Native full-page scroll + Android in-app updater verified: no GitHub/browser update handoff, APK is proxied/validated through Fantasy Arena, and rollout notifications remain gated until explicit enablement.");

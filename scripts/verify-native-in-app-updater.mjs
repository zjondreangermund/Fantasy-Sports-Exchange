import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const prompt = read("client/src/components/native/NativeAppUpdatePrompt.tsx");
const route = read("server/routes/androidUpdate.routes.ts");
const retention = read("server/routes/retention.routes.ts");
const notifications = read("server/routes/notifications.routes.ts");
const mainActivity = read("android/app/src/main/java/com/fantasyfc/app/MainActivity.java");
const plugin = read("android/app/src/main/java/com/fantasyfc/app/FantasyArenaUpdaterPlugin.java");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const gradle = read("android/app/build.gradle");
const workflow = read(".github/workflows/android-app-build.yml");

const failures = [];
const need = (source, token, label) => { if (!source.includes(token)) failures.push(`${label}: missing ${token}`); };
const reject = (source, token, label) => { if (source.includes(token)) failures.push(`${label}: still contains ${token}`); };

need(prompt, 'const RELEASES_API = "/api/android/update"', "client update metadata");
need(prompt, 'registerPlugin<FantasyArenaUpdaterPlugin>("FantasyArenaUpdater")', "native updater bridge");
need(prompt, "FIRST_NATIVE_UPDATER_VERSION = \"1.1.11\"", "native updater minimum version");
need(prompt, "FantasyArenaUpdater.installUpdate", "in-app update invocation");
need(prompt, "playfantasyarena.com, not GitHub", "legacy bridge guidance");
need(prompt, "Your login and app data stay in place", "in-place update guidance");
reject(prompt, "api.github.com/repos/zjondreangermund", "client must not expose GitHub release API");

need(route, 'PUBLIC_APK_ROUTE = "https://playfantasyarena.com/api/android/update/apk"', "first-party APK URL");
need(route, 'Content-Type", "application/vnd.android.package-archive', "APK MIME");
need(route, "Downloaded Android package is not a valid APK archive", "APK magic validation");
need(route, 'createHash("sha256")', "server SHA-256 validation");
need(route, "Android APK integrity verification failed", "server integrity rejection");

need(retention, 'registerAndroidUpdateRoutes', "Android update route registration");
need(notifications, "NATIVE_UPDATE_NOTIFICATIONS_GATED_V1", "notification safety gate");
need(notifications, 'NATIVE_UPDATE_NOTIFICATIONS_ENABLED !== "true"', "notification opt-in environment gate");
need(notifications, "android-update:1.1.10", "premature update cleanup");

need(mainActivity, 'FantasyArenaNative/1.1.11', "native app version UA");
need(mainActivity, 'registerPlugin(FantasyArenaUpdaterPlugin.class)', "native plugin registration");
need(plugin, '@CapacitorPlugin(name = "FantasyArenaUpdater")', "Capacitor updater plugin");
need(plugin, 'https://playfantasyarena.com/api/android/update/apk', "trusted branded update URL");
need(plugin, 'MessageDigest.getInstance("SHA-256")', "client SHA-256 validation");
need(plugin, 'FileProvider.getUriForFile', "Android package handoff");
need(plugin, 'ACTION_MANAGE_UNKNOWN_APP_SOURCES', "Android install permission handoff");
need(manifest, 'android.permission.REQUEST_INSTALL_PACKAGES', "install permission declaration");
need(gradle, 'versionCode 13', "Android version code");
need(gradle, 'versionName "1.1.11"', "Android version name");
need(workflow, 'Build Fantasy Arena Android 1.1.11', "Android workflow version");
need(workflow, 'versionCode=\'13\'', "workflow APK version-code verification");
need(workflow, 'versionName=\'1.1.11\'', "workflow APK version-name verification");
need(workflow, 'first-party in-app updater through playfantasyarena.com', "release notes");

if (failures.length) {
  console.error("Native in-app updater verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Native in-app updater verified: branded first-party download/proxy, SHA-256 checks, Android in-place installer handoff, 1.1.11 release wiring, and update notifications held until explicitly enabled.");

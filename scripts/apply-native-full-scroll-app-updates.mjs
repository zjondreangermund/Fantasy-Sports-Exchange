import fs from "node:fs";

const MARKER = "NATIVE_FULL_PAGE_SCROLL_UPDATE_V1";
const CSS = "client/src/native-mobile.css";
const SHELL = "client/src/components/native/NativeMobileShell.tsx";
const PUSH_CONTROL = "client/src/components/PushNotificationControl.tsx";
const UPDATE_PROMPT = "client/src/components/native/NativeAppUpdatePrompt.tsx";
const NOTIFICATIONS = "server/services/notifications.ts";
const NATIVE_PUSH = "server/services/nativePush.ts";
const ROUTES = "server/routes/notifications.routes.ts";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`[native-scroll-update] patched ${file}`);
  } else {
    console.log(`[native-scroll-update] ${file} already ready`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[native-scroll-update] missing anchor: ${label}`);
  return source.replace(from, to);
}

patchFile(CSS, (source) => {
  if (source.includes(MARKER)) return source;
  return `${source.trimEnd()}\n\n/* ${MARKER}\n * The installed Android shell owns one real scroll viewport. Some WebViews\n * report 100dvh differently around Samsung navigation/system bars, so React\n * supplies the measured visual viewport height and CSS keeps a 100vh fallback.\n * Both axes remain pannable and pinch zoom remains available; the bottom dock\n * stays in the flex layout so the final tournament/card can always be reached. */\n[data-native-mobile-shell] {\n  height: var(--fa-native-viewport-height, 100vh) !important;\n  min-height: 0 !important;\n  max-height: var(--fa-native-viewport-height, 100vh) !important;\n  overflow: hidden !important;\n}\n\n@supports (height: 100dvh) {\n  [data-native-mobile-shell] {\n    height: var(--fa-native-viewport-height, 100dvh) !important;\n    max-height: var(--fa-native-viewport-height, 100dvh) !important;\n  }\n}\n\n[data-native-mobile-shell] main[data-app-scroll-root] {\n  flex: 1 1 0% !important;\n  height: 0 !important;\n  min-height: 0 !important;\n  max-height: none !important;\n  overflow-x: auto !important;\n  overflow-y: scroll !important;\n  overscroll-behavior: auto !important;\n  touch-action: pan-x pan-y pinch-zoom !important;\n  -webkit-overflow-scrolling: touch !important;\n  scroll-padding-bottom: max(2.75rem, env(safe-area-inset-bottom, 0px)) !important;\n  padding-bottom: max(1.5rem, env(safe-area-inset-bottom, 0px)) !important;\n}\n\n[data-native-mobile-shell] [data-page-scroll-content],\n[data-native-mobile-shell] [data-page-scroll-content] > :where(main, section, article, div) {\n  touch-action: pan-x pan-y pinch-zoom !important;\n}\n\n[data-native-mobile-shell] [data-native-home-v2],\n[data-native-mobile-shell] [data-native-play],\n[data-native-mobile-shell] [data-native-squad],\n[data-native-mobile-shell] [data-native-cards],\n[data-native-mobile-shell] [data-native-market],\n[data-native-mobile-shell] [data-native-vault],\n[data-native-mobile-shell] [data-native-wallet],\n[data-native-mobile-shell] [data-native-premier-league],\n[data-native-mobile-shell] [data-native-club] {\n  padding-bottom: max(2rem, env(safe-area-inset-bottom, 0px)) !important;\n}\n\n[data-native-mobile-shell] [role=\"dialog\"][class*=\"fixed\"][class*=\"inset-0\"] > section,\n[data-native-mobile-shell] [data-native-market] > [class*=\"fixed\"][class*=\"inset-0\"] > section {\n  max-height: calc(var(--fa-native-viewport-height, 100dvh) - env(safe-area-inset-top, 0px)) !important;\n  touch-action: pan-x pan-y pinch-zoom !important;\n}\n`;
});

patchFile(SHELL, (source) => {
  if (source.includes("FA_NATIVE_VISUAL_VIEWPORT_V1")) return source;
  const anchor = `  React.useEffect(() => {\n    setMoreOpen(false);\n  }, [location]);`;
  const replacement = `  // FA_NATIVE_VISUAL_VIEWPORT_V1\n  // Use the actual visible WebView height instead of trusting a device's dvh\n  // implementation. This prevents the bottom of long tournament pages being\n  // clipped behind Android/Samsung system UI on affected phones.\n  React.useEffect(() => {\n    const root = document.documentElement;\n    const visualViewport = window.visualViewport;\n    const syncViewportHeight = () => {\n      const measured = Math.round(visualViewport?.height || window.innerHeight || 0);\n      if (measured > 0) root.style.setProperty("--fa-native-viewport-height", \`\${Math.max(320, measured)}px\`);\n    };\n    syncViewportHeight();\n    window.addEventListener("resize", syncViewportHeight);\n    window.addEventListener("orientationchange", syncViewportHeight);\n    visualViewport?.addEventListener("resize", syncViewportHeight);\n    return () => {\n      window.removeEventListener("resize", syncViewportHeight);\n      window.removeEventListener("orientationchange", syncViewportHeight);\n      visualViewport?.removeEventListener("resize", syncViewportHeight);\n      root.style.removeProperty("--fa-native-viewport-height");\n    };\n  }, []);\n\n  React.useEffect(() => {\n    setMoreOpen(false);\n    const scrollRoot = document.querySelector<HTMLElement>("[data-native-mobile-shell] [data-app-scroll-root]");\n    scrollRoot?.scrollTo({ top: 0, left: 0, behavior: "auto" });\n  }, [location]);`;
  return replaceRequired(source, anchor, replacement, "native visual viewport effect");
});

patchFile(PUSH_CONTROL, (source) => {
  let next = source;
  if (!next.includes("function installedNativeVersion()")) {
    next = replaceRequired(
      next,
      `function isNativeAndroidApp() {\n  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";\n}`,
      `function isNativeAndroidApp() {\n  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";\n}\n\nfunction installedNativeVersion() {\n  if (typeof navigator === "undefined") return null;\n  return String(navigator.userAgent || "").match(/FantasyArenaNative\\/(\\d+\\.\\d+\\.\\d+)/i)?.[1] || null;\n}`,
      "native version helper",
    );
  }
  next = next.replaceAll(
    `apiRequest("POST", "/api/push/native-subscription", { token, platform: "android" })`,
    `apiRequest("POST", "/api/push/native-subscription", { token, platform: "android", appVersion: installedNativeVersion() })`,
  );
  return next;
});

patchFile(NOTIFICATIONS, (source) => {
  let next = source;
  if (!next.includes("app_version text")) {
    next = replaceRequired(
      next,
      `          platform text not null,\n          failure_count integer not null default 0,`,
      `          platform text not null,\n          app_version text,\n          failure_count integer not null default 0,`,
      "native subscription app_version create column",
    );
  }
  if (!next.includes("add column if not exists app_version text")) {
    next = replaceRequired(
      next,
      `      await db.execute(sql\`create index if not exists native_push_subscriptions_user_idx on app.native_push_subscriptions (user_id, disabled_at)\`);`,
      `      await db.execute(sql\`alter table if exists app.native_push_subscriptions add column if not exists app_version text\`);\n      await db.execute(sql\`create index if not exists native_push_subscriptions_user_idx on app.native_push_subscriptions (user_id, disabled_at)\`);`,
      "native subscription app_version migration",
    );
  }
  return next;
});

patchFile(NATIVE_PUSH, (source) => {
  let next = source;
  if (!next.includes("function normalizeAppVersion")) {
    next = replaceRequired(
      next,
      `function normalizeToken(value: unknown): string {\n  const token = String(value || "").trim();\n  if (token.length < 20 || token.length > 4096 || /\\s/.test(token)) {\n    throw new Error("A valid native push token is required");\n  }\n  return token;\n}`,
      `function normalizeToken(value: unknown): string {\n  const token = String(value || "").trim();\n  if (token.length < 20 || token.length > 4096 || /\\s/.test(token)) {\n    throw new Error("A valid native push token is required");\n  }\n  return token;\n}\n\nfunction normalizeAppVersion(value: unknown): string | null {\n  const version = String(value || "").trim();\n  return /^\\d+\\.\\d+\\.\\d+$/.test(version) ? version : null;\n}`,
      "native app version normalizer",
    );
  }
  next = replaceRequired(
    next,
    `export async function upsertNativePushSubscription(userId: string, tokenValue: unknown, platformValue: unknown) {\n  await ensureNotificationsSchema();\n  const token = normalizeToken(tokenValue);\n  const platform = String(platformValue || "").trim().toLowerCase();`,
    `export async function upsertNativePushSubscription(userId: string, tokenValue: unknown, platformValue: unknown, appVersionValue?: unknown) {\n  await ensureNotificationsSchema();\n  const token = normalizeToken(tokenValue);\n  const platform = String(platformValue || "").trim().toLowerCase();\n  const appVersion = normalizeAppVersion(appVersionValue);`,
    "native subscription function signature",
  );
  next = replaceRequired(
    next,
    `      user_id, token, platform, failure_count, disabled_at, created_at, updated_at\n    ) values (\n      \${userId}, \${token}, \${platform}, 0, null, now(), now()`,
    `      user_id, token, platform, app_version, failure_count, disabled_at, created_at, updated_at\n    ) values (\n      \${userId}, \${token}, \${platform}, \${appVersion}, 0, null, now(), now()`,
    "native subscription app version insert",
  );
  next = replaceRequired(
    next,
    `      platform = excluded.platform,\n      failure_count = 0,`,
    `      platform = excluded.platform,\n      app_version = coalesce(excluded.app_version, native_push_subscriptions.app_version),\n      failure_count = 0,`,
    "native subscription app version upsert",
  );
  if (!next.includes(`if (key.startsWith("android-update:"))`)) {
    next = replaceRequired(
      next,
      `  if (key.startsWith("community-mention:")) return "/community";`,
      `  if (key.startsWith("community-mention:")) return "/community";\n  if (key.startsWith("android-update:")) return "/dashboard?appUpdate=1";\n  if (key.startsWith("native-web-update:")) return "/competitions";`,
      "native app update push deep links",
    );
  }
  return next;
});

patchFile(ROUTES, (source) => {
  let next = source.replace(
    `upsertNativePushSubscription(userId, req.body?.token, req.body?.platform)`,
    `upsertNativePushSubscription(userId, req.body?.token, req.body?.platform, req.body?.appVersion)`,
  );

  if (!next.includes("NATIVE_APP_UPDATE_NOTIFICATION_V1")) {
    const helperAnchor = `let subscribedNotificationSyncTimer: NodeJS.Timeout | null = null;`;
    const helper = `// NATIVE_APP_UPDATE_NOTIFICATION_V1\nconst ANDROID_RELEASES_API = "https://api.github.com/repos/zjondreangermund/Fantasy-Sports-Exchange/releases?per_page=20";\nconst NATIVE_SCROLL_ROLLOUT_KEY = "native-web-update:full-page-scroll-v1";\nlet androidReleaseCache: { checkedAt: number; release: { version: string } | null } | null = null;\n\nfunction parseNativeVersion(value: unknown): number[] | null {\n  const match = String(value || "").match(/^(\\d+)\\.(\\d+)\\.(\\d+)$/);\n  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;\n}\n\nfunction compareNativeVersions(left: string, right: string) {\n  const a = parseNativeVersion(left);\n  const b = parseNativeVersion(right);\n  if (!a || !b) return 0;\n  for (let index = 0; index < 3; index += 1) {\n    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;\n  }\n  return 0;\n}\n\nasync function latestAndroidRelease(): Promise<{ version: string } | null> {\n  if (androidReleaseCache && Date.now() - androidReleaseCache.checkedAt < 30 * 60_000) return androidReleaseCache.release;\n  try {\n    const response = await fetch(ANDROID_RELEASES_API, {\n      headers: { Accept: "application/vnd.github+json", "User-Agent": "Fantasy-Arena-Server" },\n      signal: AbortSignal.timeout(6_000),\n    });\n    if (!response.ok) throw new Error(\`GitHub releases returned \${response.status}\`);\n    const releases: any[] = await response.json();\n    const candidates = (Array.isArray(releases) ? releases : [])\n      .filter((release) => !release?.draft && !release?.prerelease)\n      .map((release) => {\n        const version = String(release?.tag_name || "").match(/^android-(\\d+\\.\\d+\\.\\d+)$/i)?.[1];\n        const hasApk = Array.isArray(release?.assets) && release.assets.some((asset: any) => String(asset?.name || "").toLowerCase() === "fantasy-arena-android.apk");\n        return version && hasApk ? { version } : null;\n      })\n      .filter(Boolean) as Array<{ version: string }>;\n    candidates.sort((a, b) => compareNativeVersions(b.version, a.version));\n    const release = candidates[0] || null;\n    androidReleaseCache = { checkedAt: Date.now(), release };\n    return release;\n  } catch (error) {\n    console.error("Android release notification check failed:", error);\n    androidReleaseCache = { checkedAt: Date.now(), release: null };\n    return null;\n  }\n}\n\nasync function syncNativeAppUpdateNotifications() {\n  await ensureNotificationsSchema();\n  const rows = rowsOf(await db.execute(sql\`\n    select user_id as "userId",\n           array_remove(array_agg(distinct app_version), null) as versions\n    from app.native_push_subscriptions\n    group by user_id\n    order by user_id\n    limit 5000\n  \`));\n  if (!rows.length) return;\n\n  let rolloutCreated = 0;\n  for (const row of rows) {\n    const userId = String(row.userId || "");\n    if (!userId) continue;\n    const notification = await createNotificationOnce(db, {\n      userId,\n      title: "Fantasy Arena updated",\n      message: "Full-page scrolling and panning have been improved, including Tournaments. Close and reopen Fantasy Arena to load the update. No reinstall is needed.",\n      dedupeKey: NATIVE_SCROLL_ROLLOUT_KEY,\n    });\n    if (notification?.id) rolloutCreated += 1;\n  }\n\n  const release = await latestAndroidRelease();\n  let binaryCreated = 0;\n  if (release) {\n    for (const row of rows) {\n      const userId = String(row.userId || "");\n      const versions = Array.isArray(row.versions) ? row.versions.map(String).filter((value: string) => parseNativeVersion(value)) : [];\n      if (!userId || !versions.length) continue;\n      if (!versions.some((version: string) => compareNativeVersions(version, release.version) < 0)) continue;\n      const notification = await createNotificationOnce(db, {\n        userId,\n        title: \`Fantasy Arena \${release.version} update available\`,\n        message: "A newer signed Android app is ready. Open Fantasy Arena and tap Update Fantasy Arena. It installs over your current app—no uninstall, sign-up or data reset.",\n        dedupeKey: \`android-update:\${release.version}\`,\n      });\n      if (notification?.id) binaryCreated += 1;\n    }\n  }\n\n  if (rolloutCreated || binaryCreated) {\n    console.log(\`[native-update] queued rollout=\${rolloutCreated} android=\${binaryCreated} latest=\${release?.version || "none"}\`);\n  }\n}\n\n${helperAnchor}`;
    next = replaceRequired(next, helperAnchor, helper, "native update notification helper");
  }

  if (!next.includes("await syncNativeAppUpdateNotifications();")) {
    next = replaceRequired(
      next,
      `    await processPendingWebPushDeliveries();\n    await processPendingNativePushDeliveries();`,
      `    await syncNativeAppUpdateNotifications();\n    await processPendingWebPushDeliveries();\n    await processPendingNativePushDeliveries();`,
      "native update notification sync",
    );
  }
  return next;
});

patchFile(UPDATE_PROMPT, (source) => {
  let next = source;
  next = next.replace(`const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;`, `const CACHE_MAX_AGE_MS = 30 * 60 * 1000;`);
  if (!next.includes("function clearForcedUpdateFlag")) {
    next = replaceRequired(
      next,
      `function writeCache(value: CachedUpdate) {\n  try {\n    localStorage.setItem(CACHE_KEY, JSON.stringify(value));\n  } catch {\n    // Update checks are best-effort and must never block the app.\n  }\n}`,
      `function writeCache(value: CachedUpdate) {\n  try {\n    localStorage.setItem(CACHE_KEY, JSON.stringify(value));\n  } catch {\n    // Update checks are best-effort and must never block the app.\n  }\n}\n\nfunction clearForcedUpdateFlag() {\n  try {\n    const url = new URL(window.location.href);\n    if (!url.searchParams.has("appUpdate")) return;\n    url.searchParams.delete("appUpdate");\n    window.history.replaceState(window.history.state, "", \`\${url.pathname}\${url.search}\${url.hash}\`);\n  } catch {\n    // The update prompt still works if history access is restricted.\n  }\n}`,
      "forced update flag helper",
    );
  }
  next = replaceRequired(
    next,
    `    if (!currentVersion) return;\n    const cached = readCache(currentVersion);\n    if (cached) {`,
    `    if (!currentVersion) return;\n    const forceCheck = new URLSearchParams(window.location.search).get("appUpdate") === "1";\n    const cached = forceCheck ? null : readCache(currentVersion);\n    if (cached) {`,
    "forced update cache bypass",
  );
  next = next.replace(`    }, 1200);`, `    }, forceCheck ? 50 : 1200);`);
  next = replaceRequired(
    next,
    `        writeCache({ checkedAt: Date.now(), currentVersion, release: nextRelease });\n        setRelease(nextRelease);`,
    `        writeCache({ checkedAt: Date.now(), currentVersion, release: nextRelease });\n        setRelease(nextRelease);\n        if (forceCheck) clearForcedUpdateFlag();`,
    "forced update flag clear",
  );
  next = next.replace(
    `The download opens the verified Fantasy Arena Android release. Android will ask you to confirm the app update.`,
    `This updates over your current Fantasy Arena app. Your login and app data stay in place; Android only asks you to confirm Update.`,
  );
  return next;
});

console.log("Native full-page scrolling, installed-app rollout notices and version-aware Android update notifications are ready.");

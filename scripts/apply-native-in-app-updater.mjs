import fs from "node:fs";

const RETENTION = "server/routes/retention.routes.ts";
const NOTIFICATION_ROUTES = "server/routes/notifications.routes.ts";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`[native-in-app-updater] patched ${file}`);
  } else {
    console.log(`[native-in-app-updater] ${file} already ready`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[native-in-app-updater] missing anchor: ${label}`);
  return source.replace(from, to);
}

patchFile(RETENTION, (original) => {
  let source = original;
  source = replaceRequired(
    source,
    `import { registerNotificationRoutes } from "./notifications.routes.js";`,
    `import { registerNotificationRoutes } from "./notifications.routes.js";\nimport { registerAndroidUpdateRoutes } from "./androidUpdate.routes.js";`,
    "Android update route import",
  );
  source = replaceRequired(
    source,
    `  registerNotificationRoutes(app, { requireAuth });`,
    `  registerNotificationRoutes(app, { requireAuth });\n  registerAndroidUpdateRoutes(app);`,
    "Android update route registration",
  );
  return source;
});

patchFile(NOTIFICATION_ROUTES, (original) => {
  if (original.includes("NATIVE_UPDATE_NOTIFICATIONS_GATED_V1")) return original;
  const anchor = `async function syncNativeAppUpdateNotifications() {\n  await ensureNotificationsSchema();`;
  const replacement = `let nativeUpdateCleanupDone = false;\n\nasync function syncNativeAppUpdateNotifications() {\n  await ensureNotificationsSchema();\n  // NATIVE_UPDATE_NOTIFICATIONS_GATED_V1\n  // Do not contact installed users until the first-party updater has been\n  // verified end-to-end. This also removes the premature scroll/1.1.10 notices\n  // created by the earlier rollout so stale Inbox items cannot trigger GitHub.\n  if (process.env.NATIVE_UPDATE_NOTIFICATIONS_ENABLED !== "true") {\n    if (!nativeUpdateCleanupDone) {\n      await db.execute(sql\`\n        delete from app.notifications\n        where dedupe_key in ('native-web-update:full-page-scroll-v1', 'android-update:1.1.10')\n      \`);\n      nativeUpdateCleanupDone = true;\n      console.log("[native-update] notifications held until first-party updater verification is complete");\n    }\n    return;\n  }`;
  return replaceRequired(original, anchor, replacement, "native update notification safety gate");
});

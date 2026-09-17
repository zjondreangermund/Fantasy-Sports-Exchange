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
  const notificationImport = `import { registerNotificationRoutes } from "./notifications.routes.js";`;
  const transferImport = `import { registerAdminPlayerTransferRoutes } from "./adminPlayerTransfers.routes.js";`;
  const updaterImport = `import { registerAndroidUpdateRoutes } from "./androidUpdate.routes.js";`;

  if (!source.includes(updaterImport)) {
    const transferPair = `${notificationImport}\n${transferImport}`;
    if (source.includes(transferPair)) {
      // Keep the transfer patcher's exact notification+transfer pair intact so a
      // later server prebuild cannot mistake the file for unpatched source and
      // insert registerAdminPlayerTransferRoutes a second time.
      source = source.replace(transferPair, `${transferPair}\n${updaterImport}`);
    } else {
      source = replaceRequired(
        source,
        notificationImport,
        `${notificationImport}\n${updaterImport}`,
        "Android update route import",
      );
    }
  }

  const notificationRegistration = `  registerNotificationRoutes(app, { requireAuth });`;
  const transferRegistration = `  registerAdminPlayerTransferRoutes(app, { requireAuth, isAdmin: walletAdmin });`;
  const updaterRegistration = `  registerAndroidUpdateRoutes(app);`;

  if (!source.includes(updaterRegistration)) {
    const transferPair = `${notificationRegistration}\n${transferRegistration}`;
    if (source.includes(transferPair)) {
      // Same ordering rule as imports: preserve the transfer patcher's exact pair
      // across check -> client build -> server build patch cycles.
      source = source.replace(transferPair, `${transferPair}\n${updaterRegistration}`);
    } else {
      source = replaceRequired(
        source,
        notificationRegistration,
        `${notificationRegistration}\n${updaterRegistration}`,
        "Android update route registration",
      );
    }
  }
  return source;
});

patchFile(NOTIFICATION_ROUTES, (original) => {
  if (original.includes("NATIVE_UPDATE_NOTIFICATIONS_GATED_V1")) return original;
  const anchor = `async function syncNativeAppUpdateNotifications() {\n  await ensureNotificationsSchema();`;
  const replacement = `let nativeUpdateCleanupDone = false;\n\nasync function syncNativeAppUpdateNotifications() {\n  await ensureNotificationsSchema();\n  // NATIVE_UPDATE_NOTIFICATIONS_GATED_V1\n  // Do not contact installed users until the first-party updater has been\n  // verified end-to-end. This also removes the premature scroll/1.1.10 notices\n  // created by the earlier rollout so stale Inbox items cannot trigger GitHub.\n  if (process.env.NATIVE_UPDATE_NOTIFICATIONS_ENABLED !== "true") {\n    if (!nativeUpdateCleanupDone) {\n      await db.execute(sql\`\n        delete from app.notifications\n        where dedupe_key in ('native-web-update:full-page-scroll-v1', 'android-update:1.1.10')\n      \`);\n      nativeUpdateCleanupDone = true;\n      console.log("[native-update] notifications held until first-party updater verification is complete");\n    }\n    return;\n  }`;
  return replaceRequired(original, anchor, replacement, "native update notification safety gate");
});

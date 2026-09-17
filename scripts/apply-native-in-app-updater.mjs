import fs from "node:fs";

const ROUTES = "server/routes/notifications.routes.ts";
const GATE = "NATIVE_APP_UPDATE_NOTIFICATIONS_ENABLED";

let source = fs.readFileSync(ROUTES, "utf8");
if (!source.includes(`process.env.${GATE}`)) {
  const anchor = `async function syncNativeAppUpdateNotifications() {\n  await ensureNotificationsSchema();`;
  const replacement = `async function syncNativeAppUpdateNotifications() {\n  // Update notifications stay OFF until the in-app 1.1.11 updater has been\n  // validated end-to-end. This prevents legacy 1.1.9/1.1.10 users being sent\n  // to the old browser/GitHub download flow.\n  if (String(process.env.${GATE} || "").toLowerCase() !== "true") return;\n  await ensureNotificationsSchema();`;
  if (!source.includes(anchor)) throw new Error("[native-in-app-updater] notification sync anchor not found");
  source = source.replace(anchor, replacement);
  fs.writeFileSync(ROUTES, source);
  console.log("[native-in-app-updater] Android update/rollout notifications gated OFF by default");
} else {
  console.log("[native-in-app-updater] notification rollout gate already present");
}

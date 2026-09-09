import fs from "node:fs";

const routes = fs.readFileSync("server/routes/notifications.routes.ts", "utf8");
const control = fs.readFileSync("client/src/components/PushNotificationControl.tsx", "utf8");

const routeChecks = [
  ['PUSH_SELF_TEST_TEMPLATES', "fixed self-test templates"],
  ['app.post("/api/push/test"', "authenticated self-test route"],
  ['pushSelfTestLastScheduledAt', "self-test rate limiting"],
  ['processPendingNativePushDeliveries()', "native push delivery kick"],
  ['processPendingWebPushDeliveries()', "web push delivery kick"],
  ['delaySeconds * 1000', "delayed background test"],
];
const controlChecks = [
  ['PUSH_TEST_PRESETS', "test preset picker"],
  ['data-push-self-test-dialog', "notification test dialog"],
  ['"/api/push/test"', "test API call"],
  ['Send in 12 sec', "close-app countdown control"],
  ['setTestOpen(true)', "alerts-on test entry point"],
];

for (const [needle, label] of routeChecks) {
  if (!routes.includes(needle)) throw new Error(`[push-self-test] Missing ${label}`);
}
for (const [needle, label] of controlChecks) {
  if (!control.includes(needle)) throw new Error(`[push-self-test] Missing ${label}`);
}

console.log("Notification self-test flow verified.");

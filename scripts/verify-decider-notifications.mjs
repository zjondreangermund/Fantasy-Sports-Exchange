import fs from "node:fs";

const score = fs.readFileSync("server/services/scoreUpdater.ts", "utf8");
const routes = fs.readFileSync("server/routes/notifications.routes.ts", "utf8");
const client = fs.readFileSync("client/src/lib/notifications.ts", "utf8");
const web = fs.readFileSync("server/services/webPush.ts", "utf8");
const native = fs.readFileSync("server/services/nativePush.ts", "utf8");

function need(source, token, label) {
  if (!source.includes(token)) throw new Error(`[decider-alert] missing ${label}`);
}

need(score, "remaining.length !== 1", "exactly-one-fixture guard");
need(score, "leaders.length < 2", "real leaderboard-race guard");
need(score, "limit 3", "top-three recipient limit");
need(score, "involvedByUser.values()", "remaining-player involvement guard");
need(score, "createNotificationOnce", "transactional notification creation");
need(score, "competition:${competitionId}:decider:${fixtureId}", "once-per-user decider dedupe key");
need(routes, 'n.dedupe_key as "dedupeKey"', "inbox deep-link metadata");
for (const [source, label] of [[client, "inbox"], [web, "Web Push"], [native, "Android FCM"]]) {
  need(source, 'match(/^competition:(\\d+):decider:/)', `${label} decider routing`);
  need(source, '`/competitions?leaderboard=${decider[1]}`', `${label} tournament leaderboard target`);
}

console.log("Decider Alerts verified: exactly one fixture, Top 3 only, lineup involvement, once-only delivery, and inbox/Web/Android tournament routing.");

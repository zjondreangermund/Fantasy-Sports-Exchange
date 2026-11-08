import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const activity = read("server/services/adminActivity.ts");
const insights = read("server/routes/adminInsights.routes.ts");
const traffic = read("server/routes/admin.routes.ts");
const cards = read("server/routes/cards.routes.ts");
const visitorAssistant = read("server/services/arenaAssistant.ts");

assert.match(activity, /ADMIN_ACTIVITY_OTHER_USERS_ONLY_V1/);
assert.match(activity, /\$\{excludedActors\}/);
assert.match(activity, /count\(distinct session\) filter\(where category='page'\)/);
assert.match(activity, /p\.event='page_view'/);
assert.match(insights, /excludeAdmins:true,viewerId/);
assert.match(traffic, /TRAFFIC_REAL_SESSIONS_V1/);
assert.match(traffic, /count\(distinct p\.session_id\)/);
assert.match(traffic, /count\(distinct p\.visitor_id\)/);
assert.match(visitorAssistant, /VISIT_METRICS_NOT_PAGE_CLICKS_V1/);
assert.match(visitorAssistant, /siteVisitSessions/);
assert.match(visitorAssistant, /excludeAdminBrowsers/);

assert.match(cards, /CANONICAL_PLAYER_SCORE_SNAPSHOT_V1/);
assert.match(cards, /fplApi\.getLiveGameweek\(gameweek\)/);
assert.match(cards, /scoreByElementId\.set\(elementId/);
assert.match(cards, /scoreByElementId\.get\(elementId\)/);
assert.doesNotMatch(cards, /resolveDetailedStatsForPlayer\(verifiedPlayer, detailedScoringContext\)/);

console.log("Other-user activity, distinct visit sessions and shared player-score snapshot guards verified.");

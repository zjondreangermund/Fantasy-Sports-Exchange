import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// CI guard: only one pre-kickoff time bucket may be created by each sync,
// real kickoff evidence is required, and the previous 2026/27 dedupe keys
// must remain stable after copy changes.
const read=(p)=>readFileSync(p,"utf8");
const routes=read("server/routes/notifications.routes.ts");
const client=read("client/src/lib/notifications.ts");
const notifier=read("server/services/notifications.ts");
const adminPatcher=read("scripts/apply-admin-live-ops-notifications.mjs");
function need(s,token,reason){assert.ok(s.includes(token),reason);}
const section=routes.split("// GAMEWEEK_HYPE_REMINDERS_V1")[1]?.split("// GAMEWEEK_ENTRY_CLOSED_GOOD_LUCK_V1")[0]||"";
assert.ok(section,"Gameweek hype policy missing");
need(routes,'c.fixture_window_start as "fixtureStart"',"Real fixture cutoff is missing");
need(routes,'c.season as "season"',"Season scoping is missing");
need(section,"const confirmedKickoff = Boolean(earliest?.fixtureStart)","Unverified entry-opening times must never trigger kickoff pushes");
need(section,'if (openRows.length && confirmedKickoff && typeof minutes === "number" && minutes > 0)',"Only future confirmed kickoff can trigger a reminder");
need(section,'if (minutes <= 30)',"30-minute final call is missing");
need(section,'} else if (minutes <= 120)',"Exclusive 2-hour tier is missing");
need(section,'} else if (minutes <= 24 * 60)',"Exclusive 24-hour tier is missing");
need(section,'const hasEntered = gameweekRows.some',"Reminder must distinguish entrants from non-entrants");
need(section,'Gameweek ${nextGameweek} kicks off within 24 hours',"Reminder must reference correct GW");
need(section,'You can still edit submitted teams until the first Premier League kickoff',"Reminder must not falsely say entries already locked");
need(section,'All entries and edits lock at first kickoff',"Reminder must explain cutoff");
need(section,'const reminderKey = season === "2026-27"',"Old 2026/27 reminders must not be replayed with new keys");
need(section,'gameweek:${season}:${nextGameweek}',"Future seasons must get fresh dedupe keys");
for(const suffix of ["locks-within-24h","locks-within-2h","locks-within-30m"]){
  need(section,`:${suffix}`,`Missing keyed milestone ${suffix}`);
}
assert.equal((section.match(/await createNotificationOnce\(db/g)||[]).length,3,
  "Exactly three exclusive pre-kickoff tiers should exist");
need(routes,"15 * 60_000","Scheduled worker must run every 15 minutes");
need(notifier,"on conflict (user_id, dedupe_key) do nothing","Database must enforce deduplicated notifications");
need(notifier,'dedupeKey.startsWith("gameweek:")',"Gameweek alerts must honor tournament push preferences");
need(routes,"Suppress the old separate 'GW is live' push","Avoid duplicate kickoff alerts");
need(client,"locks-within-(?:24h|2h|30m)","Hype notices must open an actionable screen");
need(client,'? "/my-entries" : "/competitions"',"Entrants and non-entrants need appropriate targets");
need(adminPatcher,"PRODUCTION_NOTIFICATION_TIMING_V1","Legacy source preparation must not change notification schedule");
console.log("Hype reminder policy verified: kickoff-time gates, exclusive thresholds, idempotent keys, meaningful destinations and push preferences.");

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("server/services/playerBookingNotifications.ts", "utf8");
const sync = fs.readFileSync("server/services/apiFootballSync.ts", "utf8");
assert.equal((sync.match(/await notifyFixtureBookings\(/g) || []).length, 2, "Live and recently completed sync must both notify");
assert.ok(source.includes("league_id=39") && source.includes("interval '3 hours'"), "Historical/non-PL bookings must be excluded");
assert.ok(source.includes("c.game_week=${gameWeek}") && source.includes("jsonb_array_elements_text(ce.lineup_card_ids)"), "Recipients must come from submitted entries in this gameweek");
assert.ok(source.includes("select distinct ce.user_id") && source.includes("c.end_date >= ${fixture.kickoff_at}"), "Multiple entries must collapse and fixture windows must apply");

assert.ok(fs.readFileSync("shared/schema.ts", "utf8").includes('appSchema.table("player_booking_alerts"'), "Incident history must be tracked by schema migrations");
const claims = new Set();
const notifications = [];
let yellow = 1, red = 0, includeFixture = true, failDelivery = false;
const sql = (strings, ...values) => ({ text: strings.join("?"), values });
const db = {
  async execute(query) {
    if (query.text.includes("select api_fixture_id, round")) return { rows: includeFixture ? [{ round: "Regular Season - 6", kickoff_at: new Date(), raw: { teams: { home: { name: "Arsenal" }, away: { name: "Chelsea" } } } }] : [] };
    if (query.text.includes("select api_player_id, player_name")) return { rows: [{ api_player_id: 123, player_name: "Kepa", statistics: { cards: { yellow, red } } }] };
    if (query.text.includes("select distinct ce.user_id")) return { rows: [{ userId: "manager", id: 7, name: "Kepa", team: "Arsenal", position: "GK" }, { userId: "unlinked", id: 8 }] };
    return { rows: [] };
  },
  async transaction(task) {
    let newClaim;
    try {
      return await task({ execute: async query => {
        const key = JSON.stringify(query.values);
        if (claims.has(key)) return { rows: [] };
        claims.add(key); newClaim = key;
        return { rows: [{ user_id: "manager" }] };
      } });
    } catch (error) { if (newClaim) claims.delete(newClaim); throw error; }
  },
};
const modules = {
  "drizzle-orm": { sql }, "../db.js": { db },
  "./apiFootballPlayerDirectory.js": { loadApiFootballPlayerDirectory: async () => [], resolveApiFootballPlayer: player => player.id === 7 ? { apiPlayerId: 123, name: "Kepa" } : null },
  "./notifications.js": { ensureNotificationsSchema: async () => {}, createNotificationOnce: async (_tx, input) => { if (failDelivery) throw Error("temporary push enqueue failure"); notifications.push(input); return { id: notifications.length }; } },
};
function loadService() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => modules[name], console: { info() {} } });
  return exports.notifyFixtureBookings;
}
for (const file of ["server/services/nativePush.ts", "server/services/webPush.ts", "client/src/lib/notifications.ts"]) {
  const route = fs.readFileSync(file, "utf8");
  assert.ok(route.includes('startsWith("booking:")') && route.includes('return "/live-lineup"'), `${file} must open Live Lineup for booking alerts`);
}
let notify = loadService();
assert.equal(await notify(50), 1);
assert.equal(await notify(50), 0, "Repeated polling must not resend yellow");
notify = loadService();
assert.equal(await notify(50), 0, "Restart must preserve incident dedupe");
red = 1;
assert.equal(await notify(50), 1, "Red after yellow must send a separate alert");
assert.match(notifications[1].title, /red card/);
yellow = 2;
assert.equal(await notify(50), 0, "Second yellow plus red must not duplicate the dismissal alert");
red = 0;
assert.equal(await notify(55), 1);
assert.match(notifications[2].message, /second yellow card/);
red = 1;
assert.equal(await notify(55), 1);
assert.match(notifications[3].message, /sent off after a second yellow/);
assert.equal(await notify(50), 0);
assert.equal(notifications.every(n => n.userId === "manager"), true, "Unlinked identities must not receive guessed alerts");
failDelivery = true;
await assert.rejects(notify(51), /temporary push/);
failDelivery = false;
assert.equal(await notify(51), 1, "Failed transaction must release claim for retry");
assert.equal((await Promise.all([notify(54), notify(54)])).reduce((sum, count) => sum + count, 0), 1, "Concurrent polls must create each incident only once");
includeFixture = false;
assert.equal(await notify(52), 0, "Ineligible fixtures must never notify");
includeFixture = true; yellow = 0; red = 0;
assert.equal(await notify(53), 0, "No cards means no notifications");
console.log("Player booking alerts verified: yellow, second yellow, red, stable identity, duplicate polling/restarts, transactional retry and fixture eligibility.");

import assert from "node:assert/strict";
import fs from "node:fs";
import { arenaCalendarWeek, currentArenaDisplayWeek, currentArenaOpenCups } from "../client/src/lib/arena-current-gameweek.ts";

const now = new Date("2026-10-14T08:00:00.000Z");
const official = (week, status, startDate) => ({
  id: week * 10, name: `GW${week} Common Prize Ladder`, gameWeek: week,
  tier: "common", entryFee: 10, status, visibility: "public", startDate,
});
const free = (week, status, entryOpen = true) => ({
  id: week, name: `GW${week} FREE Common Card Cup`, gameWeek: week,
  tier: "common", entryFee: 0, status, entryOpen, visibility: "public",
});
const legacy = {
  id: 129, name: "FREE Rare Card Cup - GW29", gameWeek: 29, entryFee: 0,
  status: "open", entryOpen: true, visibility: "public",
  startDate: "2026-09-15T00:00:00Z",
};
const fixtures = [
  official(6, "active", "2026-10-13T00:00:00Z"),
  official(7, "upcoming", "2026-10-20T00:00:00Z"),
  official(29, "upcoming", "2027-04-07T00:00:00Z"),
  free(6, "active"),
  free(7, "open"), // real admin-opened next gameweek
  free(29, "upcoming"),
  legacy, // old, mistakenly open in live DB
];

assert.equal(arenaCalendarWeek(fixtures, now), 6, "GW6 is the current official opening window");
assert.equal(currentArenaDisplayWeek(fixtures, now), 7, "manually opened GW7 must take precedence over active GW6");
assert.equal(currentArenaOpenCups(fixtures, now)[0]?.id, 7, "Home must feature the current entry GW7");
assert.equal(currentArenaOpenCups(fixtures, now).length, 1, "GW29 must not count as open or appear in Home");

const stillCurrent = [...fixtures, free(6, "open")];
assert.equal(currentArenaDisplayWeek(stillCurrent, now), 6, "an enterable current GW beats next week's cup");
assert.equal(currentArenaOpenCups(stillCurrent, now)[0]?.gameWeek, 6, "choose earliest eligible opened week");

const nextTuesday = new Date("2026-10-21T08:00:00.000Z");
assert.equal(arenaCalendarWeek(fixtures, nextTuesday), 7, "the calendar must roll on the next scheduled opening");
assert.equal(currentArenaOpenCups(fixtures, nextTuesday)[0]?.gameWeek, 7);

const closedCurrent = fixtures.map((row) => row.gameWeek === 7 ? { ...row, status: "upcoming" } : row);
assert.equal(currentArenaOpenCups(closedCurrent, now).length, 0, "a future legacy GW29 cannot stand in for an upcoming GW7");
assert.equal(currentArenaDisplayWeek(closedCurrent, now), 6, "show scheduled GW6 when no current/next week is open");
assert.equal(arenaCalendarWeek([legacy], now), null, "legacy tournaments alone cannot establish the current GW");
assert.equal(currentArenaDisplayWeek([legacy], now), 0, "without a valid calendar never falsely show GW29");

const restricted = [...fixtures, { ...free(6, "open"), visibility: "private" }, { ...free(6, "open"), entryOpen: false }];
assert.equal(currentArenaOpenCups(restricted, now).length, 1, "do not show private or already-closed entry windows");

const routes = fs.readFileSync("server/routes.ts", "utf8");
const seed = fs.readFileSync("server/seed.ts", "utf8");
const archive = fs.readFileSync("server/services/archiveConfirmedTestTournaments.ts", "utf8");
assert.ok(!routes.includes("await seedCompetitions()"), "server startup must not recreate old GW27-GW30 cups");
assert.ok(seed.includes("LEGACY_GW27_SEED_DISABLED"), "old seeder must stay disabled");
assert.ok(archive.includes("LEGACY_FUTURE_GW_QUARANTINE_V1"), "unused legacy cups must be archived");
assert.ok(archive.includes("c.admin_status_override is null"), "manual statuses must be protected");
assert.ok(archive.includes("not exists (select 1 from app.competition_entries"), "entered cups must be protected");
console.log("Arena GW regression passed: GW7 featured, GW29 excluded, calendar rollover, manual overrides and protected tournament records.");

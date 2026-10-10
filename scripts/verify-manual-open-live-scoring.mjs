import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Exercise the real scheduler and single-tournament path with provider/storage
// fixtures; no live database, points fabrication, or changes to entry status.
const source = fs.readFileSync('server/services/scoreUpdater.ts', 'utf8');
const fixture = { event: 6, kickoff_time: '2026-01-02T12:00:00Z', started: true };
const bootstrap = { events: [{ id: 6, is_current: true, deadline_time: '2026-01-02T10:00:00Z' }] };
const calls = [];
const statusWrites = [];
const exports = {};
const sandbox = {
  exports, process: { env: {} }, console: { log() {}, error() {}, warn() {} },
  setInterval, clearInterval,
  require(name) {
    if (name === 'drizzle-orm') return { sql: (...args) => args };
    if (name === '../db.js') return { db: { execute: async (...args) => { statusWrites.push(args); return { rows: [] }; } } };
    if (name === './fplApi.js') return { fplApi: { bootstrap: async () => bootstrap, fixturesLive: async () => [fixture] } };
    if (name === './apiFootballScoringBridge.js') return { loadApiFootballGameweekScoringContext: async () => ({ available: true }) };
    return {};
  },
};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
const base = { id: 1229, gameWeek: 6, status: 'open', adminStatusOverride: 'open', startDate: '2026-01-01T00:00:00Z', endDate: '2099-01-01T00:00:00Z' };
let competition = { ...base };
const service = new exports.ScoreUpdateService({
  getCompetitions: async () => [competition], getCompetition: async () => competition,
  getCompetitionEntries: async () => [{ id: 1 }],
});
service.scoreCompetitionEntries = async (comp, context, final) => { calls.push({ status: comp.status, final }); return { updatedCount: 14, complete: true }; };
service.sendPostScoreAlerts = async () => {};
await service.updateAllActiveCompetitions();
assert.equal(calls.length, 1, 'Manual-open GW with played games must be scored by scheduler');
assert.equal(calls[0].final, false);
assert.equal(competition.status, 'open');
assert.equal(statusWrites.length, 0, 'Scoring must preserve the admin status override');
await service.updateCompetition(1229);
assert.equal(calls.length, 2, 'Immediate refresh must score manual-open tournaments too');
competition = { ...base, endDate: '2026-01-03T00:00:00Z' };
await service.updateCompetition(1229);
assert.equal(calls.at(-1).final, false, 'Open override must not finalize even after settlement time');
await assert.rejects(() => service.updateCompetition(1229, { forceFinal: true }), /Close tournament entries/);
competition = { ...base, gameWeek: 7, startDate: '2099-01-01T00:00:00Z' };
const before = calls.length;
await service.updateAllActiveCompetitions();
assert.equal(calls.length, before, 'Future open tournaments must remain unscored');
assert.equal((await service.updateCompetition(1229)).skipped, true);
competition = { ...base, status: 'completed' };
await service.updateAllActiveCompetitions();
assert.equal((await service.updateCompetition(1229)).skipped, true);
assert.equal(calls.length, before, 'Completed tournaments must remain immutable');
competition = { ...base, status: 'cancelled' };
await service.updateAllActiveCompetitions();
await assert.rejects(() => service.updateCompetition(1229), /cancelled/);
assert.equal(calls.length, before);
competition = { ...base, status: 'active', adminStatusOverride: 'active' };
await service.updateAllActiveCompetitions();
assert.equal(calls.length, before + 1, 'Existing active scoring must continue');
console.log('Verified manual-open live scoring, future-week deferral, status preservation, settlement protection, and completed/cancelled immutability.');

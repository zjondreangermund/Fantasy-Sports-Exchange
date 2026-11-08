import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const source = readFileSync(new URL('../server/services/concurrentRead.ts', import.meta.url), 'utf8');
let javascript;
try {
  const ts = createRequire(import.meta.url)('typescript');
  javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  javascript = (await import('node:module')).stripTypeScriptTypes(source);
}
const { coalesceConcurrentRead } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
let calls = 0;
const releases = new Map();
const load = coalesceConcurrentRead(key => {
  calls++;
  return new Promise(resolve => releases.set(key, resolve));
});
const first = load(8);
const duplicate = load(8);
const other = load(9);
assert.equal(first, duplicate);
assert.notEqual(first, other);
await Promise.resolve();
assert.equal(calls, 2);
releases.get(8)({ gameweek: 8 });
releases.get(9)({ gameweek: 9 });
assert.deepEqual(await first, { gameweek: 8 });
await other;
const fresh = load(8);
assert.notEqual(fresh, first);
await Promise.resolve();
assert.equal(calls, 3);
releases.get(8)({ gameweek: 8, refreshed: true });
await fresh;
let attempts = 0;
const retry = coalesceConcurrentRead(async () => {
  if (++attempts === 1) throw new Error('temporary failure');
  return 'recovered';
});
await assert.rejects(retry(8), /temporary failure/);
assert.equal(await retry(8), 'recovered');
console.log('Concurrent reads: deduplication, gameweek isolation, fresh reads and failure recovery passed.');

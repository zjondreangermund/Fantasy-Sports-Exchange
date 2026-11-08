import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const source = readFileSync(new URL('../client/src/lib/fixture-period-scores.ts', import.meta.url), 'utf8');
let javascript;
try {
  const ts = createRequire(import.meta.url)('typescript');
  javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  javascript = (await import('node:module')).stripTypeScriptTypes(source);
}
const { fixturePeriodScores } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const provisional = {halftime:{home:1,away:2}, fulltime:{home:1,away:2}};
assert.deepEqual(fixturePeriodScores('1H', provisional), {halftime:'Not confirmed',fulltime:'Not confirmed'});
assert.deepEqual(fixturePeriodScores('HT', provisional), {halftime:'1 : 2',fulltime:'Not confirmed'});
assert.deepEqual(fixturePeriodScores('2H', provisional), {halftime:'1 : 2',fulltime:'Not confirmed'});
assert.deepEqual(fixturePeriodScores('FT', provisional), {halftime:'1 : 2',fulltime:'1 : 2'});
assert.equal(fixturePeriodScores('FT', {halftime:{home:0,away:0}}).fulltime, 'Awaiting data', 'never substitute live goals for the regulation result');
assert.equal(fixturePeriodScores('FT', {fulltime:{home:0,away:0}}).fulltime, '0 : 0');
assert.equal(fixturePeriodScores('2H', {halftime:{home:null,away:0}}).halftime, 'Awaiting data');
assert.equal(fixturePeriodScores('FT', {fulltime:{home:NaN,away:-1}}).fulltime, 'Awaiting data');
for (const phase of ['NS','TBD','PST','CANC','ABD','SUSP','INT','LIVE','']) {
  assert.deepEqual(fixturePeriodScores(phase, provisional), {halftime:'Not confirmed',fulltime:'Not confirmed'});
}
for (const phase of ['ET','BT','P','AET','PEN']) assert.equal(fixturePeriodScores(phase, provisional).fulltime, '1 : 2', 'regulation result is distinct from extra time/penalties');
console.log('Fixture period scores passed: first half, HT, second half, completed games, extra time, missing scores and 0-0.');

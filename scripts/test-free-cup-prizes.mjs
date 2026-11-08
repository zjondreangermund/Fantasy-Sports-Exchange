import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const source = readFileSync(new URL('../server/services/freeCupPrizes.ts', import.meta.url), 'utf8');
let javascript;
try {
  const ts = createRequire(import.meta.url)('typescript');
  javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  javascript = (await import('node:module')).stripTypeScriptTypes(source);
}
const { FREE_CUP_FIRST_PRIZE_ODDS, freeCupFirstPrizeForRoll, resolveFreeCupClaimRarity } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const counts = {};
for (let roll = 0; roll < 10_000; roll++) {
  const rarity = freeCupFirstPrizeForRoll(roll);
  counts[rarity] = (counts[rarity] || 0) + 1;
}
assert.deepEqual(counts, {rare:9500, unique:450, epic:45, legendary:5});
assert.equal(FREE_CUP_FIRST_PRIZE_ODDS.reduce((total, option) => total + option.percentage, 0), 100);
for (const roll of [-1, 10_000, 0.5, NaN]) assert.throws(() => freeCupFirstPrizeForRoll(roll));
for (const rank of [2, 3]) {
  assert.equal(resolveFreeCupClaimRarity(rank, 'rare'), 'rare');
  assert.equal(resolveFreeCupClaimRarity(rank, 'common'), 'common', 'historical Common entitlements must remain unchanged');
  assert.equal(resolveFreeCupClaimRarity(rank, ''), 'common', 'legacy missing metadata retains its old fallback');
  assert.equal(resolveFreeCupClaimRarity(rank, 'legendary'), 'common', 'runner-up claims must never draw a high rarity');
}
for (const rarity of Object.keys(counts)) assert.equal(resolveFreeCupClaimRarity(1, rarity), rarity);
assert.throws(() => resolveFreeCupClaimRarity(4, 'rare'));
console.log('Free Cup prizes passed: all 10,000 first-place rolls, Rare runner-up claims, historical awards and rank guards.');

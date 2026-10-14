import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync('server/services/removeFantasyTestInventory.ts', 'utf8');
async function run(amount, balance) {
  const postings = [];
  const statements = [];
  const tx = { execute: async (query) => {
    statements.push(query.text);
    if (query.text.includes('to_regclass')) return { rows: [{ name: null }] };
    if (query.text.includes('group by user_id')) return { rows: amount > 0 ? [{ userId: 'real-manager', amount }] : [] };
    if (query.text.includes('select balance')) return { rows: [{ balance }] };
    return { rows: [] };
  } };
  const exports = {};
  const sandbox = { exports, console: { log() {}, warn() {} }, require: (name) => {
    if (name === 'drizzle-orm') return { sql: (parts, ...values) => ({ text: parts.join('?'), values }) };
    if (name === '../db.js') return { db: { transaction: async (fn) => fn(tx) } };
    if (name === './walletPostingSchema.js') return { ensureWalletPostingSchema: async () => {} };
    if (name === './walletPosting.js') return { toPostingMoney: (n) => Math.round(Number(n)*100)/100, postWalletAmountExactlyOnce: async (_tx, posting) => postings.push(posting) };
    throw new Error(name);
  } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
  await exports.removeFantasyTestInventory();
  return { postings, statements };
}
const funded = await run(5000, 5520);
assert.equal(funded.postings.length, 1);
assert.equal(funded.postings[0].amount, -5000);
assert.equal(funded.postings[0].sourceType, 'fantasy_test_cleanup');
assert.equal(funded.postings[0].postingKey, 'fantasy-test-cleanup-20261014:real-manager');
assert.equal((await run(5000, 520)).postings.length, 0, 'Spent test funds must not cause a negative wallet');
assert.equal((await run(0, 5520)).postings.length, 0, 'Unidentified balances and completed reversals must remain untouched');
assert.ok(funded.statements.some(q => q.includes('owner_id is null') && q.includes('for_sale = true')));
assert.ok(funded.statements.some(q => q.includes('admin_test') && q.includes('created_at <=')));
assert.ok(funded.statements.every(q => !/delete from/i.test(q)), 'Cards and ledger history must be retained');
console.log('Fantasy test cleanup: credit reversal, insufficient funds, replay, scope and history safeguards passed.');

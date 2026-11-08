import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const source = readFileSync(new URL('../shared/client-error.ts', import.meta.url), 'utf8');
let javascript;
try {
  const ts = createRequire(import.meta.url)('typescript');
  javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  javascript = (await import('node:module')).stripTypeScriptTypes(source);
}
const { describeClientError, sanitizeClientError } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const error = new TypeError('Cannot read properties of undefined');
error.stack = 'TypeError: secret header\n    at render (https://playfantasyarena.com/assets/app.js?token=private:12:34)\nnext@https://playfantasyarena.com/assets/other.js:56:78';
const detail = describeClientError('runtime', error, { file: 'https://playfantasyarena.com/assets/app.js?token=private', line: 12, column: 34 });
assert.equal(detail.name, 'TypeError');
assert.equal(detail.message, 'Cannot read properties of undefined');
assert.equal(detail.file, '/assets/app.js');
assert.deepEqual(detail.frames, ['/assets/app.js:12:34', '/assets/other.js:56:78']);
assert.deepEqual(sanitizeClientError(detail), detail, 'server resanitization retains useful locations');
const sensitive = describeClientError('unhandledrejection', 'token=private password="hidden" {"secret":"classified"} user@example.com https://example.com/?auth=hidden Bearer abc123 /api/user?email=hidden');
for (const word of ['private', 'hidden', 'classified', 'user@example.com', 'abc123']) assert.ok(!sensitive.message.includes(word), word);
const object = { password: 'do not serialize', body: 'private body' };
assert.equal(describeClientError('unhandledrejection', object).message, 'Non-Error rejection (payload omitted)');
assert.equal(sanitizeClientError({ source: 'invalid' }), null);
const malicious = sanitizeClientError({source:'runtime',message:'x '.repeat(1000),file:'javascript:alert(1)',line:-4,column:Infinity,frames:Array(30).fill('/assets/app.js:1:2'),body:'secret'});
assert.equal(malicious.message.length, 400);
assert.equal(malicious.file, '');
assert.equal(malicious.line, 0);
assert.equal(malicious.column, 0);
assert.equal(malicious.frames.length, 8);
assert.ok(!('body' in malicious));
console.log('Client error diagnostics passed: locations, stack frames, redaction, bounds, server filtering and non-Error rejection privacy.');

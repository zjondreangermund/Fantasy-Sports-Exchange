import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';

const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compile('server/services/webSigninHandoff.ts'), { exports, URL });
const app = 'https://playfantasyarena.com';
const old = 'https://fantasy-sports-exchange-production-d05c.up.railway.app';
const callback = old + '/api/auth/google/callback';
assert.equal(exports.allowedWebSigninOrigin(old, callback, app, app), true);
for (const origin of ['https://evil.invalid', old + '.evil.invalid', 'null', '']) assert.equal(exports.allowedWebSigninOrigin(origin, callback, app, app), false);
assert.equal(exports.allowedWebSigninOrigin(old, callback, app, old), false);
assert.equal(exports.allowedWebSigninOrigin(old, old + '/wrong', app, app), false);
assert.equal(exports.allowedWebSigninOrigin(old, callback, app, 'http://playfantasyarena.com'), false);
const page = exports.webSigninHandoffPage(app, 't'.repeat(43), 'n'.repeat(32));
assert.equal(page.referrerPolicy, 'strict-origin');
assert.match(page.html, /name="referrer" content="strict-origin"/);
assert.match(page.html, /method="post"/);
assert.match(page.html, /action="https:\/\/playfantasyarena.com\/api\/auth\/web\/complete"/);
assert.ok(!page.html.includes('?ticket='));
assert.match(page.csp, /frame-ancestors 'none'/);
assert.match(page.csp, /script-src 'nonce-n+'/);
assert.throws(() => exports.webSigninHandoffPage(app, '<script>', 'n'.repeat(32)));
assert.throws(() => exports.webSigninHandoffPage(app, 't'.repeat(43), '\" onload=evil'));

const tickets = new Map();
const pool = { query: async (query, args = []) => {
  if (query.includes('insert into app.native_auth_tickets')) tickets.set(args[0], { payload: args[1], expires: new Date(args[2]).getTime(), purpose: args[3] });
  if (query.includes('where token_hash = $1')) {
    const row = tickets.get(args[0]);
    if (!row || row.expires <= Date.now() || row.purpose !== args[1]) return { rows: [] };
    tickets.delete(args[0]);
    return { rows: [{ user_payload: row.payload }] };
  }
  if (query.includes('where expires_at <= now()')) for (const [key,row] of tickets) if (row.expires <= Date.now()) tickets.delete(key);
  return { rows: [] };
} };
const authExports = {};
vm.runInNewContext(compile('server/routes/auth.routes.ts') + '\nexports.issue = issueNativeAuthTicket; exports.consume = consumeNativeAuthTicket;', {
  exports: authExports, Buffer, Date, console, process: { env: {} },
  require: name => {
    if (name === 'node:crypto') return crypto;
    if (name.includes('auth-config')) return { appUrl: app, getSessionSecret: () => 'unit-test-only' };
    if (name.includes('webSigninHandoff')) return exports;
    if (name.includes('/db')) return { db: {}, pool };
    if (name === 'drizzle-orm') return {};
    throw new Error('Unexpected test dependency: ' + name);
  },
});
const web = await authExports.issue({ user: { id: 'test-user' }, targetOrigin: app }, 'web');
assert.equal(await authExports.consume(web), null, 'web ticket cannot be consumed by native endpoint');
assert.equal((await authExports.consume(web, 'web')).user.id, 'test-user');
assert.equal(await authExports.consume(web, 'web'), null, 'ticket is single-use');
const native = await authExports.issue({ id: 'native-test' });
assert.equal(await authExports.consume(native, 'web'), null);
assert.equal((await authExports.consume(native)).id, 'native-test');
const expired = await authExports.issue({ user: { id: 'expired' } }, 'web');
for (const row of tickets.values()) row.expires = Date.now() - 1;
assert.equal(await authExports.consume(expired, 'web'), null);
console.log('Web sign-in handoff verified: trusted callback origin, bound recipient, POST-only transport, nonce CSP, separated native/web purposes, expiry and single-use tickets.');

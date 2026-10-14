import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../server/services/canonicalHostname.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(compiled, sandbox);
const redirect = sandbox.exports.redirectLegacyHostname;
const old = 'fantasy-sports-exchange-production-d05c.up.railway.app';
for (const page of ['/', '/collection', '/onboarding', '/admin', '/install', '/api/login', '/api/auth/google']) {
  assert.equal(redirect(true, 'GET', old, page), true, page);
}
for (const endpoint of ['/api/auth/google/callback', '/api/auth/native/complete', '/api/health', '/api/players', '/api/onboarding/offers']) {
  assert.equal(redirect(true, 'GET', old, endpoint), false, endpoint);
}
assert.equal(redirect(true, 'POST', old, '/api/onboarding/choose'), false);
assert.equal(redirect(true, 'GET', 'playfantasyarena.com', '/'), false);
assert.equal(redirect(true, 'GET', 'another-app.up.railway.app', '/'), false);
assert.equal(redirect(false, 'GET', old, '/'), false);
console.log('Legacy browser pages and login use the public hostname; callbacks, APIs, local development and other services are preserved.');

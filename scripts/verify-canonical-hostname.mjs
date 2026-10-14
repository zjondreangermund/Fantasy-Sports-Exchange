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
const server = fs.readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
assert.match(server, /redirectLegacyHostname\([^\n]*req\.path, String\(req\.get\('user-agent'\)/);
for (const version of ['1.1.9', '1.1.10', '1.1.11', '1.1.12']) {
  for (const page of ['/', '/onboarding', '/collection', '/api/login', '/api/auth/native/complete']) {
    assert.equal(redirect(true, 'GET', old, page, `Mozilla/5.0 FantasyArenaNative/${version}`), false, `Installed ${version}: ${page}`);
  }
}
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
console.log('Legacy browser pages use the public hostname; installed native APK origins, callbacks and APIs are preserved.');

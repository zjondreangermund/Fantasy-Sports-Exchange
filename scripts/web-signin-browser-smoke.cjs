// Isolated browser regression: every request is intercepted. No live accounts,
// provider credentials, production cookies, or external network requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { chromium } = require('playwright');
const handoff = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('server/services/webSigninHandoff.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: handoff, URL });

const old = 'https://callback.fixture.test';
const app = 'https://arena.fixture.test';
const callback = old + '/api/auth/google/callback';
const fixtureTicket = 't'.repeat(43);
const page = handoff.webSigninHandoffPage(app, fixtureTicket, 'n'.repeat(32));
const authSource = fs.readFileSync('server/routes/auth.routes.ts', 'utf8');
assert.match(authSource, /setHeader\('Referrer-Policy', page.referrerPolicy\)/);
assert.equal(page.referrerPolicy, 'strict-origin');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  try {
    for (const width of [390, 1280]) {
      for (const broken of [true, false]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
        const tab = await context.newPage();
        let submitted;
        await context.route('**/*', async route => {
          const req = route.request();
          const url = new URL(req.url());
          if (url.origin === old && url.pathname === '/api/auth/google/callback') {
            const policy = broken ? 'no-referrer' : page.referrerPolicy;
            return route.fulfill({ status: 200, contentType: 'text/html', headers: {
              'Content-Security-Policy': page.csp, 'Referrer-Policy': policy, 'Cache-Control': 'no-store',
            }, body: broken ? page.html.replace('content="strict-origin"', 'content="no-referrer"') : page.html });
          }
          if (url.origin === app && url.pathname === '/api/auth/web/complete') {
            const headers = await req.allHeaders();
            submitted = { origin: headers.origin, referer: headers.referer, method: req.method() };
            const allowed = handoff.allowedWebSigninOrigin(headers.origin, callback, app, app);
            const valid = new URLSearchParams(req.postData() || '').get('ticket') === fixtureTicket;
            if (!allowed || !valid) return route.fulfill({ status: 403, contentType: 'text/html', body: '<h1>Request origin is not allowed</h1>' });
            return route.fulfill({ status: 303, headers: { location: '/', 'set-cookie': 'fixture_session=authenticated; Path=/; Secure; HttpOnly; SameSite=Lax' }, body: '' });
          }
          if (url.origin === app && url.pathname === '/') {
            const signedIn = (await req.allHeaders()).cookie?.includes('fixture_session=authenticated');
            return route.fulfill({ status: 200, contentType: 'text/html', body: `<h1>${signedIn ? 'Signed in to Fantasy Arena' : 'Sign in required'}</h1>` });
          }
          return route.fulfill({ status: 404, body: 'No external requests allowed' });
        });
        await tab.goto(callback + '?code=fixture-only&state=fixture-only');
        await tab.getByRole('heading', { name: broken ? 'Request origin is not allowed' : 'Signed in to Fantasy Arena' }).waitFor();
        assert.equal(submitted.method, 'POST');
        assert.equal(submitted.origin, broken ? 'null' : old);
        if (!broken) {
          assert.equal(submitted.referer, old + '/', 'Callback code and state must never be exposed in Referer');
          assert.equal(tab.url(), app + '/');
          await tab.reload();
          await tab.getByRole('heading', { name: 'Signed in to Fantasy Arena' }).waitFor();
        }
        console.log(`${width}px: ${broken ? 'old origin-null rejection reproduced' : 'fixed cross-domain POST and retained app session passed'}`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

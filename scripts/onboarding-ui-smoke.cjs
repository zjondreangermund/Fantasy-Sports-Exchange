const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Isolated frontend regression. No production credentials, accounts or API writes.
// Provider login, database minting and a physical phone keyboard remain live tests.
(async () => {
  fs.mkdirSync('onboarding-ui-results', { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [320, 360, 390, 414, 768, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: width < 600, hasTouch: width < 600 });
      const page = await context.newPage();
      let complete = false, club = '', mintRequests = 0;
      const positions = ['GK', 'DEF', 'MID', 'FWD', 'MID'];
      const labels = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Wildcard'];
      const players = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, name: `QA Player ${i + 1}`, team: 'Arsenal', position: positions[Math.floor(i / 3)], league: 'Premier League', nationality: 'Namibia', age: 25, overall: 70, status: 'active', imageUrl: '/brand/fantasy-arena-logo.jpg', photo: '/brand/fantasy-arena-logo.jpg', totalPoints: 0, form: '0' }));
      const packs = Array.from({ length: 5 }, (_, i) => [i * 3 + 1, i * 3 + 2, i * 3 + 3]);
      const user = () => ({ id: 'isolated-qa-user', name: 'Onboarding fixture', managerTeamName: club, email: 'qa@local.test' });
      const offers = () => ({ packCards: packs, offeredPlayerIds: players.map(p => p.id), players, selectedCards: complete ? [2,4,7,10,13] : [], completed: complete });
      await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (path === '/api/image-proxy') return route.fulfill({ path: 'client/public/brand/fantasy-arena-logo.jpg', contentType: 'image/jpeg' });
        let body = [];
        if (['/api/auth/user', '/api/user'].includes(path)) body = user();
        else if (path === '/api/onboarding/status') body = { completed: complete };
        else if (path === '/api/onboarding/config') body = { signupPacksEnabled: true, requireTeamName: true, teamNameMinLength: 3, packLabels: labels };
        else if (['/api/onboarding/offers', '/api/onboarding/create-offer'].includes(path)) body = offers();
        else if (path === '/api/user/profile' && req.method() === 'PATCH') {
          club = req.postDataJSON().managerTeamName;
          if (club === 'Liverpool') return route.fulfill({ status: 400, json: { message: 'TEAM_NAME_TAKEN: already registered' } });
          body = user();
        } else if (path === '/api/onboarding/choose') {
          mintRequests++;
          const ids = req.postDataJSON().selectedPlayerIds;
          assert.equal(new Set(ids).size, 5);
          assert.deepEqual([...ids].sort((a,b)=>a-b), [2,4,7,10,13]);
          complete = true;
          await new Promise(resolve => setTimeout(resolve, 300));
          body = { success: true, cards: ids };
        } else if (path === '/api/admin/check') body = { isAdmin: false };
        return route.fulfill({ status: 200, json: body });
      });
      try {
        await page.goto('http://127.0.0.1:8765/');
        const input = page.getByLabel('Club name', { exact: true });
        await input.waitFor({ timeout: 20000 });
        await input.click();
        assert.equal(await input.evaluate(el => el.ownerDocument.activeElement === el), true, 'club input focus');
        await input.fill('a');
        assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isEnabled(), false, 'short name');
        await input.fill('Liverpool');
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'already registered' }).waitFor();
        await input.fill(`QA Club ${width}`);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        const choices = page.locator('button[aria-label^="Select QA Player"]');
        await choices.first().waitFor({ timeout: 20000 });
        assert.equal(await choices.count(), 15);
        assert.equal(await page.getByRole('button', { name: 'Select 5 more', exact: true }).isEnabled(), false);
        // Each choice must reveal its entire card when scrolled into view.
        for (const choice of await choices.all()) {
          await choice.scrollIntoViewIfNeeded();
          const box = await choice.evaluate(el => {
            const card = el.querySelector('article');
            if (!card) return null;
            const a = card.getBoundingClientRect(), b = el.getBoundingClientRect();
            const img = el.querySelector('img[alt^="QA Player"]');
            return { portraitVisible: !!(img && Number(getComputedStyle(img).opacity) > 0), left: a.left, right: a.right, top: a.top, bottom: a.bottom, parentLeft: b.left, parentRight: b.right, parentTop: b.top, parentBottom: b.bottom, viewportWidth: innerWidth };
          });
          assert.ok(box, 'card article exists');
          assert.ok(box.portraitVisible, 'player portrait must not be hidden by loading state');
          assert.ok(box.left >= -1 && box.right <= box.viewportWidth + 1, `horizontal card clipping at ${width}px: ${JSON.stringify(box)}`);
          assert.ok(box.left >= box.parentLeft - 1 && box.right <= box.parentRight + 1, `card exceeds choice at ${width}px: ${JSON.stringify(box)}`);
          assert.ok(box.top >= box.parentTop - 1 && box.bottom <= box.parentBottom + 1, `vertical card clipping at ${width}px`);
        }
        await page.screenshot({ path: `onboarding-ui-results/cards-${width}.png` });
        await choices.nth(0).click();
        await choices.nth(1).click(); // Choosing a second GK must replace the first.
        for (const index of [3,6,9,12]) await choices.nth(index).click();
        assert.equal(await page.locator('button[aria-pressed="true"]').count(), 5);
        const confirm = page.getByRole('button', { name: 'Confirm & Mint', exact: true });
        await confirm.click();
        await page.getByRole('heading', { name: 'Your Squad is Ready!', exact: true }).waitFor({ timeout: 10000 });
        assert.equal(mintRequests, 1, 'one mint request');
        await page.screenshot({ path: `onboarding-ui-results/completed-${width}.png` });
        results.push({ width, passed: true, choices: 15, selected: 5, mintRequests });
      } catch (error) {
        results.push({ width, passed: false, error: error.message });
        await page.screenshot({ path: `onboarding-ui-results/failed-${width}.png` }).catch(() => {});
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  fs.writeFileSync('onboarding-ui-results/results.json', JSON.stringify({ scope: 'Isolated frontend fixture; production OAuth and database minting are not covered.', results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(r => !r.passed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const batching = {};
vm.runInNewContext(compile('server/services/pushBatching.ts'), { exports: batching, Map, Set });
const events = [3, 1, 2].map(id => ({ id, notificationId: id, subscriptionId: 1, title: `Event ${id}`, message: 'Detail', dedupeKey: `event:${id}` }));
const groups = batching.groupPushDeliveries([...events, { ...events[0], id: 4, subscriptionId: 2 }]);
assert.equal(groups.length, 2);
assert.equal(groups[0].map(x => x.id).join(','), '1,2,3');
assert.equal(batching.pushBatchMessage(groups[0]).dedupeKey, 'digest');
assert.equal(batching.pushBatchMessage([events[0]]).message, 'Detail');
assert.equal(batching.pushBatchMessage(groups[0]).notificationId, 1, 'Stable tag across retries');
assert.equal(batching.PUSH_QUIET_SECONDS, 300);
const toastPolicy = {};
vm.runInNewContext(compile('client/src/lib/notification-toast-policy.ts'), { exports: toastPolicy, Date });
const now = Date.now();
const recent = [1, 2, 3].map(id => ({ id, read: false, createdAt: new Date(now).toISOString() }));
assert.equal(toastPolicy.pendingToastEvents(recent, { lastShownAt: 0, seenThroughId: 0 }, now).length, 3);
assert.equal(toastPolicy.pendingToastEvents(recent, { lastShownAt: 0, seenThroughId: 3 }, now).length, 0, 'Remount does not replay seen alerts');
assert.equal(toastPolicy.pendingToastEvents(recent, { lastShownAt: now, seenThroughId: 1 }, now + 10000).length, 0);
assert.equal(toastPolicy.pendingToastEvents(recent, { lastShownAt: now, seenThroughId: 1 }, now + 300001).length, 2, 'Buffered events remain visible after cooldown');
assert.equal(toastPolicy.pendingToastEvents([{ ...recent[0], createdAt: new Date(now-86400001).toISOString() }, { ...recent[1], read: true }], { lastShownAt: 0, seenThroughId: 0 }, now).length, 0);

async function main() {
  if (!process.env.TEST_DATABASE_URL) { console.log('Push batching unit cases passed; PostgreSQL integration runs in CI.'); return; }
  const target = new URL(process.env.TEST_DATABASE_URL);
  if (target.pathname !== '/notification_test' || !['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Refusing to use a non-fixture database');
  const { Pool } = require('pg');
  const { drizzle } = require('drizzle-orm/node-postgres');
  const orm = require('drizzle-orm');
  const pool = new Pool({ connectionString: target.href });
  const db = drizzle(pool);
  try {
    for (const native of [false, true]) {
      const subscriptions = native ? 'native_push_subscriptions' : 'web_push_subscriptions';
      const deliveries = native ? 'notification_native_push_deliveries' : 'notification_push_deliveries';
      await pool.query(`drop schema if exists app cascade; create schema app;
        create table app.notifications (id serial primary key, title text, message text, dedupe_key text);
        create table app.${subscriptions} (id bigserial primary key, user_id text, token text, endpoint text, p256dh text, auth text,
          disabled_at timestamp, last_success_at timestamp, failure_count int default 0, updated_at timestamp default now());
        create table app.${deliveries} (id bigserial primary key, notification_id int, subscription_id bigint,
          status text default 'pending', attempts int default 0, next_attempt_at timestamp default now(),
          updated_at timestamp default now(), created_at timestamp default now(), sent_at timestamp, last_error text);
        insert into app.${subscriptions} (user_id, token, endpoint, p256dh, auth) values ('fixture-user','fixture-token','https://push.fixture.test','fixture-key','fixture-auth');`);
      const sent = [];
      let fail = false;
      const send = async (...args) => { if (fail) throw new Error('Fixture transport failure'); sent.push(args); };
      const worker = {};
      const env = { WEB_PUSH_VAPID_PUBLIC_KEY: 'fixture', WEB_PUSH_VAPID_PRIVATE_KEY: 'fixture',
        FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'fixture', client_email: 'fixture@local.test', private_key: 'BEGIN PRIVATE KEY fixture only' }) };
      const source = compile(native ? 'server/services/nativePush.ts' : 'server/services/webPush.ts');
      const extra = '\nexports.claim = claimDueDeliveries; exports.url = notificationUrl;' +
        (native ? '\nsendFcmNotification = async (credentials, delivery) => fixtureSend(delivery);' : '');
      vm.runInNewContext(source + extra, { exports: worker, process: { env }, console, Buffer, Date, URL, URLSearchParams,
        setTimeout, setInterval, fixtureSend: send,
        require: name => {
          if (name === 'node:crypto') return crypto;
          if (name === 'drizzle-orm') return orm;
          if (name.endsWith('/db.js')) return { db };
          if (name.includes('pushBatching')) return batching;
          if (name.includes('notificationHealth')) return { reportNotificationHealth: async () => {} };
          if (name.includes('notifications.js')) return { ensureNotificationsSchema: async () => {}, reconcileRecentTournamentEntryNotifications: async () => 0 };
          if (name === 'web-push') return { setVapidDetails() {}, sendNotification: send };
          throw new Error('Unexpected test import: ' + name);
        },
      });
      assert.equal(worker.url('digest', 1), '/account?tab=inbox');
      const processQueue = native ? worker.processPendingNativePushDeliveries : worker.processPendingWebPushDeliveries;
      async function queue(count, subscription = 1) {
        for (let n = 0; n < count; n++) {
          const result = await pool.query("insert into app.notifications (title,message,dedupe_key) values ('Fixture event','Fixture detail','fixture') returning id");
          await pool.query(`insert into app.${deliveries} (notification_id,subscription_id) values ($1,$2)`, [result.rows[0].id, subscription]);
        }
      }
      await queue(3);
      const first = await processQueue();
      assert.equal(first.sent, 3);
      assert.equal(sent.length, 1, 'Three events produce one device alert');
      assert.equal((await pool.query(`select count(*)::int n from app.${deliveries} where status='sent'`)).rows[0].n, 3);
      await queue(1);
      assert.equal((await processQueue()).claimed, 0, 'Durable cooldown holds later arrivals');
      await pool.query(`update app.${subscriptions} set last_success_at=now()-interval '301 seconds'`);
      assert.equal((await processQueue()).sent, 1, 'Held event is delivered after quiet window');
      await pool.query(`update app.${subscriptions} set last_success_at=null`);
      await queue(2);
      fail = true;
      assert.equal((await processQueue()).failed, 2);
      assert.equal((await pool.query(`select count(*)::int n from app.${deliveries} where status='pending'`)).rows[0].n, 2, 'Failed batch remains retryable');
      fail = false;
      await pool.query(`update app.${deliveries} set next_attempt_at=now()`);
      const other = {};
      vm.runInNewContext(source + '\nexports.claim = claimDueDeliveries;', { exports: other, process: { env }, console, Buffer, Date, URL, URLSearchParams, setTimeout, setInterval,
        require: name => name === 'drizzle-orm' ? orm : name.endsWith('/db.js') ? { db } : name.includes('pushBatching') ? batching : name.includes('notificationHealth') ? { reportNotificationHealth: async () => {} } : name === 'node:crypto' ? crypto : {} });
      const claims = await Promise.all([worker.claim(25), other.claim(25)]);
      assert.equal(claims.flat().length, 2, 'Concurrent workers do not double-claim a subscription');
      assert.equal(claims.filter(rows => rows.length > 0).length, 1);
      assert.equal((await worker.claim(25)).length, 0, 'Fresh processing lease prevents overlap');
      await pool.query(`update app.${deliveries} set updated_at=now()-interval '6 minutes' where status='processing'`);
      assert.equal((await worker.claim(25)).length, 2, 'Expired leases recover after restart');
      console.log(`${native ? 'Native' : 'Web'} push PostgreSQL tests passed: batching, cooldown, retained events, retry, concurrent workers and crash recovery.`);
    }
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { storage } from '../storage.js';

const enabled = () => process.env.ONBOARDING_QA_ENABLED === 'true';
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const rows = (r: any): any[] => r.rows || [];
const save = (req: any) => new Promise<void>((resolve, reject) => req.session.save((e: any) => e ? reject(e) : resolve()));
const login = (req: any, user: any) => new Promise<void>((resolve, reject) => req.logIn(user, (e: any) => e ? reject(e) : resolve()));

async function ensureRegistry() {
  await db.execute(sql`create table if not exists app.onboarding_qa_accounts (
    user_id text primary key, created_at timestamptz not null default now(), expires_at timestamptz not null
  )`);
}

// Walk actual foreign keys, deleting only descendants of this disposable user.
// Never reuse minted serial numbers or touch a real manager's account.
async function deleteDescendants(tx: any, schema: string, table: string, column: string, values: any[], depth = 0) {
  if (!values.length) return;
  if (schema !== 'app' || depth > 12) throw new Error('Unexpected test-account dependency');
  const qualified = sql.raw(`${quote(schema)}.${quote(table)}`);
  const condition = sql`${sql.raw(quote(column))} in (${sql.join(values.map(v => sql`${v}`), sql`, `)})`;
  const dependencies = rows(await tx.execute(sql`select child.relname as child_table, cn.nspname as child_schema,
    ca.attname as child_column, pa.attname as parent_column
    from pg_constraint fk join pg_class parent on parent.oid = fk.confrelid
    join pg_namespace pn on pn.oid = parent.relnamespace
    join pg_class child on child.oid = fk.conrelid join pg_namespace cn on cn.oid = child.relnamespace
    join pg_attribute ca on ca.attrelid = child.oid and ca.attnum = fk.conkey[1]
    join pg_attribute pa on pa.attrelid = parent.oid and pa.attnum = fk.confkey[1]
    where fk.contype = 'f' and pn.nspname = ${schema} and parent.relname = ${table}
      and array_length(fk.conkey,1) = 1`));
  for (const dep of dependencies) {
    const ids = rows(await tx.execute(sql`select distinct ${sql.raw(quote(dep.parent_column))} as value from ${qualified} where ${condition}`)).map(r => r.value).filter(v => v != null);
    if (dep.child_table === table && dep.child_schema === schema) continue;
    await deleteDescendants(tx, dep.child_schema, dep.child_table, dep.child_column, ids, depth + 1);
  }
  await tx.execute(sql`delete from ${qualified} where ${condition}`);
}

async function cleanup(userId: string) {
  if (!/^qa-onboarding-[a-f0-9-]{36}$/.test(userId)) throw new Error('Not a temporary onboarding account');
  await db.transaction(async tx => {
    const registered = rows(await tx.execute(sql`select user_id from app.onboarding_qa_accounts where user_id = ${userId} for update`));
    if (!registered.length) return;
    const risky = rows(await tx.execute(sql`select 1 from app.wallets where user_id = ${userId} and (balance <> 0 or locked_balance <> 0)
      union all select 1 from app.competition_entries where user_id = ${userId}
      union all select 1 from app.transactions where user_id = ${userId} limit 1`));
    if (risky.length) throw new Error('Test account has financial activity; automatic cleanup stopped');
    await deleteDescendants(tx, 'app', 'users', 'id', [userId]);
    await tx.execute(sql`delete from app.onboarding_qa_accounts where user_id = ${userId}`);
  });
  const remaining = rows(await db.execute(sql`select (select count(*) from app.users where id = ${userId})::int as users, (select count(*) from app.player_cards where owner_id = ${userId})::int as cards`))[0];
  console.log('[onboarding-qa-cleaned]', { userId, ...remaining });
}

export function registerOnboardingAuditRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  app.use((req: any, res, next) => {
    const qa = req.session?.onboardingQA;
    if (!qa || req.user?.id !== qa.userId) return next();
    const isFinish = req.path === '/api/onboarding-audit/finish';
    if ((!enabled() || Date.now() > qa.expiresAt) && !isFinish) return res.status(410).send('Onboarding test ended. Return to the test controls to finish cleanup.');
    // Only the admin-created disposable session may be framed by its own origin.
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    const csp = String(res.getHeader('Content-Security-Policy') || '');
    if (csp) res.setHeader('Content-Security-Policy', csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'").replace("frame-src 'none'", "frame-src 'self'"));
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && !isFinish &&
      !['/api/onboarding/create-offer','/api/onboarding/choose','/api/user/profile','/api/audit/client-event'].includes(req.path)) {
      return res.status(403).json({ message: 'Temporary onboarding account cannot trade, enter tournaments or move money.' });
    }
    if (req.path === '/api/user/profile' && !['GET','HEAD'].includes(req.method) && Object.keys(req.body || {}).some(key => key !== 'managerTeamName')) return res.status(403).json({ message: 'Only the test club name can be changed.' });
    next();
  });
  app.get('/api/admin/onboarding-audit/status', deps.requireAuth, deps.isAdmin, (_req, res) => res.json({ enabled: enabled() }));

  app.post('/api/admin/onboarding-audit/start', deps.requireAuth, deps.isAdmin, async (req: any, res) => {
    if (!enabled()) return res.status(404).send('Onboarding test is disabled.');
    try {
      await ensureRegistry();
      const userId = `qa-onboarding-${randomUUID()}`;
      const expiresAt = Date.now() + 60 * 60 * 1000;
      const adminUser = req.user;
      await storage.createUser({ id: userId, email: `${userId}@local.test`, name: 'Temporary onboarding test' });
      await storage.createWallet({ userId, balance: 0, lockedBalance: 0 } as any);
      await db.execute(sql`insert into app.onboarding_qa_accounts (user_id, expires_at) values (${userId}, ${new Date(expiresAt)})`);
      await login(req, { id: userId, email: `${userId}@local.test`, name: 'Temporary onboarding test' });
      req.session.onboardingQA = { userId, expiresAt, adminUser };
      await save(req);
      res.redirect(303, '/onboarding-audit');
    } catch (e: any) { console.error('Onboarding test setup failed:', e); res.status(500).send('Could not start temporary onboarding test.'); }
  });

  app.get('/onboarding-audit', deps.requireAuth, (req: any, res) => {
    if (!req.session?.onboardingQA) return res.status(403).send('Start this test from Admin.');
    const width = [320,360,390,414,768,1280].includes(Number(req.query.width)) ? Number(req.query.width) : 390;
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Temporary onboarding test</title></head><body style="margin:0;background:#02040d;color:white;font:14px system-ui"><header style="padding:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><strong>Temporary onboarding account · N$0</strong>${[320,360,390,414,768,1280].map(w => `<a style="color:#67e8f9" href="?width=${w}">${w}px</a>`).join('')}<form method="post" action="/api/onboarding-audit/finish"><button>Finish test and remove dummy account</button></form></header><p style="padding:0 12px">Real signup screens in a ${width}px viewport. Keep this tab open to finish cleanup.</p><main style="overflow:auto;padding:8px"><iframe title="Onboarding test viewport" src="/" style="display:block;width:${width}px;height:740px;border:1px solid #334155;margin:auto"></iframe></main></body></html>`);
  });

  app.post('/api/onboarding-audit/finish', deps.requireAuth, async (req: any, res) => {
    const qa = req.session?.onboardingQA;
    if (!qa || qa.userId !== req.user?.id) return res.status(403).send('No temporary onboarding session.');
    try {
      await cleanup(qa.userId);
      await login(req, qa.adminUser);
      await save(req);
      res.redirect(303, '/admin');
    } catch (e: any) { console.error('Onboarding test cleanup failed:', e); res.status(500).send('Cleanup could not finish; test data has been preserved for review.'); }
  });
}

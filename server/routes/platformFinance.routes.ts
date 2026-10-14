import type { Express } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { getPlatformFinance } from '../services/platformFinance.js';
import { postWalletAmountExactlyOnce, toPostingMoney } from '../services/walletPosting.js';

export function registerPlatformFinanceRoutes(app: Express, { requireAuth, isAdmin }: { requireAuth: any; isAdmin: any }) {
  app.get('/api/admin/free-cup-prize-entries', requireAuth, isAdmin, async (_req, res) => {
    try {
      const result = await db.execute(sql`select ce.id, c.name as competition, c.game_week as "gameweek", ce.rank,
        coalesce(u.manager_team_name, u.name, 'Manager') as club
        from app.competition_entries ce join app.competitions c on c.id = ce.competition_id join app.users u on u.id = ce.user_id
        where c.entry_fee = 0 and c.status::text = 'completed' and c.name not like '[TEST]%'
        order by c.game_week desc, c.id desc, ce.rank asc nulls last, ce.id`);
      return res.json(result.rows);
    } catch { return res.status(500).json({ message: 'Unable to load free cup entries' }); }
  });
  app.get('/api/admin/platform-finance', requireAuth, isAdmin, async (_req, res) => {
    try { return res.json(await getPlatformFinance()); }
    catch (error) { console.error('Platform finance failed', error); return res.status(500).json({ message: 'Finance summary unavailable' }); }
  });
  app.post('/api/admin/free-cup-cash-prize', requireAuth, isAdmin, async (req: any, res) => {
    try {
      const entryId = Number(req.body?.entryId);
      const amount = toPostingMoney(req.body?.amount);
      const requestKey = String(req.headers['idempotency-key'] || '').trim();
      if (!Number.isInteger(entryId) || entryId <= 0 || amount <= 0 || amount > 100000 || !/^[a-zA-Z0-9._-]{8,80}$/.test(requestKey)) return res.status(400).json({ message: 'Valid entry, prize amount and Idempotency-Key required' });
      const result = await db.transaction(async tx => {
        const entry = (await tx.execute(sql`select ce.user_id, c.id as competition_id from app.competition_entries ce
          join app.competitions c on c.id = ce.competition_id where ce.id = ${entryId}
          and c.entry_fee = 0 and c.status::text = 'completed' and c.name not like '[TEST]%' for update of ce`)).rows[0] as any;
        if (!entry) throw new Error('Choose an entry from a completed free cup');
        return postWalletAmountExactlyOnce(tx, {
          postingKey: `free-cup-surprise:${entryId}:${requestKey}`, userId: entry.user_id, amount,
          transactionType: 'prize', sourceType: 'free_cup_surprise_prize',
          description: `Surprise cash prize for free cup #${entry.competition_id}`,
          actorUserId: req.authUserId || req.user?.id, bindActor: true,
          reason: 'Owner-funded surprise prize', metadata: { entryId, competitionId: entry.competition_id },
          auditAction: 'admin.free_cup_surprise_prize',
        });
      });
      return res.json({ success: true, ...result });
    } catch (error: any) { return res.status(400).json({ message: error.message || 'Unable to award prize' }); }
  });
}

import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function isAdminUser(userId: string) {
  if (!userId) return false;
  const configuredIds = String(process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configuredIds.includes(userId)) return true;

  const configuredEmails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const user = rowsOf(
    await db.execute(sql`select lower(coalesce(email, '')) as email from app.users where id=${userId} limit 1`),
  )[0];
  return Boolean(user?.email && configuredEmails.includes(String(user.email).toLowerCase()));
}

export function registerTestSimulatorCleanupRoutes(app: Express, deps: { requireAuth: any }) {
  const { requireAuth } = deps;

  app.delete("/api/admin/simulator/cleanup", requireAuth, async (req: any, res) => {
    try {
      const adminId = String(req.authUserId || "");
      if (!(await isAdminUser(adminId))) return res.status(403).json({ message: "Admin access required" });

      const counts = rowsOf(await db.execute(sql`
        select
          (select count(*)::int from app.competitions where name like '[TEST]%') as tournaments,
          (select count(*)::int
             from app.competition_entries ce
             join app.competitions c on c.id=ce.competition_id
            where c.name like '[TEST]%') as entries,
          (select count(*)::int from app.player_cards where owner_id like 'test-bot-%') as cards,
          (select count(*)::int from app.users where id like 'test-bot-%') as bots
      `))[0] || {};

      await db.transaction(async (tx) => {
        await tx.execute(sql`
          delete from app.notifications
          where user_id in (select id from app.users where id like 'test-bot-%')
        `).catch(() => undefined);

        await tx.execute(sql`
          delete from app.competition_entries
          where competition_id in (
            select id from app.competitions where name like '[TEST]%'
          )
        `);

        await tx.execute(sql`
          delete from app.competitions
          where name like '[TEST]%'
        `);

        await tx.execute(sql`
          delete from app.player_cards
          where owner_id like 'test-bot-%'
        `);

        await tx.execute(sql`
          delete from app.wallets
          where user_id like 'test-bot-%'
        `).catch(() => undefined);

        await tx.execute(sql`
          delete from app.transactions
          where user_id like 'test-bot-%' or source_type='admin_test'
        `).catch(() => undefined);

        await tx.execute(sql`
          delete from app.users
          where id like 'test-bot-%'
        `);
      });

      await db.execute(sql`
        insert into app.audit_logs (user_id, action, meta)
        values (${adminId}, 'admin.simulator.cleanup', ${JSON.stringify(counts)}::jsonb)
      `).catch(() => undefined);

      return res.json({
        success: true,
        deletedTournaments: Number(counts.tournaments || 0),
        deletedEntries: Number(counts.entries || 0),
        deletedCards: Number(counts.cards || 0),
        deletedBots: Number(counts.bots || 0),
      });
    } catch (error: any) {
      console.error("Failed to clean simulator test data:", error);
      return res.status(500).json({ message: error?.message || "Failed to clean simulator test data" });
    }
  });
}

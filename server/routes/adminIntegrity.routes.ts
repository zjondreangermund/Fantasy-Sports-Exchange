import type { Express } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import { getWalletReconciliationReport, repairSafeMissingWallets } from "../services/walletReconciliation.js";
import { getCompetitionRewardIntegrity, repairCompetitionRewards } from "../services/tournamentRewards.js";

interface RegisterAdminIntegrityRoutesDeps {
  requireAuth: any;
  isAdmin: any;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

export function registerAdminIntegrityRoutes(app: Express, deps: RegisterAdminIntegrityRoutesDeps) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/admin/wallet/integrity", requireAuth, isAdmin, async (_req, res) => {
    try { return res.json(await getWalletReconciliationReport()); }
    catch (error: any) { return res.status(500).json({ message: error?.message || "Failed to inspect wallets" }); }
  });

  app.post("/api/admin/wallet/repair-missing", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const result = await repairSafeMissingWallets(String(req.authUserId || ""));
      return res.json({ success: true, ...result });
    } catch (error: any) { return res.status(500).json({ message: error?.message || "Failed to repair wallets" }); }
  });

  app.get("/api/admin/marketplace/integrity", requireAuth, isAdmin, async (_req, res) => {
    try {
      const invalid = rowsOf(await db.execute(sql`
        select id, owner_id as "ownerId", rarity::text as rarity, price, serial_id as "serialId",
          case
            when owner_id is null then 'missing_owner'
            when coalesce(price, 0) <= 0 then 'invalid_price'
            when rarity::text = 'common' then 'common_not_tradable'
            else 'unknown'
          end as reason
        from app.player_cards
        where for_sale = true
          and (owner_id is null or coalesce(price, 0) <= 0 or rarity::text = 'common')
        order by id
      `));
      return res.json({ summary: { invalidListings: invalid.length }, rows: invalid });
    } catch (error: any) { return res.status(500).json({ message: error?.message || "Failed to inspect marketplace" }); }
  });

  app.post("/api/admin/marketplace/repair-listings", requireAuth, isAdmin, async (_req, res) => {
    try {
      const repaired = rowsOf(await db.execute(sql`
        update app.player_cards
        set for_sale = false, price = 0
        where for_sale = true
          and (owner_id is null or coalesce(price, 0) <= 0 or rarity::text = 'common')
        returning id, serial_id as "serialId"
      `));
      return res.json({ success: true, repairedCount: repaired.length, repaired });
    } catch (error: any) { return res.status(500).json({ message: error?.message || "Failed to repair listings" }); }
  });

  app.get("/api/admin/cards/integrity", requireAuth, isAdmin, async (_req, res) => {
    try {
      const missing = rowsOf(await db.execute(sql`
        select id, owner_id as "ownerId", serial_id as "serialId"
        from app.player_cards
        where serial_id is null or btrim(serial_id) = ''
        order by id
      `));
      const duplicates = rowsOf(await db.execute(sql`
        select serial_id as "serialId", count(*)::int as count, array_agg(id order by id) as "cardIds"
        from app.player_cards
        where serial_id is not null and btrim(serial_id) <> ''
        group by serial_id
        having count(*) > 1
        order by count(*) desc, serial_id
      `));
      return res.json({ summary: { missingSerials: missing.length, duplicateSerialGroups: duplicates.length }, missing, duplicates });
    } catch (error: any) { return res.status(500).json({ message: error?.message || "Failed to inspect cards" }); }
  });

  app.post("/api/admin/cards/repair-serials", requireAuth, isAdmin, async (_req, res) => {
    try {
      const missing = rowsOf(await db.execute(sql`
        update app.player_cards
        set serial_id = concat('FA-REPAIR-', id)
        where serial_id is null or btrim(serial_id) = ''
        returning id, serial_id as "serialId"
      `));
      const duplicates = rowsOf(await db.execute(sql`
        with ranked as (
          select id, serial_id, row_number() over (partition by serial_id order by id) as rn
          from app.player_cards
          where serial_id is not null and btrim(serial_id) <> ''
        )
        update app.player_cards pc
        set serial_id = concat('FA-REPAIR-', pc.id)
        from ranked r
        where pc.id = r.id and r.rn > 1
        returning pc.id, pc.serial_id as "serialId"
      `));
      return res.json({ success: true, repairedCount: missing.length + duplicates.length, missing, duplicates });
    } catch (error: any) { return res.status(500).json({ message: error?.message || "Failed to repair card serials" }); }
  });

  app.get("/api/admin/competitions/:id/reward-integrity", requireAuth, isAdmin, async (req, res) => {
    try { return res.json(await getCompetitionRewardIntegrity(Number(req.params.id))); }
    catch (error: any) { return res.status(400).json({ message: error?.message || "Failed to inspect rewards" }); }
  });

  app.post("/api/admin/competitions/:id/repair-rewards", requireAuth, isAdmin, async (req, res) => {
    try { return res.json(await repairCompetitionRewards(Number(req.params.id))); }
    catch (error: any) { return res.status(400).json({ message: error?.message || "Failed to repair rewards" }); }
  });
}

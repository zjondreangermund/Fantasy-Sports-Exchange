import type { Express } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import { getWalletReconciliationReport, repairSafeMissingWallets } from "../services/walletReconciliation.js";
import { getCompetitionRewardIntegrity, repairCompetitionRewards } from "../services/tournamentRewards.js";
import {
  ensureAdminTournamentEntryRemovalSchema,
  removeTournamentEntryWithRefund,
} from "../services/adminTournamentEntryRemoval.js";

interface RegisterAdminIntegrityRoutesDeps {
  requireAuth: any;
  isAdmin: any;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function toMoney(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function tournamentCategory(row: any) {
  const prizeKey = String(row.prizeKey || "").toLowerCase();
  const prizeType = String(row.prizeType || "").toLowerCase();
  const entryFee = Number(row.entryFee || 0);
  if (prizeKey === "user-cash" || prizeType === "cash_pool") return "user-cash";
  if (prizeKey.startsWith("free-") || entryFee <= 0) return "free-cup";
  return "prize-ladder";
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

  app.get("/api/admin/tournament-directory", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      await ensureAdminTournamentEntryRemovalSchema();
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      const raw = rowsOf(await db.execute(sql`
        select
          c.id, c.name, c.tier::text as tier, c.status::text as status,
          c.game_week as "gameWeek", coalesce(c.entry_fee, 0)::float as "entryFee",
          coalesce(c.max_entries, 0)::int as "maxEntries", c.visibility,
          c.prize_type as "prizeType", c.prize_key as "prizeKey",
          c.prize_description as "prizeDescription", c.prize_card_rarity::text as "prizeCardRarity",
          coalesce(c.platform_fee_rate, 0)::float as "platformFeeRate",
          coalesce(c.platform_fee_total, 0)::float as "platformFeeTotal",
          coalesce(c.prize_pool_total, 0)::float as "prizePoolTotal",
          coalesce(c.refund_total, 0)::float as "cancellationRefundTotal",
          coalesce(c.refunded_entry_count, 0)::int as "cancelledRefundedEntries",
          c.start_date as "startDate", c.end_date as "endDate",
          c.created_by_user_id as "createdByUserId",
          coalesce(creator.manager_team_name, creator.name, creator.email, 'Fantasy Arena') as "creatorName",
          coalesce(active.entry_count, 0)::int as "entryCount",
          coalesce(active.unique_managers, 0)::int as "uniqueManagers",
          coalesce(active.received, 0)::float as "activeEntryAmount",
          coalesce(removed.removed_count, 0)::int as "adminRemovedCount",
          coalesce(removed.refund_total, 0)::float as "adminRemovalRefundTotal",
          coalesce(removed.original_entry_amount, 0)::float as "adminRemovedOriginalAmount"
        from app.competitions c
        left join app.users creator on creator.id = c.created_by_user_id
        left join lateral (
          select count(*) as entry_count,
            count(distinct ce.user_id) as unique_managers,
            sum(coalesce(ce.entry_fee_paid, 0)) as received
          from app.competition_entries ce
          where ce.competition_id = c.id
        ) active on true
        left join lateral (
          select count(*) as removed_count,
            sum(coalesce(r.refund_amount, 0)) as refund_total,
            sum(coalesce(r.entry_fee_paid, 0)) as original_entry_amount
          from app.competition_entry_admin_removals r
          where r.competition_id = c.id
        ) removed on true
        where c.name not like '[TEST]%'
        order by c.game_week asc, c.id asc
      `));

      const tournaments = raw.map((row: any) => {
        const status = String(row.status || "").toLowerCase();
        const activeEntryAmount = toMoney(row.activeEntryAmount);
        const adminRemovalRefundTotal = toMoney(row.adminRemovalRefundTotal);
        const cancellationRefundTotal = toMoney(row.cancellationRefundTotal);
        const retainedEntryAmount = status === "cancelled" ? 0 : activeEntryAmount;
        return {
          ...row,
          id: Number(row.id || 0),
          gameWeek: Number(row.gameWeek || 0),
          entryCount: Number(row.entryCount || 0),
          uniqueManagers: Number(row.uniqueManagers || 0),
          entryFee: toMoney(row.entryFee),
          maxEntries: Number(row.maxEntries || 0),
          activeEntryAmount,
          retainedEntryAmount,
          historicEntryAmount: toMoney(activeEntryAmount + Number(row.adminRemovedOriginalAmount || 0)),
          adminRemovedCount: Number(row.adminRemovedCount || 0),
          adminRemovalRefundTotal,
          cancellationRefundTotal,
          totalRefunds: toMoney(adminRemovalRefundTotal + cancellationRefundTotal),
          platformFeeTotal: toMoney(row.platformFeeTotal),
          prizePoolTotal: toMoney(row.prizePoolTotal),
          category: tournamentCategory(row),
        };
      });

      const gameWeeks = Array.from(new Set(tournaments.map((row: any) => Number(row.gameWeek || 0)).filter(Boolean))).sort((a, b) => a - b);
      return res.json({ updatedAt: new Date().toISOString(), gameWeeks, tournaments });
    } catch (error: any) {
      console.error("Failed to load admin tournament directory:", error);
      return res.status(500).json({ message: error?.message || "Failed to load tournament directory" });
    }
  });

  app.get("/api/admin/competitions/:id/entrants", requireAuth, isAdmin, async (req: any, res) => {
    try {
      await ensureAdminTournamentEntryRemovalSchema();
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament ID required" });
      res.setHeader("Cache-Control", "private, no-store, max-age=0");

      const tournament = rowsOf(await db.execute(sql`
        select c.id, c.name, c.tier::text as tier, c.status::text as status,
          c.game_week as "gameWeek", coalesce(c.entry_fee, 0)::float as "entryFee",
          coalesce(c.max_entries, 0)::int as "maxEntries", c.visibility,
          c.prize_type as "prizeType", c.prize_key as "prizeKey",
          c.prize_description as "prizeDescription", c.prize_card_rarity::text as "prizeCardRarity",
          coalesce(c.platform_fee_rate, 0)::float as "platformFeeRate",
          coalesce(c.platform_fee_total, 0)::float as "platformFeeTotal",
          coalesce(c.prize_pool_total, 0)::float as "prizePoolTotal",
          coalesce(c.refund_total, 0)::float as "cancellationRefundTotal",
          c.start_date as "startDate", c.end_date as "endDate",
          c.created_by_user_id as "createdByUserId",
          coalesce(creator.manager_team_name, creator.name, creator.email, 'Fantasy Arena') as "creatorName"
        from app.competitions c
        left join app.users creator on creator.id = c.created_by_user_id
        where c.id = ${competitionId}
        limit 1
      `))[0];
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });

      const entrants = rowsOf(await db.execute(sql`
        select ce.id as "entryId", ce.user_id as "userId",
          coalesce(u.manager_team_name, u.name, u.email, ce.user_id) as "teamName",
          u.email, coalesce(w.balance, 0)::float as "walletBalance",
          coalesce(ce.entry_fee_paid, 0)::float as "entryFeePaid",
          coalesce(ce.lineup_card_ids, '[]'::jsonb) as "lineupCardIds",
          ce.captain_id as "captainId", coalesce(ce.total_score, 0)::float as "totalScore",
          ce.rank, coalesce(ce.prize_amount, 0)::float as "prizeAmount",
          ce.prize_card_id as "prizeCardId", ce.joined_at as "joinedAt"
        from app.competition_entries ce
        left join app.users u on u.id = ce.user_id
        left join app.wallets w on w.user_id = ce.user_id
        where ce.competition_id = ${competitionId}
        order by coalesce(ce.rank, 2147483647), ce.joined_at asc, ce.id asc
      `));

      const removed = rowsOf(await db.execute(sql`
        select r.entry_id as "entryId", r.user_id as "userId",
          coalesce(u.manager_team_name, u.name, u.email, r.user_id) as "teamName",
          u.email, coalesce(r.entry_fee_paid, 0)::float as "entryFeePaid",
          coalesce(r.lineup_card_ids, '[]'::jsonb) as "lineupCardIds",
          r.captain_id as "captainId", coalesce(r.total_score, 0)::float as "totalScore",
          r.rank, coalesce(r.prize_amount, 0)::float as "prizeAmount",
          r.prize_card_id as "prizeCardId", r.joined_at as "joinedAt",
          coalesce(r.refund_amount, 0)::float as "refundAmount",
          r.refund_transaction_id as "refundTransactionId",
          r.removed_by as "removedBy", r.removal_reason as "removalReason", r.removed_at as "removedAt"
        from app.competition_entry_admin_removals r
        left join app.users u on u.id = r.user_id
        where r.competition_id = ${competitionId}
        order by r.removed_at desc, r.entry_id desc
      `));

      const activeEntryAmount = toMoney(entrants.reduce((sum: number, row: any) => sum + Number(row.entryFeePaid || 0), 0));
      const adminRemovalRefundTotal = toMoney(removed.reduce((sum: number, row: any) => sum + Number(row.refundAmount || 0), 0));
      const status = String(tournament.status || "").toLowerCase();
      return res.json({
        tournament: {
          ...tournament,
          id: Number(tournament.id || 0),
          gameWeek: Number(tournament.gameWeek || 0),
          entryFee: toMoney(tournament.entryFee),
          maxEntries: Number(tournament.maxEntries || 0),
          category: tournamentCategory(tournament),
          activeEntryAmount,
          retainedEntryAmount: status === "cancelled" ? 0 : activeEntryAmount,
          adminRemovalRefundTotal,
          totalRefunds: toMoney(adminRemovalRefundTotal + Number(tournament.cancellationRefundTotal || 0)),
        },
        entrants,
        removed,
      });
    } catch (error: any) {
      console.error("Failed to load admin tournament entrants:", error);
      return res.status(500).json({ message: error?.message || "Failed to load tournament entrants" });
    }
  });

  app.post("/api/admin/competitions/:id/entrants/:entryId/remove", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const competitionId = Number(req.params.id);
      const entryId = Number(req.params.entryId);
      const actorId = String(req.authUserId || req.user?.claims?.sub || req.user?.id || "");
      const reason = String(req.body?.reason || "Administrative removal").trim();
      if (reason.length < 3) return res.status(400).json({ message: "Please provide a short reason for the entrant removal" });
      const result = await removeTournamentEntryWithRefund({ competitionId, entryId, actorId, reason });
      return res.json(result);
    } catch (error: any) {
      console.error("Failed to remove/refund tournament entrant:", error);
      const message = error?.message || "Failed to remove tournament entrant";
      const status = /not found/i.test(message) ? 404 : /completed|cancelled|prize|valid|required/i.test(message) ? 400 : 500;
      return res.status(status).json({ message });
    }
  });
}

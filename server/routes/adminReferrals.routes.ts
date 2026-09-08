import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { reconcileReferralHistory } from "../services/referralHistoryReconciliation.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function num(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function registerAdminReferralRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/admin/referrals", requireAuth, isAdmin, async (req: any, res) => {
    try {
      await reconcileReferralHistory();
      res.setHeader("Cache-Control", "private, no-store, max-age=0");

      const search = String(req.query.q || "").trim().toLowerCase();
      const requestedLimit = Math.floor(num(req.query.limit || 250));
      const limit = Math.max(25, Math.min(500, requestedLimit || 250));

      const schemaRows = rowsOf(await db.execute(sql`
        select table_name as "tableName", column_name as "columnName"
        from information_schema.columns
        where table_schema='app'
          and table_name in ('referrals', 'referral_codes')
      `));
      const referralColumns = new Set(schemaRows.filter((row: any) => row.tableName === "referrals").map((row: any) => String(row.columnName)));
      const codeColumns = new Set(schemaRows.filter((row: any) => row.tableName === "referral_codes").map((row: any) => String(row.columnName)));
      const requiredReferralColumns = ["id", "referrer_user_id", "referred_user_id", "referral_code", "reward_card_id", "status", "created_at"];
      const requiredCodeColumns = ["user_id", "code", "created_at"];
      const missingSchema = [
        ...requiredReferralColumns.filter((column) => !referralColumns.has(column)).map((column) => `referrals.${column}`),
        ...requiredCodeColumns.filter((column) => !codeColumns.has(column)).map((column) => `referral_codes.${column}`),
      ];

      const summaryRow = rowsOf(await db.execute(sql`
        select
          count(*)::int as "totalReferrals",
          count(*) filter (where reward_card_id is not null)::int as "rewardedReferrals",
          count(*) filter (where reward_card_id is null)::int as "withoutRewardCard",
          count(distinct referrer_user_id)::int as "uniqueReferrers",
          count(*) filter (where created_at >= now() - interval '24 hours')::int as "last24h",
          count(*) filter (where created_at >= now() - interval '7 days')::int as "last7d"
        from app.referrals
      `))[0] || {};

      const codeSummaryRow = rowsOf(await db.execute(sql`
        select
          count(*)::int as "totalCodes",
          count(distinct user_id)::int as "codeOwners",
          count(distinct upper(btrim(code)))::int as "distinctCodes",
          count(*) filter (where nullif(btrim(code), '') is null)::int as "blankCodes",
          count(*) filter (where exists (
            select 1 from app.referrals r
            where upper(btrim(coalesce(r.referral_code, ''))) = upper(btrim(referral_codes.code))
          ))::int as "usedCodes"
        from app.referral_codes
      `))[0] || {};

      const claimSummaryRow = rowsOf(await db.execute(sql`
        select
          count(*) filter (where action='referral.claim.success')::int as "claimSuccess",
          count(*) filter (where action='referral.claim.duplicate')::int as "claimDuplicate",
          count(*) filter (where action='referral.claim.rejected')::int as "claimRejected",
          count(*) filter (where action='referral.claim.failed')::int as "claimFailed"
        from app.audit_logs
      `))[0] || {};

      const rawRows = rowsOf(await db.execute(sql`
        select
          r.id,
          r.referrer_user_id as "referrerUserId",
          coalesce(referrer.manager_team_name, referrer.name, referrer.email, r.referrer_user_id) as "referrerName",
          referrer.email as "referrerEmail",
          r.referred_user_id as "referredUserId",
          coalesce(referred.manager_team_name, referred.name, referred.email, r.referred_user_id) as "referredName",
          referred.email as "referredEmail",
          r.referral_code as "referralCode",
          r.reward_card_id as "rewardCardId",
          r.status,
          r.created_at as "createdAt",
          rc.user_id as "codeOwnerId",
          pc.owner_id as "rewardOwnerId",
          pc.serial_id as "rewardSerialId",
          pc.rarity::text as "rewardRarity",
          p.name as "rewardPlayerName",
          p.team as "rewardPlayerTeam",
          p.position::text as "rewardPlayerPosition"
        from app.referrals r
        left join app.users referrer on referrer.id = r.referrer_user_id
        left join app.users referred on referred.id = r.referred_user_id
        left join app.referral_codes rc on upper(btrim(rc.code)) = upper(btrim(coalesce(r.referral_code, '')))
        left join app.player_cards pc on pc.id = r.reward_card_id
        left join app.players p on p.id = pc.player_id
        order by r.created_at desc nulls last, r.id desc
        limit ${limit}
      `));

      const referrals = rawRows.map((row: any) => {
        const issues: string[] = [];
        if (!row.referrerUserId) issues.push("Missing referrer");
        if (!row.referredUserId) issues.push("Missing referred user");
        if (!String(row.referralCode || "").trim()) issues.push("Missing referral code");
        if (row.referralCode && !row.codeOwnerId) issues.push("Referral code not found");
        if (row.codeOwnerId && row.referrerUserId && String(row.codeOwnerId) !== String(row.referrerUserId)) issues.push("Referral code belongs to another user");
        if (row.rewardCardId && !row.rewardOwnerId) issues.push("Reward card missing/unowned");
        if (row.rewardOwnerId && row.referrerUserId && String(row.rewardOwnerId) !== String(row.referrerUserId)) issues.push("Reward card owned by another user");
        return { ...row, healthy: issues.length === 0, issues };
      }).filter((row: any) => {
        if (!search) return true;
        const haystack = [
          row.id,
          row.referrerName,
          row.referrerEmail,
          row.referrerUserId,
          row.referredName,
          row.referredEmail,
          row.referredUserId,
          row.referralCode,
          row.rewardCardId,
          row.rewardSerialId,
          row.rewardPlayerName,
          row.status,
          row.issues?.join(" "),
        ].map((value) => String(value || "").toLowerCase()).join(" ");
        return haystack.includes(search);
      });

      const referralCodes = rowsOf(await db.execute(sql`
        select
          rc.user_id as "ownerUserId",
          coalesce(u.manager_team_name, u.name, u.email, rc.user_id) as "ownerName",
          u.email as "ownerEmail",
          rc.code,
          rc.created_at as "createdAt",
          count(r.id)::int as "confirmedReferrals",
          count(r.id) filter (where r.reward_card_id is not null)::int as "rewardsGranted",
          max(r.created_at) as "lastReferralAt"
        from app.referral_codes rc
        left join app.users u on u.id=rc.user_id
        left join app.referrals r
          on upper(btrim(coalesce(r.referral_code, ''))) = upper(btrim(rc.code))
        group by rc.user_id, u.manager_team_name, u.name, u.email, rc.code, rc.created_at
        order by "confirmedReferrals" desc, "lastReferralAt" desc nulls last, rc.created_at desc nulls last
        limit 500
      `)).map((row: any) => ({
        ...row,
        used: num(row.confirmedReferrals) > 0,
      })).filter((row: any) => {
        if (!search) return true;
        return [row.ownerUserId, row.ownerName, row.ownerEmail, row.code, row.confirmedReferrals]
          .map((value) => String(value || "").toLowerCase())
          .join(" ")
          .includes(search);
      });

      const topReferrers = rowsOf(await db.execute(sql`
        select
          r.referrer_user_id as "userId",
          coalesce(u.manager_team_name, u.name, u.email, r.referrer_user_id) as name,
          u.email,
          count(*)::int as referrals,
          count(*) filter (where r.reward_card_id is not null)::int as rewards,
          max(r.created_at) as "lastReferralAt"
        from app.referrals r
        left join app.users u on u.id = r.referrer_user_id
        where r.referrer_user_id is not null
        group by r.referrer_user_id, u.manager_team_name, u.name, u.email
        order by referrals desc, "lastReferralAt" desc nulls last
        limit 25
      `));

      const recentAudit = rowsOf(await db.execute(sql`
        select
          al.id,
          al.user_id as "userId",
          coalesce(u.manager_team_name, u.name, u.email, al.user_id) as "userName",
          u.email,
          al.action,
          al.meta,
          al.created_at as "createdAt"
        from app.audit_logs al
        left join app.users u on u.id = al.user_id
        where al.action like 'referral.%'
           or al.action='admin.referral_history_reconciled'
        order by al.created_at desc
        limit 100
      `));

      const unhealthyRows = referrals.filter((row: any) => !row.healthy);
      const totalCodes = num(codeSummaryRow.totalCodes);
      const distinctCodes = num(codeSummaryRow.distinctCodes);
      const duplicateCodeRows = Math.max(0, totalCodes - distinctCodes);
      const usedCodes = num(codeSummaryRow.usedCodes);
      const unusedCodes = Math.max(0, totalCodes - usedCodes);
      const summary = {
        totalReferrals: num(summaryRow.totalReferrals),
        rewardedReferrals: num(summaryRow.rewardedReferrals),
        withoutRewardCard: num(summaryRow.withoutRewardCard),
        uniqueReferrers: num(summaryRow.uniqueReferrers),
        last24h: num(summaryRow.last24h),
        last7d: num(summaryRow.last7d),
        totalCodes,
        codeOwners: num(codeSummaryRow.codeOwners),
        distinctCodes,
        usedCodes,
        unusedCodes,
        duplicateCodeRows,
        blankCodes: num(codeSummaryRow.blankCodes),
        claimSuccess: num(claimSummaryRow.claimSuccess),
        claimDuplicate: num(claimSummaryRow.claimDuplicate),
        claimRejected: num(claimSummaryRow.claimRejected),
        claimFailed: num(claimSummaryRow.claimFailed),
        unhealthyRows: unhealthyRows.length,
        schemaHealthy: missingSchema.length === 0,
        healthy: missingSchema.length === 0 && unhealthyRows.length === 0 && duplicateCodeRows === 0 && num(codeSummaryRow.blankCodes) === 0,
      };

      return res.json({
        summary,
        missingSchema,
        referrals,
        referralCodes,
        topReferrers,
        recentAudit,
        checkedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Failed to fetch admin referrals:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch referral monitoring" });
    }
  });
}

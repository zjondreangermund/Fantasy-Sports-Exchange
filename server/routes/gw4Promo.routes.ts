import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

export const GW4_PROMO_CAMPAIGN = "gw4_free_common_2026";

function clean(value: unknown, max = 160) {
  return String(value || "").trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function requestUserId(req: any) {
  return String(req.authUserId || req.user?.id || req.user?.claims?.sub || "").trim();
}

function normalizeSource(value: unknown) {
  const raw = clean(value, 240).toLowerCase();
  if (/instagram/.test(raw)) return "instagram";
  if (/facebook|fb\.com|m\.facebook|l\.facebook/.test(raw)) return "facebook";
  if (/tiktok|bytedance/.test(raw)) return "tiktok";
  if (/whatsapp/.test(raw)) return "whatsapp";
  if (!raw) return "direct";
  return raw.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 40) || "other";
}

export function registerGw4PromoRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

  app.post("/api/promo/gw4-free/event", async (req: any, res) => {
    try {
      const allowed = new Set([
        "promo_click",
        "promo_signup_click",
        "tournament_open_after_signup",
        "app_download_click",
        "app_install_first_open",
        "app_install_account_linked",
      ]);
      const event = clean(req.body?.event, 64);
      if (!allowed.has(event)) return res.status(400).json({ message: "Unsupported promotion event" });
      const visitorId = clean(req.body?.visitorId, 96).replace(/[^a-zA-Z0-9._:-]/g, "");
      const installationId = clean(req.body?.installationId, 96).replace(/[^a-zA-Z0-9._:-]/g, "");
      if (!visitorId && !installationId) return res.status(400).json({ message: "Missing visitor identifier" });
      const meta = {
        event,
        visitorId,
        installationId,
        path: clean(req.body?.path || req.path, 240),
        source: normalizeSource(req.body?.source || req.get?.("referer") || "direct"),
        medium: clean(req.body?.medium, 80),
        campaign: clean(req.body?.campaign, 160) || (event.startsWith("app_install_") ? "unknown" : GW4_PROMO_CAMPAIGN),
        content: clean(req.body?.content, 160),
        userAgent: clean(req.headers["user-agent"], 300),
      };
      const userId = requestUserId(req) || null;
      await db.execute(sql`insert into app.audit_logs (user_id, action, meta) values (${userId}, 'marketing.gw4_free', ${JSON.stringify(meta)}::jsonb)`);
      return res.status(202).json({ ok: true });
    } catch (error) {
      console.warn("GW4 promotion event failed:", error);
      return res.status(202).json({ ok: false });
    }
  });

  app.get("/api/admin/gw4-promo", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const hours = Math.min(24 * 30, Math.max(1, Number(req.query.hours || 168) || 168));
      const intervalText = `${hours} hours`;
      const sourceFilter = normalizeSource(req.query.source || "");
      const useSourceFilter = Boolean(clean(req.query.source));

      const eventRows = rowsOf(await db.execute(sql`
        select meta->>'event' as event,
          count(distinct coalesce(nullif(meta->>'installationId',''), nullif(meta->>'visitorId',''), id::text))::int as count
        from app.audit_logs
        where action = 'marketing.gw4_free'
          and created_at >= now() - ${intervalText}::interval
          and (meta->>'campaign' = ${GW4_PROMO_CAMPAIGN} or meta->>'event' = 'app_install_first_open')
          and (${useSourceFilter} = false or lower(coalesce(meta->>'source','')) = ${sourceFilter})
        group by meta->>'event'
      `));
      const events = Object.fromEntries(eventRows.map((row: any) => [String(row.event || ""), Number(row.count || 0)]));

      const authRows = rowsOf(await db.execute(sql`
        select action, count(distinct coalesce(nullif(meta->>'visitorId',''), user_id, id::text))::int as count
        from app.audit_logs
        where action in ('marketing.gw4_auth_started','marketing.gw4_signup_completed','marketing.gw4_login_completed')
          and created_at >= now() - ${intervalText}::interval
          and meta->>'campaign' = ${GW4_PROMO_CAMPAIGN}
          and (${useSourceFilter} = false or lower(coalesce(meta->>'source','')) = ${sourceFilter})
        group by action
      `));
      const auth = Object.fromEntries(authRows.map((row: any) => [String(row.action || ""), Number(row.count || 0)]));

      const starterRow = rowsOf(await db.execute(sql`
        with promo_users as (
          select distinct user_id from app.audit_logs
          where action = 'marketing.gw4_signup_completed'
            and created_at >= now() - ${intervalText}::interval
            and meta->>'campaign' = ${GW4_PROMO_CAMPAIGN}
            and (${useSourceFilter} = false or lower(coalesce(meta->>'source','')) = ${sourceFilter})
            and user_id is not null
        )
        select count(*) filter (where coalesce(o.completed,false) = true)::int as completed
        from promo_users p left join app.user_onboarding o on o.user_id = p.user_id
      `))[0] || {};

      const linkedInstallRow = rowsOf(await db.execute(sql`
        with promo_users as (
          select distinct user_id from app.audit_logs
          where action = 'marketing.gw4_signup_completed'
            and created_at >= now() - ${intervalText}::interval
            and meta->>'campaign' = ${GW4_PROMO_CAMPAIGN}
            and (${useSourceFilter} = false or lower(coalesce(meta->>'source','')) = ${sourceFilter})
            and user_id is not null
        )
        select count(distinct nullif(i.meta->>'installationId',''))::int as count
        from promo_users p
        join app.audit_logs i on i.user_id = p.user_id
          and i.action = 'marketing.gw4_free'
          and i.meta->>'event' = 'app_install_account_linked'
      `))[0] || {};

      const globalInstallRow = rowsOf(await db.execute(sql`
        select count(distinct nullif(meta->>'installationId',''))::int as count
        from app.audit_logs
        where action = 'marketing.gw4_free'
          and meta->>'event' = 'app_install_first_open'
          and created_at >= now() - ${intervalText}::interval
      `))[0] || {};

      const attempts = rowsOf(await db.execute(sql`
        with starts as (
          select distinct on (meta->>'visitorId') meta, created_at
          from app.audit_logs
          where action = 'marketing.gw4_auth_started'
            and created_at >= now() - ${intervalText}::interval
            and meta->>'campaign' = ${GW4_PROMO_CAMPAIGN}
            and (${useSourceFilter} = false or lower(coalesce(meta->>'source','')) = ${sourceFilter})
          order by meta->>'visitorId', created_at desc
        ), completions as (
          select distinct on (meta->>'visitorId') meta->>'visitorId' as visitor_id, user_id, action, created_at
          from app.audit_logs
          where action in ('marketing.gw4_signup_completed','marketing.gw4_login_completed')
            and meta->>'campaign' = ${GW4_PROMO_CAMPAIGN}
          order by meta->>'visitorId', created_at desc
        )
        select s.meta->>'visitorId' as "visitorId", coalesce(s.meta->>'source','direct') as source,
          coalesce(s.meta->>'content','') as content, s.created_at as "startedAt",
          case when c.action = 'marketing.gw4_signup_completed' then 'new_signup'
               when c.action = 'marketing.gw4_login_completed' then 'returning_login'
               else 'started_only' end as outcome,
          u.email, coalesce(u.manager_team_name, u.name) as "clubName"
        from starts s
        left join completions c on c.visitor_id = s.meta->>'visitorId'
        left join app.users u on u.id = c.user_id
        order by s.created_at desc limit 100
      `)).map((row: any) => ({ ...row, startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : "" }));

      const signups = rowsOf(await db.execute(sql`
        with completed as (
          select distinct on (user_id) user_id, meta, created_at
          from app.audit_logs
          where action = 'marketing.gw4_signup_completed'
            and created_at >= now() - ${intervalText}::interval
            and meta->>'campaign' = ${GW4_PROMO_CAMPAIGN}
            and (${useSourceFilter} = false or lower(coalesce(meta->>'source','')) = ${sourceFilter})
            and user_id is not null
          order by user_id, created_at asc
        )
        select c.user_id as "userId", u.email, u.name, coalesce(u.manager_team_name,u.name) as "clubName",
          coalesce(c.meta->>'source','direct') as source, coalesce(c.meta->>'content','') as content,
          c.created_at as "signedUpAt", coalesce(o.completed,false) as "starter5Completed",
          exists(select 1 from app.audit_logs i where i.user_id = c.user_id and i.action='marketing.gw4_free' and i.meta->>'event'='app_install_account_linked') as "installedApp"
        from completed c
        join app.users u on u.id = c.user_id
        left join app.user_onboarding o on o.user_id = c.user_id
        order by c.created_at desc limit 100
      `)).map((row: any) => ({ ...row, signedUpAt: row.signedUpAt ? new Date(row.signedUpAt).toISOString() : "" }));

      const bySource = rowsOf(await db.execute(sql`
        with clicks as (
          select lower(coalesce(meta->>'source','direct')) as source,
            count(distinct nullif(meta->>'visitorId',''))::int as clicks
          from app.audit_logs where action='marketing.gw4_free' and meta->>'event'='promo_click'
            and meta->>'campaign'=${GW4_PROMO_CAMPAIGN} and created_at >= now() - ${intervalText}::interval
          group by lower(coalesce(meta->>'source','direct'))
        ), signups as (
          select lower(coalesce(meta->>'source','direct')) as source,
            count(distinct user_id)::int as signups
          from app.audit_logs where action='marketing.gw4_signup_completed'
            and meta->>'campaign'=${GW4_PROMO_CAMPAIGN} and created_at >= now() - ${intervalText}::interval
          group by lower(coalesce(meta->>'source','direct'))
        )
        select coalesce(c.source,s.source,'direct') as source, coalesce(c.clicks,0)::int as clicks, coalesce(s.signups,0)::int as signups
        from clicks c full join signups s on s.source=c.source
        order by clicks desc, signups desc
      `));

      return res.json({
        campaign: GW4_PROMO_CAMPAIGN,
        hours,
        metrics: {
          adLandingClicks: Number(events.promo_click || 0),
          signupButtonClicks: Number(events.promo_signup_click || 0),
          authStarted: Number(auth["marketing.gw4_auth_started"] || 0),
          newAccounts: Number(auth["marketing.gw4_signup_completed"] || 0),
          returningLogins: Number(auth["marketing.gw4_login_completed"] || 0),
          starter5Completed: Number(starterRow.completed || 0),
          tournamentOpenedAfterSignup: Number(events.tournament_open_after_signup || 0),
          appDownloadClicks: Number(events.app_download_click || 0),
          campaignLinkedInstalls: Number(linkedInstallRow.count || 0),
          globalNativeFirstOpens: Number(globalInstallRow.count || 0),
        },
        bySource,
        attempts,
        signups,
      });
    } catch (error: any) {
      console.error("Failed to fetch GW4 promotion analytics:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch promotion analytics" });
    }
  });
}
